import { Router } from 'express';
import { serpVectorSearch } from '../scripts/vector/search_serp';
import { generateText } from '../lib/openai';
import { getPgPool } from '../lib/pg';

const router = Router();

type SerpMetricsMode = 'total_revenue' | 'top_slugs' | 'keyword_state_breakdown';

type SerpMetricsInput = {
  mode: SerpMetricsMode;
  runDate?: string;
  limit?: number;
  keyword?: string;
  states?: string[];
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

async function runSerpMetricsQuery(input: SerpMetricsInput): Promise<{ runDate: string; rows: any[] }> {
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
          SUM(COALESCE(est_net_revenue, 0)) AS total_revenue
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

    if (qLower.includes('total revenue')) {
      mode = 'total_revenue';
    } else if (qLower.includes('top slugs') || (qLower.includes('slugs') && qLower.includes('revenue'))) {
      mode = 'top_slugs';
    } else if (
      qLower.includes('by state') ||
      qLower.includes('for state') ||
      qLower.includes('for keyword')
    ) {
      mode = 'keyword_state_breakdown';
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

export default router;


