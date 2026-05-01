import express from 'express';
import { evaluateMetaReviewPressure } from '../lib/metaReviewPressure';

const router = express.Router();

router.post('/run', (req, res) => {
  try {
    const result = evaluateMetaReviewPressure(req.body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Meta review-pressure evaluation failed' });
  }
});

export default router;
