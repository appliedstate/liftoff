import OpenAI from 'openai';
import { getPgPool } from './pg';

export type GuidelineChunk = {
  path: string;
  section_title: string | null;
  content: string;
  page_hint: string | null;
  updated_at: string;
};

export type GuidelineSearchOptions = {
  /**
   * Natural language query describing what guideline sections you want.
   * Example: "Needs Met ratings for YMYL medical pages"
   */
  query: string;
  /**
   * Maximum number of chunks to return (hard-capped between 1 and 20).
   */
  k?: number;
  /**
   * Optional LIKE pattern to restrict to specific docs paths, e.g.
   * "searchqualityevaluatorguidelines%" or "guidelines/%".
   *
   * If omitted, all repo docs are searched.
   */
  pathLike?: string;
};

/**
 * Vector search over guideline chunks stored in repo_docs_embeddings.
 * This is a thin wrapper around the existing docs pgvector setup, but
 * allows callers to constrain results to the Search Quality Evaluator Guidelines
 * file(s) via a path LIKE filter.
 */
export async function searchGuidelinesChunks(
  opts: GuidelineSearchOptions
): Promise<GuidelineChunk[]> {
  const { query, k, pathLike } = opts;
  if (!query || typeof query !== 'string') {
    throw new Error('searchGuidelinesChunks: query is required');
  }

  const topK = Math.max(1, Math.min(20, k ?? 8));

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  const embResp = await openai.embeddings.create({ model, input: query });
  const qvec = embResp.data[0]?.embedding as unknown as number[];
  if (!qvec) {
    throw new Error('searchGuidelinesChunks: embedding failed for query');
  }
  const qLiteral = `[${qvec.join(',')}]`;

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const params: any[] = [qLiteral, topK];
    const where: string[] = [];

    if (pathLike) {
      where.push('path LIKE $3');
      params.push(pathLike);
    } else if (process.env.GUIDELINES_PATH_LIKE) {
      where.push('path LIKE $3');
      params.push(process.env.GUIDELINES_PATH_LIKE);
    }

    const whereClause =
      where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        path,
        section_title,
        content,
        NULL::text AS page_hint,
        TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
      FROM repo_docs_embeddings
      ${whereClause}
      ORDER BY embedding <-> $1::vector
      LIMIT $2
    `;

    const result = await client.query(sql, params);
    return result.rows as GuidelineChunk[];
  } finally {
    client.release();
  }
}


