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
  const keyword = process.argv[2];
  
  if (!keyword) {
    console.error('Usage: npx ts-node src/scripts/system1/lookup_keyword.ts "<keyword>"');
    console.error('Example: npx ts-node src/scripts/system1/lookup_keyword.ts "$1500 for Dental Implants Participation Near Me"');
    process.exit(1);
  }
  
  console.log(`\n=== Keyword Lookup ===\n`);
  console.log(`Keyword: "${keyword}"\n`);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Query for the keyword (case-insensitive, partial match)
  const escapedKeyword = keyword.replace(/'/g, "''");
  const keywordData = await queryCsv(csvPath, `
    SELECT 
      TRIM("CONTENT_SLUG") as slug,
      TRIM("SERP_KEYWORD") as keyword,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches
    FROM t
    WHERE LOWER(TRIM("SERP_KEYWORD")) LIKE LOWER('%${escapedKeyword}%')
      AND TRIM("CONTENT_SLUG") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug, keyword
    ORDER BY revenue DESC
  `);
  
  if (keywordData.length === 0) {
    console.log(`❌ No matches found for keyword: "${keyword}"\n`);
    console.log(`Trying exact match...\n`);
    
    // Try exact match
    const exactData = await queryCsv(csvPath, `
      SELECT 
        TRIM("CONTENT_SLUG") as slug,
        TRIM("SERP_KEYWORD") as keyword,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
        CAST(COUNT(*) AS INTEGER) as searches
      FROM t
      WHERE TRIM("SERP_KEYWORD") = '${escapedKeyword}'
        AND TRIM("CONTENT_SLUG") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      GROUP BY slug, keyword
      ORDER BY revenue DESC
    `);
    
    if (exactData.length === 0) {
      console.log(`❌ No exact matches found either.\n`);
      console.log(`💡 Try searching for a partial keyword, e.g., "Dental Implants"`);
      process.exit(1);
    }
    
    displayResults(exactData, keyword);
    return;
  }
  
  displayResults(keywordData, keyword);
}

function displayResults(data: any[], searchTerm: string) {
  console.log(`✅ Found ${data.length} keyword-slug combination(s)\n`);
  
  // Calculate totals
  const totalRevenue = data.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
  const totalClicks = data.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
  const totalSearches = data.reduce((sum, r) => sum + Number(r.searches || 0), 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  
  console.log(`📊 SUMMARY:\n`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}`);
  console.log(`Number of Slugs: ${new Set(data.map(r => r.slug)).size}\n`);
  
  console.log(`\n📋 BREAKDOWN BY SLUG:\n`);
  console.log('Rank | Slug | Keyword | Revenue | Clicks | Searches | RPC | RPS');
  console.log('-----|------|---------|---------|--------|----------|-----|-----');
  
  data.forEach((row, idx) => {
    const slug = String(row.slug || '').trim();
    const keyword = String(row.keyword || '').trim();
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    const slugDisplay = slug.length > 60 ? slug.substring(0, 57) + '...' : slug;
    const keywordDisplay = keyword.length > 50 ? keyword.substring(0, 47) + '...' : keyword;
    
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${slugDisplay.padEnd(60)} | ${keywordDisplay.padEnd(50)} | $${revenue.toFixed(2).padStart(7)} | ${clicks.toFixed(0).padStart(6)} | ${searches.toFixed(0).padStart(8)} | $${rpc.toFixed(4)} | $${rps.toFixed(4)}`
    );
  });
  
  // Group by slug to show unique slugs
  const slugMap = new Map<string, { revenue: number; clicks: number; searches: number; keywords: string[] }>();
  
  data.forEach((row: any) => {
    const slug = String(row.slug || '').trim();
    const revenue = Number(row.revenue || 0);
    const clicks = Number(row.clicks || 0);
    const searches = Number(row.searches || 0);
    const keyword = String(row.keyword || '').trim();
    
    if (!slugMap.has(slug)) {
      slugMap.set(slug, { revenue: 0, clicks: 0, searches: 0, keywords: [] });
    }
    
    const entry = slugMap.get(slug)!;
    entry.revenue += revenue;
    entry.clicks += clicks;
    entry.searches += searches;
    if (!entry.keywords.includes(keyword)) {
      entry.keywords.push(keyword);
    }
  });
  
  const slugsByRevenue = Array.from(slugMap.entries())
    .map(([slug, metrics]) => ({ slug, ...metrics }))
    .sort((a, b) => b.revenue - a.revenue);
  
  console.log(`\n\n🏷️  UNIQUE SLUGS (${slugsByRevenue.length} total):\n`);
  slugsByRevenue.forEach((entry, idx) => {
    const rpc = entry.clicks > 0 ? entry.revenue / entry.clicks : 0;
    const rps = entry.searches > 0 ? entry.revenue / entry.searches : 0;
    const slugDisplay = entry.slug.length > 70 ? entry.slug.substring(0, 67) + '...' : entry.slug;
    
    console.log(`${(idx + 1).toString().padStart(2)}. ${slugDisplay}`);
    console.log(`    Revenue: $${entry.revenue.toFixed(2)} | Clicks: ${entry.clicks.toFixed(0)} | Searches: ${entry.searches.toFixed(0)}`);
    console.log(`    RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)}`);
    console.log(`    Keywords: ${entry.keywords.length} variant(s)`);
    if (entry.keywords.length <= 3) {
      entry.keywords.forEach(kw => console.log(`      - "${kw}"`));
    } else {
      entry.keywords.slice(0, 3).forEach(kw => console.log(`      - "${kw}"`));
      console.log(`      ... (${entry.keywords.length - 3} more variants)`);
    }
    console.log('');
  });
}

main().catch((err) => {
  console.error('lookup_keyword failed', err);
  process.exit(1);
});



