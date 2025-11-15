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
  
  console.log(`\n=== Botox Cluster Analysis ===\n`);

  // Check cluster members
  const membersFile = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
  if (!fs.existsSync(membersFile)) {
    console.error(`Cluster members file not found: ${membersFile}`);
    process.exit(1);
  }

  const botoxClusters = await queryCsv(membersFile, `
    SELECT DISTINCT cluster_name
    FROM t
    WHERE LOWER(cluster_name) LIKE '%botox%' OR LOWER(slug) LIKE '%botox%'
  `);

  console.log(`Found ${botoxClusters.length} cluster(s) with botox:\n`);
  
  for (const cluster of botoxClusters) {
    const clusterName = cluster.cluster_name;
    console.log(`📦 CLUSTER: "${clusterName}"\n`);
    
    // Get all slugs in this cluster
    const slugs = await queryCsv(membersFile, `
      SELECT slug
      FROM t
      WHERE cluster_name = '${clusterName.replace(/'/g, "''")}'
      ORDER BY slug
    `);
    
    console.log(`   Contains ${slugs.length} slug(s):`);
    slugs.forEach((s: any, i: number) => {
      console.log(`   ${i + 1}. ${s.slug}`);
    });
    console.log('');
  }

  // Check cluster summary
  const summaryFile = path.join(baseDir, 'slug_clusters_by_embedding_summary.csv');
  if (fs.existsSync(summaryFile)) {
    const botoxSummary = await queryCsv(summaryFile, `
      SELECT *
      FROM t
      WHERE LOWER(cluster_name) LIKE '%botox%'
    `);
    
    if (botoxSummary.length > 0) {
      console.log(`📊 CLUSTER STATISTICS:\n`);
      botoxSummary.forEach((c: any) => {
        console.log(`   Cluster: ${c.cluster_name}`);
        console.log(`   Slug Count: ${c.slug_count}`);
        console.log(`   Total Revenue: $${c.total_revenue}`);
        console.log(`   Total Clicks: ${c.total_clicks}`);
        console.log(`   Total Keywords: ${c.total_keywords}`);
        console.log(`   Avg Revenue per Slug: $${c.avg_revenue_per_slug}\n`);
      });
    }
  }

  // Check database for all botox slugs (clustered and unclustered)
  const pool = getPgPool();
  try {
    const allBotoxSlugs = await pool.query(`
      SELECT slug, revenue, clicks, keyword_count
      FROM s1_slug_embeddings
      WHERE run_date = $1
        AND LOWER(slug) LIKE '%botox%'
      ORDER BY revenue DESC
    `, [runDate.replace(/-/g, '').substring(0, 8) === '20251107' ? '2025-11-06' : runDate]);

    console.log(`\n🔍 ALL BOTOX SLUGS IN DATABASE:\n`);
    console.log(`   Total botox slugs: ${allBotoxSlugs.rows.length}\n`);
    
    allBotoxSlugs.rows.forEach((s: any, i: number) => {
      const clustered = botoxClusters.some((c: any) => 
        c.cluster_name.toLowerCase().includes('botox') || 
        s.slug.toLowerCase().includes('botox')
      );
      const status = clustered ? '✅ CLUSTERED' : '❌ NOT CLUSTERED';
      console.log(`   ${i + 1}. ${s.slug}`);
      console.log(`      Revenue: $${Number(s.revenue || 0).toFixed(2)}, Clicks: ${Number(s.clicks || 0).toFixed(0)}, Keywords: ${s.keyword_count || 0} - ${status}\n`);
    });

    const clusteredCount = allBotoxSlugs.rows.filter((s: any) => 
      botoxClusters.some((c: any) => 
        c.cluster_name.toLowerCase().includes('botox') || 
        s.slug.toLowerCase().includes('botox')
      )
    ).length;

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total botox slugs: ${allBotoxSlugs.rows.length}`);
    console.log(`   Clustered: ${clusteredCount}`);
    console.log(`   Not clustered: ${allBotoxSlugs.rows.length - clusteredCount}`);
    
    if (allBotoxSlugs.rows.length > clusteredCount) {
      console.log(`\n⚠️  Some botox slugs are not clustered. They may have:`);
      console.log(`   - Similarity below threshold (< 0.7)`);
      console.log(`   - No other similar slugs to cluster with`);
      console.log(`   - Unique content that doesn't match other botox articles`);
    }

  } finally {
    await pool.end();
  }
}

main().catch(console.error);



