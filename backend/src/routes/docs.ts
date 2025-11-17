import express from 'express';
import OpenAI from 'openai';
import { getPgPool } from '../lib/pg';
import { generateText } from '../lib/openai';

const router = express.Router();

type DocsSearchRow = {
  path: string;
  section_title: string | null;
  content: string;
  content_hash: string;
  updated_at: string;
};

/**
 * POST /api/docs/qa
 *
 * RAG-style question answering over repo documentation.
 * Expects: { query: string, k?: number, maxTokens?: number }
 */
router.post('/qa', async (req, res) => {
  try {
    const { query, k, maxTokens } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }

    const topK = typeof k === 'number' && k > 0 && k <= 50 ? k : 20;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

    // Embed query
    const embResp = await openai.embeddings.create({ model, input: query });
    const qvec = embResp.data[0]?.embedding as unknown as number[];
    if (!qvec) {
      throw new Error('Embedding failed for query');
    }
    const qLiteral = `[${qvec.join(',')}]`;

    const pool = getPgPool();
    const client = await pool.connect();

    let rows: DocsSearchRow[] = [];
    try {
      const sql = `
        SELECT
          path,
          section_title,
          content,
          content_hash,
          TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
        FROM repo_docs_embeddings
        ORDER BY embedding <-> $1::vector
        LIMIT $2
      `;
      const result = await client.query(sql, [qLiteral, topK]);
      rows = result.rows as DocsSearchRow[];
    } finally {
      client.release();
    }

    if (!rows.length) {
      return res.status(200).json({
        answer:
          "I couldn't find any indexed documentation to answer that yet. Try running the docs embedding job and asking again.",
        sources: [],
      });
    }

    const maxContextChars = 12000;
    let contextChars = 0;
    const selected: DocsSearchRow[] = [];

    for (const row of rows) {
      const snippet =
        row.content.length > 1200 ? `${row.content.slice(0, 1200)}\n...` : row.content;
      const projected = contextChars + snippet.length;
      if (projected > maxContextChars && selected.length > 0) {
        break;
      }
      contextChars = projected;
      selected.push(row);
    }

    const contextBlocks = selected.map((r, idx) => {
      const snippet =
        r.content.length > 1200 ? `${r.content.slice(0, 1200)}\n...` : r.content;
      const title = r.section_title || '(no section title)';
      return [
        `Source ${idx + 1}:`,
        `Path: ${r.path}`,
        `Section: ${title}`,
        `Last updated: ${r.updated_at}`,
        ``,
        snippet,
      ].join('\n');
    });

    const context = contextBlocks.join('\n\n-----\n\n');

    const system = [
      'You are a documentation assistant for the Liftoff repo.',
      'You answer questions strictly using the provided documentation context.',
      'If the answer is not clearly supported by the context, say you do not know or that it is not documented.',
      'Prefer concise, direct answers with clear structure (bullets/sections) when helpful.',
    ].join(' ');

    const prompt = [
      `User question:`,
      query,
      '',
      `Documentation context (multiple sources):`,
      context,
      '',
      'Instructions:',
      '- Answer using only the documentation above.',
      '- If multiple sources conflict, call that out and explain the safest interpretation.',
      '- Include a short list of the key source paths you relied on at the end.',
    ].join('\n');

    const answer = await generateText({
      system,
      prompt,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : 900,
    });

    const sources = selected.map((r) => ({
      path: r.path,
      sectionTitle: r.section_title,
      updatedAt: r.updated_at,
      contentHash: r.content_hash,
    }));

    return res.status(200).json({
      answer,
      sources,
    });
  } catch (err: any) {
    console.error('[docs/qa] Error:', err);
    return res.status(500).json({ error: err?.message || 'Docs QA failed' });
  }
});

export default router;


