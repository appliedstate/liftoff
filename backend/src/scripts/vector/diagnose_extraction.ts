import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';
import { extractKeywords } from './extract_keywords';

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

async function main() {
  const runDate = process.argv[2] || '2025-11-06';
  const angleFull = path.resolve(`./runs/system1/${runDate}/angle_full.csv`);
  
  if (!fs.existsSync(angleFull)) {
    console.error(`File not found: ${angleFull}`);
    process.exit(1);
  }

  console.log('\n=== Extraction Diagnosis ===\n');

  // 1. Raw CSV stats
  const rawStats = await queryCsv(angleFull, `
    SELECT 
      COUNT(*) as total_rows,
      COUNT(DISTINCT LOWER(TRIM(REGEXP_REPLACE(keyword, '\\s+', ' ', 'g')))) as unique_normalized_keywords,
      SUM(CAST(searches AS DOUBLE)) as total_searches,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue
    FROM t
  `);

  // 2. Check for null/empty keywords
  const nullKeywords = await queryCsv(angleFull, `
    SELECT COUNT(*) as count
    FROM t
    WHERE keyword IS NULL OR TRIM(keyword) = ''
  `);

  // 3. Check for rows with invalid revenue
  const invalidRevenue = await queryCsv(angleFull, `
    SELECT COUNT(*) as count
    FROM t
    WHERE revenue IS NULL OR revenue = '' OR CAST(revenue AS DOUBLE) IS NULL
  `);

  // 4. Extract using our function
  console.log('Extracting keywords using extractKeywords()...');
  const extracted = await extractKeywords(angleFull);
  const extractedRevenue = extracted.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const extractedSearches = extracted.reduce((sum, r) => sum + (r.searches || 0), 0);
  const extractedClicks = extracted.reduce((sum, r) => sum + (r.clicks || 0), 0);

  console.log('\n📊 RAW CSV STATS:');
  console.log(JSON.stringify({
    total_rows: Number(rawStats[0].total_rows),
    unique_normalized_keywords: Number(rawStats[0].unique_normalized_keywords),
    total_searches: Number(rawStats[0].total_searches),
    total_clicks: Number(rawStats[0].total_clicks),
    total_revenue: Number(rawStats[0].total_revenue),
    null_keywords: Number(nullKeywords[0].count),
    invalid_revenue: Number(invalidRevenue[0].count)
  }, null, 2));

  console.log('\n📊 EXTRACTED KEYWORDS:');
  console.log(JSON.stringify({
    count: extracted.length,
    total_searches: extractedSearches,
    total_clicks: extractedClicks,
    total_revenue: extractedRevenue
  }, null, 2));

  const csvRevenue = Number(rawStats[0].total_revenue);
  const diff = csvRevenue - extractedRevenue;
  const pctDiff = ((diff / csvRevenue) * 100).toFixed(2);

  console.log('\n💰 REVENUE COMPARISON:');
  console.log(`CSV Total:      $${csvRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Extracted:      $${extractedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Missing:        $${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pctDiff}%)`);

  // 5. Sample some rows that might be getting lost
  const sampleRows = await queryCsv(angleFull, `
    SELECT keyword, searches, clicks, revenue
    FROM t
    WHERE keyword IS NOT NULL AND TRIM(keyword) != ''
      AND (revenue IS NULL OR revenue = '' OR CAST(revenue AS DOUBLE) = 0)
    LIMIT 10
  `);

  console.log('\n📋 SAMPLE ROWS WITH ZERO/NULL REVENUE:');
  console.log(JSON.stringify(sampleRows, null, 2));
}

main().catch(console.error);

