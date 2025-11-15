import { getPgPool } from '../../lib/pg';
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
  const runDate = process.argv[2] || '2025-11-07';
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Mississippi River Cruise Analysis ===\n`);

  // Check database for all mississippi river cruise slugs
  const pool = getPgPool();
  try {
    const allSlugs = await pool.query(`
      SELECT slug, revenue, clicks, keyword_count
      FROM s1_slug_embeddings
      WHERE run_date = $1
        AND (
          LOWER(slug) LIKE '%mississippi%' 
          OR LOWER(slug) LIKE '%river%cruise%'
          OR LOWER(slug) LIKE '%cruise%river%'
          OR (LOWER(slug) LIKE '%cruise%' AND LOWER(slug) LIKE '%river%')
          OR (LOWER(slug) LIKE '%mississippi%' AND LOWER(slug) LIKE '%cruise%')
        )
      ORDER BY revenue DESC
    `, [runDate.replace(/-/g, '').substring(0, 8) === '20251107' ? '2025-11-06' : runDate]);

    console.log(`🔍 ALL MISSISSIPPI RIVER CRUISE SLUGS IN DATABASE:\n`);
    console.log(`   Total slugs: ${allSlugs.rows.length}\n`);
    
    if (allSlugs.rows.length === 0) {
      console.log('   No slugs found matching "mississippi river cruise"\n');
      return;
    }

    allSlugs.rows.forEach((s: any, i: number) => {
      console.log(`   ${i + 1}. ${s.slug}`);
      console.log(`      Revenue: $${Number(s.revenue || 0).toFixed(2)}, Clicks: ${Number(s.clicks || 0).toFixed(0)}, Keywords: ${s.keyword_count || 0}\n`);
    });

    // Check cluster members
    const membersFile = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
    if (!fs.existsSync(membersFile)) {
      console.log(`\n⚠️  Cluster members file not found: ${membersFile}`);
      return;
    }

    const clusteredSlugs = await queryCsv(membersFile, `
      SELECT DISTINCT cluster_name, slug
      FROM t
      WHERE LOWER(cluster_name) LIKE '%mississippi%' 
         OR LOWER(cluster_name) LIKE '%river%cruise%'
         OR LOWER(cluster_name) LIKE '%cruise%river%'
         OR (LOWER(cluster_name) LIKE '%cruise%' AND LOWER(cluster_name) LIKE '%river%')
         OR LOWER(slug) LIKE '%mississippi%'
         OR LOWER(slug) LIKE '%river%cruise%'
         OR LOWER(slug) LIKE '%cruise%river%'
         OR (LOWER(slug) LIKE '%cruise%' AND LOWER(slug) LIKE '%river%')
    `);

    console.log(`\n📦 CLUSTERING STATUS:\n`);
    
    if (clusteredSlugs.length === 0) {
      console.log(`   ❌ NOT CLUSTERED: None of the slugs are in any cluster\n`);
      console.log(`   This means their similarity to other slugs is below the threshold (< 0.7)\n`);
    } else {
      // Group by cluster
      const clusterMap = new Map<string, string[]>();
      for (const row of clusteredSlugs) {
        const clusterName = row.cluster_name;
        const slug = row.slug;
        if (!clusterMap.has(clusterName)) {
          clusterMap.set(clusterName, []);
        }
        clusterMap.get(clusterName)!.push(slug);
      }

      console.log(`   ✅ CLUSTERED: Found ${clusterMap.size} cluster(s)\n`);
      
      for (const [clusterName, slugs] of clusterMap.entries()) {
        console.log(`   📦 CLUSTER: "${clusterName}"`);
        console.log(`      Contains ${slugs.length} slug(s):\n`);
        slugs.forEach((s, i) => {
          const slugData = allSlugs.rows.find((r: any) => r.slug === s);
          const revenue = slugData ? Number(slugData.revenue || 0) : 0;
          console.log(`      ${i + 1}. ${s} (Revenue: $${revenue.toFixed(2)})`);
        });
        console.log('');
      }

      // Get cluster summary
      const summaryFile = path.join(baseDir, 'slug_clusters_by_embedding_summary.csv');
      if (fs.existsSync(summaryFile)) {
        const clusterSummaries = await queryCsv(summaryFile, `
          SELECT *
          FROM t
          WHERE LOWER(cluster_name) LIKE '%mississippi%' 
             OR LOWER(cluster_name) LIKE '%river%cruise%'
             OR LOWER(cluster_name) LIKE '%cruise%river%'
             OR (LOWER(cluster_name) LIKE '%cruise%' AND LOWER(cluster_name) LIKE '%river%')
        `);
        
        if (clusterSummaries.length > 0) {
          console.log(`\n📊 CLUSTER STATISTICS:\n`);
          clusterSummaries.forEach((c: any) => {
            console.log(`   Cluster: ${c.cluster_name}`);
            console.log(`   Slug Count: ${c.slug_count}`);
            console.log(`   Total Revenue: $${c.total_revenue}`);
            console.log(`   Total Clicks: ${c.total_clicks}`);
            console.log(`   Total Keywords: ${c.total_keywords}`);
            console.log(`   Avg Revenue per Slug: $${c.avg_revenue_per_slug}\n`);
          });
        }
      }
    }

    // Calculate totals
    const totalRevenue = allSlugs.rows.reduce((sum, s) => sum + (Number(s.revenue || 0)), 0);
    const totalClicks = allSlugs.rows.reduce((sum, s) => sum + (Number(s.clicks || 0)), 0);
    const totalKeywords = allSlugs.rows.reduce((sum, s) => sum + (Number(s.keyword_count || 0)), 0);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total slugs: ${allSlugs.rows.length}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Total Clicks: ${totalClicks.toFixed(0)}`);
    console.log(`   Total Keywords: ${totalKeywords}`);
    console.log(`   Clustered: ${clusteredSlugs.length > 0 ? 'Yes' : 'No'}\n`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);

