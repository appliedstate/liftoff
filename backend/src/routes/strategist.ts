import express from 'express';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { generateText } from '../lib/openai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { latestSnapshotDir, defaultSnapshotsBase, defaultDaySnapshotsBase } from '../lib/snapshots';
import axios from 'axios';

const router = express.Router();
const execFileAsync = promisify(execFile);

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
    const source = String(q.source || 'day').toLowerCase(); // day | reconciled
    const limit = Math.min(Math.max(parseInt(q.limit || '100', 10) || 100, 1), 5000);
    const storageKey = (q.key as string) || req.user?.id || 'default';

    // Source rows: prefer ingested; else use demo rows
    let rows: any[] = ingests.get(storageKey) || [];
    if (!rows.length) {
      // Attempt to read from day/reconciled snapshots if available
      const base = source === 'reconciled' ? defaultSnapshotsBase() : defaultDaySnapshotsBase();
      const snap = latestSnapshotDir(base);
      if (snap) {
        const globPath = path.join(snap, `level=${level}`, `date=${q.date || '*'}`, `*.*`);
        try {
          const sql = `
            WITH unioned AS (
              SELECT * FROM read_parquet('${globPath}')
              UNION ALL
              SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
            )
            SELECT * FROM unioned ${q.date ? 'WHERE date = ?' : ''} LIMIT ${limit}
          `;
          rows = await queryDuckDb(sql, q.date ? [q.date] : []);
        } catch {}
      }
    }
    if (!rows.length) {
      rows = Array.from({ length: Math.min(limit, 25) }, () => ({
        date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10),
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

    // Filter by level/date if provided
    if (q.date) rows = rows.filter((r) => String(r.date) === q.date);
    rows = rows.filter((r) => String(r.level).toLowerCase() === level);
    rows = rows.slice(0, limit);

    // Deterministic simple simulator
    const cfg = {
      roas_up: Number(process.env.RECS_ROAS_UP ?? '1.3'),
      roas_down: Number(process.env.RECS_ROAS_DOWN ?? '0.8'),
      step_up: Number(process.env.RECS_STEP_UP ?? '0.2'),
      step_down: Number(process.env.RECS_STEP_DOWN ?? '-0.2'),
    };

    function simulate(r: any) {
      const roas = Number(r.roas || 0);
      let action = 'hold';
      let delta = 0;
      if (roas >= cfg.roas_up) { action = 'bump_budget'; delta = cfg.step_up; }
      else if (roas < cfg.roas_down) { action = 'trim_budget'; delta = cfg.step_down; }
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
    const roasGt = req.query.roas_gt ? Number(req.query.roas_gt) : null;
    const roasLt = req.query.roas_lt ? Number(req.query.roas_lt) : null;
    const campaignId = req.query.campaign_id ? String(req.query.campaign_id) : null;
    const adsetId = req.query.adset_id ? String(req.query.adset_id) : null;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 10000);
    const wantsCsv = (String(req.query.format || '').toLowerCase() === 'csv') || (req.headers['accept']?.includes('text/csv') ?? false);

    const base = source === 'reconciled' ? defaultSnapshotsBase() : defaultDaySnapshotsBase();
    const snap = latestSnapshotDir(base);
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });

    const globPath = path.join(snap, `level=${level}`, `date=${date || '*'}`, `*.*`);

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
    if (roasGt !== null && !Number.isNaN(roasGt)) { whereParts.push(`CAST(roas AS DOUBLE) > ?`); params.push(roasGt); }
    if (roasLt !== null && !Number.isNaN(roasLt)) { whereParts.push(`CAST(roas AS DOUBLE) < ?`); params.push(roasLt); }
    if (campaignId) { whereParts.push(`campaign_id = ?`); params.push(campaignId); }
    if (adsetId) { whereParts.push(`adset_id = ?`); params.push(adsetId); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const sql = `
      WITH unioned AS (
        SELECT * FROM read_parquet('${globPath}')
        UNION ALL
        SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
      )
      SELECT 
        *,
        (CASE WHEN clicks > 0 THEN CAST(revenue_usd AS DOUBLE)/CAST(clicks AS DOUBLE) ELSE NULL END) AS revenue_per_click,
        (CASE WHEN conversions > 0 THEN CAST(spend_usd AS DOUBLE)/CAST(conversions AS DOUBLE) ELSE NULL END) AS cost_per_action
      FROM unioned
      ${where}
      LIMIT ${limit}
    `;
    const rows = await queryDuckDb(sql, params);

    if (wantsCsv) {
      const csv = toCsv(rows as any[]);
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(csv);
    }

    return res.status(200).json({ meta: { snapshot_dir: snap, level, date, limit, source }, data: rows });
  } catch (err) {
    console.error('strategist.query error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Query failed' });
  }
});

export default router;


