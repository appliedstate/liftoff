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
  
  console.log(`\n=== Slugs for Dental Implant Trials ===\n`);

  // Method 1: Check content_slug_ranked for slugs with "dental implant" in name
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  if (!fs.existsSync(slugRanked)) {
    console.error(`File not found: ${slugRanked}`);
    process.exit(1);
  }

  const slugsByName = await queryCsv(slugRanked, `
    SELECT 
      content_slug,
      CAST(num_phrases AS INTEGER) as keyword_count,
      CAST(searches AS DOUBLE) as searches,
      CAST(clicks AS DOUBLE) as clicks,
      CAST(revenue AS DOUBLE) as revenue,
      CAST(rpc AS DOUBLE) as rpc,
      CAST(rps AS DOUBLE) as rps
    FROM t
    WHERE LOWER(content_slug) LIKE '%dental%implant%'
       OR LOWER(content_slug) LIKE '%dental-implant%'
    ORDER BY CAST(revenue AS DOUBLE) DESC
  `);

  // Method 2: Get slugs from source data that drive dental implant trial keywords
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
          WHERE LOWER(SERP_KEYWORD) LIKE '%dental%implant%trial%'
             OR LOWER(SERP_KEYWORD) LIKE '%dental%implant%clinical%'
             OR (LOWER(SERP_KEYWORD) LIKE '%dental%implant%' AND LOWER(SERP_KEYWORD) LIKE '%trial%')
          GROUP BY CONTENT_SLUG
          HAVING SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) > 0
          ORDER BY SUM(CAST(REPLACE(COALESCE(EST_NET_REVENUE, ''), ',', '') AS DOUBLE)) DESC
        `);
      } catch (e: any) {
        console.log(`Could not query source file: ${e.message}`);
      }
    }
  }

  // Combine and deduplicate
  const slugMap = new Map<string, {
    slug: string;
    keyword_count: number;
    searches: number;
    clicks: number;
    revenue: number;
    rpc: number | null;
    rps: number | null;
    source: string;
  }>();

  // Add slugs from content_slug_ranked
  for (const s of slugsByName) {
    const slug = String(s.content_slug || '').trim();
    if (!slug) continue;
    slugMap.set(slug, {
      slug,
      keyword_count: Number(s.keyword_count) || 0,
      searches: Number(s.searches) || 0,
      clicks: Number(s.clicks) || 0,
      revenue: Number(s.revenue) || 0,
      rpc: s.rpc != null ? Number(s.rpc) : null,
      rps: s.rps != null ? Number(s.rps) : null,
      source: 'content_slug_ranked'
    });
  }

  // Add/update with slugs from source data
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
        rps: existing?.rps || null,
        source: existing ? 'both' : 'source_data'
      });
    }
  }

  // Sort by revenue
  const allSlugs = Array.from(slugMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  console.log(`Found ${allSlugs.length} slugs:\n`);
  console.log(JSON.stringify(allSlugs.map((s, i) => ({
    rank: i + 1,
    slug: s.slug,
    keywords: s.keyword_count,
    searches: s.searches,
    clicks: s.clicks,
    revenue: s.revenue,
    rpc: s.rpc,
    rps: s.rps,
    source: s.source
  })), null, 2));

  // Table format
  console.log('\n📊 TABLE FORMAT:\n');
  console.log('Rank | Slug | Keywords | Searches | Clicks | Revenue | RPC | RPS');
  console.log('-----|------|----------|----------|--------|---------|-----|-----');
  allSlugs.forEach((s, i) => {
    const slug = s.slug.length > 60 ? s.slug.substring(0, 57) + '...' : s.slug;
    const rank = (i + 1).toString().padStart(4);
    const keywords = s.keyword_count.toString().padStart(8);
    const searches = s.searches.toFixed(0).padStart(8);
    const clicks = s.clicks.toFixed(1).padStart(6);
    const revenue = s.revenue.toFixed(2).padStart(7);
    const rpc = s.rpc != null ? s.rpc.toFixed(3).padStart(5) : 'N/A'.padStart(5);
    const rps = s.rps != null ? s.rps.toFixed(3).padStart(5) : 'N/A'.padStart(5);
    console.log(`${rank} | ${slug.padEnd(60)} | ${keywords} | ${searches} | ${clicks} | $${revenue} | ${rpc} | ${rps}`);
  });

  // Summary
  const totalRevenue = allSlugs.reduce((sum, s) => sum + s.revenue, 0);
  const totalSearches = allSlugs.reduce((sum, s) => sum + s.searches, 0);
  const totalClicks = allSlugs.reduce((sum, s) => sum + s.clicks, 0);
  const totalKeywords = allSlugs.reduce((sum, s) => sum + s.keyword_count, 0);

  console.log('\n📈 SUMMARY:');
  console.log(`Total Slugs: ${allSlugs.length}`);
  console.log(`Total Keywords: ${totalKeywords}`);
  console.log(`Total Searches: ${totalSearches.toFixed(0)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(1)}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  if (totalClicks > 0) {
    console.log(`Average RPC: $${(totalRevenue / totalClicks).toFixed(3)}`);
  }
  if (totalSearches > 0) {
    console.log(`Average RPS: $${(totalRevenue / totalSearches).toFixed(3)}`);
  }
}

main().catch(console.error);

