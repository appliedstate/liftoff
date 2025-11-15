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
  const angleFull = path.resolve(`./runs/system1/${runDate}/angle_full.csv`);
  
  if (!fs.existsSync(angleFull)) {
    console.error(`File not found: ${angleFull}`);
    process.exit(1);
  }

  console.log(`\n=== Top Car Keywords ===\n`);
  
  // By Revenue
  console.log('Top 10 by Revenue:');
  const byRevenue = await queryCsv(angleFull, `
    SELECT 
      keyword,
      category,
      angle,
      CAST(searches AS DOUBLE) as searches,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue,
      CAST(rpc AS DOUBLE) as rpc,
      CAST(rps AS DOUBLE) as rps
    FROM t
    WHERE (LOWER(keyword) LIKE '%car%' 
       OR LOWER(keyword) LIKE '%vehicle%'
       OR LOWER(keyword) LIKE '%auto%'
       OR LOWER(keyword) LIKE '%automobile%')
      AND CAST(clicks AS DOUBLE) >= 1
    ORDER BY CAST(revenue AS DOUBLE) DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(byRevenue.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // By RPC (min 10 clicks)
  console.log('\n\nTop 10 by RPC (min 10 clicks):');
  const byRPC = await queryCsv(angleFull, `
    SELECT 
      keyword,
      category,
      angle,
      CAST(searches AS DOUBLE) as searches,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue,
      CAST(rpc AS DOUBLE) as rpc,
      CAST(rps AS DOUBLE) as rps
    FROM t
    WHERE (LOWER(keyword) LIKE '%car%' 
       OR LOWER(keyword) LIKE '%vehicle%'
       OR LOWER(keyword) LIKE '%auto%'
       OR LOWER(keyword) LIKE '%automobile%')
      AND CAST(clicks AS DOUBLE) >= 10
      AND CAST(rpc AS DOUBLE) IS NOT NULL
    ORDER BY CAST(rpc AS DOUBLE) DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(byRPC.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // By Searches
  console.log('\n\nTop 10 by Searches:');
  const bySearches = await queryCsv(angleFull, `
    SELECT 
      keyword,
      category,
      angle,
      CAST(searches AS DOUBLE) as searches,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue,
      CAST(rpc AS DOUBLE) as rpc,
      CAST(rps AS DOUBLE) as rps
    FROM t
    WHERE (LOWER(keyword) LIKE '%car%' 
       OR LOWER(keyword) LIKE '%vehicle%'
       OR LOWER(keyword) LIKE '%auto%'
       OR LOWER(keyword) LIKE '%automobile%')
      AND CAST(searches AS DOUBLE) >= 1
    ORDER BY CAST(searches AS DOUBLE) DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(bySearches.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
}

main().catch(console.error);

