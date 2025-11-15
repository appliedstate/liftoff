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
  const runDate = process.argv[2] || '2025-11-06';
  const searchTerm = process.argv[3] || 'cruise';
  
  console.log(`\n=== Searching for "${searchTerm}" slugs ===\n`);

  const pool = getPgPool();
  try {
    // Search database
    const dbSlugs = await pool.query(`
      SELECT slug, revenue, clicks, keyword_count
      FROM s1_slug_embeddings
      WHERE run_date = $1
        AND LOWER(slug) LIKE $2
      ORDER BY revenue DESC
      LIMIT 50
    `, [runDate, `%${searchTerm.toLowerCase()}%`]);

    console.log(`🔍 SLUGS IN DATABASE (${dbSlugs.rows.length} found):\n`);
    if (dbSlugs.rows.length === 0) {
      console.log('   No slugs found in database\n');
    } else {
      dbSlugs.rows.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. ${s.slug}`);
        console.log(`      Revenue: $${Number(s.revenue || 0).toFixed(2)}, Clicks: ${Number(s.clicks || 0).toFixed(0)}, Keywords: ${s.keyword_count || 0}\n`);
      });
    }

    // Check cluster members
    const baseDir = path.resolve(`./runs/system1/2025-11-07`);
    const membersFile = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
    
    if (fs.existsSync(membersFile)) {
      const clusteredSlugs = await queryCsv(membersFile, `
        SELECT DISTINCT cluster_name, slug
        FROM t
        WHERE LOWER(cluster_name) LIKE '%${searchTerm.toLowerCase()}%'
           OR LOWER(slug) LIKE '%${searchTerm.toLowerCase()}%'
      `);

      console.log(`\n📦 CLUSTERING STATUS:\n`);
      
      if (clusteredSlugs.length === 0) {
        console.log(`   ❌ NOT CLUSTERED\n`);
      } else {
        const clusterMap = new Map<string, string[]>();
        for (const row of clusteredSlugs) {
          const clusterName = row.cluster_name;
          const slug = row.slug;
          if (!clusterMap.has(clusterName)) {
            clusterMap.set(clusterName, []);
          }
          clusterMap.get(clusterName)!.push(slug);
        }

        console.log(`   ✅ Found in ${clusterMap.size} cluster(s):\n`);
        
        for (const [clusterName, slugs] of clusterMap.entries()) {
          console.log(`   📦 CLUSTER: "${clusterName}"`);
          console.log(`      Contains ${slugs.length} matching slug(s)\n`);
        }

        // Get cluster summary
        const summaryFile = path.join(baseDir, 'slug_clusters_by_embedding_summary.csv');
        if (fs.existsSync(summaryFile)) {
          const clusterSummaries = await queryCsv(summaryFile, `
            SELECT *
            FROM t
            WHERE LOWER(cluster_name) LIKE '%${searchTerm.toLowerCase()}%'
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
    }

  } finally {
    await pool.end();
  }
}

main().catch(console.error);



