#!/usr/bin/env ts-node

/**
 * Click value distribution (from session-level get-session-rev feed).
 *
 * Answers: is payout reduction affecting "most clicks" (whole distribution shifts)
 * or "some clicks" (mixture: only a subset of clicks get low values)?
 *
 * We treat each get-session-rev row as a click event and define click_value_usd as:
 *   SUM(revenue_updates[].revenue)   (matured so far)
 *
 * We report distribution both:
 * - across ALL clicks (including value=0 for clicks with no positive updates yet)
 * - across UPDATED clicks only (value>0), which controls for maturity.
 *
 * Usage:
 *   npm run monitor:click-distribution -- --date=2026-01-14 --campaign-id=sifa4fk06ve --hours=4,5,6,7 --group=hour
 *   npm run monitor:click-distribution -- --date=2026-01-14 --site=trivia-library.com --group=campaign --hours=4,5,6,7 --min-clicks=200
 */

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from '../../lib/monitoringDb';

type GroupBy = 'hour' | 'campaign' | 'category' | 'site' | 'account';

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function toInt(value: string, def: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

function normalizeString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function sumRevenueUpdates(session: any): number {
  const updates = session?.revenue_updates;
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  let sum = 0;
  for (const u of updates) {
    const r = Number(u?.revenue ?? 0);
    if (Number.isFinite(r)) sum += r;
  }
  return sum;
}

function getHourUtcFromSession(session: any): number | null {
  const direct =
    session.click_hour ??
    session.clickHour ??
    session.hour ??
    session.hour_of_click ??
    session.hourOfClick ??
    session.clickHourUtc;
  if (direct !== undefined && direct !== null) {
    const n = Number(direct);
    if (Number.isFinite(n) && n >= 0 && n <= 27) return Math.floor(n);
  }
  const ts =
    normalizeString(session.click_time) ??
    normalizeString(session.clickTime) ??
    normalizeString(session.timestamp) ??
    normalizeString(session.ts);
  if (ts) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) return d.getUTCHours();
  }
  return null;
}

type CampaignMeta = {
  strategis_campaign_id: string | null;
  facebook_campaign_id: string | null;
  rsoc_site: string | null;
  s1_google_account: string | null;
  category: string | null;
};

async function loadCampaignIndexMap(date: string): Promise<Map<string, CampaignMeta>> {
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const rows = await allRows<any>(
      conn,
      `
      SELECT
        campaign_id AS strategis_campaign_id,
        facebook_campaign_id,
        rsoc_site,
        s1_google_account,
        category
      FROM campaign_index
      WHERE date = DATE ${sqlString(date)}
      `
    );
    const m = new Map<string, CampaignMeta>();
    for (const r of rows) {
      const meta: CampaignMeta = {
        strategis_campaign_id: normalizeString(r.strategis_campaign_id),
        facebook_campaign_id: normalizeString(r.facebook_campaign_id),
        rsoc_site: normalizeString(r.rsoc_site),
        s1_google_account: normalizeString(r.s1_google_account),
        category: normalizeString(r.category),
      };
      if (meta.strategis_campaign_id) m.set(meta.strategis_campaign_id, meta);
      if (meta.facebook_campaign_id) m.set(meta.facebook_campaign_id, meta);
    }
    return m;
  } finally {
    closeConnection(conn);
  }
}

function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function fmtMoney(n: number | null): string {
  if (n === null) return 'N/A';
  return `$${n.toFixed(4)}`;
}

type Bucket = {
  all: number[]; // includes zeros/negatives
  updated: number[]; // >0 only
};

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const groupBy = (getFlag('group', 'hour') as GroupBy) || 'hour';
  const hoursCsv = getFlag('hours', '');
  const minClicks = toInt(getFlag('min-clicks', '50'), 50);

  const siteFilter = getFlag('site', '') || '';
  const categoryFilter = getFlag('category', '') || '';
  const campaignFilter = getFlag('campaign-id', '') || '';
  const accountFilter = getFlag('account', '') || '';

  const hours = hoursCsv
    ? hoursCsv
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 27)
        .map((n) => Math.floor(n))
    : null;

  console.log(`\n# Click value distribution`);
  console.log(`Date (UTC): ${date}`);
  console.log(`Group: ${groupBy}`);
  if (hours) console.log(`Hours: ${hours.join(', ')}`);
  if (siteFilter) console.log(`Site filter: ${siteFilter}`);
  if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
  if (campaignFilter) console.log(`Campaign filter: ${campaignFilter}`);
  if (accountFilter) console.log(`Account filter: ${accountFilter}`);
  console.log(`Min clicks (per group): ${minClicks}\n`);

  const api = new StrategisApi();
  const [sessions, ciMap] = await Promise.all([
    api.fetchS1SessionRevenue(date, false),
    loadCampaignIndexMap(date),
  ]);
  console.log(`Fetched ${sessions.length} click/session rows\n`);

  const buckets = new Map<string, Bucket>();
  const ensure = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, { all: [], updated: [] });
    return buckets.get(key)!;
  };

  for (const s of sessions) {
    const hour = getHourUtcFromSession(s);
    if (hour === null) continue;
    if (hours && !hours.includes(hour)) continue;

    const campaignKey =
      normalizeString(s.strategisCampaignId) ??
      normalizeString(s.strategiscampaignid) ??
      normalizeString(s.strategis_campaign_id) ??
      normalizeString(s.campaign_id) ??
      normalizeString(s.campaignId);
    const meta = campaignKey ? ciMap.get(campaignKey) : undefined;

    const site = meta?.rsoc_site || null;
    const category = meta?.category || null;
    const account = meta?.s1_google_account || null;
    const campaign = meta?.strategis_campaign_id || campaignKey || null;

    if (siteFilter && site !== siteFilter) continue;
    if (categoryFilter && category !== categoryFilter) continue;
    if (accountFilter && account !== accountFilter) continue;
    if (campaignFilter && campaign !== campaignFilter) continue;

    let key = 'ALL';
    switch (groupBy) {
      case 'hour':
        key = `hour=${hour}`;
        break;
      case 'campaign':
        key = campaign ? `campaign=${campaign}` : 'campaign=UNKNOWN';
        break;
      case 'category':
        key = category ? `category=${category}` : 'category=UNKNOWN';
        break;
      case 'site':
        key = site ? `site=${site}` : 'site=UNKNOWN';
        break;
      case 'account':
        key = account ? `account=${account}` : 'account=UNKNOWN';
        break;
    }

    const value = sumRevenueUpdates(s);
    const b = ensure(key);
    b.all.push(value);
    if (value > 0) b.updated.push(value);
  }

  const rows: Array<{
    group: string;
    clicks: number;
    updated_clicks: number;
    pct_updated: number;
    all_p10: number | null;
    all_p50: number | null;
    all_p90: number | null;
    all_p99: number | null;
    all_max: number | null;
    upd_p10: number | null;
    upd_p50: number | null;
    upd_p90: number | null;
    upd_p99: number | null;
    upd_max: number | null;
  }> = [];

  for (const [group, b] of buckets.entries()) {
    if (b.all.length < minClicks) continue;
    const allSorted = [...b.all].sort((a, b) => a - b);
    const updSorted = [...b.updated].sort((a, b) => a - b);
    rows.push({
      group,
      clicks: b.all.length,
      updated_clicks: b.updated.length,
      pct_updated: b.all.length > 0 ? (b.updated.length / b.all.length) * 100 : 0,
      all_p10: quantile(allSorted, 0.1),
      all_p50: quantile(allSorted, 0.5),
      all_p90: quantile(allSorted, 0.9),
      all_p99: quantile(allSorted, 0.99),
      all_max: allSorted.length ? allSorted[allSorted.length - 1] : null,
      upd_p10: quantile(updSorted, 0.1),
      upd_p50: quantile(updSorted, 0.5),
      upd_p90: quantile(updSorted, 0.9),
      upd_p99: quantile(updSorted, 0.99),
      upd_max: updSorted.length ? updSorted[updSorted.length - 1] : null,
    });
  }

  rows.sort((a, b) => b.clicks - a.clicks);

  if (rows.length === 0) {
    console.log('No groups met min-clicks threshold.');
    return;
  }

  console.log('| group | clicks | updated | %updated | all p10 | all p50 | all p90 | all p99 | all max | updated p10 | updated p50 | updated p90 | updated p99 | updated max |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows.slice(0, 50)) {
    console.log(
      `| ${r.group} | ${r.clicks} | ${r.updated_clicks} | ${r.pct_updated.toFixed(1)}% | ${fmtMoney(r.all_p10)} | ${fmtMoney(r.all_p50)} | ${fmtMoney(r.all_p90)} | ${fmtMoney(r.all_p99)} | ${fmtMoney(r.all_max)} | ${fmtMoney(r.upd_p10)} | ${fmtMoney(r.upd_p50)} | ${fmtMoney(r.upd_p90)} | ${fmtMoney(r.upd_p99)} | ${fmtMoney(r.upd_max)} |`
    );
  }
  console.log('');
  console.log('Interpretation:');
  console.log('- If updated p10/p50/p90 all drop together vs baseline/control → broad “everyone” price cliff.');
  console.log('- If only updated p10 drops (p90 stable) → mixture: some clicks discounted, others not.');
  console.log('- Compare “updated” percentiles for best maturity control.');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err?.message || err);
  process.exit(1);
});

