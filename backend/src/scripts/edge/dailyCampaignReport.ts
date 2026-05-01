#!/usr/bin/env ts-node

/**
 * Edge: Daily Campaign Report (single campaign)
 *
 * Pulls daily stats from monitoring DuckDB tables (populated via monitor:ingest-campaigns / monitor:ingest-sessions)
 * and prints a compact summary + an action recommendation.
 *
 * Usage:
 *   npm run edge:campaign-daily -- --campaign-id=sige41p0612
 *   npm run edge:campaign-daily -- --campaign-name="sige41p0612_012026_SeniorInternet_US_Facebook_Edge"
 *   npm run edge:campaign-daily -- --campaign-id=sige41p0612 --pst-date=2026-01-27
 *
 * Optional env:
 *   EDGE_MIN_SPEND_USD=50
 *   EDGE_TARGET_ROAS=1.30
 *   EDGE_CUT_ROAS=1.00
 *   EDGE_SCALE_UP_PCT=0.15
 */

import 'dotenv/config';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from '../../lib/monitoringDb';
import { getYesterdayPST, pstToUtcDate } from '../../lib/dateUtils';

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

function inferStrategisIdFromCampaignName(campaignName: string): string | null {
  const first = String(campaignName || '').trim().split('_')[0]?.trim();
  if (!first) return null;
  // Heuristic: strategis IDs are short-ish and not purely numeric
  if (first.length > 3 && first.length < 20 && !/^\d+$/.test(first)) return first;
  return null;
}

function envNumber(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

type CampaignDaily = {
  date: string;
  campaign_id: string;
  campaign_name: string | null;
  account_id: string | null;
  facebook_campaign_id: string | null;
  media_source: string | null;
  owner: string | null;
  category: string | null;
  lane: string | null;
  spend_usd: number | null;
  revenue_usd: number | null;
  clicks: number | null;
  conversions: number | null;
  sessions: number | null;
  roas: number | null;
};

type SessionDaily = {
  sessions: number;
  revenue: number;
};

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function fetchCampaignDailyRow(opts: {
  conn: any;
  campaignId: string;
  utcDate: string;
  snapshotSource: string;
}): Promise<CampaignDaily | null> {
  const rows = await allRows<CampaignDaily>(
    opts.conn,
    `
    SELECT *
    FROM (
      SELECT
        ci.date,
        ci.campaign_id,
        ci.campaign_name,
        ci.account_id,
        ci.facebook_campaign_id,
        ci.media_source,
        ci.owner,
        ci.category,
        ci.lane,
        ci.spend_usd,
        ci.revenue_usd,
        ci.clicks,
        ci.conversions,
        ci.sessions,
        ci.roas,
        row_number() OVER (
          PARTITION BY ci.date, ci.campaign_id, ci.level, ci.snapshot_source
          ORDER BY ci.updated_at DESC
        ) AS rn
      FROM campaign_index ci
      WHERE ci.date = DATE ${sqlString(opts.utcDate)}
        AND ci.campaign_id = ${sqlString(opts.campaignId)}
        AND ci.level = 'campaign'
        AND ci.snapshot_source = ${sqlString(opts.snapshotSource)}
    )
    WHERE rn = 1
    LIMIT 1
    `
  );
  return rows[0] || null;
}

async function fetchSessionDaily(opts: { conn: any; campaignId: string; utcDate: string }): Promise<SessionDaily> {
  const rows = await allRows<{ sessions: number | null; revenue: number | null }>(
    opts.conn,
    `
    SELECT
      SUM(sessions) AS sessions,
      SUM(revenue) AS revenue
    FROM session_hourly_metrics
    WHERE date = DATE ${sqlString(opts.utcDate)}
      AND campaign_id = ${sqlString(opts.campaignId)}
    `
  );
  return {
    sessions: Number(rows[0]?.sessions || 0),
    revenue: Number(rows[0]?.revenue || 0),
  };
}

function recommendAction(input: {
  spend: number;
  roas: number;
  minSpend: number;
  targetRoas: number;
  cutRoas: number;
  scaleUpPct: number;
}): string {
  const { spend, roas, minSpend, targetRoas, cutRoas, scaleUpPct } = input;
  if (spend < minSpend) return `HOLD (insufficient spend yet; wait for signal).`;
  if (roas >= targetRoas) return `SCALE +${Math.round(scaleUpPct * 100)}% (ROAS above target).`;
  if (roas >= cutRoas) return `HOLD + TEST (near/below target; iterate creative/LP to lift ROAS).`;
  return `CUT / DIAGNOSE (ROAS below cut line).`;
}

async function main(): Promise<void> {
  const campaignIdFlag = getFlag('campaign-id');
  const campaignNameFlag = getFlag('campaign-name');
  const pstDate = getFlag('pst-date') || getYesterdayPST();
  const snapshotSource = getFlag('source') || 'day';

  const campaignId =
    campaignIdFlag ||
    (campaignNameFlag ? inferStrategisIdFromCampaignName(campaignNameFlag) : null);

  if (!campaignId) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: npm run edge:campaign-daily -- --campaign-id=<strategisId> [--pst-date=YYYY-MM-DD] [--source=day|reconciled]\n' +
        '   or: npm run edge:campaign-daily -- --campaign-name="<full campaign name>"'
    );
    process.exit(1);
  }

  const utcCandidates = pstToUtcDate(pstDate);
  const minSpend = envNumber('EDGE_MIN_SPEND_USD', 50);
  const targetRoas = envNumber('EDGE_TARGET_ROAS', 1.3);
  const cutRoas = envNumber('EDGE_CUT_ROAS', 1.0);
  const scaleUpPct = envNumber('EDGE_SCALE_UP_PCT', 0.15);

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);

    // Find best UTC date match for this PST date (whichever has more spend+revenue).
    const candidates: Array<{ utcDate: string; row: CampaignDaily | null; score: number }> = [];
    for (const utcDate of utcCandidates) {
      const row = await fetchCampaignDailyRow({ conn, campaignId, utcDate, snapshotSource });
      const spend = Number(row?.spend_usd || 0);
      const rev = Number(row?.revenue_usd || 0);
      candidates.push({ utcDate, row, score: spend + rev });
    }
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    // eslint-disable-next-line no-console
    console.log(`\n# Edge Daily Campaign Report`);
    // eslint-disable-next-line no-console
    console.log(`Campaign (Strategis ID): ${campaignId}`);
    if (campaignNameFlag) {
      // eslint-disable-next-line no-console
      console.log(`Campaign name (input): ${campaignNameFlag}`);
    }
    // eslint-disable-next-line no-console
    console.log(`PST date: ${pstDate}`);
    // eslint-disable-next-line no-console
    console.log(`UTC date used: ${chosen.utcDate} (source=${snapshotSource})\n`);

    if (!chosen.row) {
      // eslint-disable-next-line no-console
      console.log(`No campaign_index row found yet.`);
      // eslint-disable-next-line no-console
      console.log(`Run first: npm run monitor:ingest-campaigns -- --date=${chosen.utcDate} --mode=remote`);
      process.exit(2);
    }

    const spend = Number(chosen.row.spend_usd || 0);
    const revenue = Number(chosen.row.revenue_usd || 0);
    const roas = spend > 0 ? revenue / spend : 0;
    const profit = revenue - spend;

    // Session-derived view (often more stable for RSOC style economics)
    const sessionDaily = await fetchSessionDaily({ conn, campaignId, utcDate: chosen.utcDate });
    const vRps = sessionDaily.sessions > 0 ? sessionDaily.revenue / sessionDaily.sessions : 0;
    const cps = sessionDaily.sessions > 0 ? spend / sessionDaily.sessions : 0;
    const sessionRoas = cps > 0 ? vRps / cps : 0;

    const action = recommendAction({ spend, roas, minSpend, targetRoas, cutRoas, scaleUpPct });

    // eslint-disable-next-line no-console
    console.log(`## Summary`);
    // eslint-disable-next-line no-console
    console.log(`- Ad account (Strategis): ${chosen.row.account_id || 'N/A'}${chosen.row.facebook_campaign_id ? ` | FB campaign id: ${chosen.row.facebook_campaign_id}` : ''}`);
    // eslint-disable-next-line no-console
    console.log(`- Campaign name: ${chosen.row.campaign_name || 'N/A'}`);
    // eslint-disable-next-line no-console
    console.log(`- Owner/Lane/Category: ${chosen.row.owner || 'N/A'} / ${chosen.row.lane || 'N/A'} / ${chosen.row.category || 'N/A'}`);
    // eslint-disable-next-line no-console
    console.log(`- Spend: ${fmtMoney(spend)} | Revenue: ${fmtMoney(revenue)} | Profit: ${fmtMoney(profit)} | ROAS: ${fmtPct(roas)}`);
    // eslint-disable-next-line no-console
    console.log(
      `- Clicks: ${Math.round(Number(chosen.row.clicks || 0)).toLocaleString()} | Conversions: ${Math.round(Number(chosen.row.conversions || 0)).toLocaleString()} | Sessions: ${Math.round(Number(chosen.row.sessions || 0)).toLocaleString()}`
    );

    // eslint-disable-next-line no-console
    console.log(`\n## Session economics (from session_hourly_metrics)`);
    // eslint-disable-next-line no-console
    console.log(`- Sessions: ${Math.round(sessionDaily.sessions).toLocaleString()} | Revenue: ${fmtMoney(sessionDaily.revenue)} | vRPS: ${fmtMoney(vRps)} | CPS: ${fmtMoney(cps)} | Session ROAS: ${fmtPct(sessionRoas)}`);

    // eslint-disable-next-line no-console
    console.log(`\n## Recommendation`);
    // eslint-disable-next-line no-console
    console.log(`- ${action}`);
    // eslint-disable-next-line no-console
    console.log(`- Targets: minSpend=${fmtMoney(minSpend)}, targetROAS=${fmtPct(targetRoas)}, cutROAS=${fmtPct(cutRoas)}\n`);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  process.exit(1);
});

