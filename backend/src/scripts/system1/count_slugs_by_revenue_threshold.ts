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
  
  console.log(`\n=== Slugs by Revenue Threshold ===\n`);
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
  
  // Count slugs above threshold
  const aboveThreshold = await queryCsv(csvPath, `
    SELECT 
      TRIM("CONTENT_SLUG") as slug,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches
    FROM t
    WHERE TRIM("CONTENT_SLUG") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug
    HAVING SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) >= ${threshold}
    ORDER BY revenue DESC
  `);
  
  // Get total count
  const totalCount = await queryCsv(csvPath, `
    SELECT 
      COUNT(DISTINCT TRIM("CONTENT_SLUG")) as total_slugs,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as total_revenue
    FROM t
    WHERE TRIM("CONTENT_SLUG") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
  `);
  
  const totalSlugs = Number(totalCount[0]?.total_slugs || 0);
  const totalRevenue = Number(totalCount[0]?.total_revenue || 0);
  const thresholdRevenue = aboveThreshold.reduce((sum, s) => sum + Number(s.revenue || 0), 0);
  
  console.log(`📊 RESULTS:\n`);
  console.log(`Slugs with revenue ≥ $${threshold.toFixed(2)}: ${aboveThreshold.length}`);
  console.log(`Total slugs in dataset: ${totalSlugs}`);
  console.log(`Percentage: ${((aboveThreshold.length / totalSlugs) * 100).toFixed(1)}%\n`);
  
  console.log(`💰 REVENUE BREAKDOWN:\n`);
  console.log(`Revenue from slugs ≥ $${threshold.toFixed(2)}: $${thresholdRevenue.toFixed(2)}`);
  console.log(`Total revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Percentage of total revenue: ${((thresholdRevenue / totalRevenue) * 100).toFixed(1)}%\n`);
  
  // Show top 20
  if (aboveThreshold.length > 0) {
    console.log(`\n🏆 TOP 20 SLUGS ABOVE THRESHOLD:\n`);
    console.log('Rank | Slug | Revenue | Clicks | Searches');
    console.log('-----|------|---------|--------|----------');
    
    aboveThreshold.slice(0, 20).forEach((s, idx) => {
      const rank = (idx + 1).toString().padStart(4);
      const slug = String(s.slug || '').trim();
      const slugDisplay = slug.length > 60 ? slug.substring(0, 57) + '...' : slug;
      const revenue = `$${Number(s.revenue || 0).toFixed(2)}`.padStart(8);
      const clicks = Number(s.clicks || 0).toFixed(0).padStart(6);
      const searches = Number(s.searches || 0).toString().padStart(8);
      console.log(`${rank} | ${slugDisplay.padEnd(60)} | ${revenue} | ${clicks} | ${searches}`);
    });
  }
  
  // Revenue distribution
  const distribution = await queryCsv(csvPath, `
    WITH slug_revenue AS (
      SELECT 
        TRIM("CONTENT_SLUG") as slug,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue
      FROM t
      WHERE TRIM("CONTENT_SLUG") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      GROUP BY slug
    )
    SELECT 
      CASE
        WHEN revenue >= 10000 THEN '≥ $10,000'
        WHEN revenue >= 5000 THEN '$5,000 - $9,999'
        WHEN revenue >= 1500 THEN '$1,500 - $4,999'
        WHEN revenue >= 500 THEN '$500 - $1,499'
        WHEN revenue >= 100 THEN '$100 - $499'
        ELSE '< $100'
      END as revenue_range,
      COUNT(*) as slug_count
    FROM slug_revenue
    GROUP BY revenue_range
    ORDER BY 
      CASE revenue_range
        WHEN '≥ $10,000' THEN 1
        WHEN '$5,000 - $9,999' THEN 2
        WHEN '$1,500 - $4,999' THEN 3
        WHEN '$500 - $1,499' THEN 4
        WHEN '$100 - $499' THEN 5
        ELSE 6
      END
  `);
  
  console.log(`\n\n📈 REVENUE DISTRIBUTION:\n`);
  console.log('Range | Slug Count | % of Total');
  console.log('------|------------|-----------');
  
  distribution.forEach((d: any) => {
    const range = String(d.revenue_range || '').padEnd(20);
    const count = Number(d.slug_count || 0).toString().padStart(10);
    const pct = totalSlugs > 0 ? ((Number(d.slug_count || 0) / totalSlugs) * 100).toFixed(1).padStart(8) : '0.0';
    console.log(`${range} | ${count} | ${pct}%`);
  });
}

main().catch((err) => {
  console.error('count_slugs_by_revenue_threshold failed', err);
  process.exit(1);
});

