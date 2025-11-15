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
  console.log(`\n=== Clustering Logic Analysis ===\n`);

  console.log(`📋 CURRENT CLUSTERING METHODOLOGY:\n`);
  console.log(`1. DATA STRUCTURE: Union-Find (Disjoint Set Union)`);
  console.log(`   - Each slug starts as its own cluster`);
  console.log(`   - Slugs are merged using ufUnion() when they share keywords`);
  console.log(`\n2. CONNECTIVITY RULE (lines 1265-1273 in analyzeSystem1.ts):`);
  console.log(`   for (const [kw, slugs] of kwToSlugs) {`);
  console.log(`     const angle = kwToAngle.get(kw);`);
  console.log(`     if (!angle) continue;                    // Skip if no angle`);
  console.log(`     if (angle === 'Other') continue;        // Skip "Other" angle`);
  console.log(`     if ((slugs.size || 0) < 3) continue;     // Skip if < 3 slugs`);
  console.log(`     const list = Array.from(slugs);`);
  console.log(`     for (let i = 1; i < list.length; i++)`);
  console.log(`       ufUnion(list[0], list[i], uf);         // Connect ALL slugs`);
  console.log(`   }`);
  console.log(`\n3. THE CRITICAL FLAW:`);
  console.log(`   When a keyword appears in N slugs (where N ≥ 3):`);
  console.log(`   - ALL N slugs are connected to each other`);
  console.log(`   - This happens for EVERY keyword that meets the criteria`);
  console.log(`   - Result: Transitive closure creates giant components`);
  console.log(`\n4. EXAMPLE OF THE PROBLEM:`);
  console.log(`   Keyword "instant loans" appears in 500 slugs`);
  console.log(`   → All 500 slugs get connected (ufUnion called 499 times)`);
  console.log(`   Keyword "cash advance" appears in 400 slugs (300 overlap with above)`);
  console.log(`   → All 400 slugs get connected`);
  console.log(`   Keyword "payday loan" appears in 300 slugs (200 overlap)`);
  console.log(`   → All 300 slugs get connected`);
  console.log(`   Result: ONE giant cluster with 500+ slugs`);
  console.log(`\n5. TRANSITIVE CLOSURE PROBLEM:`);
  console.log(`   - Slug A shares "loan" with Slug B → A and B merge`);
  console.log(`   - Slug B shares "cash" with Slug C → B and C merge`);
  console.log(`   - Slug C shares "advance" with Slug D → C and D merge`);
  console.log(`   - Result: A, B, C, D are all in same cluster`);
  console.log(`   - Even though A and D might share ZERO keywords!`);
  console.log(`\n6. WHY IT CREATES ONE GIANT CLUSTER:`);
  console.log(`   - "Loans" angle has many high-frequency keywords`);
  console.log(`   - These keywords appear across many loan-related slugs`);
  console.log(`   - Each keyword connects all its slugs`);
  console.log(`   - Transitive closure merges everything`);
  console.log(`   - Result: 1,290 slugs in one cluster`);
  console.log(`\n7. WHAT'S MISSING:`);
  console.log(`   ❌ No minimum similarity threshold`);
  console.log(`   ❌ No Jaccard similarity calculation`);
  console.log(`   ❌ No cluster size limits`);
  console.log(`   ❌ No requirement for direct keyword overlap`);
  console.log(`   ❌ Transitive connections without similarity check`);
  console.log(`\n8. BETTER APPROACHES:`);
  console.log(`   Option A: Jaccard Similarity Threshold`);
  console.log(`   - Calculate Jaccard = |A ∩ B| / |A ∪ B|`);
  console.log(`   - Only connect if Jaccard ≥ 0.3 (or similar threshold)`);
  console.log(`   - This ensures slugs are actually similar`);
  console.log(`\n   Option B: Minimum Shared Keywords`);
  console.log(`   - Require ≥10 shared keywords (not just ≥3)`);
  console.log(`   - Reduces transitive connections`);
  console.log(`\n   Option C: Hierarchical Clustering`);
  console.log(`   - Use distance-based clustering (e.g., Ward linkage)`);
  console.log(`   - Cut tree at appropriate similarity level`);
  console.log(`\n   Option D: Community Detection`);
  console.log(`   - Use Louvain or Leiden algorithm`);
  console.log(`   - Finds natural communities in keyword overlap graph`);
  console.log(`\n   Option E: Revenue-Weighted Clustering`);
  console.log(`   - Weight connections by shared revenue, not just keyword count`);
  console.log(`   - Prefer connections with high-value keyword overlap`);

  // Check actual keyword distribution
  const runDate = '2025-11-06';
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  const clusterSummary = path.join(baseDir, 'slug_keyword_cluster_summary.csv');
  
  if (fs.existsSync(clusterSummary)) {
    const topCluster = await queryCsv(clusterSummary, `
      SELECT 
        cluster_id,
        label_keyword,
        label_angle,
        CAST(num_slugs AS INTEGER) as slug_count
      FROM t
      ORDER BY CAST(revenue AS DOUBLE) DESC
      LIMIT 1
    `);

    console.log(`\n9. ACTUAL RESULT:`);
    console.log(`   Top cluster: "${topCluster[0]?.label_keyword}" (${topCluster[0]?.label_angle})`);
    console.log(`   Contains: ${topCluster[0]?.slug_count} slugs`);
    console.log(`   This represents ${((Number(topCluster[0]?.slug_count) / 2746) * 100).toFixed(1)}% of all slugs`);
    console.log(`   This is clearly wrong - one cluster shouldn't have 47% of all slugs!`);
  }
}

main().catch(console.error);

