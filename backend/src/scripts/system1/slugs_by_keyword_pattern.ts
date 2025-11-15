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
  const patterns = process.argv.slice(2);
  
  if (patterns.length === 0) {
    console.error('Usage: npx ts-node src/scripts/system1/slugs_by_keyword_pattern.ts <pattern1> [pattern2] ...');
    console.error('Example: npx ts-node src/scripts/system1/slugs_by_keyword_pattern.ts bank checking');
    process.exit(1);
  }
  
  console.log(`\n=== Slugs Containing Keywords ===\n`);
  console.log(`Search patterns: ${patterns.map(p => `"${p}"`).join(', ')}\n`);
  
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
  
  // Build WHERE conditions for patterns
  const patternConditions = patterns.map(pattern => {
    const escaped = pattern.replace(/'/g, "''");
    return `(LOWER(TRIM("${slugCol}")) LIKE LOWER('%${escaped}%'))`;
  }).join(' OR ');
  
  // Query slugs matching patterns
  const slugData = await queryCsv(csvPath, `
    SELECT 
      TRIM("${slugCol}") as slug,
      SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks,
      SUM(TRY_CAST(REPLACE(COALESCE("${searchesCol}", ''), ',', '') AS DOUBLE)) as searches,
      COUNT(DISTINCT TRIM("${keywordCol}")) as keyword_count
    FROM t
    WHERE (${patternConditions})
      AND "${slugCol}" IS NOT NULL
      AND TRIM("${slugCol}") != ''
      AND TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug
    HAVING clicks > 0
    ORDER BY revenue DESC
  `);
  
  if (slugData.length === 0) {
    console.log(`❌ No slugs found matching patterns: ${patterns.join(', ')}\n`);
    process.exit(1);
  }
  
  // Calculate RPC and format
  const results = slugData.map((row: any) => {
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    const ctr = searches > 0 ? (clicks / searches) * 100 : 0;
    
    return {
      slug: String(row.slug || '').trim(),
      revenue,
      clicks,
      searches,
      keyword_count: Number(row.keyword_count || 0),
      rpc,
      rps,
      ctr,
    };
  });
  
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
  const totalSearches = results.reduce((sum, r) => sum + r.searches, 0);
  const totalKeywords = results.reduce((sum, r) => sum + r.keyword_count, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  const avgCTR = totalSearches > 0 ? (totalClicks / totalSearches) * 100 : 0;
  
  console.log(`📊 SUMMARY:\n`);
  console.log(`Total Slugs: ${results.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Total Keywords: ${totalKeywords.toFixed(0)}`);
  console.log(`Average CTR: ${avgCTR.toFixed(2)}%`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}\n`);
  
  // Display table
  console.log(`\n📋 SLUGS (Sorted by Revenue):\n`);
  
  // Calculate column widths
  const maxSlugLength = Math.max(...results.map(r => r.slug.length), 50);
  const slugColWidth = Math.min(maxSlugLength, 80);
  
  // Header
  console.log(
    'Rank'.padStart(4) + ' | ' +
    'Slug'.padEnd(slugColWidth) + ' | ' +
    'Revenue'.padStart(10) + ' | ' +
    'Clicks'.padStart(8) + ' | ' +
    'Searches'.padStart(9) + ' | ' +
    'CTR'.padStart(6) + ' | ' +
    'RPC'.padStart(8) + ' | ' +
    'RPS'.padStart(8) + ' | ' +
    'Keywords'.padStart(9)
  );
  console.log('-'.repeat(4) + '-+-' + '-'.repeat(slugColWidth) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(9) + '-+-' + '-'.repeat(6) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(9));
  
  results.forEach((row, idx) => {
    const slugDisplay = row.slug.length > slugColWidth 
      ? row.slug.substring(0, slugColWidth - 3) + '...'
      : row.slug;
    
    console.log(
      (idx + 1).toString().padStart(4) + ' | ' +
      slugDisplay.padEnd(slugColWidth) + ' | ' +
      `$${row.revenue.toFixed(2)}`.padStart(10) + ' | ' +
      row.clicks.toFixed(0).padStart(8) + ' | ' +
      row.searches.toFixed(0).padStart(9) + ' | ' +
      `${row.ctr.toFixed(1)}%`.padStart(6) + ' | ' +
      `$${row.rpc.toFixed(4)}`.padStart(8) + ' | ' +
      `$${row.rps.toFixed(4)}`.padStart(8) + ' | ' +
      row.keyword_count.toString().padStart(9)
    );
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const safePattern = patterns.join('_').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const csvPath_out = path.join(outputDir, `slugs_containing_${safePattern}_${timestamp}.csv`);
  
  const csvRows = [
    ['slug', 'revenue', 'clicks', 'searches', 'ctr', 'rpc', 'rps', 'keyword_count'].join(','),
    ...results.map(r => [
      `"${r.slug.replace(/"/g, '""')}"`,
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
  console.error('slugs_by_keyword_pattern failed', err);
  process.exit(1);
});



