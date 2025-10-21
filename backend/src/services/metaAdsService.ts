import { searchMetaAdLibrary, MetaAdLibraryParams } from '../lib/searchapi';
import { normalizeCategories, inferCategoriesFromText } from '../lib/categoryMap';
import { extractHook } from '../lib/hook';
import { extractKeywordsFromUrl, loadUrlMapping } from '../lib/urlMapping';
import { extractForcekeys, ForcekeyEntry } from '../lib/forcekeys';
import { resolveFinalUrl } from '../lib/urlResolve';

export interface AnalyzePagesInput {
  pageIds: string[];
  country?: string;
  start_date?: string;
  end_date?: string;
  platforms?: string;
  active_status?: 'active' | 'inactive' | 'all';
}

export interface AdRecord {
  ad_archive_id: string;
  page_id: string;
  page_name?: string;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
  publisher_platform?: string[];
  total_active_time?: number;
  categories?: string[];
  link_url?: string;
  media_type?: 'image' | 'video' | 'mixed' | 'unknown';
  hook?: string;
  ad_copy?: string;
  extracted_keywords?: string[];
  forcekeys?: ForcekeyEntry[];
  extracted_param_keys?: string[];
}

export async function fetchAdsForPages(input: AnalyzePagesInput): Promise<AdRecord[]> {
  const {
    pageIds,
    country,
    start_date,
    end_date,
    platforms = 'facebook,instagram',
    active_status = 'active'
  } = input;

  const allAds: AdRecord[] = [];

  for (const page_id of pageIds) {
    let next_page_token: string | undefined = undefined;
    do {
      const params: MetaAdLibraryParams = {
        page_id,
        country,
        start_date,
        end_date,
        platforms,
        active_status,
        next_page_token
      } as any;
      const data = await searchMetaAdLibrary(params);
      const ads = (data?.ads || []) as any[];
      for (const ad of ads) {
        const snapshot = ad.snapshot || {};
        const bodyText: string = snapshot?.body?.text || '';
        const caption: string = snapshot?.caption || '';
        const title: string = snapshot?.title || '';
        const cards: any[] = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
        const cardBodies = cards.map(c => c?.body || '').filter(Boolean).join(' \n ');
        const textBlob = [title, bodyText, caption, cardBodies].filter(Boolean).join(' \n ');
        const hook = extractHook({ title, body: bodyText, caption, cardsText: cardBodies });

        // Determine media type heuristically
        const snapStr = JSON.stringify(snapshot).toLowerCase();
        const hasVideo = snapStr.includes('video') || /display_format\"\s*:\s*\".*video/.test(snapStr);
        const hasImage = snapStr.includes('original_image_url') || snapStr.includes('resized_image_url');
        let media_type: 'image' | 'video' | 'mixed' | 'unknown' = 'unknown';
        if (hasVideo && hasImage) media_type = 'mixed';
        else if (hasVideo) media_type = 'video';
        else if (hasImage) media_type = 'image';

        // Categories: normalize; if UNKNOWN then infer from text
        let finalCategories = normalizeCategories(ad.categories);
        if (finalCategories.length === 1 && finalCategories[0] === 'UNKNOWN' && textBlob) {
          finalCategories = normalizeCategories(inferCategoriesFromText(textBlob));
        }

        const mapping = loadUrlMapping();
        const rawLink = ad.snapshot?.link_url || (Array.isArray(snapshot?.cards) && snapshot.cards[0]?.link_url) || ad.link_url;
        const finalLink = rawLink ? await resolveFinalUrl(rawLink) : rawLink;
        const extracted_keywords = extractKeywordsFromUrl(finalLink, (ad.page_id || ad.snapshot?.page_id), mapping);
        const forcekeys = extractForcekeys(finalLink);
        let extracted_param_keys: string[] = [];
        try {
          if (finalLink) {
            const u = new URL(finalLink);
            extracted_param_keys = Array.from(new Set(Array.from(u.searchParams.keys()))).sort();
          }
        } catch {}

        allAds.push({
          ad_archive_id: ad.ad_archive_id,
          page_id: ad.page_id || ad.snapshot?.page_id,
          page_name: ad.page_name || ad.snapshot?.page_name,
          is_active: ad.is_active,
          start_date: ad.start_date,
          end_date: ad.end_date,
          publisher_platform: ad.publisher_platform,
          total_active_time: ad.total_active_time,
          categories: finalCategories,
          link_url: finalLink || rawLink,
          media_type,
          hook,
          ad_copy: textBlob,
          extracted_keywords,
          forcekeys,
          extracted_param_keys
        });
      }
      next_page_token = data?.pagination?.next_page_token;
    } while (next_page_token);
  }

  // Deduplicate by ad_archive_id
  const dedup = new Map<string, AdRecord>();
  for (const ad of allAds) {
    if (!dedup.has(ad.ad_archive_id)) dedup.set(ad.ad_archive_id, ad);
  }

  return Array.from(dedup.values());
}

export function groupAdsByCategory(ads: AdRecord[]): Record<string, AdRecord[]> {
  const groups: Record<string, AdRecord[]> = {};
  for (const ad of ads) {
    const cats = ad.categories && ad.categories.length > 0 ? ad.categories : ['UNKNOWN'];
    for (const c of cats) {
      if (!groups[c]) groups[c] = [];
      groups[c].push(ad);
    }
  }
  return groups;
}


