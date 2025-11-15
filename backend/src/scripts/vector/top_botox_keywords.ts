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

  console.log(`\n=== Top 10 Botox Keywords by Revenue ===\n`);
  
  const topKeywords = await queryCsv(angleFull, `
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
    WHERE LOWER(keyword) LIKE '%botox%'
      AND CAST(revenue AS DOUBLE) > 0
    ORDER BY CAST(revenue AS DOUBLE) DESC
    LIMIT 10
  `);
  
  console.log(JSON.stringify(topKeywords.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
}

main().catch(console.error);

