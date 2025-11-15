import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import { getPgPool } from '../../lib/pg';
import duckdb from 'duckdb';
import fs from 'fs';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Extract unique slugs from the source CSV - using same logic as analyzeSystem1.ts
async function extractSlugs(inputCsvPath: string): Promise<Array<{ slug: string; slug_norm: string; revenue: number; clicks: number; keyword_count: number }>> {
  if (!fs.existsSync(inputCsvPath)) {
    throw new Error(`Input CSV not found: ${inputCsvPath}`);
  }

  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const escaped = inputCsvPath.replace(/'/g, "''");
  
  const run = (q: string) => new Promise<void>((resolve, reject) => (conn as any).run(q, (err: Error | null) => err ? reject(err) : resolve()));
  const all = (q: string) => new Promise<any[]>((resolve, reject) => (conn as any).all(q, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows)));

  let pivotLoaded = true;
  try {
    // Drop any existing tables/views first
    await run(`DROP VIEW IF EXISTS unpivoted; DROP TABLE IF EXISTS raw;`);
    
    // Try pivoted format first (same as analyzeSystem1.ts)
    await run(`
      CREATE TABLE raw AS
      SELECT * FROM read_csv_auto(
        '${escaped}',
        header=true,
        skip=4,
        all_varchar=true,
        ignore_errors=true,
        delim=',',
        quote='"'
      );
    `);

    // Get all column names
    const cols = await all(`DESCRIBE raw`);
    const colNames = cols.map((c: any) => c.column_name);
    
    // Check if it's pivoted format (has "Row Labels" and "Sum of" columns)
    const hasRowLabels = colNames.some((n: string) => n.includes('Row Labels'));
    const hasSumColumns = colNames.some((n: string) => n.includes('Sum of'));
    
    if (hasRowLabels && hasSumColumns) {
      // Pivoted format - slugs are column names (everything except Row Labels and Sum columns)
      const slugCols = colNames
        .filter((n: string) => !n.includes('Row Labels') && !n.includes('Sum of'))
        .map((n: string) => `"${n.replace(/'/g, "''")}"`);

      if (slugCols.length === 0) {
        throw new Error('No slug columns found in pivoted format');
      }

      // For pivoted format, slugs are column names
      // We need to unpivot to get keyword-slug pairs, then aggregate by slug
      // First, get revenue data (from "Sum of EST_NET_REVENUE" column if it exists, or from unpivoted values)
      const hasRevenueCol = colNames.some((n: string) => n.includes('EST_NET_REVENUE') || n.includes('REVENUE'));
      const hasClicksCol = colNames.some((n: string) => n.includes('CLICKS'));
      
      // For now, we'll extract slugs from column names and use a simpler approach
      // In pivoted format, each column (except Row Labels and Sum columns) is a slug
      // We'll need to query the actual data to get revenue/clicks per slug
      
      // Create a view that unpivots the slug columns
      await run(`
        CREATE VIEW unpivoted AS
        SELECT 
          trim("Row Labels") as keyword,
          column_name as slug,
          TRY_CAST(REPLACE(COALESCE(value, ''), ',', '') AS DOUBLE) as value
        FROM (
          SELECT * FROM raw
          WHERE trim("Row Labels") IS NOT NULL 
            AND trim("Row Labels") <> ''
            AND NOT regexp_matches(trim("Row Labels"), '^[A-Z]{2}$')
        ) UNPIVOT (
          value FOR column_name IN (${slugCols.join(', ')})
        )
        WHERE value IS NOT NULL 
          AND TRIM(value) != ''
          AND TRY_CAST(REPLACE(COALESCE(value, ''), ',', '') AS DOUBLE) > 0
      `);

      // Get slugs with aggregated metrics
      // Note: In pivoted format, we only have one value column, so we'll use it for revenue
      // and estimate clicks/keyword_count from the data
      const slugs = await all(`
        SELECT 
          slug,
          COUNT(DISTINCT keyword) as keyword_count,
          SUM(value) as revenue,
          COUNT(*) as row_count
        FROM unpivoted
        WHERE slug IS NOT NULL AND TRIM(slug) != ''
        GROUP BY slug
      `);

      // For pivoted format, we don't have separate clicks data easily accessible
      // We'll set clicks to 0 or estimate from revenue
      return slugs.map((r: any) => ({
        slug: String(r.slug || '').trim(),
        slug_norm: String(r.slug || '').trim().toLowerCase(),
        revenue: Number(r.revenue) || 0,
        clicks: 0, // Will need to be populated from another source or estimated
        keyword_count: Number(r.keyword_count) || 0,
      }));
    } else {
      // Not pivoted, try flat format
      pivotLoaded = false;
      throw new Error('Not pivoted format, trying flat');
    }
  } catch (e) {
    // Fall back to flat format
    await run(`DROP VIEW IF EXISTS unpivoted; DROP TABLE IF EXISTS raw;`);
    
    await run(`
      CREATE TABLE raw AS
      SELECT * FROM read_csv_auto(
        '${escaped}',
        header=true,
        all_varchar=true,
        ignore_errors=true,
        delim=',',
        quote='"'
      );
    `);

    const slugs = await all(`
      SELECT 
        trim(COALESCE("CONTENT_SLUG", '')) as slug,
        COUNT(DISTINCT trim(COALESCE("SERP_KEYWORD", ''))) as keyword_count,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks
      FROM raw
      WHERE trim(COALESCE("CONTENT_SLUG", '')) <> ''
        AND trim(COALESCE("SERP_KEYWORD", '')) <> ''
      GROUP BY slug
    `);

    return slugs.map((r: any) => ({
      slug: String(r.slug || '').trim(),
      slug_norm: String(r.slug || '').trim().toLowerCase(),
      revenue: Number(r.revenue) || 0,
      clicks: Number(r.clicks) || 0,
      keyword_count: Number(r.keyword_count) || 0,
    }));
  } finally {
    conn.close(() => db.close(() => {}));
  }
}

async function main() {
  const runDate = getArg('runDate');
  const input = getArg('input');
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const embedVersion = process.env.EMBEDDING_VERSION || 'v1';
  const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '256', 10);
  const concurrency = parseInt(process.env.EMBEDDING_CONCURRENCY || '5', 10);
  const limit = getArg('limit') ? parseInt(String(getArg('limit')), 10) : undefined;

  if (!runDate) {
    console.error('Missing --runDate (YYYY-MM-DD)');
    process.exit(1);
  }
  if (!input) {
    console.error('Missing --input path to source CSV');
    process.exit(1);
  }

  const abs = path.resolve(input);
  let slugs = await extractSlugs(abs);
  
  // Remove trailing slashes and normalize
  slugs = slugs.map(s => ({
    ...s,
    slug: s.slug.replace(/\/$/, ''),
    slug_norm: s.slug_norm.replace(/\/$/, ''),
  }));

  // Deduplicate by normalized slug
  const slugMap = new Map<string, typeof slugs[0]>();
  for (const s of slugs) {
    const existing = slugMap.get(s.slug_norm);
    if (!existing || s.revenue > existing.revenue) {
      slugMap.set(s.slug_norm, s);
    }
  }
  slugs = Array.from(slugMap.values());

  if (limit && Number.isFinite(limit) && limit > 0) {
    slugs = slugs.slice(0, limit);
  }
  
  console.log(`Loaded ${slugs.length} unique slugs from ${abs}${limit ? ` (limited to ${limit})` : ''}`);

  const pool = getPgPool();
  const client = await pool.connect();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stats = { total: slugs.length, embedded: 0, reused: 0, failed: 0 };

  try {
    // Pre-check which hash_keys exist
    const keys = slugs.map((s) => {
      const key = sha256(`${s.slug_norm}|${model}|${embedVersion}`);
      return { key, slug: s };
    });
    const keySet = new Set(keys.map((k) => k.key));
    const existing = new Set<string>();
    if (keySet.size > 0) {
      const placeholders = Array.from(keySet).map((_, i) => `$${i + 1}`).join(',');
      const checkSql = `SELECT hash_key FROM s1_slug_embeddings WHERE hash_key = ANY(ARRAY[${placeholders}])`;
      const existingRes = await client.query(checkSql, Array.from(keySet));
      for (const r of existingRes.rows) existing.add(r.hash_key);
    }

    const needEmbed = keys.filter((k) => !existing.has(k.key));
    stats.reused = slugs.length - needEmbed.length;

    console.log(`Embedding ${needEmbed.length} new of ${slugs.length} (${stats.reused} cached)`);

    const batches = chunk(needEmbed, batchSize);
    let idx = 0;
    while (idx < batches.length) {
      const slice = batches.slice(idx, idx + concurrency);
      await Promise.all(
        slice.map(async (batch) => {
          const inputs = batch.map((b) => b.slug.slug);
          let embeddings: number[][];
          try {
            const resp = await openai.embeddings.create({ model, input: inputs });
            embeddings = resp.data.map((d) => d.embedding as unknown as number[]);
          } catch (e: any) {
            console.error(`Batch embedding failed:`, e.message);
            stats.failed += batch.length;
            return;
          }

          for (let i = 0; i < batch.length; i++) {
            const { slug } = batch[i];
            const emb = embeddings[i];
            const hashKey = sha256(`${slug.slug_norm}|${model}|${embedVersion}`);
            const embLiteral = `[${emb.join(',')}]`;
            try {
              await client.query(
                `
                INSERT INTO s1_slug_embeddings
                  (run_date, slug, slug_norm, revenue, clicks, keyword_count, embedding, embed_model, embed_version, hash_key)
                VALUES
                  ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10)
                ON CONFLICT (hash_key) DO UPDATE SET
                  run_date = EXCLUDED.run_date,
                  revenue = EXCLUDED.revenue,
                  clicks = EXCLUDED.clicks,
                  keyword_count = EXCLUDED.keyword_count,
                  embedding = EXCLUDED.embedding,
                  embed_model = EXCLUDED.embed_model,
                  embed_version = EXCLUDED.embed_version
              `,
                [
                  runDate,
                  slug.slug,
                  slug.slug_norm,
                  slug.revenue,
                  slug.clicks,
                  slug.keyword_count,
                  embLiteral,
                  model,
                  embedVersion,
                  hashKey,
                ]
              );
              stats.embedded += 1;
            } catch (e) {
              console.error('Upsert failed for slug:', slug.slug, e);
              stats.failed += 1;
            }
          }
        })
      );
      idx += concurrency;
      console.log(`Progress: ${Math.min(idx, batches.length)}/${batches.length} batches, embedded=${stats.embedded}, failed=${stats.failed}`);
      await sleep(100);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error('embed_slugs failed', err);
  process.exit(1);
});

