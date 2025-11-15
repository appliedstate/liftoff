import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

function getInputPathFromArgs(): string {
  const arg = process.argv.find((a) => a.startsWith('--input='));
  if (arg) {
    return arg.split('=')[1];
  }
  // Default
  return 'data/system1/incoming/System Keyword with Slug_2025-10-30-1645 (1) 2.csv';
}

async function main() {
  const inputPath = getInputPathFromArgs();
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`\n=== Analyzing Input Data ===\n`);
  console.log(`Input file: ${inputPath}\n`);

  const db = new duckdb.Database(':memory:');
  const conn: any = db.connect();

  const exec = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => {
      (conn as any).run(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const all = (sql: string): Promise<any[]> =>
    new Promise((resolve, reject) => {
      (conn as any).all(sql, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  // Use the same CSV loading logic as analyzeSystem1.ts
  const escapedPath = inputPath.replace(/'/g, "''");
  let pivotLoaded = true;
  
  try {
    await exec(`
      CREATE TABLE raw AS
      SELECT * FROM read_csv_auto(
        '${escapedPath}',
        header=true,
        skip=4,
        all_varchar=true,
        ignore_errors=true,
        delim=',',
        quote='"'
      );
    `);

    // Normalize expected pivot columns
    await exec(`
      CREATE VIEW cleaned AS
      SELECT
        row_number() OVER () AS row_id,
        trim("Row Labels") AS row_label,
        TRY_CAST(REPLACE("Sum of SELLSIDE_SEARCHES", ',', '') AS DOUBLE) AS searches,
        TRY_CAST(REPLACE("Sum of SELLSIDE_CLICKS_NETWORK", ',', '') AS DOUBLE) AS clicks,
        TRY_CAST(REPLACE("Sum of EST_NET_REVENUE", ',', '') AS DOUBLE) AS revenue,
        TRY_CAST(REPLACE("Sum of RPS", ',', '') AS DOUBLE) AS rps,
        TRY_CAST(REPLACE("Sum of RPC", ',', '') AS DOUBLE) AS rpc
      FROM raw
      WHERE trim("Row Labels") IS NOT NULL AND trim("Row Labels") <> ''
    `);

    // Infer state from pivot
    await exec(`
      CREATE VIEW annotated AS
      SELECT
        row_id,
        row_label,
        searches,
        clicks,
        revenue,
        rps,
        rpc,
        CASE WHEN regexp_matches(row_label, '^[A-Z]{2}$') THEN row_label ELSE NULL END AS state_label
      FROM cleaned
    `);

    await exec(`
      CREATE VIEW grouped AS
      SELECT
        *,
        CASE WHEN state_label IS NULL THEN 0 ELSE 1 END AS is_state,
        SUM(CASE WHEN state_label IS NULL THEN 0 ELSE 1 END)
          OVER (ORDER BY row_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS grp
      FROM annotated
    `);

    await exec(`
      CREATE VIEW with_state AS
      SELECT
        *,
        MAX(state_label) OVER (PARTITION BY grp) AS state,
        NULL::VARCHAR AS content_slug
      FROM grouped
    `);
  } catch (e) {
    // Fall back to flat schema
    pivotLoaded = false;
    await exec(`DROP VIEW IF EXISTS with_state; DROP VIEW IF EXISTS grouped; DROP VIEW IF EXISTS annotated; DROP VIEW IF EXISTS cleaned; DROP TABLE IF EXISTS raw;`);
    await exec(`
      CREATE TABLE raw AS
      SELECT * FROM read_csv_auto(
        '${escapedPath}',
        header=true,
        all_varchar=true,
        ignore_errors=true,
        delim=',',
        quote='"'
      );
    `);
    await exec(`
      CREATE VIEW with_state AS
      SELECT
        row_number() OVER () AS row_id,
        trim(COALESCE("SERP_KEYWORD", '')) AS row_label,
        NULLIF(trim(COALESCE("REGION_CODE", '')), 'None') AS state,
        trim(COALESCE("CONTENT_SLUG", '')) AS content_slug,
        TRY_CAST(REPLACE(COALESCE("SELLSIDE_SEARCHES", ''), ',', '') AS DOUBLE) AS searches,
        TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE) AS clicks,
        TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) AS revenue
      FROM raw
      WHERE trim(COALESCE("SERP_KEYWORD", '')) <> ''
    `);
  }

  // Filter out 2-letter state totals and keep only keyword rows
  await exec(`
    CREATE VIEW keywords AS
    SELECT * FROM with_state
    WHERE NOT regexp_matches(row_label, '^[A-Z]{2}$')
      AND row_label IS NOT NULL
      AND TRIM(row_label) <> ''
  `);

  // Get statistics
  const stats = await all(`
    SELECT 
      COUNT(*) as total_rows,
      COUNT(DISTINCT row_label) as unique_keywords,
      COUNT(DISTINCT content_slug) as unique_slugs,
      SUM(COALESCE(revenue, 0)) as total_revenue,
      COUNT(DISTINCT state) as unique_states,
      SUM(COALESCE(searches, 0)) as total_searches,
      SUM(COALESCE(clicks, 0)) as total_clicks
    FROM keywords
    WHERE row_label IS NOT NULL AND TRIM(row_label) <> ''
  `);

  const s = stats[0];
  console.log('📊 SUMMARY STATISTICS:\n');
  console.log(`   Total Rows: ${Number(s.total_rows).toLocaleString()}`);
  console.log(`   Unique Keywords: ${Number(s.unique_keywords).toLocaleString()}`);
  console.log(`   Unique Article Slugs: ${Number(s.unique_slugs).toLocaleString()}`);
  console.log(`   Total Revenue: $${Number(s.total_revenue || 0).toFixed(2)}`);
  console.log(`   Total Searches: ${Number(s.total_searches || 0).toLocaleString()}`);
  console.log(`   Total Clicks: ${Number(s.total_clicks || 0).toLocaleString()}`);
  console.log(`   Unique States: ${Number(s.unique_states || 0)}`);
  console.log('');

  // Keyword-Slug relationships
  const keywordSlugStats = await all(`
    SELECT 
      COUNT(*) as keyword_slug_pairs,
      COUNT(DISTINCT row_label) as keywords_with_slugs,
      COUNT(DISTINCT content_slug) as slugs_with_keywords
    FROM keywords
    WHERE row_label IS NOT NULL 
      AND TRIM(row_label) <> ''
      AND content_slug IS NOT NULL 
      AND TRIM(content_slug) <> ''
  `);

  const ks = keywordSlugStats[0];
  console.log('🔗 KEYWORD-SLUG RELATIONSHIPS:\n');
  console.log(`   Total Keyword-Slug Pairs: ${Number(ks.keyword_slug_pairs).toLocaleString()}`);
  console.log(`   Keywords with associated slugs: ${Number(ks.keywords_with_slugs).toLocaleString()}`);
  console.log(`   Slugs with associated keywords: ${Number(ks.slugs_with_keywords).toLocaleString()}`);
  console.log('');

  // Revenue statistics
  const revenueStats = await all(`
    SELECT 
      COUNT(*) as rows_with_revenue,
      SUM(COALESCE(revenue, 0)) as revenue_sum,
      AVG(COALESCE(revenue, 0)) as revenue_avg,
      MIN(COALESCE(revenue, 0)) as revenue_min,
      MAX(COALESCE(revenue, 0)) as revenue_max
    FROM keywords
    WHERE revenue IS NOT NULL AND revenue > 0
  `);

  const rs = revenueStats[0];
  if (rs && Number(rs.rows_with_revenue) > 0) {
    console.log('💰 REVENUE STATISTICS:\n');
    console.log(`   Rows with revenue > 0: ${Number(rs.rows_with_revenue).toLocaleString()}`);
    console.log(`   Total Revenue: $${Number(rs.revenue_sum || 0).toFixed(2)}`);
    console.log(`   Average Revenue per Row: $${Number(rs.revenue_avg || 0).toFixed(2)}`);
    console.log(`   Min Revenue: $${Number(rs.revenue_min || 0).toFixed(2)}`);
    console.log(`   Max Revenue: $${Number(rs.revenue_max || 0).toFixed(2)}`);
    console.log('');
  }

  // Top slugs by revenue
  const topSlugs = await all(`
    SELECT 
      content_slug as slug,
      COUNT(DISTINCT row_label) as keyword_count,
      SUM(COALESCE(revenue, 0)) as revenue,
      SUM(COALESCE(clicks, 0)) as clicks
    FROM keywords
    WHERE content_slug IS NOT NULL 
      AND TRIM(content_slug) <> ''
      AND revenue IS NOT NULL
    GROUP BY content_slug
    ORDER BY revenue DESC
    LIMIT 10
  `);

  console.log('🏆 TOP 10 SLUGS BY REVENUE:\n');
  topSlugs.forEach((row: any, i: number) => {
    console.log(`   ${i + 1}. ${row.slug}`);
    console.log(`      Keywords: ${Number(row.keyword_count).toLocaleString()}, Revenue: $${Number(row.revenue || 0).toFixed(2)}, Clicks: ${Number(row.clicks || 0).toLocaleString()}`);
  });
  console.log('');

  conn.close(() => {
    db.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
