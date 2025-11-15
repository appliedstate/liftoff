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
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Botox-Related Slugs ===\n`);
  
  // Method 1: Check content_slug_ranked for slugs with "botox" in name
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  if (fs.existsSync(slugRanked)) {
    console.log('1. Slugs with "botox" in slug name:');
    const slugNames = await queryCsv(slugRanked, `
      SELECT 
        content_slug,
        CAST(num_phrases AS INTEGER) as num_phrases,
        CAST(searches AS DOUBLE) as searches,
        CAST(clicks AS DOUBLE) as clicks,
        CAST(revenue AS DOUBLE) as revenue,
        CAST(rpc AS DOUBLE) as rpc
      FROM t
      WHERE LOWER(content_slug) LIKE '%botox%'
      ORDER BY CAST(revenue AS DOUBLE) DESC
    `);
    console.log(`Found ${slugNames.length} slugs with "botox" in name:\n`);
    console.log(JSON.stringify(slugNames.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
  }

  // Method 2: Check source data for slugs driving botox keywords
  const sourceData = path.resolve(`./data/system1/incoming`);
  const sourceFiles = fs.existsSync(sourceData) ? fs.readdirSync(sourceData).filter(f => f.endsWith('.csv')) : [];
  if (sourceFiles.length > 0) {
    const latestSource = sourceFiles.sort().reverse()[0];
    const sourcePath = path.join(sourceData, latestSource);
    console.log(`\n2. Slugs driving botox keyword traffic (from source data):`);
    try {
      const slugKeywords = await queryCsv(sourcePath, `
        SELECT 
          CONTENT_SLUG as slug,
          COUNT(DISTINCT SERP_KEYWORD) as keyword_count,
          SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
          SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue
        FROM t
        WHERE LOWER(SERP_KEYWORD) LIKE '%botox%'
        GROUP BY CONTENT_SLUG
        HAVING SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) > 0
        ORDER BY total_revenue DESC
      `);
      console.log(`Found ${slugKeywords.length} unique slugs driving botox keyword traffic:\n`);
      console.log(JSON.stringify(slugKeywords.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
    } catch (e: any) {
      console.log(`Could not query source file: ${e.message}`);
    }
  }
}

main().catch(console.error);

