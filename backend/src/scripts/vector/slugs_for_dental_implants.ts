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
  
  // Check if we have the original source data with slugs
  const sourceData = path.resolve(`./data/system1/incoming`);
  const sourceFiles = fs.existsSync(sourceData) ? fs.readdirSync(sourceData).filter(f => f.endsWith('.csv')) : [];
  
  console.log(`\n=== Looking for slugs driving dental implant clinical trials ===\n`);
  
  // Method 1: Check content_slug_ranked for dental implant related slugs
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  if (fs.existsSync(slugRanked)) {
    console.log('Checking content_slug_ranked.csv for dental implant slugs...');
    const dentalSlugs = await queryCsv(slugRanked, `
      SELECT 
        content_slug,
        num_phrases,
        searches,
        clicks,
        revenue,
        rpc,
        rps
      FROM t
      WHERE LOWER(content_slug) LIKE '%dental%implant%'
         OR LOWER(content_slug) LIKE '%dental-implant%'
      ORDER BY revenue DESC
      LIMIT 50
    `);
    console.log(`Found ${dentalSlugs.length} slugs with "dental implant" in name:\n`);
    console.log(JSON.stringify(dentalSlugs.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
  }

  // Method 2: Check if we can find slugs from the original source data
  if (sourceFiles.length > 0) {
    console.log(`\n=== Checking source data files ===`);
    const latestSource = sourceFiles.sort().reverse()[0];
    const sourcePath = path.join(sourceData, latestSource);
    console.log(`Using source file: ${latestSource}`);
    
    try {
      const slugKeywordData = await queryCsv(sourcePath, `
        SELECT 
          CONTENT_SLUG as slug,
          COUNT(DISTINCT SERP_KEYWORD) as keyword_count,
          SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
          SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue
        FROM t
        WHERE (LOWER(SERP_KEYWORD) LIKE '%dental%implant%' 
           AND (LOWER(SERP_KEYWORD) LIKE '%clinical%trial%' OR LOWER(SERP_KEYWORD) LIKE '%trial%'))
           OR (LOWER(CONTENT_SLUG) LIKE '%dental%implant%' 
           AND (LOWER(CONTENT_SLUG) LIKE '%clinical%trial%' OR LOWER(CONTENT_SLUG) LIKE '%trial%'))
        GROUP BY CONTENT_SLUG
        HAVING SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) > 0
        ORDER BY total_revenue DESC
        LIMIT 50
      `);
      console.log(`\nFound ${slugKeywordData.length} slugs driving dental implant clinical trials traffic:\n`);
      console.log(JSON.stringify(slugKeywordData.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
    } catch (e: any) {
      console.log(`Could not query source file (may have different column names): ${e.message}`);
    }
  }

  // Method 3: Check state_angle_full for slugs if they're in there
  const stateAngle = path.join(baseDir, 'state_angle_full.csv');
  if (fs.existsSync(stateAngle)) {
    console.log(`\n=== Checking state_angle_full.csv structure ===`);
    const sample = await queryCsv(stateAngle, `SELECT * FROM t LIMIT 1`);
    const cols = Object.keys(sample[0] || {});
    console.log(`Columns: ${cols.join(', ')}`);
    
    if (cols.includes('slug') || cols.includes('content_slug')) {
      const slugCol = cols.includes('slug') ? 'slug' : 'content_slug';
      const dentalSlugs = await queryCsv(stateAngle, `
        SELECT 
          ${slugCol} as slug,
          state,
          COUNT(DISTINCT keyword) as keyword_count,
          SUM(CAST(clicks AS DOUBLE)) as total_clicks,
          SUM(CAST(revenue AS DOUBLE)) as total_revenue
        FROM t
        WHERE category = 'Clinical Trials'
          AND (LOWER(keyword) LIKE '%dental%implant%' OR LOWER(${slugCol}) LIKE '%dental%implant%')
        GROUP BY ${slugCol}, state
        ORDER BY total_revenue DESC
        LIMIT 50
      `);
      console.log(`\nFound ${dentalSlugs.length} slug-state combinations:\n`);
      console.log(JSON.stringify(dentalSlugs.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
    }
  }
}

main().catch(console.error);

