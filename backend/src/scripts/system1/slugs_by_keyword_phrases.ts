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
  const phrases = [
    'Dental implant trials',
    'Home value',
    'Fat removal clinical trials',
    'Diabetes Clinical trials',
    'Bank account bonus',
    'OTC cards',
    'Depression Clinical Trials'
  ];
  
  console.log(`\n=== Slugs Related to Keyword Phrases ===\n`);
  console.log(`Search phrases: ${phrases.join(', ')}\n`);
  
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
  
  // Build WHERE conditions for phrases
  // Match slugs containing phrase OR keywords containing phrase
  const phraseConditions = phrases.map(phrase => {
    const escaped = phrase.replace(/'/g, "''").toLowerCase();
    // Match in slug name
    const slugMatch = `LOWER(TRIM("${slugCol}")) LIKE LOWER('%${escaped}%')`;
    // Match in keyword
    const keywordMatch = `LOWER(TRIM("${keywordCol}")) LIKE LOWER('%${escaped}%')`;
    return `(${slugMatch} OR ${keywordMatch})`;
  }).join(' OR ');
  
  // First, find all slugs that match (either by slug name or by having matching keywords)
  // Then get TOTAL revenue for those slugs from ALL their rows
  const slugData = await queryCsv(csvPath, `
    WITH matching_slugs AS (
      SELECT DISTINCT TRIM("${slugCol}") as slug
      FROM t
      WHERE (${phraseConditions})
        AND "${slugCol}" IS NOT NULL
        AND TRIM("${slugCol}") != ''
    )
    SELECT 
      ms.slug,
      SUM(TRY_CAST(REPLACE(COALESCE(t."${revenueCol}", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE(t."${clicksCol}", ''), ',', '') AS DOUBLE)) as clicks,
      SUM(TRY_CAST(REPLACE(COALESCE(t."${searchesCol}", ''), ',', '') AS DOUBLE)) as searches,
      COUNT(DISTINCT TRIM(t."${keywordCol}")) as keyword_count
    FROM matching_slugs ms
    JOIN t ON TRIM(t."${slugCol}") = ms.slug
    WHERE TRY_CAST(REPLACE(COALESCE(t."${revenueCol}", ''), ',', '') AS DOUBLE) > 0
    GROUP BY ms.slug
    HAVING SUM(TRY_CAST(REPLACE(COALESCE(t."${clicksCol}", ''), ',', '') AS DOUBLE)) > 0
    ORDER BY revenue DESC
  `);
  
  if (slugData.length === 0) {
    console.log(`❌ No slugs found matching any of the phrases\n`);
    process.exit(1);
  }
  
  // Calculate RPC and RPS, and identify which phrases match
  const results = slugData.map((row: any) => {
    const slug = String(row.slug || '').trim().toLowerCase();
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    // Identify which phrases match this slug
    const matchingPhrases = phrases.filter(phrase => 
      slug.includes(phrase.toLowerCase())
    );
    
    return {
      slug: String(row.slug || '').trim(),
      revenue,
      clicks,
      searches,
      keyword_count: Number(row.keyword_count || 0),
      rpc,
      rps,
      matchingPhrases: matchingPhrases.length > 0 ? matchingPhrases : ['keyword match'],
    };
  });
  
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
  const totalSearches = results.reduce((sum, r) => sum + r.searches, 0);
  const totalKeywords = results.reduce((sum, r) => sum + r.keyword_count, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  
  console.log(`📊 SUMMARY:\n`);
  console.log(`Total Slugs Found: ${results.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Total Keywords: ${totalKeywords.toFixed(0)}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}\n`);
  
  // Display table
  console.log(`\n📋 SLUGS (Ranked by Revenue):\n`);
  
  // Calculate column widths
  const maxSlugLength = Math.max(...results.map(r => r.slug.length), 60);
  const slugColWidth = Math.min(maxSlugLength, 80);
  
  // Header
  console.log(
    'Rank'.padStart(4) + ' | ' +
    'Slug'.padEnd(slugColWidth) + ' | ' +
    'Revenue'.padStart(10) + ' | ' +
    'RPC'.padStart(8) + ' | ' +
    'RPS'.padStart(8) + ' | ' +
    'Clicks'.padStart(8) + ' | ' +
    'Searches'.padStart(9) + ' | ' +
    'Match'
  );
  console.log('-'.repeat(4) + '-+-' + '-'.repeat(slugColWidth) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(9) + '-+-' + '-'.repeat(30));
  
  results.forEach((row, idx) => {
    const slugDisplay = row.slug.length > slugColWidth 
      ? row.slug.substring(0, slugColWidth - 3) + '...'
      : row.slug;
    
    const matchDisplay = row.matchingPhrases.join(', ').substring(0, 30);
    
    console.log(
      (idx + 1).toString().padStart(4) + ' | ' +
      slugDisplay.padEnd(slugColWidth) + ' | ' +
      `$${row.revenue.toFixed(2)}`.padStart(10) + ' | ' +
      `$${row.rpc.toFixed(4)}`.padStart(8) + ' | ' +
      `$${row.rps.toFixed(4)}`.padStart(8) + ' | ' +
      row.clicks.toFixed(0).padStart(8) + ' | ' +
      row.searches.toFixed(0).padStart(9) + ' | ' +
      matchDisplay
    );
  });
  
  // Group by phrase for summary
  console.log(`\n\n📊 BREAKDOWN BY PHRASE:\n`);
  phrases.forEach(phrase => {
    const matching = results.filter(r => 
      r.slug.toLowerCase().includes(phrase.toLowerCase()) ||
      r.matchingPhrases.some(p => p.toLowerCase().includes(phrase.toLowerCase()))
    );
    if (matching.length > 0) {
      const phraseRevenue = matching.reduce((sum, r) => sum + r.revenue, 0);
      console.log(`\n"${phrase}": ${matching.length} slug(s), $${phraseRevenue.toFixed(2)} revenue`);
    }
  });
  
  // Export to CSV
  const outputDir = path.resolve(`./runs/system1/2025-11-07`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const csvPath_out = path.join(outputDir, `slugs_by_keyword_phrases_${timestamp}.csv`);
  
  const csvRows = [
    ['rank', 'slug', 'revenue', 'rpc', 'rps', 'clicks', 'searches', 'keyword_count', 'matching_phrases'].join(','),
    ...results.map((r, idx) => [
      (idx + 1).toString(),
      `"${r.slug.replace(/"/g, '""')}"`,
      r.revenue.toFixed(2),
      r.rpc.toFixed(4),
      r.rps.toFixed(4),
      r.clicks.toFixed(0),
      r.searches.toFixed(0),
      r.keyword_count.toString(),
      `"${r.matchingPhrases.join('; ').replace(/"/g, '""')}"`,
    ].join(','))
  ];
  
  fs.writeFileSync(csvPath_out, csvRows.join('\n'));
  
  console.log(`\n✅ Results exported to: ${csvPath_out}\n`);
}

main().catch((err) => {
  console.error('slugs_by_keyword_phrases failed', err);
  process.exit(1);
});

