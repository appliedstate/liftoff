import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import OpenAI from 'openai';
import { getPgPool } from '../../lib/pg';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

type DocChunk = {
  path: string;
  sectionTitle: string | null;
  content: string;
  contentHash: string;
};

const DEFAULT_EXTENSIONS = ['.md', '.mdx', '.txt'];

function isDocFile(filePath: string, exts: string[] = DEFAULT_EXTENSIONS): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return exts.includes(ext);
}

function walkDir(dir: string, exts: string[] = DEFAULT_EXTENSIONS): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
      results.push(...walkDir(full, exts));
    } else if (entry.isFile() && isDocFile(full, exts)) {
      results.push(full);
    }
  }
  return results;
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

/**
 * Very simple markdown chunker:
 * - Splits on headings and blank lines
 * - Groups paragraphs into ~maxChars chunks
 * - Attaches nearest preceding heading as sectionTitle
 */
function chunkMarkdownFile(absPath: string, rootDir: string, maxChars = 1200): DocChunk[] {
  const raw = fs.readFileSync(absPath, 'utf8');
  const text = normalizeNewlines(raw);
  const relPath = path.relative(rootDir, absPath);

  const lines = text.split('\n');
  const chunks: DocChunk[] = [];
  let currentSection: string | null = null;
  let buffer: string[] = [];

  const flushBuffer = () => {
    const content = buffer.join('\n').trim();
    if (!content) return;
    const contentHash = sha256(`${relPath}\n${currentSection ?? ''}\n${content}`);
    chunks.push({
      path: relPath,
      sectionTitle: currentSection,
      content,
      contentHash,
    });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      // Start new section
      flushBuffer();
      currentSection = headingMatch[1].trim();
      continue;
    }

    // Blank line -> possible boundary if buffer is large
    if (line.trim() === '') {
      buffer.push(line);
      const content = buffer.join('\n');
      if (content.length >= maxChars) {
        flushBuffer();
      }
      continue;
    }

    buffer.push(line);
    const content = buffer.join('\n');
    if (content.length >= maxChars) {
      flushBuffer();
    }
  }

  flushBuffer();
  return chunks;
}

async function main() {
  const rootDirArg = getArg('rootDir') || getArg('root') || getArg('dir');
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const embedVersion = process.env.EMBEDDING_VERSION || 'v1';
  const batchSize = parseInt(process.env.DOC_EMBED_BATCH_SIZE || '64', 10);

  if (!rootDirArg) {
    console.error('Missing --rootDir (path to docs root, e.g. ../../docs)');
    process.exit(1);
  }

  const rootDir = path.resolve(rootDirArg);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`rootDir is not a directory: ${rootDir}`);
    process.exit(1);
  }

  console.log(`Scanning docs under: ${rootDir}`);
  const files = walkDir(rootDir);
  if (files.length === 0) {
    console.log('No documentation files found to embed.');
    return;
  }

  console.log(`Found ${files.length} doc file(s). Chunking...`);
  const allChunks: DocChunk[] = [];
  for (const f of files) {
    try {
      const chunks = chunkMarkdownFile(f, rootDir);
      allChunks.push(...chunks);
    } catch (e: any) {
      console.warn(`Failed to chunk file ${f}:`, e?.message || e);
    }
  }

  if (allChunks.length === 0) {
    console.log('No chunks produced from docs; exiting.');
    return;
  }

  console.log(`Generated ${allChunks.length} chunks. Checking for existing hashes...`);

  const pool = getPgPool();
  const client = await pool.connect();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const hashSet = new Set(allChunks.map((c) => c.contentHash));
    const hashes = Array.from(hashSet);
    const existing = new Set<string>();

    if (hashes.length > 0) {
      const batchHashes = chunkArray(hashes, 5000);
      for (const batch of batchHashes) {
        const placeholders = batch.map((_, i) => `$${i + 1}`).join(',');
        const sql = `SELECT content_hash FROM repo_docs_embeddings WHERE content_hash = ANY(ARRAY[${placeholders}])`;
        const res = await client.query(sql, batch);
        for (const row of res.rows) existing.add(row.content_hash);
      }
    }

    const toEmbed = allChunks.filter((c) => !existing.has(c.contentHash));
    const reused = allChunks.length - toEmbed.length;

    console.log(
      `Docs embedding: totalChunks=${allChunks.length}, toEmbed=${toEmbed.length}, reused=${reused}`
    );

    if (toEmbed.length === 0) {
      console.log('All docs chunks are already embedded; nothing to do.');
      return;
    }

    const batches = chunkArray(toEmbed, batchSize);
    let embedded = 0;
    let failed = 0;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const inputs = batch.map((c) => c.content);

      let embeddings: number[][];
      try {
        const resp = await openai.embeddings.create({ model, input: inputs });
        embeddings = resp.data.map((d: any) => d.embedding as unknown as number[]);
      } catch (e: any) {
        console.error(`Embedding batch ${b + 1}/${batches.length} failed:`, e?.message || e);
        failed += batch.length;
        continue;
      }

      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i];
        const emb = embeddings[i];
        if (!emb) {
          failed += 1;
          continue;
        }
        const embLiteral = `[${emb.join(',')}]`;

        try {
          await client.query(
            `
            INSERT INTO repo_docs_embeddings
              (path, section_title, content, content_hash, embedding, embed_model, embed_version, updated_at)
            VALUES
              ($1, $2, $3, $4, $5::vector, $6, $7, NOW())
            ON CONFLICT (content_hash) DO UPDATE SET
              path = EXCLUDED.path,
              section_title = EXCLUDED.section_title,
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              embed_model = EXCLUDED.embed_model,
              embed_version = EXCLUDED.embed_version,
              updated_at = NOW()
          `,
            [
              chunk.path,
              chunk.sectionTitle,
              chunk.content,
              chunk.contentHash,
              embLiteral,
              model,
              embedVersion,
            ]
          );
          embedded += 1;
        } catch (e: any) {
          failed += 1;
          console.error(
            `Upsert failed for chunk ${chunk.path} (${chunk.sectionTitle || 'no title'}):`,
            e?.message || e
          );
        }
      }

      console.log(
        `Batch ${b + 1}/${batches.length} complete: embedded += ${batch.length}, totals embedded=${embedded}, failed=${failed}`
      );
    }

    console.log(
      JSON.stringify(
        {
          total_chunks: allChunks.length,
          embedded_new: embedded,
          reused_from_cache: reused,
          failures: failed,
          model,
          embed_version: embedVersion,
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

main().catch((err) => {
  console.error('embed_docs failed', err);
  process.exit(1);
});


