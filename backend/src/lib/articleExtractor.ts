// @ts-nocheck
import { chromium, Browser, Page } from 'playwright';

export type ExtractedArticle = {
  url: string;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  author: string | null;
  publishDate: string | null;
  mainContent: string; // Full article text
  headings: string[]; // All H2, H3, etc.
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;
  wordCount: number;
  // Widget/ad detection
  widgetTexts: string[];
  adIndicators: string[];
  // Layout signals
  mainContentAboveFold: boolean;
  adDensity: 'low' | 'medium' | 'high';
};

/**
 * Extract full article content from a URL, similar to how Googlebot would see it.
 * Uses Playwright to render the page and extract structured content.
 */
export async function extractArticleFromUrl(
  url: string,
  options: { timeoutMs?: number; waitForContent?: boolean } = {}
): Promise<ExtractedArticle> {
  const timeoutMs = options.timeoutMs ?? 30000;
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page: Page = await context.newPage();

    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Let JS render

    // Scroll to trigger lazy-loaded content
    await page.evaluate(async () => {
      // @ts-ignore - DOM types available in browser context
      const step = 500;
      // @ts-ignore
      const total = document.body.scrollHeight || 2000;
      for (let y = 0; y < total; y += step) {
        // @ts-ignore
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
    });

    const extracted = await page.evaluate(() => {
      // @ts-ignore - This code runs in browser context, DOM types are available
      const doc: Document = document;
      // @ts-ignore
      const body = doc.body;

      // Extract title
      const title =
        doc.querySelector('title')?.textContent?.trim() ||
        doc.querySelector('h1')?.textContent?.trim() ||
        null;

      // Extract H1
      const h1 = doc.querySelector('h1')?.textContent?.trim() || null;

      // Extract meta description
      const metaDesc =
        doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
        doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
        null;

      // Extract author (common patterns)
      const authorSelectors = [
        '[rel="author"]',
        '.author',
        '[class*="author"]',
        '[class*="byline"]',
        'meta[name="author"]',
        'meta[property="article:author"]',
      ];
      let author: string | null = null;
      for (const sel of authorSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
          author =
            el.textContent?.trim() ||
            el.getAttribute('content')?.trim() ||
            null;
          if (author) break;
        }
      }

      // Extract publish date
      const dateSelectors = [
        'time[datetime]',
        'time',
        '[class*="date"]',
        '[class*="published"]',
        'meta[property="article:published_time"]',
      ];
      let publishDate: string | null = null;
      for (const sel of dateSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
          publishDate =
            el.getAttribute('datetime')?.trim() ||
            el.textContent?.trim() ||
            el.getAttribute('content')?.trim() ||
            null;
          if (publishDate) break;
        }
      }

      // Extract main content (try article tag, main tag, or largest content block)
      let mainContent = '';
      const articleEl =
        doc.querySelector('article') ||
        doc.querySelector('main') ||
        doc.querySelector('[role="main"]') ||
        body;

      // Get all text content, preserving some structure
      // Use a simpler approach that doesn't require NodeFilter
      const textNodes: string[] = [];
      const walk = (el: any) => {
        if (!el) return;
        const tagName = el.tagName?.toLowerCase();
        // Skip script, style, nav, footer, header, aside (likely ads/nav)
        if (['script', 'style', 'nav', 'footer', 'header', 'aside'].includes(tagName)) {
          return;
        }
        // Skip if has ad-like classes
        const className = el.className || '';
        if (/ad|advertisement|sponsor|promo|widget|sidebar/i.test(className)) {
          return;
        }
        // Get direct text content
        if (el.childNodes) {
          for (const node of el.childNodes) {
            if (node.nodeType === 3) { // TEXT_NODE
              const text = node.textContent?.trim();
              if (text && text.length > 10) {
                textNodes.push(text);
              }
            } else if (node.nodeType === 1) { // ELEMENT_NODE
              walk(node);
            }
          }
        }
      };
      walk(articleEl);

      mainContent = textNodes.join(' ');

      // Extract headings (H2-H6)
      const headings: string[] = [];
      for (let level = 2; level <= 6; level++) {
        const hTags = articleEl.querySelectorAll(`h${level}`);
        // @ts-ignore
        hTags.forEach((h: Element) => {
          const text = h.textContent?.trim();
          if (text) headings.push(text);
        });
      }

      // Extract links
      const links: Array<{ text: string; href: string }> = [];
      const linkEls = articleEl.querySelectorAll('a[href]');
      // @ts-ignore
      linkEls.forEach((a: Element) => {
        const text = a.textContent?.trim();
        const href = a.getAttribute('href') || '';
        if (text && href && !href.startsWith('#')) {
          links.push({ text, href });
        }
      });

      // Extract images
      const images: Array<{ alt: string; src: string }> = [];
      const imgEls = articleEl.querySelectorAll('img');
      // @ts-ignore
      imgEls.forEach((img: Element) => {
        const alt = img.getAttribute('alt') || '';
        const src = img.getAttribute('src') || '';
        if (src) images.push({ alt, src });
      });

      // Detect widgets/ads (common patterns)
      const widgetTexts: string[] = [];
      const adIndicators: string[] = [];
      const widgetSelectors = [
        '[class*="widget"]',
        '[class*="related"]',
        '[class*="sponsor"]',
        '[id*="widget"]',
        '[id*="ad"]',
      ];
      widgetSelectors.forEach((sel) => {
        const els = doc.querySelectorAll(sel);
        // @ts-ignore
        els.forEach((el: Element) => {
          const text = el.textContent?.trim();
          if (text && text.length > 5 && text.length < 200) {
            widgetTexts.push(text);
          }
          if (/ad|sponsor|promo/i.test(sel)) {
            adIndicators.push(text || '');
          }
        });
      });

      // Check if main content is above the fold
      const rect = articleEl.getBoundingClientRect();
      // @ts-ignore - window available in browser context
      const mainContentAboveFold = rect.top < window.innerHeight;

      // Estimate ad density (simple heuristic)
      const adLikeElements = doc.querySelectorAll(
        '[class*="ad"], [id*="ad"], [class*="sponsor"], iframe'
      );
      const adDensity =
        adLikeElements.length > 10
          ? 'high'
          : adLikeElements.length > 5
            ? 'medium'
            : 'low';

      const wordCount = mainContent.split(/\s+/).filter((w) => w.length > 0).length;

      return {
        title,
        h1,
        metaDescription: metaDesc,
        author,
        publishDate,
        mainContent,
        headings,
        links,
        images,
        wordCount,
        widgetTexts: Array.from(new Set(widgetTexts)).slice(0, 20), // Dedupe, limit
        adIndicators: Array.from(new Set(adIndicators)).filter(Boolean).slice(0, 10),
        mainContentAboveFold,
        adDensity,
      };
    });

    await context.close();

    return {
      url,
      ...extracted,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Convert extracted article to a comprehensive summary format for the evaluator.
 * This preserves the full article content while structuring it for LLM consumption.
 */
export function articleToEvaluationInput(article: ExtractedArticle, query: string): {
  pageSummary: string;
  widgetSummary: string;
  fullArticleText: string;
} {
  // Build comprehensive page summary
  const summaryParts: string[] = [];

  if (article.title) summaryParts.push(`Title: ${article.title}`);
  if (article.h1 && article.h1 !== article.title) summaryParts.push(`H1: ${article.h1}`);
  if (article.metaDescription) summaryParts.push(`Meta Description: ${article.metaDescription}`);

  if (article.author) summaryParts.push(`Author: ${article.author}`);
  if (article.publishDate) summaryParts.push(`Published: ${article.publishDate}`);

  if (article.headings.length > 0) {
    summaryParts.push(`Headings: ${article.headings.slice(0, 10).join('; ')}`);
  }

  summaryParts.push(`Word Count: ${article.wordCount}`);

  if (article.mainContentAboveFold) {
    summaryParts.push('Main content visible above the fold');
  } else {
    summaryParts.push('Main content below the fold');
  }

  summaryParts.push(`Ad density: ${article.adDensity}`);

  const pageSummary = summaryParts.join('. ') + '.';

  // Build widget summary
  const widgetParts: string[] = [];
  if (article.widgetTexts.length > 0) {
    widgetParts.push(`Widgets/Related sections: ${article.widgetTexts.slice(0, 5).join('; ')}`);
  }
  if (article.adIndicators.length > 0) {
    widgetParts.push(`Ad indicators: ${article.adIndicators.slice(0, 3).join('; ')}`);
  }
  const widgetSummary = widgetParts.join('. ') || 'No obvious widgets or ads detected.';

  // Full article text (truncated if too long for LLM context)
  // Most LLMs can handle ~8k-16k tokens, so we'll keep first ~6000 words
  const maxWords = 6000;
  const words = article.mainContent.split(/\s+/);
  const fullArticleText =
    words.length > maxWords
      ? words.slice(0, maxWords).join(' ') + ' [truncated]'
      : article.mainContent;

  return {
    pageSummary,
    widgetSummary,
    fullArticleText,
  };
}

