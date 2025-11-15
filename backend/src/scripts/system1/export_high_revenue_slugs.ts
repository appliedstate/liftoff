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
  const threshold = parseFloat(process.argv[2] || '1500');
  const outputDir = process.argv[3] || './runs/system1/2025-11-07';
  
  console.log(`\n=== Exporting High Revenue Slugs ===\n`);
  console.log(`Threshold: $${threshold.toFixed(2)}\n`);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Get slugs above threshold
  const aboveThreshold = await queryCsv(csvPath, `
    SELECT 
      TRIM("CONTENT_SLUG") as slug,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches,
      COUNT(DISTINCT "SERP_KEYWORD") as keyword_count
    FROM t
    WHERE TRIM("CONTENT_SLUG") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug
    HAVING SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) >= ${threshold}
    ORDER BY revenue DESC
  `);
  
  // Get total revenue for percentage calculation
  const totalStats = await queryCsv(csvPath, `
    SELECT 
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as total_revenue
    FROM t
    WHERE TRIM("CONTENT_SLUG") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
  `);
  
  const totalRevenue = Number(totalStats[0]?.total_revenue || 0);
  
  // Process and calculate metrics
  const slugsData = aboveThreshold.map((r: any) => {
    const revenue = Number(r.revenue || 0);
    const clicks = Number(r.clicks || 0);
    const searches = Number(r.searches || 0);
    const keyword_count = Number(r.keyword_count || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    const pct_of_total = totalRevenue > 0 ? (revenue / totalRevenue * 100) : 0;
    
    return {
      slug: String(r.slug || '').trim(),
      revenue: revenue.toFixed(2),
      clicks: clicks.toFixed(0),
      searches: searches.toString(),
      keyword_count: keyword_count.toString(),
      rpc: rpc.toFixed(4),
      rps: rps.toFixed(4),
      pct_of_total_revenue: pct_of_total.toFixed(2),
    };
  });
  
  // Create CSV
  const headers = ['slug', 'revenue', 'clicks', 'searches', 'keyword_count', 'rpc', 'rps', 'pct_of_total_revenue'];
  const csvRows = [
    headers.join(','),
    ...slugsData.map(row => 
      headers.map(h => {
        const value = row[h as keyof typeof row];
        // Escape quotes and wrap in quotes if contains comma
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ];
  
  // Ensure output directory exists
  const outputPath = path.resolve(outputDir);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const filename = `slugs_revenue_above_${threshold.toFixed(0)}.csv`;
  const filepath = path.join(outputPath, filename);
  
  fs.writeFileSync(filepath, csvRows.join('\n'));
  
  console.log(`✅ Exported ${slugsData.length} slugs to: ${filepath}\n`);
  console.log(`📊 SUMMARY:\n`);
  console.log(`Total Slugs: ${slugsData.length}`);
  console.log(`Total Revenue: $${slugsData.reduce((sum, s) => sum + parseFloat(s.revenue), 0).toFixed(2)}`);
  console.log(`Percentage of Total Revenue: ${((slugsData.reduce((sum, s) => sum + parseFloat(s.revenue), 0) / totalRevenue) * 100).toFixed(1)}%`);
  console.log(`Average RPC: $${(slugsData.reduce((sum, s) => sum + parseFloat(s.rpc), 0) / slugsData.length).toFixed(4)}`);
  console.log(`Average RPS: $${(slugsData.reduce((sum, s) => sum + parseFloat(s.rps), 0) / slugsData.length).toFixed(4)}`);
}

main().catch((err) => {
  console.error('export_high_revenue_slugs failed', err);
  process.exit(1);
});



