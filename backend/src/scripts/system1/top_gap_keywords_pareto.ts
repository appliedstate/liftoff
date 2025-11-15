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
  
  console.log(`\n=== Top Gap Keywords Analysis (Pareto 80/20) ===\n`);
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
  
  // Get all gap keywords with revenue, excluding leadgen AND Pareto-matched keywords
  console.log('🔍 Loading gap opportunity keywords...\n');
  const gapKeywords = await queryCsv(csvPath, `
    SELECT 
      TRIM("SERP_KEYWORD") as keyword,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches,
      COUNT(DISTINCT TRIM("CONTENT_SLUG")) as slug_count
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
    GROUP BY keyword
    ORDER BY revenue DESC
  `);
  
  // Process keywords with metrics
  const keywordsWithMetrics = gapKeywords.map((row: any) => {
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    return {
      keyword: String(row.keyword || '').trim(),
      revenue,
      clicks,
      searches,
      slug_count: Number(row.slug_count || 0),
      rpc,
      rps,
    };
  });
  
  const totalRevenue = keywordsWithMetrics.reduce((sum, k) => sum + k.revenue, 0);
  const totalKeywords = keywordsWithMetrics.length;
  const targetRevenue = totalRevenue * 0.8; // 80% of revenue
  
  console.log(`📊 GAP KEYWORDS SUMMARY:\n`);
  console.log(`Total Keywords: ${totalKeywords.toLocaleString()}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`80% Target Revenue: $${targetRevenue.toFixed(2)}\n`);
  
  // Find top keywords that reach 80% of revenue
  let cumulativeRevenue = 0;
  const topKeywords: typeof keywordsWithMetrics = [];
  
  for (const kw of keywordsWithMetrics) {
    cumulativeRevenue += kw.revenue;
    topKeywords.push(kw);
    if (cumulativeRevenue >= targetRevenue) {
      break;
    }
  }
  
  const top20PercentCount = Math.ceil(totalKeywords * 0.2);
  const top20PercentKeywords = keywordsWithMetrics.slice(0, top20PercentCount);
  const top20PercentRevenue = top20PercentKeywords.reduce((sum, k) => sum + k.revenue, 0);
  
  console.log(`\n🎯 PARETO ANALYSIS:\n`);
  console.log(`Top ${topKeywords.length} keywords produce 80% of revenue:`);
  console.log(`  Revenue: $${cumulativeRevenue.toFixed(2)} (${((cumulativeRevenue/totalRevenue)*100).toFixed(2)}%)`);
  console.log(`  Percentage of keywords: ${((topKeywords.length/totalKeywords)*100).toFixed(2)}%\n`);
  
  console.log(`Top 20% of keywords (${top20PercentCount} keywords):`);
  console.log(`  Revenue: $${top20PercentRevenue.toFixed(2)} (${((top20PercentRevenue/totalRevenue)*100).toFixed(2)}%)`);
  
  // Display table - show top keywords that reach 80% revenue
  console.log(`\n\n📋 TOP KEYWORDS PRODUCING 80% OF REVENUE:\n`);
  console.log('Rank | Keyword | Revenue | % of Total | Clicks | Searches | Slugs | RPC | RPS');
  console.log('-----|---------|---------|------------|--------|----------|-------|-----|-----');
  
  topKeywords.forEach((kw, idx) => {
    const keywordDisplay = kw.keyword.length > 50 ? kw.keyword.substring(0, 47) + '...' : kw.keyword;
    const revenuePct = ((kw.revenue / totalRevenue) * 100).toFixed(2);
    const cumPct = ((cumulativeRevenue / totalRevenue) * 100).toFixed(2);
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${keywordDisplay.padEnd(50)} | $${kw.revenue.toFixed(2).padStart(7)} | ${revenuePct.padStart(10)}% | ${kw.clicks.toFixed(0).padStart(6)} | ${kw.searches.toFixed(0).padStart(8)} | ${kw.slug_count.toString().padStart(5)} | $${kw.rpc.toFixed(4)} | $${kw.rps.toFixed(4)}`
    );
  });
  
  // Also show top 50 by revenue (for comparison)
  console.log(`\n\n🏆 TOP 50 KEYWORDS BY REVENUE (Highest Opportunity):\n`);
  console.log('Rank | Keyword | Revenue | % of Total | Clicks | Searches | Slugs | RPC | RPS');
  console.log('-----|---------|---------|------------|--------|----------|-------|-----|-----');
  
  keywordsWithMetrics.slice(0, 50).forEach((kw, idx) => {
    const keywordDisplay = kw.keyword.length > 50 ? kw.keyword.substring(0, 47) + '...' : kw.keyword;
    const revenuePct = ((kw.revenue / totalRevenue) * 100).toFixed(2);
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${keywordDisplay.padEnd(50)} | $${kw.revenue.toFixed(2).padStart(7)} | ${revenuePct.padStart(10)}% | ${kw.clicks.toFixed(0).padStart(6)} | ${kw.searches.toFixed(0).padStart(8)} | ${kw.slug_count.toString().padStart(5)} | $${kw.rpc.toFixed(4)} | $${kw.rps.toFixed(4)}`
    );
  });
  
  // Top by RPS (efficiency)
  const topByRPS = [...keywordsWithMetrics]
    .filter(k => k.revenue >= 100) // Minimum $100 revenue
    .sort((a, b) => b.rps - a.rps)
    .slice(0, 30);
  
  console.log(`\n\n⚡ TOP 30 KEYWORDS BY RPS (Highest Efficiency, Revenue ≥ $100):\n`);
  console.log('Rank | Keyword | Revenue | RPS | RPC | Clicks | Searches | Slugs');
  console.log('-----|---------|---------|-----|-----|--------|----------|-------');
  
  topByRPS.forEach((kw, idx) => {
    const keywordDisplay = kw.keyword.length > 50 ? kw.keyword.substring(0, 47) + '...' : kw.keyword;
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${keywordDisplay.padEnd(50)} | $${kw.revenue.toFixed(2).padStart(7)} | $${kw.rps.toFixed(4).padStart(5)} | $${kw.rpc.toFixed(4).padStart(5)} | ${kw.clicks.toFixed(0).padStart(6)} | ${kw.searches.toFixed(0).padStart(8)} | ${kw.slug_count.toString().padStart(5)}`
    );
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  // Export top 80% keywords
  const csvPath80 = path.join(outputDir, `top_gap_keywords_80pct_${timestamp}.csv`);
  const csvRows80 = [
    ['rank', 'keyword', 'revenue', 'pct_of_total', 'clicks', 'searches', 'slug_count', 'rpc', 'rps'].join(','),
    ...topKeywords.map((kw, idx) => [
      idx + 1,
      `"${kw.keyword.replace(/"/g, '""')}"`,
      kw.revenue.toFixed(2),
      ((kw.revenue / totalRevenue) * 100).toFixed(2),
      kw.clicks.toFixed(0),
      kw.searches.toFixed(0),
      kw.slug_count.toString(),
      kw.rpc.toFixed(4),
      kw.rps.toFixed(4),
    ].join(','))
  ];
  fs.writeFileSync(csvPath80, csvRows80.join('\n'));
  
  // Export top 50 by revenue
  const csvPath50 = path.join(outputDir, `top_gap_keywords_top50_${timestamp}.csv`);
  const csvRows50 = [
    ['rank', 'keyword', 'revenue', 'pct_of_total', 'clicks', 'searches', 'slug_count', 'rpc', 'rps'].join(','),
    ...keywordsWithMetrics.slice(0, 50).map((kw, idx) => [
      idx + 1,
      `"${kw.keyword.replace(/"/g, '""')}"`,
      kw.revenue.toFixed(2),
      ((kw.revenue / totalRevenue) * 100).toFixed(2),
      kw.clicks.toFixed(0),
      kw.searches.toFixed(0),
      kw.slug_count.toString(),
      kw.rpc.toFixed(4),
      kw.rps.toFixed(4),
    ].join(','))
  ];
  fs.writeFileSync(csvPath50, csvRows50.join('\n'));
  
  console.log(`\n✅ Results exported:`);
  console.log(`   Top 80% Revenue Keywords: ${csvPath80}`);
  console.log(`   Top 50 Keywords by Revenue: ${csvPath50}\n`);
}

main().catch((err) => {
  console.error('top_gap_keywords_pareto failed', err);
  process.exit(1);
});



