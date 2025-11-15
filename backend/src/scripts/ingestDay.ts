import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

import { defaultDaySnapshotsBase, ensureDir, writeCsv } from '../lib/snapshots';

dotenv.config();

type Level = 'adset' | 'campaign';

type Config = {
  baseUrl: string;
  organization: string;
  adSource: string;
  bearerToken: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  levels: Level[];
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
  concurrency: number;
  networkId: string; // for S1 endpoints
  timezone: string;  // e.g., UTC
  pageSize: number;
  maxPages: number;
  rps: number; // requests per second (global)
  burst: number; // token bucket capacity
  cbFails: number; // failures to open breaker
  cbCooldownMs: number; // breaker cooldown
  rateLimitEnabled: boolean;
  breakerEnabled: boolean;
  metricsLog: boolean;
  metricsDir?: string;
};

function parseCli(): Partial<Config> {
  const out: Partial<Config> = {};
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split('=');
    if (!k) continue;
    const key = k.replace(/^--/, '');
    if (key === 'start') out.startDate = v;
    else if (key === 'end') out.endDate = v;
    else if (key === 'levels') out.levels = (v || '').split(',').map((s) => s.trim()).filter(Boolean) as Level[];
  }
  return out;
}

function pad(n: number): string { return n < 10 ? '0' + n : String(n); }
function nowUtcStamp(): string {
  const d = new Date();
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function readConfig(): Config {
  const cli = parseCli();
  const baseUrl = (process.env.STRATEGIS_BASE_URL || 'https://strategis.lincx.in').replace(/\/$/, '');
  const organization = process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const adSource = process.env.STRATEGIS_AD_SOURCE || 'rsoc';
  const bearerToken = process.env.STRATEGIS_BEARER_TOKEN || '';
  if (!bearerToken) throw new Error('Missing STRATEGIS_BEARER_TOKEN');

  // Defaults to yesterday for both start and end
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const startDate = cli.startDate || process.env.DAY_START_DATE || yesterday;
  const endDate = cli.endDate || process.env.DAY_END_DATE || startDate;

  const levels = (cli.levels || (process.env.DAY_LEVELS || 'adset,campaign')
    .split(',').map((s) => s.trim()).filter(Boolean)) as Level[];

  const timeoutMs = parseInt(process.env.STRATEGIS_TIMEOUT_MS || '60000', 10);
  const maxRetries = Math.max(0, parseInt(process.env.STRATEGIS_MAX_RETRIES || '3', 10) || 3);
  const retryBackoffMs = Math.max(0, parseInt(process.env.STRATEGIS_RETRY_BACKOFF_MS || '1000', 10) || 1000);
  const concurrency = Math.max(1, parseInt(process.env.STRATEGIS_CONCURRENCY || '3', 10) || 3);
  const networkId = String(process.env.STRATEGIS_NETWORK_ID || '112');
  const timezone = String(process.env.STRATEGIS_TIMEZONE || 'UTC');
  const pageSize = Math.max(0, parseInt(process.env.STRATEGIS_PAGE_SIZE || '500', 10) || 500);
  const maxPages = Math.max(1, parseInt(process.env.STRATEGIS_MAX_PAGES || '50', 10) || 50);
  const rps = Math.max(0, parseInt(process.env.STRATEGIS_RPS || '5', 10) || 5);
  const burst = Math.max(1, parseInt(process.env.STRATEGIS_BURST || '10', 10) || 10);
  const cbFails = Math.max(1, parseInt(process.env.STRATEGIS_CB_FAILS || '5', 10) || 5);
  const cbCooldownMs = Math.max(1000, parseInt(process.env.STRATEGIS_CB_COOLDOWN_MS || '60000', 10) || 60000);
  const rateLimitEnabled = String(process.env.STRATEGIS_RATE_LIMIT_ENABLED || 'true').toLowerCase() === 'true';
  const breakerEnabled = String(process.env.STRATEGIS_BREAKER_ENABLED || 'true').toLowerCase() === 'true';
  const metricsLog = String(process.env.STRATEGIS_METRICS_LOG || 'true').toLowerCase() === 'true';
  const metricsDir = process.env.STRATEGIS_METRICS_DIR;

  return { baseUrl, organization, adSource, bearerToken, startDate, endDate, levels, timeoutMs, maxRetries, retryBackoffMs, concurrency, networkId, timezone, pageSize, maxPages, rps, burst, cbFails, cbCooldownMs, rateLimitEnabled, breakerEnabled, metricsLog, metricsDir };
}

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  for (let t = s.getTime(); t <= e.getTime(); t += 86400000) {
    const d = new Date(t);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function fetchAdsetsDay(cfg: Config, date: string): Promise<any[]> {
  const url = `${cfg.baseUrl}/api/facebook/adsets/day`;
  const params = {
    dateStart: date,
    dateEnd: date,
    dimensions: '',
    adSource: cfg.adSource, // Keep existing adSource for adsets endpoint
    organization: cfg.organization,
  } as Record<string, any>;
  return await fetchAllPages(cfg, url, params);
}

async function fetchCampaignsDay(cfg: Config, date: string): Promise<any[]> {
  // Note: Devin mentioned Strategis UI uses adSource=s1, but for RSOC campaigns we use rsoc
  // The adSource parameter filters which campaigns are returned
  const url = `${cfg.baseUrl}/api/facebook/report`;
  const params = {
    dateStart: date,
    dateEnd: date,
    dimensions: 'campaign',
    adSource: cfg.adSource, // Use configured adSource (rsoc for RSOC campaigns, s1 for S1 campaigns)
    organization: cfg.organization,
    cached: '1',
  } as Record<string, any>;
  return await fetchAllPages(cfg, url, params);
}

async function fetchS1Daily(cfg: Config, date: string, level: Level = 'adset'): Promise<any[]> {
  // Per Devin: Strategis UI uses different endpoints based on adSource:
  // - adSource=s1: /api/s1/report with networkName=facebook
  // - adSource=rsoc: /api/s1/report/daily-v3 with networkId=112
  // Since we're using adSource=rsoc for Facebook campaigns, try both endpoints
  
  // Try standard endpoint first (what UI uses for adSource=s1)
  const url1 = `${cfg.baseUrl}/api/s1/report`;
  const params1 = {
    dateStart: date,
    dateEnd: date,
    organization: cfg.organization,
    networkName: 'facebook', // Use networkName for /api/s1/report
    timezone: 'UTC',
    ignoreHours: '',
  } as Record<string, any>;
  
  // Only add dimensions for adset-level (campaign-level omits dimensions)
  if (level === 'adset') {
    params1.dimensions = 'date-campaignId-networkAdGroupId';
  }
  
  try {
    const rows1 = await fetchAllPages(cfg, url1, params1);
    if (rows1.length > 0) {
      return rows1;
    }
  } catch (err) {
    // Fall through to try daily-v3 endpoint
  }
  
  // Fallback: Try daily-v3 endpoint (for adSource=rsoc)
  const url2 = `${cfg.baseUrl}/api/s1/report/daily-v3`;
  const params2 = {
    dateStart: date,
    dateEnd: date,
    organization: cfg.organization,
    networkId: '112', // Use networkId for /api/s1/report/daily-v3
    timezone: 'UTC',
    ignoreHours: '',
    dimensions: level === 'campaign' ? 'date-campaignId' : 'date-campaignId-networkAdGroupId',
  } as Record<string, any>;
  
  return await fetchAllPages(cfg, url2, params2);
}

function toNumber(x: any): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeId(x: any): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s.length ? s : null;
}

function coerceAdsetRow(r: any): Record<string, any> {
  return {
    date: (r.date ? String(r.date).slice(0, 10) : null),
    level: 'adset',
    account_id: normalizeId(r.adAccountId),
    campaign_id: normalizeId(r.networkCampaignId || r.campaignId),
    adset_id: normalizeId(r.adSetId),
    campaign_name: r.campaign_name || r.networkCampaignName || null,
    adset_name: r.adSetName || null,
    owner: r.buyer || null,
    lane: null,
    category: r.category || null,
    objective: null,
    optimization_goal: null,
    currency: 'USD',
    spend_usd: toNumber(r.spend),
    revenue_usd: null,
    net_margin_usd: null,
    margin_rate: null,
    roas: null,
    impressions: toNumber(r.impressions),
    clicks: toNumber(r.clicks),
    sessions: null,
    conversions: toNumber(r.conversions),
    leads: toNumber(r.leads),
    ctr: toNumber(r.ctr),
    cpm: toNumber(r.cpm),
    cpc: toNumber(r.cpc),
    is_reconciled: false,
    reconciled_through_date: null,
    data_freshness_ts: new Date().toISOString(),
    supports_bid_cap: true,
    supports_budget_change: true,
    delivery_status: r.status || null,
    learning_phase: null,
    attribution_window_days: 7,
    source: 'strategis_day',
    ingestion_run_id: 'day_' + Date.now(),
    budget: toNumber(r.budget),
    bid_strategy: r.bidStrategy || null,
    domain: r.domain || null,
    rsoc_site: r.rsocSite || null,
    strategis_campaign_id: r.strategisCampaignId || null,
    network_campaign_name: r.networkCampaignName || null,
    _raw_json: JSON.stringify(r),
  };
}

function coerceCampaignRow(r: any): Record<string, any> {
  return {
    date: (r.date ? String(r.date).slice(0, 10) : null),
    level: 'campaign',
    account_id: normalizeId(r.adAccountId),
    campaign_id: normalizeId(r.networkCampaignId || r.campaignId),
    adset_id: null,
    campaign_name: r.campaign_name || r.networkCampaignName || null,
    adset_name: null,
    owner: r.buyer || null,
    lane: null,
    category: r.category || null,
    objective: null,
    optimization_goal: null,
    currency: 'USD',
    spend_usd: toNumber(r.spend),
    revenue_usd: null,
    net_margin_usd: null,
    margin_rate: null,
    roas: null,
    impressions: toNumber(r.impressions),
    clicks: toNumber(r.clicks),
    sessions: null,
    conversions: toNumber(r.conversions),
    leads: toNumber(r.leads),
    ctr: toNumber(r.ctr),
    cpm: toNumber(r.cpm),
    cpc: toNumber(r.cpc),
    is_reconciled: false,
    reconciled_through_date: null,
    data_freshness_ts: new Date().toISOString(),
    supports_bid_cap: true,
    supports_budget_change: true,
    delivery_status: r.status || null,
    learning_phase: null,
    attribution_window_days: 7,
    source: 'strategis_day',
    ingestion_run_id: 'day_' + Date.now(),
    budget: toNumber(r.budget),
    bid_strategy: r.bidStrategy || null,
    domain: r.domain || null,
    rsoc_site: r.rsocSite || null,
    strategis_campaign_id: r.strategisCampaignId || null,
    network_campaign_name: r.networkCampaignName || null,
    _raw_json: JSON.stringify(r),
  };
}

async function writeParquetIfPossible(csvPath: string, parquetPath: string): Promise<boolean> {
  try {
    const duckdb = await import('duckdb');
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    await new Promise<void>((resolve, reject) =>
      conn.run(`CREATE TABLE t AS SELECT * FROM read_csv_auto(? , IGNORE_ERRORS=true);`, [csvPath], (err: any) => (err ? reject(err) : resolve())),
    );
    await new Promise<void>((resolve, reject) =>
      conn.run(`COPY t TO ? (FORMAT PARQUET, COMPRESSION ZSTD);`, [parquetPath], (err: any) => (err ? reject(err) : resolve())),
    );
    conn.close();
    return true;
  } catch (e) {
    return false;
  }
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

// Simple global token bucket limiter
const rateLimiter = (() => {
  let tokens = 0;
  let lastRefill = Date.now();
  return {
    async take(cfg: Config) {
      if (!cfg.rateLimitEnabled || cfg.rps <= 0) return; // disabled
      const capacity = Math.max(cfg.burst, cfg.rps);
      while (true) {
        const now = Date.now();
        const elapsedSec = (now - lastRefill) / 1000;
        if (elapsedSec > 0) {
          tokens = Math.min(capacity, tokens + elapsedSec * cfg.rps);
          lastRefill = now;
        }
        if (tokens >= 1) { tokens -= 1; return; }
        const waitMs = Math.max(10, Math.ceil((1 - tokens) / cfg.rps * 1000));
        await sleep(waitMs);
      }
    }
  };
})();

// Minimal circuit breaker per endpoint path
type BreakerState = { failures: number; openedAt: number | null };
const breaker = new Map<string, BreakerState>();

function getBreakerKey(url: string): string {
  try { return new URL(url).pathname || url; } catch { return url; }
}

function isBreakerOpen(cfg: Config, key: string): boolean {
  if (!cfg.breakerEnabled) return false;
  const st = breaker.get(key);
  if (!st || st.openedAt === null) return false;
  const since = Date.now() - st.openedAt;
  if (since >= cfg.cbCooldownMs) {
    // Half-open: allow next attempt by resetting
    breaker.set(key, { failures: 0, openedAt: null });
    return false;
  }
  return true;
}

function recordFailure(cfg: Config, key: string) {
  const st = breaker.get(key) || { failures: 0, openedAt: null };
  st.failures += 1;
  if (cfg.breakerEnabled && st.failures >= cfg.cbFails && st.openedAt === null) {
    st.openedAt = Date.now();
    // eslint-disable-next-line no-console
    console.warn(`[breaker] OPEN path=${key} failures=${st.failures} cooldownMs=${cfg.cbCooldownMs}`);
    metrics.breaker_open_events += 1;
  }
  breaker.set(key, st);
}

function recordSuccess(key: string) {
  const st = breaker.get(key);
  if (st) breaker.set(key, { failures: 0, openedAt: null });
}

async function requestWithRetry(cfg: Config, url: string, params: Record<string, any>): Promise<any> {
  const headers = { Authorization: `Bearer ${cfg.bearerToken}` } as Record<string, string>;
  let attempt = 0;
  let lastErr: any = null;
  const key = getBreakerKey(url);
  while (attempt <= cfg.maxRetries) {
    try {
      await rateLimiter.take(cfg);
      if (isBreakerOpen(cfg, key)) {
        const e = new Error('circuit_open');
        (e as any).code = 'circuit_open';
        metrics.circuit_open_skips += 1;
        throw e;
      }
      const resp = await axios.get(url, { headers, params, timeout: cfg.timeoutMs });
      const payload = resp.data;
      recordSuccess(key);
      metrics.total_requests += 1;
      return payload;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status as number | undefined;
      const retryable = status === 429 || (status !== undefined && status >= 500) || !status;
      if (status === 429 || (status !== undefined && status >= 500) || (err && err.code === 'circuit_open')) {
        recordFailure(cfg, key);
      }
      if (status === 429) metrics.http_429 += 1;
      else if (typeof status === 'number' && status >= 500) metrics.http_5xx += 1;
      else metrics.other_errors += 1;
      if (!retryable || attempt === cfg.maxRetries) break;
      const backoff = cfg.retryBackoffMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await sleep(backoff);
      metrics.retries += 1;
      attempt++;
    }
  }
  throw lastErr || new Error('Request failed');
}

// Metrics collector
const metrics = {
  started_at: new Date().toISOString(),
  finished_at: null as string | null,
  total_requests: 0,
  http_429: 0,
  http_5xx: 0,
  other_errors: 0,
  retries: 0,
  breaker_open_events: 0,
  circuit_open_skips: 0,
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchAllPages(cfg: Config, url: string, baseParams: Record<string, any>): Promise<any[]> {
  // Generic page loop using ?page and ?limit; stops on empty page or short page
  // If pageSize is 0, fetch once without pagination
  const out: any[] = [];
  if (!cfg.pageSize) {
    const single = await requestWithRetry(cfg, url, baseParams);
    const arr = Array.isArray(single) ? single : (single?.data || []);
    return Array.isArray(arr) ? arr : [];
  }
  for (let page = 1; page <= cfg.maxPages; page++) {
    const params = { ...baseParams, page, limit: cfg.pageSize } as Record<string, any>;
    const resp = await requestWithRetry(cfg, url, params);
    const arr = Array.isArray(resp) ? resp : (resp?.data || []);
    if (!Array.isArray(arr) || arr.length === 0) break;
    out.push(...arr);
    if (arr.length < cfg.pageSize) break;
  }
  return out;
}

function aggregateRows(rows: Record<string, any>[], level: Level): Record<string, any>[] {
  // Group by date + id (adset or campaign), sum additive metrics, recompute derived
  const keyFor = (r: any) => level === 'adset'
    ? `${r.date}|${r.campaign_id || ''}|${r.adset_id || ''}`
    : `${r.date}|${r.campaign_id || ''}`;

  const numericFields = [
    'spend_usd','revenue_usd','net_margin_usd','impressions','clicks','sessions','conversions','leads'
  ];

  const map = new Map<string, any>();
  for (const r of rows) {
    const k = keyFor(r);
    if (!map.has(k)) {
      map.set(k, { ...r });
    } else {
      const acc = map.get(k);
      for (const f of numericFields) {
        const a = toNumber(acc[f]);
        const b = toNumber(r[f]);
        acc[f] = (a || 0) + (b || 0);
      }
      // Keep first non-null for string-ish fields (names, status, bid_strategy, etc.)
      for (const f of ['campaign_name','adset_name','owner','lane','category','objective','optimization_goal','currency','delivery_status','learning_phase','source','strategis_campaign_id','network_campaign_name','domain','rsoc_site','bid_strategy']) {
        if (acc[f] === null || acc[f] === undefined) acc[f] = r[f];
      }
      // Drop raw payload on aggregation to avoid huge strings
      delete acc._raw_json;
    }
  }

  // Recompute derived metrics
  const out: any[] = [];
  for (const v of map.values()) {
    const impressions = toNumber(v.impressions) || 0;
    const clicks = toNumber(v.clicks) || 0;
    const spend = toNumber(v.spend_usd) || 0;
    const revenue = toNumber(v.revenue_usd);
    v.ctr = impressions > 0 ? clicks / impressions : null;
    v.cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
    v.cpc = clicks > 0 ? (spend / clicks) : null;
    if (revenue !== null && spend > 0) v.roas = revenue / spend;
    out.push(v);
  }
  return out;
}

async function main() {
  const cfg = readConfig();
  const snapshotTs = nowUtcStamp();
  const baseOut = defaultDaySnapshotsBase();
  const snapshotDir = path.join(baseOut, snapshotTs);
  ensureDir(snapshotDir);

  const dates = eachDateInclusive(cfg.startDate, cfg.endDate);
  const manifestRows: { snapshot_ts: string; source: string; schema_version: number; level: Level; date: string; num_rows: number; file_path: string; }[] = [];

  for (const level of cfg.levels) {
    await mapWithConcurrency(dates, cfg.concurrency, async (date) => {
      const partDir = path.join(snapshotDir, `level=${level}`, `date=${date}`);
      ensureDir(partDir);

      // Fetch primary FB rows and S1 revenue once per date
      // Strategy: Mirror Strategis UI approach - fetch Facebook metrics and System 1 revenue separately,
      // then combine them by matching on date + campaignId (or date + campaignId + networkAdGroupId for adset level)
      const [rawRows, s1Rows] = await Promise.all([
        (level === 'adset' ? fetchAdsetsDay(cfg, date) : fetchCampaignsDay(cfg, date)),
        fetchS1Daily(cfg, date, level), // Pass level to use correct dimensions
      ]);

      // Log System 1 data availability
      if (s1Rows.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(`[${date}] No System 1 revenue data available for level=${level}`);
        // eslint-disable-next-line no-console
        console.warn(`[${date}] S1 API params: networkId=112, timezone=UTC, dimensions=${level === 'campaign' ? 'date-campaignId' : 'date-campaignId-networkAdGroupId'}`);
        // eslint-disable-next-line no-console
        console.warn(`[${date}] If data exists in Strategis UI, check: 1) API endpoint URL, 2) Missing parameters, 3) Different base URL`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[${date}] Found ${s1Rows.length} System 1 revenue rows for level=${level}`);
        // Log sample row structure for debugging
        if (s1Rows.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`[${date}] Sample S1 row keys: ${Object.keys(s1Rows[0]).join(', ')}`);
        }
      }

      // Build revenue lookup maps
      // System 1 may return campaignId (strategis ID) or networkCampaignId (Facebook ID)
      // We need to match on both to handle all cases
      const adsetRevenueByKey = new Map<string, number>(); // key: date|adsetId
      const campaignRevenueByKey = new Map<string, number>(); // key: date|campaignId (strategis ID)
      const campaignRevenueByNetworkId = new Map<string, number>(); // key: date|networkCampaignId (Facebook ID)
      
      for (const r of s1Rows) {
        const d = String(r.date || r.Date || date);
        const adsetId = String(r.networkAdGroupId || r.adSetId || '').trim();
        const campId = String(r.campaignId || '').trim(); // Strategis campaign ID
        const networkCampId = String(r.networkCampaignId || '').trim(); // Facebook campaign ID
        // System 1 returns revenue in various field names: revenue, estimated_revenue, estimatedRevenue
        const est = toNumber(r.estimated_revenue ?? r.revenue ?? r.estimatedRevenue);
        const revenue = est ?? 0;
        if (adsetId) {
          const k = `${d}|${adsetId}`;
          adsetRevenueByKey.set(k, (adsetRevenueByKey.get(k) || 0) + revenue);
        }
        if (campId) {
          const k = `${d}|${campId}`;
          campaignRevenueByKey.set(k, (campaignRevenueByKey.get(k) || 0) + revenue);
        }
        if (networkCampId) {
          const k = `${d}|${networkCampId}`;
          campaignRevenueByNetworkId.set(k, (campaignRevenueByNetworkId.get(k) || 0) + revenue);
        }
      }

      // Coerce and attach revenue + roas
      // Note: Match on both campaignId (strategis ID like "sipx1dt06t9") and networkCampaignId (Facebook ID like "120226963475580382")
      // System 1 may return either, so we build lookup maps for both
      const prelim = (level === 'adset' ? rawRows.map(coerceAdsetRow) : rawRows.map(coerceCampaignRow)).map((row) => {
        if (level === 'adset') {
          const key = `${row.date}|${row.adset_id}`;
          const rev = adsetRevenueByKey.get(key);
          if (rev !== undefined && rev !== null) row.revenue_usd = rev;
        } else {
          // Try matching on campaign_id (strategis ID) first
          const key1 = `${row.date}|${row.campaign_id}`;
          let rev = campaignRevenueByKey.get(key1);
          
          // If no match, try matching on networkCampaignId (Facebook ID)
          if ((rev === undefined || rev === null) && row.account_id) {
            // Get networkCampaignId from the raw Facebook data
            const rawRow = rawRows.find((r: any) => 
              (r.campaignId === row.campaign_id || r.networkCampaignId === row.campaign_id)
            );
            if (rawRow && rawRow.networkCampaignId) {
              const key2 = `${row.date}|${rawRow.networkCampaignId}`;
              rev = campaignRevenueByNetworkId.get(key2);
            }
          }
          
          if (rev !== undefined && rev !== null) row.revenue_usd = rev;
        }
        const spend = toNumber(row.spend_usd);
        const revenue = toNumber(row.revenue_usd);
        row.roas = (spend && spend > 0 && revenue !== null) ? (revenue! / spend) : (row.roas ?? null);
        return row;
      });

      const rows = aggregateRows(prelim, level);

      // Write CSV
      const csvPath = path.join(partDir, 'part-000.csv');
      const header = rows.length ? Object.keys(rows[0]) : [];
      writeCsv(csvPath, header, rows);

      // Optionally write Parquet
      const parquetPath = path.join(partDir, 'part-000.parquet');
      const wroteParquet = await writeParquetIfPossible(csvPath, parquetPath);

      const numRows = rows.length;
      manifestRows.push({
        snapshot_ts: snapshotTs,
        source: 'strategis_day',
        schema_version: 1,
        level,
        date,
        num_rows: numRows,
        file_path: csvPath,
      });
      if (wroteParquet) {
        manifestRows.push({
          snapshot_ts: snapshotTs,
          source: 'strategis_day',
          schema_version: 1,
          level,
          date,
          num_rows: numRows,
          file_path: parquetPath,
        });
      }
      // eslint-disable-next-line no-console
      console.log(`Saved ${level} day rows for ${date}: ${numRows}`);
    });
  }

  writeCsv(
    path.join(snapshotDir, 'manifest.csv'),
    ['snapshot_ts', 'source', 'schema_version', 'level', 'date', 'num_rows', 'file_path'],
    manifestRows as any,
  );

  // eslint-disable-next-line no-console
  metrics.finished_at = new Date().toISOString();
  const per1k = (n: number) => (metrics.total_requests > 0 ? (n / metrics.total_requests) * 1000 : 0);
  const summary = {
    snapshot_dir: snapshotDir,
    levels: cfg.levels,
    start: cfg.startDate,
    end: cfg.endDate,
    metrics: {
      ...metrics,
      per_1k: {
        http_429: per1k(metrics.http_429),
        http_5xx: per1k(metrics.http_5xx),
        other_errors: per1k(metrics.other_errors),
      },
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  try {
    if (cfg.metricsLog) {
      const outDir = cfg.metricsDir || path.join(process.cwd(), 'runs', 'ingest_metrics');
      ensureDir(outDir);
      const outPath = path.join(outDir, `metrics_${nowUtcStamp()}.json`);
      fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
    }
  } catch {}
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


