import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';
import axios from 'axios';
import { ensureDir } from '../lib/snapshots';

const router = Router();

// Get or create persistent DuckDB database for session revenue
function getSessionRevenueDb() {
  const dbPath = path.resolve(process.cwd(), 'data', 'session_revenue.duckdb');
  ensureDir(path.dirname(dbPath));
  return new duckdb.Database(dbPath);
}

function getLatestRunDir(): string {
  const base = path.resolve(__dirname, '../../runs/system1');
  if (!fs.existsSync(base)) throw new Error('No system1 runs directory found');
  const entries = fs.readdirSync(base).filter((d) => /\d{4}-\d{2}-\d{2}/.test(d));
  if (entries.length === 0) throw new Error('No dated run directories found');
  // Sort descending
  entries.sort((a, b) => (a < b ? 1 : -1));
  return path.join(base, entries[0]);
}

async function queryCsv<T = any>(csvPath: string, sql: string): Promise<T[]> {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const escaped = csvPath.replace(/'/g, "''");
  const run = (q: string) => new Promise<void>((resolve, reject) => (conn as any).run(q, (err: Error | null) => err ? reject(err) : resolve()));
  const all = (q: string) => new Promise<any[]>((resolve, reject) => (conn as any).all(q, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows)));
  await run(`CREATE TABLE t AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true);`);
  const rows = await all(sql);
  conn.close(() => db.close(() => {}));
  return rows;
}

// Parse CSV text into rows
function parseCsv(csvText: string): { header: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };

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
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = vals[j] || '';
    }
    rows.push(row);
  }
  return { header, rows };
}

function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// Initialize DuckDB table schema
async function initSessionRevenueTable(): Promise<void> {
  const db = getSessionRevenueDb();
  const conn = db.connect();
  const run = (q: string) => new Promise<void>((resolve, reject) => 
    (conn as any).run(q, (err: Error | null) => (err ? reject(err) : resolve()))
  );

  try {
    await run(`
      CREATE TABLE IF NOT EXISTS s1_session_revenue (
        date DATE NOT NULL,
        session_id TEXT,
        revenue DOUBLE,
        revenue_adjustment DOUBLE,
        total_revenue DOUBLE,
        raw_data JSON,
        filter_zero BOOLEAN,
        incremental BOOLEAN,
        source_file TEXT,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (date, session_id, filter_zero, incremental)
      )
    `);
    
    // Create indexes
    await run('CREATE INDEX IF NOT EXISTS idx_date ON s1_session_revenue(date)');
    await run('CREATE INDEX IF NOT EXISTS idx_session_id ON s1_session_revenue(session_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_revenue ON s1_session_revenue(total_revenue)');
  } finally {
    conn.close();
  }
}

// Store session revenue data in DuckDB
async function storeSessionRevenueInDb(
  date: string,
  csvText: string,
  filterZero: boolean,
  incremental: boolean,
  sourceFile: string
): Promise<{ inserted: number; updated: number }> {
  try {
    await initSessionRevenueTable();
    
    const db = getSessionRevenueDb();
    const conn = db.connect();
    const run = (q: string) => new Promise<void>((resolve, reject) => 
      (conn as any).run(q, (err: Error | null) => (err ? reject(err) : resolve()))
    );
    const all = (q: string) => new Promise<any[]>((resolve, reject) => 
      (conn as any).all(q, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows)))
    );

    const { rows: csvRows } = parseCsv(csvText);

    if (csvRows.length === 0) {
      conn.close();
      return { inserted: 0, updated: 0 };
    }

    // Normalize column names (case-insensitive matching)
    const normalizeKey = (key: string): string => {
      const lower = key.toLowerCase();
      if (lower.includes('session') && lower.includes('id')) return 'session_id';
      if (lower === 'revenue' || lower === 'total_revenue') return 'revenue';
      if (lower.includes('adjustment') || lower.includes('incremental')) return 'revenue_adjustment';
      return key;
    };

    try {
      // Create temp table from CSV data
      const tempCsvPath = path.join(process.cwd(), 'data', `temp_session_${Date.now()}.csv`);
      fs.writeFileSync(tempCsvPath, csvText, 'utf-8');

      await run(`
        CREATE TEMP TABLE temp_csv AS 
        SELECT * FROM read_csv_auto('${tempCsvPath.replace(/'/g, "''")}', header=true, all_varchar=true, ignore_errors=true)
      `);

      // Normalize and insert/update
      let inserted = 0;
      let updated = 0;

      const rows = await all(`
        SELECT * FROM temp_csv
      `);

      for (const row of rows) {
        const normalizedRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          normalizedRow[normalizeKey(key)] = value;
        }

        const sessionId = normalizedRow.session_id || null;
        const revenue = normalizedRow.revenue ? parseFloat(String(normalizedRow.revenue)) : null;
        const revenueAdjustment = normalizedRow.revenue_adjustment ? parseFloat(String(normalizedRow.revenue_adjustment)) : null;
        const totalRevenue = revenueAdjustment !== null && revenue !== null ? revenue + revenueAdjustment : revenue;
        const rawDataJson = JSON.stringify(normalizedRow);

        // Use INSERT OR REPLACE (DuckDB's upsert syntax)
        // First delete existing if exists, then insert
        await run(`
          DELETE FROM s1_session_revenue 
          WHERE date = '${date}'
            AND session_id = ${sessionId ? `'${String(sessionId).replace(/'/g, "''")}'` : 'NULL'}
            AND filter_zero = ${filterZero}
            AND incremental = ${incremental}
        `);
        
        await run(`
          INSERT INTO s1_session_revenue (
            date, session_id, revenue, revenue_adjustment, total_revenue,
            raw_data, filter_zero, incremental, source_file, fetched_at
          )
          VALUES (
            '${date}',
            ${sessionId ? `'${String(sessionId).replace(/'/g, "''")}'` : 'NULL'},
            ${revenue !== null ? revenue : 'NULL'},
            ${revenueAdjustment !== null ? revenueAdjustment : 'NULL'},
            ${totalRevenue !== null ? totalRevenue : 'NULL'},
            '${rawDataJson.replace(/'/g, "''")}',
            ${filterZero},
            ${incremental},
            '${sourceFile.replace(/'/g, "''")}',
            CURRENT_TIMESTAMP
          )
        `);
        
        inserted++;
      }

      // Clean up temp file
      try { fs.unlinkSync(tempCsvPath); } catch {}

      conn.close();
      return { inserted, updated: 0 }; // DuckDB doesn't distinguish inserts vs updates easily
    } catch (err: any) {
      conn.close();
      throw err;
    }
  } catch (err: any) {
    console.error('[storeSessionRevenueInDb] Error:', err.message);
    // Don't throw - allow CSV storage to continue even if DB fails
    return { inserted: 0, updated: 0 };
  }
}

router.get('/hooks/top', async (req, res) => {
  try {
    const metric = (String(req.query.metric || 'revenue').toLowerCase());
    const limit = Math.max(1, Math.min(1000, parseInt(String(req.query.limit || '50'), 10)));
    const runDir = getLatestRunDir();
    const file = metric === 'searches' ? 'top_hooks_by_searches.csv' : 'top_hooks_by_revenue.csv';
    const csv = path.join(runDir, file);
    const rows = await queryCsv(csv, `SELECT * FROM t ORDER BY ${metric === 'searches' ? 'searches' : 'revenue'} DESC LIMIT ${limit}`);
    res.json({ runDir, metric, rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.get('/angle/phrases', async (req, res) => {
  try {
    const angle = String(req.query.angle || '').trim();
    if (!angle) return res.status(400).json({ error: 'angle is required' });
    const limit = Math.max(1, Math.min(5000, parseInt(String(req.query.limit || '100'), 10)));
    const runDir = getLatestRunDir();
    const csv = path.join(runDir, 'angle_full.csv');
    const angleEsc = angle.replace(/'/g, "''");
    const rows = await queryCsv(csv, `
      SELECT category, angle, keyword, searches::DOUBLE AS searches, clicks::DOUBLE AS clicks, revenue::DOUBLE AS revenue,
             ctr::DOUBLE AS ctr, rpc::DOUBLE AS rpc, rps::DOUBLE AS rps
      FROM t WHERE angle = '${angleEsc}'
      ORDER BY revenue DESC LIMIT ${limit}
    `);
    res.json({ runDir, angle, rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.get('/angle/states', async (req, res) => {
  try {
    const vertical = String(req.query.vertical || '').trim();
    const category = String(req.query.category || '').trim();
    const angle = String(req.query.angle || '').trim();
    const minClicks = Math.max(0, parseInt(String(req.query.minClicks || '100'), 10));
    if (!angle) return res.status(400).json({ error: 'angle is required' });
    const runDir = getLatestRunDir();
    const csv = path.join(runDir, 'vertical_angle_state_index.csv');
    const v = vertical ? `vertical = '${vertical.replace(/'/g, "''")}' AND` : '';
    const c = category ? `category = '${category.replace(/'/g, "''")}' AND` : '';
    const a = `angle = '${angle.replace(/'/g, "''")}'`;
    const rows = await queryCsv(csv, `
      SELECT vertical, category, angle, state,
             searches::DOUBLE AS searches, clicks::DOUBLE AS clicks, revenue::DOUBLE AS revenue,
             ctr::DOUBLE AS ctr, rpc::DOUBLE AS rpc, rps::DOUBLE AS rps
      FROM t
      WHERE ${v} ${c} ${a} AND CAST(clicks AS DOUBLE) >= ${minClicks}
      ORDER BY searches::DOUBLE DESC, rpc::DOUBLE DESC
      LIMIT 50
    `);
    res.json({ runDir, angle, vertical: vertical || null, category: category || null, minClicks, rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.get('/campaign/pack', async (req, res) => {
  try {
    const angle = String(req.query.angle || '').trim();
    if (!angle) return res.status(400).json({ error: 'angle is required' });
    const phrases = Math.max(1, Math.min(50, parseInt(String(req.query.phrases || '5'), 10)));
    const states = Math.max(1, Math.min(20, parseInt(String(req.query.states || '5'), 10)));
    const minClicks = Math.max(0, parseInt(String(req.query.minClicks || '100'), 10));
    const runDir = getLatestRunDir();
    const phrasesCsv = path.join(runDir, 'angle_full.csv');
    const statesCsv = path.join(runDir, 'vertical_angle_state_index.csv');
    const angleEsc = angle.replace(/'/g, "''");
    const phraseRows = await queryCsv(phrasesCsv, `
      SELECT category, angle, keyword, searches::DOUBLE AS searches, clicks::DOUBLE AS clicks, revenue::DOUBLE AS revenue,
             ctr::DOUBLE AS ctr, rpc::DOUBLE AS rpc, rps::DOUBLE AS rps
      FROM t WHERE angle = '${angleEsc}'
      ORDER BY revenue DESC LIMIT ${phrases}
    `);
    const stateRows = await queryCsv(statesCsv, `
      SELECT state, searches::DOUBLE AS searches, clicks::DOUBLE AS clicks, revenue::DOUBLE AS revenue,
             ctr::DOUBLE AS ctr, rpc::DOUBLE AS rpc, rps::DOUBLE AS rps
      FROM t WHERE angle = '${angleEsc}' AND CAST(clicks AS DOUBLE) >= ${minClicks}
      ORDER BY searches::DOUBLE DESC, rpc::DOUBLE DESC
      LIMIT ${states}
    `);
    res.json({ runDir, angle, phrases: phraseRows, states: stateRows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// GET /session-revenue/query — query stored session revenue data across multiple days using DuckDB
router.get('/session-revenue/query', async (req, res) => {
  try {
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();
    const date = String(req.query.date || '').trim(); // Single date query
    const limit = Math.max(1, Math.min(10000, parseInt(String(req.query.limit || '1000'), 10)));

    if (!date && !startDate) {
      return res.status(400).json({ error: 'Provide date or start_date parameter' });
    }

    const baseDir = path.resolve(process.cwd(), 'runs', 'system1');
    if (!fs.existsSync(baseDir)) {
      return res.status(404).json({ error: 'No system1 data directory found' });
    }

    // Collect CSV files for the date range
    const csvFiles: string[] = [];
    const dates: string[] = [];

    if (date) {
      dates.push(date);
    } else {
      // Generate date range
      const start = new Date(startDate + 'T00:00:00Z');
      const end = new Date((endDate || startDate) + 'T00:00:00Z');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }
    }

    for (const d of dates) {
      const dateDir = path.join(baseDir, d);
      if (fs.existsSync(dateDir)) {
        const files = fs.readdirSync(dateDir).filter((f) => f.startsWith('session_revenue_') && f.endsWith('.csv'));
        for (const f of files) {
          csvFiles.push(path.join(dateDir, f));
        }
      }
    }

    if (csvFiles.length === 0) {
      return res.status(404).json({ error: 'No session revenue CSV files found for the specified date(s)' });
    }

    // Query across all CSV files using DuckDB
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    const all = (q: string) => new Promise<any[]>((resolve, reject) => {
      conn.all(q, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows)));
    });

    try {
      // Create a union of all CSV files
      const unionParts = csvFiles.map((f, idx) => {
        const escaped = f.replace(/'/g, "''");
        return `SELECT *, '${path.basename(f)}' AS source_file FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true)`;
      });

      const sql = `
        WITH all_data AS (
          ${unionParts.join(' UNION ALL ')}
        )
        SELECT * FROM all_data
        LIMIT ${limit}
      `;

      const rows = await all(sql);

      return res.status(200).json({
        success: true,
        files_queried: csvFiles.length,
        dates,
        row_count: rows.length,
        data: rows,
      });
    } finally {
      conn.close(() => db.close(() => {}));
    }
  } catch (e: any) {
    console.error('[system1.session-revenue.query] Error:', e.message);
    return res.status(500).json({ error: e.message || 'Query failed' });
  }
});

// GET /session-revenue — fetch session revenue data from Strategis API and store for analysis
router.get('/session-revenue', async (req, res) => {
  try {
    // Parse query parameters
    const date = String(req.query.date || '').trim();
    if (!date) {
      return res.status(400).json({ error: 'date parameter is required (format: YYYY-MM-DD)' });
    }

    // Default to including zero-revenue sessions to maximize join coverage with FB
    const filterZero = String(req.query.filterZero || '0');
    const incremental = String(req.query.incremental || '1');
    const limit = String(req.query.limit || '-1');
    const offset = String(req.query.offset || '0');
    const output = String(req.query.output || 'json').toLowerCase();

    // Build query parameters for external API
    const params = new URLSearchParams({
      date,
      filterZero,
      incremental,
      limit,
      offset,
      output: output === 'csv' ? 'csv' : 'json',
    });

    // Call external API
    const apiUrl = `https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev?${params.toString()}`;
    console.log(`[system1.session-revenue] Fetching from: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      responseType: output === 'csv' ? 'text' : 'json',
      timeout: 60000, // 60 second timeout
    });

    // Store the data for analysis
    const baseDir = path.resolve(process.cwd(), 'runs', 'system1');
    const dateDir = path.join(baseDir, date);
    ensureDir(dateDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const filename = `session_revenue_${date}_${timestamp}.${output === 'csv' ? 'csv' : 'json'}`;
    const filePath = path.join(dateDir, filename);

    const csvText = output === 'csv' ? (response.data as string) : null;
    const jsonData = output === 'json' ? response.data : null;

    // Always store CSV for backup/archive (convert JSON to CSV if needed)
    if (csvText) {
      fs.writeFileSync(filePath, csvText, 'utf-8');
    } else if (jsonData) {
      // Convert JSON to CSV if needed (basic implementation)
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
    }

    // Store in PostgreSQL if CSV is available
    let dbResult = { inserted: 0, updated: 0 };
    if (csvText) {
      const filterZeroBool = filterZero === '1';
      const incrementalBool = incremental === '1';
      dbResult = await storeSessionRevenueInDb(date, csvText, filterZeroBool, incrementalBool, filename);
    }

    // Create or update manifest
    const manifestPath = path.join(dateDir, 'manifest.json');
    let manifest: any = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch {}
    }

    if (!manifest.files) manifest.files = [];
    if (!manifest.files.includes(filename)) {
      manifest.files.push(filename);
    }
    manifest.last_fetched = new Date().toISOString();
    manifest.date = date;
    manifest.query_params = { filterZero, incremental, limit, offset, output };
    manifest.db_stored = dbResult.inserted > 0 || dbResult.updated > 0;
    manifest.db_rows = dbResult.inserted + dbResult.updated;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Return response
    if (output === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(response.data);
    }

    return res.status(200).json({
      success: true,
      date,
      stored_at: filePath,
      db_stored: dbResult.inserted > 0 || dbResult.updated > 0,
      db_rows_inserted: dbResult.inserted,
      db_rows_updated: dbResult.updated,
      data: response.data,
      manifest,
    });
  } catch (e: any) {
    console.error('[system1.session-revenue] Error:', e.message);
    const status = e.response?.status || 500;
    const message = e.response?.data?.message || e.message || 'Failed to fetch session revenue data';
    return res.status(status).json({ error: message, details: e.message });
  }
});

// GET /session-revenue/db — query session revenue data from DuckDB
router.get('/session-revenue/db', async (req, res) => {
  try {
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();
    const date = String(req.query.date || '').trim();
    const sessionId = String(req.query.session_id || '').trim();
    const minRevenue = req.query.min_revenue ? parseFloat(String(req.query.min_revenue)) : null;
    const filterZero = req.query.filter_zero !== undefined ? String(req.query.filter_zero) === '1' : null;
    const incremental = req.query.incremental !== undefined ? String(req.query.incremental) === '1' : null;
    const limit = Math.max(1, Math.min(10000, parseInt(String(req.query.limit || '1000'), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));
    const aggregate = String(req.query.aggregate || '').toLowerCase(); // 'daily', 'session', etc.

    const db = getSessionRevenueDb();
    const conn = db.connect();
    const all = (q: string) => new Promise<any[]>((resolve, reject) => 
      (conn as any).all(q, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows)))
    );

    try {
      let whereClauses: string[] = [];

      if (date) {
        whereClauses.push(`date = '${date}'`);
      } else if (startDate) {
        if (endDate) {
          whereClauses.push(`date BETWEEN '${startDate}' AND '${endDate}'`);
        } else {
          whereClauses.push(`date >= '${startDate}'`);
        }
      }

      if (sessionId) {
        whereClauses.push(`session_id = '${sessionId.replace(/'/g, "''")}'`);
      }

      if (minRevenue !== null) {
        whereClauses.push(`total_revenue >= ${minRevenue}`);
      }

      if (filterZero !== null) {
        whereClauses.push(`filter_zero = ${filterZero}`);
      }

      if (incremental !== null) {
        whereClauses.push(`incremental = ${incremental}`);
      }

      const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      let sql: string;
      if (aggregate === 'daily') {
        sql = `
          SELECT 
            date,
            COUNT(*) as session_count,
            SUM(total_revenue) as total_revenue_sum,
            AVG(total_revenue) as avg_revenue,
            MIN(total_revenue) as min_revenue,
            MAX(total_revenue) as max_revenue
          FROM s1_session_revenue
          ${where}
          GROUP BY date
          ORDER BY date DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        sql = `
          SELECT * FROM s1_session_revenue
          ${where}
          ORDER BY date DESC, total_revenue DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      const rows = await all(sql);

      conn.close();
      return res.status(200).json({
        success: true,
        row_count: rows.length,
        limit,
        offset,
        aggregate: aggregate || 'none',
        data: rows,
      });
    } catch (err: any) {
      conn.close();
      throw err;
    }
  } catch (e: any) {
    console.error('[system1.session-revenue.db] Error:', e.message);
    return res.status(500).json({ error: e.message || 'Database query failed' });
  }
});

// GET /session-revenue/settle-stats — fetch from Strategis and compute hours to 99% revenue by click_hour
router.get('/session-revenue/settle-stats', async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    if (!date) return res.status(400).json({ error: 'Provide date=YYYY-MM-DD' });
    // Always enforce revenue-only and incremental adjustments
    const params = new URLSearchParams({
      date,
      filterZero: '1',
      incremental: '1',
      limit: '-1',
      offset: '0',
      output: 'csv',
    });
    const apiUrl = `https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev?${params.toString()}`;
    const resp = await axios.get(apiUrl, { responseType: 'text', timeout: 120000 });
    const csv = resp.data as string;
    if (!csv || typeof csv !== 'string' || csv.trim().length === 0) {
      return res.status(502).json({ error: 'Empty CSV from upstream' });
    }
    const { header, rows } = parseCsv(csv);
    if (!header.length || !rows.length) return res.status(200).json({ date, rows: 0, message: 'No rows' });

    // Identify hour_* columns dynamically
    const hourCols = header
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => /^hour_\d+$/i.test(h))
      .sort((a, b) => {
        const ai = Number(a.h.replace(/[^0-9]/g, '') || '0');
        const bi = Number(b.h.replace(/[^0-9]/g, '') || '0');
        return ai - bi;
      });
    const totalIdx = header.findIndex((h) => h.toLowerCase() === 'total_revenue');
    const clickHourIdx = header.findIndex((h) => h.toLowerCase() === 'click_hour');

    if (hourCols.length === 0 || totalIdx < 0 || clickHourIdx < 0) {
      return res.status(422).json({ error: 'Unexpected CSV schema', header });
    }

    type Acc = { hoursTo99: number[]; sessions: number; reached99: number };
    const byClickHour = new Map<number, Acc>();

    for (const r of rows) {
      const total = toNumber(r[header[totalIdx]]);
      const ch = toNumber(r[header[clickHourIdx]]);
      if (!Number.isFinite(total) || (total as number) <= 0 || !Number.isFinite(ch)) continue;
      const clickHour = Math.max(0, Math.min(23, Math.floor(ch as number)));
      let cum = 0;
      let k = null as number | null;
      for (let j = 0; j < hourCols.length; j++) {
        const { h } = hourCols[j];
        const v = toNumber(r[h]);
        cum += Number.isFinite(v) ? (v as number) : 0;
        if (k === null && cum >= 0.99 * (total as number)) {
          // Hours elapsed equals current hour bucket index + 1 (hour_1 => 1h)
          k = j + 1;
          break;
        }
      }
      const acc = byClickHour.get(clickHour) || { hoursTo99: [], sessions: 0, reached99: 0 };
      acc.sessions += 1;
      if (k !== null) {
        acc.hoursTo99.push(k);
        acc.reached99 += 1;
      }
      byClickHour.set(clickHour, acc);
    }

    function mean(nums: number[]): number | null {
      if (!nums.length) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    function median(nums: number[]): number | null {
      if (!nums.length) return null;
      const s = [...nums].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    const rowsOut = Array.from(byClickHour.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([click_hour, acc]) => {
        const avg = mean(acc.hoursTo99);
        const med = median(acc.hoursTo99);
        const pct = acc.sessions > 0 ? acc.reached99 / acc.sessions : 0;
        return {
          click_hour,
          sessions: acc.sessions,
          reached_99_sessions: acc.reached99,
          reached_99_pct: Number((pct * 100).toFixed(2)),
          avg_hours_to_99: avg !== null ? Number(avg.toFixed(2)) : null,
          median_hours_to_99: med !== null ? Number(med.toFixed(2)) : null,
        };
      });

    const overallSessions = rowsOut.reduce((a, r) => a + r.sessions, 0);
    const overallReached = rowsOut.reduce((a, r) => a + r.reached_99_sessions, 0);
    const allHours = rowsOut.flatMap((r) => {
      const acc = byClickHour.get(r.click_hour)!;
      return acc.hoursTo99;
    });

    const summary = {
      date,
      hours_columns: hourCols.map(({ h }) => h),
      sessions_total: overallSessions,
      sessions_reached_99_pct: overallReached,
      reached_99_rate_pct: overallSessions > 0 ? Number(((overallReached / overallSessions) * 100).toFixed(2)) : 0,
      overall_avg_hours_to_99: allHours.length ? Number(mean(allHours)!.toFixed(2)) : null,
      overall_median_hours_to_99: allHours.length ? Number(median(allHours)!.toFixed(2)) : null,
    };

    return res.status(200).json({ summary, by_click_hour: rowsOut });
  } catch (e: any) {
    console.error('session-revenue.settle-stats error', e);
    return res.status(500).json({ error: e?.message || 'Failed to compute settle stats' });
  }
});

export default router;


