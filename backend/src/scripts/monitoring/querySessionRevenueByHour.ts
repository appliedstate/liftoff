#!/usr/bin/env ts-node

/**
 * Session-level (get-session-rev) revenue maturity by click hour.
 *
 * Goal: detect whether the most-recent click hours are showing a true RPC drop vs
 * placeholder/immature revenue that tends to fill in later.
 *
 * It fetches session-level rows from Strategis staging endpoint (see StrategisApi.fetchS1SessionRevenue)
 * and aggregates by click hour, then optionally groups by site/category/campaign using campaign_index mapping.
 *
 * Usage:
 *   npm run monitor:session-rev-hourly -- --date=2026-01-14 --site=trivia-library.com --group=category
 *   npm run monitor:session-rev-hourly -- --date=2026-01-14 --group=site --last-hours=8
 *
 * Notes:
 * - "click hour" is derived from session fields if present, else from click_time/timestamp (UTC hour).
 * - "matured revenue" uses SUM(revenue_updates[].revenue) when present; this is the best signal.
 * - "total_revenue" can be a mid-day snapshot and may be incomplete; we report it separately.
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

function getHourUtcFromSession(session: any): number | null {
  // Common field names
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
    normalizeString(session.ts) ??
    normalizeString(session.created_at) ??
    normalizeString(session.createdAt);

  if (ts) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) return d.getUTCHours();
  }

  return null;
}

function sumRevenueUpdates(session: any): number {
  const updates = session?.revenue_updates;
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  let sum = 0;
  for (const u of updates) {
    const r = Number(u?.revenue ?? 0);
    if (Number.isFinite(r) && r > 0) sum += r;
  }
  return sum;
}

function getTotalRevenue(session: any): number {
  const candidates = [
    session.total_revenue,
    session.totalRevenue,
    session.revenue,
    session.estimated_revenue,
    session.estimatedRevenue,
    session.revenue_usd,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return 0;
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
    // Map both strategis_campaign_id and facebook_campaign_id -> meta
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

type Agg = {
  clicks: number;
  clicksWithUpdates: number;
  maturedRevenue: number;
  totalRevenue: number;
};

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const groupBy = (getFlag('group', 'site') as GroupBy) || 'site';
  const siteFilter = getFlag('site', '') || '';
  const categoryFilter = getFlag('category', '') || '';
  const ownerFilter = getFlag('owner', '') || '';
  const minSessions = toInt(getFlag('min-sessions', '50'), 50);
  const lastHours = toInt(getFlag('last-hours', '8'), 8);

  const api = new StrategisApi({
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    networkId: process.env.STRATEGIS_NETWORK_ID,
    timezone: process.env.STRATEGIS_TIMEZONE || 'UTC',
  });

  console.log(`\n# Session-level revenue by click hour`);
  console.log(`Date (UTC): ${date}`);
  console.log(`Group: ${groupBy}`);
  if (siteFilter) console.log(`Site filter: ${siteFilter}`);
  if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
  if (ownerFilter) console.log(`Owner filter: ${ownerFilter}`);
  console.log(`Min sessions (per group-hour): ${minSessions}`);
  console.log(`Showing last hours: ${lastHours}\n`);

  const [sessions, ciMap] = await Promise.all([
    api.fetchS1SessionRevenue(date, false),
    loadCampaignIndexMap(date),
  ]);

  console.log(`Fetched ${sessions.length} sessions from get-session-rev\n`);

  // groupKey -> hour -> agg
  const aggs = new Map<string, Map<number, Agg>>();
  let maxHour = -1;

  for (const s of sessions) {
    const hour = getHourUtcFromSession(s);
    if (hour === null) continue;
    maxHour = Math.max(maxHour, hour);

    const campaignKey =
      normalizeString(s.strategisCampaignId) ??
      normalizeString(s.strategiscampaignid) ??
      normalizeString(s.strategis_campaign_id) ??
      normalizeString(s.campaign_id) ??
      normalizeString(s.campaignId);

    const meta = campaignKey ? ciMap.get(campaignKey) : undefined;
    const rsocSite = meta?.rsoc_site || null;
    const category = meta?.category || null;
    const owner = meta?.owner || null;
    const account = meta?.s1_google_account || null;

    if (siteFilter && rsocSite !== siteFilter) continue;
    if (categoryFilter && category !== categoryFilter) continue;
    if (ownerFilter && owner !== ownerFilter) continue;

    let groupKey: string;
    switch (groupBy) {
      case 'campaign':
        groupKey = meta?.strategis_campaign_id || campaignKey || 'UNKNOWN_CAMPAIGN';
        break;
      case 'category':
        groupKey = category || 'UNKNOWN_CATEGORY';
        break;
      case 'account':
        groupKey = account || 'UNKNOWN_ACCOUNT';
        break;
      case 'site':
      default:
        groupKey = rsocSite || 'UNKNOWN_SITE';
        break;
    }

    if (!aggs.has(groupKey)) aggs.set(groupKey, new Map());
    const byHour = aggs.get(groupKey)!;
    if (!byHour.has(hour)) {
      byHour.set(hour, { clicks: 0, clicksWithUpdates: 0, maturedRevenue: 0, totalRevenue: 0 });
    }
    const a = byHour.get(hour)!;
    a.clicks += 1;
    const matured = sumRevenueUpdates(s);
    if (matured > 0) a.clicksWithUpdates += 1;
    a.maturedRevenue += matured;
    a.totalRevenue += getTotalRevenue(s);
  }

  if (maxHour < 0) {
    console.log('No sessions had a usable click hour. (Fields missing?)');
    return;
  }

  const minHourToShow = Math.max(0, maxHour - Math.max(1, lastHours) + 1);
  const hours = Array.from({ length: maxHour - minHourToShow + 1 }, (_, i) => minHourToShow + i);

  const rows: Array<{
    group: string;
    hour_utc: number;
    clicks: number;
    clicks_with_updates: number;
    matured_revenue: number;
    matured_rev_per_click: number | null;
    matured_rev_per_click_with_updates: number | null;
    total_revenue: number;
    total_rev_per_click: number | null;
    pct_clicks_with_updates: number;
  }> = [];

  for (const [group, byHour] of aggs.entries()) {
    for (const h of hours) {
      const a = byHour.get(h);
      if (!a) continue;
      if (a.clicks < minSessions) continue;
      const maturedRevPerClick = a.clicks > 0 ? a.maturedRevenue / a.clicks : null;
      const maturedRevPerClickWithUpdates =
        a.clicksWithUpdates > 0 ? a.maturedRevenue / a.clicksWithUpdates : null;
      const totalRevPerClick = a.clicks > 0 ? a.totalRevenue / a.clicks : null;
      const pct = a.clicks > 0 ? (a.clicksWithUpdates / a.clicks) * 100 : 0;
      rows.push({
        group,
        hour_utc: h,
        clicks: a.clicks,
        clicks_with_updates: a.clicksWithUpdates,
        matured_revenue: a.maturedRevenue,
        matured_rev_per_click: maturedRevPerClick,
        matured_rev_per_click_with_updates: maturedRevPerClickWithUpdates,
        total_revenue: a.totalRevenue,
        total_rev_per_click: totalRevPerClick,
        pct_clicks_with_updates: pct,
      });
    }
  }

  rows.sort((a, b) => (a.group === b.group ? a.hour_utc - b.hour_utc : a.group.localeCompare(b.group)));

  if (rows.length === 0) {
    console.log('No rows matched filters (or min-sessions too high).');
    console.log('Tip: try --min-sessions=10 or remove filters.');
    return;
  }

  // Pretty-print grouped
  let currentGroup: string | null = null;
  for (const r of rows) {
    if (currentGroup !== r.group) {
      currentGroup = r.group;
      console.log(`\n## ${currentGroup}`);
      console.log('hour_utc | clicks | clicks_w_updates | matured_rev | $/click | $/click(w_updates) | total_rev | total_$/click | %clicks_w_updates');
      console.log('-------- | ----- | --------------- | ---------- | ------ | --------------- | --------- | ----------- | ---------------');
    }
    const maturedPerClick = r.matured_rev_per_click === null ? 'N/A' : `$${r.matured_rev_per_click.toFixed(4)}`;
    const maturedPerClickWU =
      r.matured_rev_per_click_with_updates === null ? 'N/A' : `$${r.matured_rev_per_click_with_updates.toFixed(4)}`;
    const totalPerClick = r.total_rev_per_click === null ? 'N/A' : `$${r.total_rev_per_click.toFixed(4)}`;
    console.log(
      `${String(r.hour_utc).padStart(7)} | ${String(r.clicks).padStart(5)} | ${String(r.clicks_with_updates).padStart(15)} | ${fmtMoney(r.matured_revenue).padStart(10)} | ${maturedPerClick.padStart(6)} | ${maturedPerClickWU.padStart(15)} | ${fmtMoney(r.total_revenue).padStart(9)} | ${totalPerClick.padStart(11)} | ${r.pct_clicks_with_updates.toFixed(1).padStart(15)}%`
    );
  }

  console.log('\n');
}

main().catch((err) => {
  console.error('Fatal error:', err?.message || err);
  process.exit(1);
});

