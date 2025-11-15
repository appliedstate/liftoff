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
  const slug = 'health/factors-influencing-botox-prices-en-us/';
  
  console.log(`\n=== Revenue Completeness Check for: ${slug} ===\n`);

  // 1. Get total revenue from content_slug_ranked
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  const slugTotal = await queryCsv(slugRanked, `
    SELECT 
      CAST(revenue AS DOUBLE) as total_revenue,
      CAST(searches AS DOUBLE) as total_searches,
      CAST(clicks AS DOUBLE) as total_clicks,
      CAST(num_phrases AS INTEGER) as num_keywords
    FROM t
    WHERE LOWER(content_slug) = LOWER('${slug.replace(/'/g, "''")}')
  `);

  console.log('📊 Total from content_slug_ranked.csv:');
  console.log(JSON.stringify(slugTotal.map((r: any) => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // 2. Try to get revenue from source data by CONTENT_SLUG
  const sourceData = path.resolve(`./data/system1/incoming`);
  let sourceTotal: any = null;
  let sourceFiles: string[] = [];
  
  if (fs.existsSync(sourceData)) {
    sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
    if (sourceFiles.length > 0) {
      const latestSource = sourceFiles.sort().reverse()[0];
      const sourcePath = path.join(sourceData, latestSource);
      try {
        sourceTotal = await queryCsv(sourcePath, `
          SELECT 
            CAST(COUNT(DISTINCT SERP_KEYWORD) AS INTEGER) as keyword_count,
            CAST(COUNT(*) AS INTEGER) as row_count,
            SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
            SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue
          FROM t
          WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
        `);
        console.log('\n📊 Total from source data (by CONTENT_SLUG):');
        console.log(JSON.stringify(sourceTotal.map((r: any) => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
      } catch (e: any) {
        console.error(`Error querying source: ${e.message}`);
      }
    }
  }

  // 3. Check state_angle_full - what we're currently using
  const stateAngleFull = path.join(baseDir, 'state_angle_full.csv');
  const stateTotal = await queryCsv(stateAngleFull, `
    SELECT 
      COUNT(DISTINCT keyword) as keyword_count,
      SUM(CAST(searches AS DOUBLE)) as total_searches,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue
    FROM t
    WHERE LOWER(keyword) LIKE '%botox%'
      AND LOWER(keyword) LIKE '%price%'
  `);

  console.log('\n📊 Total from state_angle_full.csv (botox + price filter):');
  console.log(JSON.stringify(stateTotal.map((r: any) => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));

  // 4. Check what keywords this slug actually has
  if (fs.existsSync(sourceData) && sourceFiles.length > 0) {
    const latestSource = sourceFiles.sort().reverse()[0];
    const sourcePath = path.join(sourceData, latestSource);
    try {
      const sampleKeywords = await queryCsv(sourcePath, `
        SELECT DISTINCT SERP_KEYWORD as keyword
        FROM t
        WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
        LIMIT 20
      `);
      console.log('\n📋 Sample keywords for this slug:');
      sampleKeywords.forEach((r: any, i: number) => {
        console.log(`  ${i + 1}. ${r.keyword}`);
      });
    } catch (e) {
      // ignore
    }
  }

  // 5. Compare totals
  const expectedRevenue = Number(slugTotal[0]?.total_revenue || 0);
  const stateRevenue = Number(stateTotal[0]?.total_revenue || 0);
  const sourceRevenue = sourceTotal ? Number(sourceTotal[0]?.total_revenue || 0) : null;
  
  console.log('\n💰 REVENUE COMPARISON:');
  console.log(`Expected (content_slug_ranked): $${expectedRevenue.toFixed(2)}`);
  if (sourceRevenue !== null) {
    console.log(`Source data (by CONTENT_SLUG): $${sourceRevenue.toFixed(2)}`);
  }
  console.log(`State data (botox+price filter): $${stateRevenue.toFixed(2)}`);
  console.log(`\nMissing: $${(expectedRevenue - stateRevenue).toFixed(2)} (${((expectedRevenue - stateRevenue) / expectedRevenue * 100).toFixed(1)}%)`);
  
  console.log('\n⚠️  ISSUE: The state_angle_full query is filtering by keyword pattern ("botox" AND "price"),');
  console.log('   but this slug likely has many more keywords that don\'t match this pattern.');
  console.log('   We need to query by the actual slug-to-keyword mapping from source data.');
}

main().catch(console.error);

