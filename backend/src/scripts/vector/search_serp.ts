import OpenAI from 'openai';
import { getPgPool } from '../../lib/pg';

export type SerpSearchParams = {
  query: string;
  runDate?: string; // YYYY-MM-DD; if omitted, use max(run_date)
  regionCodes?: string[];
  minRevenue?: number;
  limit?: number;
};

export type SerpSearchResultRow = {
  serp_keyword: string;
  content_slug: string;
  region_code: string;
  est_net_revenue: number | null;
  sellside_searches: number | null;
  sellside_clicks_network: number | null;
  rpc: number | null;
  rps: number | null;
  cos: number;
  finalScore: number;
};

export async function serpVectorSearch(
  params: SerpSearchParams
): Promise<{ runDate: string; results: SerpSearchResultRow[] }> {
  const { query } = params;
  if (!query || typeof query !== 'string') {
    throw new Error('query is required');
  }

  const k = Math.max(1, Math.min(200, params.limit ?? 50));
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  // Embed query
  const resp = await openai.embeddings.create({ model, input: query });
  const qvec = resp.data[0]?.embedding as unknown as number[];
  if (!qvec) throw new Error('Embedding failed for query');
  const qLiteral = `[${qvec.join(',')}]`;

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // Determine run_date default
    let runDate = params.runDate;
    if (!runDate) {
      const r = await client.query(
        `SELECT TO_CHAR(MAX(run_date), 'YYYY-MM-DD') AS run_date FROM serp_keyword_slug_embeddings`
      );
      runDate = r.rows[0]?.run_date || null;
      if (!runDate) throw new Error('No data in serp_keyword_slug_embeddings; run embedding job first');
    }

    // Compute revenue p95 for blending (est_net_revenue)
    const p95Res = await client.query(
      `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY COALESCE(est_net_revenue, 0)) AS p95
       FROM serp_keyword_slug_embeddings
       WHERE run_date = $1`,
      [runDate]
    );
    const revenueP95 = Number(p95Res.rows[0]?.p95 || 1) || 1;

    const where: string[] = [`run_date = $1`];
    const args: any[] = [runDate];
    let argIdx = args.length;

    if (params.regionCodes && params.regionCodes.length > 0) {
      args.push(params.regionCodes);
      argIdx += 1;
      where.push(`region_code = ANY($${argIdx})`);
    }

    if (params.minRevenue != null) {
      args.push(params.minRevenue);
      argIdx += 1;
      where.push(`COALESCE(est_net_revenue, 0) >= $${argIdx}`);
    }

    // KNN over embedding_keyword; fetch top 1000, then blend by revenue and return top-k
    const sql = `
      SELECT
        serp_keyword,
        content_slug,
        region_code,
        est_net_revenue,
        sellside_searches,
        sellside_clicks_network,
        rpc,
        rps,
        (1 - (embedding_keyword <=> $${argIdx + 1}::vector)) AS cos
      FROM serp_keyword_slug_embeddings
      WHERE ${where.join(' AND ')}
      ORDER BY embedding_keyword <-> $${argIdx + 1}::vector
      LIMIT 1000
    `;

    const knn = await client.query(sql, [...args, qLiteral]);

    const results: SerpSearchResultRow[] = knn.rows.map((r: any) => {
      const cos = Number(r.cos || 0);
      const rev = r.est_net_revenue != null ? Number(r.est_net_revenue) : 0;

      // Sigmoid blend of revenue relative to p95 to avoid domination by outliers
      const normalizedRevenue = revenueP95 > 0 ? rev / revenueP95 : 0;
      const revenueComponent = 1 / (1 + Math.exp(-(normalizedRevenue - 1)));
      const finalScore = 0.7 * cos + 0.3 * revenueComponent;

      return {
        serp_keyword: r.serp_keyword,
        content_slug: r.content_slug,
        region_code: r.region_code,
        est_net_revenue: r.est_net_revenue != null ? Number(r.est_net_revenue) : null,
        sellside_searches: r.sellside_searches != null ? Number(r.sellside_searches) : null,
        sellside_clicks_network: r.sellside_clicks_network != null ? Number(r.sellside_clicks_network) : null,
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


