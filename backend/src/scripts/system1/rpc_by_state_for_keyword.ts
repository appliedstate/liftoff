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
  const keyword = process.argv[2] || 'instant cash for opening bank account';
  
  console.log(`\n=== RPC by State for Keyword ===\n`);
  console.log(`Keyword: "${keyword}"\n`);
  
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
  
  // Find state column (could be REGION_CODE, STATE, etc.)
  const stateCol = columns.find(c => 
    c.toLowerCase().includes('region') || 
    c.toLowerCase().includes('state') ||
    c.toLowerCase() === 'state_code'
  ) || 'REGION_CODE';
  
  const keywordCol = columns.find(c => 
    c.toLowerCase().includes('keyword') || 
    c.toLowerCase().includes('serp')
  ) || 'SERP_KEYWORD';
  
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
  console.log(`  Keyword: ${keywordCol}`);
  console.log(`  Revenue: ${revenueCol}`);
  console.log(`  Clicks: ${clicksCol}`);
  console.log(`  Searches: ${searchesCol}\n`);
  
  // Query RPC by state for the keyword
  const escapedKeyword = keyword.replace(/'/g, "''");
  const stateData = await queryCsv(csvPath, `
    SELECT 
      "${stateCol}" as state,
      SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks,
      SUM(TRY_CAST(REPLACE(COALESCE("${searchesCol}", ''), ',', '') AS DOUBLE)) as searches
    FROM t
    WHERE LOWER(TRIM("${keywordCol}")) LIKE LOWER('%${escapedKeyword}%')
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
    console.log(`❌ No state-level data found for keyword: "${keyword}"\n`);
    console.log(`Checking if keyword exists...\n`);
    
    const keywordCheck = await queryCsv(csvPath, `
      SELECT DISTINCT TRIM("${keywordCol}") as keyword
      FROM t
      WHERE LOWER(TRIM("${keywordCol}")) LIKE LOWER('%${escapedKeyword}%')
      LIMIT 10
    `);
    
    if (keywordCheck.length > 0) {
      console.log(`Found ${keywordCheck.length} matching keyword variants:`);
      keywordCheck.forEach((kw: any) => console.log(`  - "${kw.keyword}"`));
    } else {
      console.log(`No matching keywords found.`);
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
    
    return {
      state: String(row.state || '').trim(),
      revenue,
      clicks,
      searches,
      rpc,
      rps,
    };
  }).sort((a, b) => b.rpc - a.rpc); // Sort by RPC descending
  
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
  const totalSearches = results.reduce((sum, r) => sum + r.searches, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  
  console.log(`📊 SUMMARY:\n`);
  console.log(`Total States: ${results.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}\n`);
  
  // Display table
  console.log(`\n📋 RPC BY STATE (Sorted by RPC):\n`);
  console.log('Rank | State | Revenue | Clicks | Searches | RPC | RPS');
  console.log('-----|-------|---------|--------|----------|-----|-----');
  
  results.forEach((row, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${row.state.padEnd(5)} | $${row.revenue.toFixed(2).padStart(7)} | ${row.clicks.toFixed(0).padStart(6)} | ${row.searches.toFixed(0).padStart(8)} | $${row.rpc.toFixed(4)} | $${row.rps.toFixed(4)}`
    );
  });
  
  // Also show sorted by revenue
  const sortedByRevenue = [...results].sort((a, b) => b.revenue - a.revenue);
  
  console.log(`\n\n💰 TOP STATES BY REVENUE:\n`);
  console.log('Rank | State | Revenue | Clicks | RPC | RPS');
  console.log('-----|-------|---------|--------|-----|-----');
  
  sortedByRevenue.slice(0, 20).forEach((row, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${row.state.padEnd(5)} | $${row.revenue.toFixed(2).padStart(7)} | ${row.clicks.toFixed(0).padStart(6)} | $${row.rpc.toFixed(4)} | $${row.rps.toFixed(4)}`
    );
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const safeKeyword = keyword.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const csvPath_out = path.join(outputDir, `${safeKeyword}_rpc_by_state_${timestamp}.csv`);
  
  const csvRows = [
    ['state', 'revenue', 'clicks', 'searches', 'rpc', 'rps'].join(','),
    ...results.map(r => [
      r.state,
      r.revenue.toFixed(2),
      r.clicks.toFixed(0),
      r.searches.toFixed(0),
      r.rpc.toFixed(4),
      r.rps.toFixed(4),
    ].join(','))
  ];
  
  fs.writeFileSync(csvPath_out, csvRows.join('\n'));
  
  console.log(`\n✅ Results exported to: ${csvPath_out}\n`);
}

main().catch((err) => {
  console.error('rpc_by_state_for_keyword failed', err);
  process.exit(1);
});

