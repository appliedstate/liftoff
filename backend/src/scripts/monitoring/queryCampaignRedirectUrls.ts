#!/usr/bin/env ts-node

/**
 * Fetch campaign tracking/redirect URLs to inspect landing/article pages.
 *
 * Primary source: Postgres `campaign_mappings.tracking_urls` (created by our campaign factory).
 * Optional helper: pull top campaigns for a site/date from monitoring DuckDB `campaign_index`.
 *
 * Usage:
 *   # Provide campaign IDs directly
 *   npm run monitor:campaign-redirect-urls -- --campaign-ids=sifa4fk06ve,siu22e60660
 *
 *   # Pull top campaigns for a site (by campaign_index revenue), then look up their tracking_urls
 *   npm run monitor:campaign-redirect-urls -- --date=2026-01-14 --site=trivia-library.com --top=20
 *
 *   # Also resolve redirects to final URL (network)
 *   npm run monitor:campaign-redirect-urls -- --date=2026-01-14 --site=secretprice.com --top=10 --resolve=true --resolve-limit=30
 *
 * Notes:
 * - Requires PGVECTOR_URL env var for Postgres access.
 * - Not all campaigns will exist in campaign_mappings (only those launched via our tooling).
 */

import 'dotenv/config';
import { Client } from 'pg';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from '../../lib/monitoringDb';
import { resolveFinalUrl } from '../../lib/urlResolve';

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

function parseList(value: string): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type TopCampaignRow = {
  campaign_id: string;
  facebook_campaign_id: string | null;
  campaign_name: string | null;
  revenue_usd: number | null;
  sessions: number | null;
  s1_google_account: string | null;
  category: string | null;
};

async function getTopCampaignsForSite(date: string, site: string, top: number): Promise<TopCampaignRow[]> {
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const rows = await allRows<any>(
      conn,
      `
      SELECT
        campaign_id,
        facebook_campaign_id,
        campaign_name,
        revenue_usd,
        sessions,
        s1_google_account,
        category
      FROM campaign_index
      WHERE date = DATE ${sqlString(date)}
        AND rsoc_site = ${sqlString(site)}
        AND level = 'campaign'
      ORDER BY COALESCE(revenue_usd, 0) DESC
      LIMIT ${top}
      `
    );
    return rows.map((r: any) => ({
      campaign_id: String(r.campaign_id),
      facebook_campaign_id: r.facebook_campaign_id ? String(r.facebook_campaign_id) : null,
      campaign_name: r.campaign_name ? String(r.campaign_name) : null,
      revenue_usd: r.revenue_usd !== undefined && r.revenue_usd !== null ? Number(r.revenue_usd) : null,
      sessions: r.sessions !== undefined && r.sessions !== null ? Number(r.sessions) : null,
      s1_google_account: r.s1_google_account ? String(r.s1_google_account) : null,
      category: r.category ? String(r.category) : null,
    }));
  } finally {
    closeConnection(conn);
  }
}

type MappingRow = {
  request_id: string;
  facebook_campaign_id: string | null;
  strategis_campaign_ids: string[];
  tracking_urls: string[];
};

async function fetchMappingsByIds(opts: { strategisIds: string[]; facebookIds: string[] }): Promise<MappingRow[]> {
  const url = process.env.PGVECTOR_URL;
  if (!url) {
    throw new Error('Missing PGVECTOR_URL env var (required to query campaign_mappings)');
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const strategisIds = opts.strategisIds;
    const facebookIds = opts.facebookIds;

    const clauses: string[] = [];
    const params: any[] = [];

    if (strategisIds.length > 0) {
      params.push(strategisIds);
      clauses.push(`strategis_campaign_ids && $${params.length}::varchar[]`);
    }
    if (facebookIds.length > 0) {
      params.push(facebookIds);
      clauses.push(`facebook_campaign_id = ANY($${params.length}::varchar[])`);
    }

    if (clauses.length === 0) return [];

    const sql = `
      SELECT
        request_id,
        facebook_campaign_id,
        strategis_campaign_ids,
        tracking_urls
      FROM campaign_mappings
      WHERE ${clauses.map((c) => `(${c})`).join(' OR ')}
      ORDER BY updated_at DESC
      LIMIT 200
    `;
    const res = await client.query(sql, params);
    return res.rows.map((r: any) => ({
      request_id: String(r.request_id),
      facebook_campaign_id: r.facebook_campaign_id ? String(r.facebook_campaign_id) : null,
      strategis_campaign_ids: Array.isArray(r.strategis_campaign_ids) ? r.strategis_campaign_ids.map(String) : [],
      tracking_urls: Array.isArray(r.tracking_urls) ? r.tracking_urls.map(String) : [],
    }));
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const site = getFlag('site', '');
  const top = toInt(getFlag('top', '20'), 20);
  const campaignIds = parseList(getFlag('campaign-ids', ''));

  const shouldResolve = getFlag('resolve', 'false').toLowerCase() === 'true';
  const resolveLimit = toInt(getFlag('resolve-limit', '30'), 30);

  let strategisIds: string[] = [];
  let facebookIds: string[] = [];
  let topCampaigns: TopCampaignRow[] = [];

  if (campaignIds.length > 0) {
    strategisIds = campaignIds;
  } else if (site) {
    topCampaigns = await getTopCampaignsForSite(date, site, top);
    strategisIds = topCampaigns.map((r) => r.campaign_id);
    facebookIds = topCampaigns.map((r) => r.facebook_campaign_id).filter((x): x is string => Boolean(x));
  } else {
    console.error('Usage: --campaign-ids=... OR --site=... (optionally with --date= and --top=)');
    process.exit(1);
  }

  console.log(`\n# Campaign redirect / tracking URLs`);
  console.log(`Date: ${date}`);
  if (site) console.log(`Site: ${site} (top=${top})`);
  if (campaignIds.length > 0) console.log(`Campaign IDs: ${campaignIds.join(', ')}`);
  console.log(`Resolve final URLs: ${shouldResolve} (limit ${resolveLimit})\n`);

  if (topCampaigns.length > 0) {
    console.log('## Top campaigns (from campaign_index)\n');
    console.log('| campaign_id | revenue_usd | sessions | category | s1_account | campaign_name |');
    console.log('|---|---:|---:|---|---|---|');
    for (const c of topCampaigns) {
      console.log(
        `| ${c.campaign_id} | ${(c.revenue_usd ?? 0).toFixed(2)} | ${(c.sessions ?? 0).toFixed(0)} | ${c.category ?? ''} | ${c.s1_google_account ?? ''} | ${(c.campaign_name ?? '').replace(/\|/g, '\\\\|')} |`
      );
    }
    console.log('');
  }

  const mappings = await fetchMappingsByIds({ strategisIds, facebookIds });

  if (mappings.length === 0) {
    console.log('No rows found in Postgres campaign_mappings for these campaigns.');
    console.log('That usually means these campaigns were not launched via our campaign factory (no tracking_urls stored).');
    return;
  }

  console.log(`## campaign_mappings matches (${mappings.length})\n`);
  console.log('| request_id | fb_campaign_id | strategis_campaign_ids | tracking_urls |');
  console.log('|---|---|---|---|');
  for (const m of mappings) {
    const sids = m.strategis_campaign_ids.slice(0, 5).join(', ') + (m.strategis_campaign_ids.length > 5 ? '…' : '');
    const urls = m.tracking_urls.slice(0, 2).join(', ') + (m.tracking_urls.length > 2 ? '…' : '');
    console.log(`| ${m.request_id} | ${m.facebook_campaign_id ?? ''} | ${sids} | ${urls.replace(/\|/g, '\\\\|')} |`);
  }
  console.log('');

  // Flatten URLs and optionally resolve
  const allUrls: Array<{ request_id: string; url: string }> = [];
  for (const m of mappings) {
    for (const u of m.tracking_urls) {
      allUrls.push({ request_id: m.request_id, url: u });
    }
  }

  console.log(`## Tracking URLs (${allUrls.length})\n`);
  for (const r of allUrls.slice(0, 200)) {
    console.log(`- ${r.request_id}: ${r.url}`);
  }
  if (allUrls.length > 200) {
    console.log(`... and ${allUrls.length - 200} more`);
  }
  console.log('');

  if (shouldResolve) {
    console.log(`## Resolved final URLs (first ${Math.min(resolveLimit, allUrls.length)})\n`);
    const toResolve = allUrls.slice(0, Math.max(0, resolveLimit));
    for (const r of toResolve) {
      const finalUrl = await resolveFinalUrl(r.url, 15000);
      console.log(`- ${r.request_id}: ${r.url} -> ${finalUrl}`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err?.message || err);
  process.exit(1);
});

