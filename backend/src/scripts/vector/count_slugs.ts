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
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  
  if (!fs.existsSync(slugRanked)) {
    console.error(`File not found: ${slugRanked}`);
    process.exit(1);
  }

  console.log(`\n=== Article Slug Count ===\n`);

  // Get total count
  const total = await queryCsv(slugRanked, `
    SELECT 
      COUNT(*) as total_slugs,
      SUM(CAST(num_phrases AS INTEGER)) as total_keywords,
      SUM(CAST(searches AS DOUBLE)) as total_searches,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue
    FROM t
  `);

  // Get breakdown by category/domain if possible
  const byDomain = await queryCsv(slugRanked, `
    SELECT 
      CASE 
        WHEN content_slug LIKE 'health/%' THEN 'health'
        WHEN content_slug LIKE 'finance/%' THEN 'finance'
        WHEN content_slug LIKE 'personal-finance/%' THEN 'personal-finance'
        WHEN content_slug LIKE 'lifestyle/%' THEN 'lifestyle'
        WHEN content_slug LIKE 'well-being/%' THEN 'well-being'
        WHEN content_slug LIKE 'technology-computing/%' THEN 'technology-computing'
        WHEN content_slug LIKE 'rsoc-landers/%' THEN 'rsoc-landers'
        ELSE 'other'
      END as domain,
      COUNT(*) as slug_count,
      SUM(CAST(num_phrases AS INTEGER)) as keywords,
      SUM(CAST(revenue AS DOUBLE)) as revenue
    FROM t
    GROUP BY domain
    ORDER BY slug_count DESC
  `);

  // Top slugs by revenue
  const topSlugs = await queryCsv(slugRanked, `
    SELECT 
      content_slug,
      CAST(num_phrases AS INTEGER) as keywords,
      CAST(revenue AS DOUBLE) as revenue
    FROM t
    ORDER BY CAST(revenue AS DOUBLE) DESC
    LIMIT 10
  `);

  const stats = total[0];
  console.log('📊 TOTAL STATS:');
  console.log(JSON.stringify({
    total_slugs: Number(stats.total_slugs),
    total_keywords: Number(stats.total_keywords),
    total_searches: Number(stats.total_searches),
    total_clicks: Number(stats.total_clicks),
    total_revenue: Number(stats.total_revenue)
  }, null, 2));

  console.log('\n📊 BREAKDOWN BY DOMAIN:');
  console.log(JSON.stringify(byDomain.map((r: any) => ({
    domain: r.domain,
    slugs: Number(r.slug_count),
    keywords: Number(r.keywords),
    revenue: Number(r.revenue)
  })), null, 2));

  console.log('\n📊 TOP 10 SLUGS BY REVENUE:');
  console.log(JSON.stringify(topSlugs.map((r: any) => ({
    slug: r.content_slug,
    keywords: Number(r.keywords),
    revenue: Number(r.revenue)
  })), null, 2));

  // Table format
  console.log('\n📊 TABLE FORMAT - BY DOMAIN:\n');
  console.log('Domain | Slugs | Keywords | Revenue');
  console.log('-------|-------|---------|---------');
  byDomain.forEach((r: any) => {
    const domain = String(r.domain || '').padEnd(20);
    const slugs = Number(r.slug_count).toString().padStart(5);
    const keywords = Number(r.keywords).toString().padStart(8);
    const revenue = Number(r.revenue).toFixed(2).padStart(10);
    console.log(`${domain} | ${slugs} | ${keywords} | $${revenue}`);
  });
}

main().catch(console.error);

