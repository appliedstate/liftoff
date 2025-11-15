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
  
  console.log(`\n=== RPS by State for: ${slug} ===\n`);

  // Check state_angle_full.csv for state-level data
  const stateAngleFull = path.join(baseDir, 'state_angle_full.csv');
  if (!fs.existsSync(stateAngleFull)) {
    console.error(`File not found: ${stateAngleFull}`);
    process.exit(1);
  }

  // Query source data directly for state-level metrics for this slug
  // This is the correct approach - query by CONTENT_SLUG, not by keyword patterns
  const sourceData = path.resolve(`./data/system1/incoming`);
  let results: any[] = [];
  
  if (fs.existsSync(sourceData)) {
    const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
    if (sourceFiles.length > 0) {
      const latestSource = sourceFiles.sort().reverse()[0];
      const sourcePath = path.join(sourceData, latestSource);
      try {
        results = await queryCsv(sourcePath, `
          SELECT 
            STATE as state,
            CAST(COUNT(DISTINCT SERP_KEYWORD) AS INTEGER) as keyword_count,
            CAST(COUNT(*) AS INTEGER) as search_count,
            SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
            SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue
          FROM t
          WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
          GROUP BY STATE
          HAVING SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) > 0
          ORDER BY total_revenue DESC
        `);
      } catch (e: any) {
        console.error(`Error querying source: ${e.message}`);
      }
    }
  }
  
  // Fallback: If source data not available, get keywords from source and query state_angle_full
  if (results.length === 0 && fs.existsSync(sourceData)) {
    const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
    if (sourceFiles.length > 0) {
      const latestSource = sourceFiles.sort().reverse()[0];
      const sourcePath = path.join(sourceData, latestSource);
      try {
        // Get all keywords for this slug
        const keywords = await queryCsv(sourcePath, `
          SELECT DISTINCT SERP_KEYWORD as keyword
          FROM t
          WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
        `);
        
        if (keywords.length > 0) {
          // Build IN clause with escaped keywords
          const keywordList = keywords.map((r: any) => `'${String(r.keyword || '').replace(/'/g, "''")}'`).join(',');
          
          results = await queryCsv(stateAngleFull, `
            SELECT 
              state,
              CAST(COUNT(DISTINCT keyword) AS INTEGER) as keyword_count,
              SUM(CAST(searches AS DOUBLE)) as searches,
              SUM(CAST(clicks AS DOUBLE)) as clicks,
              SUM(CAST(revenue AS DOUBLE)) as revenue
            FROM t
            WHERE keyword IN (${keywordList})
            GROUP BY state
            HAVING SUM(CAST(revenue AS DOUBLE)) > 0
            ORDER BY SUM(CAST(revenue AS DOUBLE)) DESC
          `);
        }
      } catch (e: any) {
        console.error(`Error with fallback query: ${e.message}`);
      }
    }
  }

  if (results.length === 0) {
    // Try checking what columns exist
    const sample = await queryCsv(stateAngleFull, `
      SELECT * FROM t LIMIT 1
    `);
    console.log('Available columns:', Object.keys(sample[0] || {}));
    
    // Try alternative query - maybe slug is in a different format
    const altResults = await queryCsv(stateAngleFull, `
      SELECT 
        state,
        CAST(searches AS DOUBLE) as searches,
        CAST(clicks AS DOUBLE) as clicks,
        CAST(revenue AS DOUBLE) as revenue
      FROM t
      WHERE LOWER(content_slug) LIKE '%botox%'
         OR LOWER(slug) LIKE '%botox%'
         OR LOWER(keyword) LIKE '%botox%'
      LIMIT 5
    `);
    console.log('\nSample botox-related rows:', altResults);
    
    // Try searching by keyword that matches this slug's keywords
    const keywordResults = await queryCsv(stateAngleFull, `
      SELECT DISTINCT state
      FROM t
      WHERE LOWER(keyword) LIKE '%botox%'
      LIMIT 10
    `);
    console.log('\nStates with botox keywords:', keywordResults);
  }

  if (results.length > 0) {
    // Format results - handle both source data and state_angle_full formats
    const formatted = results.map((r: any) => {
      const searches = Number(r.searches || r.search_count || 0);
      const clicks = Number(r.clicks || r.total_clicks || 0);
      const revenue = Number(r.revenue || r.total_revenue || 0);
      const rps = searches > 0 ? revenue / searches : 0;
      const rpc = clicks > 0 ? revenue / clicks : 0;
      return {
        state: r.state,
        keywords: Number(r.keyword_count || 0),
        searches,
        clicks,
        revenue,
        rps,
        rpc
      };
    });
    
    console.log(`Found ${formatted.length} states:\n`);
    console.log(JSON.stringify(formatted, null, 2));

    // Sort by RPC descending for better visibility
    formatted.sort((a, b) => b.rpc - a.rpc);
    
    // Table format - sorted by RPC
    console.log('\n📊 ALL STATES - SORTED BY RPC:\n');
    if (formatted[0] && formatted[0].keywords > 0) {
      console.log('State | Keywords | Searches | Clicks | Revenue | RPS | RPC');
      console.log('------|----------|----------|--------|---------|-----|-----');
      formatted.forEach((r: any) => {
        const state = (r.state || 'N/A').padEnd(5);
        const keywords = r.keywords.toString().padStart(8);
        const searches = r.searches.toFixed(0).padStart(8);
        const clicks = r.clicks.toFixed(1).padStart(6);
        const revenue = r.revenue.toFixed(2).padStart(7);
        const rps = r.rps.toFixed(3).padStart(5);
        const rpc = r.rpc.toFixed(3).padStart(5);
        console.log(`${state} | ${keywords} | ${searches} | ${clicks} | $${revenue} | ${rps} | ${rpc}`);
      });
    } else {
      console.log('State | Searches | Clicks | Revenue | RPS | RPC');
      console.log('------|----------|--------|---------|-----|-----');
      formatted.forEach((r: any) => {
        const state = (r.state || 'N/A').padEnd(5);
        const searches = r.searches.toFixed(0).padStart(8);
        const clicks = r.clicks.toFixed(1).padStart(6);
        const revenue = r.revenue.toFixed(2).padStart(7);
        const rps = r.rps.toFixed(3).padStart(5);
        const rpc = r.rpc.toFixed(3).padStart(5);
        console.log(`${state} | ${searches} | ${clicks} | $${revenue} | ${rps} | ${rpc}`);
      });
    }
    
    // Also show sorted by revenue for reference
    formatted.sort((a, b) => b.revenue - a.revenue);
    console.log('\n📊 ALL STATES - SORTED BY REVENUE:\n');
    if (formatted[0] && formatted[0].keywords > 0) {
      console.log('State | Keywords | Searches | Clicks | Revenue | RPS | RPC');
      console.log('------|----------|----------|--------|---------|-----|-----');
      formatted.forEach((r: any) => {
        const state = (r.state || 'N/A').padEnd(5);
        const keywords = r.keywords.toString().padStart(8);
        const searches = r.searches.toFixed(0).padStart(8);
        const clicks = r.clicks.toFixed(1).padStart(6);
        const revenue = r.revenue.toFixed(2).padStart(7);
        const rps = r.rps.toFixed(3).padStart(5);
        const rpc = r.rpc.toFixed(3).padStart(5);
        console.log(`${state} | ${keywords} | ${searches} | ${clicks} | $${revenue} | ${rps} | ${rpc}`);
      });
    }

    // Summary
    const totalSearches = formatted.reduce((sum, r) => sum + r.searches, 0);
    const totalClicks = formatted.reduce((sum, r) => sum + r.clicks, 0);
    const totalRevenue = formatted.reduce((sum, r) => sum + r.revenue, 0);
    const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
    const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;

    console.log('\n📈 SUMMARY:');
    console.log(`Total States: ${results.length}`);
    console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
    console.log(`Total Clicks: ${totalClicks.toFixed(1)}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Average RPS: $${avgRPS.toFixed(3)}`);
    console.log(`Average RPC: $${avgRPC.toFixed(3)}`);
  } else {
    console.log('No state-level data found for this slug. Checking source data...');
    
    // Try source data
    const sourceData = path.resolve(`./data/system1/incoming`);
    if (fs.existsSync(sourceData)) {
      const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
      if (sourceFiles.length > 0) {
        const latestSource = sourceFiles.sort().reverse()[0];
        const sourcePath = path.join(sourceData, latestSource);
        try {
          const sourceResults = await queryCsv(sourcePath, `
            SELECT 
              STATE as state,
              COUNT(DISTINCT SERP_KEYWORD) as keyword_count,
              SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
              SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue,
              COUNT(*) as search_count
            FROM t
            WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
              AND LOWER(SERP_KEYWORD) LIKE '%botox%'
            GROUP BY STATE
            HAVING SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) > 0
            ORDER BY SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) DESC
          `);
          
          if (sourceResults.length > 0) {
            console.log(`\nFound ${sourceResults.length} states from source data:\n`);
            const formatted = sourceResults.map((r: any) => {
              const searches = Number(r.search_count) || 0;
              const clicks = Number(r.total_clicks) || 0;
              const revenue = Number(r.total_revenue) || 0;
              return {
                state: r.state,
                keywords: Number(r.keyword_count) || 0,
                searches,
                clicks,
                revenue,
                rps: searches > 0 ? revenue / searches : 0,
                rpc: clicks > 0 ? revenue / clicks : 0
              };
            });
            
            console.log(JSON.stringify(formatted, null, 2));
            
            // Table format
            console.log('\n📊 TABLE FORMAT:\n');
            console.log('State | Keywords | Searches | Clicks | Revenue | RPS | RPC');
            console.log('------|----------|----------|--------|---------|-----|-----');
            formatted.forEach((r: any) => {
              const state = String(r.state || '').padEnd(5);
              const keywords = r.keywords.toString().padStart(8);
              const searches = r.searches.toFixed(0).padStart(8);
              const clicks = r.clicks.toFixed(1).padStart(6);
              const revenue = r.revenue.toFixed(2).padStart(7);
              const rps = r.rps.toFixed(3).padStart(5);
              const rpc = r.rpc.toFixed(3).padStart(5);
              console.log(`${state} | ${keywords} | ${searches} | ${clicks} | $${revenue} | ${rps} | ${rpc}`);
            });
          }
        } catch (e: any) {
          console.error(`Error querying source: ${e.message}`);
        }
      }
    }
  }
}

main().catch(console.error);

