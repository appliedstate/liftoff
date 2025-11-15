import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { searchMetaAdLibrary } from '../lib/searchapi';
import { fetchAdsForPages, groupAdsByCategory } from '../services/metaAdsService';
import { listDiscoveryRuns } from '../services/discoveryPageIndex';
import { csvToManualMappings } from '../services/csvToMappings';
import { findSlugsByManualMapping } from '../services/system1SlugMatcher';

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

// Offline summary using existing run CSV (no external API calls)
router.get('/offline-run', async (req, res) => {
  try {
    const {
      run,
      mappingsCsv,
      max_ads,
      use_widget = '1'
    } = req.query as Record<string, string>;

    if (!run || !mappingsCsv) {
      return res.status(400).json({ ok: false, error: 'Provide run and mappingsCsv' });
    }

    // Load mappings from CSV
    let mappings = csvToManualMappings(mappingsCsv);

    // Load ads.csv from run
    const runDir = path.resolve(process.cwd(), 'runs', run);
    const adsCsv = path.join(runDir, 'ads.csv');
    if (!fs.existsSync(adsCsv)) {
      return res.status(404).json({ ok: false, error: `ads.csv not found in run: ${run}` });
    }
    const content = fs.readFileSync(adsCsv, 'utf-8');
    const lines = splitCsvRecords(content);
    if (lines.length <= 1) {
      return res.json({ ok: true, counts: {}, ads_sample: [], slug_connections: [] });
    }
    const header = parseCsvLine(lines[0]);
    const idx = new Map<string, number>();
    header.forEach((h, i) => idx.set(h, i));
    const pageIdx = idx.get('page_id') ?? -1;
    const kwIdx = idx.get('extracted_keywords') ?? -1;
    const widgetIdx = idx.get('widget_phrases') ?? -1;
    if (pageIdx === -1 || (kwIdx === -1 && widgetIdx === -1)) {
      return res.status(400).json({ ok: false, error: 'Required columns not found in ads.csv' });
    }

    const ads: Array<{ page_id: string; keywords: string[] }> = [];
    const limit = max_ads ? Number(max_ads) : undefined;
    for (let i = 1; i < lines.length; i++) {
      if (limit && ads.length >= limit) break;
      const row = parseCsvLine(lines[i]);
      const page_id = (row[pageIdx] || '').trim();
      const kws = new Set<string>();
      if (kwIdx !== -1) {
        String(row[kwIdx] || '').split('|').map(s => s.trim()).filter(Boolean).forEach(k => kws.add(k));
      }
      if (use_widget === '1' && widgetIdx !== -1) {
        String(row[widgetIdx] || '').split('|').map(s => s.trim()).filter(Boolean).forEach(k => kws.add(k));
      }
      ads.push({ page_id, keywords: Array.from(kws) });
    }

    // Precompute mapping helpers
    const slugToKeywords = new Map<string, Set<string>>();
    for (const m of mappings) {
      const slug = (m.slugs[0] || '').trim();
      if (!slug) continue;
      if (!slugToKeywords.has(slug)) slugToKeywords.set(slug, new Set());
      m.keywords.forEach(k => slugToKeywords.get(slug)!.add(k));
    }

    // Find matches per ad
    const adMatches: Array<{ page_id: string; slugs: string[] }> = [];
    for (const ad of ads) {
      const matchedSlugs: string[] = [];
      for (const [slug, kwset] of slugToKeywords.entries()) {
        if (ad.keywords.some(k => kwset.has(k))) {
          matchedSlugs.push(slug);
        }
      }
      if (matchedSlugs.length > 0) {
        adMatches.push({ page_id: ad.page_id, slugs: matchedSlugs });
      }
    }

    // Enrich with System1 metrics (optional, uses local CSVs)
    let metrics = await findSlugsByManualMapping(mappings);
    const metricBySlug = new Map(metrics.map(m => [m.slug, m]));

    // Build slug connections summary
    const slugConnections: Record<string, {
      slug: string;
      ads_count: number;
      page_ids: Set<string>;
      revenue?: number;
      clicks?: number;
      rpc?: number;
    }> = {};
    for (const m of adMatches) {
      for (const slug of m.slugs) {
        if (!slugConnections[slug]) {
          const met = metricBySlug.get(slug);
          slugConnections[slug] = {
            slug,
            ads_count: 0,
            page_ids: new Set(),
            revenue: met?.revenue,
            clicks: met?.clicks,
            rpc: met?.rpc
          };
        }
        slugConnections[slug].ads_count += 1;
        slugConnections[slug].page_ids.add(m.page_id);
      }
    }

    const summary = Object.values(slugConnections)
      .map(s => ({
        slug: s.slug,
        ads_count: s.ads_count,
        pages: Array.from(s.page_ids),
        revenue: s.revenue,
        clicks: s.clicks,
        rpc: s.rpc
      }))
      .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));

    return res.json({
      ok: true,
      pages_analyzed: new Set(ads.map(a => a.page_id)).size,
      ads_total: ads.length,
      matched_ads: adMatches.length,
      distinct_slugs: summary.length,
      slug_connections: summary.slice(0, 50)
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

// Quick test via GET (browser-friendly): accepts query params and returns a trimmed summary
router.get('/quick-test', async (req, res) => {
  try {
    const {
      discoveryRun,
      pageIds,
      max_pages,
      country,
      start_date,
      end_date,
      platforms = 'facebook,instagram',
      active_status = 'active',
      mappingsCsv
    } = req.query as Record<string, string>;

    if (!discoveryRun && !pageIds) {
      return res.status(400).json({ ok: false, error: 'Provide discoveryRun or pageIds (comma-separated)' });
    }

    // Convert CSV to mappings if provided
    let finalMappings = undefined as ReturnType<typeof csvToManualMappings> | undefined;
    if (mappingsCsv) {
      try {
        finalMappings = csvToManualMappings(mappingsCsv);
      } catch (err: any) {
        return res.status(400).json({ ok: false, error: `Failed to parse mappings CSV: ${err.message}` });
      }
    }

    // Parse pageIds if provided via query
    const pagesArray = pageIds ? String(pageIds).split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const ads = await fetchAdsForPages({
      pageIds: pagesArray,
      discoveryRun: discoveryRun || undefined,
      max_pages: max_pages ? Number(max_pages) : undefined,
      country,
      start_date,
      end_date,
      platforms,
      active_status: active_status as any,
      manualMappings: finalMappings
    });

    const byCategory = groupAdsByCategory(ads);

    // Aggregate slug connections for summary (trimmed)
    const slugConnections: Record<string, {
      slug: string;
      revenue: number;
      clicks: number;
      rpc: number;
      ads_count: number;
      page_ids: Set<string>;
      keywords: Set<string>;
    }> = {};
    for (const ad of ads) {
      if (ad.matching_slugs && ad.matching_slugs.length > 0) {
        for (const slugMatch of ad.matching_slugs) {
          if (!slugConnections[slugMatch.slug]) {
            slugConnections[slugMatch.slug] = {
              slug: slugMatch.slug,
              revenue: 0,
              clicks: 0,
              rpc: 0,
              ads_count: 0,
              page_ids: new Set(),
              keywords: new Set()
            };
          }
          const conn = slugConnections[slugMatch.slug];
          conn.revenue = Math.max(conn.revenue, slugMatch.revenue);
          conn.clicks = Math.max(conn.clicks, slugMatch.clicks);
          conn.rpc = slugMatch.rpc;
          conn.ads_count += 1;
          conn.page_ids.add(ad.page_id);
          if (ad.extracted_keywords) ad.extracted_keywords.forEach(k => conn.keywords.add(k));
          if (ad.widget_phrases) ad.widget_phrases.forEach(k => conn.keywords.add(k));
        }
      }
    }

    const slugSummary = Object.values(slugConnections).map(conn => ({
      slug: conn.slug,
      revenue: conn.revenue,
      clicks: conn.clicks,
      rpc: conn.rpc,
      ads_count: conn.ads_count,
      page_ids: Array.from(conn.page_ids),
      keywords: Array.from(conn.keywords).slice(0, 10)
    })).sort((a, b) => b.revenue - a.revenue);

    // Trim large arrays for fast inspection in the browser
    const trimmed = {
      ok: true,
      counts: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])),
      ads_sample: ads.slice(0, 10),
      slug_connections: slugSummary.slice(0, 20)
    };

    res.json(trimmed);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List available discovery runs
router.get('/discovery-runs', async (req, res) => {
  try {
    const runs = listDiscoveryRuns();
    res.json({ ok: true, runs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Analyze a list of page IDs
router.post('/pages/analyze', async (req, res) => {
  try {
    const { 
      pageIds, 
      discoveryRun, // Use page IDs from this discovery run
      max_pages,
      country, 
      start_date, 
      end_date, 
      platforms, 
      active_status,
      manualMappings, // Manual keyword→slug mappings: [{ keywords: [...], slugs: [...] }]
      mappingsCsv // Path to CSV file with keyword,slug columns to convert to mappings
    } = req.body || {};
    
    if (!discoveryRun && (!Array.isArray(pageIds) || pageIds.length === 0)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Either pageIds[] or discoveryRun must be provided' 
      });
    }

    // Convert CSV to mappings if provided
    let finalMappings = manualMappings;
    if (mappingsCsv && typeof mappingsCsv === 'string') {
      try {
        finalMappings = csvToManualMappings(mappingsCsv);
      } catch (err: any) {
        return res.status(400).json({
          ok: false,
          error: `Failed to parse mappings CSV: ${err.message}`
        });
      }
    }
    
    const ads = await fetchAdsForPages({ 
      pageIds, 
      discoveryRun,
      max_pages,
      country, 
      start_date, 
      end_date, 
      platforms, 
      active_status,
      manualMappings: finalMappings
    });
    const byCategory = groupAdsByCategory(ads);
    
    // Aggregate slug connections for summary
    const slugConnections: Record<string, {
      slug: string;
      revenue: number;
      clicks: number;
      rpc: number;
      ads_count: number;
      page_ids: Set<string>;
      keywords: Set<string>;
    }> = {};
    
    for (const ad of ads) {
      if (ad.matching_slugs && ad.matching_slugs.length > 0) {
        for (const slugMatch of ad.matching_slugs) {
          if (!slugConnections[slugMatch.slug]) {
            slugConnections[slugMatch.slug] = {
              slug: slugMatch.slug,
              revenue: 0,
              clicks: 0,
              rpc: 0,
              ads_count: 0,
              page_ids: new Set(),
              keywords: new Set()
            };
          }
          const conn = slugConnections[slugMatch.slug];
          conn.revenue = Math.max(conn.revenue, slugMatch.revenue); // Use max revenue per slug
          conn.clicks = Math.max(conn.clicks, slugMatch.clicks);
          conn.rpc = slugMatch.rpc;
          conn.ads_count += 1;
          conn.page_ids.add(ad.page_id);
          if (ad.extracted_keywords) {
            ad.extracted_keywords.forEach(k => conn.keywords.add(k));
          }
          if (ad.widget_phrases) {
            ad.widget_phrases.forEach(k => conn.keywords.add(k));
          }
        }
      }
    }
    
    const slugSummary = Object.values(slugConnections).map(conn => ({
      slug: conn.slug,
      revenue: conn.revenue,
      clicks: conn.clicks,
      rpc: conn.rpc,
      ads_count: conn.ads_count,
      page_ids: Array.from(conn.page_ids),
      keywords: Array.from(conn.keywords).slice(0, 10) // Top 10 keywords
    })).sort((a, b) => b.revenue - a.revenue);
    
    res.json({ 
      ok: true, 
      counts: Object.fromEntries(Object.entries(byCategory).map(([k,v]) => [k, v.length])), 
      ads,
      slug_connections: slugSummary.length > 0 ? slugSummary : undefined
    });
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

// CSV helpers (simple/robust)
function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
      continue;
    }
    if (c === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (inQ && content[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += '"'; }
      continue;
    }
    if ((c === '\n') && !inQ) {
      if (cur.length > 0) { records.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur.length > 0) records.push(cur);
  return records.filter(Boolean);
}


