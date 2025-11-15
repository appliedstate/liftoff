import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import { getPgPool } from '../../lib/pg';
import { extractInterlincxKeywords, InterlincxKeywordRow } from './extract_interlincx_keywords';

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

type UpsertStats = {
  total: number;
  embedded: number;
  reused: number;
  failed: number;
};

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
    console.error('Missing --input path to Interlincx CSV report');
    process.exit(1);
  }

  const abs = path.resolve(input);
  let rows = await extractInterlincxKeywords(abs);
  if (limit && Number.isFinite(limit) && limit > 0) {
    rows = rows.slice(0, limit);
  }
  console.log(`Loaded ${rows.length} unique keywords from ${abs}${limit ? ` (limited to ${limit})` : ''}`);

  const pool = getPgPool();
  const client = await pool.connect();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stats: UpsertStats = { total: rows.length, embedded: 0, reused: 0, failed: 0 };

  try {
    // Pre-check which hash_keys exist to skip re-embedding
    const keys = rows.map((r) => {
      const key = sha256(`${r.keyword_norm}|${model}|${embedVersion}`);
      return { key, row: r };
    });
    const keySet = new Set(keys.map((k) => k.key));
    const existing = new Set<string>();
    if (keySet.size > 0) {
      const placeholders = Array.from(keySet).map((_, i) => `$${i + 1}`).join(',');
      const checkSql = `SELECT hash_key FROM s1_embeddings WHERE hash_key = ANY(ARRAY[${placeholders}])`;
      const existingRes = await client.query(checkSql, Array.from(keySet));
      for (const r of existingRes.rows) existing.add(r.hash_key);
    }

    // Prepare embedding inputs (only missing keys)
    const needEmbed = keys.filter((k) => !existing.has(k.key));
    stats.reused = rows.length - needEmbed.length;

    console.log(`Embedding ${needEmbed.length} new of ${rows.length} (${stats.reused} cached)`);

    // Concurrency control: process batches in parallel windows
    const batches = chunk(needEmbed, batchSize);
    let idx = 0;
    while (idx < batches.length) {
      const slice = batches.slice(idx, idx + concurrency);
      await Promise.all(
        slice.map(async (batch, bidx) => {
          const inputs = batch.map((b) => b.row.keyword);
          // Retry with basic exponential backoff
          let attempt = 0;
          const maxAttempts = 5;
          let embeddings: number[][] | null = null;
          while (attempt < maxAttempts) {
            try {
              const resp = await openai.embeddings.create({
                model,
                input: inputs,
              });
              embeddings = resp.data.map((d) => d.embedding as unknown as number[]);
              break;
            } catch (e: any) {
              attempt++;
              const status = e?.status || e?.response?.status;
              const retryAfter = Number(e?.response?.headers?.['retry-after'] || 0);
              const base = Math.min(30_000, 500 * 2 ** attempt);
              const delay = Math.max(base, retryAfter * 1000);
              console.warn(`Embedding batch failed (attempt ${attempt}/${maxAttempts}, status ${status}). Sleeping ${delay}ms...`);
              await sleep(delay);
            }
          }
          if (!embeddings) {
            stats.failed += batch.length;
            return;
          }

          // Upsert each result (embedding literal string for pgvector)
          for (let i = 0; i < batch.length; i++) {
            const { row } = batch[i];
            const emb = embeddings[i];
            const hashKey = sha256(`${row.keyword_norm}|${model}|${embedVersion}`);
            const embLiteral = `[${emb.join(',')}]`;
            try {
              await client.query(
                `
                INSERT INTO s1_embeddings
                  (run_date, keyword, keyword_norm, angle, category, searches, clicks, revenue, rpc, rps, embedding, embed_model, embed_version, hash_key)
                VALUES
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, $12, $13, $14)
                ON CONFLICT (hash_key) DO UPDATE SET
                  run_date = EXCLUDED.run_date,
                  angle = EXCLUDED.angle,
                  category = EXCLUDED.category,
                  searches = EXCLUDED.searches,
                  clicks = EXCLUDED.clicks,
                  revenue = EXCLUDED.revenue,
                  rpc = EXCLUDED.rpc,
                  rps = EXCLUDED.rps,
                  embedding = EXCLUDED.embedding,
                  embed_model = EXCLUDED.embed_model,
                  embed_version = EXCLUDED.embed_version
              `,
                [
                  runDate,
                  row.keyword,
                  row.keyword_norm,
                  row.angle,
                  row.category,
                  row.searches,
                  row.clicks,
                  row.revenue,
                  row.rpc,
                  row.rps,
                  embLiteral,
                  model,
                  embedVersion,
                  hashKey,
                ]
              );
              stats.embedded += 1;
            } catch (e) {
              console.error('Upsert failed for keyword:', row.keyword, e);
              stats.failed += 1;
            }
          }
        })
      );
      idx += concurrency;
      console.log(`Progress: ${Math.min(idx, batches.length)}/${batches.length} batches, embedded=${stats.embedded}, failed=${stats.failed}`);
    }

    // Update metrics for cached rows for latest run_date (no re-embedding needed)
    const cached = keys.filter((k) => existing.has(k.key));
    for (const k of cached) {
      const r = k.row;
      try {
        await client.query(
          `
          UPDATE s1_embeddings
          SET run_date = $1,
              angle = $2,
              category = $3,
              searches = $4,
              clicks = $5,
              revenue = $6,
              rpc = $7,
              rps = $8
          WHERE hash_key = $9
        `,
          [
            runDate,
            r.angle,
            r.category,
            r.searches,
            r.clicks,
            r.revenue,
            r.rpc,
            r.rps,
            k.key,
          ]
        );
      } catch (e) {
        console.warn('Metrics update failed for cached key:', k.key, e);
      }
    }

    console.log(
      JSON.stringify(
        {
          total_phrases: stats.total,
          embedded_new: stats.embedded,
          reused_from_cache: stats.reused,
          failures: stats.failed,
          model,
          embed_version: embedVersion,
          run_date: runDate,
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('embed_interlincx_keywords failed', err);
    process.exitCode = 1;
  });
}


