import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export type KeywordRow = {
  keyword: string;
  keyword_norm: string;
  angle: string | null;
  category: string | null;
  searches: number | null;
  clicks: number | null;
  revenue: number | null;
  rpc: number | null;
  rps: number | null;
};

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
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

export async function extractKeywords(inputCsvPath: string): Promise<KeywordRow[]> {
  if (!fs.existsSync(inputCsvPath)) {
    throw new Error(`Input CSV not found: ${inputCsvPath}`);
  }

  // Use DuckDB to handle malformed CSV - it's more robust than csv-parse
  const rows = await queryCsv(inputCsvPath, `
    SELECT 
      category,
      angle,
      keyword,
      CAST(searches AS DOUBLE) as searches,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue
    FROM t
    WHERE keyword IS NOT NULL AND TRIM(keyword) != ''
  `);

  // Aggregate by normalized keyword
  const agg = new Map<string, {
    keyword: string;
    angle: string | null;
    category: string | null;
    searches: number;
    clicks: number;
    revenue: number;
  }>();

  for (const r of rows) {
    const rawKeyword = String(r.keyword || '').trim();
    if (!rawKeyword) continue;
    const keywordNorm = normalizeWhitespace(rawKeyword);
    const prev = agg.get(keywordNorm);
    const searches = Number(r.searches) || 0;
    const clicks = Number(r.clicks) || 0;
    const revenue = Number(r.revenue) || 0;
    const angleVal = r.angle != null && String(r.angle).trim() !== '' ? String(r.angle) : null;
    const categoryVal = r.category != null && String(r.category).trim() !== '' ? String(r.category) : null;

    if (!prev) {
      agg.set(keywordNorm, {
        keyword: rawKeyword,
        angle: angleVal,
        category: categoryVal,
        searches,
        clicks,
        revenue,
      });
    } else {
      prev.searches += searches;
      prev.clicks += clicks;
      prev.revenue += revenue;
      if (!prev.angle && angleVal) prev.angle = angleVal;
      if (!prev.category && categoryVal) prev.category = categoryVal;
    }
  }

  const out: KeywordRow[] = [];
  for (const [keyword_norm, v] of agg.entries()) {
    const rpc = v.clicks > 0 ? v.revenue / v.clicks : null;
    const rps = v.searches > 0 ? v.revenue / v.searches : null;
    out.push({
      keyword: v.keyword,
      keyword_norm,
      angle: v.angle,
      category: v.category,
      searches: v.searches,
      clicks: v.clicks,
      revenue: v.revenue,
      rpc,
      rps,
    });
  }
  return out;
}

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

function toNum(v: any): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function cli() {
  const input = getArg('input');
  if (!input) {
    console.error('Usage: ts-node src/scripts/vector/extract_keywords.ts --input backend/runs/system1/YYYY-MM-DD/angle_full.csv');
    process.exit(1);
  }
  const abs = path.resolve(input);
  const rows = await extractKeywords(abs);
  console.log(JSON.stringify({ count: rows.length, sample: rows.slice(0, 5) }, null, 2));
}

if (require.main === module) {
  cli().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


