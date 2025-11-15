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

// Score root phrases for anchor keyword selection
function scoreRootPhrase(rootPhrase: {
  root: string;
  variants: number;
  revenue: number;
  clicks: number;
  searches: number;
  keywords: string[];
}): number {
  // Factors to consider:
  // 1. Revenue (40% weight)
  // 2. RPC (25% weight)
  // 3. RPS (25% weight) - important for this analysis
  // 4. Variant count (10% weight)
  
  const maxRevenue = 5000; // Normalize to this scale
  const maxRPC = 5.0; // Normalize to this scale
  const maxRPS = 20.0; // Normalize to this scale
  const maxVariants = 10; // Normalize to this scale
  
  const rpc = rootPhrase.clicks > 0 ? rootPhrase.revenue / rootPhrase.clicks : 0;
  const rps = rootPhrase.searches > 0 ? rootPhrase.revenue / rootPhrase.searches : 0;
  
  const revenueScore = Math.min(rootPhrase.revenue / maxRevenue, 1.0) * 0.4;
  const rpcScore = Math.min(rpc / maxRPC, 1.0) * 0.25;
  const rpsScore = Math.min(rps / maxRPS, 1.0) * 0.25;
  const variantScore = Math.min(rootPhrase.variants / maxVariants, 1.0) * 0.1;
  
  // Bonus for shorter phrases (easier to optimize)
  const lengthBonus = rootPhrase.root.length < 50 ? 0.05 : 0;
  
  // Penalty for overly specific phrases
  const specificityPenalty = rootPhrase.root.split(' ').length > 8 ? -0.05 : 0;
  
  return revenueScore + rpcScore + rpsScore + variantScore + lengthBonus + specificityPenalty;
}

async function main() {
  const slug = process.argv[2] || 'health/how-adhd-trials-benefit-participants-and-science-en-us/';
  const runDate = process.argv[3] || '2025-11-07';
  const anchorCount = parseInt(process.argv[4] || '6', 10);
  
  console.log(`\n=== Keyword Analysis with Anchor Recommendations ===\n`);
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
  
  // Normalize slug
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
  
  // Find keywords that make up 80%
  let cumulativeRevenue = 0;
  const topKeywords: typeof keywordList = [];
  
  for (const kw of keywordList) {
    cumulativeRevenue += kw.revenue;
    topKeywords.push(kw);
    if (cumulativeRevenue >= targetRevenue) {
      break;
    }
  }
  
  console.log(`\n📊 KEYWORDS PRODUCING 80% OF REVENUE:\n`);
  console.log(`Found ${topKeywords.length} keywords (out of ${keywordList.length} total)\n`);
  
  // Group by root phrase
  const rootGroups = groupByRootPhrase(keywordList);
  
  const rootPhrases: Array<{
    root: string;
    variants: number;
    revenue: number;
    clicks: number;
    searches: number;
    keywords: string[];
    score: number;
  }> = [];
  
  for (const [root, variants] of rootGroups.entries()) {
    const revenue = variants.reduce((sum, v) => sum + v.revenue, 0);
    const clicks = variants.reduce((sum, v) => sum + v.clicks, 0);
    const searches = variants.reduce((sum, v) => sum + v.searches, 0);
    
    const rp = {
      root,
      variants: variants.length,
      revenue,
      clicks,
      searches,
      keywords: variants.map(v => v.keyword).sort(),
      score: 0,
    };
    
    rp.score = scoreRootPhrase(rp);
    rootPhrases.push(rp);
  }
  
  rootPhrases.sort((a, b) => b.score - a.score);
  
  // Filter for anchor keywords (must be ADHD/clinical trial focused)
  const anchorKeywords = rootPhrases
    .filter(rp => {
      const lower = rp.root.toLowerCase();
      const isRelevant = lower.includes('adhd') || 
                       lower.includes('clinical trial') || 
                       lower.includes('paid trial') ||
                       lower.includes('clinical study');
      const isNotTooSpecific = rp.root.split(' ').length <= 8;
      const hasRevenue = rp.revenue >= 100; // Lower threshold for this slug
      return isRelevant && isNotTooSpecific && hasRevenue;
    })
    .slice(0, anchorCount);
  
  // Sort top keywords by RPS for display
  const sortedByRPS = [...topKeywords].sort((a, b) => {
    const rpsA = a.searches > 0 ? a.revenue / a.searches : 0;
    const rpsB = b.searches > 0 ? b.revenue / b.searches : 0;
    return rpsB - rpsA;
  });
  
  console.log(`\n🏆 TOP KEYWORDS BY RPS (Revenue Per Search):\n`);
  sortedByRPS.slice(0, 20).forEach((kw, idx) => {
    const rpc = kw.clicks > 0 ? kw.revenue / kw.clicks : 0;
    const rps = kw.searches > 0 ? kw.revenue / kw.searches : 0;
    const pct = (kw.revenue / totalRevenue * 100).toFixed(1);
    console.log(`${(idx + 1).toString().padStart(2)}. "${kw.keyword}"`);
    console.log(`    Revenue: $${kw.revenue.toFixed(2)} (${pct}%) | RPS: $${rps.toFixed(4)} | RPC: $${rpc.toFixed(4)} | Searches: ${kw.searches}`);
  });
  
  console.log(`\n\n🔑 ROOT PHRASES (Grouped by Geo Variants):\n`);
  rootPhrases.slice(0, 20).forEach((rp, idx) => {
    const rpc = rp.clicks > 0 ? rp.revenue / rp.clicks : 0;
    const rps = rp.searches > 0 ? rp.revenue / rp.searches : 0;
    const pct = (rp.revenue / totalRevenue * 100).toFixed(1);
    
    console.log(`${(idx + 1).toString().padStart(2)}. "${rp.root}"`);
    console.log(`    Revenue: $${rp.revenue.toFixed(2)} (${pct}%) | Clicks: ${rp.clicks.toFixed(0)} | Searches: ${rp.searches.toFixed(0)}`);
    console.log(`    RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)} | Score: ${rp.score.toFixed(3)}`);
    console.log(`    Variants: ${rp.variants}`);
    if (rp.variants > 1) {
      console.log(`    Examples: ${rp.keywords.slice(0, 3).join(', ')}${rp.keywords.length > 3 ? ` ... (+${rp.keywords.length - 3} more)` : ''}`);
    }
    console.log('');
  });
  
  console.log(`\n\n🎯 RECOMMENDED ${anchorKeywords.length} ANCHOR KEYWORDS (ForceKeys):\n`);
  
  for (let i = 0; i < anchorKeywords.length; i++) {
    const ak = anchorKeywords[i];
    const rpc = ak.clicks > 0 ? ak.revenue / ak.clicks : 0;
    const rps = ak.searches > 0 ? ak.revenue / ak.searches : 0;
    const pct = (ak.revenue / totalRevenue * 100).toFixed(1);
    
    console.log(`${(i + 1).toString().padStart(2)}. "${ak.root}"`);
    console.log(`    📊 Revenue: $${ak.revenue.toFixed(2)} (${pct}%) | Clicks: ${ak.clicks.toFixed(0)} | Searches: ${ak.searches.toFixed(0)}`);
    console.log(`    💰 RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)}`);
    console.log(`    🔄 Variants: ${ak.variants} | Score: ${ak.score.toFixed(3)}`);
    
    // Show why this is a good anchor
    const reasons: string[] = [];
    if (ak.revenue >= 1000) reasons.push('High revenue');
    if (rpc >= 2.0) reasons.push('High RPC');
    if (rps >= 10.0) reasons.push('High RPS');
    if (ak.searches >= 50) reasons.push('Good search volume');
    if (ak.variants > 1) reasons.push('Geo-flexible');
    if (ak.root.length < 40) reasons.push('Optimizable length');
    
    console.log(`    ✅ Why: ${reasons.join(', ')}`);
    
    if (ak.variants > 1) {
      console.log(`    📍 Examples: ${ak.keywords.slice(0, 3).join(', ')}${ak.keywords.length > 3 ? ` ... (+${ak.keywords.length - 3} more)` : ''}`);
    }
    console.log('');
  }
  
  // Summary
  const anchorRevenue = anchorKeywords.reduce((sum, ak) => sum + ak.revenue, 0);
  const anchorRPC = anchorKeywords.reduce((sum, ak) => sum + (ak.clicks > 0 ? ak.revenue / ak.clicks : 0), 0) / anchorKeywords.length;
  const anchorRPS = anchorKeywords.reduce((sum, ak) => sum + (ak.searches > 0 ? ak.revenue / ak.searches : 0), 0) / anchorKeywords.length;
  
  console.log(`\n📈 ANCHOR KEYWORD SUMMARY:\n`);
  console.log(`Total Revenue Covered: $${anchorRevenue.toFixed(2)} (${((anchorRevenue / totalRevenue) * 100).toFixed(1)}%)`);
  console.log(`Average RPC: $${anchorRPC.toFixed(4)}`);
  console.log(`Average RPS: $${anchorRPS.toFixed(4)}`);
  console.log(`Total Variants: ${anchorKeywords.reduce((sum, ak) => sum + ak.variants, 0)}`);
  
  console.log(`\n\n📋 ALL KEYWORDS IN TOP 80%:\n`);
  topKeywords.forEach((kw, idx) => {
    const rpc = kw.clicks > 0 ? kw.revenue / kw.clicks : 0;
    const rps = kw.searches > 0 ? kw.revenue / kw.searches : 0;
    const pct = (kw.revenue / totalRevenue * 100).toFixed(1);
    
    console.log(`${(idx + 1).toString().padStart(3)}. "${kw.keyword}"`);
    console.log(`     Revenue: $${kw.revenue.toFixed(2)} (${pct}%) | RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)}`);
  });
  
  console.log(`\n📈 CUMULATIVE STATS (Top 80%):\n`);
  console.log(`Total Revenue Covered: $${cumulativeRevenue.toFixed(2)} (${((cumulativeRevenue / totalRevenue) * 100).toFixed(1)}%)`);
  console.log(`Total Keywords: ${topKeywords.length} out of ${keywordList.length}`);
}

main().catch((err) => {
  console.error('keywords_for_slug_with_anchors failed', err);
  process.exit(1);
});



