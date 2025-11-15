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
  const paretoFile = process.argv[2] || 'backend/reports/s1/pareto_2025-11-08.csv';
  
  console.log(`\n=== Top Gap Slugs Analysis (Pareto 80/20) ===\n`);
  console.log(`Loading Pareto keywords from: ${paretoFile}\n`);
  
  // Load pareto keywords
  if (!fs.existsSync(paretoFile)) {
    console.error(`Pareto file not found: ${paretoFile}`);
    process.exit(1);
  }
  
  const paretoData = await queryCsv(paretoFile, `
    SELECT DISTINCT TRIM(keyword) as keyword
    FROM t
    WHERE TRIM(keyword) != ''
  `);
  
  const paretoKeywords = paretoData.map((r: any) => String(r.keyword || '').trim()).filter(k => k.length > 0);
  console.log(`✅ Loaded ${paretoKeywords.length} keywords from Pareto file\n`);
  
  // Find source System1 CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using System1 source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Build SQL condition to exclude Pareto-matched keywords
  const paretoExclusions = paretoKeywords.map(kw => {
    const escaped = kw.replace(/'/g, "''");
    return `LOWER(TRIM("SERP_KEYWORD")) NOT LIKE LOWER('%${escaped}%')`;
  }).join(' AND ');
  
  // Get all gap slugs with revenue, excluding leadgen AND Pareto-matched keywords
  console.log('🔍 Analyzing gap opportunity slugs...\n');
  const gapSlugs = await queryCsv(csvPath, `
    SELECT 
      TRIM("CONTENT_SLUG") as slug,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches,
      COUNT(DISTINCT TRIM("SERP_KEYWORD")) as keyword_count
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
      AND (${paretoExclusions})
    GROUP BY slug
    ORDER BY revenue DESC
  `);
  
  // Process slugs with metrics
  const slugsWithMetrics = gapSlugs.map((row: any) => {
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    return {
      slug: String(row.slug || '').trim(),
      revenue,
      clicks,
      searches,
      keyword_count: Number(row.keyword_count || 0),
      rpc,
      rps,
    };
  });
  
  const totalRevenue = slugsWithMetrics.reduce((sum, s) => sum + s.revenue, 0);
  const totalSlugs = slugsWithMetrics.length;
  const targetRevenue = totalRevenue * 0.8; // 80% of revenue
  
  console.log(`📊 GAP SLUGS SUMMARY:\n`);
  console.log(`Total Slugs: ${totalSlugs.toLocaleString()}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`80% Target Revenue: $${targetRevenue.toFixed(2)}\n`);
  
  // Find top slugs that reach 80% of revenue
  let cumulativeRevenue = 0;
  const topSlugs: typeof slugsWithMetrics = [];
  
  for (const slug of slugsWithMetrics) {
    cumulativeRevenue += slug.revenue;
    topSlugs.push(slug);
    if (cumulativeRevenue >= targetRevenue) {
      break;
    }
  }
  
  const top20PercentCount = Math.ceil(totalSlugs * 0.2);
  const top20PercentSlugs = slugsWithMetrics.slice(0, top20PercentCount);
  const top20PercentRevenue = top20PercentSlugs.reduce((sum, s) => sum + s.revenue, 0);
  
  console.log(`\n🎯 PARETO ANALYSIS:\n`);
  console.log(`Top ${topSlugs.length} slugs produce 80% of revenue:`);
  console.log(`  Revenue: $${cumulativeRevenue.toFixed(2)} (${((cumulativeRevenue/totalRevenue)*100).toFixed(2)}%)`);
  console.log(`  Percentage of slugs: ${((topSlugs.length/totalSlugs)*100).toFixed(2)}%\n`);
  
  console.log(`Top 20% of slugs (${top20PercentCount} slugs):`);
  console.log(`  Revenue: $${top20PercentRevenue.toFixed(2)} (${((top20PercentRevenue/totalRevenue)*100).toFixed(2)}%)`);
  
  // Get top keywords for each top slug
  console.log(`\n\n📋 TOP SLUGS PRODUCING 80% OF REVENUE:\n`);
  console.log('Rank | Slug | Revenue | % of Total | Clicks | Searches | Keywords | RPC | RPS');
  console.log('-----|------|---------|------------|--------|----------|----------|-----|-----');
  
  for (let idx = 0; idx < topSlugs.length; idx++) {
    const slug = topSlugs[idx];
    const slugDisplay = slug.slug.length > 60 ? slug.slug.substring(0, 57) + '...' : slug.slug;
    const revenuePct = ((slug.revenue / totalRevenue) * 100).toFixed(2);
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${slugDisplay.padEnd(60)} | $${slug.revenue.toFixed(2).padStart(7)} | ${revenuePct.padStart(10)}% | ${slug.clicks.toFixed(0).padStart(6)} | ${slug.searches.toFixed(0).padStart(8)} | ${slug.keyword_count.toString().padStart(9)} | $${slug.rpc.toFixed(4)} | $${slug.rps.toFixed(4)}`
    );
  }
  
  // Get top keywords for each top slug
  console.log(`\n\n🔑 TOP KEYWORDS FOR EACH TOP SLUG:\n`);
  
  for (let idx = 0; idx < Math.min(topSlugs.length, 20); idx++) {
    const slug = topSlugs[idx];
    const escapedSlug = slug.slug.replace(/'/g, "''");
    
    const topKeywords = await queryCsv(csvPath, `
      SELECT 
        TRIM("SERP_KEYWORD") as keyword,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks
      FROM t
      WHERE TRIM("CONTENT_SLUG") = '${escapedSlug}'
        AND TRIM("SERP_KEYWORD") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
        AND (${paretoExclusions})
      GROUP BY keyword
      ORDER BY revenue DESC
      LIMIT 10
    `);
    
    console.log(`\n${(idx + 1).toString().padStart(2)}. ${slug.slug}`);
    console.log(`   Revenue: $${slug.revenue.toFixed(2)} | Keywords: ${slug.keyword_count} | RPC: $${slug.rpc.toFixed(4)} | RPS: $${slug.rps.toFixed(4)}`);
    console.log(`   Top Keywords:`);
    
    topKeywords.forEach((kw: any, kwIdx: number) => {
      const keyword = String(kw.keyword || '').trim();
      const kwRevenue = Number(kw.revenue || 0);
      const kwClicks = Number(kw.clicks || 0);
      const kwRPC = kwClicks > 0 ? kwRevenue / kwClicks : 0;
      const keywordDisplay = keyword.length > 70 ? keyword.substring(0, 67) + '...' : keyword;
      console.log(`      ${(kwIdx + 1).toString().padStart(2)}. "${keywordDisplay}" - $${kwRevenue.toFixed(2)} (RPC: $${kwRPC.toFixed(4)})`);
    });
  }
  
  // Also show top 50 by revenue (for comparison)
  console.log(`\n\n🏆 TOP 50 SLUGS BY REVENUE (Highest Opportunity):\n`);
  console.log('Rank | Slug | Revenue | % of Total | Clicks | Searches | Keywords | RPC | RPS');
  console.log('-----|------|---------|------------|--------|----------|----------|-----|-----');
  
  slugsWithMetrics.slice(0, 50).forEach((slug, idx) => {
    const slugDisplay = slug.slug.length > 60 ? slug.slug.substring(0, 57) + '...' : slug.slug;
    const revenuePct = ((slug.revenue / totalRevenue) * 100).toFixed(2);
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${slugDisplay.padEnd(60)} | $${slug.revenue.toFixed(2).padStart(7)} | ${revenuePct.padStart(10)}% | ${slug.clicks.toFixed(0).padStart(6)} | ${slug.searches.toFixed(0).padStart(8)} | ${slug.keyword_count.toString().padStart(9)} | $${slug.rpc.toFixed(4)} | $${slug.rps.toFixed(4)}`
    );
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  // Export top 80% slugs
  const csvPath80 = path.join(outputDir, `top_gap_slugs_80pct_${timestamp}.csv`);
  const csvRows80 = [
    ['rank', 'slug', 'revenue', 'pct_of_total', 'clicks', 'searches', 'keyword_count', 'rpc', 'rps'].join(','),
    ...topSlugs.map((slug, idx) => [
      idx + 1,
      `"${slug.slug.replace(/"/g, '""')}"`,
      slug.revenue.toFixed(2),
      ((slug.revenue / totalRevenue) * 100).toFixed(2),
      slug.clicks.toFixed(0),
      slug.searches.toFixed(0),
      slug.keyword_count.toString(),
      slug.rpc.toFixed(4),
      slug.rps.toFixed(4),
    ].join(','))
  ];
  fs.writeFileSync(csvPath80, csvRows80.join('\n'));
  
  // Export top 50 by revenue
  const csvPath50 = path.join(outputDir, `top_gap_slugs_top50_${timestamp}.csv`);
  const csvRows50 = [
    ['rank', 'slug', 'revenue', 'pct_of_total', 'clicks', 'searches', 'keyword_count', 'rpc', 'rps'].join(','),
    ...slugsWithMetrics.slice(0, 50).map((slug, idx) => [
      idx + 1,
      `"${slug.slug.replace(/"/g, '""')}"`,
      slug.revenue.toFixed(2),
      ((slug.revenue / totalRevenue) * 100).toFixed(2),
      slug.clicks.toFixed(0),
      slug.searches.toFixed(0),
      slug.keyword_count.toString(),
      slug.rpc.toFixed(4),
      slug.rps.toFixed(4),
    ].join(','))
  ];
  fs.writeFileSync(csvPath50, csvRows50.join('\n'));
  
  console.log(`\n✅ Results exported:`);
  console.log(`   Top 80% Revenue Slugs: ${csvPath80}`);
  console.log(`   Top 50 Slugs by Revenue: ${csvPath50}\n`);
}

main().catch((err) => {
  console.error('top_gap_slugs_pareto failed', err);
  process.exit(1);
});



