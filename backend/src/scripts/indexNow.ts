import 'dotenv/config';
import axios from 'axios';
import { Pool } from 'pg';
import { getPgPool } from '../lib/pg';

type FbRow = Record<string, string>;

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFlagString(name: string, def: string = ''): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def;
  return arg.slice(key.length);
}

function getFlagBool(name: string, def: boolean = false): boolean {
  const v = getFlagString(name, def ? '1' : '0').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function buildRowKeyMap(row: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeKey(k), v);
  }
  return map;
}

function pickFrom(rowMap: Map<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const v = rowMap.get(normalizeKey(c));
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function pickNumFrom(rowMap: Map<string, string>, candidates: string[], centsToUsd: boolean = false): number | null {
  const s = pickFrom(rowMap, candidates);
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return centsToUsd ? n / 100 : n;
}

async function fetchCsv(url: string, params: Record<string, string>): Promise<{ header: string[]; rows: Record<string, string>[] }> {
  const qs = new URLSearchParams(params);
  const full = `${url}?${qs.toString()}`;
  const resp = await axios.get(full, { responseType: 'text', timeout: 120000 });
  const csv = String(resp.data || '');
  return parseCsv(csv);
}

function parseCsv(csvText: string): { header: string[]; rows: Record<string, string>[] } {
  const text = csvText.trim();
  if (!text) return { header: [], rows: [] };
  const lines = text.split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const r: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) r[header[j]] = vals[j] ?? '';
    rows.push(r);
  }
  return { header, rows };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === ',') {
        out.push(field);
        field = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        field += ch;
      }
    }
  }
  out.push(field);
  return out;
}

async function upsertCampaign(
  client: Pool,
  nowIso: string,
  obj: { id: string; accountId: string; name?: string | null; status?: string | null; createdTime?: string | null; firstSpendAt?: string | null; baseline: boolean }
): Promise<void> {
  const sql = `
    INSERT INTO fb_campaigns (id, account_id, name, status, created_time, first_seen_at, first_spend_at, first_session_at, last_seen_at, baseline)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$6,$8)
    ON CONFLICT (id) DO UPDATE SET
      account_id = COALESCE(EXCLUDED.account_id, fb_campaigns.account_id),
      name = COALESCE(EXCLUDED.name, fb_campaigns.name),
      status = COALESCE(EXCLUDED.status, fb_campaigns.status),
      created_time = COALESCE(fb_campaigns.created_time, EXCLUDED.created_time),
      first_seen_at = LEAST(fb_campaigns.first_seen_at, EXCLUDED.first_seen_at),
      first_spend_at = CASE 
        WHEN fb_campaigns.first_spend_at IS NULL THEN EXCLUDED.first_spend_at
        WHEN EXCLUDED.first_spend_at IS NULL THEN fb_campaigns.first_spend_at
        ELSE LEAST(fb_campaigns.first_spend_at, EXCLUDED.first_spend_at)
      END,
      last_seen_at = GREATEST(fb_campaigns.last_seen_at, EXCLUDED.last_seen_at),
      baseline = fb_campaigns.baseline
  `;
  await client.query(sql, [
    obj.id,
    obj.accountId,
    obj.name ?? null,
    obj.status ?? null,
    obj.createdTime ?? null,
    nowIso,
    obj.firstSpendAt ?? null,
    obj.baseline,
  ]);
}

async function upsertAdset(
  client: Pool,
  nowIso: string,
  obj: { id: string; campaignId?: string | null; accountId: string; name?: string | null; status?: string | null; createdTime?: string | null; firstSpendAt?: string | null; baseline: boolean }
): Promise<void> {
  const sql = `
    INSERT INTO fb_adsets (id, campaign_id, account_id, name, status, created_time, first_seen_at, first_spend_at, first_session_at, last_seen_at, baseline)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$7,$9)
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = COALESCE(EXCLUDED.campaign_id, fb_adsets.campaign_id),
      account_id = COALESCE(EXCLUDED.account_id, fb_adsets.account_id),
      name = COALESCE(EXCLUDED.name, fb_adsets.name),
      status = COALESCE(EXCLUDED.status, fb_adsets.status),
      created_time = COALESCE(fb_adsets.created_time, EXCLUDED.created_time),
      first_seen_at = LEAST(fb_adsets.first_seen_at, EXCLUDED.first_seen_at),
      first_spend_at = CASE 
        WHEN fb_adsets.first_spend_at IS NULL THEN EXCLUDED.first_spend_at
        WHEN EXCLUDED.first_spend_at IS NULL THEN fb_adsets.first_spend_at
        ELSE LEAST(fb_adsets.first_spend_at, EXCLUDED.first_spend_at)
      END,
      last_seen_at = GREATEST(fb_adsets.last_seen_at, EXCLUDED.last_seen_at),
      baseline = fb_adsets.baseline
  `;
  await client.query(sql, [
    obj.id,
    obj.campaignId ?? null,
    obj.accountId,
    obj.name ?? null,
    obj.status ?? null,
    obj.createdTime ?? null,
    nowIso,
    obj.firstSpendAt ?? null,
    obj.baseline,
  ]);
}

async function upsertAd(
  client: Pool,
  nowIso: string,
  obj: { id: string; adsetId?: string | null; campaignId?: string | null; accountId: string; name?: string | null; status?: string | null; createdTime?: string | null; firstSpendAt?: string | null; baseline: boolean }
): Promise<void> {
  const sql = `
    INSERT INTO fb_ads (id, adset_id, campaign_id, account_id, name, status, created_time, first_seen_at, first_spend_at, first_session_at, last_seen_at, baseline)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$8,$10)
    ON CONFLICT (id) DO UPDATE SET
      adset_id = COALESCE(EXCLUDED.adset_id, fb_ads.adset_id),
      campaign_id = COALESCE(EXCLUDED.campaign_id, fb_ads.campaign_id),
      account_id = COALESCE(EXCLUDED.account_id, fb_ads.account_id),
      name = COALESCE(EXCLUDED.name, fb_ads.name),
      status = COALESCE(EXCLUDED.status, fb_ads.status),
      created_time = COALESCE(fb_ads.created_time, EXCLUDED.created_time),
      first_seen_at = LEAST(fb_ads.first_seen_at, EXCLUDED.first_seen_at),
      first_spend_at = CASE 
        WHEN fb_ads.first_spend_at IS NULL THEN EXCLUDED.first_spend_at
        WHEN EXCLUDED.first_spend_at IS NULL THEN fb_ads.first_spend_at
        ELSE LEAST(fb_ads.first_spend_at, EXCLUDED.first_spend_at)
      END,
      last_seen_at = GREATEST(fb_ads.last_seen_at, EXCLUDED.last_seen_at),
      baseline = fb_ads.baseline
  `;
  await client.query(sql, [
    obj.id,
    obj.adsetId ?? null,
    obj.campaignId ?? null,
    obj.accountId,
    obj.name ?? null,
    obj.status ?? null,
    obj.createdTime ?? null,
    nowIso,
    obj.firstSpendAt ?? null,
    obj.baseline,
  ]);
}

async function upsertDaily(
  client: Pool,
  rows: Array<{ date: string; level: 'campaign' | 'adset' | 'ad'; entityId: string; accountId: string; spendUsd: number | null; impressions: number | null; clicks: number | null }>
): Promise<void> {
  if (rows.length === 0) return;
  const sql = `
    INSERT INTO fb_insights_daily (date, level, entity_id, account_id, spend_usd, impressions, clicks)
    VALUES ${rows.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(',')}
    ON CONFLICT (date, level, entity_id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      spend_usd = COALESCE(EXCLUDED.spend_usd, fb_insights_daily.spend_usd),
      impressions = COALESCE(EXCLUDED.impressions, fb_insights_daily.impressions),
      clicks = COALESCE(EXCLUDED.clicks, fb_insights_daily.clicks)
  `;
  const params: any[] = [];
  for (const r of rows) {
    params.push(r.date, r.level, r.entityId, r.accountId, r.spendUsd, r.impressions, r.clicks);
  }
  await client.query(sql, params);
}

async function run(): Promise<void> {
  const date = getFlagString('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('Usage: ts-node src/scripts/indexNow.ts --date=YYYY-MM-DD [--baseline=0|1]');
    process.exit(1);
  }
  const baseline = getFlagBool('baseline', false);
  const nowIso = new Date().toISOString();

  const fbUrl = 'https://staging-dot-strategis-273115.appspot.com/api/facebook/spend-report';
  const fbParams = {
    date,
    output: 'csv',
    filterZero: '0',
    incremental: '1',
    limit: '-1',
    offset: '0',
  };

  console.log(`[indexNow] Fetching Facebook spend CSV for ${date} ...`);
  const { rows: fbRows } = await fetchCsv(fbUrl, fbParams);
  console.log(`[indexNow] Received ${fbRows.length} rows`);
  if (fbRows.length > 0) {
    const sampleKeys = Object.keys(fbRows[0]).slice(0, 20);
    console.log(`[indexNow] Sample header keys: ${sampleKeys.join(', ')}`);
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Aggregate per level for daily table
    const aggregate = new Map<string, { date: string; level: 'campaign' | 'adset' | 'ad'; entityId: string; accountId: string; spendUsd: number; impressions: number; clicks: number }>();

    for (const row of fbRows) {
      const rowMap = buildRowKeyMap(row);
      // Determine IDs and names
      const accountId = pickFrom(rowMap, ['account_id','ad_account_id','account','accountid','adaccountid','adaccount_id','adAccountId']);
      const campaignId = pickFrom(rowMap, ['campaign_id','campaignid','campaign','campaignId']);
      const adsetId = pickFrom(rowMap, ['adset_id','ad_set_id','adsetid','adgroup_id','adgroupid','adset','network_ad_group_id','networkadgroupid','adsetId','adSetId']);
      const adId = pickFrom(rowMap, ['ad_id','adid','ad','adId']);
      const campaignName = pickFrom(rowMap, ['campaign_name','campaign','campaignname','name']);
      const adsetName = pickFrom(rowMap, ['adset_name','ad_set_name','adsetname','adgroup_name','adgroup']);
      const adName = pickFrom(rowMap, ['ad_name','adname','name']);
      const status = pickFrom(rowMap, ['status','delivery_status','deliverystatus','delivery']);

      // Metrics
      let spendUsd = pickNumFrom(rowMap, ['spend_usd','spend','amount_spent','amountspent'], false);
      if (spendUsd === null) {
        const spendCents = pickNumFrom(rowMap, ['spend_cents'], false);
        spendUsd = spendCents !== null ? spendCents / 100 : null;
      }
      const impressions = pickNumFrom(rowMap, ['impressions'], false);
      const clicks = pickNumFrom(rowMap, ['clicks','link_clicks','linkclicks'], false);

      // Upsert parents first
      if (campaignId && accountId) {
        await upsertCampaign(pool, nowIso, {
          id: campaignId,
          accountId,
          name: campaignName || null,
          status: status || null,
          createdTime: null,
          firstSpendAt: spendUsd && spendUsd > 0 ? `${date}T00:00:00.000Z` : null,
          baseline,
        });
      }
      if (adsetId && accountId) {
        await upsertAdset(pool, nowIso, {
          id: adsetId,
          campaignId: campaignId || null,
          accountId,
          name: adsetName || null,
          status: status || null,
          createdTime: null,
          firstSpendAt: spendUsd && spendUsd > 0 ? `${date}T00:00:00.000Z` : null,
          baseline,
        });
      }
      if (adId && accountId) {
        await upsertAd(pool, nowIso, {
          id: adId,
          adsetId: adsetId || null,
          campaignId: campaignId || null,
          accountId,
          name: adName || null,
          status: status || null,
          createdTime: null,
          firstSpendAt: spendUsd && spendUsd > 0 ? `${date}T00:00:00.000Z` : null,
          baseline,
        });
      }

      // Aggregate daily per most specific level present
      let level: 'campaign' | 'adset' | 'ad' | null = null;
      let entityId = '';
      if (adId) {
        level = 'ad';
        entityId = adId;
      } else if (adsetId) {
        level = 'adset';
        entityId = adsetId;
      } else if (campaignId) {
        level = 'campaign';
        entityId = campaignId;
      }
      if (level && entityId && accountId) {
        const key = `${date}|${level}|${entityId}`;
        const acc = aggregate.get(key) || {
          date,
          level,
          entityId,
          accountId,
          spendUsd: 0,
          impressions: 0,
          clicks: 0,
        };
        if (spendUsd !== null) acc.spendUsd += spendUsd;
        if (impressions !== null) acc.impressions += impressions;
        if (clicks !== null) acc.clicks += clicks;
        aggregate.set(key, acc);
      }
    }

    await upsertDaily(
      pool,
      Array.from(aggregate.values()).map((r) => ({
        date: r.date,
        level: r.level,
        entityId: r.entityId,
        accountId: r.accountId,
        spendUsd: Number.isFinite(r.spendUsd) ? r.spendUsd : null,
        impressions: Number.isFinite(r.impressions) ? r.impressions : null,
        clicks: Number.isFinite(r.clicks) ? r.clicks : null,
      }))
    );

    await client.query('COMMIT');
    console.log(`[indexNow] Indexed ${aggregate.size} daily rows for ${date}`);
    if (aggregate.size === 0) {
      // Emit diagnostics to help map CSV schema
      const max = Math.min(5, fbRows.length);
      console.log('[indexNow] No rows aggregated. Showing diagnostics for first rows:');
      for (let i = 0; i < max; i++) {
        const row = fbRows[i];
        const rowMap = buildRowKeyMap(row);
        const diag = {
          accountId: pickFrom(rowMap, ['account_id','ad_account_id','account','accountid','adaccountid','adaccount_id','adAccountId']),
          campaignId: pickFrom(rowMap, ['campaign_id','campaignid','campaign','campaignId','network_campaign_id','networkcampaignid','network_campaignid']),
          adsetId: pickFrom(rowMap, ['adset_id','ad_set_id','adsetid','adgroup_id','adgroupid','adset','network_ad_group_id','networkadgroupid','adsetId','adSetId']),
          adId: pickFrom(rowMap, ['ad_id','adid','ad','adId','network_ad_id','networkadid']),
          spend: pickFrom(rowMap, ['spend_usd','spend','amount_spent','amountspent','spend_cents']),
          impressions: pickFrom(rowMap, ['impressions']),
          clicks: pickFrom(rowMap, ['clicks','link_clicks','linkclicks']),
        };
        console.log(`[indexNow][row ${i}]`, diag);
      }
      console.log('[indexNow] Please share the header names for IDs and spend if mapping looks off.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[indexNow] Error:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

run().catch((e) => {
  console.error('[indexNow] Fatal:', e);
  process.exit(1);
});


