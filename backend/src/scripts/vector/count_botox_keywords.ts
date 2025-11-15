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

  console.log(`\n=== Botox Keyword Count ===\n`);
  
  const count = await queryCsv(angleFull, `
    SELECT 
      COUNT(*) as total_keywords,
      SUM(CAST(searches AS DOUBLE)) as total_searches,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue
    FROM t
    WHERE LOWER(keyword) LIKE '%botox%'
  `);
  
  console.log(JSON.stringify(count.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
}

main().catch(console.error);

