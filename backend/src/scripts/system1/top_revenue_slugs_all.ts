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
  const topN = parseInt(process.argv[2] || '50', 10);
  
  console.log(`\n=== Top Revenue Slugs (All Data) ===\n`);
  
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
  
  // Query all slugs by revenue
  const slugMetrics = await queryCsv(csvPath, `
    SELECT 
      TRIM("${slugCol}") as slug,
      SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks,
      SUM(TRY_CAST(REPLACE(COALESCE("${searchesCol}", ''), ',', '') AS DOUBLE)) as searches,
      COUNT(DISTINCT TRIM("${keywordCol}")) as keyword_count
    FROM t
    WHERE TRIM("${slugCol}") != ''
      AND TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug
    HAVING SUM(TRY_CAST(REPLACE(COALESCE("${clicksCol}", ''), ',', '') AS DOUBLE)) > 0
    ORDER BY revenue DESC
    LIMIT ${topN}
  `);
  
  console.log(`Found ${slugMetrics.length} slugs\n`);
  
  // Process and calculate RPC/RPS
  const slugsWithMetrics: Array<{
    slug: string;
    revenue: number;
    clicks: number;
    searches: number;
    keyword_count: number;
    rpc: number;
    rps: number;
  }> = slugMetrics.map((r: any) => {
    const revenue = Number(r.revenue || 0);
    const clicks = Number(r.clicks || 0);
    const searches = Number(r.searches || 0);
    const keyword_count = Number(r.keyword_count || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    return {
      slug: String(r.slug || '').trim(),
      revenue,
      clicks,
      searches,
      keyword_count,
      rpc,
      rps,
    };
  });
  
  // Calculate total revenue for percentage
  const totalRevenue = slugsWithMetrics.reduce((sum, s) => sum + s.revenue, 0);
  
  console.log(`\n🏆 TOP ${topN} SLUGS BY REVENUE:\n`);
  console.log('Rank | Slug | Revenue | % | Clicks | Searches | Keywords | RPC | RPS');
  console.log('-----|------|---------|---|--------|----------|----------|-----|-----');
  
  slugsWithMetrics.forEach((s, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const slug = s.slug.length > 60 ? s.slug.substring(0, 57) + '...' : s.slug;
    const revenue = `$${s.revenue.toFixed(2)}`.padStart(8);
    const pct = ((s.revenue / totalRevenue) * 100).toFixed(1).padStart(4);
    const clicks = s.clicks.toFixed(0).padStart(6);
    const searches = s.searches.toString().padStart(8);
    const keywords = s.keyword_count.toString().padStart(8);
    const rpc = `$${s.rpc.toFixed(4)}`.padStart(5);
    const rps = `$${s.rps.toFixed(4)}`.padStart(5);
    console.log(`${rank} | ${slug.padEnd(60)} | ${revenue} | ${pct}% | ${clicks} | ${searches} | ${keywords} | ${rpc} | ${rps}`);
  });
  
  // Summary stats
  const totalClicks = slugsWithMetrics.reduce((sum, s) => sum + s.clicks, 0);
  const totalSearches = slugsWithMetrics.reduce((sum, s) => sum + s.searches, 0);
  const totalKeywords = slugsWithMetrics.reduce((sum, s) => sum + s.keyword_count, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  
  console.log(`\n\n📊 SUMMARY STATISTICS (Top ${topN}):\n`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches}`);
  console.log(`Total Keywords: ${totalKeywords}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}`);
  
  // Get total from all slugs for comparison
  const allSlugs = await queryCsv(csvPath, `
    SELECT 
      SUM(TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE)) as total_revenue,
      COUNT(DISTINCT TRIM("${slugCol}")) as total_slugs
    FROM t
    WHERE TRIM("${slugCol}") != ''
      AND TRY_CAST(REPLACE(COALESCE("${revenueCol}", ''), ',', '') AS DOUBLE) > 0
  `);
  
  const allRevenue = Number(allSlugs[0]?.total_revenue || 0);
  const allSlugCount = Number(allSlugs[0]?.total_slugs || 0);
  const pctOfTotal = allRevenue > 0 ? (totalRevenue / allRevenue * 100).toFixed(1) : '0.0';
  
  console.log(`\n📈 VS ALL SLUGS:\n`);
  console.log(`Total Slugs in Dataset: ${allSlugCount}`);
  console.log(`Total Revenue in Dataset: $${allRevenue.toFixed(2)}`);
  console.log(`Top ${topN} represent: ${pctOfTotal}% of total revenue`);
}

main().catch((err) => {
  console.error('top_revenue_slugs_all failed', err);
  process.exit(1);
});

