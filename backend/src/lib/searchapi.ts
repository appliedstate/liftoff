import axios from 'axios';

const SEARCH_API_BASE = 'https://www.searchapi.io/api/v1/search';

export interface MetaAdLibraryParams {
  engine?: 'meta_ad_library';
  q?: string;
  page_id?: string;
  location_id?: string;
  location_name?: string;
  location_type?: string;
  country?: string;
  content_languages?: string;
  ad_type?: 'all' | 'political_and_issue_ads' | 'housing_ads' | 'employment_ads' | 'credit_ads';
  active_status?: 'active' | 'inactive' | 'all';
  media_type?: 'all' | 'video' | 'image' | 'meme' | 'image_and_meme' | 'none';
  platforms?: string; // comma separated
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  next_page_token?: string;
}

export async function searchMetaAdLibrary(params: MetaAdLibraryParams) {
  const apiKey = process.env.SEARCHAPI_API_KEY;
  if (!apiKey) throw new Error('Missing SEARCHAPI_API_KEY');

  // Filter undefined/null params to avoid sending e.g. next_page_token=undefined
  const filtered: Record<string, string> = { engine: 'meta_ad_library' } as any;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== 'undefined') {
      filtered[k] = String(v);
    }
  }
  const query = new URLSearchParams(filtered);
  const url = `${SEARCH_API_BASE}?${query.toString()}`;

  // Simple retry with exponential backoff for 429/5xx
  const maxAttempts = 6;
  let attempt = 0;
  let lastErr: any;
  while (attempt < maxAttempts) {
    try {
      const resp = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 30000
      });
      return resp.data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        const retryAfter = Number(err?.response?.headers?.['retry-after']);
        const baseDelay = retryAfter && !isNaN(retryAfter) ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delayMs = Math.min(60000, baseDelay + jitter);
        await new Promise(r => setTimeout(r, delayMs));
        attempt++;
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('SearchApi request failed after retries');
}


