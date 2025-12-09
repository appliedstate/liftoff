import 'dotenv/config';
import { closeConnection, createMonitoringConnection, initMonitoringSchema, runSql, sqlNumber, sqlString, allRows } from '../../lib/monitoringDb';
import { fetchStrategistSnapshotRows, StrategistSource } from '../../lib/strategistSnapshots';
import { StrategisApi } from '../../lib/strategisApi';
import { getPlatformFromNetworkId } from '../../lib/networkIds';
import {
  withRetry,
  checkDataQuality,
  extractFinancialIndicators,
  determineStatus,
  getPlatformFromEndpoint,
  type EndpointResult,
  type EndpointStatus,
} from '../../lib/endpointMonitoring';

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
  facebookCampaignId?: string | null;
  owner?: string | null;
  lane?: string | null;
  category?: string | null;
  mediaSource?: string | null;
  rsocSite?: string | null;
  s1GoogleAccount?: string | null;
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

/**
 * Maps rsocSite to S1 Google AdSense Account
 * Based on the site → S1 Google Account mapping table
 */
function mapRsocSiteToS1GoogleAccount(rsocSite: string | null | undefined): string | null {
  if (!rsocSite) return null;
  const site = String(rsocSite).toLowerCase().trim();
  
  // Site → S1 Google Account mapping
  const siteToAccountMap: Record<string, string> = {
    'trusted-info': 'Zeus LLC',
    'wesoughtit.com': 'Zeus LLC',
    'read.travelroo.com': 'Sunday Market Media Inc',
    'topicwhich.com': 'Infospace Holdings',
    'eworld.tips': 'Huntley Media',
    'secretprice.com': 'Huntley Media',
    'trivia-library.com': 'Huntley Media',
    'searchalike.com': 'System1OpCo',
    'read.classroom67': '© 2025 read.Classroom67.com',
    'topicassist': 'System1OpCo',
    'dlg': 'System1OpCo',
  };
  
  return siteToAccountMap[site] || null;
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
    facebookCampaignId?: string | null;
    owner?: string | null;
    lane?: string | null;
    category?: string | null;
    mediaSource?: string | null;
    rsocSite?: string | null;
    s1GoogleAccount?: string | null;
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
      facebook_campaign_id,
      owner,
      lane,
      category,
      media_source,
      rsoc_site,
      s1_google_account,
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
      ${sqlString(opts.facebookCampaignId || null)},
      ${sqlString(opts.owner || null)},
      ${sqlString(opts.lane || null)},
      ${sqlString(opts.category || null)},
      ${sqlString(opts.mediaSource || null)},
      ${sqlString(opts.rsocSite || null)},
      ${sqlString(opts.s1GoogleAccount || null)},
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

async function recordEndpointCompleteness(
  conn: ReturnType<typeof createMonitoringConnection>,
  info: {
    date: string;
    endpoint: string;
    platform: string | null;
    status: EndpointStatus;
    rowCount: number;
    expectedMinRows?: number;
    hasRevenue: boolean;
    hasSpend: boolean;
    errorMessage?: string;
    retryCount: number;
  }
): Promise<void> {
  // Use DELETE + INSERT pattern for DuckDB upsert (since PRIMARY KEY constraint exists)
  const deleteSql = `
    DELETE FROM endpoint_completeness
    WHERE date = ${sqlString(info.date)}
      AND endpoint = ${sqlString(info.endpoint)}
  `;
  await runSql(conn, deleteSql);
  
  const insertSql = `
    INSERT INTO endpoint_completeness (
      date, endpoint, platform, status, row_count, expected_min_rows,
      has_revenue, has_spend, error_message, retry_count, started_at, finished_at
    )
    VALUES (
      ${sqlString(info.date)},
      ${sqlString(info.endpoint)},
      ${sqlString(info.platform)},
      ${sqlString(info.status)},
      ${info.rowCount},
      ${sqlNumber(info.expectedMinRows)},
      ${info.hasRevenue ? 'TRUE' : 'FALSE'},
      ${info.hasSpend ? 'TRUE' : 'FALSE'},
      ${sqlString(info.errorMessage || null)},
      ${info.retryCount},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  await runSql(conn, insertSql);
}

async function getExpectedMinRows(
  conn: ReturnType<typeof createMonitoringConnection>,
  endpoint: string,
  date: string
): Promise<number | undefined> {
  // Get 7-day average row count for this endpoint
  const sql = `
    SELECT AVG(row_count) as avg_rows
    FROM endpoint_completeness
    WHERE endpoint = ${sqlString(endpoint)}
      AND date < ${sqlString(date)}
      AND date >= DATE_SUB(${sqlString(date)}, INTERVAL 7 DAY)
      AND status = 'OK'
      AND row_count > 0
  `;
  try {
    const rows = await allRows<{ avg_rows: number | null }>(conn, sql);
    const avg = rows[0]?.avg_rows;
    return avg && avg > 0 ? Math.floor(avg) : undefined;
  } catch {
    return undefined;
  }
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
  facebookCampaignId?: string | null;
  accountId?: string | null;
  campaignName?: string | null;
  owner?: string | null;
  lane?: string | null;
  category?: string | null;
  mediaSource?: string | null;
  rsocSite?: string | null;
  s1GoogleAccount?: string | null;
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
      // Extract Facebook campaign ID from Facebook campaigns API response
      // The campaign_id field in Facebook API responses is the Facebook campaign ID
      // But note: Facebook APIs may return strategisCampaignId instead
      const fbCampaignId = pick(row, ['id', 'campaign_id', 'campaignId', 'fbCampaignId', 'fb_campaign_id']);
      if (fbCampaignId && String(fbCampaignId).length > 10 && !fbCampaignId.includes('sipuli') && !fbCampaignId.match(/^[a-z]/i)) {
        // Facebook IDs are long numeric strings, not short alphanumeric like Strategis IDs
        this.setIfEmpty(agg, 'facebookCampaignId', fbCampaignId);
      }
    }
  }

  mergeFacebookAdsets(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'facebook_adsets');
      if (!agg) continue;
      this.setIfEmpty(agg, 'adsetId', pick(row, ['adset_id', 'adSetId', 'adsetId']));
      this.setIfEmpty(agg, 'adsetName', pick(row, ['adset_name', 'adSetName', 'adsetName']));
      this.setIfEmpty(agg, 'mediaSource', 'facebook');
      // Extract Facebook campaign ID from adset data
      // Facebook adsets have a campaign_id field that is the Facebook campaign ID
      const fbCampaignId = pick(row, ['campaign_id', 'campaignId', 'fbCampaignId', 'fb_campaign_id']);
      if (fbCampaignId && String(fbCampaignId).length > 10) { // Facebook IDs are long numbers
        this.setIfEmpty(agg, 'facebookCampaignId', fbCampaignId);
      }
      this.addNumber(agg, 'facebook_adsets', 'spendUsd', pickNumber(row, ['spend', 'spend_usd']));
      this.addNumber(agg, 'facebook_adsets', 'clicks', pickNumber(row, ['clicks']));
    }
  }

  mergeS1Daily(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 's1_daily_v3');
      if (!agg) continue;
      // Extract metadata fields that S1 daily includes (buyer, category, networkAccountId, etc.)
      // buyer field is included when dimensions includes 'buyer' - it represents lane/owner
      const buyer = pick(row, ['buyer', 'owner']);
      if (buyer) {
        this.setIfEmpty(agg, 'owner', buyer);
        this.setIfEmpty(agg, 'lane', buyer); // buyer is the lane field
      }
      this.setIfEmpty(agg, 'category', pick(row, ['category']));
      this.setIfEmpty(agg, 'accountId', pick(row, ['networkAccountId', 'adAccountId', 'account_id', 'ad_account_id']));
      this.setIfEmpty(agg, 'campaignName', pick(row, ['networkCampaignName', 'campaign_name', 'name']));
      // Extract rsocSite and map to S1 Google Account
      const rsocSite = pick(row, ['rsocSite', 'rsoc_site', 'site']);
      if (rsocSite) {
        this.setIfEmpty(agg, 'rsocSite', rsocSite);
        const s1GoogleAccount = mapRsocSiteToS1GoogleAccount(rsocSite);
        if (s1GoogleAccount) {
          this.setIfEmpty(agg, 's1GoogleAccount', s1GoogleAccount);
        }
      }
      // Media source: map networkId to platform name using complete mapping
      const networkId = pick(row, ['networkId', 'network_id']);
      if (networkId) {
        const mappedSource = getPlatformFromNetworkId(networkId);
        if (mappedSource) {
          this.setIfEmpty(agg, 'mediaSource', mappedSource);
        }
      }
      this.setIfEmpty(agg, 'mediaSource', pick(row, ['source', 'networkName', 'adSource']));
      // Revenue and metrics
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

  mergeS1Reconciled(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 's1_reconciled');
      if (!agg) continue;
      // S1 reconciled has buyer field directly
      this.setIfEmpty(agg, 'owner', pick(row, ['buyer', 'owner']));
      this.setIfEmpty(agg, 'lane', pick(row, ['buyer', 'lane'])); // buyer is lane
      this.setIfEmpty(agg, 'category', pick(row, ['category']));
      this.addNumber(agg, 's1_reconciled', 'revenueUsd', pickNumber(row, ['revenue', 'revenue_usd', 'estimated_revenue']));
      this.addNumber(agg, 's1_reconciled', 'sessions', pickNumber(row, ['sessions', 'searches', 'visits']));
      this.addNumber(agg, 's1_reconciled', 'clicks', pickNumber(row, ['clicks']));
    }
  }

  mergeTaboolaReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'taboola_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'taboola');
      this.addNumber(agg, 'taboola_report', 'spendUsd', pickNumber(row, ['spent', 'spend', 'spend_usd']));
      this.addNumber(agg, 'taboola_report', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 'taboola_report', 'conversions', pickNumber(row, ['cpa_actions_num', 'conversions']));
    }
  }

  mergeOutbrainReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'outbrain_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'outbrain');
      this.addNumber(agg, 'outbrain_report', 'spendUsd', pickNumber(row, ['spent', 'spend', 'spend_usd']));
      this.addNumber(agg, 'outbrain_report', 'clicks', pickNumber(row, ['clicks']));
    }
  }

  mergeNewsbreakReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'newsbreak_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'newsbreak');
      this.addNumber(agg, 'newsbreak_report', 'spendUsd', pickNumber(row, ['spent', 'spend', 'spend_usd']));
      this.addNumber(agg, 'newsbreak_report', 'clicks', pickNumber(row, ['clicks']));
    }
  }

  mergeMediaGoReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'mediago_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'mediago');
      this.addNumber(agg, 'mediago_report', 'spendUsd', pickNumber(row, ['spend', 'spent', 'spend_usd']));
      this.addNumber(agg, 'mediago_report', 'clicks', pickNumber(row, ['click', 'clicks']));
      this.addNumber(agg, 'mediago_report', 'conversions', pickNumber(row, ['conversion', 'conversions']));
    }
  }

  mergeZemantaReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'zemanta_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'zemanta');
      this.addNumber(agg, 'zemanta_report', 'spendUsd', pickNumber(row, ['spend', 'spent', 'spend_usd']));
      this.addNumber(agg, 'zemanta_report', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 'zemanta_report', 'conversions', pickNumber(row, ['conversions']));
    }
  }

  mergeSmartNewsReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'smartnews_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'smartnews');
      this.addNumber(agg, 'smartnews_report', 'spendUsd', pickNumber(row, ['spent', 'spend', 'spend_usd']));
      this.addNumber(agg, 'smartnews_report', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 'smartnews_report', 'conversions', pickNumber(row, ['conversions']));
    }
  }

  mergeGoogleAdsReport(rows: any[]): void {
    for (const row of rows) {
      const agg = this.ensureAggregate(row, 'googleads_report');
      if (!agg) continue;
      this.setIfEmpty(agg, 'mediaSource', 'googleads');
      this.addNumber(agg, 'googleads_report', 'spendUsd', pickNumber(row, ['spend', 'spent', 'spend_usd', 'cost']));
      this.addNumber(agg, 'googleads_report', 'clicks', pickNumber(row, ['clicks']));
      this.addNumber(agg, 'googleads_report', 'conversions', pickNumber(row, ['conversions']));
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
        facebookCampaignId: agg.facebookCampaignId ?? null,
        owner: agg.owner ?? null,
        lane: agg.lane ?? null,
        category: agg.category ?? null,
        mediaSource: agg.mediaSource ?? null,
        rsocSite: agg.rsocSite ?? null,
        s1GoogleAccount: agg.s1GoogleAccount ?? null,
        spendUsd: spend,
        revenueUsd: revenue,
        sessions: asNullable(agg.sessions),
        clicks: asNullable(agg.clicks),
        conversions: asNullable(agg.conversions),
        roas,
        raw: {
          strategisCampaignId: agg.strategisCampaignId ?? null,
          campaignId: agg.campaignId ?? null,
          facebookCampaignId: agg.facebookCampaignId ?? null,
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
    field: 'accountId' | 'campaignName' | 'owner' | 'lane' | 'category' | 'mediaSource' | 'adsetId' | 'adsetName' | 'rsocSite' | 's1GoogleAccount' | 'facebookCampaignId',
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
  let conn: ReturnType<typeof createMonitoringConnection> | null = null;
  let schemaReady = false;
  
  if (mode === 'remote') {
    console.log(`[ingestCampaignIndex] Fetching Strategis datasets for ${date} (${level}) ...`);
    const api = new StrategisApi();
    const aggregator = new CampaignAggregator(date, level);
    const steps: Array<{
      label: string;
      fetch: () => Promise<any[]>;
      merge: (rows: any[]) => void;
    }> = [
      // S1 Revenue & Metadata (all platforms)
      { label: 's1_daily_v3', fetch: () => api.fetchS1Daily(date, true), merge: (rows) => aggregator.mergeS1Daily(rows) },
      { label: 's1_reconciled', fetch: () => api.fetchS1Reconciled(date, true), merge: (rows) => aggregator.mergeS1Reconciled(rows) },
      { label: 's1_rpc_average', fetch: () => api.fetchS1RpcAverage(date), merge: (rows) => aggregator.mergeS1Rpc(rows) },
      
      // Facebook Data
      { label: 'facebook_report', fetch: () => api.fetchFacebookReport(date), merge: (rows) => aggregator.mergeFacebookReport(rows) },
      { label: 'facebook_campaigns', fetch: () => api.fetchFacebookCampaigns(date), merge: (rows) => aggregator.mergeFacebookCampaigns(rows) },
      { label: 'facebook_adsets', fetch: () => api.fetchFacebookAdsets(date), merge: (rows) => aggregator.mergeFacebookAdsets(rows) },
      { label: 'facebook_pixel', fetch: () => api.fetchFacebookPixelReport(date), merge: (rows) => aggregator.mergePixel(rows) },
      { label: 'strategis_metrics_fb', fetch: () => api.fetchStrategisMetrics(date, 'facebook'), merge: (rows) => aggregator.mergeStrategisMetrics(rows) },
      
      // Platform Spend Data
      { label: 'taboola_report', fetch: () => api.fetchTaboolaReport(date), merge: (rows) => aggregator.mergeTaboolaReport(rows) },
      { label: 'outbrain_report', fetch: () => api.fetchOutbrainHourlyReport(date), merge: (rows) => aggregator.mergeOutbrainReport(rows) },
      { label: 'newsbreak_report', fetch: () => api.fetchNewsbreakReport(date), merge: (rows) => aggregator.mergeNewsbreakReport(rows) },
      { label: 'mediago_report', fetch: () => api.fetchMediaGoReport(date), merge: (rows) => aggregator.mergeMediaGoReport(rows) },
      { label: 'zemanta_report', fetch: () => api.fetchZemantaReconciledReport(date), merge: (rows) => aggregator.mergeZemantaReport(rows) },
      { label: 'smartnews_report', fetch: () => api.fetchSmartNewsReport(date), merge: (rows) => aggregator.mergeSmartNewsReport(rows) },
    ];

    const criticalSteps = ['s1_daily_v3', 's1_reconciled']; // These are required for revenue/metadata
    const optionalSteps = ['taboola_report', 'outbrain_report', 'newsbreak_report', 'mediago_report', 'zemanta_report', 'smartnews_report']; // Spend data - continue if these fail
    
    // Initialize DB connection early for completeness tracking
    conn = createMonitoringConnection();
    try {
      await initMonitoringSchema(conn);
      schemaReady = true;
    } catch (err: any) {
      console.error('[ingestCampaignIndex] Schema initialization failed:', err?.message || err);
      closeConnection(conn);
      throw err;
    }
    
    for (const step of steps) {
      console.log(`[ingestCampaignIndex] -> ${step.label} ...`);
      const isCritical = criticalSteps.includes(step.label);
      const isOptional = optionalSteps.includes(step.label);
      const platform = getPlatformFromEndpoint(step.label);
      
      let result: EndpointResult = {
        success: false,
        rows: [],
        rowCount: 0,
        hasRevenue: false,
        hasSpend: false,
        retryCount: 0,
      };
      
      try {
        // Get expected minimum rows for data quality check
        const expectedMinRows = await getExpectedMinRows(conn, step.label, date);
        
        // Fetch with retry logic for transient failures
        const payload = await withRetry(
          () => step.fetch(),
          {
            maxRetries: isCritical ? 3 : 2, // More retries for critical endpoints
            retryableStatuses: [502, 503, 504, 408],
          }
        );
        
        result = {
          success: true,
          rows: payload,
          rowCount: payload.length,
          ...extractFinancialIndicators(payload),
          retryCount: 0,
        };
        
        // Data quality checks
        const quality = checkDataQuality(payload, step.label, expectedMinRows);
        if (quality.warnings.length > 0) {
          quality.warnings.forEach((w) => console.warn(`[ingestCampaignIndex] ${w}`));
        }
        
        console.log(`[ingestCampaignIndex] <- ${step.label}: ${payload.length} rows${result.hasRevenue ? ' (has revenue)' : ''}${result.hasSpend ? ' (has spend)' : ''}`);
        step.merge(payload);
        
      } catch (err: any) {
        const httpStatus = err?.response?.status;
        const errorMsg = err?.message || String(err).substring(0, 500);
        
        result = {
          success: false,
          rows: [],
          rowCount: 0,
          hasRevenue: false,
          hasSpend: false,
          error: errorMsg,
          httpStatus,
          retryCount: 0,
        };
        
        if (isCritical) {
          // Critical steps (S1 revenue) - fail the whole ingestion
          console.error(`[ingestCampaignIndex] ${step.label} failed (CRITICAL):`, errorMsg);
          
          // Record completeness before throwing
          if (schemaReady && conn) {
            const status = determineStatus(result, true);
            await recordEndpointCompleteness(conn, {
              date,
              endpoint: step.label,
              platform,
              status,
              rowCount: 0,
              hasRevenue: false,
              hasSpend: false,
              errorMessage: errorMsg,
              retryCount: 3, // Max retries exhausted
            });
          }
          
          throw err;
        } else if (isOptional) {
          // Optional steps (platform spend) - log but continue
          console.warn(`[ingestCampaignIndex] ${step.label} failed (OPTIONAL, continuing):`, errorMsg);
        } else {
          // Other steps (Facebook, etc.) - log but continue
          console.warn(`[ingestCampaignIndex] ${step.label} failed (non-critical, continuing):`, errorMsg);
        }
      } finally {
        // Record completeness for all endpoints
        if (schemaReady && conn) {
          const status = determineStatus(result, isCritical);
          await recordEndpointCompleteness(conn, {
            date,
            endpoint: step.label,
            platform,
            status,
            rowCount: result.rowCount,
            hasRevenue: result.hasRevenue,
            hasSpend: result.hasSpend,
            errorMessage: result.error,
            retryCount: result.retryCount || 0,
          });
        }
      }
    }
    
    records = aggregator.toRecords(source);
    // Keep conn open for upserting records below
  } else {
    console.log(`[ingestCampaignIndex] Fetching ${source} snapshot for ${date} (${level}) ...`);
    const snapshot = await fetchStrategistSnapshotRows({ date, source, level, limit });
    console.log(`[ingestCampaignIndex] Retrieved ${snapshot.rows.length} rows from ${snapshot.snapshotDir}`);
    records = snapshot.rows
      .map((row) => buildRecordFromSnapshotRow(row, { date, source, level }))
      .filter((r): r is CampaignRecordInput => Boolean(r));
    
    // Initialize DB connection for snapshot mode
    conn = createMonitoringConnection();
    try {
      await initMonitoringSchema(conn);
      schemaReady = true;
      
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
      if (schemaReady) {
        await recordRun(conn, {
          date,
          snapshotSource: source,
          level,
          rowCount: 0,
          status: 'failed',
          message: err?.message || String(err),
        });
      } else {
        console.error('[ingestCampaignIndex] Skipping run log because schema initialization failed');
      }
      throw err;
    } finally {
      closeConnection(conn);
    }
    return; // Exit early for snapshot mode
  }
  
  // Upsert records using conn (from either remote or snapshot mode)
  console.log(`[ingestCampaignIndex] Processing ${records.length} records`);
  
  if (!conn) {
    throw new Error('Database connection not initialized');
  }
  
  try {
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
    if (schemaReady && conn) {
      await recordRun(conn, {
        date,
        snapshotSource: source,
        level,
        rowCount: 0,
        status: 'failed',
        message: err?.message || String(err),
      });
    } else {
      console.error('[ingestCampaignIndex] Skipping run log because schema initialization failed');
    }
    throw err;
  } finally {
    if (conn) {
      closeConnection(conn);
    }
  }
}

main().catch((err) => {
  console.error('[ingestCampaignIndex] Fatal error:', err);
  process.exit(1);
});

