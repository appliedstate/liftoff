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
  const baseDir = path.resolve(`./runs/system1/2025-11-07`);
  
  console.log(`\n=== Nissan Rogue Analysis ===\n`);

  const pool = getPgPool();
  try {
    // Search for keywords containing nissan rogue
    const keywords = await pool.query(`
      SELECT keyword, revenue, clicks, searches, rpc, rps, angle, category
      FROM s1_embeddings
      WHERE run_date = $1
        AND (
          LOWER(keyword) LIKE '%nissan%rogue%'
          OR LOWER(keyword) LIKE '%rogue%nissan%'
        )
      ORDER BY revenue DESC
    `, [runDate]);

    console.log(`🔍 KEYWORDS CONTAINING "nissan rogue":\n`);
    console.log(`   Total keywords: ${keywords.rows.length}\n`);
    
    if (keywords.rows.length === 0) {
      console.log('   No keywords found\n');
    } else {
      keywords.rows.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. "${row.keyword}"`);
        console.log(`      Revenue: $${Number(row.revenue || 0).toFixed(2)}, Clicks: ${Number(row.clicks || 0).toFixed(0)}, Searches: ${row.searches || 0}`);
        console.log(`      Angle: ${row.angle || 'N/A'}, Category: ${row.category || 'N/A'}\n`);
      });
    }

    const keywordRevenue = keywords.rows.reduce((sum: number, r: any) => sum + (Number(r.revenue) || 0), 0);
    const keywordClicks = keywords.rows.reduce((sum: number, r: any) => sum + (Number(r.clicks) || 0), 0);
    const keywordSearches = keywords.rows.reduce((sum: number, r: any) => sum + (Number(r.searches) || 0), 0);

    console.log(`\n📊 KEYWORD SUMMARY:`);
    console.log(`   Total Keywords: ${keywords.rows.length}`);
    console.log(`   Total Revenue: $${keywordRevenue.toFixed(2)}`);
    console.log(`   Total Clicks: ${keywordClicks.toFixed(0)}`);
    console.log(`   Total Searches: ${keywordSearches.toFixed(0)}\n`);

    // Check for slugs
    const slugs = await pool.query(`
      SELECT slug, revenue, clicks, keyword_count
      FROM s1_slug_embeddings
      WHERE run_date = $1
        AND (
          LOWER(slug) LIKE '%nissan%rogue%'
          OR LOWER(slug) LIKE '%rogue%nissan%'
        )
      ORDER BY revenue DESC
    `, [runDate]);

    console.log(`\n🔍 SLUGS CONTAINING "nissan rogue":\n`);
    console.log(`   Total slugs: ${slugs.rows.length}\n`);
    
    if (slugs.rows.length === 0) {
      console.log('   No slugs found\n');
    } else {
      slugs.rows.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. ${row.slug}`);
        console.log(`      Revenue: $${Number(row.revenue || 0).toFixed(2)}, Clicks: ${Number(row.clicks || 0).toFixed(0)}, Keywords: ${row.keyword_count || 0}\n`);
      });
    }

    // Check clustering
    const membersFile = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
    if (fs.existsSync(membersFile)) {
      const clusteredSlugs = await queryCsv(membersFile, `
        SELECT DISTINCT cluster_name, slug
        FROM t
        WHERE LOWER(cluster_name) LIKE '%nissan%'
           OR LOWER(cluster_name) LIKE '%rogue%'
           OR LOWER(slug) LIKE '%nissan%'
           OR LOWER(slug) LIKE '%rogue%'
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
        
        for (const [clusterName, slugsInCluster] of clusterMap.entries()) {
          console.log(`   📦 CLUSTER: "${clusterName}"`);
          console.log(`      Contains ${slugsInCluster.length} matching slug(s)\n`);
        }

        // Get cluster summary
        const summaryFile = path.join(baseDir, 'slug_clusters_by_embedding_summary.csv');
        if (fs.existsSync(summaryFile)) {
          const clusterSummaries = await queryCsv(summaryFile, `
            SELECT *
            FROM t
            WHERE LOWER(cluster_name) LIKE '%nissan%'
               OR LOWER(cluster_name) LIKE '%rogue%'
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



