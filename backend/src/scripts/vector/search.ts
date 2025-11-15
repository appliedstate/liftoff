import OpenAI from 'openai';
import { getPgPool } from '../../lib/pg';

export type SearchParams = {
  q: string;
  k?: number;
  angle?: string;
  category?: string;
  minRevenue?: number;
  runDate?: string; // YYYY-MM-DD; if omitted, use max(run_date)
};

export type SearchResultRow = {
  keyword: string;
  angle: string | null;
  category: string | null;
  searches: number | null;
  clicks: number | null;
  revenue: number | null;
  rpc: number | null;
  rps: number | null;
  cos: number;
  finalScore: number;
};

export async function vectorSearch(params: SearchParams): Promise<{ runDate: string; results: SearchResultRow[] }> {
  const { q } = params;
  if (!q || typeof q !== 'string') throw new Error('Missing q');
  const k = Math.max(1, Math.min(1000, params.k ?? 100));
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  // Embed query
  const resp = await openai.embeddings.create({ model, input: q });
  const qvec = resp.data[0]?.embedding as unknown as number[];
  if (!qvec) throw new Error('Embedding failed');
  const qLiteral = `[${qvec.join(',')}]`;

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // Determine run_date default
    let runDate = params.runDate;
    if (!runDate) {
      const r = await client.query(`SELECT TO_CHAR(MAX(run_date), 'YYYY-MM-DD') AS run_date FROM s1_embeddings`);
      runDate = r.rows[0]?.run_date || null;
      if (!runDate) throw new Error('No data in s1_embeddings; run embedding job first');
    }

    // Compute revenue p95 for blending
    const p95Res = await client.query(
      `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY COALESCE(revenue,0)) AS p95 FROM s1_embeddings WHERE run_date = $1`,
      [runDate]
    );
    const revenueP95 = Number(p95Res.rows[0]?.p95 || 1) || 1;

    const where: string[] = [`run_date = $1`];
    const args: any[] = [runDate];
    let argIdx = args.length;
    if (params.angle) {
      args.push(params.angle);
      argIdx++;
      where.push(`angle = $${argIdx}`);
    }
    if (params.category) {
      args.push(params.category);
      argIdx++;
      where.push(`category = $${argIdx}`);
    }
    if (params.minRevenue != null) {
      args.push(params.minRevenue);
      argIdx++;
      where.push(`COALESCE(revenue,0) >= $${argIdx}`);
    }

    // KNN fetch top ~1000 by cosine, filter, then blend and return top-k
    const sql = `
      SELECT
        keyword, angle, category, searches, clicks, revenue, rpc, rps,
        (1 - (embedding <=> $${argIdx + 1}::vector)) AS cos
      FROM s1_embeddings
      WHERE ${where.join(' AND ')}
      ORDER BY embedding <-> $${argIdx + 1}::vector
      LIMIT 1000
    `;
    const knn = await client.query(sql, [...args, qLiteral]);
    const results: SearchResultRow[] = knn.rows.map((r: any) => {
      const cos = Number(r.cos || 0);
      const rev = Number(r.revenue || 0);
      // Sigmoid over normalized revenue; clamp denominator
      const revenueComponent = 1 / (1 + Math.exp(-((revenueP95 > 0 ? rev / revenueP95 : 0) - 1)));
      const finalScore = 0.7 * cos + 0.3 * revenueComponent;
      return {
        keyword: r.keyword,
        angle: r.angle ?? null,
        category: r.category ?? null,
        searches: r.searches != null ? Number(r.searches) : null,
        clicks: r.clicks != null ? Number(r.clicks) : null,
        revenue: rev,
        rpc: r.rpc != null ? Number(r.rpc) : null,
        rps: r.rps != null ? Number(r.rps) : null,
        cos,
        finalScore,
      };
    });
    results.sort((a, b) => b.finalScore - a.finalScore);
    return { runDate, results: results.slice(0, k) };
  } finally {
    client.release();
  }
}


