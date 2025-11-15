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
  // 1. Revenue (40% weight) - normalized to 0-1 scale
  // 2. RPC (30% weight) - higher is better
  // 3. Search volume (20% weight) - indicates demand
  // 4. Variant count (10% weight) - shows flexibility
  
  const maxRevenue = 10000; // Normalize to this scale
  const maxRPC = 4.0; // Normalize to this scale
  const maxSearches = 1000; // Normalize to this scale
  const maxVariants = 10; // Normalize to this scale
  
  const rpc = rootPhrase.clicks > 0 ? rootPhrase.revenue / rootPhrase.clicks : 0;
  
  const revenueScore = Math.min(rootPhrase.revenue / maxRevenue, 1.0) * 0.4;
  const rpcScore = Math.min(rpc / maxRPC, 1.0) * 0.3;
  const searchScore = Math.min(rootPhrase.searches / maxSearches, 1.0) * 0.2;
  const variantScore = Math.min(rootPhrase.variants / maxVariants, 1.0) * 0.1;
  
  // Bonus for shorter phrases (easier to optimize)
  const lengthBonus = rootPhrase.root.length < 50 ? 0.05 : 0;
  
  // Penalty for overly specific phrases (harder to scale)
  const specificityPenalty = rootPhrase.root.split(' ').length > 8 ? -0.05 : 0;
  
  return revenueScore + rpcScore + searchScore + variantScore + lengthBonus + specificityPenalty;
}

async function main() {
  const clusterName = process.argv[2] || 'health/paid-depression-clinical-trials-up-to-3000-en-us';
  const runDate = process.argv[3] || '2025-11-07';
  const count = parseInt(process.argv[4] || '6', 10);
  
  console.log(`\n=== Anchor Keyword Recommendations ===\n`);
  console.log(`Cluster: ${clusterName}\n`);
  
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  const clusterMembersPath = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
  
  if (!fs.existsSync(clusterMembersPath)) {
    console.error(`Cluster members file not found: ${clusterMembersPath}`);
    process.exit(1);
  }
  
  // Get slugs for this cluster
  const clusterMembers = await queryCsv(clusterMembersPath, `
    SELECT slug FROM t WHERE cluster_name = '${clusterName.replace(/'/g, "''")}'
  `);
  const slugs = clusterMembers.map((r: any) => r.slug);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  
  // Normalize slugs
  const normalizedSlugs = slugs.map(s => {
    const trimmed = s.trim();
    return [trimmed, trimmed + '/', trimmed.replace(/\/$/, '')];
  }).flat();
  
  const slugConditions = normalizedSlugs.map(s => {
    const escaped = s.replace(/'/g, "''");
    return `(LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}') OR LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}/'))`;
  }).join(' OR ');
  
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
  
  const keywordList: Array<{ keyword: string; revenue: number; clicks: number; searches: number }> = keywords.map((r: any) => ({
    keyword: String(r.keyword || '').trim(),
    revenue: Number(r.revenue || 0),
    clicks: Number(r.clicks || 0),
    searches: Number(r.searches || 0),
  }));
  
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
  
  // Sort by score
  rootPhrases.sort((a, b) => b.score - a.score);
  
  // Filter for anchor keywords (must be depression/clinical trial focused, not too specific)
  const anchorKeywords = rootPhrases
    .filter(rp => {
      const lower = rp.root.toLowerCase();
      // Must be relevant to depression/clinical trials
      const isRelevant = lower.includes('depression') || 
                       lower.includes('clinical trial') || 
                       lower.includes('paid trial') ||
                       lower.includes('clinical study');
      // Not too specific (avoid very long phrases)
      const isNotTooSpecific = rp.root.split(' ').length <= 8;
      // Has decent revenue
      const hasRevenue = rp.revenue >= 1000;
      return isRelevant && isNotTooSpecific && hasRevenue;
    })
    .slice(0, count);
  
  console.log(`\n🎯 RECOMMENDED ${anchorKeywords.length} ANCHOR KEYWORDS:\n`);
  
  for (let i = 0; i < anchorKeywords.length; i++) {
    const ak = anchorKeywords[i];
    const rpc = ak.clicks > 0 ? ak.revenue / ak.clicks : 0;
    const rps = ak.searches > 0 ? ak.revenue / ak.searches : 0;
    
    console.log(`${(i + 1).toString().padStart(2)}. "${ak.root}"`);
    console.log(`    📊 Revenue: $${ak.revenue.toFixed(2)} | Clicks: ${ak.clicks.toFixed(0)} | Searches: ${ak.searches.toFixed(0)}`);
    console.log(`    💰 RPC: $${rpc.toFixed(4)} | RPS: $${rps.toFixed(4)}`);
    console.log(`    🔄 Variants: ${ak.variants} | Score: ${ak.score.toFixed(3)}`);
    
    // Show why this is a good anchor
    const reasons: string[] = [];
    if (ak.revenue >= 3000) reasons.push('High revenue');
    if (rpc >= 1.5) reasons.push('High RPC');
    if (ak.searches >= 200) reasons.push('Good search volume');
    if (ak.variants > 1) reasons.push('Geo-flexible');
    if (ak.root.length < 40) reasons.push('Optimizable length');
    
    console.log(`    ✅ Why: ${reasons.join(', ')}`);
    
    if (ak.variants > 1) {
      console.log(`    📍 Examples: ${ak.keywords.slice(0, 3).join(', ')}${ak.keywords.length > 3 ? ` ... (+${ak.keywords.length - 3} more)` : ''}`);
    }
    console.log('');
  }
  
  // Summary rationale
  console.log(`\n💡 RATIONALE FOR SELECTION:\n`);
  console.log(`These ${anchorKeywords.length} keywords were chosen because they:`);
  console.log(`1. Generate significant revenue ($${anchorKeywords.reduce((sum, ak) => sum + ak.revenue, 0).toFixed(2)} combined)`);
  console.log(`2. Have strong RPC (avg: $${(anchorKeywords.reduce((sum, ak) => sum + (ak.clicks > 0 ? ak.revenue / ak.clicks : 0), 0) / anchorKeywords.length).toFixed(2)})`);
  console.log(`3. Are optimizable (can add geo modifiers, adjust wording)`);
  console.log(`4. Represent core intent (depression clinical trials)`);
  console.log(`5. Have proven variants (${anchorKeywords.reduce((sum, ak) => sum + ak.variants, 0)} total variants)`);
  
  // Show coverage
  const totalRevenue = keywordList.reduce((sum, k) => sum + k.revenue, 0);
  const anchorRevenue = anchorKeywords.reduce((sum, ak) => sum + ak.revenue, 0);
  console.log(`\n📈 COVERAGE: ${((anchorRevenue / totalRevenue) * 100).toFixed(1)}% of total cluster revenue`);
}

main().catch((err) => {
  console.error('recommend_anchor_keywords failed', err);
  process.exit(1);
});



