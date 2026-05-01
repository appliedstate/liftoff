#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { discoverIntentPackets } from '../../lib/intentPacketDiscovery';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(flag)) return arg.slice(flag.length);
  }
  return def;
}

async function main() {
  const asOfDate = getArg('as-of-date');
  const baselineDays = getArg('baseline-days');
  const recencyDays = getArg('recency-days');
  const minSessions = getArg('min-sessions');
  const minRevenue = getArg('min-revenue');
  const maxCandidates = getArg('max-candidates');

  const result = await discoverIntentPackets({
    asOfDate,
    baselineDays: baselineDays ? Number(baselineDays) : undefined,
    recencyDays: recencyDays ? Number(recencyDays) : undefined,
    minSessions: minSessions ? Number(minSessions) : undefined,
    minRevenue: minRevenue ? Number(minRevenue) : undefined,
    maxCandidates: maxCandidates ? Number(maxCandidates) : undefined,
  });

  const outputDir = path.resolve(process.cwd(), '.local/strategis/facebook/intent-packet-discovery');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(
      {
        ...result.summary,
        topKeywords: result.candidates.slice(0, 10).map((candidate) => ({
          rank: candidate.rank,
          keyword: candidate.keyword,
          expectedRevenuePerPaidClick: candidate.economics.expectedRevenuePerPaidClick,
          expectedContributionMarginPerPaidClick: candidate.economics.expectedContributionMarginPerPaidClick,
          confidence: candidate.economics.confidence,
          packetId: candidate.packet.id,
          launchPriority: candidate.packet.scores.launchPriority,
        })),
      },
      null,
      2
    )
  );

  console.log(JSON.stringify(result.summary, null, 2));
  if (result.candidates.length) {
    console.log(
      JSON.stringify(
        result.candidates.slice(0, 5).map((candidate) => ({
          rank: candidate.rank,
          keyword: candidate.keyword,
          category: candidate.dominantCategory,
          expectedRevenuePerPaidClick: candidate.economics.expectedRevenuePerPaidClick,
          expectedContributionMarginPerPaidClick: candidate.economics.expectedContributionMarginPerPaidClick,
          confidence: candidate.economics.confidence,
          launchPriority: candidate.packet.scores.launchPriority,
          rsocSite: candidate.packet.rsocSite,
          buyer: candidate.packet.buyer,
        })),
        null,
        2
      )
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
