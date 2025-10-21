import { chromium, Browser, Page, Frame } from 'playwright';

export interface HeadlessPixelOptions {
  timeoutMs?: number;
  userAgent?: string;
  appendFbclid?: boolean;
  fbclidValue?: string;
  clicksEnabled?: boolean;
  maxClicks?: number;
  waitAfterNavMs?: number;
  waitBetweenClicksMs?: number;
  scrollBeforeClicks?: boolean;
}

/**
 * Use Playwright to navigate to a URL and capture Facebook Pixel IDs by inspecting
 * network requests (fbevents.js and /tr?id=…) and evaluating fbq('init', …) calls.
 */
export async function extractFacebookPixelIdsHeadless(url: string, options: HeadlessPixelOptions = {}): Promise<string[]> {
  if (!url) return [];
  const timeoutMs = options.timeoutMs ?? 25000;
  const userAgent = options.userAgent ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const appendFbclid = options.appendFbclid ?? false;
  const fbclidValue = options.fbclidValue ?? generateFbclid();
  const clicksEnabled = options.clicksEnabled ?? false;
  const maxClicks = options.maxClicks ?? 2;
  const waitAfterNavMs = options.waitAfterNavMs ?? 3000;
  const waitBetweenClicksMs = options.waitBetweenClicksMs ?? 1500;
  const scrollBeforeClicks = options.scrollBeforeClicks ?? true;

  let browser: Browser | undefined;
  const ids = new Set<string>();
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent });
    const page: Page = await context.newPage();

    // Capture pixel ids from network
    page.on('request', (req) => {
      try {
        const u = new URL(req.url());
        const isFb = /facebook\.(com|net)$/i.test(u.hostname) || u.hostname.includes('facebook');
        const looksLikePixel = u.pathname.includes('fbevents.js') || /\/tr\b/i.test(u.pathname) || /pixel/i.test(u.pathname);
        if (isFb && looksLikePixel) {
          let gotId = u.searchParams.get('id') || u.searchParams.get('pixel_id');
          if (!gotId) {
            for (const [k, v] of u.searchParams.entries()) {
              if (/id/i.test(k) && /^\d{5,20}$/.test(v)) { gotId = v; break; }
            }
          }
          if (gotId && /^\d{5,20}$/.test(gotId)) ids.add(gotId);
        }
      } catch {}
    });

    // Navigate and allow scripts to run
    const targetUrl = appendFbclid ? appendQueryParam(url, 'fbclid', fbclidValue) : url;
    await page.goto(targetUrl, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    // Some pixels load after DOMContentLoaded
    await page.waitForTimeout(waitAfterNavMs);

    // Try to read fbq init ids from window context
    try {
      const initIds = await page.evaluate(() => {
        const out = new Set<string>();
        const fbq = (globalThis as any).fbq;
        if (fbq && fbq.get && typeof fbq.get === 'function') {
          try {
            // @ts-ignore
            const cfg = fbq.get('config');
            if (cfg && typeof cfg === 'object') {
              for (const k of Object.keys(cfg)) {
                if (/^\d{5,20}$/.test(k)) out.add(k);
              }
            }
          } catch {}
        }
        return Array.from(out);
      });
      for (const id of initIds) ids.add(id);
    } catch {}

    // Optionally scroll before clicking to trigger lazy listeners
    if (scrollBeforeClicks) {
      try {
        await page.evaluate(async () => {
          const w: any = globalThis as any;
          const d: any = (globalThis as any).document;
          const step = Math.max(200, Math.floor((w.innerHeight || 800) * 0.8));
          const total = (d && d.body && d.body.scrollHeight) ? d.body.scrollHeight : 2000;
          for (let y = 0; y < total; y += step) {
            if (w && typeof w.scrollTo === 'function') w.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 200));
          }
        });
      } catch {}
    }

    if (clicksEnabled && maxClicks > 0) {
      let clicksDone = 0;
      // Attempt clicks in frames and main page to simulate user flow
      while (clicksDone < maxClicks) {
        const frames: Frame[] = [page.mainFrame(), ...page.frames()];
        let clicked = false;
        for (const frame of frames) {
          try {
            const success = await clickFirstRelevantLink(frame);
            if (success) { clicked = true; break; }
          } catch {}
        }
        if (!clicked) break;
        clicksDone++;
        await page.waitForTimeout(waitBetweenClicksMs);
      }
      // final wait for any pixel network after interactions
      await page.waitForTimeout(waitAfterNavMs);
    }

    await context.close();
  } catch {
    // ignore
  } finally {
    if (browser) await browser.close();
  }
  return Array.from(ids).sort();
}

function appendQueryParam(rawUrl: string, key: string, value: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set(key, value);
    return u.toString();
  } catch { return rawUrl; }
}

function generateFbclid(): string {
  // Not a real fbclid format, but unique enough to test conditional loads
  const rand = Math.random().toString(36).slice(2);
  return `fbclid_${Date.now()}_${rand}`;
}

async function clickFirstRelevantLink(frame: Frame): Promise<boolean> {
  // Prioritize links that navigate to http(s) and are visible
  const candidates = frame.locator('a[href]:visible');
  const count = await candidates.count();
  const tryCount = Math.min(count, 10);
  for (let i = 0; i < tryCount; i++) {
    const link = candidates.nth(i);
    try {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      await link.click({ timeout: 5000 });
      return true;
    } catch {}
  }
  // Try generic buttons
  const buttons = frame.locator('button:visible, [role="button"]:visible');
  const btnCount = await buttons.count();
  const btnTry = Math.min(btnCount, 5);
  for (let i = 0; i < btnTry; i++) {
    const btn = buttons.nth(i);
    try {
      await btn.click({ timeout: 5000 });
      return true;
    } catch {}
  }
  return false;
}


