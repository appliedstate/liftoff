import fs from 'fs';
import path from 'path';
import DuckDB from 'duckdb';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

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

// Extract root phrase from geo-variant keywords
function extractRootPhrase(keyword: string): string {
  const lower = keyword.toLowerCase();
  
  // Common geo patterns
  const geoPatterns = [
    /\b(near me|nearby|in my area|in [a-z]{2}|for [a-z]{2}|[a-z]{2} residents?)\b/i,
    /\b(in|for|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/, // City names
    /\b([A-Z]{2})\b/, // State abbreviations
  ];
  
  // Try to remove geo patterns
  let root = keyword;
  for (const pattern of geoPatterns) {
    root = root.replace(pattern, '').trim();
  }
  
  // Clean up extra spaces and common separators
  root = root.replace(/\s+/g, ' ').trim();
  root = root.replace(/^[,\-–—]\s*|\s*[,\-–—]$/g, '').trim();
  
  // If we removed too much, return original
  if (root.length < keyword.length * 0.5) {
    return keyword;
  }
  
  return root;
}

// Group keywords by root phrase
function groupByRootPhrase(keywords: Array<{ keyword: string; revenue: number; clicks: number; searches: number }>): Map<string, Array<typeof keywords[0]>> {
  const groups = new Map<string, Array<typeof keywords[0]>>();
  
  for (const kw of keywords) {
    const root = extractRootPhrase(kw.keyword);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(kw);
  }
  
  return groups;
}

async function main() {
  const slug = process.argv[2] || 'health/how-paid-weight-loss-trials-offer-cutting-edge-health-solutions/';
  const runDate = process.argv[3] || '2025-11-07';
  
  console.log(`\n=== Keyword Analysis for Slug (80% Revenue) ===\n`);
  console.log(`Slug: ${slug}\n`);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Normalize slug (try with and without trailing slash)
  const normalizedSlugs = [
    slug.trim(),
    slug.trim() + '/',
    slug.trim().replace(/\/$/, ''),
  ];
  
  // Build WHERE clause
  const slugConditions = normalizedSlugs.map(s => {
    const escaped = s.replace(/'/g, "''");
    return `(LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}') OR LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}/'))`;
  }).join(' OR ');
  
  // Query keywords for this slug
  const keywords = await queryCsv(csvPath, `
    SELECT 
      "SERP_KEYWORD" as keyword,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches
    FROM t
    WHERE (${slugConditions})
      AND TRIM("SERP_KEYWORD") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
    GROUP BY keyword
    ORDER BY revenue DESC
  `);
  
  console.log(`Found ${keywords.length} keywords with revenue\n`);
  
  // Process keywords
  const keywordList: Array<{ keyword: string; revenue: number; clicks: number; searches: number }> = keywords.map((r: any) => ({
    keyword: String(r.keyword || '').trim(),
    revenue: Number(r.revenue || 0),
    clicks: Number(r.clicks || 0),
    searches: Number(r.searches || 0),
  }));
  
  const totalRevenue = keywordList.reduce((sum, k) => sum + k.revenue, 0);
  const targetRevenue = totalRevenue * 0.8;
  
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`80% Target: $${targetRevenue.toFixed(2)}\n`);
  
  // Find individual keywords that make up 80%
  let cumulativeRevenue = 0;
  const topKeywords: typeof keywordList = [];
  
  for (const kw of keywordList) {
    cumulativeRevenue += kw.revenue;
    topKeywords.push(kw);
    if (cumulativeRevenue >= targetRevenue) {
      break;
    }
  }
  
  console.log(`\n📊 TOP KEYWORDS PRODUCING 80% OF REVENUE:\n`);
  console.log(`Found ${topKeywords.length} keywords (out of ${keywordList.length} total)\n`);
  
  // Group by root phrase
  const rootGroups = groupByRootPhrase(topKeywords);
  
  const rootPhrases: Array<{
    root: string;
    variants: number;
    revenue: number;
    clicks: number;
    searches: number;
    keywords: string[];
  }> = [];
  
  for (const [root, variants] of rootGroups.entries()) {
    const revenue = variants.reduce((sum, v) => sum + v.revenue, 0);
    const clicks = variants.reduce((sum, v) => sum + v.clicks, 0);
    const searches = variants.reduce((sum, v) => sum + v.searches, 0);
    rootPhrases.push({
      root,
      variants: variants.length,
      revenue,
      clicks,
      searches,
      keywords: variants.map(v => v.keyword).sort(),
    });
  }
  
  rootPhrases.sort((a, b) => b.revenue - a.revenue);
  
  console.log(`\n🔑 ROOT PHRASES (Grouped by Geo Variants):\n`);
  rootPhrases.forEach((rp, idx) => {
    const rpc = rp.clicks > 0 ? rp.revenue / rp.clicks : 0;
    const rps = rp.searches > 0 ? rp.revenue / rp.searches : 0;
    
    console.log(`${(idx + 1).toString().padStart(2)}. "${rp.root}"`);
    console.log(`    Revenue: $${rp.revenue.toFixed(2)} | Clicks: ${rp.clicks.toFixed(0)} | Searches: ${rp.searches.toFixed(0)}`);
    console.log(`    RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)}`);
    console.log(`    Variants: ${rp.variants}`);
    if (rp.variants > 1) {
      console.log(`    Examples: ${rp.keywords.slice(0, 5).join(', ')}${rp.keywords.length > 5 ? ` ... (+${rp.keywords.length - 5} more)` : ''}`);
    }
    console.log('');
  });
  
  console.log(`\n📋 ALL INDIVIDUAL KEYWORDS (Top ${topKeywords.length}):\n`);
  topKeywords.forEach((kw, idx) => {
    const rpc = kw.clicks > 0 ? kw.revenue / kw.clicks : 0;
    const rps = kw.searches > 0 ? kw.revenue / kw.searches : 0;
    const pct = (kw.revenue / totalRevenue * 100).toFixed(1);
    
    console.log(`${(idx + 1).toString().padStart(3)}. "${kw.keyword}"`);
    console.log(`     Revenue: $${kw.revenue.toFixed(2)} (${pct}%) | Clicks: ${kw.clicks.toFixed(0)} | Searches: ${kw.searches.toFixed(0)}`);
    console.log(`     RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)}`);
  });
  
  console.log(`\n📈 CUMULATIVE STATS:\n`);
  console.log(`Total Revenue Covered: $${cumulativeRevenue.toFixed(2)} (${((cumulativeRevenue / totalRevenue) * 100).toFixed(1)}%)`);
  console.log(`Total Keywords: ${topKeywords.length} out of ${keywordList.length}`);
  console.log(`Average RPC: $${(topKeywords.reduce((sum, kw) => sum + (kw.clicks > 0 ? kw.revenue / kw.clicks : 0), 0) / topKeywords.length).toFixed(4)}`);
}

main().catch((err) => {
  console.error('keywords_for_slug_80pct failed', err);
  process.exit(1);
});



