import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const escaped = csvPath.replace(/'/g, "''");
  const run = (q: string) => new Promise<void>((resolve, reject) => (conn as any).run(q, (err: Error | null) => err ? reject(err) : resolve()));
  const all = (q: string) => new Promise<any[]>((resolve, reject) => (conn as any).all(q, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows)));
  await run(`CREATE TABLE t AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true, delim=',', quote='"');`);
  const rows = await all(sql);
  conn.close(() => db.close(() => {}));
  return rows;
}

async function main() {
  const clusterName = process.argv[2] || 'health/paid-depression-clinical-trials-up-to-3000-en-us';
  const runDate = process.argv[3] || '2025-11-06';
  
  console.log(`\n=== RPC by State for Cluster ===\n`);
  console.log(`Cluster: ${clusterName}\n`);
  
  // Get slugs in this cluster
  const baseDir = path.resolve(`./runs/system1/2025-11-07`);
  const membersPath = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
  
  if (!fs.existsSync(membersPath)) {
    console.error(`Cluster members file not found: ${membersPath}`);
    process.exit(1);
  }
  
  const membersContent = fs.readFileSync(membersPath, 'utf-8');
  const memberLines = membersContent.split('\n').filter(l => l.trim());
  
  const slugs: string[] = [];
  for (let i = 1; i < memberLines.length; i++) {
    const values = memberLines[i].split(',');
    const cluster = values[0] || '';
    const slug = values[1] || '';
    if (cluster === clusterName && slug) {
      slugs.push(slug);
    }
  }
  
  console.log(`Found ${slugs.length} slugs in cluster\n`);
  
  if (slugs.length === 0) {
    console.error(`No slugs found for cluster: ${clusterName}`);
    process.exit(1);
  }
  
  // Find source CSV file
  const sourceDataPath = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDataPath).filter(f => f.endsWith('.csv'));
  
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDataPath}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDataPath, csvFiles[0]);
  console.log(`Using source file: ${csvFiles[0]}\n`);
  
  try {
    // First, check what columns exist
    const cols = await queryCsv(csvPath, `DESCRIBE t`);
    const colNames = cols.map((c: any) => c.column_name);
    console.log(`Found columns: ${colNames.slice(0, 10).join(', ')}...\n`);
    
    // Try to find the right columns
    const slugCol = colNames.find(c => c.includes('SLUG') || c.includes('slug')) || 'CONTENT_SLUG';
    const stateCol = colNames.find(c => c.includes('REGION') || c.includes('STATE') || c.includes('state')) || 'REGION_CODE';
    const revenueCol = colNames.find(c => c.includes('REVENUE') || c.includes('revenue')) || 'EST_NET_REVENUE';
    const clicksCol = colNames.find(c => c.includes('CLICKS') || c.includes('clicks')) || 'SELLSIDE_CLICKS_NETWORK';
    
    console.log(`Using columns: ${slugCol}, ${stateCol}, ${revenueCol}, ${clicksCol}\n`);
    
    // Normalize slugs - CSV has trailing slashes, cluster might not
    const normalizedSlugs = slugs.map(s => {
      const trimmed = s.trim();
      // Try both with and without trailing slash
      return [trimmed, trimmed + '/', trimmed.replace(/\/$/, '')];
    }).flat();
    
    // Build WHERE clause - try exact match first, then LIKE
    const slugConditions = normalizedSlugs.map(s => {
      const escaped = s.replace(/'/g, "''");
      return `("${slugCol}" = '${escaped}' OR TRIM("${slugCol}") = '${escaped}')`;
    }).join(' OR ');
    
    // Query state-level data
    const stateData = await queryCsv(csvPath, `
      SELECT 
        "${stateCol}" as state,
        SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks
      FROM t
      WHERE (${slugConditions})
        AND "${stateCol}" IS NOT NULL
        AND "${stateCol}" != 'None'
        AND TRIM("${stateCol}") != ''
        AND LENGTH(TRIM("${stateCol}")) = 2
      GROUP BY state
      HAVING clicks > 0
      ORDER BY revenue DESC
    `);
    
    if (stateData.length === 0) {
      console.error('No state-level data found. Checking if slugs exist...');
      const sample = await queryCsv(csvPath, `
        SELECT "${slugCol}", CAST(COUNT(*) AS INTEGER) as cnt
        FROM t
        WHERE "${slugCol}" LIKE '%depression%clinical%trial%'
        GROUP BY "${slugCol}"
        LIMIT 5
      `);
      console.log('Sample matching slugs:', JSON.stringify(sample, null, 2));
      
      // Try with normalized slugs (add/remove trailing slashes)
      console.log('\nTrying with normalized slug matching...');
      const normalizedSlugs = slugs.map(s => {
        const trimmed = s.trim();
        return [trimmed, trimmed + '/', trimmed.replace(/\/$/, '')];
      }).flat();
      
      const trimmedSlugConditions = normalizedSlugs.map(s => {
        const escaped = s.replace(/'/g, "''");
        return `("${slugCol}" = '${escaped}' OR TRIM("${slugCol}") = '${escaped}')`;
      }).join(' OR ');
      
      const stateDataTrimmed = await queryCsv(csvPath, `
        SELECT 
          "${stateCol}" as state,
          SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
          SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks
        FROM t
        WHERE (${trimmedSlugConditions})
          AND "${stateCol}" IS NOT NULL
          AND "${stateCol}" != 'None'
          AND TRIM("${stateCol}") != ''
          AND LENGTH(TRIM("${stateCol}")) = 2
        GROUP BY state
        HAVING clicks > 0
        ORDER BY revenue DESC
      `);
      
      if (stateDataTrimmed.length === 0) {
        console.error('Still no data found. Exiting.');
        process.exit(1);
      }
      
      // Use trimmed results
      const results = stateDataTrimmed.map((row: any) => ({
        state: String(row.state || '').trim(),
        revenue: Number(row.revenue || 0),
        clicks: Number(row.clicks || 0),
        rpc: Number(row.clicks || 0) > 0 ? Number(row.revenue || 0) / Number(row.clicks || 0) : 0,
      })).sort((a, b) => b.rpc - a.rpc);
      
      // Print table
      console.log('\nState | RPC | Revenue | Clicks');
      console.log('------|-----|---------|--------');
      results.forEach(r => {
        console.log(`${r.state.padEnd(5)} | $${r.rpc.toFixed(4).padStart(7)} | $${r.revenue.toFixed(2).padStart(9)} | ${r.clicks.toFixed(0).padStart(6)}`);
      });
      
      // Write CSV
      const csvRows = [
        ['state', 'rpc', 'revenue', 'clicks'].join(','),
        ...results.map(r => [
          r.state,
          r.rpc.toFixed(4),
          r.revenue.toFixed(2),
          r.clicks.toFixed(2),
        ].join(','))
      ];
      
      const outputPath = path.join(baseDir, `${clusterName.replace(/\//g, '_')}_rpc_by_state.csv`);
      fs.writeFileSync(outputPath, csvRows.join('\n'));
      
      console.log(`\n✅ Output written to: ${outputPath}\n`);
      
      const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
      const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
      const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
      
      console.log(`📊 SUMMARY:\n`);
      console.log(`Total States: ${results.length}`);
      console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
      console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
      console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
      console.log(`Highest RPC: $${results[0]?.rpc.toFixed(4)} (${results[0]?.state})`);
      console.log(`Lowest RPC: $${results[results.length - 1]?.rpc.toFixed(4)} (${results[results.length - 1]?.state})\n`);
      
      return;
    }
    
    // Calculate RPC and format
    const results = stateData.map((row: any) => ({
      state: String(row.state || '').trim(),
      revenue: Number(row.revenue || 0),
      clicks: Number(row.clicks || 0),
      rpc: Number(row.clicks || 0) > 0 ? Number(row.revenue || 0) / Number(row.clicks || 0) : 0,
    })).sort((a, b) => b.rpc - a.rpc);
    
    // Print table
    console.log('State | RPC | Revenue | Clicks');
    console.log('------|-----|---------|--------');
    results.forEach(r => {
      console.log(`${r.state.padEnd(5)} | $${r.rpc.toFixed(4).padStart(7)} | $${r.revenue.toFixed(2).padStart(9)} | ${r.clicks.toFixed(0).padStart(6)}`);
    });
    
    // Write CSV
    const csvRows = [
      ['state', 'rpc', 'revenue', 'clicks'].join(','),
      ...results.map(r => [
        r.state,
        r.rpc.toFixed(4),
        r.revenue.toFixed(2),
        r.clicks.toFixed(2),
      ].join(','))
    ];
    
    const outputPath = path.join(baseDir, `${clusterName.replace(/\//g, '_')}_rpc_by_state.csv`);
    fs.writeFileSync(outputPath, csvRows.join('\n'));
    
    console.log(`\n✅ Output written to: ${outputPath}\n`);
    
    const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
    const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
    const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
    
    console.log(`📊 SUMMARY:\n`);
    console.log(`Total States: ${results.length}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
    console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
    console.log(`Highest RPC: $${results[0]?.rpc.toFixed(4)} (${results[0]?.state})`);
    console.log(`Lowest RPC: $${results[results.length - 1]?.rpc.toFixed(4)} (${results[results.length - 1]?.state})\n`);
    
  } catch (err: any) {
    console.error('Error querying CSV:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('rpc_by_state_for_cluster failed', err);
  process.exit(1);
});

