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
  
  console.log(`\n=== Top Slug Clusters by Revenue ===\n`);

  // Check slug_keyword_cluster_summary.csv
  const clusterSummary = path.join(baseDir, 'slug_keyword_cluster_summary.csv');
  if (!fs.existsSync(clusterSummary)) {
    console.error(`File not found: ${clusterSummary}`);
    process.exit(1);
  }

  // Get top clusters by revenue
  const topClusters = await queryCsv(clusterSummary, `
    SELECT 
      cluster_id,
      label_keyword,
      label_angle,
      CAST(num_slugs AS INTEGER) as slug_count,
      CAST(num_keywords AS INTEGER) as keyword_count,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue,
      CAST(rpc AS DOUBLE) as rpc
    FROM t
    WHERE CAST(revenue AS DOUBLE) > 0
    ORDER BY CAST(revenue AS DOUBLE) DESC
    LIMIT 50
  `);

  // Get total revenue for comparison
  const totals = await queryCsv(clusterSummary, `
    SELECT 
      COUNT(*) as total_clusters,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue,
      SUM(CAST(num_slugs AS INTEGER)) as total_slugs,
      SUM(CAST(num_keywords AS INTEGER)) as total_keywords
    FROM t
    WHERE CAST(revenue AS DOUBLE) > 0
  `);

  const totalRevenue = Number(totals[0]?.total_revenue || 0);
  const totalClusters = Number(totals[0]?.total_clusters || 0);

  console.log('📊 SUMMARY:');
  console.log(`Total Clusters with Revenue: ${totalClusters}`);
  console.log(`Total Revenue (all clusters): $${totalRevenue.toFixed(2)}`);
  console.log(`Expected Total: $533,213.49`);
  console.log(`Coverage: ${((totalRevenue / 533213.49) * 100).toFixed(1)}%`);

  console.log('\n📊 TOP 50 CLUSTERS BY REVENUE:\n');
  console.log(JSON.stringify(topClusters.map((r: any, i: number) => ({
    rank: i + 1,
    cluster_id: r.cluster_id,
    label_keyword: r.label_keyword,
    label_angle: r.label_angle,
    slugs: Number(r.slug_count),
    keywords: Number(r.keyword_count),
    clicks: Number(r.clicks),
    revenue: Number(r.revenue),
    rpc: Number(r.rpc),
    pct_of_total: ((Number(r.revenue) / 533213.49) * 100).toFixed(2) + '%'
  })), null, 2));

  // Table format
  console.log('\n📊 TABLE FORMAT:\n');
  console.log('Rank | Cluster ID | Label Keyword | Angle | Slugs | Keywords | Clicks | Revenue | RPC | % of Total');
  console.log('-----|-----------|---------------|-------|-------|----------|--------|---------|-----|-----------');
  topClusters.forEach((r: any, i: number) => {
    const rank = (i + 1).toString().padStart(4);
    const clusterId = String(r.cluster_id || '').substring(0, 10).padEnd(10);
    const label = (String(r.label_keyword || '') || 'N/A').substring(0, 30).padEnd(30);
    const angle = (String(r.label_angle || 'Other') || 'Other').substring(0, 20).padEnd(20);
    const slugs = Number(r.slug_count).toString().padStart(5);
    const keywords = Number(r.keyword_count).toString().padStart(8);
    const clicks = Number(r.clicks).toFixed(0).padStart(6);
    const revenue = Number(r.revenue).toFixed(2).padStart(8);
    const rpc = Number(r.rpc || 0).toFixed(3).padStart(5);
    const pct = ((Number(r.revenue) / 533213.49) * 100).toFixed(2).padStart(6);
    console.log(`${rank} | ${clusterId} | ${label} | ${angle} | ${slugs} | ${keywords} | ${clicks} | $${revenue} | ${rpc} | ${pct}%`);
  });

  // Cumulative analysis
  const top10Revenue = topClusters.slice(0, 10).reduce((sum, r: any) => sum + Number(r.revenue), 0);
  const top20Revenue = topClusters.slice(0, 20).reduce((sum, r: any) => sum + Number(r.revenue), 0);
  const top50Revenue = topClusters.slice(0, 50).reduce((sum, r: any) => sum + Number(r.revenue), 0);

  console.log('\n📈 CUMULATIVE ANALYSIS:');
  console.log(`Top 10 clusters: $${top10Revenue.toFixed(2)} (${((top10Revenue / 533213.49) * 100).toFixed(1)}% of total)`);
  console.log(`Top 20 clusters: $${top20Revenue.toFixed(2)} (${((top20Revenue / 533213.49) * 100).toFixed(1)}% of total)`);
  console.log(`Top 50 clusters: $${top50Revenue.toFixed(2)} (${((top50Revenue / 533213.49) * 100).toFixed(1)}% of total)`);

  // Breakdown by angle
  const byAngle = await queryCsv(clusterSummary, `
    SELECT 
      label_angle,
      COUNT(*) as cluster_count,
      SUM(CAST(num_slugs AS INTEGER)) as total_slugs,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue
    FROM t
    WHERE CAST(revenue AS DOUBLE) > 0
    GROUP BY label_angle
    ORDER BY SUM(CAST(revenue AS DOUBLE)) DESC
    LIMIT 20
  `);

  console.log('\n📊 TOP ANGLES BY CLUSTER REVENUE:\n');
  console.log('Angle | Clusters | Slugs | Revenue | % of Total');
  console.log('------|----------|-------|---------|-----------');
  byAngle.forEach((r: any) => {
    const angle = (String(r.label_angle || 'Other') || 'Other').substring(0, 30).padEnd(30);
    const clusters = Number(r.cluster_count).toString().padStart(8);
    const slugs = Number(r.total_slugs).toString().padStart(5);
    const revenue = Number(r.total_revenue).toFixed(2).padStart(8);
    const pct = ((Number(r.total_revenue) / 533213.49) * 100).toFixed(2).padStart(6);
    console.log(`${angle} | ${clusters} | ${slugs} | $${revenue} | ${pct}%`);
  });
}

main().catch(console.error);

