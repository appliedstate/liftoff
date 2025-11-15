import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import OpenAI from 'openai';
import { parse } from 'csv-parse';
import { getPgPool } from '../../lib/pg';

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

type SerpRow = {
  serp_keyword: string;
  serp_keyword_norm: string;
  region_code: string;
  content_slug: string;
  content_slug_norm: string;
  topic_vertical: string | null;
  topic: string | null;
  most_granular_topic: string | null;
  sellside_searches: number | null;
  sellside_clicks_network: number | null;
  est_net_revenue: number | null;
  rpc: number | null;
  rps: number | null;
};

function normalizeKey(k: string): string {
  return k.trim().toUpperCase().replace(/\s+/g, '_');
}

function parseNumber(val: any): number | null {
  if (val == null) return null;
  const s = String(val).trim().replace(/[\$,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function readCsvFile(filePath: string, limit?: number): Promise<SerpRow[]> {
  return new Promise<SerpRow[]>((resolve, reject) => {
    const rows: SerpRow[] = [];
    const parser = fs
      .createReadStream(filePath)
      .pipe(
        parse({
          bom: true,
          columns: true,
          relax_column_count: true,
          skip_empty_lines: true,
          trim: true,
        })
      );

    parser.on('data', (record: any) => {
      // Normalize keys
      const norm: Record<string, any> = {};
      for (const [k, v] of Object.entries(record)) {
        norm[normalizeKey(String(k))] = v;
      }

      const serpKeyword = String(norm['SERP_KEYWORD'] ?? '').trim();
      const contentSlug = String(norm['CONTENT_SLUG'] ?? '').trim();
      const regionCode = String(norm['REGION_CODE'] ?? '').trim();
      if (!serpKeyword || !contentSlug || !regionCode) return;

      const revenue = parseNumber(norm['EST_NET_REVENUE']) ?? 0;
      const clicks = parseNumber(norm['SELLSIDE_CLICKS_NETWORK']) ?? 0;
      const searches = parseNumber(norm['SELLSIDE_SEARCHES']) ?? 0;
      const rpc = clicks > 0 ? revenue / clicks : null;
      const rps = searches > 0 ? revenue / searches : null;

      rows.push({
        serp_keyword: serpKeyword,
        serp_keyword_norm: serpKeyword.toLowerCase(),
        region_code: regionCode,
        content_slug: contentSlug.replace(/\/$/, ''),
        content_slug_norm: contentSlug.replace(/\/$/, '').toLowerCase(),
        topic_vertical: norm['TOPIC_VERTICAL'] ? String(norm['TOPIC_VERTICAL']) : null,
        topic: norm['TOPIC'] ? String(norm['TOPIC']) : null,
        most_granular_topic: norm['MOST_GRANULAR_TOPIC'] ? String(norm['MOST_GRANULAR_TOPIC']) : null,
        sellside_searches: Number.isFinite(searches) ? searches : null,
        sellside_clicks_network: Number.isFinite(clicks) ? clicks : null,
        est_net_revenue: Number.isFinite(revenue) ? revenue : null,
        rpc,
        rps,
      });
      if (limit && rows.length >= limit) {
        // Stop early if we hit the limit
        (parser as any).destroy();
      }
    });
    parser.on('end', () => resolve(rows));
    parser.on('error', (e: any) => {
      e.message = `Failed parsing CSV: ${filePath} - ${e.message}`;
      reject(e);
    });
  });
}

async function loadRowsFromCsvs(inputs: string[], limit?: number): Promise<SerpRow[]> {
  const sources: string[] = [];
  for (const input of inputs) {
    const abs = path.resolve(input);
    if (!fs.existsSync(abs)) throw new Error(`Input not found: ${abs}`);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      const files = fs
        .readdirSync(abs)
        .filter((f) => f.toLowerCase().endsWith('.csv'))
        .map((f) => path.join(abs, f));
      sources.push(...files);
    } else {
      sources.push(abs);
    }
  }
  if (sources.length === 0) return [];

  console.log(`Discovered ${sources.length} CSV file(s):`);
  for (const s of sources) {
    try {
      const st = fs.statSync(s);
      console.log(` - ${s} (${st.size} bytes)`);
    } catch {
      console.log(` - ${s}`);
    }
  }

  const allRows: SerpRow[] = [];
  for (const file of sources) {
    const remaining = limit ? Math.max(0, limit - allRows.length) : undefined;
    if (remaining === 0) break;
    const rows = await readCsvFile(file, remaining);
    allRows.push(...rows);
    if (limit && allRows.length >= limit) break;
  }
  return allRows;
}

async function processBatch(
  client: ReturnType<typeof getPgPool> extends infer P ? any : any,
  openai: OpenAI,
  rows: SerpRow[],
  model: string,
  embedVersion: string,
  runDate: string
): Promise<{ embedded: number; reused: number; failed: number }> {
  if (rows.length === 0) return { embedded: 0, reused: 0, failed: 0 };

  // Compute hash keys for rows
  const keys = rows.map((r) => ({
    key: sha256(`${r.serp_keyword_norm}|${r.content_slug_norm}|${r.region_code}|${model}|${embedVersion}`),
    row: r,
  }));
  const keySet = new Set(keys.map((k) => k.key));
  const existing = new Set<string>();
  // Check existing hash_keys in this batch
  try {
    const placeholders = Array.from(keySet).map((_, i) => `$${i + 1}`).join(',');
    const checkSql = `SELECT hash_key FROM serp_keyword_slug_embeddings WHERE hash_key = ANY(ARRAY[${placeholders}])`;
    const existingRes = await client.query(checkSql, Array.from(keySet));
    for (const r of existingRes.rows) existing.add(r.hash_key);
  } catch {
    // If table doesn't exist yet, skip reuse logic
  }

  const toEmbed = keys.filter((k) => !existing.has(k.key));
  const reused = rows.length - toEmbed.length;

  const inputsKeyword = toEmbed.map((b) => b.row.serp_keyword);
  const inputsSlug = toEmbed.map((b) => b.row.content_slug);

  let keywordEmbeds: number[][] = [];
  let slugEmbeds: number[][] = [];
  try {
    const [kwResp, slResp] = await Promise.all([
      inputsKeyword.length ? openai.embeddings.create({ model, input: inputsKeyword }) : Promise.resolve({ data: [] } as any),
      inputsSlug.length ? openai.embeddings.create({ model, input: inputsSlug }) : Promise.resolve({ data: [] } as any),
    ]);
    keywordEmbeds = (kwResp.data || []).map((d: any) => d.embedding as unknown as number[]);
    slugEmbeds = (slResp.data || []).map((d: any) => d.embedding as unknown as number[]);
  } catch (e: any) {
    console.error(`Batch embedding failed:`, e.message || e);
    return { embedded: 0, reused, failed: toEmbed.length };
  }

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < toEmbed.length; i++) {
    const { row, key } = toEmbed[i];
    const kwEmb = keywordEmbeds[i];
    const slEmb = slugEmbeds[i];
    const kwLiteral = kwEmb ? `[${kwEmb.join(',')}]` : null;
    const slLiteral = slEmb ? `[${slEmb.join(',')}]` : null;
    try {
      await client.query(
        `
        INSERT INTO serp_keyword_slug_embeddings
          (
            run_date,
            serp_keyword, serp_keyword_norm,
            region_code,
            content_slug, content_slug_norm,
            topic_vertical, topic, most_granular_topic,
            sellside_searches, sellside_clicks_network, est_net_revenue,
            rpc, rps,
            embedding_keyword, embedding_slug,
            embed_model, embed_version, hash_key
          )
        VALUES
          (
            $1,
            $2, $3,
            $4,
            $5, $6,
            $7, $8, $9,
            $10, $11, $12,
            $13, $14,
            $15::vector, $16::vector,
            $17, $18, $19
          )
        ON CONFLICT (hash_key) DO UPDATE SET
          run_date = EXCLUDED.run_date,
          topic_vertical = EXCLUDED.topic_vertical,
          topic = EXCLUDED.topic,
          most_granular_topic = EXCLUDED.most_granular_topic,
          sellside_searches = EXCLUDED.sellside_searches,
          sellside_clicks_network = EXCLUDED.sellside_clicks_network,
          est_net_revenue = EXCLUDED.est_net_revenue,
          rpc = EXCLUDED.rpc,
          rps = EXCLUDED.rps,
          embedding_keyword = EXCLUDED.embedding_keyword,
          embedding_slug = EXCLUDED.embedding_slug,
          embed_model = EXCLUDED.embed_model,
          embed_version = EXCLUDED.embed_version
      `,
        [
          // $1..$19
          runDate,
          row.serp_keyword, row.serp_keyword_norm,
          row.region_code,
          row.content_slug, row.content_slug_norm,
          row.topic_vertical, row.topic, row.most_granular_topic,
          row.sellside_searches, row.sellside_clicks_network, row.est_net_revenue,
          row.rpc, row.rps,
          kwLiteral, slLiteral,
          model, embedVersion, key,
        ]
      );
      embedded += 1;
    } catch (e) {
      failed += 1;
      console.error('Upsert failed for row:', row.serp_keyword, row.content_slug, row.region_code, e);
    }
  }
  return { embedded, reused, failed };
}

async function main() {
  const runDate = getArg('runDate');
  const inputsArg = getArg('inputs') || getArg('input');
  const dirArg = getArg('dir');
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const embedVersion = process.env.EMBEDDING_VERSION || 'v1';
  const flushSize = parseInt(process.env.SERP_FLUSH_SIZE || '200', 10);
  const limit = getArg('limit') ? parseInt(String(getArg('limit')), 10) : undefined;

  if (!runDate) {
    console.error('Missing --runDate (YYYY-MM-DD)');
    process.exit(1);
  }
  const inputs: string[] = [];
  if (inputsArg) {
    inputs.push(...inputsArg.split(',').map((s) => s.trim()).filter(Boolean));
  }
  if (dirArg) {
    inputs.push(dirArg);
  }
  if (inputs.length === 0) {
    console.error('Provide --dir=<folder> or --inputs=csv1,csv2,...');
    process.exit(1);
  }

  const pool = getPgPool();
  const client = await pool.connect();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stats = { total: 0, embedded: 0, reused: 0, failed: 0 };
  try {
    // Resolve sources and log them
    const fileSources: string[] = [];
    for (const input of inputs) {
      const abs = path.resolve(input);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        const files = fs
          .readdirSync(abs)
          .filter((f) => f.toLowerCase().endsWith('.csv'))
          .map((f) => path.join(abs, f));
        fileSources.push(...files);
      } else {
        fileSources.push(abs);
      }
    }

    console.log(`Discovered ${fileSources.length} CSV file(s):`);
    for (const s of fileSources) {
      try {
        const st = fs.statSync(s);
        console.log(` - ${s} (${st.size} bytes)`);
      } catch {
        console.log(` - ${s}`);
      }
    }

    console.log(`Processing ${fileSources.length} file(s) in streaming mode (flushSize=${flushSize}${limit ? `, limit=${limit}` : ''})`);
    let totalProcessed = 0;
    for (const file of fileSources) {
      console.log(`Streaming file: ${file}`);
      const buffer: SerpRow[] = [];
      await new Promise<void>((resolve, reject) => {
        const parser = fs
          .createReadStream(file)
          .pipe(
            parse({
              bom: true,
              columns: true,
              relax_column_count: true,
              skip_empty_lines: true,
              trim: true,
            })
          );
        parser.on('data', async (record: any) => {
          // normalize and push
          const norm: Record<string, any> = {};
          for (const [k, v] of Object.entries(record)) {
            norm[normalizeKey(String(k))] = v;
          }
          const serpKeyword = String(norm['SERP_KEYWORD'] ?? '').trim();
          const contentSlug = String(norm['CONTENT_SLUG'] ?? '').trim();
          const regionCode = String(norm['REGION_CODE'] ?? '').trim();
          if (!serpKeyword || !contentSlug || !regionCode) return;
          const revenue = parseNumber(norm['EST_NET_REVENUE']) ?? 0;
          const clicks = parseNumber(norm['SELLSIDE_CLICKS_NETWORK']) ?? 0;
          const searches = parseNumber(norm['SELLSIDE_SEARCHES']) ?? 0;
          const rpc = clicks > 0 ? revenue / clicks : null;
          const rps = searches > 0 ? revenue / searches : null;
          buffer.push({
            serp_keyword: serpKeyword,
            serp_keyword_norm: serpKeyword.toLowerCase(),
            region_code: regionCode,
            content_slug: contentSlug.replace(/\/$/, ''),
            content_slug_norm: contentSlug.replace(/\/$/, '').toLowerCase(),
            topic_vertical: norm['TOPIC_VERTICAL'] ? String(norm['TOPIC_VERTICAL']) : null,
            topic: norm['TOPIC'] ? String(norm['TOPIC']) : null,
            most_granular_topic: norm['MOST_GRANULAR_TOPIC'] ? String(norm['MOST_GRANULAR_TOPIC']) : null,
            sellside_searches: Number.isFinite(searches) ? searches : null,
            sellside_clicks_network: Number.isFinite(clicks) ? clicks : null,
            est_net_revenue: Number.isFinite(revenue) ? revenue : null,
            rpc,
            rps,
          });
          totalProcessed += 1;
          stats.total += 1;

          if (buffer.length >= flushSize) {
            parser.pause();
            try {
              // inject run_date during upsert call
              const res = await processBatch(client, openai, buffer, model, embedVersion, runDate);
              stats.embedded += res.embedded;
              stats.reused += res.reused;
              stats.failed += res.failed;
              console.log(
                `Flushed ${flushSize} rows from ${path.basename(file)} | totalProcessed=${totalProcessed}` +
                `, +embedded=${res.embedded}, +reused=${res.reused}, +failed=${res.failed}` +
                `, totals: embedded=${stats.embedded}, reused=${stats.reused}, failed=${stats.failed}`
              );
            } finally {
              buffer.length = 0;
              parser.resume();
            }
          }
          if (limit && totalProcessed >= limit) {
            // Flush any remaining rows before stopping
            parser.pause();
            try {
              if (buffer.length > 0) {
                const res = await processBatch(client, openai, buffer, model, embedVersion, runDate);
                stats.embedded += res.embedded;
                stats.reused += res.reused;
                stats.failed += res.failed;
                console.log(
                  `Final limit flush ${buffer.length} rows from ${path.basename(file)} | totalProcessed=${totalProcessed}` +
                  `, +embedded=${res.embedded}, +reused=${res.reused}, +failed=${res.failed}` +
                  `, totals: embedded=${stats.embedded}, reused=${stats.reused}, failed=${stats.failed}`
                );
                buffer.length = 0;
              }
            } finally {
              (parser as any).destroy();
            }
          }
        });
        parser.on('end', async () => {
          // flush remaining
          if (buffer.length > 0) {
            const res = await processBatch(client, openai, buffer, model, embedVersion, runDate);
            stats.embedded += res.embedded;
            stats.reused += res.reused;
            stats.failed += res.failed;
            console.log(
              `Final flush ${buffer.length} rows from ${path.basename(file)} | totalProcessed=${totalProcessed}` +
              `, +embedded=${res.embedded}, +reused=${res.reused}, +failed=${res.failed}` +
              `, totals: embedded=${stats.embedded}, reused=${stats.reused}, failed=${stats.failed}`
            );
          }
          resolve();
        });
        parser.on('error', (e: any) => reject(e));
      });
      if (limit && totalProcessed >= limit) break;
    }

    console.log(`Done streaming. total=${stats.total}, embedded=${stats.embedded}, reused=${stats.reused}, failed=${stats.failed}`);
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error('embed_serp_keywords_slugs failed', err);
  process.exit(1);
});


