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
  const topN = parseInt(process.argv[2] || '100', 10);
  const minRevenue = parseFloat(process.argv[3] || '100');
  const minRPS = parseFloat(process.argv[4] || '5');
  
  console.log(`\n=== Top RPS Keywords by Slug (High Revenue) ===\n`);
  console.log(`Min Revenue: $${minRevenue.toFixed(2)}`);
  console.log(`Min RPS: $${minRPS.toFixed(2)}\n`);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Query keyword-slug combinations with RPS
  // Exclude leadgen slugs (emergency funds, instant loans, direct deposit loans, etc.)
  const keywordSlugData = await queryCsv(csvPath, `
    SELECT 
      TRIM("CONTENT_SLUG") as slug,
      TRIM("SERP_KEYWORD") as keyword,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches
    FROM t
    WHERE TRIM("CONTENT_SLUG") != ''
      AND TRIM("SERP_KEYWORD") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%emergency-fund%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%instant-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%instant-cash-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%direct-deposit%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%emergency-cash%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%quick-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%fast-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%cash-advance%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%payday-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%short-term-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%emergency-funds%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%fast-cash-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%quick-personal-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%loan-options-for-bad%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%loan-solutions-for-bad%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%guaranteed-approval%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%no-credit-check%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%instant-approval%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%cash-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%urgent-financial%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%immediate-financial%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%all-credit-situations%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%unexpected-expenses%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%credit-cards-with-no-credit%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%finding-the-right-personal-loan%'
      AND LOWER(TRIM("CONTENT_SLUG")) NOT LIKE '%quick-approval%'
    GROUP BY slug, keyword
    HAVING SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) >= ${minRevenue}
      AND COUNT(*) > 0
    ORDER BY revenue DESC
  `);
  
  console.log(`Found ${keywordSlugData.length} keyword-slug combinations\n`);
  
  // Process and calculate RPS
  const keywordSlugs: Array<{
    slug: string;
    keyword: string;
    revenue: number;
    clicks: number;
    searches: number;
    rpc: number;
    rps: number;
  }> = keywordSlugData.map((r: any) => {
    const revenue = Number(r.revenue || 0);
    const clicks = Number(r.clicks || 0);
    const searches = Number(r.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    return {
      slug: String(r.slug || '').trim(),
      keyword: String(r.keyword || '').trim(),
      revenue,
      clicks,
      searches,
      rpc,
      rps,
    };
  }).filter(k => k.rps >= minRPS); // Filter by minimum RPS
  
  // Sort by revenue (as requested - shows opportunity)
  keywordSlugs.sort((a, b) => b.revenue - a.revenue);
  
  console.log(`\n🏆 TOP ${Math.min(topN, keywordSlugs.length)} KEYWORD-SLUG COMBINATIONS BY REVENUE (RPS ≥ $${minRPS}):\n`);
  console.log('Rank | Keyword | Slug | Revenue | Searches | Clicks | RPC | RPS');
  console.log('-----|---------|------|---------|----------|--------|-----|-----');
  
  keywordSlugs.slice(0, topN).forEach((ks, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const keyword = ks.keyword.length > 50 ? ks.keyword.substring(0, 47) + '...' : ks.keyword;
    const slug = ks.slug.length > 50 ? ks.slug.substring(0, 47) + '...' : ks.slug;
    const revenue = `$${ks.revenue.toFixed(2)}`.padStart(8);
    const searches = ks.searches.toString().padStart(8);
    const clicks = ks.clicks.toFixed(0).padStart(6);
    const rpc = `$${ks.rpc.toFixed(4)}`.padStart(5);
    const rps = `$${ks.rps.toFixed(4)}`.padStart(5);
    console.log(`${rank} | ${keyword.padEnd(50)} | ${slug.padEnd(50)} | ${revenue} | ${searches} | ${clicks} | ${rpc} | ${rps}`);
  });
  
  // Also show top by RPS
  const sortedByRPS = [...keywordSlugs].sort((a, b) => b.rps - a.rps);
  
  console.log(`\n\n🏆 TOP ${Math.min(20, sortedByRPS.length)} BY RPS (Highest Efficiency):\n`);
  console.log('Rank | Keyword | Slug | Revenue | Searches | RPS | RPC');
  console.log('-----|---------|------|---------|----------|-----|-----');
  
  sortedByRPS.slice(0, 20).forEach((ks, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const keyword = ks.keyword.length > 50 ? ks.keyword.substring(0, 47) + '...' : ks.keyword;
    const slug = ks.slug.length > 50 ? ks.slug.substring(0, 47) + '...' : ks.slug;
    const revenue = `$${ks.revenue.toFixed(2)}`.padStart(8);
    const searches = ks.searches.toString().padStart(8);
    const rps = `$${ks.rps.toFixed(4)}`.padStart(5);
    const rpc = `$${ks.rpc.toFixed(4)}`.padStart(5);
    console.log(`${rank} | ${keyword.padEnd(50)} | ${slug.padEnd(50)} | ${revenue} | ${searches} | ${rps} | ${rpc}`);
  });
  
  // Summary stats
  const totalRevenue = keywordSlugs.reduce((sum, ks) => sum + ks.revenue, 0);
  const totalSearches = keywordSlugs.reduce((sum, ks) => sum + ks.searches, 0);
  const totalClicks = keywordSlugs.reduce((sum, ks) => sum + ks.clicks, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  
  console.log(`\n\n📊 SUMMARY STATISTICS:\n`);
  console.log(`Total Combinations: ${keywordSlugs.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Searches: ${totalSearches}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}`);
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const csvRows = [
    ['keyword', 'slug', 'revenue', 'searches', 'clicks', 'rpc', 'rps'].join(','),
    ...keywordSlugs.map(ks => [
      `"${ks.keyword.replace(/"/g, '""')}"`,
      `"${ks.slug.replace(/"/g, '""')}"`,
      ks.revenue.toFixed(2),
      ks.searches.toString(),
      ks.clicks.toFixed(0),
      ks.rpc.toFixed(4),
      ks.rps.toFixed(4),
    ].join(','))
  ];
  
  const csvPath_out = path.join(outputDir, `top_rps_keywords_by_slug_no_leadgen.csv`);
  fs.writeFileSync(csvPath_out, csvRows.join('\n'));
  
  console.log(`\n✅ Exported to: ${csvPath_out}\n`);
  console.log(`📝 Note: Leadgen slugs (emergency funds, instant loans, direct deposit loans) have been excluded\n`);
}

main().catch((err) => {
  console.error('top_rps_keywords_by_slug failed', err);
  process.exit(1);
});

