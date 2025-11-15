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
  const targetSlug = 'technology-computing/new-google-pixel-smartphone-just-for-you/';
  
  // 1. Get keyword count from content_slug_ranked
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  console.log(`\n=== Slug Details: ${targetSlug} ===\n`);
  
  if (fs.existsSync(slugRanked)) {
    const slugInfo = await queryCsv(slugRanked, `
      SELECT 
        content_slug,
        CAST(num_phrases AS INTEGER) as num_phrases,
        CAST(searches AS DOUBLE) as searches,
        CAST(clicks AS DOUBLE) as clicks,
        CAST(revenue AS DOUBLE) as revenue,
        CAST(rpc AS DOUBLE) as rpc,
        CAST(rps AS DOUBLE) as rps
      FROM t
      WHERE content_slug = '${targetSlug.replace(/'/g, "''")}'
    `);
    console.log('Slug Performance:');
    console.log(JSON.stringify(slugInfo.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
  }

  // 2. Find related slugs from cluster members
  const clusterMembers = path.join(baseDir, 'slug_keyword_cluster_members.csv');
  if (fs.existsSync(clusterMembers)) {
    console.log('\n=== Related Slugs (in same cluster) ===\n');
    // First find which cluster this slug belongs to
    const clusterId = await queryCsv(clusterMembers, `
      SELECT DISTINCT cluster_id
      FROM t
      WHERE slug = '${targetSlug.replace(/'/g, "''")}'
      LIMIT 1
    `);
    
    if (clusterId.length > 0) {
      const cid = clusterId[0].cluster_id;
      console.log(`Cluster ID: ${cid}\n`);
      
      // Get all slugs in the same cluster
      const relatedSlugs = await queryCsv(clusterMembers, `
        SELECT DISTINCT slug
        FROM t
        WHERE cluster_id = '${String(cid).replace(/'/g, "''")}'
          AND slug != '${targetSlug.replace(/'/g, "''")}'
        ORDER BY slug
      `);
      console.log(`Found ${relatedSlugs.length} related slugs in the same cluster:\n`);
      console.log(JSON.stringify(relatedSlugs.map(r => r.slug), null, 2));
    } else {
      console.log('Slug not found in cluster members file');
    }
  }

  // 3. Check slug_clusters_by_angle for angle-based relationships
  const slugClusters = path.join(baseDir, 'slug_clusters_by_angle.csv');
  if (fs.existsSync(slugClusters)) {
    console.log('\n=== Slugs by Angle (if available) ===\n');
    const angleSlugs = await queryCsv(slugClusters, `
      SELECT DISTINCT slug, angle
      FROM t
      WHERE slug LIKE '%google%pixel%' OR slug LIKE '%smartphone%'
      LIMIT 20
    `);
    if (angleSlugs.length > 0) {
      console.log(JSON.stringify(angleSlugs.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? String(v) : v]))), null, 2));
    }
  }

  // 4. Count actual keywords from source data if available
  const sourceData = path.resolve(`./data/system1/incoming`);
  const sourceFiles = fs.existsSync(sourceData) ? fs.readdirSync(sourceData).filter(f => f.endsWith('.csv')) : [];
  if (sourceFiles.length > 0) {
    const latestSource = sourceFiles.sort().reverse()[0];
    const sourcePath = path.join(sourceData, latestSource);
    console.log(`\n=== Keyword Count from Source Data ===\n`);
    try {
      const keywordCount = await queryCsv(sourcePath, `
        SELECT 
          COUNT(DISTINCT SERP_KEYWORD) as unique_keywords,
          SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
          SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue
        FROM t
        WHERE CONTENT_SLUG = '${targetSlug.replace(/'/g, "''")}'
      `);
      console.log(JSON.stringify(keywordCount.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, typeof v === 'bigint' ? Number(v) : v]))), null, 2));
    } catch (e: any) {
      console.log(`Could not query source: ${e.message}`);
    }
  }
}

main().catch(console.error);

