import 'dotenv/config';
import fs from 'fs';
import path from 'path';
// Import as any to avoid depending on specific DuckDB TypeScript typings
// and keep this script decoupled from the main monitoring DB helper.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const duckdb: any = require('duckdb');
import { StrategisClient, StrategisCampaign } from '../services/strategisClient';

type ForcekeyMap = Map<string, string[]>; // campaignId -> forcekeys[]

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchAllCampaigns(client: StrategisClient, org: string): Promise<StrategisCampaign[]> {
  // Strategis API currently exposes GET /api/campaigns for listing campaigns by organization.
  // We don't have a typed helper yet, so call it via the generic request.
  const url = `/api/campaigns?organization=${encodeURIComponent(org)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = client as any;
  if (typeof anyClient['request'] !== 'function') {
    throw new Error('StrategisClient.request not accessible; add a listCampaigns helper instead');
  }
  const campaigns = await anyClient['request']('GET', url);
  return campaigns as StrategisCampaign[];
}

function buildForcekeyMap(campaigns: StrategisCampaign[]): ForcekeyMap {
  const map: ForcekeyMap = new Map();
  for (const c of campaigns) {
    const props = c.properties || {};
    const keys: string[] = [];
    for (const [k, v] of Object.entries(props)) {
      if (/^forcekey[A-Z]$/i.test(k) && typeof v === 'string' && v.trim().length > 0) {
        keys.push(v.trim());
      }
    }
    if (keys.length > 0) {
      map.set(c.id, keys);
    }
  }
  return map;
}

function openSessionRevenueDb(): any {
  const dbPath = path.resolve(process.cwd(), 'data', 'session_revenue.duckdb');
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  return new duckdb.Database(dbPath);
}

async function queryControlShareByCampaign(date: string, outputPath?: string) {
  const org = process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const strategisClient = new StrategisClient({
    baseUrl: process.env.STRATEGIS_API_BASE_URL || 'https://api.strategis.internal',
    apiKey: process.env.STRATEGIS_API_KEY,
  });

  console.log(`[keyword-control] Fetching Strategis campaigns for org=${org} ...`);
  const campaigns = await fetchAllCampaigns(strategisClient, org);
  console.log(`[keyword-control] Retrieved ${campaigns.length} campaigns`);

  const forcekeyMap = buildForcekeyMap(campaigns);
  console.log(`[keyword-control] ${forcekeyMap.size} campaigns have forcekeys configured`);

  console.log(`[keyword-control] Querying s1_session_revenue for ${date} ...`);
  const db = openSessionRevenueDb();
  const conn = db.connect();
  const all = (q: string) =>
    new Promise<any[]>((resolve, reject) =>
      (conn as any).all(q, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows)))
    );

  const rows = await all(
    `
    SELECT 
      date,
      session_id,
      total_revenue,
      raw_data
    FROM s1_session_revenue
    WHERE date = '${date}'
  `,
  );
  console.log(`[keyword-control] Loaded ${rows.length} session rows from DuckDB`);

  type SessionRow = {
    campaignId: string | null;
    keyword: string | null;
    sessionId: string | null;
    totalRevenue: number;
    isOurs: boolean;
  };

  const sessionRows: SessionRow[] = [];

  for (const r of rows) {
    let campaignId: string | null = null;
    let keyword: string | null = null;
    try {
      const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
      const cid = raw?.campaign_id ?? raw?.campaignId ?? null;
      const kw = raw?.keyword ?? null;
      campaignId = cid ? String(cid).trim() : null;
      keyword = kw ? String(kw).trim() : null;
    } catch {
      // Ignore malformed raw_data
    }
    const totalRevenue =
      typeof r.total_revenue === 'number'
        ? r.total_revenue
        : Number(r.total_revenue ?? 0) || 0;

    if (!campaignId || !keyword) continue;

    const forcekeys = forcekeyMap.get(campaignId) || [];
    const kwLower = keyword.toLowerCase();
    const isOurs = forcekeys.some((fk) => fk.toLowerCase() === kwLower);

    sessionRows.push({
      campaignId,
      keyword,
      sessionId: r.session_id ? String(r.session_id) : null,
      totalRevenue,
      isOurs,
    });
  }

  console.log(
    `[keyword-control] ${sessionRows.length} session rows with campaign+keyword, of which ` +
      `${sessionRows.filter((r) => r.isOurs).length} match configured forcekeys`
  );

  type Key = string;
  type Agg = {
    campaignId: string;
    keyword: string;
    isOurs: boolean;
    sessions: number;
    revenue: number;
  };

  const byCampaignKeyword = new Map<Key, Agg>();

  for (const s of sessionRows) {
    const key = `${s.campaignId}|${s.keyword}|${s.isOurs ? '1' : '0'}`;
    let agg = byCampaignKeyword.get(key);
    if (!agg) {
      agg = {
        campaignId: s.campaignId!,
        keyword: s.keyword!,
        isOurs: s.isOurs,
        sessions: 0,
        revenue: 0,
      };
      byCampaignKeyword.set(key, agg);
    }
    agg.sessions += 1;
    agg.revenue += s.totalRevenue;
  }

  type CampaignAgg = {
    campaignId: string;
    revenueInControl: number;
    revenueGoogle: number;
    sessionsInControl: number;
    sessionsGoogle: number;
  };

  const byCampaign = new Map<string, CampaignAgg>();

  for (const agg of byCampaignKeyword.values()) {
    let c = byCampaign.get(agg.campaignId);
    if (!c) {
      c = {
        campaignId: agg.campaignId,
        revenueInControl: 0,
        revenueGoogle: 0,
        sessionsInControl: 0,
        sessionsGoogle: 0,
      };
      byCampaign.set(agg.campaignId, c);
    }
    if (agg.isOurs) {
      c.revenueInControl += agg.revenue;
      c.sessionsInControl += agg.sessions;
    } else {
      c.revenueGoogle += agg.revenue;
      c.sessionsGoogle += agg.sessions;
    }
  }

  const outRows: any[] = [];
  for (const c of byCampaign.values()) {
    const totalRev = c.revenueInControl + c.revenueGoogle;
    const totalSess = c.sessionsInControl + c.sessionsGoogle;
    const controlRevenueShare = totalRev > 0 ? c.revenueInControl / totalRev : 0;
    const controlSessionShare = totalSess > 0 ? c.sessionsInControl / totalSess : 0;
    outRows.push({
      campaign_id: c.campaignId,
      revenue_in_control: c.revenueInControl,
      revenue_google: c.revenueGoogle,
      revenue_total: totalRev,
      control_revenue_share: controlRevenueShare,
      sessions_in_control: c.sessionsInControl,
      sessions_google: c.sessionsGoogle,
      sessions_total: totalSess,
      control_session_share: controlSessionShare,
    });
  }

  // Sort by revenue_total desc
  outRows.sort((a, b) => b.revenue_total - a.revenue_total);

  if (outputPath) {
    const header = [
      'campaign_id',
      'revenue_in_control',
      'revenue_google',
      'revenue_total',
      'control_revenue_share',
      'sessions_in_control',
      'sessions_google',
      'sessions_total',
      'control_session_share',
    ];
    const lines = [header.join(',')];
    for (const r of outRows) {
      lines.push(
        [
          r.campaign_id,
          r.revenue_in_control.toFixed(2),
          r.revenue_google.toFixed(2),
          r.revenue_total.toFixed(2),
          r.control_revenue_share.toFixed(4),
          r.sessions_in_control,
          r.sessions_google,
          r.sessions_total,
          r.control_session_share.toFixed(4),
        ].join(','),
      );
    }
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    console.log(`[keyword-control] Wrote report to ${outputPath}`);
  } else {
    console.log('\ncampaign_id,revenue_in_control,revenue_google,revenue_total,control_revenue_share');
    for (const r of outRows.slice(0, 50)) {
      console.log(
        [
          r.campaign_id,
          r.revenue_in_control.toFixed(2),
          r.revenue_google.toFixed(2),
          r.revenue_total.toFixed(2),
          (r.control_revenue_share * 100).toFixed(2) + '%',
        ].join(','),
      );
    }
  }

  conn.close();
}

async function main() {
  const date = getFlag('date', todayUtc());
  const output = getFlag('output', '');

  const outPath = output ? path.resolve(process.cwd(), output) : undefined;

  await queryControlShareByCampaign(date, outPath);
}

main().catch((err) => {
  console.error('[keyword-control] Fatal error:', err);
  process.exit(1);
});


