import express from 'express';
import { vectorSearch } from '../scripts/vector/search';

const router = express.Router();

// GET /api/vector/search?q=...&k=100&angle=...&category=...&minRevenue=...&runDate=YYYY-MM-DD
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    if (!q) return res.status(400).json({ code: 'bad_request', message: 'Missing q' });
    const k = req.query.k != null ? parseInt(String(req.query.k), 10) : undefined;
    const angle = req.query.angle ? String(req.query.angle) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const minRevenue = req.query.minRevenue != null ? Number(req.query.minRevenue) : undefined;
    const runDate = req.query.runDate ? String(req.query.runDate) : undefined;

    const { runDate: rd, results } = await vectorSearch({ q, k, angle, category, minRevenue, runDate });
    res.json({
      query: q,
      runDate: rd,
      params: { k: k ?? 100, angle: angle || null, category: category || null, minRevenue: minRevenue ?? null },
      results,
    });
  } catch (err: any) {
    console.error('vector.search error', err);
    res.status(500).json({ code: 'internal_error', message: 'Search failed' });
  }
});

export default router;


