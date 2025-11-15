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

// Check if keyword matches any pareto keyword (fuzzy matching)
function matchesParetoKeyword(keyword: string, paretoKeywords: string[]): boolean {
  const lowerKeyword = keyword.toLowerCase();
  for (const paretoKw of paretoKeywords) {
    const lowerPareto = paretoKw.toLowerCase();
    // Check if pareto keyword is contained in System1 keyword or vice versa
    if (lowerKeyword.includes(lowerPareto) || lowerPareto.includes(lowerKeyword)) {
      return true;
    }
    // Also check for significant word overlap (at least 2 words match)
    const keywordWords = lowerKeyword.split(/\s+/).filter(w => w.length > 2);
    const paretoWords = lowerPareto.split(/\s+/).filter(w => w.length > 2);
    const commonWords = keywordWords.filter(w => paretoWords.includes(w));
    if (commonWords.length >= 2) {
      return true;
    }
  }
  return false;
}

async function main() {
  const paretoFile = process.argv[2] || 'backend/reports/s1/pareto_2025-11-08.csv';
  
  console.log(`\n=== Pareto Gap Analysis ===\n`);
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
  
  // Get total dataset stats (excluding leadgen)
  console.log('📊 Calculating total System1 dataset statistics (excluding leadgen)...\n');
  const totalStats = await queryCsv(csvPath, `
    SELECT 
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as total_revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as total_clicks,
      CAST(COUNT(*) AS INTEGER) as total_searches,
      COUNT(DISTINCT TRIM("SERP_KEYWORD")) as unique_keywords,
      COUNT(DISTINCT TRIM("CONTENT_SLUG")) as unique_slugs
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
  `);
  
  const totalRevenue = Number(totalStats[0]?.total_revenue || 0);
  const totalClicks = Number(totalStats[0]?.total_clicks || 0);
  const totalSearches = Number(totalStats[0]?.total_searches || 0);
  const uniqueKeywords = Number(totalStats[0]?.unique_keywords || 0);
  const uniqueSlugs = Number(totalStats[0]?.unique_slugs || 0);
  
  console.log(`📈 TOTAL SYSTEM1 DATASET (No Leadgen):\n`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Unique Keywords: ${uniqueKeywords.toLocaleString()}`);
  console.log(`Unique Slugs: ${uniqueSlugs.toLocaleString()}\n`);
  
  // Analyze Pareto keywords coverage
  console.log(`🔍 Analyzing Pareto keyword coverage in System1...\n`);
  
  let paretoMatchedRevenue = 0;
  let paretoMatchedClicks = 0;
  let paretoMatchedSearches = 0;
  const matchedKeywords = new Set<string>();
  
  for (const paretoKw of paretoKeywords) {
    const escaped = paretoKw.replace(/'/g, "''");
    const matches = await queryCsv(csvPath, `
      SELECT 
        TRIM("SERP_KEYWORD") as keyword,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
        CAST(COUNT(*) AS INTEGER) as searches
      FROM t
      WHERE LOWER(TRIM("SERP_KEYWORD")) LIKE LOWER('%${escaped}%')
        AND TRIM("CONTENT_SLUG") != ''
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
      GROUP BY keyword
    `);
    
    matches.forEach((m: any) => {
      matchedKeywords.add(String(m.keyword || '').trim());
      paretoMatchedRevenue += Number(m.revenue || 0);
      paretoMatchedClicks += Number(m.clicks || 0);
      paretoMatchedSearches += Number(m.searches || 0);
    });
  }
  
  const paretoCoveragePct = totalRevenue > 0 ? (paretoMatchedRevenue / totalRevenue) * 100 : 0;
  
  console.log(`✅ PARETO KEYWORD COVERAGE:\n`);
  console.log(`Matched Keywords: ${matchedKeywords.size}`);
  console.log(`Revenue Covered: $${paretoMatchedRevenue.toFixed(2)}`);
  console.log(`Percentage of Total Revenue: ${paretoCoveragePct.toFixed(2)}%`);
  console.log(`Clicks: ${paretoMatchedClicks.toFixed(0)}`);
  console.log(`Searches: ${paretoMatchedSearches.toFixed(0)}\n`);
  
  // Find gaps - high revenue keywords NOT in Pareto
  console.log(`🔎 Finding growth opportunities (keywords NOT in Pareto)...\n`);
  
  // Build SQL condition to exclude Pareto-matched keywords
  // Use the same LIKE logic as Pareto matching
  const paretoExclusions = paretoKeywords.map(kw => {
    const escaped = kw.replace(/'/g, "''");
    return `LOWER(TRIM("SERP_KEYWORD")) NOT LIKE LOWER('%${escaped}%')`;
  }).join(' AND ');
  
  // Get all System1 keywords with revenue, excluding leadgen AND Pareto-matched keywords
  const allSystem1Keywords = await queryCsv(csvPath, `
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
  
  // All keywords returned are gaps (already filtered in SQL)
  const gapKeywords = allSystem1Keywords;
  
  // Calculate metrics for gap keywords
  const gapKeywordsWithMetrics = gapKeywords.map((row: any) => {
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
  
  const gapTotalRevenue = gapKeywordsWithMetrics.reduce((sum, k) => sum + k.revenue, 0);
  const gapTotalClicks = gapKeywordsWithMetrics.reduce((sum, k) => sum + k.clicks, 0);
  const gapTotalSearches = gapKeywordsWithMetrics.reduce((sum, k) => sum + k.searches, 0);
  const gapCoveragePct = totalRevenue > 0 ? (gapTotalRevenue / totalRevenue) * 100 : 0;
  
  console.log(`\n💡 GAP ANALYSIS RESULTS:\n`);
  console.log(`Keywords NOT in Pareto: ${gapKeywordsWithMetrics.length}`);
  console.log(`Potential Revenue: $${gapTotalRevenue.toFixed(2)}`);
  console.log(`Percentage of Total Revenue: ${gapCoveragePct.toFixed(2)}%`);
  console.log(`Clicks: ${gapTotalClicks.toFixed(0)}`);
  console.log(`Searches: ${gapTotalSearches.toFixed(0)}`);
  console.log(`Average RPC: $${(gapTotalClicks > 0 ? gapTotalRevenue / gapTotalClicks : 0).toFixed(4)}`);
  console.log(`Average RPS: $${(gapTotalSearches > 0 ? gapTotalRevenue / gapTotalSearches : 0).toFixed(4)}\n`);
  
  // Show top opportunities
  const topOpportunities = gapKeywordsWithMetrics
    .filter(k => k.revenue >= 100) // Minimum $100 revenue threshold
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50);
  
  console.log(`\n🚀 TOP 50 GROWTH OPPORTUNITIES (Not in Pareto, Revenue ≥ $100):\n`);
  console.log('Rank | Keyword | Revenue | Clicks | Searches | Slugs | RPC | RPS');
  console.log('-----|---------|---------|--------|----------|-------|-----|-----');
  
  topOpportunities.forEach((kw, idx) => {
    const keywordDisplay = kw.keyword.length > 50 ? kw.keyword.substring(0, 47) + '...' : kw.keyword;
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${keywordDisplay.padEnd(50)} | $${kw.revenue.toFixed(2).padStart(7)} | ${kw.clicks.toFixed(0).padStart(6)} | ${kw.searches.toFixed(0).padStart(8)} | ${kw.slug_count.toString().padStart(5)} | $${kw.rpc.toFixed(4)} | $${kw.rps.toFixed(4)}`
    );
  });
  
  // Export results
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  // Export gap keywords CSV
  const gapCsvPath = path.join(outputDir, `gap_opportunities_${timestamp}.csv`);
  const gapCsvRows = [
    ['keyword', 'revenue', 'clicks', 'searches', 'slug_count', 'rpc', 'rps'].join(','),
    ...gapKeywordsWithMetrics
      .filter(k => k.revenue >= 100)
      .sort((a, b) => b.revenue - a.revenue)
      .map(k => [
        `"${k.keyword.replace(/"/g, '""')}"`,
        k.revenue.toFixed(2),
        k.clicks.toFixed(0),
        k.searches.toFixed(0),
        k.slug_count.toString(),
        k.rpc.toFixed(4),
        k.rps.toFixed(4),
      ].join(','))
  ];
  fs.writeFileSync(gapCsvPath, gapCsvRows.join('\n'));
  
  // Export summary JSON
  const summaryPath = path.join(outputDir, `pareto_gap_analysis_${timestamp}.json`);
  const summary = {
    analysisDate: new Date().toISOString(),
    paretoFile,
    paretoKeywordCount: paretoKeywords.length,
    system1Stats: {
      totalRevenue,
      totalClicks,
      totalSearches,
      uniqueKeywords,
      uniqueSlugs,
    },
    paretoCoverage: {
      matchedKeywords: matchedKeywords.size,
      revenue: paretoMatchedRevenue,
      revenuePercentage: paretoCoveragePct,
      clicks: paretoMatchedClicks,
      searches: paretoMatchedSearches,
    },
    gapOpportunities: {
      keywordCount: gapKeywordsWithMetrics.length,
      totalRevenue: gapTotalRevenue,
      revenuePercentage: gapCoveragePct,
      totalClicks: gapTotalClicks,
      totalSearches: gapTotalSearches,
      averageRPC: gapTotalClicks > 0 ? gapTotalRevenue / gapTotalClicks : 0,
      averageRPS: gapTotalSearches > 0 ? gapTotalRevenue / gapTotalSearches : 0,
    },
    topOpportunities: topOpportunities.map(k => ({
      keyword: k.keyword,
      revenue: k.revenue,
      clicks: k.clicks,
      searches: k.searches,
      slug_count: k.slug_count,
      rpc: k.rpc,
      rps: k.rps,
    })),
  };
  
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log(`\n✅ Results exported:`);
  console.log(`   Gap Opportunities CSV: ${gapCsvPath}`);
  console.log(`   Summary JSON: ${summaryPath}\n`);
}

main().catch((err) => {
  console.error('pareto_gap_analysis failed', err);
  process.exit(1);
});

