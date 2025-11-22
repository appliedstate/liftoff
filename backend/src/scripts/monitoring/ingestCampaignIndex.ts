import 'dotenv/config';
import { closeConnection, createMonitoringConnection, initMonitoringSchema, runSql, sqlNumber, sqlString } from '../../lib/monitoringDb';
import { fetchStrategistSnapshotRows, StrategistSource } from '../../lib/strategistSnapshots';
import { createStrategistClient } from '../../lib/strategistClient';

type Level = 'campaign' | 'adset';

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

function normalizeResponseRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}

async function fetchRowsFromRemote(params: { date: string; source: StrategistSource; level: Level; limit: number }): Promise<any[]> {
  const client = createStrategistClient();
  const payload = await client.get('/api/strategist/query', {
    date: params.date,
    source: params.source,
    level: params.level,
    limit: params.limit,
    format: 'json',
    overlay: '0',
  });
  const rows = normalizeResponseRows(payload);
  if (!rows.length) {
    throw new Error('Remote strategist/query returned no rows');
  }
  return rows;
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const source = (getFlag('source', 'day').toLowerCase() === 'reconciled' ? 'reconciled' : 'day') as StrategistSource;
  const level = (getFlag('level', 'campaign').toLowerCase() === 'adset' ? 'adset' : 'campaign') as Level;
  const limitStr = getFlag('limit', '');
  const limit = limitStr ? Math.max(1, Math.min(Number(limitStr) || 50000, 200000)) : 50000;
  const mode = getFlag('mode', 'snapshot').toLowerCase();

  let rows: any[] = [];
  if (mode === 'remote') {
    console.log(`[ingestCampaignIndex] Fetching remote strategist/query for ${date} (${level}, ${source}) ...`);
    rows = await fetchRowsFromRemote({ date, source, level, limit });
  } else {
    console.log(`[ingestCampaignIndex] Fetching ${source} snapshot for ${date} (${level}) ...`);
    const snapshot = await fetchStrategistSnapshotRows({ date, source, level, limit });
    console.log(`[ingestCampaignIndex] Retrieved ${snapshot.rows.length} rows from ${snapshot.snapshotDir}`);
    rows = snapshot.rows;
  }
  console.log(`[ingestCampaignIndex] Processing ${rows.length} rows`);

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    let inserted = 0;

    for (const row of rows) {
      const campaignId = pick(row, ['campaign_id', 'campaignid', 'campaign'])?.toString().trim();
      if (!campaignId) continue;

      const record = {
        campaignId,
        level,
        date,
        snapshotSource: source,
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
        raw: row as Record<string, any>,
      };

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

