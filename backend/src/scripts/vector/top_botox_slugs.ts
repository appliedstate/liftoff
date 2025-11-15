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
  
  console.log('\n=== Top 10 Botox Slugs by Revenue ===\n');

  // Check content_slug_ranked.csv for slugs with botox in name
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  if (!fs.existsSync(slugRanked)) {
    console.error(`File not found: ${slugRanked}`);
    process.exit(1);
  }

  // Get slugs with "botox" in the slug name
  const slugsByName = await queryCsv(slugRanked, `
    SELECT 
      content_slug as slug,
      CAST(num_phrases AS INTEGER) as keyword_count,
      CAST(searches AS DOUBLE) as searches,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue,
      CAST(rpc AS DOUBLE) as rpc
    FROM t
    WHERE LOWER(content_slug) LIKE '%botox%'
    ORDER BY CAST(revenue AS DOUBLE) DESC
  `);

  // Also check source data for slugs driving botox keyword traffic
  const sourceData = path.resolve(`./data/system1/incoming`);
  let slugsByKeywords: any[] = [];
  
  if (fs.existsSync(sourceData)) {
    const sourceFiles = fs.readdirSync(sourceData).filter(f => f.endsWith('.csv'));
    if (sourceFiles.length > 0) {
      const latestSource = sourceFiles.sort().reverse()[0];
      const sourcePath = path.join(sourceData, latestSource);
      try {
        slugsByKeywords = await queryCsv(sourcePath, `
          SELECT 
            CONTENT_SLUG as slug,
            COUNT(DISTINCT SERP_KEYWORD) as keyword_count,
            SUM(CAST(REPLACE(COALESCE(SELLSIDE_CLICKS_NETWORK, ''), ',', '') AS DOUBLE)) as total_clicks,
            SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) as total_revenue
          FROM t
          WHERE LOWER(SERP_KEYWORD) LIKE '%botox%'
          GROUP BY CONTENT_SLUG
          HAVING SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) > 0
          ORDER BY SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) DESC
          LIMIT 20
        `);
      } catch (e: any) {
        console.log(`Could not query source file: ${e.message}`);
      }
    }
  }

  // Combine and deduplicate by slug, taking the highest revenue
  const slugMap = new Map<string, {
    slug: string;
    keyword_count: number;
    searches: number;
    clicks: number;
    revenue: number;
    rpc: number | null;
    source: string;
  }>();

  // Add slugs from content_slug_ranked
  for (const s of slugsByName) {
    const slug = String(s.slug || '').trim();
    if (!slug) continue;
    slugMap.set(slug, {
      slug,
      keyword_count: Number(s.keyword_count) || 0,
      searches: Number(s.searches) || 0,
      clicks: Number(s.clicks) || 0,
      revenue: Number(s.revenue) || 0,
      rpc: s.rpc != null ? Number(s.rpc) : null,
      source: 'content_slug_ranked'
    });
  }

  // Add/update with slugs from source data (may have more revenue)
  for (const s of slugsByKeywords) {
    const slug = String(s.slug || '').trim();
    if (!slug) continue;
    const existing = slugMap.get(slug);
    const revenue = Number(s.total_revenue) || 0;
    
    if (!existing || revenue > existing.revenue) {
      slugMap.set(slug, {
        slug,
        keyword_count: Number(s.keyword_count) || 0,
        searches: existing?.searches || 0,
        clicks: Number(s.total_clicks) || 0,
        revenue,
        rpc: existing?.rpc || (Number(s.total_clicks) > 0 ? revenue / Number(s.total_clicks) : null),
        source: existing ? 'both' : 'source_data'
      });
    }
  }

  // Sort by revenue and take top 10
  const topSlugs = Array.from(slugMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  console.log('Top 10 Slugs by Revenue:\n');
  console.log(JSON.stringify(topSlugs.map((s, i) => ({
    rank: i + 1,
    slug: s.slug,
    keywords: s.keyword_count,
    searches: s.searches,
    clicks: s.clicks,
    revenue: s.revenue,
    rpc: s.rpc,
    source: s.source
  })), null, 2));

  // Also create a table format
  console.log('\n📊 TABLE FORMAT:\n');
  console.log('Rank | Slug | Keywords | Searches | Clicks | Revenue | RPC');
  console.log('-----|------|----------|----------|--------|---------|-----');
  topSlugs.forEach((s, i) => {
    const slug = s.slug.length > 50 ? s.slug.substring(0, 47) + '...' : s.slug;
    console.log(
      `${(i + 1).toString().padStart(4)} | ${slug.padEnd(50)} | ${s.keyword_count.toString().padStart(8)} | ${s.searches.toFixed(0).padStart(8)} | ${s.clicks.toFixed(1).padStart(6)} | $${s.revenue.toFixed(2).padStart(7)} | ${s.rpc != null ? s.rpc.toFixed(2) : 'N/A'}`
    );
  });
}

main().catch(console.error);

