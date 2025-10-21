import { Router } from 'express';
import { searchMetaAdLibrary } from '../lib/searchapi';
import { fetchAdsForPages, groupAdsByCategory } from '../services/metaAdsService';

const router = Router();

router.get('/search', async (req, res) => {
  try {
    const {
      q,
      country,
      active_status = 'active',
      platforms = 'facebook,instagram',
      start_date,
      end_date,
      next_page_token,
      page_id,
      content_languages
    } = req.query as Record<string, string>;

    const data = await searchMetaAdLibrary({
      q,
      country,
      active_status: active_status as any,
      platforms,
      start_date,
      end_date,
      next_page_token,
      page_id,
      content_languages
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

// Analyze a list of page IDs
router.post('/pages/analyze', async (req, res) => {
  try {
    const { pageIds, country, start_date, end_date, platforms, active_status } = req.body || {};
    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'pageIds[] is required' });
    }
    const ads = await fetchAdsForPages({ pageIds, country, start_date, end_date, platforms, active_status });
    const byCategory = groupAdsByCategory(ads);
    res.json({ ok: true, counts: Object.fromEntries(Object.entries(byCategory).map(([k,v]) => [k, v.length])), ads });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get ad details by ad_archive_id
router.get('/ad/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const data = await searchMetaAdLibrary({ q: id, active_status: 'all' as any });
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


