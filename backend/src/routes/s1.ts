import { Router } from 'express';
import { serpVectorSearch } from '../scripts/vector/search_serp';
import { generateText } from '../lib/openai';

const router = Router();

/**
 * POST /api/s1/serp/search
 *
 * SERP vector search over System1 data (pgvector-backed).
 */
router.post('/serp/search', async (req, res) => {
  try {
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

    return res.status(200).json({
      status: 'ok',
      runDate: searchResult.runDate,
      query,
      params: {
        regionCodes: regionList || null,
        minRevenue: searchResult.results.length ? minRevenue ?? null : null,
        limit: safeLimit,
      },
      results: searchResult.results,
    });
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
    const { query, regionCodes, runDate, limit, minRevenue, temperature, maxTokens } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }

    const safeLimit =
      typeof limit === 'number'
        ? Math.max(1, Math.min(50, Math.floor(limit)))
        : 20;

    const regionList = Array.isArray(regionCodes)
      ? regionCodes.map((r) => String(r)).filter((r) => r.trim().length > 0)
      : undefined;

    // Fetch richer context than we plan to show to user; we can always truncate in the answer
    const searchResult = await serpVectorSearch({
      query,
      runDate: runDate || undefined,
      regionCodes: regionList && regionList.length > 0 ? regionList : undefined,
      minRevenue:
        typeof minRevenue === 'number' && Number.isFinite(minRevenue)
          ? minRevenue
          : undefined,
      limit: Math.max(safeLimit, 40),
    });

    const rows = searchResult.results.slice(0, safeLimit);

    // If no rows returned, answer gracefully without calling LLM
    if (!rows.length) {
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
      `Top ${rows.length} rows (sorted by finalScore):`
    );

    for (const r of rows) {
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

    const answerText = await generateText({
      system: systemPrompt,
      prompt: promptText,
      temperature: typeof temperature === 'number' ? temperature : 0.2,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : 600,
    });

    return res.status(200).json({
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
        rows,
      },
    });
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

export default router;


