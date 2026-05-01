#!/usr/bin/env ts-node

/**
 * Detect "discounting"/downward adjustments in session-level revenue updates.
 *
 * We interpret "discounting" as any evidence that later updates reduce value for a click:
 * - A revenue_updates entry with negative revenue (most direct signal).
 * - OR, if the update objects include a cumulative/total field, a later total < earlier total.
 *
 * Usage:
 *   npm run monitor:session-discounting -- --date=2026-01-14
 *   npm run monitor:session-discounting -- --date=2026-01-14 --site=trivia-library.com
 *   npm run monitor:session-discounting -- --date=2026-01-14 --site=secretprice.com --group=category --min-clicks=50
 *
 * Notes:
 * - Data source is Strategis staging endpoint: /api/s1/report/get-session-rev (see StrategisApi.fetchS1SessionRevenue).
 * - We treat each session row as a "click" for counting purposes (consistent with get-session-rev semantics).
 */

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from '../../lib/monitoringDb';

type GroupBy = 'site' | 'category' | 'campaign' | 'account';

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

type CampaignMeta = {
  strategis_campaign_id: string | null;
  facebook_campaign_id: string | null;
  rsoc_site: string | null;
  s1_google_account: string | null;
  category: string | null;
  owner: string | null;
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
        category,
        owner
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
        owner: normalizeString(r.owner),
      };
      if (meta.strategis_campaign_id) m.set(meta.strategis_campaign_id, meta);
      if (meta.facebook_campaign_id) m.set(meta.facebook_campaign_id, meta);
    }
    return m;
  } finally {
    closeConnection(conn);
  }
}

function asNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getUpdateHour(update: any): number | null {
  const h =
    update?.click_hour ??
    update?.clickHour ??
    update?.hour ??
    update?.hour_utc ??
    update?.hourUtc;
  const n = asNumber(h);
  if (n === null) return null;
  if (n < 0 || n > 27) return null;
  return Math.floor(n);
}

function getUpdateRevenue(update: any): number | null {
  const n = asNumber(update?.revenue);
  return n;
}

function getUpdateCumulative(update: any): number | null {
  // Try common names for a "running total" if present.
  const candidates = [
    update?.total_revenue,
    update?.totalRevenue,
    update?.cumulative_revenue,
    update?.cumulativeRevenue,
    update?.running_total,
    update?.runningTotal,
  ];
  for (const c of candidates) {
    const n = asNumber(c);
    if (n !== null) return n;
  }
  return null;
}

type DiscountSignals = {
  hasUpdates: boolean;
  hasPositive: boolean;
  hasNegativeRevenueUpdate: boolean;
  hasCumulativeField: boolean;
  hasCumulativeDecrease: boolean;
};

function detectDiscountingSignals(session: any): DiscountSignals {
  const updates = session?.revenue_updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return {
      hasUpdates: false,
      hasPositive: false,
      hasNegativeRevenueUpdate: false,
      hasCumulativeField: false,
      hasCumulativeDecrease: false,
    };
  }

  let hasPositive = false;
  let hasNegative = false;

  const enriched = updates
    .map((u: any) => ({
      hour: getUpdateHour(u),
      revenue: getUpdateRevenue(u),
      cumulative: getUpdateCumulative(u),
      raw: u,
    }))
    .filter((u: any) => u.revenue !== null || u.cumulative !== null);

  for (const u of enriched) {
    const r = u.revenue;
    if (r !== null) {
      if (r > 0) hasPositive = true;
      if (r < 0) hasNegative = true;
    }
  }

  const hasCumulativeField = enriched.some((u: any) => u.cumulative !== null);
  let hasCumulativeDecrease = false;
  if (hasCumulativeField) {
    // Sort by hour if available; otherwise preserve order.
    const sorted = [...enriched].sort((a: any, b: any) => {
      if (a.hour === null && b.hour === null) return 0;
      if (a.hour === null) return 1;
      if (b.hour === null) return -1;
      return a.hour - b.hour;
    });
    let last: number | null = null;
    for (const u of sorted) {
      if (u.cumulative === null) continue;
      if (last !== null && u.cumulative < last - 1e-9) {
        hasCumulativeDecrease = true;
        break;
      }
      last = u.cumulative;
    }
  }

  return {
    hasUpdates: true,
    hasPositive,
    hasNegativeRevenueUpdate: hasNegative,
    hasCumulativeField,
    hasCumulativeDecrease,
  };
}

type Counters = {
  clicks: number;
  clicksWithUpdates: number;
  clicksWithPositiveUpdates: number;
  clicksWithNegativeUpdate: number;
  clicksWithCumulativeField: number;
  clicksWithCumulativeDecrease: number;
};

function newCounters(): Counters {
  return {
    clicks: 0,
    clicksWithUpdates: 0,
    clicksWithPositiveUpdates: 0,
    clicksWithNegativeUpdate: 0,
    clicksWithCumulativeField: 0,
    clicksWithCumulativeDecrease: 0,
  };
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const groupBy = (getFlag('group', '') as GroupBy) || null;
  const siteFilter = getFlag('site', '') || '';
  const accountFilter = getFlag('account', '') || '';
  const categoryFilter = getFlag('category', '') || '';
  const minClicks = toInt(getFlag('min-clicks', '50'), 50);
  const showSamples = toInt(getFlag('samples', '3'), 3);

  console.log(`\n# Session discounting scan (click-level)`);
  console.log(`Date (UTC): ${date}`);
  if (siteFilter) console.log(`Site filter: ${siteFilter}`);
  if (accountFilter) console.log(`Account filter: ${accountFilter}`);
  if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
  if (groupBy) console.log(`Group by: ${groupBy}`);
  console.log(`Min clicks (per group): ${minClicks}`);
  console.log(`Samples: ${showSamples}\n`);

  const api = new StrategisApi({
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    networkId: process.env.STRATEGIS_NETWORK_ID,
    timezone: process.env.STRATEGIS_TIMEZONE || 'UTC',
  });

  const [sessions, ciMap] = await Promise.all([
    api.fetchS1SessionRevenue(date, false),
    loadCampaignIndexMap(date),
  ]);

  console.log(`Fetched ${sessions.length} click/session rows from get-session-rev\n`);

  const totals = newCounters();
  const byGroup = new Map<string, Counters>();
  const sampleRows: Array<{ group: string; campaign: string | null; site: string | null; category: string | null; updates: any[] }> = [];

  for (const s of sessions) {
    const campaignKey =
      normalizeString(s.strategisCampaignId) ??
      normalizeString(s.strategiscampaignid) ??
      normalizeString(s.strategis_campaign_id) ??
      normalizeString(s.campaign_id) ??
      normalizeString(s.campaignId);
    const meta = campaignKey ? ciMap.get(campaignKey) : undefined;
    const rsocSite = meta?.rsoc_site || null;
    const category = meta?.category || null;
    const account = meta?.s1_google_account || null;

    if (siteFilter && rsocSite !== siteFilter) continue;
    if (accountFilter && account !== accountFilter) continue;
    if (categoryFilter && category !== categoryFilter) continue;

    const signals = detectDiscountingSignals(s);

    const apply = (c: Counters) => {
      c.clicks += 1;
      if (signals.hasUpdates) c.clicksWithUpdates += 1;
      if (signals.hasPositive) c.clicksWithPositiveUpdates += 1;
      if (signals.hasNegativeRevenueUpdate) c.clicksWithNegativeUpdate += 1;
      if (signals.hasCumulativeField) c.clicksWithCumulativeField += 1;
      if (signals.hasCumulativeDecrease) c.clicksWithCumulativeDecrease += 1;
    };

    apply(totals);

    if (groupBy) {
      let g = 'UNKNOWN';
      switch (groupBy) {
        case 'site':
          g = rsocSite || 'UNKNOWN_SITE';
          break;
        case 'category':
          g = category || 'UNKNOWN_CATEGORY';
          break;
        case 'account':
          g = account || 'UNKNOWN_ACCOUNT';
          break;
        case 'campaign':
          g = meta?.strategis_campaign_id || campaignKey || 'UNKNOWN_CAMPAIGN';
          break;
      }
      if (!byGroup.has(g)) byGroup.set(g, newCounters());
      apply(byGroup.get(g)!);

      // collect samples for discount signals
      if ((signals.hasNegativeRevenueUpdate || signals.hasCumulativeDecrease) && sampleRows.length < showSamples) {
        sampleRows.push({
          group: g,
          campaign: meta?.strategis_campaign_id || campaignKey || null,
          site: rsocSite,
          category,
          updates: Array.isArray(s?.revenue_updates) ? s.revenue_updates : [],
        });
      }
    }
  }

  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

  console.log('## Overall');
  console.log(`clicks: ${totals.clicks}`);
  console.log(`clicks_with_updates: ${totals.clicksWithUpdates} (${pct(totals.clicksWithUpdates, totals.clicks).toFixed(1)}%)`);
  console.log(`clicks_with_positive_updates: ${totals.clicksWithPositiveUpdates} (${pct(totals.clicksWithPositiveUpdates, totals.clicks).toFixed(1)}%)`);
  console.log(`clicks_with_negative_update: ${totals.clicksWithNegativeUpdate} (${pct(totals.clicksWithNegativeUpdate, totals.clicks).toFixed(3)}%)`);
  console.log(`clicks_with_cumulative_field: ${totals.clicksWithCumulativeField} (${pct(totals.clicksWithCumulativeField, totals.clicks).toFixed(1)}%)`);
  console.log(`clicks_with_cumulative_decrease: ${totals.clicksWithCumulativeDecrease} (${pct(totals.clicksWithCumulativeDecrease, totals.clicks).toFixed(3)}%)`);
  console.log('');

  if (groupBy) {
    console.log(`## By ${groupBy} (min clicks: ${minClicks})`);
    const rows = Array.from(byGroup.entries())
      .map(([group, c]) => ({
        group,
        clicks: c.clicks,
        pct_updates: pct(c.clicksWithUpdates, c.clicks),
        pct_positive_updates: pct(c.clicksWithPositiveUpdates, c.clicks),
        pct_negative_update: pct(c.clicksWithNegativeUpdate, c.clicks),
        pct_cum_decrease: pct(c.clicksWithCumulativeDecrease, c.clicks),
      }))
      .filter((r) => r.clicks >= minClicks)
      .sort((a, b) => b.pct_negative_update - a.pct_negative_update || b.pct_cum_decrease - a.pct_cum_decrease || b.clicks - a.clicks);

    if (rows.length === 0) {
      console.log('(No groups met min-clicks threshold)');
    } else {
      console.log('| group | clicks | %with_updates | %with_positive_updates | %with_negative_update | %with_cum_decrease |');
      console.log('|---|---:|---:|---:|---:|---:|');
      for (const r of rows.slice(0, 50)) {
        console.log(
          `| ${r.group} | ${r.clicks} | ${r.pct_updates.toFixed(1)}% | ${r.pct_positive_updates.toFixed(1)}% | ${r.pct_negative_update.toFixed(3)}% | ${r.pct_cum_decrease.toFixed(3)}% |`
        );
      }
    }
    console.log('');

    if (sampleRows.length > 0) {
      console.log('## Samples (discount signal present)');
      for (const s of sampleRows) {
        console.log(`- group=${s.group} campaign=${s.campaign ?? 'N/A'} site=${s.site ?? 'N/A'} category=${s.category ?? 'N/A'}`);
        console.log(JSON.stringify(s.updates.slice(0, 10), null, 2));
      }
      console.log('');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err?.message || err);
  process.exit(1);
});

