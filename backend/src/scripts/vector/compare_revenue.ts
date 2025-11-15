import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';
import { getPgPool } from '../../lib/pg';

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
  const angleFull = path.resolve(`./runs/system1/${runDate}/angle_full.csv`);
  
  if (!fs.existsSync(angleFull)) {
    console.error(`File not found: ${angleFull}`);
    process.exit(1);
  }

  console.log('\n=== Revenue Comparison: Database vs Source CSV ===\n');

  // 1. Get totals from the database (vectorized data)
  const pool = getPgPool();
  const dbStats = await pool.query(`
    SELECT 
      COUNT(*) as total_rows,
      COUNT(DISTINCT keyword) as unique_keywords,
      SUM(searches) as total_searches,
      SUM(clicks) as total_clicks,
      SUM(revenue) as total_revenue,
      AVG(rpc) as avg_rpc,
      AVG(rps) as avg_rps
    FROM s1_embeddings
    WHERE run_date = $1::date
  `, [runDate]);

  // 2. Get totals from the original CSV
  const csvStats = await queryCsv(angleFull, `
    SELECT 
      COUNT(*) as total_rows,
      COUNT(DISTINCT keyword) as unique_keywords,
      SUM(CAST(searches AS DOUBLE)) as total_searches,
      SUM(CAST(clicks AS DOUBLE)) as total_clicks,
      SUM(CAST(revenue AS DOUBLE)) as total_revenue,
      AVG(CAST(rpc AS DOUBLE)) as avg_rpc,
      AVG(CAST(rps AS DOUBLE)) as avg_rps
    FROM t
  `);

  // 3. Get breakdown by category from CSV
  const csvByCategory = await queryCsv(angleFull, `
    SELECT 
      category,
      COUNT(*) as keyword_count,
      SUM(CAST(searches AS DOUBLE)) as searches,
      SUM(CAST(clicks AS DOUBLE)) as clicks,
      SUM(CAST(revenue AS DOUBLE)) as revenue
    FROM t
    GROUP BY category
    ORDER BY SUM(CAST(revenue AS DOUBLE)) DESC
    LIMIT 20
  `);

  // 4. Get breakdown by category from database
  const dbByCategory = await pool.query(`
    SELECT 
      category,
      COUNT(*) as keyword_count,
      SUM(searches) as searches,
      SUM(clicks) as clicks,
      SUM(revenue) as revenue
    FROM s1_embeddings
    WHERE run_date = $1::date
    GROUP BY category
    ORDER BY SUM(revenue) DESC
    LIMIT 20
  `, [runDate]);

  await pool.end();

  console.log('📊 DATABASE TOTALS:');
  console.log(JSON.stringify({
    total_rows: Number(dbStats.rows[0].total_rows),
    unique_keywords: Number(dbStats.rows[0].unique_keywords),
    total_searches: Number(dbStats.rows[0].total_searches),
    total_clicks: Number(dbStats.rows[0].total_clicks),
    total_revenue: Number(dbStats.rows[0].total_revenue),
    avg_rpc: Number(dbStats.rows[0].avg_rpc),
    avg_rps: Number(dbStats.rows[0].avg_rps)
  }, null, 2));

  console.log('\n📄 CSV FILE TOTALS:');
  console.log(JSON.stringify({
    total_rows: Number(csvStats[0].total_rows),
    unique_keywords: Number(csvStats[0].unique_keywords),
    total_searches: Number(csvStats[0].total_searches),
    total_clicks: Number(csvStats[0].total_clicks),
    total_revenue: Number(csvStats[0].total_revenue),
    avg_rpc: Number(csvStats[0].avg_rpc),
    avg_rps: Number(csvStats[0].avg_rps)
  }, null, 2));

  const dbRevenue = Number(dbStats.rows[0].total_revenue);
  const csvRevenue = Number(csvStats[0].total_revenue);
  const diff = csvRevenue - dbRevenue;
  const pctDiff = ((diff / csvRevenue) * 100).toFixed(2);

  console.log('\n💰 REVENUE COMPARISON:');
  console.log(`Database: $${dbRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`CSV:      $${csvRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Difference: $${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pctDiff}%)`);

  if (Math.abs(diff) > 0.01) {
    console.log('\n⚠️  WARNING: Revenue mismatch detected!');
  } else {
    console.log('\n✅ Revenue totals match!');
  }

  console.log('\n📊 TOP CATEGORIES BY REVENUE (CSV):');
  console.log(JSON.stringify(csvByCategory.map((r: any) => ({
    category: r.category,
    keywords: Number(r.keyword_count),
    searches: Number(r.searches),
    clicks: Number(r.clicks),
    revenue: Number(r.revenue)
  })), null, 2));

  console.log('\n📊 TOP CATEGORIES BY REVENUE (Database):');
  console.log(JSON.stringify(dbByCategory.rows.map((r: any) => ({
    category: r.category,
    keywords: Number(r.keyword_count),
    searches: Number(r.searches),
    clicks: Number(r.clicks),
    revenue: Number(r.revenue)
  })), null, 2));
}

main().catch(console.error);

