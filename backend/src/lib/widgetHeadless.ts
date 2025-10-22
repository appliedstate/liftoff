import { chromium, Browser, Frame, Page } from 'playwright';

export interface HeadlessWidgetOptions {
  timeoutMs?: number;
  userAgent?: string;
  appendFbclid?: boolean;
  fbclidValue?: string;
  waitAfterNavMs?: number;
  scrollBeforeExtract?: boolean;
  maxTextsPerFrame?: number;
}

export async function extractWidgetPhrasesHeadless(url: string, options: HeadlessWidgetOptions = {}): Promise<string[]> {
  if (!url) return [];
  const timeoutMs = options.timeoutMs ?? 25000;
  const userAgent = options.userAgent ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const appendFbclid = options.appendFbclid ?? false;
  const fbclidValue = options.fbclidValue ?? generateFbclid();
  const waitAfterNavMs = options.waitAfterNavMs ?? 2500;
  const scrollBeforeExtract = options.scrollBeforeExtract ?? true;
  const maxTextsPerFrame = options.maxTextsPerFrame ?? 200;

  let browser: Browser | undefined;
  const phrases = new Set<string>();
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent });
    const page: Page = await context.newPage();

    const targetUrl = appendFbclid ? appendQueryParam(url, 'fbclid', fbclidValue) : url;
    await page.goto(targetUrl, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(waitAfterNavMs);

    if (scrollBeforeExtract) {
      try {
        await page.evaluate(async () => {
          const w: any = globalThis as any;
          const d: any = (globalThis as any).document;
          const step = Math.max(200, Math.floor((w.innerHeight || 800) * 0.8));
          const total = (d && d.body && d.body.scrollHeight) ? d.body.scrollHeight : 2000;
          for (let y = 0; y < total; y += step) {
            if (w && typeof w.scrollTo === 'function') w.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 150));
          }
        });
      } catch {}
    }

    const frames: Frame[] = [page.mainFrame(), ...page.frames()];
    for (const frame of frames) {
      try {
        const texts = await collectVisibleLinkTexts(frame, maxTextsPerFrame);
        for (const t of texts) phrases.add(t);
      } catch {}
    }

    await context.close();
  } catch {
    // ignore
  } finally {
    if (browser) await browser.close();
  }
  return Array.from(phrases);
}

async function collectVisibleLinkTexts(frame: Frame, maxCount: number): Promise<string[]> {
  const out: string[] = [];
  const anchors = frame.locator('a:visible');
  const count = Math.min(await anchors.count(), maxCount);
  for (let i = 0; i < count; i++) {
    try {
      const txt = await anchors.nth(i).innerText({ timeout: 2000 });
      const clean = normalizeText(txt);
      if (clean.length >= 2 && clean.length <= 200) out.push(clean);
    } catch {}
  }
  // Some widgets render phrases as buttons/spans
  const others = frame.locator('button:visible, [role="button"]:visible, .keyword, .tag, .chip');
  const ocount = Math.min(await others.count(), Math.max(0, maxCount - out.length));
  for (let i = 0; i < ocount; i++) {
    try {
      const txt = await others.nth(i).innerText({ timeout: 2000 });
      const clean = normalizeText(txt);
      if (clean.length >= 2 && clean.length <= 200) out.push(clean);
    } catch {}
  }
  return Array.from(new Set(out));
}

function appendQueryParam(rawUrl: string, key: string, value: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set(key, value);
    return u.toString();
  } catch { return rawUrl; }
}

function generateFbclid(): string {
  const rand = Math.random().toString(36).slice(2);
  return `fbclid_${Date.now()}_${rand}`;
}

function normalizeText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}




