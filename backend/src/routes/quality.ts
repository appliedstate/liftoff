import express from 'express';
import { evaluatePageWithGuidelines, PageEvalInput } from '../lib/qualityEvaluator';
import { getPgPool } from '../lib/pg';

const router = express.Router();

/**
 * POST /api/quality/eval
 *
 * Run a guideline-grounded evaluation for a single page.
 *
 * Expected body (two options):
 *
 * Option 1: Provide URL (recommended - extracts full article automatically):
 * {
 *   "query": string,          // user query / force key
 *   "url": string,            // URL to evaluate (system will extract full content)
 *   "ymyLHint"?: boolean,
 *   "saveForTraining"?: boolean
 * }
 *
 * Option 2: Provide content directly:
 * {
 *   "query": string,          // user query / force key
 *   "pageSummary": string,    // page metadata (title, H1, author, etc.)
 *   "fullArticleText": string, // full article body content
 *   "widgetSummary"?: string, // optional monetization/widget description
 *   "ymyLHint"?: boolean,
 *   "saveForTraining"?: boolean
 * }
 */
router.post('/eval', async (req, res) => {
  try {
    const { query, url, pageSummary, fullArticleText, widgetSummary, ymyLHint, saveForTraining } =
      req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required (string)' });
    }

    // Must provide either URL or content
    if (!url && !pageSummary && !fullArticleText) {
      return res.status(400).json({
        error:
          'Either url, or (pageSummary/fullArticleText) must be provided. Use url for automatic extraction.',
      });
    }

    const input: PageEvalInput = {
      query,
      url: typeof url === 'string' ? url : undefined,
      pageSummary: typeof pageSummary === 'string' ? pageSummary : undefined,
      fullArticleText: typeof fullArticleText === 'string' ? fullArticleText : undefined,
      widgetSummary: typeof widgetSummary === 'string' ? widgetSummary : undefined,
      ymyLHint: typeof ymyLHint === 'boolean' ? ymyLHint : undefined,
    };

    const startTime = Date.now();
    const result = await evaluatePageWithGuidelines(input);
    const evaluationTimeMs = Date.now() - startTime;

    // Optionally save evaluation to DB for analysis/fine-tuning
    const shouldSaveForTraining = saveForTraining === true;
    if (shouldSaveForTraining) {
      try {
        const pool = getPgPool();
        await pool.query(
          `INSERT INTO quality_evaluations 
           (query, page_summary, widget_summary, ymyl_hint, classification, dimensions, model_version, evaluation_time_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            query,
            input.pageSummary || input.url || 'N/A',
            input.widgetSummary || null,
            input.ymyLHint || null,
            JSON.stringify(result.classification),
            JSON.stringify(result.dimensions),
            process.env.QUALITY_EVAL_MODEL || 'gpt-4.1-mini',
            evaluationTimeMs,
          ]
        );
      } catch (dbErr: any) {
        // Log but don't fail the request if DB save fails
        console.error('[quality/eval] Failed to save evaluation to DB:', dbErr?.message);
      }
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[quality/eval] Error:', err);
    return res
      .status(500)
      .json({ error: err?.message || 'Quality evaluation failed' });
  }
});

export default router;


