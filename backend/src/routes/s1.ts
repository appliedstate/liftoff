import { Router } from 'express';
import { serpVectorSearch } from '../scripts/vector/search_serp';

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
 * Stub endpoint for SERP question-answering over System1 data.
 * For now, this returns a canned answer and echoes the intended shape.
 */
router.post('/serp/qa', (req, res) => {
  const { query, regionCodes, runDate, limit } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required (string)' });
  }

  const safeLimit =
    typeof limit === 'number'
      ? Math.max(1, Math.min(50, Math.floor(limit)))
      : 20;

  return res.status(200).json({
    status: 'ok',
    mode: 'stub',
    message:
      'SERP QA stub – this is where we will run vector search + LLM summarization over System1 SERP embeddings.',
    input: {
      query,
      regionCodes: Array.isArray(regionCodes) ? regionCodes : null,
      runDate: runDate || null,
      limit: safeLimit,
    },
    answer: null,
    context: {
      rows: [],
    },
  });
});

export default router;


