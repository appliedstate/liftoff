import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const escaped = csvPath.replace(/'/g, "''");
  const run = (q: string) => new Promise<void>((resolve, reject) => (conn as any).run(q, (err: Error | null) => err ? reject(err) : resolve()));
  const all = (q: string) => new Promise<any[]>((resolve, reject) => (conn as any).all(q, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows)));
  await run(`CREATE TABLE t AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true);`);
  const rows = await all(sql);
  conn.close(() => db.close(() => {}));
  return rows;
}

async function main() {
  const runDate = process.argv[2] || '2025-11-06';
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Clustering Logic Explanation ===\n`);

  // Check the top cluster to understand what happened
  const clusterSummary = path.join(baseDir, 'slug_keyword_cluster_summary.csv');
  const topCluster = await queryCsv(clusterSummary, `
    SELECT 
      cluster_id,
      label_keyword,
      label_angle,
      CAST(num_slugs AS INTEGER) as slug_count,
      CAST(num_keywords AS INTEGER) as keyword_count,
      CAST(revenue AS DOUBLE) as revenue
    FROM t
    ORDER BY CAST(revenue AS DOUBLE) DESC
    LIMIT 1
  `);

  const clusterId = topCluster[0]?.cluster_id;
  console.log('🔍 TOP CLUSTER ANALYSIS:');
  console.log(JSON.stringify({
    cluster_id: clusterId,
    label_keyword: topCluster[0]?.label_keyword,
    label_angle: topCluster[0]?.label_angle,
    slug_count: Number(topCluster[0]?.slug_count),
    keyword_count: Number(topCluster[0]?.keyword_count),
    revenue: Number(topCluster[0]?.revenue)
  }, null, 2));

  // Get members of this cluster
  const clusterMembers = path.join(baseDir, 'slug_keyword_cluster_members.csv');
  if (fs.existsSync(clusterMembers)) {
    const members = await queryCsv(clusterMembers, `
      SELECT COUNT(*) as total_slugs
      FROM t
      WHERE cluster_id = '${String(clusterId || '').replace(/'/g, "''")}'
    `);
    console.log(`\nMembers in this cluster: ${members[0]?.total_slugs}`);
  }

  console.log(`\n📋 CLUSTERING LOGIC (from analyzeSystem1.ts):\n`);
  console.log(`1. CONNECTIVITY RULE:`);
  console.log(`   - Slugs connect if they share ≥3 keywords`);
  console.log(`   - Keywords must have a defined angle (not "Other")`);
  console.log(`   - Keywords must appear in ≥3 slugs`);
  console.log(`   - Uses Union-Find data structure to merge connected slugs`);
  console.log(`\n2. THE PROBLEM:`);
  console.log(`   - If keyword "Loans" appears in 1,290 slugs, ALL those slugs get connected`);
  console.log(`   - This creates a "giant component" - one massive cluster`);
  console.log(`   - Union-Find merges everything transitively:`);
  console.log(`     * Slug A shares "loan" with Slug B`);
  console.log(`     * Slug B shares "cash advance" with Slug C`);
  console.log(`     * Slug C shares "payday loan" with Slug D`);
  console.log(`     * Result: A, B, C, D all in same cluster`);
  console.log(`\n3. WHY IT FAILS:`);
  console.log(`   - Too permissive: Only need 3 shared keywords to connect`);
  console.log(`   - Transitive closure: If A→B and B→C, then A→C (even if A and C share nothing)`);
  console.log(`   - No cluster size limits`);
  console.log(`   - No similarity threshold beyond "share 3 keywords"`);
  console.log(`\n4. EXAMPLE:`);
  console.log(`   - "instant loans" appears in 500 loan-related slugs`);
  console.log(`   - "cash advance" appears in 400 of those same slugs`);
  console.log(`   - "payday loan" appears in 300 of those slugs`);
  console.log(`   - Result: All 500+ slugs merge into ONE cluster`);
  console.log(`\n5. WHAT SHOULD HAPPEN:`);
  console.log(`   - Require higher similarity (e.g., ≥10 shared keywords)`);
  console.log(`   - Use Jaccard similarity or cosine similarity`);
  console.log(`   - Limit cluster size or use hierarchical clustering`);
  console.log(`   - Require minimum similarity threshold (e.g., 0.3 Jaccard)`);
  console.log(`   - Or use community detection algorithms (Louvain, Leiden)`);
}

main().catch(console.error);

