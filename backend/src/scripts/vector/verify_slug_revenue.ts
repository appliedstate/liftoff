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
  
  console.log(`\n=== Revenue Verification for: ${slug} ===\n`);

  // 1. Get total from content_slug_ranked (authoritative source)
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

  const expectedRevenue = Number(slugTotal[0]?.total_revenue || 0);
  const expectedSearches = Number(slugTotal[0]?.total_searches || 0);
  const expectedClicks = Number(slugTotal[0]?.total_clicks || 0);
  const expectedKeywords = Number(slugTotal[0]?.num_keywords || 0);

  console.log('📊 Expected Totals (from content_slug_ranked.csv):');
  console.log(`  Revenue:  $${expectedRevenue.toFixed(2)}`);
  console.log(`  Searches: ${expectedSearches.toFixed(0)}`);
  console.log(`  Clicks:   ${expectedClicks.toFixed(1)}`);
  console.log(`  Keywords: ${expectedKeywords}`);

  // 2. Get total from source data (by CONTENT_SLUG)
  const sourceData = path.resolve(`./data/system1/incoming`);
  let sourceTotal: any = null;
  
  if (fs.existsSync(sourceData)) {
    const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
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
        
        const sourceRevenue = Number(sourceTotal[0]?.total_revenue || 0);
        const sourceClicks = Number(sourceTotal[0]?.total_clicks || 0);
        const sourceKeywords = Number(sourceTotal[0]?.keyword_count || 0);
        const sourceRows = Number(sourceTotal[0]?.row_count || 0);
        
        console.log('\n📊 Source Data Totals (by CONTENT_SLUG):');
        console.log(`  Revenue:  $${sourceRevenue.toFixed(2)}`);
        console.log(`  Clicks:   ${sourceClicks.toFixed(1)}`);
        console.log(`  Keywords: ${sourceKeywords}`);
        console.log(`  Rows:     ${sourceRows}`);
        
        console.log('\n💰 Source vs Expected:');
        console.log(`  Revenue diff:  $${(sourceRevenue - expectedRevenue).toFixed(2)} (${((sourceRevenue - expectedRevenue) / expectedRevenue * 100).toFixed(1)}%)`);
        console.log(`  Clicks diff:   ${(sourceClicks - expectedClicks).toFixed(1)} (${((sourceClicks - expectedClicks) / expectedClicks * 100).toFixed(1)}%)`);
      } catch (e: any) {
        console.error(`Error querying source: ${e.message}`);
      }
    }
  }

  // 3. Get state-level totals (what we're using in the report)
  const stateAngleFull = path.join(baseDir, 'state_angle_full.csv');
  
  // Get keywords for this slug from source
  let keywords: string[] = [];
  if (fs.existsSync(sourceData)) {
    const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
    if (sourceFiles.length > 0) {
      const latestSource = sourceFiles.sort().reverse()[0];
      const sourcePath = path.join(sourceData, latestSource);
      try {
        const keywordRows = await queryCsv(sourcePath, `
          SELECT DISTINCT SERP_KEYWORD as keyword
          FROM t
          WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
        `);
        keywords = keywordRows.map((r: any) => String(r.keyword || '').trim()).filter(k => k);
      } catch (e) {
        // ignore
      }
    }
  }

  if (keywords.length > 0) {
    const keywordList = keywords.map((k: string) => `'${k.replace(/'/g, "''")}'`).join(',');
    const stateTotal = await queryCsv(stateAngleFull, `
      SELECT 
        COUNT(DISTINCT state) as state_count,
        COUNT(DISTINCT keyword) as keyword_count,
        SUM(CAST(searches AS DOUBLE)) as total_searches,
        SUM(CAST(clicks AS DOUBLE)) as total_clicks,
        SUM(CAST(revenue AS DOUBLE)) as total_revenue
      FROM t
      WHERE keyword IN (${keywordList})
    `);

    const stateRevenue = Number(stateTotal[0]?.total_revenue || 0);
    const stateSearches = Number(stateTotal[0]?.total_searches || 0);
    const stateClicks = Number(stateTotal[0]?.total_clicks || 0);
    const stateKeywords = Number(stateTotal[0]?.keyword_count || 0);
    const stateCount = Number(stateTotal[0]?.state_count || 0);

    console.log('\n📊 State-Level Totals (from state_angle_full.csv):');
    console.log(`  Revenue:  $${stateRevenue.toFixed(2)}`);
    console.log(`  Searches: ${stateSearches.toFixed(0)}`);
    console.log(`  Clicks:   ${stateClicks.toFixed(1)}`);
    console.log(`  Keywords: ${stateKeywords}`);
    console.log(`  States:   ${stateCount}`);

    console.log('\n💰 State vs Expected:');
    console.log(`  Revenue diff:  $${(stateRevenue - expectedRevenue).toFixed(2)} (${((stateRevenue - expectedRevenue) / expectedRevenue * 100).toFixed(1)}%)`);
    console.log(`  Searches diff: ${(stateSearches - expectedSearches).toFixed(0)} (${((stateSearches - expectedSearches) / expectedSearches * 100).toFixed(1)}%)`);
    console.log(`  Clicks diff:   ${(stateClicks - expectedClicks).toFixed(1)} (${((stateClicks - expectedClicks) / expectedClicks * 100).toFixed(1)}%)`);

    if (Math.abs(stateRevenue - expectedRevenue) < 1.0) {
      console.log('\n✅ Revenue matches! (within $1.00)');
    } else if (stateRevenue > expectedRevenue) {
      console.log(`\n⚠️  State revenue is HIGHER than expected. Possible reasons:`);
      console.log(`   - State data may include additional breakdowns`);
      console.log(`   - Aggregation differences between files`);
      console.log(`   - State data might be more granular`);
    } else {
      console.log(`\n⚠️  State revenue is LOWER than expected. Missing: $${(expectedRevenue - stateRevenue).toFixed(2)}`);
      console.log(`   - Some keywords may not have state-level data`);
      console.log(`   - Some revenue may be aggregated without state breakdown`);
    }
  }
}

main().catch(console.error);

