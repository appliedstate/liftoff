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
  const slug = process.argv[2];
  
  if (!slug) {
    console.error('Usage: npx ts-node src/scripts/system1/rpc_by_state_for_slug.ts "<slug>"');
    console.error('Example: npx ts-node src/scripts/system1/rpc_by_state_for_slug.ts "personal-finance/best-checking-accounts-that-offer-cash-bonuses/"');
    process.exit(1);
  }
  
  console.log(`\n=== RPC by State for Slug ===\n`);
  console.log(`Slug: "${slug}"\n`);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // First, detect column names
  const sample = await queryCsv(csvPath, `SELECT * FROM t LIMIT 1`);
  const columns = Object.keys(sample[0] || {});
  
  // Find columns
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
  
  console.log(`Detected columns:`);
  console.log(`  State: ${stateCol}`);
  console.log(`  Slug: ${slugCol}`);
  console.log(`  Revenue: ${revenueCol}`);
  console.log(`  Clicks: ${clicksCol}`);
  console.log(`  Searches: ${searchesCol}\n`);
  
  // Normalize slug (try with and without trailing slash)
  const normalizedSlugs = [
    slug.trim(),
    slug.trim() + '/',
    slug.trim().replace(/\/$/, ''),
  ];
  
  // Query RPC by state for the slug
  const slugConditions = normalizedSlugs.map(s => {
    const escaped = s.replace(/'/g, "''");
    return `(LOWER(TRIM("${slugCol}")) = LOWER('${escaped}') OR LOWER(TRIM("${slugCol}")) = LOWER('${escaped}/'))`;
  }).join(' OR ');
  
  const stateData = await queryCsv(csvPath, `
    SELECT 
      "${stateCol}" as state,
      SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks,
      SUM(TRY_CAST(REPLACE(COALESCE("${searchesCol}", ''), ',', '') AS DOUBLE)) as searches,
      COUNT(DISTINCT TRIM("SERP_KEYWORD")) as keyword_count
    FROM t
    WHERE (${slugConditions})
      AND "${stateCol}" IS NOT NULL
      AND "${stateCol}" != 'None'
      AND TRIM("${stateCol}") != ''
      AND LENGTH(TRIM("${stateCol}")) = 2
      AND TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE) > 0
    GROUP BY state
    HAVING clicks > 0
    ORDER BY revenue DESC
  `);
  
  if (stateData.length === 0) {
    console.log(`❌ No state-level data found for slug: "${slug}"\n`);
    console.log(`Checking if slug exists...\n`);
    
    const slugCheck = await queryCsv(csvPath, `
      SELECT DISTINCT TRIM("${slugCol}") as slug
      FROM t
      WHERE LOWER(TRIM("${slugCol}")) LIKE LOWER('%${slug.replace(/'/g, "''").substring(0, 30)}%')
      LIMIT 10
    `);
    
    if (slugCheck.length > 0) {
      console.log(`Found ${slugCheck.length} matching slug variants:`);
      slugCheck.forEach((s: any) => console.log(`  - "${s.slug}"`));
    } else {
      console.log(`No matching slugs found.`);
    }
    process.exit(1);
  }
  
  // Calculate RPC and format
  const results = stateData.map((row: any) => {
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    const ctr = searches > 0 ? (clicks / searches) * 100 : 0;
    
    return {
      state: String(row.state || '').trim(),
      revenue,
      clicks,
      searches,
      keyword_count: Number(row.keyword_count || 0),
      rpc,
      rps,
      ctr,
    };
  }).sort((a, b) => b.rpc - a.rpc); // Sort by RPC descending
  
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
  const totalSearches = results.reduce((sum, r) => sum + r.searches, 0);
  const totalKeywords = new Set(results.map(r => r.keyword_count)).size;
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  const avgCTR = totalSearches > 0 ? (totalClicks / totalSearches) * 100 : 0;
  
  console.log(`📊 SUMMARY:\n`);
  console.log(`Total States: ${results.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Average CTR: ${avgCTR.toFixed(2)}%`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}\n`);
  
  // Display table
  console.log(`\n📋 RPC BY STATE (Sorted by RPC):\n`);
  console.log('Rank | State | Revenue | Clicks | Searches | CTR | RPC | RPS | Keywords');
  console.log('-----|-------|---------|--------|----------|-----|-----|-----|---------');
  
  results.forEach((row, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${row.state.padEnd(5)} | $${row.revenue.toFixed(2).padStart(7)} | ${row.clicks.toFixed(0).padStart(6)} | ${row.searches.toFixed(0).padStart(8)} | ${row.ctr.toFixed(1).padStart(4)}% | $${row.rpc.toFixed(4)} | $${row.rps.toFixed(4)} | ${row.keyword_count.toString().padStart(9)}`
    );
  });
  
  // Also show sorted by revenue
  const sortedByRevenue = [...results].sort((a, b) => b.revenue - a.revenue);
  
  console.log(`\n\n💰 TOP STATES BY REVENUE:\n`);
  console.log('Rank | State | Revenue | Clicks | Searches | RPC | RPS | CTR');
  console.log('-----|-------|---------|--------|----------|-----|-----|-----');
  
  sortedByRevenue.slice(0, 20).forEach((row, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${row.state.padEnd(5)} | $${row.revenue.toFixed(2).padStart(7)} | ${row.clicks.toFixed(0).padStart(6)} | ${row.searches.toFixed(0).padStart(8)} | $${row.rpc.toFixed(4)} | $${row.rps.toFixed(4)} | ${row.ctr.toFixed(1)}%`
    );
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const safeSlug = slug.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const csvPath_out = path.join(outputDir, `${safeSlug}_rpc_by_state_${timestamp}.csv`);
  
  const csvRows = [
    ['state', 'revenue', 'clicks', 'searches', 'ctr', 'rpc', 'rps', 'keyword_count'].join(','),
    ...results.map(r => [
      r.state,
      r.revenue.toFixed(2),
      r.clicks.toFixed(0),
      r.searches.toFixed(0),
      r.ctr.toFixed(2),
      r.rpc.toFixed(4),
      r.rps.toFixed(4),
      r.keyword_count.toString(),
    ].join(','))
  ];
  
  fs.writeFileSync(csvPath_out, csvRows.join('\n'));
  
  console.log(`\n✅ Results exported to: ${csvPath_out}\n`);
}

main().catch((err) => {
  console.error('rpc_by_state_for_slug failed', err);
  process.exit(1);
});



