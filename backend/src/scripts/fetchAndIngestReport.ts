import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { chromium, Browser, BrowserContext, Page, Download, Response } from 'playwright';
import axios from 'axios';

dotenv.config();
if (!process.env.STRATEGIST_INGEST_TOKEN || !process.env.BACKEND_URL) {
  // Try loading repo-root .env for local runs
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}

type EnvConfig = {
  backendUrl: string;
  ingestToken: string;
  storageKey?: string;
  reportUrl: string;
  reportUrlTemplate?: string;
  loginUrl?: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  exportClickSelector?: string;
  csvUrlRegex?: string;
  tableSelector?: string;
  tableHeaderSelector?: string;
  reportTz: string;
  startOffsetDays: number;
  endOffsetDays: number;
  dateFormat: string;
  clickSelectors: string[];
  waitForText?: string;
  snapshotDir?: string;
  snapshotNameTemplate?: string;
  scrollContainerSelector?: string;
  scrollSeconds: number;
  cookiesPath?: string;
  storageStatePath?: string;
  headless: boolean;
  timeoutMs: number;
  exportWaitMs: number;
};

function readEnv(): EnvConfig {
  const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
  const ingestToken = process.env.STRATEGIST_INGEST_TOKEN || '';
  const storageKey = process.env.STRATEGIST_STORAGE_KEY || '';
  const reportUrl = process.env.REPORT_URL || '';
  const reportUrlTemplate = process.env.REPORT_URL_TEMPLATE || '';
  const loginUrl = process.env.LOGIN_URL || '';
  const username = process.env.REPORT_USERNAME || '';
  const password = process.env.REPORT_PASSWORD || '';
  const usernameSelector = process.env.USERNAME_SELECTOR || '';
  const passwordSelector = process.env.PASSWORD_SELECTOR || '';
  const submitSelector = process.env.SUBMIT_SELECTOR || '';
  const exportClickSelector = process.env.REPORT_EXPORT_CLICK_SELECTOR || '';
  const csvUrlRegex = process.env.CSV_RESPONSE_URL_REGEX || '';
  const tableSelector = process.env.TABLE_SELECTOR || '';
  const tableHeaderSelector = process.env.TABLE_HEADER_SELECTOR || '';
  const reportTz = process.env.REPORT_TZ || 'America/Chicago';
  const startOffsetDays = parseInt(process.env.START_OFFSET_DAYS || '1', 10);
  const endOffsetDays = parseInt(process.env.END_OFFSET_DAYS || '1', 10);
  const dateFormat = process.env.DATE_FORMAT || 'yyyy-MM-dd';
  const clickSelectors = (process.env.REPORT_CLICK_SELECTORS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const waitForText = process.env.REPORT_WAIT_FOR_TEXT || '';
  const snapshotDir = process.env.SNAPSHOT_DIR || 'runs/strategist_csv';
  const snapshotNameTemplate = process.env.SNAPSHOT_NAME_TEMPLATE || 'strategis_{start}_{end}.csv';
  const scrollContainerSelector = process.env.TABLE_SCROLL_CONTAINER_SELECTOR || '';
  const scrollSeconds = parseInt(process.env.TABLE_SCROLL_SECONDS || '0', 10);
  const cookiesPath = process.env.COOKIES_PATH || '';
  const storageStatePath = process.env.STORAGE_STATE_PATH || '';
  const headless = (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false';
  const timeoutMs = parseInt(process.env.TIMEOUT_MS || '60000', 10);
  const exportWaitMs = parseInt(process.env.REPORT_EXPORT_WAIT_MS || '15000', 10);

  if (!reportUrl && !reportUrlTemplate) throw new Error('Missing REPORT_URL or REPORT_URL_TEMPLATE');
  if (!ingestToken) throw new Error('Missing STRATEGIST_INGEST_TOKEN');

  return {
    backendUrl,
    ingestToken,
    storageKey: storageKey || undefined,
    reportUrl,
    reportUrlTemplate: reportUrlTemplate || undefined,
    loginUrl: loginUrl || undefined,
    username: username || undefined,
    password: password || undefined,
    usernameSelector: usernameSelector || undefined,
    passwordSelector: passwordSelector || undefined,
    submitSelector: submitSelector || undefined,
    exportClickSelector: exportClickSelector || undefined,
    csvUrlRegex: csvUrlRegex || undefined,
    tableSelector: tableSelector || undefined,
    tableHeaderSelector: tableHeaderSelector || undefined,
    reportTz,
    startOffsetDays,
    endOffsetDays,
    dateFormat,
    clickSelectors,
    waitForText: waitForText || undefined,
    snapshotDir,
    snapshotNameTemplate,
    scrollContainerSelector: scrollContainerSelector || undefined,
    scrollSeconds,
    cookiesPath: cookiesPath || undefined,
    storageStatePath: storageStatePath || undefined,
    headless,
    timeoutMs,
    exportWaitMs,
  };
}

async function loadCookiesIfProvided(context: BrowserContext, cookiesPath?: string) {
  if (!cookiesPath) return;
  try {
    const text = await fs.readFile(cookiesPath, 'utf8');
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      await context.addCookies(data);
    } else if (data.cookies && Array.isArray(data.cookies)) {
      await context.addCookies(data.cookies);
    }
  } catch (e) {
    // ignore if missing or invalid
  }
}

function responseLooksLikeCsv(resp: Response, urlRegex?: string): boolean {
  const ct = resp.headers()['content-type'] || '';
  const dispo = resp.headers()['content-disposition'] || '';
  const url = resp.url();
  const byType = /text\/csv|application\/vnd\.ms-excel|octet-stream/i.test(ct) || /\.csv(\?|$)/i.test(url) || /\.csv/i.test(dispo);
  const byUrl = urlRegex ? new RegExp(urlRegex).test(url) : false;
  return byType || byUrl;
}

async function captureCsvFromResponses(page: Page, urlRegex?: string, timeoutMs = 15000): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const onResponse = async (resp: Response) => {
      try {
        if (responseLooksLikeCsv(resp, urlRegex)) {
          // eslint-disable-next-line no-console
          console.log('Detected CSV response:', resp.url());
          const text = await resp.text();
          if (!resolved) {
            resolved = true;
            page.off('response', onResponse);
            resolve(text);
          }
        }
      } catch (_) {}
    };
    page.on('response', onResponse);
    setTimeout(() => {
      if (!resolved) {
        page.off('response', onResponse);
        resolve(null);
      }
    }, timeoutMs);
  });
}

async function captureCsvFromDownload(page: Page, trigger: () => Promise<void>, timeoutMs = 15000): Promise<string | null> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: timeoutMs }).catch(() => null),
    trigger(),
  ]);
  if (!download) return null;
  const tmpPath = await download.path();
  if (!tmpPath) return null;
  try {
    const buf = await fs.readFile(tmpPath);
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

async function robustClickExport(page: Page, primarySelector?: string) {
  const candidates = [
    ...(primarySelector ? [primarySelector] : []),
    'button:has-text("Export CSV")',
    'text=Export CSV',
    'role=button[name="Export CSV"]',
  ];
  for (const sel of candidates) {
    try {
      const locator = page.locator(sel);
      await locator.first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      await locator.first().click({ timeout: 3000 });
      await page.waitForTimeout(500);
      // second click sometimes required to confirm/export
      await locator.first().click({ timeout: 1500 }).catch(() => {});
      return;
    } catch {
      // try next candidate
    }
  }
  // Final attempt: generic text
  await page.click('text=Export', { timeout: 1500 }).catch(() => {});
}

function pad(n: number): string { return n < 10 ? '0' + n : String(n); }
function formatDateInTz(d: Date, tz: string, fmt: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d).reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {} as any);
  const yyyy = parts.year;
  const MM = parts.month;
  const dd = parts.day;
  const HH = parts.hour;
  const mm = parts.minute;
  const ss = parts.second;
  return fmt
    .replace(/yyyy/g, yyyy)
    .replace(/MM/g, MM)
    .replace(/dd/g, dd)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss);
}

function buildReportUrl(cfg: EnvConfig): string {
  if (!cfg.reportUrlTemplate) return cfg.reportUrl;
  const now = new Date();
  const start = new Date(now.getTime() - cfg.startOffsetDays * 24 * 3600 * 1000);
  const end = new Date(now.getTime() - cfg.endOffsetDays * 24 * 3600 * 1000);
  const startStr = formatDateInTz(start, cfg.reportTz, cfg.dateFormat);
  const endStr = formatDateInTz(end, cfg.reportTz, cfg.dateFormat);
  let url = cfg.reportUrlTemplate;
  url = url.replace(/\{start_date\}/g, encodeURIComponent(startStr));
  url = url.replace(/\{end_date\}/g, encodeURIComponent(endStr));
  url = url.replace(/\{date\}/g, encodeURIComponent(endStr));
  return url;
}

async function scrapeTableAsCsv(page: Page, tableSelector: string, headerSelector?: string): Promise<string | null> {
  try {
    const csv = await page.evaluate(({ tableSelector, headerSelector }) => {
      function escapeCsv(val: any): string {
        const s = val == null ? '' : String(val);
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }
      const doc: any = (globalThis as any).document;
      const table: any = doc?.querySelector?.(tableSelector) || null;
      if (!table) return null as any;
      const rows: string[] = [];
      let headers: string[] | null = null;
      if (headerSelector) {
        const headerEl: any = table.querySelector(headerSelector) || null;
        if (headerEl) headers = Array.from(headerEl.querySelectorAll('th,td') as any).map((c: any) => ((c.textContent || '') as string).trim());
      }
      if (!headers) {
        const thead: any = table.querySelector('thead');
        const firstRow: any = (thead && thead.querySelector('tr')) || table.querySelector('tr');
        if (firstRow) headers = Array.from(firstRow.querySelectorAll('th,td') as any).map((c: any) => ((c.textContent || '') as string).trim());
      }
      if (headers && headers.length) rows.push(headers.map(escapeCsv).join(','));
      const bodyRows: any = table.querySelectorAll('tbody tr');
      const dataRows: any[] = (bodyRows && bodyRows.length) ? Array.from(bodyRows as any) : Array.from(table.querySelectorAll('tr') as any).slice(1);
      for (const tr of dataRows) {
        const cols = Array.from(tr.querySelectorAll('td,th') as any).map((c: any) => ((c.textContent || '') as string).trim());
        if (cols.length) rows.push(cols.map(escapeCsv).join(','));
      }
      return rows.join('\n');
    }, { tableSelector, headerSelector });
    return csv;
  } catch {
    return null;
  }
}

async function scrapeLargestTableAsCsv(page: Page): Promise<string | null> {
  try {
    const csv = await page.evaluate(() => {
      function escapeCsv(val: any): string {
        const s = val == null ? '' : String(val);
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }
      const doc: any = (globalThis as any).document;
      const tables: any[] = Array.from(doc.querySelectorAll('table'));
      if (!tables.length) return null as any;
      // pick table with most rows
      let best: any = tables[0];
      let bestRows = 0;
      for (const t of tables) {
        const count = (t.querySelectorAll('tr') || []).length;
        if (count > bestRows) { bestRows = count; best = t; }
      }
      const rows: string[] = [];
      // header
      const headerRow: any = best.querySelector('thead tr') || best.querySelector('tr');
      if (!headerRow) return null as any;
      const headers = Array.from(headerRow.querySelectorAll('th,td') as any).map((c: any) => ((c.textContent || '') as string).trim());
      rows.push(headers.map(escapeCsv).join(','));
      // body rows
      const trList: any[] = Array.from(best.querySelectorAll('tbody tr') as any);
      const dataRows: any[] = trList.length ? trList : Array.from(best.querySelectorAll('tr') as any).slice(1);
      for (const tr of dataRows) {
        const cols = Array.from(tr.querySelectorAll('td,th') as any).map((c: any) => ((c.textContent || '') as string).trim());
        if (cols.length) rows.push(cols.map(escapeCsv).join(','));
      }
      return rows.join('\n');
    });
    return csv;
  } catch {
    return null;
  }
}

async function autoScroll(page: Page, containerSelector?: string, seconds = 0) {
  if (!seconds || seconds <= 0) return;
  const endTime = Date.now() + seconds * 1000;
  while (Date.now() < endTime) {
    try {
      if (containerSelector) {
        await page.evaluate((sel) => {
          const doc: any = (globalThis as any).document;
          const el: any = doc?.querySelector?.(sel as any);
          if (el) el.scrollTop = (el.scrollTop || 0) + 2000;
        }, containerSelector as any);
      } else {
        await page.mouse.wheel(0, 2000);
      }
    } catch {}
    await page.waitForTimeout(500);
  }
}

async function maybeLogin(page: Page, cfg: EnvConfig) {
  if (!cfg.loginUrl || !cfg.username || !cfg.password || !cfg.usernameSelector || !cfg.passwordSelector) return;
  await page.goto(cfg.loginUrl, { waitUntil: 'networkidle' });
  await page.fill(cfg.usernameSelector, cfg.username);
  await page.fill(cfg.passwordSelector, cfg.password);
  if (cfg.submitSelector) {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click(cfg.submitSelector),
    ]);
  } else {
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
  }
}

async function run() {
  const cfg = readEnv();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch({ headless: cfg.headless });
    if (cfg.storageStatePath) {
      context = await browser.newContext({ acceptDownloads: true, storageState: cfg.storageStatePath });
    } else {
      context = await browser.newContext({ acceptDownloads: true });
      await loadCookiesIfProvided(context, cfg.cookiesPath);
    }
    const page = await context.newPage();

    await maybeLogin(page, cfg);
    const targetUrl = buildReportUrl(cfg);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: cfg.timeoutMs });

    // Optional scripted clicks to ensure the right pills/toggles are active (e.g., DAY, RECONCILED, UPDATE)
    for (const sel of cfg.clickSelectors) {
      try {
        await page.click(sel, { timeout: Math.min(5000, cfg.timeoutMs) });
        await page.waitForLoadState('networkidle', { timeout: Math.min(8000, cfg.timeoutMs) });
      } catch {
        // ignore if not found
      }
    }
    if (cfg.waitForText) {
      try {
        await page.waitForSelector(`text=${cfg.waitForText}`, { timeout: Math.min(10000, cfg.timeoutMs) });
      } catch {}
    }

    let csvText: string | null = null;
    const nowIso = new Date().toISOString().replace(/[:.]/g, '-');
    const nowDay = formatDateInTz(new Date(), cfg.reportTz, cfg.dateFormat);

    if (cfg.exportClickSelector) {
      const responsePromise = captureCsvFromResponses(page, cfg.csvUrlRegex, cfg.exportWaitMs);
      const downloadPromise = captureCsvFromDownload(page, async () => {
        await robustClickExport(page, cfg.exportClickSelector!);
      }, cfg.exportWaitMs);
      const [respCsv, dlCsv] = await Promise.all([responsePromise, downloadPromise]);
      csvText = respCsv || dlCsv;
    } else if (cfg.csvUrlRegex) {
      csvText = await captureCsvFromResponses(page, cfg.csvUrlRegex, cfg.exportWaitMs);
    }

    // Fallback: scrape table as CSV if no network/download CSV detected
    if (!csvText) {
      // Attempt scrolling to load more rows if virtualized
      await autoScroll(page, cfg.scrollContainerSelector, cfg.scrollSeconds);
      if (cfg.tableSelector) {
        csvText = await scrapeTableAsCsv(page, cfg.tableSelector, cfg.tableHeaderSelector);
      }
      // If still too small, try picking the largest table automatically
      if (csvText) {
        const lines = csvText.split('\n').filter(Boolean);
        if (lines.length <= 2) {
          const alt = await scrapeLargestTableAsCsv(page);
          if (alt) csvText = alt;
        }
      } else {
        const alt = await scrapeLargestTableAsCsv(page);
        if (alt) csvText = alt;
      }
    }

    if (!csvText) {
      throw new Error('Failed to capture CSV. Provide REPORT_EXPORT_CLICK_SELECTOR or CSV_RESPONSE_URL_REGEX.');
    }

    // Save snapshot
    try {
      const start = formatDateInTz(new Date(Date.now() - cfg.startOffsetDays * 86400000), cfg.reportTz, cfg.dateFormat);
      const end = formatDateInTz(new Date(Date.now() - cfg.endOffsetDays * 86400000), cfg.reportTz, cfg.dateFormat);
      const relName = (cfg.snapshotNameTemplate || 'strategis_{start}_{end}_{now}.csv')
        .replace(/\{start\}/g, start)
        .replace(/\{end\}/g, end)
        .replace(/\{now\}/g, nowIso)
        .replace(/\{day\}/g, nowDay);
      const dir = path.resolve(process.cwd(), cfg.snapshotDir || 'runs/strategist_csv');
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, relName);
      await fs.writeFile(filePath, csvText, 'utf-8');
      // eslint-disable-next-line no-console
      console.log('Saved snapshot:', filePath);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Snapshot save failed:', e);
    }

    const ingestUrl = `${cfg.backendUrl}/api/strategist/ingest`;
    const payload: any = { csv: csvText };
    if (cfg.storageKey) payload.key = cfg.storageKey;
    const resp = await axios.post(ingestUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-strategist-token': cfg.ingestToken,
      },
      timeout: cfg.timeoutMs,
    });

    // eslint-disable-next-line no-console
    console.log('Ingested rows:', resp.data?.stored, 'key:', resp.data?.key);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});




