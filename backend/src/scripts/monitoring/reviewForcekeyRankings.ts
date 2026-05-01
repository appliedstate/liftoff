#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { reviewForcekeyRankings } from '../../lib/forcekeyReview';

type Args = {
  organization: string;
  buyer: string | null;
  campaignIds: string[];
  startDate: string;
  endDate: string;
  outputDir: string;
  authToken?: string;
  hydrateMissing: boolean;
  forceRefresh: boolean;
  email?: string;
  password?: string;
};

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function getFlagBool(name: string, defaultValue: boolean): boolean {
  const raw = (getFlag(name) ?? (defaultValue ? '1' : '0')).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function parseArgs(): Args {
  const endDate = getFlag('end-date') || new Date().toISOString().slice(0, 10);
  const days = Math.max(1, Number(getFlag('days') || 7));
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    organization: getFlag('organization') || process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    buyer: getFlag('buyer') || null,
    campaignIds: String(getFlag('campaign-ids') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    startDate: getFlag('start-date') || start.toISOString().slice(0, 10),
    endDate,
    outputDir: path.resolve(process.cwd(), getFlag('output-dir') || '.local/strategis/forcekey-review'),
    authToken: getFlag('auth-token') || process.env.STRATEGIS_AUTH_TOKEN || process.env.STRATEGIST_AUTH_TOKEN,
    hydrateMissing: getFlagBool('hydrate-missing', true),
    forceRefresh: getFlagBool('force-refresh', false),
    email: getFlag('email'),
    password: getFlag('password'),
  };
}

function safeFilePart(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

async function main() {
  const args = parseArgs();

  if (args.email) {
    process.env.IX_ID_EMAIL = args.email;
    process.env.STRATEGIS_EMAIL = args.email;
  }
  if (args.password) {
    process.env.IX_ID_PASSWORD = args.password;
    process.env.STRATEGIS_PASSWORD = args.password;
  }

  const report = await reviewForcekeyRankings({
    organization: args.organization,
    buyer: args.buyer,
    campaignIds: args.campaignIds,
    startDate: args.startDate,
    endDate: args.endDate,
    authToken: args.authToken,
    hydrateMissing: args.hydrateMissing,
    forceRefresh: args.forceRefresh,
  });

  const runId = [
    args.organization,
    args.buyer ? safeFilePart(args.buyer) : 'all-buyers',
    `${args.startDate}_to_${args.endDate}`,
    new Date().toISOString().replace(/[:.]/g, '-'),
  ].join('__');
  const runDir = path.join(args.outputDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));

  const summaryLines = [
    `Forcekey review: ${report.totals.campaignsReviewed} campaigns`,
    `Date window: ${report.dateWindow.start} to ${report.dateWindow.end}`,
    `Ready campaigns: ${report.totals.campaignsReady}`,
    `Reorders suggested: ${report.totals.campaignsSuggestingReorder}`,
    '',
  ];

  for (const campaign of report.campaigns.slice(0, 20)) {
    summaryLines.push(
      [
        `${campaign.campaignId} | ${campaign.campaignName}`,
        `buyer=${campaign.buyer || 'unknown'}`,
        `status=${campaign.reviewStatus}`,
        `confidence=${campaign.confidence}`,
        `searches=${campaign.totalForcekeySearches}`,
        `reorder=${campaign.reorderSuggested ? 'yes' : 'no'}`,
      ].join(' | ')
    );
    summaryLines.push(`  current:     ${campaign.currentOrder.join(' > ')}`);
    summaryLines.push(`  recommended: ${campaign.recommendedOrder.join(' > ')}`);
    summaryLines.push(`  heartbeat: ${campaign.heartbeatDays}d (${campaign.heartbeatReason})`);
    for (const geo of campaign.geoOpportunities.filter((item) => item.topValues.length > 0).slice(0, 2)) {
      const topGeo = geo.topValues[0];
      if (!topGeo) continue;
      summaryLines.push(
        `  geo: ${geo.slot} ${geo.token} -> ${topGeo.value} (${topGeo.band}, rps=${topGeo.rps.toFixed(2)}, uplift=${(topGeo.upliftPct * 100).toFixed(1)}%, launch=${geo.launchGeoCampaign ? 'yes' : 'no'})`
      );
    }
  }

  fs.writeFileSync(path.join(runDir, 'summary.txt'), summaryLines.join('\n'));

  console.log(`[forcekey-review] Wrote ${path.join(runDir, 'report.json')}`);
  console.log(`[forcekey-review] Campaigns reviewed: ${report.totals.campaignsReviewed}`);
  console.log(`[forcekey-review] Campaigns ready: ${report.totals.campaignsReady}`);
  console.log(`[forcekey-review] Reorders suggested: ${report.totals.campaignsSuggestingReorder}`);
}

main().catch((err) => {
  console.error('forcekey review failed:', err?.message || err);
  process.exit(1);
});
