import fs from 'fs';
import path from 'path';
import DuckDB from 'duckdb';

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
  const db = new DuckDB.Database(':memory:');
  const conn = db.connect();
  
  return new Promise((resolve, reject) => {
    const escaped = csvPath.replace(/'/g, "''");
    conn.all(`
      CREATE TABLE t AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true, delim=',', quote='"');
    `, (err: any) => {
      if (err) {
        conn.close();
        db.close();
        reject(err);
        return;
      }
      
      conn.all(sql, (err2: any, rows: any[]) => {
        conn.close();
        db.close();
        if (err2) {
          reject(err2);
        } else {
          resolve(rows || []);
        }
      });
    });
  });
}

async function main() {
  const slugs = process.argv.slice(2);
  
  if (slugs.length === 0) {
    console.error('Usage: npx ts-node src/scripts/system1/state_analysis_for_slug_cluster.ts "<slug1>" "<slug2>" ...');
    console.error('Example: npx ts-node src/scripts/system1/state_analysis_for_slug_cluster.ts "health/slug1/" "health/slug2/"');
    process.exit(1);
  }
  
  console.log(`\n=== State Analysis for Slug Cluster ===\n`);
  console.log(`Analyzing ${slugs.length} slug(s):\n`);
  slugs.forEach((slug, idx) => console.log(`  ${idx + 1}. ${slug}`));
  console.log();
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Detect column names
  const sample = await queryCsv(csvPath, `SELECT * FROM t LIMIT 1`);
  const columns = Object.keys(sample[0] || {});
  
  const stateCol = columns.find(c => 
    c.toLowerCase().includes('region') || 
    c.toLowerCase().includes('state') ||
    c.toLowerCase() === 'state_code'
  ) || 'REGION_CODE';
  
  const slugCol = columns.find(c => 
    c.toLowerCase().includes('slug') || 
    c.toLowerCase().includes('content')
  ) || 'CONTENT_SLUG';
  
  const revenueCol = columns.find(c => 
    c.toLowerCase().includes('revenue') || 
    c.toLowerCase().includes('net_revenue')
  ) || 'EST_NET_REVENUE';
  
  const clicksCol = columns.find(c => 
    c.toLowerCase().includes('click') && 
    c.toLowerCase().includes('network')
  ) || 'SELLSIDE_CLICKS_NETWORK';
  
  const searchesCol = columns.find(c => 
    c.toLowerCase().includes('search') && 
    c.toLowerCase().includes('sellside')
  ) || 'SELLSIDE_SEARCHES';
  
  const keywordCol = columns.find(c => 
    c.toLowerCase().includes('keyword') || 
    c.toLowerCase().includes('serp')
  ) || 'SERP_KEYWORD';
  
  // Normalize slugs (try with and without trailing slash)
  const normalizedSlugs = slugs.flatMap(slug => [
    slug.trim(),
    slug.trim() + '/',
    slug.trim().replace(/\/$/, ''),
  ]);
  
  // Build slug conditions
  const slugConditions = normalizedSlugs.map(s => {
    const escaped = s.replace(/'/g, "''");
    return `(LOWER(TRIM("${slugCol}")) = LOWER('${escaped}') OR LOWER(TRIM("${slugCol}")) = LOWER('${escaped}/'))`;
  }).join(' OR ');
  
  // Query state-level data for all slugs
  const stateData = await queryCsv(csvPath, `
    SELECT 
      TRIM("${slugCol}") as slug,
      "${stateCol}" as state,
      SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks,
      SUM(TRY_CAST(REPLACE(COALESCE("${searchesCol}", ''), ',', '') AS DOUBLE)) as searches,
      COUNT(DISTINCT TRIM("${keywordCol}")) as keyword_count
    FROM t
    WHERE (${slugConditions})
      AND "${stateCol}" IS NOT NULL
      AND "${stateCol}" != 'None'
      AND TRIM("${stateCol}") != ''
      AND LENGTH(TRIM("${stateCol}")) = 2
      AND TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug, state
    HAVING clicks > 0
    ORDER BY slug, revenue DESC
  `);
  
  if (stateData.length === 0) {
    console.log(`❌ No state-level data found for the specified slugs\n`);
    process.exit(1);
  }
  
  // Process and calculate RPC/RPS
  const results = stateData.map((row: any) => {
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    return {
      slug: String(row.slug || '').trim(),
      state: String(row.state || '').trim(),
      revenue,
      clicks,
      searches,
      keyword_count: Number(row.keyword_count || 0),
      rpc,
      rps,
    };
  });
  
  // Group by slug and aggregate totals
  const slugTotals = new Map<string, {
    slug: string;
    total_revenue: number;
    total_clicks: number;
    total_searches: number;
    total_keywords: number;
    states: Array<typeof results[0]>;
  }>();
  
  results.forEach(row => {
    if (!slugTotals.has(row.slug)) {
      slugTotals.set(row.slug, {
        slug: row.slug,
        total_revenue: 0,
        total_clicks: 0,
        total_searches: 0,
        total_keywords: 0,
        states: [],
      });
    }
    
    const slugData = slugTotals.get(row.slug)!;
    slugData.total_revenue += row.revenue;
    slugData.total_clicks += row.clicks;
    slugData.total_searches += row.searches;
    slugData.total_keywords = Math.max(slugData.total_keywords, row.keyword_count);
    slugData.states.push(row);
  });
  
  // Sort slugs by total revenue
  const sortedSlugs = Array.from(slugTotals.values()).sort((a, b) => b.total_revenue - a.total_revenue);
  
  // Display summary by slug
  console.log(`📊 SUMMARY BY SLUG:\n`);
  console.log('Rank | Slug | Revenue | RPC | RPS | Clicks | Searches | Keywords | States');
  console.log('-----|------|---------|-----|-----|--------|----------|----------|-------');
  
  sortedSlugs.forEach((slugData, idx) => {
    const avgRPC = slugData.total_clicks > 0 ? slugData.total_revenue / slugData.total_clicks : 0;
    const avgRPS = slugData.total_searches > 0 ? slugData.total_revenue / slugData.total_searches : 0;
    const slugDisplay = slugData.slug.length > 50 ? slugData.slug.substring(0, 47) + '...' : slugData.slug;
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${slugDisplay.padEnd(50)} | $${slugData.total_revenue.toFixed(2).padStart(7)} | $${avgRPC.toFixed(4)} | $${avgRPS.toFixed(4)} | ${slugData.total_clicks.toFixed(0).padStart(6)} | ${slugData.total_searches.toFixed(0).padStart(8)} | ${slugData.total_keywords.toString().padStart(9)} | ${slugData.states.length.toString().padStart(6)}`
    );
  });
  
  // Display detailed state breakdown
  console.log(`\n\n📋 DETAILED STATE BREAKDOWN:\n`);
  
  sortedSlugs.forEach((slugData, slugIdx) => {
    console.log(`\n${slugIdx + 1}. ${slugData.slug}\n`);
    console.log('Rank | State | Revenue | RPC | RPS | Clicks | Searches | Keywords');
    console.log('-----|-------|---------|-----|-----|--------|----------|----------');
    
    const sortedStates = slugData.states.sort((a, b) => b.revenue - a.revenue);
    
    sortedStates.forEach((state, stateIdx) => {
      console.log(
        `${(stateIdx + 1).toString().padStart(4)} | ${state.state.padEnd(5)} | $${state.revenue.toFixed(2).padStart(7)} | $${state.rpc.toFixed(4)} | $${state.rps.toFixed(4)} | ${state.clicks.toFixed(0).padStart(6)} | ${state.searches.toFixed(0).padStart(8)} | ${state.keyword_count.toString().padStart(9)}`
      );
    });
    
    const avgRPC = slugData.total_clicks > 0 ? slugData.total_revenue / slugData.total_clicks : 0;
    const avgRPS = slugData.total_searches > 0 ? slugData.total_revenue / slugData.total_searches : 0;
    console.log(`\n  Total: $${slugData.total_revenue.toFixed(2)} | Avg RPC: $${avgRPC.toFixed(4)} | Avg RPS: $${avgRPS.toFixed(4)} | ${slugData.total_clicks.toFixed(0)} clicks | ${slugData.total_searches.toFixed(0)} searches | ${slugData.states.length} states`);
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const csvPath_out = path.join(outputDir, `depression_cluster_state_analysis_${timestamp}.csv`);
  
  // Flatten for CSV export
  const csvRows = [
    ['rank', 'slug', 'state', 'revenue', 'rpc', 'rps', 'clicks', 'searches', 'keywords'].join(','),
    ...results.map((r, idx) => [
      (idx + 1).toString(),
      `"${r.slug.replace(/"/g, '""')}"`,
      r.state,
      r.revenue.toFixed(2),
      r.rpc.toFixed(4),
      r.rps.toFixed(4),
      r.clicks.toFixed(0),
      r.searches.toFixed(0),
      r.keyword_count.toString(),
    ].join(','))
  ];
  
  fs.writeFileSync(csvPath_out, csvRows.join('\n'));
  
  console.log(`\n✅ Results exported to: ${csvPath_out}\n`);
}

main().catch((err) => {
  console.error('state_analysis_for_slug_cluster failed', err);
  process.exit(1);
});



