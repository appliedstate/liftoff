import fs from 'fs';
import duckdb from 'duckdb';

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export type InterlincxKeywordRow = {
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

export async function extractInterlincxKeywords(inputCsvPath: string): Promise<InterlincxKeywordRow[]> {
  if (!fs.existsSync(inputCsvPath)) {
    throw new Error(`Input CSV not found: ${inputCsvPath}`);
  }

  // Use DuckDB to handle the Interlincx CSV format
  const rows = await queryCsv(inputCsvPath, `
    SELECT 
      TRIM(QUERY) as query,
      TRIM(PLACEMENT) as placement,
      TRIM(DEVICE_CATEGORY) as device_category,
      TRIM(COUNTRY_CODE) as country_code,
      TRY_CAST(KEYWORD_RANK AS INTEGER) as keyword_rank,
      TRY_CAST(Estimated_RPC AS DOUBLE) as estimated_rpc
    FROM t
    WHERE TRIM(QUERY) IS NOT NULL AND TRIM(QUERY) != ''
  `);

  // Aggregate by normalized keyword
  const agg = new Map<string, {
    keyword: string;
    placement: string | null;
    device_category: string | null;
    country_code: string | null;
    keyword_rank: number | null;
    rpc: number | null;
  }>();

  for (const r of rows) {
    const rawKeyword = String(r.query || '').trim();
    if (!rawKeyword) continue;
    const keywordNorm = normalizeWhitespace(rawKeyword);
    const prev = agg.get(keywordNorm);
    const placementVal = r.placement != null && String(r.placement).trim() !== '' ? String(r.placement) : null;
    const deviceCategoryVal = r.device_category != null && String(r.device_category).trim() !== '' ? String(r.device_category) : null;
    const countryCodeVal = r.country_code != null && String(r.country_code).trim() !== '' ? String(r.country_code) : null;
    const keywordRank = r.keyword_rank != null ? Number(r.keyword_rank) : null;
    const estimatedRpc = r.estimated_rpc != null ? Number(r.estimated_rpc) : null;

    if (!prev) {
      agg.set(keywordNorm, {
        keyword: rawKeyword,
        placement: placementVal,
        device_category: deviceCategoryVal,
        country_code: countryCodeVal,
        keyword_rank: keywordRank,
        rpc: estimatedRpc,
      });
    } else {
      // If duplicate normalized keyword, keep the one with better rank (lower number) or higher RPC
      if (keywordRank != null && (prev.keyword_rank == null || keywordRank < prev.keyword_rank)) {
        prev.keyword_rank = keywordRank;
      }
      if (estimatedRpc != null && (prev.rpc == null || estimatedRpc > prev.rpc)) {
        prev.rpc = estimatedRpc;
      }
      if (!prev.placement && placementVal) prev.placement = placementVal;
      if (!prev.device_category && deviceCategoryVal) prev.device_category = deviceCategoryVal;
      if (!prev.country_code && countryCodeVal) prev.country_code = countryCodeVal;
    }
  }

  const out: InterlincxKeywordRow[] = [];
  for (const [keyword_norm, v] of agg.entries()) {
    // Use PLACEMENT as category, DEVICE_CATEGORY as angle (or combine them)
    const category = v.placement || null;
    const angle = v.device_category || null;
    
    out.push({
      keyword: v.keyword,
      keyword_norm,
      angle,
      category,
      searches: null, // Not available in Interlincx report
      clicks: null,  // Not available in Interlincx report
      revenue: null, // Not available in Interlincx report
      rpc: v.rpc,
      rps: null, // Not available in Interlincx report
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

async function cli() {
  const input = getArg('input');
  if (!input) {
    console.error('Usage: ts-node src/scripts/vector/extract_interlincx_keywords.ts --input path/to/interlincx_report.csv');
    process.exit(1);
  }
  const rows = await extractInterlincxKeywords(input);
  console.log(JSON.stringify({ count: rows.length, sample: rows.slice(0, 5) }, null, 2));
}

if (require.main === module) {
  cli().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


