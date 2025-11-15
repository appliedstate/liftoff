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
  const slug = process.argv[3] || 'health/factors-influencing-botox-prices-en-us/';
  
  console.log(`\n=== Top Revenue Keywords for: ${slug} ===\n`);

  // Query source data for keywords by slug
  const sourceData = path.resolve(`./data/system1/incoming`);
  if (!fs.existsSync(sourceData)) {
    console.error(`Source data not found: ${sourceData}`);
    process.exit(1);
  }

  const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
  if (sourceFiles.length === 0) {
    console.error('No source CSV files found');
    process.exit(1);
  }

  const latestSource = sourceFiles.sort().reverse()[0];
  const sourcePath = path.join(sourceData, latestSource);

  // Get top keywords by revenue
  const topKeywords = await queryCsv(sourcePath, `
    SELECT 
      SERP_KEYWORD as keyword,
      CAST(COUNT(*) AS INTEGER) as search_count,
      SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
      SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue,
      CASE 
        WHEN SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) > 0
        THEN SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) / 
             SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE))
        ELSE 0
      END as rpc,
      CASE 
        WHEN COUNT(*) > 0
        THEN SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) / COUNT(*)
        ELSE 0
      END as rps
    FROM t
    WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
    GROUP BY SERP_KEYWORD
    HAVING SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) > 0
    ORDER BY SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) DESC
    LIMIT 50
  `);

  console.log(`Found ${topKeywords.length} keywords with revenue:\n`);

  // Format and display
  const formatted = topKeywords.map((r: any, i: number) => ({
    rank: i + 1,
    keyword: String(r.keyword || '').trim(),
    searches: Number(r.search_count || 0),
    clicks: Number(r.total_clicks || 0),
    revenue: Number(r.total_revenue || 0),
    rpc: Number(r.rpc || 0),
    rps: Number(r.rps || 0)
  }));

  console.log(JSON.stringify(formatted, null, 2));

  // Table format
  console.log('\n📊 TABLE FORMAT - TOP 50 BY REVENUE:\n');
  console.log('Rank | Keyword | Searches | Clicks | Revenue | RPC | RPS');
  console.log('-----|---------|----------|--------|---------|-----|-----');
  formatted.forEach((r: any) => {
    const keyword = r.keyword.length > 50 ? r.keyword.substring(0, 47) + '...' : r.keyword;
    const rank = r.rank.toString().padStart(4);
    const searches = r.searches.toString().padStart(8);
    const clicks = r.clicks.toFixed(1).padStart(6);
    const revenue = r.revenue.toFixed(2).padStart(7);
    const rpc = r.rpc.toFixed(3).padStart(5);
    const rps = r.rps.toFixed(3).padStart(5);
    console.log(`${rank} | ${keyword.padEnd(50)} | ${searches} | ${clicks} | $${revenue} | ${rpc} | ${rps}`);
  });

  // Summary
  const totalRevenue = formatted.reduce((sum, r) => sum + r.revenue, 0);
  const totalSearches = formatted.reduce((sum, r) => sum + r.searches, 0);
  const totalClicks = formatted.reduce((sum, r) => sum + r.clicks, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;

  console.log('\n📈 SUMMARY (Top 50):');
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Searches: ${totalSearches}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(1)}`);
  console.log(`Average RPC: $${avgRPC.toFixed(3)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(3)}`);

  // Get total for all keywords to see what % the top 50 represents
  const allKeywords = await queryCsv(sourcePath, `
    SELECT 
      SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue,
      COUNT(DISTINCT SERP_KEYWORD) as keyword_count
    FROM t
    WHERE LOWER(CONTENT_SLUG) = LOWER('${slug.replace(/'/g, "''")}')
  `);

  const allRevenue = Number(allKeywords[0]?.total_revenue || 0);
  const allKeywordCount = Number(allKeywords[0]?.keyword_count || 0);
  const pctOfTotal = allRevenue > 0 ? (totalRevenue / allRevenue * 100).toFixed(1) : '0.0';

  console.log(`\n📊 All Keywords Total: $${allRevenue.toFixed(2)} (${allKeywordCount} keywords)`);
  console.log(`Top 50 represents: ${pctOfTotal}% of total revenue`);
}

main().catch(console.error);

