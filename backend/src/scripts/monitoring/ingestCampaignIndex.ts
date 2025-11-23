import 'dotenv/config';
import { closeConnection, createMonitoringConnection, initMonitoringSchema, runSql, sqlNumber, sqlString } from '../../lib/monitoringDb';
import { fetchStrategistSnapshotRows, StrategistSource } from '../../lib/strategistSnapshots';
import { StrategisApi } from '../../lib/strategisApi';

type Level = 'campaign' | 'adset';

type CampaignRecordInput = {
  campaignId: string;
  level: Level;
  date: string;
  snapshotSource: StrategistSource;
  accountId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  owner?: string | null;
  lane?: string | null;
  category?: string | null;
  mediaSource?: string | null;
  spendUsd?: number | null;
  revenueUsd?: number | null;
  sessions?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  roas?: number | null;
  raw: Record<string, any>;
};

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function pick(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      const value = row[key];
      if (typeof value === 'string') {
        if (value.trim().length > 0) return value;
      } else {
        return value;
      }
    }
  }
  return null;
}

function pickNumber(row: Record<string, any>, keys: string[]): number | null {
  const raw = pick(row, keys);
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function buildRecordFromSnapshotRow(
  row: Record<string, any>,
  ctx: { date: string; source: StrategistSource; level: Level }
): CampaignRecordInput | null {
  const campaignId = pick(row, ['campaign_id', 'campaignid', 'campaign'])?.toString().trim();
  if (!campaignId) return null;
  return {
    campaignId,
    level: ctx.level,
    date: ctx.date,
    snapshotSource: ctx.source,
    accountId: pick(row, ['account_id', 'ad_account_id', 'accountid']),
    campaignName: pick(row, ['campaign_name', 'name']),
    adsetId: pick(row, ['adset_id', 'ad_set_id']),
    adsetName: pick(row, ['adset_name', 'ad_set_name']),
    owner: pick(row, ['owner']),
    lane: pick(row, ['lane']),
    category: pick(row, ['category']),
    mediaSource: pick(row, ['source', 'traffic_source', 'media_source']),
    spendUsd: pickNumber(row, ['spend_usd', 'spend']),
    revenueUsd: pickNumber(row, ['revenue_usd', 'revenue']),
    sessions: pickNumber(row, ['sessions']),
    clicks: pickNumber(row, ['clicks']),
    conversions: pickNumber(row, ['conversions']),
    roas: pickNumber(row, ['roas']),
    raw: row,
  };
}

async function upsertRow(
  opts: {
    campaignId: string;
    level: Level;
    date: string;
    snapshotSource: StrategistSource;
    accountId?: string | null;
    campaignName?: string | null;
    adsetId?: string | null;
    adsetName?: string | null;
    owner?: string | null;
    lane?: string | null;
    category?: string | null;
    mediaSource?: string | null;
    spendUsd?: number | null;
    revenueUsd?: number | null;
    sessions?: number | null;
    clicks?: number | null;
    conversions?: number | null;
    roas?: number | null;
    raw: Record<string, any>;
  },
  conn: ReturnType<typeof createMonitoringConnection>
): Promise<void> {
  const deleteSql = `
    DELETE FROM campaign_index
    WHERE campaign_id = ${sqlString(opts.campaignId)}
      AND date = ${sqlString(opts.date)}
      AND snapshot_source = ${sqlString(opts.snapshotSource)}
      AND level = ${sqlString(opts.level)};
  `;
  await runSql(conn, deleteSql);

  const insertSql = `
    INSERT INTO campaign_index (
      campaign_id,
      level,
      date,
      snapshot_source,
      account_id,
      campaign_name,
      adset_id,
      adset_name,
      owner,
      lane,
      category,
      media_source,
      spend_usd,
      revenue_usd,
      sessions,
      clicks,
      conversions,
      roas,
      raw_payload,
      updated_at
    ) VALUES (
      ${sqlString(opts.campaignId)},
      ${sqlString(opts.level)},
      ${sqlString(opts.date)},
      ${sqlString(opts.snapshotSource)},
      ${sqlString(opts.accountId || null)},
      ${sqlString(opts.campaignName || null)},
      ${sqlString(opts.adsetId || null)},
      ${sqlString(opts.adsetName || null)},
      ${sqlString(opts.owner || null)},
      ${sqlString(opts.lane || null)},
      ${sqlString(opts.category || null)},
      ${sqlString(opts.mediaSource || null)},
      ${sqlNumber(opts.spendUsd)},
      ${sqlNumber(opts.revenueUsd)},
      ${sqlNumber(opts.sessions)},
      ${sqlNumber(opts.clicks)},
      ${sqlNumber(opts.conversions)},
      ${sqlNumber(opts.roas)},
      ${sqlString(JSON.stringify(opts.raw))},
      CURRENT_TIMESTAMP
    );
  `;
  await runSql(conn, insertSql);
}

async function recordRun(
  conn: ReturnType<typeof createMonitoringConnection>,
  info: {
    date: string;
    snapshotSource: StrategistSource;
    level: Level;
    rowCount: number;
    status: 'success' | 'failed';
    message?: string;
  }
): Promise<void> {
  const sql = `
    INSERT INTO campaign_index_runs (date, snapshot_source, level, row_count, status, message, finished_at)
    VALUES (
      ${sqlString(info.date)},
      ${sqlString(info.snapshotSource)},
      ${sqlString(info.level)},
      ${info.rowCount},
      ${sqlString(info.status)},
      ${sqlString(info.message || null)},
      CURRENT_TIMESTAMP
    )
  `;
  await runSql(conn, sql);
}

type AggregateMetricKey = 'spendUsd' | 'revenueUsd' | 'sessions' | 'clicks' | 'conversions';

type SourceMetricSummary = {
  rows: number;
  spendUsd?: number;
  revenueUsd?: number;
  sessions?: number;
  clicks?: number;
  conversions?: number;
  avgRpc?: number;
};

type CampaignAggregate = {
  key: string;
  strategisCampaignId?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  accountId?: string | null;
  campaignName?: string | null;
  owner?: string | null;
  lane?: string | null;
  category?: string | null;
  mediaSource?: string | null;
  spendUsd: number;
  revenueUsd: number;
  sessions: number;
  clicks: number;
  conversions: number;
  avgRpc?: number | null;
  sourceMetrics: Record<string, SourceMetricSummary>;
};

class CampaignAggregator {
  private readonly aggregates = new Map<string, CampaignAggregate>();

  constructor(private readonly date: string, private readonly level: Level) {}

  mergeFacebookReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'facebook_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'accountId', pick(row, ['account_id', 'ad_account_id']));
      this.setIfEmpty(agg, 'campaignName', pick(row, ['campaign_name', 'name']));
      this.setIfEmpty(agg, 'owner', pick(row, ['owner']));
      this.setIfEmpty(agg, 'lane', pick(row, ['lane']));
      this.setIfEmpty(agg, 'category', pick(row, ['category']));
      this.setIfEmpty(agg, 'mediaSource', 'facebook');
      this.addNumber(agg, 'facebook_report', 'spendUsd', pickNumber(row, ['spend', 'spend_usd', 'amount_spent']));
      this.addNumber(agg, 'facebook_report', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 'facebook_report', 'conversions', pickNumber(row, ['conversions', 'purchase', 'purchases']));
    }
  }

  mergeFacebookCampaigns(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'facebook_campaigns');
      if (!agg) continue;
      this.setIfEmpty(agg, 'accountId', pick(row, ['account_id', 'ad_account_id']));
      this.setIfEmpty(agg, 'campaignName', pick(row, ['campaign_name', 'name']));
      this.setIfEmpty(agg, 'owner', pick(row, ['owner']));
      this.setIfEmpty(agg, 'lane', pick(row, ['lane']));
      this.setIfEmpty(agg, 'category', pick(row, ['category']));
      this.setIfEmpty(agg, 'mediaSource', 'facebook');
    }
  }

  mergeFacebookAdsets(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'facebook_adsets');
      if (!agg) continue;
      this.setIfEmpty(agg, 'adsetId', pick(row, ['adset_id', 'adSetId']));
      this.setIfEmpty(agg, 'adsetName', pick(row, ['adset_name', 'adSetName']));
      this.setIfEmpty(agg, 'mediaSource', 'facebook');
      this.addNumber(agg, 'facebook_adsets', 'spendUsd', pickNumber(row, ['spend', 'spend_usd']));
      this.addNumber(agg, 'facebook_adsets', 'clicks', pickNumber(row, ['clicks']));
    }
  }

  mergeS1Daily(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 's1_daily_v3');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', pick(row, ['source', 'networkName', 'adSource']));
      this.addNumber(agg, 's1_daily_v3', 'revenueUsd', pickNumber(row, ['revenue', 'revenue_usd', 'estimated_revenue']));
      this.addNumber(agg, 's1_daily_v3', 'sessions', pickNumber(row, ['sessions', 'searches', 'visits']));
      this.addNumber(agg, 's1_daily_v3', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 's1_daily_v3', 'conversions', pickNumber(row, ['conversions']));
    }
  }

  mergeS1Rpc(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 's1_rpc_average');
      if (!agg) continue;
      const avgRpc = pickNumber(row, ['rpc', 'rpc_average', 'avg_rpc']);
      if (avgRpc !== null && avgRpc !== undefined) {
        agg.avgRpc = avgRpc;
        const metrics = agg.sourceMetrics['s1_rpc_average'];
        if (metrics) {
          metrics.avgRpc = avgRpc;
        }
      }
    }
  }

  mergePixel(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'facebook_pixel');
      if (!agg) continue;
      this.addNumber(agg, 'facebook_pixel', 'conversions', pickNumber(row, ['conversions', 'purchases', 'pixel_conversions']));
      this.addNumber(agg, 'facebook_pixel', 'clicks', pickNumber(row, ['clicks']));
    }
  }

  mergeStrategisMetrics(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'strategis_metrics');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', pick(row, ['media_source', 'source', 'networkName']));
      this.addNumber(agg, 'strategis_metrics', 'sessions', pickNumber(row, ['sessions', 'searches']));
      this.addNumber(agg, 'strategis_metrics', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 'strategis_metrics', 'spendUsd', pickNumber(row, ['spend', 'spend_usd']));
      this.addNumber(agg, 'strategis_metrics', 'revenueUsd', pickNumber(row, ['revenue', 'estimated_revenue']));
    }
  }

  toRecords(snapshotSource: StrategistSource): CampaignRecordInput[] {
    const rows: CampaignRecordInput[] = [];
    for (const agg of this.aggregates.values()) {
      const campaignId = agg.strategisCampaignId || agg.campaignId;
      if (!campaignId) continue;
      const spend = asNullable(agg.spendUsd);
      const revenue = asNullable(agg.revenueUsd);
      const roas = spend && revenue ? revenue / spend : null;
      rows.push({
        campaignId,
        level: this.level,
        date: this.date,
        snapshotSource,
        accountId: agg.accountId ?? null,
        campaignName: agg.campaignName ?? null,
        adsetId: agg.adsetId ?? null,
        adsetName: agg.adsetName ?? null,
        owner: agg.owner ?? null,
        lane: agg.lane ?? null,
        category: agg.category ?? null,
        mediaSource: agg.mediaSource ?? null,
        spendUsd: spend,
        revenueUsd: revenue,
        sessions: asNullable(agg.sessions),
        clicks: asNullable(agg.clicks),
        conversions: asNullable(agg.conversions),
        roas,
        raw: {
          strategisCampaignId: agg.strategisCampaignId ?? null,
          campaignId: agg.campaignId ?? null,
          avgRpc: agg.avgRpc ?? null,
          sourceMetrics: agg.sourceMetrics,
        },
      });
    }
    return rows;
  }

  private ensureAggregate(row: Record<string, any>, dataset: string): CampaignAggregate | null {
    const strategisId = pickId(row, [
      'strategisCampaignId',
      'strategis_campaign_id',
      'strategiscampaignid',
      'strategisCampaignID',
    ]);
    const campaignId = pickId(row, ['campaign_id', 'campaignId', 'campaign']);
    const key = strategisId || campaignId;
    if (!key) return null;
    let agg = this.aggregates.get(key);
    if (!agg) {
      agg = {
        key,
        strategisCampaignId: strategisId ?? null,
        campaignId: campaignId ?? strategisId ?? key,
        spendUsd: 0,
        revenueUsd: 0,
        sessions: 0,
        clicks: 0,
        conversions: 0,
        sourceMetrics: {},
      };
      this.aggregates.set(key, agg);
    } else {
      if (!agg.strategisCampaignId && strategisId) agg.strategisCampaignId = strategisId;
      if (!agg.campaignId && campaignId) agg.campaignId = campaignId;
    }
    if (!agg.sourceMetrics[dataset]) {
      agg.sourceMetrics[dataset] = { rows: 0 };
    }
    agg.sourceMetrics[dataset].rows += 1;
    return agg;
  }

  private addNumber(
    agg: CampaignAggregate,
    dataset: string,
    field: AggregateMetricKey,
    value: number | null | undefined
  ): void {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    agg[field] += value;
    const metrics = agg.sourceMetrics[dataset] || (agg.sourceMetrics[dataset] = { rows: 0 });
    metrics[field] = (metrics[field] || 0) + value;
  }

  private setIfEmpty(
    agg: CampaignAggregate,
    field: 'accountId' | 'campaignName' | 'owner' | 'lane' | 'category' | 'mediaSource' | 'adsetId' | 'adsetName',
    value?: string | null
  ): void {
    if (!value) return;
    if ((agg as any)[field]) return;
    (agg as any)[field] = value;
  }
}

function pickId(row: Record<string, any>, keys: string[]): string | null {
  const value = pick(row, keys);
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  return String(value);
}

function asNullable(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return value === 0 ? null : value;
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const source = (getFlag('source', 'day').toLowerCase() === 'reconciled' ? 'reconciled' : 'day') as StrategistSource;
  const level = (getFlag('level', 'campaign').toLowerCase() === 'adset' ? 'adset' : 'campaign') as Level;
  const limitStr = getFlag('limit', '');
  const limit = limitStr ? Math.max(1, Math.min(Number(limitStr) || 50000, 200000)) : 50000;
  const mode = getFlag('mode', 'snapshot').toLowerCase();

  let records: CampaignRecordInput[] = [];
  if (mode === 'remote') {
    console.log(`[ingestCampaignIndex] Fetching Strategis datasets for ${date} (${level}) ...`);
    const api = new StrategisApi();
    const aggregator = new CampaignAggregator(date, level);
    const steps: Array<{
      label: string;
      fetch: () => Promise<any[]>;
      merge: (rows: any[]) => void;
    }> = [
      { label: 'facebook_report', fetch: () => api.fetchFacebookReport(date), merge: (rows) => aggregator.mergeFacebookReport(rows) },
      { label: 'facebook_campaigns', fetch: () => api.fetchFacebookCampaigns(date), merge: (rows) => aggregator.mergeFacebookCampaigns(rows) },
      { label: 'facebook_adsets', fetch: () => api.fetchFacebookAdsets(date), merge: (rows) => aggregator.mergeFacebookAdsets(rows) },
      { label: 's1_daily_v3', fetch: () => api.fetchS1Daily(date), merge: (rows) => aggregator.mergeS1Daily(rows) },
      { label: 's1_rpc_average', fetch: () => api.fetchS1RpcAverage(date), merge: (rows) => aggregator.mergeS1Rpc(rows) },
      { label: 'facebook_pixel', fetch: () => api.fetchFacebookPixelReport(date), merge: (rows) => aggregator.mergePixel(rows) },
      { label: 'strategis_metrics', fetch: () => api.fetchStrategisMetrics(date), merge: (rows) => aggregator.mergeStrategisMetrics(rows) },
    ];

    for (const step of steps) {
      console.log(`[ingestCampaignIndex] -> ${step.label} ...`);
      try {
        const payload = await step.fetch();
        console.log(`[ingestCampaignIndex] <- ${step.label}: ${payload.length} rows`);
        step.merge(payload);
      } catch (err: any) {
        console.error(`[ingestCampaignIndex] ${step.label} failed:`, err?.message || err);
        throw err;
      }
    }
    records = aggregator.toRecords(source);
  } else {
    console.log(`[ingestCampaignIndex] Fetching ${source} snapshot for ${date} (${level}) ...`);
    const snapshot = await fetchStrategistSnapshotRows({ date, source, level, limit });
    console.log(`[ingestCampaignIndex] Retrieved ${snapshot.rows.length} rows from ${snapshot.snapshotDir}`);
    records = snapshot.rows
      .map((row) => buildRecordFromSnapshotRow(row, { date, source, level }))
      .filter((r): r is CampaignRecordInput => Boolean(r));
  }
  console.log(`[ingestCampaignIndex] Processing ${records.length} records`);

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    let inserted = 0;

    for (const record of records) {
      await upsertRow(record, conn);
      inserted += 1;
    }

    await recordRun(conn, {
      date,
      snapshotSource: source,
      level,
      rowCount: inserted,
      status: 'success',
    });
    console.log(`[ingestCampaignIndex] Upserted ${inserted} rows into campaign_index`);
  } catch (err: any) {
    await recordRun(conn, {
      date,
      snapshotSource: source,
      level,
      rowCount: 0,
      status: 'failed',
      message: err?.message || String(err),
    });
    throw err;
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('[ingestCampaignIndex] Fatal error:', err);
  process.exit(1);
});

