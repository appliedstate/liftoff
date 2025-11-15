import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

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
  const stateCsv = path.resolve(`./runs/system1/${runDate}/state_angle_full.csv`);
  
  if (!fs.existsSync(stateCsv)) {
    console.error(`State CSV not found: ${stateCsv}`);
    process.exit(1);
  }

  // 1. Check revenue by category
  console.log('\n=== Revenue by Category ===');
  const catRev = await queryCsv(stateCsv, `
    SELECT 
      category,
      COUNT(DISTINCT keyword) as keyword_count,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue,
      AVG(CAST(revenue AS DOUBLE)) as avg_revenue_per_keyword,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(revenue AS DOUBLE)) as median_revenue
    FROM t
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY total_revenue DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(catRev.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // 2. Revenue by state for Clinical Trials
  console.log('\n=== Clinical Trials Revenue by State ===');
  const stateRev = await queryCsv(stateCsv, `
    SELECT 
      state,
      COUNT(DISTINCT keyword) as keyword_count,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue,
      SUM(CAST(revenue AS DOUBLE)) / NULLIF(SUM(CAST(clicks AS DOUBLE)), 0) as rpc,
      SUM(CAST(revenue AS DOUBLE)) / NULLIF(SUM(CAST(searches AS DOUBLE)), 0) as rps
    FROM t
    WHERE category = 'Clinical Trials'
    GROUP BY state
    HAVING SUM(CAST(clicks AS DOUBLE)) >= 10
    ORDER BY total_revenue DESC
    LIMIT 20
  `);
  console.log(JSON.stringify(stateRev.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // 3. Dental implant clinical trials by state
  console.log('\n=== Dental Implant Clinical Trials by State ===');
  const dentalStates = await queryCsv(stateCsv, `
    SELECT 
      state,
      COUNT(DISTINCT keyword) as keyword_count,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue,
      SUM(CAST(revenue AS DOUBLE)) / NULLIF(SUM(CAST(clicks AS DOUBLE)), 0) as rpc,
      SUM(CAST(revenue AS DOUBLE)) / NULLIF(SUM(CAST(searches AS DOUBLE)), 0) as rps
    FROM t
    WHERE category = 'Clinical Trials' 
      AND (LOWER(keyword) LIKE '%dental%implant%' OR LOWER(keyword) LIKE '%dental implant%')
    GROUP BY state
    HAVING SUM(CAST(clicks AS DOUBLE)) >= 1
    ORDER BY total_revenue DESC
  `);
  console.log(JSON.stringify(dentalStates.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // 4. Top revenue keywords in Clinical Trials
  console.log('\n=== Top Revenue Keywords in Clinical Trials ===');
  const topKeywords = await queryCsv(stateCsv, `
    SELECT 
      keyword,
      SUM(CAST(searches AS DOUBLE)) as searches,
      SUM(CAST(clicks AS DOUBLE)) as clicks,
      SUM(CAST(revenue AS DOUBLE)) as revenue,
      SUM(CAST(revenue AS DOUBLE)) / NULLIF(SUM(CAST(clicks AS DOUBLE)), 0) as rpc
    FROM t
    WHERE category = 'Clinical Trials'
    GROUP BY keyword
    ORDER BY revenue DESC
    LIMIT 20
  `);
  console.log(JSON.stringify(topKeywords.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
}

main().catch(console.error);

