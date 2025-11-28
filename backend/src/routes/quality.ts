import express from 'express';
import { evaluatePageWithGuidelines, PageEvalInput } from '../lib/qualityEvaluator';

const router = express.Router();

/**
 * POST /api/quality/eval
 *
 * Run a guideline-grounded evaluation for a single page.
 *
 * Expected body:
 * {
 *   "query": string,          // user query / force key
 *   "pageSummary": string,    // concise natural-language summary of the page
 *   "widgetSummary"?: string, // optional monetization/widget description
 *   "ymyLHint"?: boolean
 * }
 */
router.post('/eval', async (req, res) => {
  try {
    const { query, pageSummary, widgetSummary, ymyLHint } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }
    if (!pageSummary || typeof pageSummary !== 'string') {
      return res.status(400).json({ error: 'pageSummary is required (string)' });
    }

    const input: PageEvalInput = {
      query,
      pageSummary,
      widgetSummary: typeof widgetSummary === 'string' ? widgetSummary : undefined,
      ymyLHint: typeof ymyLHint === 'boolean' ? ymyLHint : undefined,
    };

    const result = await evaluatePageWithGuidelines(input);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[quality/eval] Error:', err);
    return res
      .status(500)
      .json({ error: err?.message || 'Quality evaluation failed' });
  }
});

export default router;


