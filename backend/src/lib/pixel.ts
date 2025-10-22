import axios from 'axios';

/**
 * Attempt to extract Facebook Pixel IDs from a landing page by inspecting HTML and inline scripts.
 * This uses static HTML heuristics and does not execute JavaScript.
 */
export async function extractFacebookPixelIdsFromUrl(url: string, timeoutMs = 15000): Promise<string[]> {
  if (!url) return [];
  try {
    const resp = await axios.get<string>(url, {
      maxRedirects: 5,
      timeout: timeoutMs,
      // We only need the raw text, allow 2xx/3xx responses
      validateStatus: (s) => s >= 200 && s < 400
    });
    const html = resp.data || '';
    return extractFacebookPixelIdsFromHtml(html);
  } catch {
    return [];
  }
}

/**
 * Extract Facebook Pixel IDs from raw HTML.
 * Heuristics cover several common integration patterns:
 *  - fbq('init', '123456789012345');
 *  - fbq('init', 123456789012345);
 *  - _fbp / fbp param usage with id=123456789012345
 *  - <script src=".../fbevents.js?id=123456789012345">
 */
export function extractFacebookPixelIdsFromHtml(html: string): string[] {
  if (!html) return [];
  const ids = new Set<string>();

  // Pattern: fbq('init', '123456789012345') or fbq("init", 123456789012345)
  const fbqInitRegex = /fbq\(\s*['\"]init['\"]\s*,\s*['\"]?(\d{5,20})['\"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = fbqInitRegex.exec(html)) !== null) {
    ids.add(m[1]);
  }

  // Pattern: fbevents.js?id=123456789012345
  const fbeventsSrcRegex = /fbevents\.js\?id=(\d{5,20})/gi;
  while ((m = fbeventsSrcRegex.exec(html)) !== null) {
    ids.add(m[1]);
  }

  // Pattern: data with pixelId: '123...' in common wrappers
  const pixelIdNamedRegex = /pixel[_-]?id['\"]?\s*[:=]\s*['\"](\d{5,20})['\"]/gi;
  while ((m = pixelIdNamedRegex.exec(html)) !== null) {
    ids.add(m[1]);
  }

  // Pattern: fbq('track', 'PageView', { external_id: '...' }) sometimes includes pixelId arrays
  const fbqConfigRegex = /fbq\([\s\S]*?\{[\s\S]*?id['\"]?\s*[:=]\s*['\"](\d{5,20})['\"]/gi;
  while ((m = fbqConfigRegex.exec(html)) !== null) {
    ids.add(m[1]);
  }

  return Array.from(ids);
}




