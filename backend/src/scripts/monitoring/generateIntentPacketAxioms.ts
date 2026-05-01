#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { discoverIntentPacketAxioms } from '../../lib/intentPacketAxioms';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(flag)) return arg.slice(flag.length);
  }
  return def;
}

async function main() {
  const anchorsArg = getArg('anchors');
  if (!anchorsArg) {
    throw new Error('Missing required --anchors="kw1|kw2|kw3"');
  }

  const result = await discoverIntentPacketAxioms({
    anchorKeywords: anchorsArg.split('|').map((value) => value.trim()).filter(Boolean),
    startDate: getArg('start-date') || null,
    endDate: getArg('end-date') || null,
    market: getArg('market') || 'US',
    maxKeywordsPerGroup: getArg('max-keywords-per-group') ? Number(getArg('max-keywords-per-group')) : undefined,
    minSharedTokens: getArg('min-shared-tokens') ? Number(getArg('min-shared-tokens')) : undefined,
    minGroupSearches: getArg('min-group-searches') ? Number(getArg('min-group-searches')) : undefined,
    minGroupClicks: getArg('min-group-clicks') ? Number(getArg('min-group-clicks')) : undefined,
  });

  const slug = anchorsArg.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'packet-axioms';
  const outputDir = path.resolve(process.cwd(), '.local/strategis/facebook/intent-packet-axioms', slug);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    `${JSON.stringify(
      {
        ...result.summary,
        topPacketOptions: result.packetOptions.slice(0, 10).map((option) => ({
          sourceKind: option.sourceKind,
          label: option.label,
          primaryKeyword: option.primaryKeyword,
          supportingKeywords: option.supportingKeywords,
          totalClicks: option.totalClicks,
          totalRevenue: option.totalRevenue,
          blendedRpc: option.blendedRpc,
          launchPriority: option.packet.scores.launchPriority,
        })),
      },
      null,
      2
    )}\n`
  );

  console.log(JSON.stringify(result.summary, null, 2));
  console.log(
    JSON.stringify(
      result.packetOptions.slice(0, 5).map((option) => ({
        sourceKind: option.sourceKind,
        label: option.label,
        primaryKeyword: option.primaryKeyword,
        totalClicks: option.totalClicks,
        totalRevenue: option.totalRevenue,
        blendedRpc: option.blendedRpc,
        launchPriority: option.packet.scores.launchPriority,
      })),
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
