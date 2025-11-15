import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const escaped = csvPath.replace(/'/g, "''");
  const run = (q: string) => new Promise<void>((resolve, reject) => (conn as any).run(q, (err: Error | null) => err ? reject(err) : resolve()));
  const all = (q: string) => new Promise<any[]>((resolve, reject) => (conn as any).all(q, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows)));
  await run(`CREATE TABLE t AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true);`);
  const rows = await all(sql);
  conn.close(() => db.close(() => {}));
  return rows;
}

async function main() {
  const category = process.argv[2] || '';
  const runDate = process.argv[3] || '2025-11-07';
  const limit = parseInt(process.argv[4] || '20', 10);
  
  if (!category) {
    console.error('Usage: ts-node top_slugs_by_rpc_rps.ts <category> [runDate] [limit]');
    console.error('Example: ts-node top_slugs_by_rpc_rps.ts "depression" 2025-11-07 20');
    process.exit(1);
  }

  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Top Slugs by RPC and RPS for Category: ${category} ===\n`);
  console.log(`Run Date: ${runDate}\n`);

  // Try content_slug_ranked.csv first (if it exists)
  const slugRanked = path.join(baseDir, 'content_slug_ranked.csv');
  
  if (fs.existsSync(slugRanked)) {
    console.log('Querying content_slug_ranked.csv...\n');
    
    // Query slugs by category (checking if category appears in slug name or if we have category column)
    const topByRPC = await queryCsv(slugRanked, `
      SELECT 
        content_slug,
        CAST(num_phrases AS INTEGER) as keyword_count,
        CAST(searches AS DOUBLE) as searches,
        CAST(clicks AS DOUBLE) as clicks,
        CAST(revenue AS DOUBLE) as revenue,
        CAST(rpc AS DOUBLE) as rpc,
        CAST(rps AS DOUBLE) as rps
      FROM t
      WHERE LOWER(content_slug) LIKE '%${category.toLowerCase().replace(/'/g, "''")}%'
         OR LOWER(COALESCE(category, '')) LIKE '%${category.toLowerCase().replace(/'/g, "''")}%'
      ORDER BY CAST(rpc AS DOUBLE) DESC
      LIMIT ${limit}
    `);

    const topByRPS = await queryCsv(slugRanked, `
      SELECT 
        content_slug,
        CAST(num_phrases AS INTEGER) as keyword_count,
        CAST(searches AS DOUBLE) as searches,
        CAST(clicks AS DOUBLE) as clicks,
        CAST(revenue AS DOUBLE) as revenue,
        CAST(rpc AS DOUBLE) as rpc,
        CAST(rps AS DOUBLE) as rps
      FROM t
      WHERE LOWER(content_slug) LIKE '%${category.toLowerCase().replace(/'/g, "''")}%'
         OR LOWER(COALESCE(category, '')) LIKE '%${category.toLowerCase().replace(/'/g, "''")}%'
      ORDER BY CAST(rps AS DOUBLE) DESC
      LIMIT ${limit}
    `);

    console.log(`\n=== Top ${limit} Slugs by RPC ===\n`);
    console.table(topByRPC.map(r => ({
      slug: r.content_slug,
      rpc: Number(r.rpc || 0).toFixed(2),
      rps: Number(r.rps || 0).toFixed(4),
      revenue: Number(r.revenue || 0).toFixed(2),
      clicks: Number(r.clicks || 0),
      searches: Number(r.searches || 0),
      keywords: Number(r.keyword_count || 0)
    })));

    console.log(`\n=== Top ${limit} Slugs by RPS ===\n`);
    console.table(topByRPS.map(r => ({
      slug: r.content_slug,
      rps: Number(r.rps || 0).toFixed(4),
      rpc: Number(r.rpc || 0).toFixed(2),
      revenue: Number(r.revenue || 0).toFixed(2),
      clicks: Number(r.clicks || 0),
      searches: Number(r.searches || 0),
      keywords: Number(r.keyword_count || 0)
    })));

    // Combined ranking (weighted: RPC * 0.6 + RPS * 0.4, normalized)
    const combined = await queryCsv(slugRanked, `
      SELECT 
        content_slug,
        CAST(num_phrases AS INTEGER) as keyword_count,
        CAST(searches AS DOUBLE) as searches,
        CAST(clicks AS DOUBLE) as clicks,
        CAST(revenue AS DOUBLE) as revenue,
        CAST(rpc AS DOUBLE) as rpc,
        CAST(rps AS DOUBLE) as rps,
        (CAST(rpc AS DOUBLE) * 0.6 + CAST(rps AS DOUBLE) * 100 * 0.4) as combined_score
      FROM t
      WHERE LOWER(content_slug) LIKE '%${category.toLowerCase().replace(/'/g, "''")}%'
         OR LOWER(COALESCE(category, '')) LIKE '%${category.toLowerCase().replace(/'/g, "''")}%'
        AND CAST(clicks AS DOUBLE) > 10
      ORDER BY combined_score DESC
      LIMIT ${limit}
    `);

    console.log(`\n=== Top ${limit} Slugs by Combined Score (RPC*0.6 + RPS*40) ===\n`);
    console.table(combined.map(r => ({
      slug: r.content_slug,
      score: Number(r.combined_score || 0).toFixed(2),
      rpc: Number(r.rpc || 0).toFixed(2),
      rps: Number(r.rps || 0).toFixed(4),
      revenue: Number(r.revenue || 0).toFixed(2),
      clicks: Number(r.clicks || 0)
    })));

  } else {
    console.error(`File not found: ${slugRanked}`);
    console.error('Available files in run directory:');
    if (fs.existsSync(baseDir)) {
      const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.csv'));
      files.forEach(f => console.error(`  - ${f}`));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});



