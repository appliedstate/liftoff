import express from 'express';
import fs from 'fs';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { generateText } from '../lib/openai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { latestSnapshotDir, defaultSnapshotsBase, defaultDaySnapshotsBase, listSnapshotDirs, readManifest } from '../lib/snapshots';
import { recordQueryMetrics, setLastValidateSummary, getEpsilonOverride, getOverlayDisabledOverride, recordAdminAction, setEpsilonOverride, setOverlayDisabledOverride } from '../lib/health';
import axios from 'axios';

const router = express.Router();
const execFileAsync = promisify(execFile);

function normalizeJsonBigInt(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((v) => normalizeJsonBigInt(v));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeJsonBigInt(v);
    return out;
  }
  return value;
}

function coerceNumericFields(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const numericKeys = [
    'spend_usd','revenue_usd','net_margin_usd','margin_rate','roas',
    'impressions','clicks','sessions','conversions','leads',
    'ctr','cpm','cpc','budget','attribution_window_days','revenue_per_click','cost_per_action'
  ];
  const out: any = { ...row };
  for (const k of numericKeys) {
    if (out[k] === undefined || out[k] === null || out[k] === '') continue;
    const n = Number(out[k]);
    out[k] = Number.isFinite(n) ? n : null;
  }
  return out;
}

// Simple in-memory store of ingested reconciled rows keyed by a storage key
// Storage key is typically the authenticated user id or a provided key
const ingests = new Map<string, any[]>();
// Lazy DuckDB query helper (mirrors terminal route style)
async function queryDuckDb(sql: string, params: any[] = []): Promise<any[]> {
  const duckdb = await import('duckdb');
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  try {
    const rows: any[] = await new Promise((resolve, reject) => {
      conn.all(sql, params, (err: any, res: any[]) => (err ? reject(err) : resolve(res)));
    });
    return rows;
  } finally {
    conn.close();
  }
}

function sloConfig() {
  return {
    maxNullRate: Math.min(1, Math.max(0, Number(process.env.SLO_MAX_NULL_RATE ?? '0.02'))),
    minRows: Math.max(0, parseInt(process.env.SLO_MIN_ROWS ?? '10', 10) || 10),
    requireReconciledOk: (String(process.env.SLO_REQUIRE_RECONCILED_OK || 'true').toLowerCase() === 'true'),
    maxReconciledMissPct: Math.min(1, Math.max(0, Number(process.env.SLO_MAX_RECONCILED_MISS_PCT ?? '0.05'))),
    blockDecisions: (String(process.env.SLO_BLOCK_DECISIONS || 'true').toLowerCase() === 'true'),
    epsilon: Number(process.env.SLO_EPSILON ?? '0.01'),
  };
}

function overlayKillSwitchEnabled(): boolean {
  const v = String(process.env.STRATEGIST_OVERLAY_DISABLED || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function forceDayEnabled(): boolean {
  const v = String(process.env.STRATEGIST_FORCE_DAY || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

async function evaluateSLO(params: { level: 'adset'|'campaign'; date: string; epsilon?: number; }): Promise<{ ok: boolean; freshness_ok: boolean; completeness_ok: boolean; accuracy_ok: boolean; details: any; }>{
  const { level } = params;
  const date = String(params.date);
  const cfg = sloConfig();
  const epsilon = (typeof params.epsilon === 'number') ? params.epsilon! : cfg.epsilon;

  const daySnap = latestSnapshotDir(defaultDaySnapshotsBase());
  const recSnap = latestSnapshotDir(defaultSnapshotsBase());
  const result: any = { level, date, epsilon, thresholds: cfg, checks: {} };

  if (!daySnap) {
    return { ok: false, freshness_ok: false, completeness_ok: false, accuracy_ok: !cfg.requireReconciledOk, details: { reason: 'no_day_snapshot' } };
  }

  const dayParquet = path.join(daySnap, `level=${level}`, `date=${date}`, `*.parquet`);
  const dayCsv = path.join(daySnap, `level=${level}`, `date=${date}`, `*.csv`);
  const totals = await queryDuckDb(
    `WITH unioned AS (
      SELECT * FROM read_parquet('${dayParquet}')
      UNION ALL
      SELECT * FROM read_csv_auto('${dayCsv}', IGNORE_ERRORS=true)
    )
    SELECT COUNT(*) AS rows,
           SUM(CAST(spend_usd AS DOUBLE)) AS spend,
           SUM(CAST(clicks AS BIGINT)) AS clicks,
           SUM(CAST(impressions AS BIGINT)) AS impressions
    FROM unioned WHERE date = ?`,
    [date],
  ).catch(() => [{ rows: 0, spend: 0, clicks: 0, impressions: 0 }]);
  const rowCount = Number(totals[0]?.rows || 0);

  // Freshness: require rows >= minRows and not before settle gate if today
  const todayYmd = new Date().toISOString().slice(0, 10);
  let freshnessOk = rowCount >= cfg.minRows;
  if (date === todayYmd) {
    const settleHour = Number(process.env.DAY_SETTLE_HOUR_LOCAL ?? '5');
    const now = new Date();
    const gate = new Date(now); gate.setHours(settleHour, 0, 0, 0);
    if (now < gate) freshnessOk = false;
  }
  result.checks.freshness = { rowCount, minRows: cfg.minRows, today: date === todayYmd, freshnessOk };

  // Completeness: null-rate across key fields
  const keys = level === 'adset'
    ? ['campaign_id','adset_id','spend_usd','clicks','impressions']
    : ['campaign_id','spend_usd','clicks','impressions'];
  const nullSql = `WITH unioned AS (
    SELECT * FROM read_parquet('${dayParquet}')
    UNION ALL
    SELECT * FROM read_csv_auto('${dayCsv}', IGNORE_ERRORS=true)
  )
  SELECT ${keys.map((k) => `SUM(CASE WHEN ${k} IS NULL THEN 1 ELSE 0 END) AS ${k}_nulls`).join(', ')}, COUNT(*) AS rows
  FROM unioned WHERE date = ?`;
  const nulls = await queryDuckDb(nullSql, [date]).catch(() => [{ rows: 0 }]);
  const nullRates: Record<string, number> = {};
  const nrRows = Number(nulls[0]?.rows || 0) || 1;
  for (const k of keys) {
    const count = Number(nulls[0][`${k}_nulls`] || 0);
    nullRates[k] = count / nrRows;
  }
  const completenessOk = Object.values(nullRates).every((p) => p <= cfg.maxNullRate);
  result.checks.completeness = { nullRates, maxNullRate: cfg.maxNullRate, completenessOk };

  // Accuracy: reconciliation consistency (only when we have reconciled and level adset/campaign appropriately)
  let accuracyOk = true;
  let accuracyDetails: any = { used: false };
  if (recSnap && cfg.requireReconciledOk) {
    const recCampGlob = path.join(recSnap, `level=campaign`, `date=${date}`, `*.*`);
    // recByCampaign
    const recByCampaign = await queryDuckDb(
      `WITH unioned AS (
        SELECT * FROM read_parquet(?)
        UNION ALL
        SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
      )
      SELECT campaign_id AS campaign_id,
             SUM(CAST(revenue_usd AS DOUBLE)) AS campaign_revenue
      FROM unioned WHERE date = ? GROUP BY campaign_id`,
      [recCampGlob, recCampGlob, date],
    ).catch(() => []);
    const recMap = new Map<string, number>();
    for (const r of recByCampaign) recMap.set(String(r.campaign_id), Number(r.campaign_revenue || 0));

    // adset sums by campaign
    const adsetGlob = path.join(daySnap, `level=adset`, `date=${date}`, `*.*`);
    const adsetByCampaign = await queryDuckDb(
      `WITH unioned AS (
        SELECT * FROM read_parquet(?)
        UNION ALL
        SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
      )
      SELECT campaign_id AS campaign_id,
             SUM(CAST(revenue_usd AS DOUBLE)) AS adset_revenue
      FROM unioned WHERE date = ? GROUP BY campaign_id`,
      [adsetGlob, adsetGlob, date],
    ).catch(() => []);

    let failures = 0;
    let total = 0;
    const discrepancies: any[] = [];
    for (const r of adsetByCampaign) {
      const campId = String(r.campaign_id);
      const adsetSum = Number(r.adset_revenue || 0);
      const recSum = recMap.get(campId);
      if (typeof recSum === 'number') {
        total++;
        const diff = Math.abs(adsetSum - recSum);
        const rel = recSum > 0 ? (diff / recSum) : diff; // relative when possible
        if (diff > epsilon && rel > cfg.maxReconciledMissPct) {
          failures++;
          discrepancies.push({ campaign_id: campId, adset_sum: adsetSum, campaign_reconciled: recSum, diff, rel });
        }
      }
    }
    const missPct = total > 0 ? failures / total : 0;
    accuracyOk = missPct <= cfg.maxReconciledMissPct;
    accuracyDetails = { used: true, failures, total, missPct, maxMissPct: cfg.maxReconciledMissPct, epsilon, discrepancies: discrepancies.slice(0, 25) };
  }
  result.checks.accuracy = { accuracyOk, ...accuracyDetails };

  const ok = !!freshnessOk && !!completenessOk && (!!accuracyOk || !cfg.requireReconciledOk);
  return { ok, freshness_ok: !!freshnessOk, completeness_ok: !!completenessOk, accuracy_ok: !!accuracyOk, details: result };
}


type ReconciledQuery = {
  date?: string;
  level?: 'adset' | 'campaign';
  account_ids?: string | string[];
  owner?: string;
  lane?: 'ASC' | 'LAL_1' | 'LAL_2_5' | 'Contextual' | 'Sandbox' | 'Warm';
  category?: string;
  timezone?: string;
  limit?: string;
  cursor?: string;
  format?: 'json' | 'csv';
};

function toArray(input?: string | string[]): string[] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) return input;
  if (input.includes(',')) return input.split(',').map((s) => s.trim()).filter(Boolean);
  return [input];
}

function buildSampleRow(level: 'adset' | 'campaign' = 'adset') {
  return {
    date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10),
    level,
    account_id: 'act_123456789',
    campaign_id: '120000000000001',
    adset_id: level === 'adset' ? '238600000000001' : null,
    campaign_name: 'Sample_Campaign',
    adset_name: level === 'adset' ? 'ASC_Sample_Adset' : null,
    owner: 'ben',
    lane: 'ASC',
    category: 'SampleCategory',
    objective: 'SALES',
    optimization_goal: 'PURCHASE',
    currency: 'USD',
    spend_usd: 123.45,
    revenue_usd: 234.56,
    net_margin_usd: 111.11,
    margin_rate: 0.474,
    roas: 1.90,
    impressions: 120000,
    clicks: 1500,
    sessions: 700,
    conversions: 32,
    is_reconciled: true,
    reconciled_through_date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10),
    data_freshness_ts: new Date().toISOString(),
    supports_bid_cap: true,
    supports_budget_change: true,
    delivery_status: 'ACTIVE',
    learning_phase: 'STABLE',
    attribution_window_days: 7,
    source: 'strategis_reconciled',
    ingestion_run_id: 'run_demo_' + Date.now(),
  };
}

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const header = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((k) => escape(row[k])).join(','));
  }
  return lines.join('\n');
}

function parseCsv(input: string): { header: string[]; rows: string[][] } {
  const lines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === ',') {
          result.push(field);
          field = '';
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          field += ch;
        }
      }
    }
    result.push(field);
    return result;
  };
  const header = parseLine(lines[0]).map((h) => h.trim());
  const rows: string[][] = [];
  for (let li = 1; li < lines.length; li++) {
    const vals = parseLine(lines[li]);
    if (vals.every((v) => v === '')) continue;
    rows.push(vals);
  }
  return { header, rows };
}

function coerceValue(key: string, value: string): any {
  const lower = key.toLowerCase();
  if (value === '') return null;
  if (/^(spend_usd|revenue_usd|net_margin_usd|margin_rate|roas)$/i.test(lower)) {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }
  if (/^(impressions|clicks|sessions|conversions|attribution_window_days)$/i.test(lower)) {
    const n = parseInt(value, 10);
    return isNaN(n) ? value : n;
  }
  if (/^(is_reconciled|supports_bid_cap|supports_budget_change)$/i.test(lower)) {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return value;
  }
  return value;
}

function rowsFromCsv(csv: string): any[] {
  const { header, rows } = parseCsv(csv);
  if (!header.length) return [];
  return rows.map((vals) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      const val = vals[i] ?? '';
      obj[key] = coerceValue(key, val);
    }
    return obj;
  });
}

// Try to normalize Strategis CSV columns to our reconciled schema
function normalizeStrategisRows(inputRows: any[]): any[] {
  const out: any[] = [];
  for (const r of inputRows) {
    const date = r['Date'] || r['date'];
    if (!date) continue;
    const owner = r['Campaign Owner'] || r['Owner'] || r['owner'] || null;
    const campaignName = r['Facebook Campaign Name'] || r['Campaign Name'] || null;
    const strategisId = r['Strategis Id'] || r['strategis_id'] || null;
    const viewableImpressions = Number(r['Viewable Impressions'] ?? 0) || 0;
    const strategisImpressions = Number(r['Strategis Impressions'] ?? 0) || 0;
    // Prefer Strategis Impressions if present; otherwise fall back to Viewable
    const impressions = strategisImpressions || viewableImpressions || 0;
    const clicks = Number(r['Facebook Clicks'] ?? 0) || 0;
    const s1Clicks = Number(r['S1 Clicks'] ?? 0) || 0;
    const sessions = s1Clicks || 0;
    const conversions = Number(r['Conversions'] ?? 0) || 0;
    const revenue = Number(r['Revenue'] ?? 0) || 0;
    const spend = Number(r['Spent'] ?? 0) || 0;
    const margin = Number(r['Margin'] ?? 0) || 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const marginRate = revenue > 0 ? margin / revenue : 0;

    out.push({
      date: String(date),
      level: 'campaign',
      account_id: null,
      campaign_id: null,
      adset_id: null,
      campaign_name: campaignName,
      adset_name: null,
      owner: owner ? String(owner).toLowerCase() : null,
      lane: null,
      category: null,
      objective: null,
      optimization_goal: null,
      currency: 'USD',
      spend_usd: spend,
      revenue_usd: revenue,
      net_margin_usd: margin,
      margin_rate: marginRate,
      roas,
      impressions,
      clicks,
      sessions,
      conversions,
      is_reconciled: true,
      reconciled_through_date: String(date),
      data_freshness_ts: new Date().toISOString(),
      supports_bid_cap: false,
      supports_budget_change: true,
      delivery_status: null,
      learning_phase: null,
      attribution_window_days: 7,
      source: 'strategis_reconciled',
      ingestion_run_id: 'run_demo_' + Date.now(),
      // Keep original columns for reference
      _raw: {
        strategis_id: strategisId,
        viewable_impressions: viewableImpressions,
        strategis_impressions: strategisImpressions,
        s1_searches: r['S1 Searches'] ?? null,
        s1_clicks: s1Clicks,
        conversion_rate: r['Conversion Rate'] ?? null,
        frequency: r['Frequency'] ?? null,
      },
    });
  }
  return out;
}

function getStorageKey(req: any, providedKey?: string | null): string {
  return providedKey || req.user?.id || 'default';
}

// POST /ingest — accepts CSV text or a CSV URL, stores rows under a storage key.
router.post('/ingest', optionalAuth, async (req: any, res) => {
  try {
    const token = (req.headers['x-strategist-token'] as string) || (req.query.token as string) || '';
    const hasToken = !!(process.env.STRATEGIST_INGEST_TOKEN && token && token === process.env.STRATEGIST_INGEST_TOKEN);
    const isAuthed = !!req.user;
    if (!hasToken && !isAuthed) {
      return res.status(401).json({ code: 'unauthorized', message: 'Missing or invalid auth/token' });
    }

    const { csv, csv_url, key } = req.body || {};
    if (!csv && !csv_url) {
      return res.status(400).json({ code: 'bad_request', message: 'Provide csv or csv_url' });
    }

    let csvText = csv as string | undefined;
    if (!csvText && csv_url) {
      const resp = await axios.get(String(csv_url), { responseType: 'text' });
      csvText = resp.data as string;
    }
    if (!csvText || typeof csvText !== 'string' || csvText.trim().length === 0) {
      return res.status(400).json({ code: 'bad_request', message: 'CSV content is empty' });
    }

    const storageKey = getStorageKey(req, key);
    const parsedRows = rowsFromCsv(csvText);
    const normalized = normalizeStrategisRows(parsedRows);
    ingests.set(storageKey, normalized.length ? normalized : parsedRows);

    return res.status(200).json({ stored: parsedRows.length, key: storageKey });
  } catch (err) {
    console.error('strategist.ingest error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Ingest failed' });
  }
});

// GET /reconciled — scaffolding adapter to Reconciled Reports API spec
router.get('/reconciled', authenticateUser, async (req: any, res) => {
  try {
    const q = req.query as unknown as ReconciledQuery & { key?: string };
    const level = (q.level === 'campaign' ? 'campaign' : 'adset') as 'adset' | 'campaign';
    const limit = Math.min(Math.max(parseInt(q.limit || '25', 10) || 25, 1), 5000);
    const accountIds = toArray(q.account_ids);

    // If ingested dataset exists for this key/user, serve it with filters
    const storageKey = getStorageKey(req as any, (q as any).key);
    const stored = ingests.get(storageKey);
    if (stored && Array.isArray(stored) && stored.length) {
      let rows = stored as any[];
      if (q.date) rows = rows.filter((r) => String(r.date) === q.date);
      if (q.level) rows = rows.filter((r) => String(r.level).toLowerCase() === level);
      if (accountIds && accountIds.length) rows = rows.filter((r) => accountIds.includes(String(r.account_id)));
      if (q.owner) rows = rows.filter((r) => String(r.owner).toLowerCase() === String(q.owner).toLowerCase());
      if (q.lane) rows = rows.filter((r) => String(r.lane) === q.lane);
      if (q.category) rows = rows.filter((r) => String(r.category).toLowerCase() === String(q.category).toLowerCase());

      rows = rows.slice(0, limit);

      const meta = {
        date: q.date || (rows[0]?.date ?? new Date().toISOString().slice(0, 10)),
        level,
        timezone: q.timezone || 'America/Chicago',
        currency: 'USD',
        generated_at: new Date().toISOString(),
        source: 'strategis_reconciled',
        next_cursor: null as string | null,
        account_ids: accountIds,
        owner: q.owner,
        lane: q.lane,
        category: q.category,
        key: storageKey,
      };

      const wantsCsv = (q.format === 'csv') || (req.headers['accept']?.includes('text/csv') ?? false);
      if (wantsCsv) {
        const csv = toCsv(rows as any[]);
        res.setHeader('Content-Type', 'text/csv');
        return res.status(200).send(csv);
      }
      return res.status(200).json({ meta, data: rows });
    }

    // For now, return demo rows shaped to the contract.
    const rows = Array.from({ length: Math.min(limit, 5) }, () => buildSampleRow(level));

    const meta = {
      date: q.date || rows[0]?.date,
      level,
      timezone: q.timezone || 'America/Chicago',
      currency: 'USD',
      generated_at: new Date().toISOString(),
      source: 'strategis_reconciled',
      next_cursor: null as string | null,
      account_ids: accountIds,
      owner: q.owner,
      lane: q.lane,
      category: q.category,
    };

    const wantsCsv = (q.format === 'csv') || (req.headers['accept']?.includes('text/csv') ?? false);
    if (wantsCsv) {
      const csv = toCsv(rows as any[]);
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(csv);
    }

    return res.status(200).json({ meta, data: rows });
  } catch (err) {
    console.error('strategist.reconciled error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to load reconciled data' });
  }
});

// POST /chat — minimal LLM scaffold
router.post('/chat', optionalAuth, async (req: any, res) => {
  try {
    const { prompt, system, maxTokens } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ code: 'bad_request', message: 'Missing prompt' });
    }

    // If unauthenticated, always provide a dev fallback so it works without Supabase
    if (!req.user) {
      return res.status(200).json({ output: `DEV (unauthenticated) fallback:\n\n${prompt}` });
    }

    const devMode = process.env.STRATEGIST_DEV_MODE === 'true' || !process.env.OPENAI_API_KEY;
    if (devMode) {
      // Dev fallback to allow unauthenticated/local usage without OpenAI configured
      return res.status(200).json({ output: `DEV mode (no OPENAI_API_KEY):\n\n${prompt}` });
    }

    const systemPrompt =
      system ||
      [
        'You are Facebook Strategist, a trading co-pilot for media buyers.',
        'You can analyze reconciled performance and recommend bid/budget changes.',
        'Use the following tools via the backend endpoints when needed:',
        '- GET /api/strategist/reconciled to fetch data (JSON or CSV).',
        '- POST /api/strategist/exec for allowlisted terminal actions (dry-run by default).',
        'Be precise, concise, and provide actionable steps. Ask for missing details.',
      ].join(' ');

    const text = await generateText({ system: systemPrompt, prompt, maxTokens });
    return res.status(200).json({ output: text });
  } catch (err) {
    console.error('strategist.chat error', err);
    if (process.env.STRATEGIST_DEV_MODE === 'true' || !process.env.OPENAI_API_KEY) {
      return res.status(200).json({ output: 'DEV fallback due to error. Echoing prompt:\n\n' + (req.body?.prompt || '') });
    }
    return res.status(500).json({ code: 'internal_error', message: 'Chat failed' });
  }
});

// GET /ask?prompt=... — plain text response for simple chat UIs (e.g., Atlas)
router.get('/ask', optionalAuth, async (req: any, res) => {
  try {
    const prompt = String(req.query.prompt || '').trim();
    if (!prompt) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(400).send('Missing prompt');
    }

    // Unauth fallback: echo-style dev response
    if (!req.user || process.env.STRATEGIST_DEV_MODE === 'true' || !process.env.OPENAI_API_KEY) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`DEV response\n\n${prompt}`);
    }

    const systemPrompt = [
      'You are Facebook Strategist, a trading co-pilot for media buyers.',
      'Be precise and actionable. Keep answers concise.',
    ].join(' ');

    const text = await generateText({ system: systemPrompt, prompt, maxTokens: 400 });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(text);
  } catch (err) {
    console.error('strategist.ask error', err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (process.env.STRATEGIST_DEV_MODE === 'true' || !process.env.OPENAI_API_KEY) {
      return res.status(200).send('DEV fallback due to error');
    }
    return res.status(500).send('Ask failed');
  }
});

// POST /exec — safe, allowlisted command runner (dry-run by default)
router.post('/exec', authenticateUser, async (req, res) => {
  try {
    const { command, args = [], dryRun } = req.body || {};
    const effectiveDryRun = (dryRun !== false) && (process.env.STRATEGIST_EXEC_DRY_RUN !== 'false');

    if (!command || typeof command !== 'string' || !Array.isArray(args)) {
      return res.status(400).json({ code: 'bad_request', message: 'Invalid payload' });
    }

    const allowlist = new Map<string, (args: string[]) => string[] | null>([
      [
        'echo',
        (a) => a.every((x) => typeof x === 'string') ? a : null,
      ],
      [
        'node',
        (a) => {
          // Only allow running specific scripts within backend
          if (!a.length) return null;
          const script = a[0];
          if (!/^dist\//.test(script)) return null;
          return a;
        },
      ],
      [
        'ts-node',
        (a) => {
          if (!a.length) return null;
          const script = a[0];
          if (!/^src\/scripts\//.test(script)) return null;
          return a;
        },
      ],
    ]);

    const normalizer = allowlist.get(command);
    if (!normalizer) {
      return res.status(403).json({ code: 'forbidden', message: 'Command not allowed' });
    }
    const normalizedArgs = normalizer(args);
    if (!normalizedArgs) {
      return res.status(403).json({ code: 'forbidden', message: 'Arguments not allowed' });
    }

    if (effectiveDryRun) {
      return res.status(200).json({ dryRun: true, command, args: normalizedArgs, note: 'Execution skipped (dry-run). Set STRATEGIST_EXEC_DRY_RUN=false to enable).' });
    }

    const { stdout, stderr } = await execFileAsync(command, normalizedArgs, { cwd: process.cwd(), timeout: 60_000 });
    return res.status(200).json({ dryRun: false, command, args: normalizedArgs, stdout, stderr });
  } catch (err: any) {
    console.error('strategist.exec error', err);
    return res.status(500).json({ code: 'internal_error', message: err?.message || 'Execution failed' });
  }
});

// GET /recommendations — read-only simulator over reconciled rows
router.get('/recommendations', optionalAuth, async (req: any, res) => {
  try {
    const q = req.query as any;
    const level = (q.level === 'campaign' ? 'campaign' : 'adset') as 'adset' | 'campaign';
    let source = String(q.source || 'day').toLowerCase(); // day | reconciled
    if (forceDayEnabled()) source = 'day';
    const limit = Math.min(Math.max(parseInt(q.limit || '100', 10) || 100, 1), 5000);
    const storageKey = (q.key as string) || req.user?.id || 'default';

    // SLO gate: block decisions when SLOs fail (configurable)
    if (source === 'day' && q.date) {
      const slo = await evaluateSLO({ level, date: String(q.date) });
      if (!slo.ok && sloConfig().blockDecisions) {
        return res.status(425).json({ code: 'slo_blocked', message: 'Decision blocked due to SLO failure', slo });
      }
    }

    // Source rows: prefer ingested; else read snapshot containing requested date; else demo
    let rows: any[] = ingests.get(storageKey) || [];
    if (!rows.length) {
      const base = source === 'reconciled' ? defaultSnapshotsBase() : defaultDaySnapshotsBase();
      const wantDate = q.date ? String(q.date) : null;
      let snap: string | null = null;
      if (wantDate) {
        const dirs = listSnapshotDirs(base);
        for (let i = dirs.length - 1; i >= 0; i--) {
          const man = readManifest(dirs[i]);
          if (man && man.dates.has(wantDate)) { snap = dirs[i]; break; }
        }
      }
      if (!snap) snap = latestSnapshotDir(base);
      if (snap) {
        const globParquet = path.join(snap, `level=${level}`, `date=${wantDate || '*'}`, `*.parquet`);
        const globCsv = path.join(snap, `level=${level}`, `date=${wantDate || '*'}`, `*.csv`);
        try {
          const sqlParquet = `SELECT * FROM read_parquet('${globParquet}') LIMIT ${limit}`;
          rows = await queryDuckDb(sqlParquet, []);
        } catch {
          try {
            const sqlUnion = `WITH unioned AS (SELECT * FROM read_parquet('${globParquet}') UNION ALL SELECT * FROM read_csv_auto('${globCsv}', IGNORE_ERRORS=true)) SELECT * FROM unioned LIMIT ${limit}`;
            rows = await queryDuckDb(sqlUnion, []);
          } catch {
            try {
              const sqlCsv = `SELECT * FROM read_csv_auto('${globCsv}', IGNORE_ERRORS=true) LIMIT ${limit}`;
              rows = await queryDuckDb(sqlCsv, []);
            } catch {
              try {
                if (wantDate) {
                  const partDir = path.join(snap, `level=${level}`, `date=${wantDate}`);
                  const csvFiles: string[] = fs.existsSync(partDir) ? fs.readdirSync(partDir).filter((f) => /\.csv$/i.test(f)) : [];
                  let merged: any[] = [];
                  for (const f of csvFiles) {
                    try {
                      const text = fs.readFileSync(path.join(partDir, f), 'utf8');
                      const parsed = rowsFromCsv(text);
                      merged = merged.concat(parsed);
                    } catch {}
                  }
                  rows = merged.slice(0, limit);
                }
              } catch {}
            }
          }
        }
      }
    }
    if (!rows.length) {
      const demoDate = q.date || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      rows = Array.from({ length: Math.min(limit, 25) }, () => ({
        date: demoDate,
        level,
        account_id: 'act_demo',
        campaign_id: '120000000000001',
        adset_id: level === 'adset' ? '238600000000001' : null,
        lane: 'ASC',
        spend_usd: Math.random() * 300 + 50,
        revenue_usd: Math.random() * 800 + 50,
        roas: Math.random() * 2.0 + 0.2,
        impressions: 50000 + Math.floor(Math.random() * 100000),
        clicks: 100 + Math.floor(Math.random() * 1500),
        supports_bid_cap: true,
        supports_budget_change: true,
      }));
    }

    // Filter by level/date if provided (normalize date values)
    if (q.date) rows = rows.filter((r) => String(r.date).slice(0, 10) === q.date);
    rows = rows.filter((r) => String(r.level).toLowerCase() === level);
    rows = rows.slice(0, limit);

    // Deterministic simple simulator
    const cfg = {
      roas_up: Number(process.env.RECS_ROAS_UP ?? '1.3'),
      roas_down: Number(process.env.RECS_ROAS_DOWN ?? '0.8'),
      step_up: Number(process.env.RECS_STEP_UP ?? '0.2'),
      step_down: Number(process.env.RECS_STEP_DOWN ?? '-0.2'),
      min_clicks: Number(process.env.RECS_MIN_CLICKS ?? '20'),
    };

    function simulate(r: any) {
      const clicks = Number(r.clicks || 0);
      const spend = Number(r.spend_usd || 0);
      const revenue = (r.revenue_usd === null || r.revenue_usd === undefined) ? null : Number(r.revenue_usd);
      const hasSignal = Number.isFinite(spend) && spend > 0 && revenue !== null && Number.isFinite(revenue);
      const roas = hasSignal ? (revenue as number) / spend : 0;
      let action = 'hold';
      let delta = 0;
      // No reliable signal: hold
      if (!hasSignal || clicks < cfg.min_clicks) {
        action = 'hold';
      } else if (roas >= cfg.roas_up) {
        action = 'bump_budget';
        delta = cfg.step_up;
      } else if (roas < cfg.roas_down) {
        action = 'trim_budget';
        delta = cfg.step_down;
      }
      if (!r.supports_budget_change && (action === 'bump_budget' || action === 'trim_budget')) {
        action = 'hold'; delta = 0;
      }
      const id = r.adset_id || r.campaign_id;
      return {
        decision_id: `${r.date}:${level}:${id}`,
        id,
        level,
        account_id: r.account_id || null,
        action,
        budget_multiplier: action === 'hold' ? 1 : 1 + delta,
        bid_cap_multiplier: action === 'trim_budget' && r.supports_bid_cap ? 0.9 : null,
        reason: `roas=${roas.toFixed(2)}`,
        date: r.date,
      };
    }

    const intents = rows.map(simulate);
    intents.sort((a, b) => {
      const score = (x: any) => (x.action === 'hold' ? 0 : Math.abs((x.budget_multiplier || 1) - 1));
      return score(b) - score(a);
    });

    return res.status(200).json({ meta: { level, date: q.date || rows[0]?.date || null, source }, data: intents });
  } catch (err) {
    console.error('strategist.recommendations error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Recommendations failed' });
  }
});

// GET /query — filterable read-only query over latest reconciled snapshot (DuckDB)
router.get('/query', optionalAuth, async (req: any, res) => {
  try {
    const level = (String(req.query.level) === 'campaign' ? 'campaign' : 'adset') as 'adset' | 'campaign';
    const date = String(req.query.date || '') || null;
    const startDate = req.query.start_date ? String(req.query.start_date) : null;
    const endDate = req.query.end_date ? String(req.query.end_date) : null;
    const source = String(req.query.source || 'day').toLowerCase(); // day | reconciled
    const owner = req.query.owner ? String(req.query.owner).toLowerCase() : null;
    const lane = req.query.lane ? String(req.query.lane) : null;
    const category = req.query.category ? String(req.query.category) : null;
    const deliveryStatus = req.query.status ? String(req.query.status).toLowerCase() : (req.query.delivery_status ? String(req.query.delivery_status).toLowerCase() : null);
    const bidStrategy = req.query.bid_strategy ? String(req.query.bid_strategy) : null;
    const domain = req.query.domain ? String(req.query.domain) : null;
    const rsocSite = req.query.rsoc_site ? String(req.query.rsoc_site) : null;
    const accountId = req.query.account_id ? String(req.query.account_id) : null;
    const roasGt = req.query.roas_gt ? Number(req.query.roas_gt) : null;
    const roasLt = req.query.roas_lt ? Number(req.query.roas_lt) : null;
    const campaignId = req.query.campaign_id ? String(req.query.campaign_id) : null;
    const adsetId = req.query.adset_id ? String(req.query.adset_id) : null;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 10000);
    const wantsCsv = (String(req.query.format || '').toLowerCase() === 'csv') || (req.headers['accept']?.includes('text/csv') ?? false);
    const debugMode = (String(req.query.debug || '').toLowerCase() === '1') || (process.env.DEBUG_STRATEGIST_QUERY === 'true');
    const noRaw = (String(req.query.no_raw || '').toLowerCase() === '1' || String(req.query.no_raw || '').toLowerCase() === 'true');
    const fieldsParam = req.query.fields ? String(req.query.fields) : null; // comma-separated
    let overlay = (String(req.query.overlay || '').toLowerCase() === '1') || (String(req.query.overlay || '').toLowerCase() === 'true');
    const overlayOverride = getOverlayDisabledOverride();
    if (overlayKillSwitchEnabled() || overlayOverride === true) overlay = false;
    // Gate adset overlay by explicit env flag
    const adsetOverlayEnabled = String(process.env.ADWORDS_COMPAT_UNUSED_FLAG || process.env.ADSET_OVERLAY_ENABLED || 'false').toLowerCase() === 'true';
    if (level === 'adset' && !adsetOverlayEnabled) overlay = false;
    const autoOverlayPast = String(process.env.STRATEGIST_AUTO_OVERLAY_PAST || 'false').toLowerCase() === 'true';
    if (!overlay && autoOverlayPast && source === 'day' && date) {
      const todayYmd = new Date().toISOString().slice(0, 10);
      if (date < todayYmd) overlay = true;
    }

    const base = source === 'reconciled' ? defaultSnapshotsBase() : defaultDaySnapshotsBase();
    // Prefer snapshot containing requested date when provided
    let snap: string | null = null;
    if (date) {
      const dirs = listSnapshotDirs(base);
      for (let i = dirs.length - 1; i >= 0; i--) {
        const man = readManifest(dirs[i]);
        if (man && man.dates.has(date)) { snap = dirs[i]; break; }
      }
    }
    if (!snap) snap = latestSnapshotDir(base);
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });

    const globParquet = path.join(snap, `level=${level}`, `date=${date || '*'}`, `*.parquet`);
    const globCsv = path.join(snap, `level=${level}`, `date=${date || '*'}`, `*.csv`);
    if (debugMode) {
      console.log('[strategist.query] base=', base);
      console.log('[strategist.query] snap=', snap);
      console.log('[strategist.query] globParquet=', globParquet);
      console.log('[strategist.query] globCsv=', globCsv);
    }

    // Settle-time gate for day source
    if (source === 'day') {
      const settleHour = Number(process.env.DAY_SETTLE_HOUR_LOCAL ?? '5');
      const now = new Date();
      const gate = new Date(now);
      gate.setHours(settleHour, 0, 0, 0);
      const manifestOk = true; // optional: add a manifest check for dates when available
      if (now < gate && date) {
        return res.status(425).json({ code: 'not_ready', message: `Day snapshot not settled before ${String(settleHour).padStart(2,'0')}:00 local` });
      }
    }

    const whereParts: string[] = [];
    const params: any[] = [];
    if (date) { whereParts.push(`date = ?`); params.push(date); }
    else if (startDate && endDate) { whereParts.push(`date BETWEEN ? AND ?`); params.push(startDate, endDate); }
    else if (startDate) { whereParts.push(`date >= ?`); params.push(startDate); }
    else if (endDate) { whereParts.push(`date <= ?`); params.push(endDate); }
    if (owner) { whereParts.push(`lower(owner) = ?`); params.push(owner); }
    if (lane) { whereParts.push(`lane = ?`); params.push(lane); }
    if (category) { whereParts.push(`lower(category) = ?`); params.push(category.toLowerCase()); }
    if (deliveryStatus) { whereParts.push(`lower(delivery_status) = ?`); params.push(deliveryStatus); }
    if (bidStrategy) { whereParts.push(`bid_strategy = ?`); params.push(bidStrategy); }
    if (domain) { whereParts.push(`domain = ?`); params.push(domain); }
    if (rsocSite) { whereParts.push(`rsoc_site = ?`); params.push(rsocSite); }
    if (accountId) { whereParts.push(`account_id = ?`); params.push(accountId); }
    if (roasGt !== null && !Number.isNaN(roasGt)) { whereParts.push(`CAST(roas AS DOUBLE) > ?`); params.push(roasGt); }
    if (roasLt !== null && !Number.isNaN(roasLt)) { whereParts.push(`CAST(roas AS DOUBLE) < ?`); params.push(roasLt); }
    if (campaignId) { whereParts.push(`campaign_id = ?`); params.push(campaignId); }
    if (adsetId) { whereParts.push(`adset_id = ?`); params.push(adsetId); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    if (debugMode) {
      console.log('[strategist.query] whereParts=', whereParts);
      console.log('[strategist.query] params=', params);
    }

    // Build SELECT clause respecting optional fields= and derived metrics
    function buildSelectClause(): string {
      if (!fieldsParam || !fieldsParam.trim()) {
        return `*,
          (CASE WHEN clicks > 0 THEN CAST(revenue_usd AS DOUBLE)/CAST(clicks AS DOUBLE) ELSE NULL END) AS revenue_per_click,
          (CASE WHEN conversions > 0 THEN CAST(spend_usd AS DOUBLE)/CAST(conversions AS DOUBLE) ELSE NULL END) AS cost_per_action`;
      }
      const requested = fieldsParam.split(',').map((s) => s.trim()).filter(Boolean);
      const exprs: string[] = [];
      for (const f of requested) {
        if (f === 'revenue_per_click') {
          exprs.push(`(CASE WHEN clicks > 0 THEN CAST(revenue_usd AS DOUBLE)/CAST(clicks AS DOUBLE) ELSE NULL END) AS revenue_per_click`);
        } else if (f === 'cost_per_action') {
          exprs.push(`(CASE WHEN conversions > 0 THEN CAST(spend_usd AS DOUBLE)/CAST(conversions AS DOUBLE) ELSE NULL END) AS cost_per_action`);
        } else {
          // Basic column selection; rely on DuckDB to error if unknown
          exprs.push(f);
        }
      }
      // If nothing valid parsed, fall back to default
      return exprs.length ? exprs.join(',') : `*`;
    }

    let rows: any[];
    const t0 = Date.now();
    let readPath: 'parquet_only' | 'csv_only' | 'union' | 'node_csv' | 'parquet_then_csv' = 'parquet_only';
    try {
      // Prefer parquet-only fast-path
      const sqlParquetOnly = `
        SELECT ${buildSelectClause()}
        FROM read_parquet('${globParquet}')
        ${where}
        LIMIT ${limit}
      `;
      rows = await queryDuckDb(sqlParquetOnly, params);
      readPath = 'parquet_only';
    } catch (_) {
      try {
        // Fallback: try union if parquet exists for some parts
        const sqlUnion = `
          WITH unioned AS (
            SELECT * FROM read_parquet('${globParquet}')
            UNION ALL
            SELECT * FROM read_csv_auto('${globCsv}', IGNORE_ERRORS=true)
          )
          SELECT ${buildSelectClause()}
          FROM unioned
          ${where}
          LIMIT ${limit}
        `;
        rows = await queryDuckDb(sqlUnion, params);
        readPath = 'union';
      } catch {
        try {
          // CSV-only path
          const sqlCsvOnly = `
            SELECT ${buildSelectClause()}
            FROM read_csv_auto('${globCsv}', IGNORE_ERRORS=true)
            ${where}
            LIMIT ${limit}
          `;
          rows = await queryDuckDb(sqlCsvOnly, params);
          readPath = 'csv_only';
          console.warn('[strategist.query] CSV-only fallback used:', globCsv);
        } catch {
          try {
            // Final fallback: read CSV files directly via Node
            if (date) {
              const partDir = path.join(snap, `level=${level}`, `date=${date}`);
              const csvFiles: string[] = fs.existsSync(partDir)
                ? fs.readdirSync(partDir).filter((f) => /\.csv$/i.test(f))
                : [];
              let merged: any[] = [];
              for (const f of csvFiles) {
                try {
                  const text = fs.readFileSync(path.join(partDir, f), 'utf8');
                  const parsed = rowsFromCsv(text);
                  merged = merged.concat(parsed);
                } catch {}
              }
              rows = merged.slice(0, limit);
            } else if (startDate || endDate) {
              // Enumerate dates between start/end (inclusive) and merge
              const s = new Date((startDate || endDate as string) + 'T00:00:00Z');
              const e = new Date((endDate || startDate as string) + 'T00:00:00Z');
              const dates: string[] = [];
              for (let t = s.getTime(); t <= e.getTime(); t += 86400000) {
                dates.push(new Date(t).toISOString().slice(0, 10));
              }
              let merged: any[] = [];
              for (const d of dates) {
                const dir = path.join(snap, `level=${level}`, `date=${d}`);
                const csvFiles: string[] = fs.existsSync(dir)
                  ? fs.readdirSync(dir).filter((f) => /\.csv$/i.test(f))
                  : [];
                for (const f of csvFiles) {
                  try {
                    const text = fs.readFileSync(path.join(dir, f), 'utf8');
                    const parsed = rowsFromCsv(text);
                    merged = merged.concat(parsed);
                  } catch {}
                }
                if (merged.length >= limit) break;
              }
              rows = merged.slice(0, limit);
            } else {
              throw new Error('No readable snapshot files');
            }
            readPath = 'node_csv';
            console.warn('[strategist.query] Node CSV fallback used. Consider generating Parquet snapshots.');
          } catch {
            throw new Error('No readable snapshot files');
          }
        }
      }
    }
    const durationMs = Date.now() - t0;
    recordQueryMetrics(durationMs, readPath);

    // Optional reconciled overlay on read (for source=day only)
    if (source === 'day' && overlay && Array.isArray(rows) && rows.length) {
      try {
        // Build date constraints for reconciled lookup
        const dateFilter = date ? `date = ?` : (startDate && endDate ? `date BETWEEN ? AND ?` : (startDate ? `date >= ?` : (endDate ? `date <= ?` : '1=1')));
        const recParams = date ? [date] : (startDate && endDate ? [startDate, endDate] : (startDate ? [startDate] : (endDate ? [endDate] : [])));
        const recBase = defaultSnapshotsBase();
        const recSnap = latestSnapshotDir(recBase);
        if (recSnap) {
          // Load reconciled rows for current level; also campaign-level if allocating for adsets
          const recLevelGlob = path.join(recSnap, `level=${level}`, `date=${date || '*'}`, `*.*`);
          const recCampGlob = path.join(recSnap, `level=campaign`, `date=${date || '*'}`, `*.*`);

          const recSelect = `SELECT * FROM (SELECT * FROM read_parquet(?) UNION ALL SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)) WHERE ${dateFilter}`;
          const recRowsLevel = await queryDuckDb(recSelect, [recLevelGlob, recLevelGlob, ...recParams]).catch(() => []);
          const recRowsCampaign = level === 'adset'
            ? await queryDuckDb(recSelect, [recCampGlob, recCampGlob, ...recParams]).catch(() => [])
            : [];

          // Build maps
          const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));
          const parseNum = (v: any) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };

          const directAdsetRevenue = new Map<string, number>(); // key: date|adset_id
          for (const r of recRowsLevel) {
            const d = toStr(r.date);
            const adset = toStr(r.adset_id || r.adSetId || r.networkAdGroupId);
            const rev = parseNum(r.revenue_usd ?? r.revenue ?? r.estimated_revenue);
            if (level === 'adset' && d && adset && rev !== null) {
              const k = `${d}|${adset}`;
              directAdsetRevenue.set(k, (directAdsetRevenue.get(k) || 0) + (rev || 0));
            }
          }

          const campaignRevenue = new Map<string, number>(); // key: date|campaign_id
          for (const r of (level === 'adset' ? recRowsCampaign : recRowsLevel)) {
            const d = toStr(r.date);
            const camp = toStr(r.campaign_id || r.networkCampaignId || r.campaignId);
            const rev = parseNum(r.revenue_usd ?? r.revenue ?? r.estimated_revenue);
            if (d && camp && rev !== null) {
              const k = `${d}|${camp}`;
              campaignRevenue.set(k, (campaignRevenue.get(k) || 0) + (rev || 0));
            }
          }

          const cfg = sloConfig();
          const epsOverride = getEpsilonOverride();
          if (typeof epsOverride === 'number') cfg.epsilon = epsOverride;
          let overlayStats: any = {
            campaigns_over_epsilon: 0,
            campaigns_over_epsilon_by_date: {} as Record<string, number>,
            remainder_allocated_total: 0,
            method_counts: { direct: 0, proportional_spend: 0, direct_plus_proportional_spend: 0 },
            method_counts_by_date: {} as Record<string, { direct: number; proportional_spend: number; direct_plus_proportional_spend: number }>,
            revenue_direct_total_by_date: {} as Record<string, number>,
            revenue_allocated_total_by_date: {} as Record<string, number>,
            direct_vs_allocated_pct_by_date: {} as Record<string, number>,
          };

          if (level === 'campaign') {
            // Overlay campaign revenue directly
            rows = rows.map((r) => {
              const k = `${toStr(r.date)}|${toStr(r.campaign_id)}`;
              const rev = campaignRevenue.get(k);
              if (rev !== undefined) {
                r.revenue_direct_usd = rev;
                r.revenue_allocated_usd = 0;
                r.revenue_allocation_method = 'direct';
                r.is_reconciled = true;
                r.revenue_usd = rev;
                const spend = parseNum(r.spend_usd);
                r.roas = spend && spend > 0 ? (rev / spend) : r.roas ?? null;
              }
              return r;
            });
          } else {
            // level === 'adset': prefer direct adset revenue; allocate remainder by spend within each date+campaign
            // First, group rows by date+campaign
            const groupKeys: string[] = [];
            const groupMap = new Map<string, any[]>();
            for (const r of rows) {
              const key = `${toStr(r.date)}|${toStr(r.campaign_id)}`;
              if (!groupMap.has(key)) { groupMap.set(key, []); groupKeys.push(key); }
              groupMap.get(key)!.push(r);
            }

            for (const gk of groupKeys) {
              const [d, camp] = gk.split('|');
              const campRev = campaignRevenue.get(gk) ?? null;
              const members = groupMap.get(gk)!;

              // Apply direct adset revenue where available
              let sumDirect = 0;
              for (const r of members) {
                const ak = `${d}|${toStr(r.adset_id)}`;
                const direct = directAdsetRevenue.get(ak);
                if (direct !== undefined) {
                  r.revenue_direct_usd = direct;
                  r.revenue_usd = direct;
                  r.is_reconciled = true;
                  r.revenue_allocation_method = 'direct';
                  sumDirect += direct;
                  overlayStats.method_counts.direct += 1;
                  overlayStats.method_counts_by_date[d] = overlayStats.method_counts_by_date[d] || { direct: 0, proportional_spend: 0, direct_plus_proportional_spend: 0 };
                  overlayStats.method_counts_by_date[d].direct += 1;
                  overlayStats.revenue_direct_total_by_date[d] = (overlayStats.revenue_direct_total_by_date[d] || 0) + direct;
                }
              }

              if (campRev !== null) {
                const remainder = Math.max(0, campRev - sumDirect);
                if (remainder > 0) {
                  const spendSum = members.reduce((acc, r) => acc + (parseNum(r.spend_usd) || 0), 0);
                  for (const r of members) {
                    const alreadyDirect = parseNum(r.revenue_direct_usd) || 0;
                    const spend = parseNum(r.spend_usd) || 0;
                    let alloc = 0;
                    if (spendSum > 0) alloc = remainder * (spend / spendSum);
                    r.revenue_allocated_usd = alloc;
                    const newRev = alreadyDirect + alloc;
                    if (newRev > 0) {
                      r.revenue_usd = newRev;
                      r.is_reconciled = true;
                      if (!r.revenue_allocation_method || r.revenue_allocation_method === 'direct') {
                        r.revenue_allocation_method = alreadyDirect > 0 ? 'direct+proportional_spend' : 'proportional_spend';
                      }
                      const spendVal = parseNum(r.spend_usd);
                      r.roas = spendVal && spendVal > 0 ? (newRev / spendVal) : r.roas ?? null;
                      // Stats by method
                      if (r.revenue_allocation_method === 'proportional_spend') {
                        overlayStats.method_counts.proportional_spend += 1;
                        overlayStats.method_counts_by_date[d] = overlayStats.method_counts_by_date[d] || { direct: 0, proportional_spend: 0, direct_plus_proportional_spend: 0 };
                        overlayStats.method_counts_by_date[d].proportional_spend += 1;
                      } else if (r.revenue_allocation_method === 'direct+proportional_spend') {
                        overlayStats.method_counts.direct_plus_proportional_spend += 1;
                        overlayStats.method_counts_by_date[d] = overlayStats.method_counts_by_date[d] || { direct: 0, proportional_spend: 0, direct_plus_proportional_spend: 0 };
                        overlayStats.method_counts_by_date[d].direct_plus_proportional_spend += 1;
                      }
                      overlayStats.revenue_allocated_total_by_date[d] = (overlayStats.revenue_allocated_total_by_date[d] || 0) + alloc;
                    }
                  }
                  overlayStats.remainder_allocated_total += remainder;
                }
                // Over-epsilon tracking per campaign/date
                const memberSum = members.reduce((acc, r) => acc + (parseNum(r.revenue_usd) || 0), 0);
                const diff = Math.abs(memberSum - campRev);
                const threshold = Math.max(cfg.epsilon, campRev > 0 ? (cfg.maxReconciledMissPct * campRev) : cfg.epsilon);
                if (diff > threshold) {
                  overlayStats.campaigns_over_epsilon += 1;
                  overlayStats.campaigns_over_epsilon_by_date[d] = (overlayStats.campaigns_over_epsilon_by_date[d] || 0) + 1;
                }
              }
            }
          }

          // Attach overlay stats to meta
          // Compute direct vs allocated pct per date
          for (const d of Object.keys(overlayStats.revenue_direct_total_by_date)) {
            const direct = overlayStats.revenue_direct_total_by_date[d] || 0;
            const alloc = overlayStats.revenue_allocated_total_by_date[d] || 0;
            const denom = direct + alloc;
            overlayStats.direct_vs_allocated_pct_by_date[d] = denom > 0 ? direct / denom : null;
          }
          (rows as any)._overlay_stats = overlayStats;
        }
      } catch (e) {
        if (debugMode) console.warn('[strategist.query] overlay failed:', (e as Error)?.message || e);
      }
    }

    if (wantsCsv) {
      // Remove raw fields by default or when explicitly requested
      const rowsForCsv = (rows as any[]).map((r) => {
        const rr: any = { ...r };
        if (noRaw || !debugMode) {
          delete rr._raw;
          delete rr._raw_json;
        }
        return rr;
      });
      const csv = toCsv(rowsForCsv as any[]);
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(csv);
    }

    // Coerce known date-like fields to strings for JSON
    const rowsOut = Array.isArray(rows)
      ? rows.map((r: any) => {
          let rr: any = { ...r };
          // Normalize dates
          if (rr && rr.date && typeof rr.date === 'object' && rr.date.toISOString) rr.date = rr.date.toISOString().slice(0, 10);
          if (rr && rr.data_freshness_ts && typeof rr.data_freshness_ts === 'object' && rr.data_freshness_ts.toISOString) rr.data_freshness_ts = rr.data_freshness_ts.toISOString();
          // Coerce numeric fields
          rr = coerceNumericFields(rr);
          // Clean up raw payloads: remove by default; include parsed when debug
          const hasRawJson = typeof rr._raw_json === 'string' && rr._raw_json.length > 0;
          const hasRaw = typeof rr._raw === 'string' && rr._raw.length > 0;
          if (debugMode) {
            if (hasRawJson) {
              try { rr._raw_json = JSON.parse(rr._raw_json); } catch { /* keep as string if invalid */ }
            } else if (hasRaw) {
              // legacy snapshots: keep as-is string since it's not parseable
              rr._raw_legacy = rr._raw;
            }
          }
          delete rr._raw; // hide noisy legacy field by default
          if (!debugMode || noRaw) delete rr._raw_json;
          return rr;
        })
      : rows;
    const metaOut: any = { snapshot_dir: snap, level, date, limit, source, query_ms: durationMs, read_path: readPath };
    const overlayStats = (rows as any)?._overlay_stats;
    if (overlay && overlayStats) metaOut.overlay_stats = overlayStats;
    return res.status(200).json(normalizeJsonBigInt({ meta: metaOut, data: rowsOut }));
  } catch (err) {
    console.error('strategist.query error', err);
    const wantsDetails = (String((req.query || {}).debug || '').toLowerCase() === '1') || (process.env.STRATEGIST_DEV_MODE === 'true');
    if (wantsDetails) {
      return res.status(500).json({ code: 'internal_error', message: 'Query failed', details: String((err as any)?.message || err) });
    }
    return res.status(500).json({ code: 'internal_error', message: 'Query failed' });
  }
});

// GET /validate — minimal snapshot validation for a date
router.get('/validate', optionalAuth, async (req: any, res) => {
  try {
    const date = String(req.query.date || '').trim();
    if (!date) return res.status(400).json({ code: 'bad_request', message: 'Provide date=YYYY-MM-DD' });
    const epsilon = Number(String(req.query.epsilon || '0.01'));
    const relPct = Number(String(req.query.rel_pct || process.env.SLO_MAX_RECONCILED_MISS_PCT || '0.05'));

    const daySnap = latestSnapshotDir(defaultDaySnapshotsBase());
    const recSnap = latestSnapshotDir(defaultSnapshotsBase());
    if (!daySnap) return res.status(404).json({ code: 'not_found', message: 'No day snapshots found' });

    const levels: Array<'adset' | 'campaign'> = ['adset', 'campaign'];
    const out: any = { date, epsilon, rel_pct: relPct, checks: [] };

    for (const level of levels) {
      const dayParquet = path.join(daySnap, `level=${level}`, `date=${date}`, `*.parquet`);
      const dayCsv = path.join(daySnap, `level=${level}`, `date=${date}`, `*.csv`);
      const recGlob = recSnap ? path.join(recSnap, `level=${level}`, `date=${date}`, `*.*`) : null;

      const totals = await queryDuckDb(
        `WITH unioned AS (
          SELECT * FROM read_parquet('${dayParquet}')
          UNION ALL
          SELECT * FROM read_csv_auto('${dayCsv}', IGNORE_ERRORS=true)
        )
        SELECT COUNT(*) AS rows,
               SUM(CAST(spend_usd AS DOUBLE)) AS spend,
               SUM(CAST(clicks AS BIGINT)) AS clicks,
               SUM(CAST(impressions AS BIGINT)) AS impressions
        FROM unioned WHERE date = ?`,
        [date],
      ).catch(() => [{ rows: 0, spend: 0, clicks: 0, impressions: 0 }]);

      // Null-rate checks for key fields
      const keys = level === 'adset'
        ? ['campaign_id','adset_id','spend_usd','clicks','impressions','revenue_usd']
        : ['campaign_id','spend_usd','clicks','impressions','revenue_usd'];
      const nullSql = `WITH unioned AS (
        SELECT * FROM read_parquet('${dayParquet}')
        UNION ALL
        SELECT * FROM read_csv_auto('${dayCsv}', IGNORE_ERRORS=true)
      )
      SELECT ${keys.map((k) => `SUM(CASE WHEN ${k} IS NULL THEN 1 ELSE 0 END) AS ${k}_nulls`).join(', ')}, COUNT(*) AS rows
      FROM unioned WHERE date = ?`;
      const nulls = await queryDuckDb(nullSql, [date]).catch(() => [{ rows: 0 }]);

      const entry: any = { level, day: totals[0], nulls: nulls[0] };

      // Duplicate detection: count distinct vs total by natural keys
      const keyCols = level === 'adset' ? ['date','campaign_id','adset_id'] : ['date','campaign_id'];
  const dupSql = `WITH unioned AS (
    SELECT * FROM read_parquet('${dayParquet}')
    UNION ALL
    SELECT * FROM read_csv_auto('${dayCsv}', IGNORE_ERRORS=true)
  )
  SELECT COUNT(*) AS total_rows,
         COUNT(DISTINCT ${keyCols.join(',')}) AS distinct_keys
  FROM unioned WHERE date = ?`;
  const dup = await queryDuckDb(dupSql, [date]).catch(() => [{ total_rows: 0, distinct_keys: 0 }]);
      entry.duplicates = { total_rows: dup[0]?.total_rows || 0, distinct_keys: dup[0]?.distinct_keys || 0, duplicate_rows: Math.max(0, (dup[0]?.total_rows || 0) - (dup[0]?.distinct_keys || 0)) };

      if (level === 'campaign' && recGlob) {
        const recTotals = await queryDuckDb(
          `WITH unioned AS (
            SELECT * FROM read_parquet(?)
            UNION ALL
            SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
          )
          SELECT SUM(CAST(revenue_usd AS DOUBLE)) AS revenue
          FROM unioned WHERE date = ?`,
          [recGlob, recGlob, date],
        ).catch(() => [{ revenue: null }]);
        entry.reconciled = recTotals[0];

        // Currency guard: ensure USD (if currency column exists)
        const curSql = `WITH unioned AS (
          SELECT * FROM read_parquet('${dayParquet}')
          UNION ALL
          SELECT * FROM read_csv_auto('${dayCsv}', IGNORE_ERRORS=true)
        )
        SELECT LOWER(COALESCE(currency,'usd')) AS currency, COUNT(*) AS rows
        FROM unioned WHERE date = ? GROUP BY 1`;
        const cur = await queryDuckDb(curSql, [date]).catch(() => []);
        entry.currency = { groups: cur };

        // Reconciliation by campaign: compare adset sum revenue vs reconciled campaign revenue
        const adsetByCampaign = await queryDuckDb(
          `WITH unioned AS (
            SELECT * FROM read_parquet(?)
            UNION ALL
            SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
          )
          SELECT campaign_id AS campaign_id,
                 SUM(CAST(revenue_usd AS DOUBLE)) AS adset_revenue
          FROM unioned WHERE date = ? GROUP BY campaign_id`,
          [path.join(daySnap, 'level=adset', `date=${date}`, `*.*`), path.join(daySnap, 'level=adset', `date=${date}`, `*.*`), date],
        ).catch(() => []);

        const recByCampaign = await queryDuckDb(
          `WITH unioned AS (
            SELECT * FROM read_parquet(?)
            UNION ALL
            SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
          )
          SELECT campaign_id AS campaign_id,
                 SUM(CAST(revenue_usd AS DOUBLE)) AS campaign_revenue
          FROM unioned WHERE date = ? GROUP BY campaign_id`,
          [recGlob, recGlob, date],
        ).catch(() => []);

        const recMap = new Map<string, number>();
        for (const r of recByCampaign) recMap.set(String(r.campaign_id), Number(r.campaign_revenue || 0));
        const discrepancies: any[] = [];
        for (const r of adsetByCampaign) {
          const campId = String(r.campaign_id);
          const adsetSum = Number(r.adset_revenue || 0);
          const recSum = recMap.get(campId) ?? 0;
          const diff = adsetSum - recSum;
          const threshold = Math.max(epsilon, (recSum > 0 ? relPct * recSum : epsilon));
          const ok = Math.abs(diff) <= threshold;
          if (!ok) discrepancies.push({ campaign_id: campId, adset_sum: adsetSum, campaign_reconciled: recSum, diff, threshold, rel_pct: relPct });
        }
        entry.reconciliation = { epsilon, rel_pct: relPct, discrepancies, ok: discrepancies.length === 0 };
      }

      out.checks.push(entry);
    }

    try {
      const url = process.env.STRATEGIS_WEBHOOK_URL;
      if (url) {
        const hasIssues = out.checks.some((c: any) => c.reconciliation && c.reconciliation.discrepancies && c.reconciliation.discrepancies.length > 0);
        if (hasIssues) {
          const body = {
            type: 'validator_alert',
            date,
            epsilon,
            rel_pct: relPct,
            summary: out.checks.map((c: any) => ({ level: c.level, rows: c.day?.rows, discrepancies: c.reconciliation?.discrepancies?.length || 0 })),
          };
          await axios.post(url, body, { timeout: 5000 }).catch(() => {});
        }
      }
    } catch {}

    // Determine overall status and store for health
    const anyRecIssues = out.checks.some((c: any) => c.reconciliation && c.reconciliation.ok === false);
    (out as any).ok = !anyRecIssues;
    (out as any).generated_at = new Date().toISOString();
    setLastValidateSummary({ date, ok: (out as any).ok, generated_at: (out as any).generated_at, summary: out.checks.map((c: any) => ({ level: c.level, rows: c.day?.rows, discrepancies: c.reconciliation?.discrepancies?.length || 0 })) });

    return res.status(200).json(out);
  } catch (err) {
    console.error('strategist.validate error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Validation failed' });
  }
});

// POST /backfill — trigger backfill for a date range (yesterday default)
router.post('/backfill', authenticateUser, async (req: any, res) => {
  try {
    const { start, end, levels } = req.body || {};
    const args = ['src/scripts/backfill.ts'];
    if (start) args.push(`--start=${start}`);
    if (end) args.push(`--end=${end}`);
    if (levels) args.push(`--levels=${levels}`);
    const { stdout, stderr } = await execFileAsync('ts-node', args, { cwd: process.cwd(), timeout: 60 * 60_000 });
    return res.status(200).json({ ok: true, stdout, stderr });
  } catch (err) {
    console.error('strategist.backfill error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Backfill failed' });
  }
});

// --- Admin runbooks (dry-run by default, confirm=1 required) ---
function isAdminEnabled(): boolean {
  return String(process.env.ADMIN_ACTIONS_ENABLED || 'true').toLowerCase() === 'true';
}
function isConfirmed(req: any): boolean {
  const q = req.query?.confirm;
  const b = req.body?.confirm;
  return String(q ?? b ?? '').toLowerCase() === '1' || String(q ?? b ?? '').toLowerCase() === 'true';
}

router.post('/admin/reingest', authenticateUser, async (req: any, res) => {
  const t0 = Date.now();
  if (!isAdminEnabled()) return res.status(403).json({ code: 'forbidden', message: 'Admin actions disabled' });
  try {
    const date = String(req.query.date || req.body?.date || '').trim();
    const levels = String(req.query.levels || req.body?.levels || 'adset,campaign');
    if (!date) return res.status(400).json({ code: 'bad_request', message: 'Provide date=YYYY-MM-DD' });
    const args = ['src/scripts/ingestDay.ts', `--start=${date}`, `--end=${date}`, `--levels=${levels}`];
    const dry = !isConfirmed(req);
    if (dry) return res.status(200).json({ dry_run: true, command: 'ts-node', args });
    const { stdout, stderr } = await execFileAsync('ts-node', args, { cwd: process.cwd(), timeout: 60 * 60_000 });
    recordAdminAction('reingest', true);
    return res.status(200).json({ ok: true, ms: Date.now() - t0, stdout, stderr });
  } catch (err) {
    recordAdminAction('reingest', false);
    return res.status(500).json({ code: 'internal_error', message: (err as any)?.message || 'reingest failed' });
  }
});

router.post('/admin/revalidate', authenticateUser, async (req: any, res) => {
  const t0 = Date.now();
  if (!isAdminEnabled()) return res.status(403).json({ code: 'forbidden', message: 'Admin actions disabled' });
  try {
    const date = String(req.query.date || req.body?.date || '').trim();
    const epsilon = String(req.query.epsilon || req.body?.epsilon || '0.01');
    const relPct = String(req.query.rel_pct || req.body?.rel_pct || process.env.SLO_MAX_RECONCILED_MISS_PCT || '0.05');
    if (!date) return res.status(400).json({ code: 'bad_request', message: 'Provide date=YYYY-MM-DD' });
    const args = ['src/scripts/validateSnapshots.ts', '--date', date, '--epsilon', epsilon, '--rel_pct', relPct];
    const dry = !isConfirmed(req);
    if (dry) return res.status(200).json({ dry_run: true, command: 'ts-node', args });
    const { stdout, stderr } = await execFileAsync('ts-node', args, { cwd: process.cwd(), timeout: 15 * 60_000 });
    recordAdminAction('revalidate', true);
    return res.status(200).json({ ok: true, ms: Date.now() - t0, stdout, stderr });
  } catch (err) {
    recordAdminAction('revalidate', false);
    return res.status(500).json({ code: 'internal_error', message: (err as any)?.message || 'revalidate failed' });
  }
});

router.post('/admin/adjust-epsilon', authenticateUser, async (req: any, res) => {
  if (!isAdminEnabled()) return res.status(403).json({ code: 'forbidden', message: 'Admin actions disabled' });
  try {
    const epsilon = Number(req.body?.epsilon ?? req.query?.epsilon);
    const dry = !isConfirmed(req);
    if (!Number.isFinite(epsilon) || epsilon <= 0) return res.status(400).json({ code: 'bad_request', message: 'Provide epsilon > 0' });
    if (dry) return res.status(200).json({ dry_run: true, old: getEpsilonOverride() ?? process.env.SLO_EPSILON, next: epsilon });
    const old = getEpsilonOverride() ?? (process.env.SLO_EPSILON ? Number(process.env.SLO_EPSILON) : undefined);
    setEpsilonOverride(epsilon);
    recordAdminAction('adjust_epsilon', true);
    return res.status(200).json({ ok: true, old, next: epsilon });
  } catch (err) {
    recordAdminAction('adjust_epsilon', false);
    return res.status(500).json({ code: 'internal_error', message: (err as any)?.message || 'adjust-epsilon failed' });
  }
});

router.post('/admin/toggle-overlay', authenticateUser, async (req: any, res) => {
  if (!isAdminEnabled()) return res.status(403).json({ code: 'forbidden', message: 'Admin actions disabled' });
  try {
    const disabled = String(req.body?.disabled ?? req.query?.disabled ?? 'true').toLowerCase();
    const value = disabled === '1' || disabled === 'true';
    const dry = !isConfirmed(req);
    if (dry) return res.status(200).json({ dry_run: true, next_disabled: value });
    setOverlayDisabledOverride(value);
    recordAdminAction('toggle_overlay', true);
    return res.status(200).json({ ok: true, overlay_disabled: value });
  } catch (err) {
    recordAdminAction('toggle_overlay', false);
    return res.status(500).json({ code: 'internal_error', message: (err as any)?.message || 'toggle-overlay failed' });
  }
});

export default router;


