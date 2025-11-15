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
  // Get keywords from command line args or file
  const keywordsArg = process.argv[2];
  const keywordsFile = process.argv[3];
  
  let keywords: string[] = [];
  
  if (keywordsFile && fs.existsSync(keywordsFile)) {
    // Read from file (one keyword per line)
    const content = fs.readFileSync(keywordsFile, 'utf-8');
    keywords = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
    console.log(`📄 Loaded ${keywords.length} keywords from file: ${keywordsFile}\n`);
  } else if (keywordsArg) {
    // Parse comma-separated keywords or single keyword
    keywords = keywordsArg.split(',').map(k => k.trim()).filter(k => k.length > 0);
    console.log(`📝 Using ${keywords.length} keyword(s) from command line\n`);
  } else {
    console.error('Usage:');
    console.error('  npx ts-node src/scripts/system1/feasibility_study.ts "<keyword1>,<keyword2>,..."');
    console.error('  npx ts-node src/scripts/system1/feasibility_study.ts "" keywords.txt');
    console.error('');
    console.error('Examples:');
    console.error('  npx ts-node src/scripts/system1/feasibility_study.ts "dental implants,depression trials"');
    console.error('  npx ts-node src/scripts/system1/feasibility_study.ts "" ./keywords.txt');
    process.exit(1);
  }
  
  if (keywords.length === 0) {
    console.error('No keywords provided');
    process.exit(1);
  }
  
  console.log(`\n=== Feasibility Study ===\n`);
  console.log(`Keywords to analyze (${keywords.length}):`);
  keywords.forEach((kw, idx) => console.log(`  ${idx + 1}. "${kw}"`));
  console.log('');
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Get total dataset stats first
  console.log('📊 Calculating total dataset statistics...\n');
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
  `);
  
  const totalRevenue = Number(totalStats[0]?.total_revenue || 0);
  const totalClicks = Number(totalStats[0]?.total_clicks || 0);
  const totalSearches = Number(totalStats[0]?.total_searches || 0);
  const uniqueKeywords = Number(totalStats[0]?.unique_keywords || 0);
  const uniqueSlugs = Number(totalStats[0]?.unique_slugs || 0);
  
  console.log(`📈 TOTAL DATASET STATISTICS:\n`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Unique Keywords: ${uniqueKeywords.toLocaleString()}`);
  console.log(`Unique Slugs: ${uniqueSlugs.toLocaleString()}\n`);
  
  // Search for each keyword
  console.log(`🔍 Analyzing keywords...\n`);
  
  const keywordResults: Array<{
    keyword: string;
    matchedKeywords: string[];
    revenue: number;
    clicks: number;
    searches: number;
    slugCount: number;
    slugs: string[];
    rpc: number;
    rps: number;
  }> = [];
  
  for (const searchTerm of keywords) {
    const escaped = searchTerm.replace(/'/g, "''");
    
    // Use LIKE for partial matching (case-insensitive)
    const matches = await queryCsv(csvPath, `
      SELECT 
        TRIM("SERP_KEYWORD") as keyword,
        TRIM("CONTENT_SLUG") as slug,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
        CAST(COUNT(*) AS INTEGER) as searches
      FROM t
      WHERE LOWER(TRIM("SERP_KEYWORD")) LIKE LOWER('%${escaped}%')
        AND TRIM("CONTENT_SLUG") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      GROUP BY keyword, slug
      ORDER BY revenue DESC
    `);
    
    if (matches.length === 0) {
      keywordResults.push({
        keyword: searchTerm,
        matchedKeywords: [],
        revenue: 0,
        clicks: 0,
        searches: 0,
        slugCount: 0,
        slugs: [],
        rpc: 0,
        rps: 0,
      });
      continue;
    }
    
    // Aggregate results
    const matchedKeywords = [...new Set(matches.map((m: any) => String(m.keyword || '').trim()))];
    const slugs = [...new Set(matches.map((m: any) => String(m.slug || '').trim()))];
    const revenue = matches.reduce((sum: number, m: any) => sum + Number(m.revenue || 0), 0);
    const clicks = matches.reduce((sum: number, m: any) => sum + Number(m.clicks || 0), 0);
    const searches = matches.reduce((sum: number, m: any) => sum + Number(m.searches || 0), 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    keywordResults.push({
      keyword: searchTerm,
      matchedKeywords,
      revenue,
      clicks,
      searches,
      slugCount: slugs.length,
      slugs,
      rpc,
      rps,
    });
  }
  
  // Calculate totals for all keywords
  const combinedRevenue = keywordResults.reduce((sum, r) => sum + r.revenue, 0);
  const combinedClicks = keywordResults.reduce((sum, r) => sum + r.clicks, 0);
  const combinedSearches = keywordResults.reduce((sum, r) => sum + r.searches, 0);
  const combinedSlugs = new Set<string>();
  keywordResults.forEach(r => r.slugs.forEach(s => combinedSlugs.add(s)));
  
  const combinedRPC = combinedClicks > 0 ? combinedRevenue / combinedClicks : 0;
  const combinedRPS = combinedSearches > 0 ? combinedRevenue / combinedSearches : 0;
  
  const revenuePercentage = totalRevenue > 0 ? (combinedRevenue / totalRevenue) * 100 : 0;
  const clicksPercentage = totalClicks > 0 ? (combinedClicks / totalClicks) * 100 : 0;
  const searchesPercentage = totalSearches > 0 ? (combinedSearches / totalSearches) * 100 : 0;
  
  // Display results
  console.log(`\n📋 KEYWORD ANALYSIS:\n`);
  console.log('Keyword | Matched Variants | Revenue | % of Total | Clicks | Searches | Slugs | RPC | RPS');
  console.log('--------|------------------|---------|------------|--------|----------|-------|-----|-----');
  
  keywordResults.forEach((result) => {
    const pct = totalRevenue > 0 ? ((result.revenue / totalRevenue) * 100).toFixed(2) : '0.00';
    const keywordDisplay = result.keyword.length > 40 ? result.keyword.substring(0, 37) + '...' : result.keyword;
    console.log(
      `${keywordDisplay.padEnd(40)} | ${result.matchedKeywords.length.toString().padStart(16)} | $${result.revenue.toFixed(2).padStart(7)} | ${pct.padStart(10)}% | ${result.clicks.toFixed(0).padStart(6)} | ${result.searches.toFixed(0).padStart(8)} | ${result.slugCount.toString().padStart(5)} | $${result.rpc.toFixed(4)} | $${result.rps.toFixed(4)}`
    );
  });
  
  console.log(`\n\n🎯 COMBINED FEASIBILITY ANALYSIS:\n`);
  console.log(`Total Revenue: $${combinedRevenue.toFixed(2)}`);
  console.log(`Percentage of Total Revenue: ${revenuePercentage.toFixed(2)}%`);
  console.log(`Total Clicks: ${combinedClicks.toFixed(0)} (${clicksPercentage.toFixed(2)}% of total)`);
  console.log(`Total Searches: ${combinedSearches.toFixed(0)} (${searchesPercentage.toFixed(2)}% of total)`);
  console.log(`Unique Slugs: ${combinedSlugs.size}`);
  console.log(`Average RPC: $${combinedRPC.toFixed(4)}`);
  console.log(`Average RPS: $${combinedRPS.toFixed(4)}\n`);
  
  // Feasibility assessment
  console.log(`\n💡 FEASIBILITY ASSESSMENT:\n`);
  
  if (revenuePercentage >= 10) {
    console.log(`✅ HIGH FEASIBILITY: These keywords represent ${revenuePercentage.toFixed(2)}% of total revenue.`);
    console.log(`   This is a significant portion of the dataset and suggests strong opportunity.`);
  } else if (revenuePercentage >= 5) {
    console.log(`✅ MODERATE FEASIBILITY: These keywords represent ${revenuePercentage.toFixed(2)}% of total revenue.`);
    console.log(`   This is a meaningful portion, worth considering for targeted campaigns.`);
  } else if (revenuePercentage >= 1) {
    console.log(`⚠️  LOW-MODERATE FEASIBILITY: These keywords represent ${revenuePercentage.toFixed(2)}% of total revenue.`);
    console.log(`   While not a large portion, there may be niche opportunities.`);
  } else {
    console.log(`❌ LOW FEASIBILITY: These keywords represent only ${revenuePercentage.toFixed(2)}% of total revenue.`);
    console.log(`   Consider expanding the keyword list or focusing on higher-volume terms.`);
  }
  
  // Re-query to get slug-level aggregation
  let slugAggregation: any[] = [];
  if (combinedSlugs.size > 0) {
    console.log(`\n📌 TOP SLUGS BY REVENUE:\n`);
    
    slugAggregation = await queryCsv(csvPath, `
      SELECT 
        TRIM("CONTENT_SLUG") as slug,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks
      FROM t
      WHERE (
        ${keywords.map((kw, idx) => {
          const escaped = kw.replace(/'/g, "''");
          return `LOWER(TRIM("SERP_KEYWORD")) LIKE LOWER('%${escaped}%')`;
        }).join(' OR ')}
      )
        AND TRIM("CONTENT_SLUG") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      GROUP BY slug
      ORDER BY revenue DESC
      LIMIT 20
    `);
    
    slugAggregation.forEach((row: any, idx: number) => {
      const slug = String(row.slug || '').trim();
      const revenue = Number(row.revenue || 0);
      const clicks = Number(row.clicks || 0);
      const rpc = clicks > 0 ? revenue / clicks : 0;
      const slugDisplay = slug.length > 70 ? slug.substring(0, 67) + '...' : slug;
      console.log(`  ${(idx + 1).toString().padStart(2)}. ${slugDisplay}`);
      console.log(`     Revenue: $${revenue.toFixed(2)} | Clicks: ${clicks.toFixed(0)} | RPC: $${rpc.toFixed(4)}`);
    });
  }
  
  // Export results
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputFile = path.join(outputDir, `feasibility_study_${timestamp}.json`);
  
  const output = {
    studyDate: new Date().toISOString(),
    keywordsAnalyzed: keywords,
    datasetStats: {
      totalRevenue,
      totalClicks,
      totalSearches,
      uniqueKeywords,
      uniqueSlugs,
    },
    keywordResults: keywordResults.map(r => ({
      keyword: r.keyword,
      matchedKeywords: r.matchedKeywords,
      revenue: r.revenue,
      clicks: r.clicks,
      searches: r.searches,
      slugCount: r.slugCount,
      rpc: r.rpc,
      rps: r.rps,
    })),
    combinedStats: {
      totalRevenue: combinedRevenue,
      revenuePercentage,
      totalClicks: combinedClicks,
      clicksPercentage,
      totalSearches: combinedSearches,
      searchesPercentage,
      uniqueSlugs: combinedSlugs.size,
      averageRPC: combinedRPC,
      averageRPS: combinedRPS,
    },
    topSlugs: slugAggregation.map((row: any) => ({
      slug: String(row.slug || '').trim(),
      revenue: Number(row.revenue || 0),
      clicks: Number(row.clicks || 0),
      rpc: Number(row.clicks || 0) > 0 ? Number(row.revenue || 0) / Number(row.clicks || 0) : 0,
    })),
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n✅ Detailed results exported to: ${outputFile}\n`);
}

main().catch((err) => {
  console.error('feasibility_study failed', err);
  process.exit(1);
});

