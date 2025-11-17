import { Router } from 'express';
import { serpVectorSearch } from '../scripts/vector/search_serp';
import { generateText } from '../lib/openai';
import { getPgPool } from '../lib/pg';
import { planS1Action, S1Plan } from '../agents/s1Planner';
import {
  toolKeywordTotalRevenue,
  toolTopSlugs,
  toolKeywordsForSlug,
  toolSerpSearch,
} from '../services/s1SerpTools';

const router = Router();

// In-memory thread state for the S1 agent. This lets us answer follow-up
// questions like "why only 9?" using the previous plan + toolResult.
const s1AgentState = new Map<
  string,
  {
    lastPlan: S1Plan;
    lastToolResult: any;
  }
>();

type SerpMetricsMode =
  | 'total_revenue'
  | 'top_slugs'
  | 'keyword_state_breakdown'
  | 'keywords_for_slug';

type SerpMetricsInput = {
  mode: SerpMetricsMode;
  runDate?: string;
  limit?: number;
  keyword?: string;
  states?: string[];
};

// Generic analytics query spec used by the S1 agent and tools.
export type S1QueryMetric = 'total_revenue' | 'rpc' | 'rps';
export type S1QueryGroupBy = 'slug' | 'keyword' | 'region';

export type S1QuerySpec = {
  metric: S1QueryMetric;
  groupBy?: S1QueryGroupBy[];
  filters?: {
    slug?: string;
    keyword?: string;
    minRevenue?: number;
    runDate?: string;
  };
  orderBy?: {
    field: S1QueryMetric;
    direction?: 'asc' | 'desc';
  };
  limit?: number;
};

async function resolveSerpRunDate(client: any, runDate?: string): Promise<string> {
  if (runDate) return runDate;
  const r = await client.query(
    `SELECT TO_CHAR(MAX(run_date), 'YYYY-MM-DD') AS run_date FROM serp_keyword_slug_embeddings`
  );
  const inferred = r.rows[0]?.run_date;
  if (!inferred) {
    throw new Error('No SERP data found for metrics');
  }
  return inferred;
}

export async function runSerpMetricsQuery(input: SerpMetricsInput): Promise<{ runDate: string; rows: any[] }> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const baseRunDate = await resolveSerpRunDate(client, input.runDate);

    if (input.mode === 'total_revenue') {
      const result = await client.query(
        `
        SELECT
          SUM(COALESCE(est_net_revenue, 0)) AS total_revenue
        FROM serp_keyword_slug_embeddings
        WHERE run_date = $1
      `,
        [baseRunDate]
      );
      return { runDate: baseRunDate, rows: result.rows };
    }

    if (input.mode === 'top_slugs') {
      const safeLimit =
        typeof input.limit === 'number'
          ? Math.max(1, Math.min(1000, Math.floor(input.limit)))
          : 100;

      const result = await client.query(
        `
        SELECT
          content_slug,
          SUM(COALESCE(est_net_revenue, 0)) AS total_revenue,
          CASE
            WHEN SUM(COALESCE(sellside_clicks_network, 0)) > 0
              THEN SUM(COALESCE(est_net_revenue, 0)) / SUM(COALESCE(sellside_clicks_network, 0))
            ELSE 0
          END AS rpc,
          CASE
            WHEN SUM(COALESCE(sellside_searches, 0)) > 0
              THEN SUM(COALESCE(est_net_revenue, 0)) / SUM(COALESCE(sellside_searches, 0))
            ELSE 0
          END AS rps
        FROM serp_keyword_slug_embeddings
        WHERE run_date = $1
        GROUP BY content_slug
        ORDER BY total_revenue DESC
        LIMIT $2
      `,
        [baseRunDate, safeLimit]
      );
      return { runDate: baseRunDate, rows: result.rows };
    }

    if (input.mode === 'keywords_for_slug') {
      const safeLimit =
        typeof input.limit === 'number'
          ? Math.max(1, Math.min(1000, Math.floor(input.limit)))
          : 100;

      const slug = (input.keyword || '').trim();
      if (!slug) {
        throw new Error('slug (keyword field) is required for keywords_for_slug');
      }

      const result = await client.query(
        `
        SELECT
          serp_keyword_norm AS serp_keyword,
          SUM(COALESCE(est_net_revenue, 0)) AS total_revenue,
          CASE
            WHEN SUM(COALESCE(sellside_clicks_network, 0)) > 0
              THEN SUM(COALESCE(est_net_revenue, 0)) / SUM(COALESCE(sellside_clicks_network, 0))
            ELSE 0
          END AS rpc,
          CASE
            WHEN SUM(COALESCE(sellside_searches, 0)) > 0
              THEN SUM(COALESCE(est_net_revenue, 0)) / SUM(COALESCE(sellside_searches, 0))
            ELSE 0
          END AS rps
        FROM serp_keyword_slug_embeddings
        WHERE run_date = $1
          AND content_slug = $2
        GROUP BY serp_keyword_norm
        ORDER BY total_revenue DESC
        LIMIT $3
      `,
        [baseRunDate, slug, safeLimit]
      );
      return { runDate: baseRunDate, rows: result.rows };
    }

    // keyword_state_breakdown
    const keyword = (input.keyword || '').trim().toLowerCase();
    if (!keyword) {
      throw new Error('keyword is required for keyword_state_breakdown');
    }

    const states = Array.isArray(input.states)
      ? input.states
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0)
      : [];

    const safeLimit =
      typeof input.limit === 'number'
        ? Math.max(1, Math.min(1000, Math.floor(input.limit)))
        : 100;

    const where: string[] = [
      'run_date = $1',
      '(serp_keyword_norm ILIKE $2 OR content_slug_norm ILIKE $2)',
    ];
    const params: any[] = [baseRunDate, `%${keyword}%`];
    let argIdx = params.length;

    if (states.length > 0) {
      where.push(`region_code = ANY($${argIdx + 1})`);
      params.push(states);
      argIdx += 1;
    }

    params.push(safeLimit);

    const sql = `
      SELECT
        region_code,
        SUM(COALESCE(est_net_revenue, 0)) AS total_revenue
      FROM serp_keyword_slug_embeddings
      WHERE ${where.join(' AND ')}
      GROUP BY region_code
      ORDER BY total_revenue DESC
      LIMIT $${argIdx + 1}
    `;

    const result = await client.query(sql, params);
    return { runDate: baseRunDate, rows: result.rows };
  } finally {
    client.release();
  }
}

/**
 * Generic analytics query runner for S1 SERP data.
 *
 * This accepts a constrained S1QuerySpec and compiles it into a parametrized
 * SQL query over serp_keyword_slug_embeddings. It is intentionally limited to:
 * - Metrics: total_revenue, rpc, rps
 * - Group by: slug, keyword, region
 * - Filters: slug, keyword (ILIKE), minRevenue, runDate
 * - Order by: one of the metric fields
 * - Limit: 1–1000
 */
export async function runSerpQuerySpec(
  input: S1QuerySpec
): Promise<{ runDate: string; spec: S1QuerySpec; rows: any[] }> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const metric: S1QueryMetric = input.metric || 'total_revenue';
    const groupBy: S1QueryGroupBy[] = input.groupBy && input.groupBy.length
      ? Array.from(new Set(input.groupBy))
      : [];

    const filters = input.filters || {};
    const rawLimit =
      typeof input.limit === 'number' && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 100;
    const safeLimit = Math.max(1, Math.min(1000, rawLimit));

    // Resolve runDate if not provided, using the existing helper.
    const baseRunDate = await resolveSerpRunDate(client, filters.runDate);

    const params: any[] = [baseRunDate];
    const where: string[] = ['run_date = $1'];

    // Map groupBy fields to actual columns.
    const groupCols: string[] = [];
    for (const g of groupBy) {
      if (g === 'slug') groupCols.push('content_slug');
      if (g === 'keyword') groupCols.push('serp_keyword_norm');
      if (g === 'region') groupCols.push('region_code');
    }

    // Filters
    let paramIndex = params.length;
    if (filters.slug) {
      params.push(filters.slug.trim());
      paramIndex += 1;
      where.push(`content_slug = $${paramIndex}`);
    }
    if (filters.keyword) {
      params.push(`%${filters.keyword.trim()}%`);
      paramIndex += 1;
      where.push(`serp_keyword_norm ILIKE $${paramIndex}`);
    }

    // Base metric aggregates (same as top_slugs).
    const selectPieces: string[] = [];
    if (groupCols.length) {
      selectPieces.push(groupCols.join(', '));
    }
    selectPieces.push(
      'SUM(COALESCE(est_net_revenue, 0)) AS total_revenue',
      `CASE
        WHEN SUM(COALESCE(sellside_clicks_network, 0)) > 0
          THEN SUM(COALESCE(est_net_revenue, 0)) / SUM(COALESCE(sellside_clicks_network, 0))
        ELSE 0
      END AS rpc`,
      `CASE
        WHEN SUM(COALESCE(sellside_searches, 0)) > 0
          THEN SUM(COALESCE(est_net_revenue, 0)) / SUM(COALESCE(sellside_searches, 0))
        ELSE 0
      END AS rps`
    );

    const selectClause = `SELECT ${selectPieces.join(',\n          ')}`;
    const fromClause = 'FROM serp_keyword_slug_embeddings';
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const groupClause = groupCols.length
      ? `GROUP BY ${groupCols.join(', ')}`
      : '';

    // HAVING for minRevenue (on the aggregate total_revenue).
    const having: string[] = [];
    if (
      typeof filters.minRevenue === 'number' &&
      Number.isFinite(filters.minRevenue)
    ) {
      params.push(filters.minRevenue);
      paramIndex += 1;
      having.push(`SUM(COALESCE(est_net_revenue, 0)) >= $${paramIndex}`);
    }
    const havingClause = having.length ? `HAVING ${having.join(' AND ')}` : '';

    // ORDER BY
    const orderField: S1QueryMetric =
      input.orderBy && input.orderBy.field
        ? input.orderBy.field
        : metric;
    const orderDir =
      input.orderBy && input.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${orderField} ${orderDir}`;

    params.push(safeLimit);
    paramIndex += 1;
    const limitClause = `LIMIT $${paramIndex}`;

    const sql = `
      ${selectClause}
      ${fromClause}
      ${whereClause}
      ${groupClause}
      ${havingClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await client.query(sql, params);

    const effectiveSpec: S1QuerySpec = {
      metric,
      groupBy: groupBy.length ? groupBy : undefined,
      filters: {
        ...filters,
        runDate: baseRunDate,
      },
      orderBy: {
        field: orderField,
        direction: orderDir.toLowerCase() as 'asc' | 'desc',
      },
      limit: safeLimit,
    };

    return {
      runDate: baseRunDate,
      spec: effectiveSpec,
      rows: result.rows,
    };
  } finally {
    client.release();
  }
}

/**
 * POST /api/s1/serp/search
 *
 * SERP vector search over System1 data (pgvector-backed).
 */
router.post('/serp/search', async (req, res) => {
  try {
    const startedAt = Date.now();
    const { query, regionCodes, runDate, limit, minRevenue } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }

    const safeLimit =
      typeof limit === 'number'
        ? Math.max(1, Math.min(200, Math.floor(limit)))
        : 50;

    const regionList = Array.isArray(regionCodes)
      ? regionCodes.map((r) => String(r)).filter((r) => r.trim().length > 0)
      : undefined;

    const searchStartedAt = Date.now();
    const searchResult = await serpVectorSearch({
      query,
      runDate: runDate || undefined,
      regionCodes: regionList && regionList.length > 0 ? regionList : undefined,
      minRevenue:
        typeof minRevenue === 'number' && Number.isFinite(minRevenue)
          ? minRevenue
          : undefined,
      limit: safeLimit,
    });
    const searchMs = Date.now() - searchStartedAt;

    const payload = {
      status: 'ok',
      runDate: searchResult.runDate,
      query,
      params: {
        regionCodes: regionList || null,
        minRevenue: searchResult.results.length ? minRevenue ?? null : null,
        limit: safeLimit,
      },
      results: searchResult.results,
    };

    console.log('[s1.serp.search]', {
      t_total_ms: Date.now() - startedAt,
      t_search_ms: searchMs,
      limit: safeLimit,
      rows: searchResult.results.length,
      runDate: searchResult.runDate,
    });

    return res.status(200).json(payload);
  } catch (e: any) {
    console.error('[s1.serp.search] Error:', e?.message || e);
    const status = e?.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 500;
    return res
      .status(status)
      .json({ error: e?.message || 'SERP vector search failed' });
  }
});

/**
 * POST /api/s1/serp/qa
 *
 * Question-answering over System1 SERP embeddings.
 * - Runs vector search to get top SERP rows
 * - Feeds rows + question into LLM to generate a narrative answer
 */
router.post('/serp/qa', async (req, res) => {
  try {
    const startedAt = Date.now();
    const { query, regionCodes, runDate, limit, minRevenue, temperature, maxTokens } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }

    const safeLimit =
      typeof limit === 'number'
        ? Math.max(1, Math.min(200, Math.floor(limit)))
        : 50;

    const regionList = Array.isArray(regionCodes)
      ? regionCodes.map((r) => String(r)).filter((r) => r.trim().length > 0)
      : undefined;

    // Fetch richer context than we plan to show to user; we can always truncate for the LLM
    const searchLimit = Math.max(safeLimit, 40);
    const searchStartedAt = Date.now();
    const searchResult = await serpVectorSearch({
      query,
      runDate: runDate || undefined,
      regionCodes: regionList && regionList.length > 0 ? regionList : undefined,
      minRevenue:
        typeof minRevenue === 'number' && Number.isFinite(minRevenue)
          ? minRevenue
          : undefined,
      limit: searchLimit,
    });
    const searchMs = Date.now() - searchStartedAt;

    const allRows = searchResult.results;
    // Use at most 20 rows for the LLM answer to keep prompts small/fast
    const answerRows = allRows.slice(0, Math.min(20, allRows.length));
    // Limit table size to something reasonable as well
    const tableRows = allRows.slice(0, safeLimit);

    // If no rows returned, answer gracefully without calling LLM
    if (!allRows.length) {
      return res.status(200).json({
        status: 'ok',
        runDate: searchResult.runDate,
        query,
        params: {
          regionCodes: regionList || null,
          minRevenue: minRevenue ?? null,
          limit: safeLimit,
        },
        answer:
          'No matching SERP rows were found for this question with the current filters. Try broadening the query or removing region/revenue filters.',
        context: { rows: [] },
      });
    }

    // Build compact textual context for the LLM
    const contextLines: string[] = [];
    contextLines.push(
      'You are analyzing System1 SERP performance rows. Each row is a (keyword, content_slug, region) with performance metrics.',
      'Fields: serp_keyword, content_slug, region_code, est_net_revenue, sellside_searches, sellside_clicks_network, rpc, rps, cos, finalScore.',
      '',
      `Top ${answerRows.length} rows (sorted by finalScore):`
    );

    for (const r of answerRows) {
      contextLines.push(
        [
          `keyword="${r.serp_keyword}"`,
          `slug="${r.content_slug}"`,
          `region="${r.region_code}"`,
          `revenue=${r.est_net_revenue ?? 0}`,
          `searches=${r.sellside_searches ?? 0}`,
          `clicks=${r.sellside_clicks_network ?? 0}`,
          `rpc=${r.rpc ?? 0}`,
          `rps=${r.rps ?? 0}`,
        ].join(' | ')
      );
    }

    const systemPrompt = [
      'You are an optimization and market-mapping copilot for System1 SERP data.',
      'You are given a user question and a list of SERP rows with revenue and efficiency metrics.',
      'Your job is to answer the question using ONLY the provided rows, focusing on:',
      '- which slugs and keywords are strongest opportunities;',
      '- regional patterns;',
      '- concrete next steps (e.g., which slugs/regions to prioritize).',
      'Be concise, structured, and avoid fabricating data. If something is unknown, say so explicitly.',
    ].join(' ');

    const promptText = [
      `User question: ${query}`,
      '',
      'Context rows:',
      contextLines.join('\n'),
      '',
      'Now answer the user question. Start with a 2–3 sentence summary, then list 3–7 specific recommendations.',
    ].join('\n');

    const llmStartedAt = Date.now();
    const answerText = await generateText({
      system: systemPrompt,
      prompt: promptText,
      // Slightly lower default temperature and max tokens to reduce latency
      temperature: typeof temperature === 'number' ? temperature : 0.2,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : 300,
    });
    const llmMs = Date.now() - llmStartedAt;

    const payload = {
      status: 'ok',
      runDate: searchResult.runDate,
      query,
      params: {
        regionCodes: regionList || null,
        minRevenue: minRevenue ?? null,
        limit: safeLimit,
      },
      answer: answerText,
      context: {
        rows: tableRows,
      },
    };

    console.log('[s1.serp.qa]', {
      t_total_ms: Date.now() - startedAt,
      t_search_ms: searchMs,
      t_llm_ms: llmMs,
      limit: safeLimit,
      search_limit: searchLimit,
      answer_rows: answerRows.length,
      table_rows: tableRows.length,
      runDate: searchResult.runDate,
    });

    return res.status(200).json(payload);
  } catch (e: any) {
    console.error('[s1.serp.qa] Error:', e?.message || e);
    const status = e?.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 500;
    // Dev-friendly fallback when OpenAI is not configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        status: 'ok',
        mode: 'dev_fallback',
        answer:
          'DEV fallback: OPENAI_API_KEY is not set. QA endpoint is wired but LLM summarization is disabled.',
        context: { rows: [] },
      });
    }
    return res.status(status).json({ error: e?.message || 'SERP QA failed' });
  }
});

/**
 * POST /api/s1/serp/metrics
 *
 * Aggregated revenue metrics over SERP data.
 */
router.post('/serp/metrics', async (req, res) => {
  try {
    const { mode, runDate, limit, keyword, states } = req.body || {};

    if (!mode || typeof mode !== 'string') {
      return res.status(400).json({ error: 'mode is required (string)' });
    }

    const normalizedMode = mode as SerpMetricsMode;
    if (!['total_revenue', 'top_slugs', 'keyword_state_breakdown'].includes(normalizedMode)) {
      return res.status(400).json({ error: 'invalid mode' });
    }

    const metrics = await runSerpMetricsQuery({
      mode: normalizedMode,
      runDate,
      limit,
      keyword,
      states,
    });

    return res.status(200).json({
      mode: normalizedMode,
      runDate: metrics.runDate,
      rows: metrics.rows,
    });
  } catch (e: any) {
    console.error('[s1.serp.metrics] Error:', e?.message || e);
    const status = e?.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 500;
    return res
      .status(status)
      .json({ error: e?.message || 'SERP metrics query failed' });
  }
});

/**
 * POST /api/s1/query
 *
 * Generic analytics query endpoint for S1 SERP data.
 * Accepts an S1QuerySpec and returns aggregated rows plus the effective spec.
 */
router.post('/query', async (req, res) => {
  try {
    const spec = (req.body || {}) as S1QuerySpec;

    if (!spec || typeof spec.metric !== 'string') {
      return res.status(400).json({ error: 'metric is required' });
    }

    // Basic server-side validation of the spec to prevent arbitrary SQL.
    const allowedMetrics: S1QueryMetric[] = ['total_revenue', 'rpc', 'rps'];
    if (!allowedMetrics.includes(spec.metric)) {
      return res
        .status(400)
        .json({ error: `Unsupported metric: ${spec.metric}` });
    }

    if (spec.groupBy) {
      const allowedGroups: S1QueryGroupBy[] = ['slug', 'keyword', 'region'];
      for (const g of spec.groupBy) {
        if (!allowedGroups.includes(g)) {
          return res
            .status(400)
            .json({ error: `Unsupported groupBy field: ${g}` });
        }
      }
    }

    if (spec.orderBy) {
      if (!allowedMetrics.includes(spec.orderBy.field)) {
        return res
          .status(400)
          .json({ error: `Unsupported orderBy.field: ${spec.orderBy.field}` });
      }
      if (
        spec.orderBy.direction &&
        spec.orderBy.direction !== 'asc' &&
        spec.orderBy.direction !== 'desc'
      ) {
        return res
          .status(400)
          .json({ error: 'orderBy.direction must be "asc" or "desc"' });
      }
    }

    const { runDate, spec: effectiveSpec, rows } = await runSerpQuerySpec(spec);

    return res.status(200).json({
      status: 'ok',
      runDate,
      spec: effectiveSpec,
      rows,
    });
  } catch (e: any) {
    console.error('[s1.query] Error:', e?.message || e);
    const status =
      e?.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 500;
    return res
      .status(status)
      .json({ error: e?.message || 'SERP query failed' });
  }
});

/**
 * GET /api/s1/copilot
 *
 * Atlas-friendly GET endpoint for S1 SERP copilot.
 * Query param: `prompt` (required, URL-encoded)
 * Returns: plain text answer (ideal for ChatGPT Atlas Browser Companion)
 */
router.get('/copilot', async (req, res) => {
  try {
    const { prompt, runDate, limit } = req.query || {};

    if (!prompt || typeof prompt !== 'string') {
      return res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send('prompt query parameter is required (string)');
    }

    // Reuse the POST handler logic by calling it internally
    // Convert query params to match POST body format
    const body = {
      query: prompt,
      runDate: typeof runDate === 'string' ? runDate : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
    };

    // Call the internal copilot logic
    const qLower = prompt.toLowerCase();
    let mode: SerpMetricsMode | null = null;

    const hasTotalRevenue = qLower.includes('total revenue');
    const hasTopWord =
      qLower.includes('top ') ||
      qLower.includes('top-') ||
      qLower.includes('top_') ||
      qLower.includes('highest') ||
      qLower.includes('biggest') ||
      qLower.includes('best');
    const hasSlugLikeWord =
      qLower.includes('slugs') ||
      qLower.includes('slug ') ||
      qLower.includes('articles') ||
      qLower.includes('article ') ||
      qLower.includes('pages') ||
      qLower.includes('page ') ||
      qLower.includes('content');
    const mentionsRevenue = qLower.includes('revenue');
    const mentionsRpcOrRps =
      qLower.includes('rpc') || qLower.includes('rps') || qLower.includes('rev / click');

    const wantsKeywordState =
      qLower.includes('by state') ||
      qLower.includes('for state') ||
      qLower.includes('for keyword');

    const wantsTopSlugs =
      (hasTopWord && hasSlugLikeWord && mentionsRevenue) || mentionsRpcOrRps;

    if (wantsKeywordState) {
      mode = 'keyword_state_breakdown';
    } else if (wantsTopSlugs) {
      mode = 'top_slugs';
    } else if (hasTotalRevenue) {
      mode = 'total_revenue';
    }

    let answerText: string;

    if (mode) {
      const metrics = await runSerpMetricsQuery({
        mode,
        runDate: body.runDate,
        limit: body.limit,
        keyword: prompt,
      });

      const systemPrompt =
        'You are a SERP analytics copilot. You receive a marketer question and JSON metrics from System1 revenue data. ' +
        'Answer the question using ONLY the provided JSON, referencing concrete numbers where helpful. Be concise and avoid fabricating data.';

      const promptText = [
        `User question: ${prompt}`,
        '',
        'Metrics JSON:',
        JSON.stringify(
          {
            mode,
            runDate: metrics.runDate,
            rows: metrics.rows,
          },
          null,
          2
        ),
        '',
        'Explain the answer clearly in plain English.',
      ].join('\n');

      answerText = await generateText({
        system: systemPrompt,
        prompt: promptText,
        temperature: 0.2,
        maxTokens: 300,
      });
    } else {
      const safeLimit = body.limit ? Math.max(1, Math.min(200, Math.floor(body.limit))) : 50;
      const searchLimit = Math.max(safeLimit, 40);
      const searchResult = await serpVectorSearch({
        query: prompt,
        runDate: body.runDate || undefined,
        limit: searchLimit,
      });

      const allRows = searchResult.results;
      const answerRows = allRows.slice(0, Math.min(20, allRows.length));

      if (!allRows.length) {
        answerText =
          'No matching SERP rows were found for this question with the current filters. Try broadening the query or removing region/revenue filters.';
      } else {
        const contextLines: string[] = [];
        contextLines.push(
          'You are analyzing System1 SERP performance rows. Each row is a (keyword, content_slug, region) with performance metrics.',
          'Fields: serp_keyword, content_slug, region_code, est_net_revenue, sellside_searches, sellside_clicks_network, rpc, rps, cos, finalScore.',
          '',
          `Top ${answerRows.length} rows (sorted by finalScore):`
        );

        for (const r of answerRows as any[]) {
          contextLines.push(
            [
              `keyword="${r.serp_keyword}"`,
              `slug="${r.content_slug}"`,
              `region="${r.region_code}"`,
              `revenue=${r.est_net_revenue ?? 0}`,
              `searches=${r.sellside_searches ?? 0}`,
              `clicks=${r.sellside_clicks_network ?? 0}`,
              `rpc=${r.rpc ?? 0}`,
              `rps=${r.rps ?? 0}`,
            ].join(' | ')
          );
        }

        const systemPrompt = [
          'You are an optimization and market-mapping copilot for System1 SERP data.',
          'You are given a user question and a list of SERP rows with revenue and efficiency metrics.',
          'Your job is to answer the question using ONLY the provided rows, focusing on:',
          '- which slugs and keywords are strongest opportunities;',
          '- regional patterns;',
          '- concrete next steps (e.g., which slugs/regions to prioritize).',
          'Be concise, structured, and avoid fabricating data. If something is unknown, say so explicitly.',
        ].join(' ');

        const promptText = [
          `User question: ${prompt}`,
          '',
          'Context rows:',
          contextLines.join('\n'),
          '',
          'Now answer the user question. Start with a 2–3 sentence summary, then list 3–7 specific recommendations.',
        ].join('\n');

        answerText = await generateText({
          system: systemPrompt,
          prompt: promptText,
          temperature: 0.2,
          maxTokens: 300,
        });
      }
    }

    console.log('[s1.copilot.GET]', {
      prompt_length: prompt.length,
      mode: mode || 'qa_fallback',
      answer_length: answerText.length,
    });

    res
      .status(200)
      .type('text/plain; charset=utf-8')
      .send(answerText);
  } catch (e: any) {
    console.error('[s1.copilot.GET] Error:', e?.message || e);
    const status = e?.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 500;
    return res
      .status(status)
      .type('text/plain; charset=utf-8')
      .send(e?.message || 'S1 copilot failed');
  }
});

/**
 * POST /api/s1/copilot
 *
 * Text-only copilot that routes between metrics modes and SERP QA.
 */
router.post('/copilot', async (req, res) => {
  try {
    const startedAt = Date.now();
    const {
      query,
      runDate,
      limit,
      regionCodes,
      minRevenue,
      keyword,
      states,
      temperature,
      maxTokens,
    } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send('query is required (string)');
    }

    const qLower = query.toLowerCase();
    let mode: SerpMetricsMode | null = null;

    const hasTotalRevenue = qLower.includes('total revenue');
    const hasTopWord =
      qLower.includes('top ') ||
      qLower.includes('top-') ||
      qLower.includes('top_') ||
      qLower.includes('highest') ||
      qLower.includes('biggest') ||
      qLower.includes('best');
    const hasSlugLikeWord =
      qLower.includes('slugs') ||
      qLower.includes('slug ') ||
      qLower.includes('articles') ||
      qLower.includes('article ') ||
      qLower.includes('pages') ||
      qLower.includes('page ') ||
      qLower.includes('content');
    const mentionsRevenue = qLower.includes('revenue');
    const mentionsRpcOrRps =
      qLower.includes('rpc') || qLower.includes('rps') || qLower.includes('rev / click');

    const wantsKeywordState =
      qLower.includes('by state') ||
      qLower.includes('for state') ||
      qLower.includes('for keyword');

    const wantsTopSlugs =
      (hasTopWord && hasSlugLikeWord && mentionsRevenue) || mentionsRpcOrRps;

    if (wantsKeywordState) {
      mode = 'keyword_state_breakdown';
    } else if (wantsTopSlugs) {
      mode = 'top_slugs';
    } else if (hasTotalRevenue) {
      mode = 'total_revenue';
    }

    let answerText: string;

    if (mode) {
      // Metrics-based copilot
      const metrics = await runSerpMetricsQuery({
        mode,
        runDate,
        limit,
        keyword: keyword || query,
        states: states || regionCodes,
      });

      const systemPrompt =
        'You are a SERP analytics copilot. You receive a marketer question and JSON metrics from System1 revenue data. ' +
        'Answer the question using ONLY the provided JSON, referencing concrete numbers where helpful. Be concise and avoid fabricating data.';

      const prompt = [
        `User question: ${query}`,
        '',
        'Metrics JSON:',
        JSON.stringify(
          {
            mode,
            runDate: metrics.runDate,
            rows: metrics.rows,
          },
          null,
          2
        ),
        '',
        'Explain the answer clearly in plain English.',
      ].join('\n');

      answerText = await generateText({
        system: systemPrompt,
        prompt,
        temperature: 0.2,
        maxTokens: typeof maxTokens === 'number' ? maxTokens : 300,
      });
    } else {
      // Fallback to SERP QA-style behavior (vector search + LLM narrative)
      const safeLimit =
        typeof limit === 'number'
          ? Math.max(1, Math.min(200, Math.floor(limit)))
          : 50;

      const regionList = Array.isArray(regionCodes)
        ? regionCodes.map((r: unknown) => String(r)).filter((r) => r.trim().length > 0)
        : undefined;

      const searchLimit = Math.max(safeLimit, 40);
      const searchStartedAt = Date.now();
      const searchResult = await serpVectorSearch({
        query,
        runDate: runDate || undefined,
        regionCodes: regionList && regionList.length > 0 ? regionList : undefined,
        minRevenue:
          typeof minRevenue === 'number' && Number.isFinite(minRevenue)
            ? minRevenue
            : undefined,
        limit: searchLimit,
      });
      const searchMs = Date.now() - searchStartedAt;

      const allRows = searchResult.results;
      const answerRows = allRows.slice(0, Math.min(20, allRows.length));

      if (!allRows.length) {
        answerText =
          'No matching SERP rows were found for this question with the current filters. Try broadening the query or removing region/revenue filters.';
      } else {
        const contextLines: string[] = [];
        contextLines.push(
          'You are analyzing System1 SERP performance rows. Each row is a (keyword, content_slug, region) with performance metrics.',
          'Fields: serp_keyword, content_slug, region_code, est_net_revenue, sellside_searches, sellside_clicks_network, rpc, rps, cos, finalScore.',
          '',
          `Top ${answerRows.length} rows (sorted by finalScore):`
        );

        for (const r of answerRows as any[]) {
          contextLines.push(
            [
              `keyword="${r.serp_keyword}"`,
              `slug="${r.content_slug}"`,
              `region="${r.region_code}"`,
              `revenue=${r.est_net_revenue ?? 0}`,
              `searches=${r.sellside_searches ?? 0}`,
              `clicks=${r.sellside_clicks_network ?? 0}`,
              `rpc=${r.rpc ?? 0}`,
              `rps=${r.rps ?? 0}`,
            ].join(' | ')
          );
        }

        const systemPrompt = [
          'You are an optimization and market-mapping copilot for System1 SERP data.',
          'You are given a user question and a list of SERP rows with revenue and efficiency metrics.',
          'Your job is to answer the question using ONLY the provided rows, focusing on:',
          '- which slugs and keywords are strongest opportunities;',
          '- regional patterns;',
          '- concrete next steps (e.g., which slugs/regions to prioritize).',
          'Be concise, structured, and avoid fabricating data. If something is unknown, say so explicitly.',
        ].join(' ');

        const promptText = [
          `User question: ${query}`,
          '',
          'Context rows:',
          contextLines.join('\n'),
          '',
          'Now answer the user question. Start with a 2–3 sentence summary, then list 3–7 specific recommendations.',
        ].join('\n');

        const llmStartedAt = Date.now();
        answerText = await generateText({
          system: systemPrompt,
          prompt: promptText,
          temperature: typeof temperature === 'number' ? temperature : 0.2,
          maxTokens: typeof maxTokens === 'number' ? maxTokens : 300,
        });
        const llmMs = Date.now() - llmStartedAt;

        console.log('[s1.copilot.qa_fallback]', {
          t_total_ms: Date.now() - startedAt,
          t_search_ms: searchMs,
          t_llm_ms: llmMs,
          limit: safeLimit,
          search_limit: searchLimit,
          answer_rows: answerRows.length,
          runDate: searchResult.runDate,
        });
      }
    }

    res
      .status(200)
      .type('text/plain; charset=utf-8')
      .send(answerText);
  } catch (e: any) {
    console.error('[s1.copilot] Error:', e?.message || e);
    const status = e?.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 500;
    return res
      .status(status)
      .type('text/plain; charset=utf-8')
      .send(e?.message || 'S1 copilot failed');
  }
});

/**
 * POST /api/s1/agent
 *
 * Minimal S1 "agent" endpoint:
 * 1) Uses an LLM planner to choose which S1 tool to call.
 * 2) Executes the chosen tool (metrics/vector search).
 * 3) Uses an LLM to turn tool output into a final natural language answer.
 */
router.post('/agent', async (req, res) => {
  try {
    const { query, threadId } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }

    const startedAt = Date.now();

    const threadKey =
      typeof threadId === 'string' && threadId.trim().length > 0
        ? threadId
        : 'default';

    // Look up previous state for this thread so the agent can reason over
    // both the current and prior results (Cursor-style behavior).
    const previous = s1AgentState.get(threadKey);

    const qLower = query.toLowerCase();
    const isWhyOnlyFollowup =
      !!previous &&
      (qLower.includes('why only') ||
        qLower.includes('why were the first') ||
        qLower.includes('why did we only get') ||
        qLower.includes('why just ') ||
        qLower.includes('why are there only'));

    let plan: S1Plan;
    let toolResult: any;

    if (isWhyOnlyFollowup && previous) {
      // For "why only N?" style questions, reuse the previous plan/toolResult
      // instead of calling new tools. This lets the LLM explain based on the
      // already-fetched data, similar to how Cursor inspects prior steps.
      plan = previous.lastPlan;
      toolResult = previous.lastToolResult;
      console.log('[s1.agent] follow-up using previous plan/result for thread', threadKey);
    } else {
      // 1) PLAN
      plan = await planS1Action(query);
      console.log('[s1.agent] plan_selected', {
        threadKey,
        query_len: query.length,
        tool: plan.tool,
        // Log only high-level params to avoid leaking PII
        params:
          plan.tool === 'top_slugs'
            ? { limit: plan.limit }
            : plan.tool === 'keywords_for_slug'
            ? { slug: plan.slug, limit: plan.limit ?? 50 }
            : plan.tool === 'keyword_total'
            ? { keyword_len: plan.keyword.length }
            : plan.tool === 'keyword_state_breakdown'
            ? {
                keyword_len: plan.keyword.length,
                states: Array.isArray(plan.states) ? plan.states : undefined,
              }
            : plan.tool === 'qa_search'
            ? { query_len: plan.query.length }
            : plan.tool === 'query_spec'
            ? {
                metric: plan.spec.metric,
                groupBy: plan.spec.groupBy,
                hasFilters: !!plan.spec.filters,
                limit: plan.spec.limit,
              }
            : undefined,
      });

      // 2) ACT
      if (plan.tool === 'keyword_total') {
        toolResult = await toolKeywordTotalRevenue(plan.keyword);
      } else if (plan.tool === 'top_slugs') {
        toolResult = await toolTopSlugs(plan.limit);
      } else if (plan.tool === 'keywords_for_slug') {
        toolResult = await toolKeywordsForSlug(
          plan.slug,
          typeof plan.limit === 'number' ? plan.limit : 50
        );
      } else if (plan.tool === 'qa_search') {
        toolResult = await toolSerpSearch(plan.query, 50);
      } else {
        // For now, fall back to qa_search for keyword_state_breakdown or unknown tools
        toolResult = await toolSerpSearch(query, 50);
      }
    }

    // Compute summary stats for logging without leaking raw rows
    let rowCount: number | null = null;
    let revenueMin: number | null = null;
    let revenueMax: number | null = null;

    const rows: any[] | null = Array.isArray((toolResult as any)?.rows)
      ? (toolResult as any).rows
      : Array.isArray((toolResult as any)?.results)
      ? (toolResult as any).results
      : null;

    if (rows) {
      rowCount = rows.length;
      for (const r of rows) {
        const revenueRaw =
          r.total_revenue ??
          r.est_net_revenue ??
          r.revenue ??
          r.totalRevenue ??
          null;
        const revenue = typeof revenueRaw === 'string' ? Number(revenueRaw) : revenueRaw;
        if (typeof revenue === 'number' && Number.isFinite(revenue)) {
          if (revenueMin === null || revenue < revenueMin) revenueMin = revenue;
          if (revenueMax === null || revenue > revenueMax) revenueMax = revenue;
        }
      }
    }

    const tTotalMs = Date.now() - startedAt;

    console.log('[s1.agent] tool_result_summary', {
      threadKey,
      tool: plan.tool,
      type: (toolResult as any)?.type,
      is_followup: isWhyOnlyFollowup,
      rows: rowCount,
      revenue_min: revenueMin,
      revenue_max: revenueMax,
      t_total_ms: tTotalMs,
    });

    const wantsTable = /\btable\b/i.test(query);

    const system = `
You are a System1 SERP analytics copilot.
You are given:
- a user question
- the tool plan that was chosen
- JSON results from that tool

Use ONLY the JSON values provided to answer; do not invent data, errors, or missing parameters.
If a total revenue value is present, state the number clearly.
If the user asks for "top N" items and the JSON contains at least N rows, list exactly N rows (no placeholders such as "—") in a clear, ordered format (for example, a markdown table with Rank, Slug, and the requested metrics).
If there are fewer rows than requested, say so explicitly and list all available rows.
Never claim that a backend error occurred unless there is an explicit "error" field in the provided JSON.
Never use placeholder characters like em-dashes in place of real rows; if data is missing, explain it in plain text instead.
When you present tabular results, always use a standard markdown table (pipes and header row) and do NOT emit any custom UI or C1 components.
If the plan.tool is "top_slugs" or "keywords_for_slug" and the user requested a table, your primary output should be a markdown table built directly from the JSON rows in descending order of revenue, followed by a short text summary.`;

    const answerPromptParts: string[] = [
      `User question: ${query}`,
      '',
    ];

    if (previous) {
      answerPromptParts.push(
        'Previous tool plan JSON:',
        JSON.stringify(previous.lastPlan, null, 2),
        '',
        'Previous tool result JSON:',
        JSON.stringify(previous.lastToolResult, null, 2),
        '',
      );
    }

    answerPromptParts.push(
      'Tool plan JSON:',
      JSON.stringify(plan, null, 2),
      '',
      'Tool result JSON:',
      JSON.stringify(toolResult, null, 2),
      '',
    );

    if (isWhyOnlyFollowup) {
      answerPromptParts.push(
        'The user is asking why only a certain number of items appeared in the previous results.',
        'Explain the likely reasons based on the JSON (for example: explicit limits, filters, or data availability).',
        'Do NOT invent backend errors or missing parameters unless they are explicitly present in the JSON.'
      );
    } else {
      if (wantsTable && rows) {
        if (plan.tool === 'keywords_for_slug') {
          answerPromptParts.push(
            'The user asked for the top revenue-producing keywords for a specific slug and explicitly requested a table.',
            'Using ONLY the JSON rows (each row representing a keyword with total_revenue, rpc, and rps), produce a markdown table with columns: Rank, Keyword, Total Revenue, RPC, RPS.',
            'Sort the table in descending order of total revenue, using the order provided in the JSON if it is already sorted.',
            'Do not add or synthesize any rows that are not present in the JSON.'
          );
        } else if (plan.tool === 'top_slugs') {
          answerPromptParts.push(
            'The user asked for the top slugs by revenue and requested a table.',
            'Using ONLY the JSON rows (each row representing a slug with total_revenue, rpc, and rps), produce a markdown table with columns: Rank, Slug, Total Revenue, RPC, RPS.',
            'Sort the table in descending order of total revenue, using the order provided in the JSON if it is already sorted.',
            'Do not add or synthesize any rows that are not present in the JSON.'
          );
        } else {
          answerPromptParts.push(
            'The user requested that results be displayed in a table.',
            'If the JSON rows naturally form a list of items, render them as a markdown table using only fields that exist in the JSON.',
            'Do not add or synthesize any rows or columns that are not present in the JSON.'
          );
        }
      }

      answerPromptParts.push(
        "Now answer the user's question clearly, using the numbers from the JSON.",
      );
    }

    const answerPrompt = answerPromptParts.join('\n');

    const answer = await generateText({
      system,
      prompt: answerPrompt,
      temperature: 0.2,
      maxTokens: 400,
    });

    // Update thread state so future follow-ups can reference this result.
    s1AgentState.set(threadKey, { lastPlan: plan, lastToolResult: toolResult });

    return res.status(200).json({
      status: 'ok',
      plan,
      toolResult,
      answer,
    });
  } catch (e: any) {
    console.error('[s1.agent] Error:', e?.message || e);
    return res
      .status(500)
      .json({ error: e?.message || 'S1 agent failed' });
  }
});

export default router;


