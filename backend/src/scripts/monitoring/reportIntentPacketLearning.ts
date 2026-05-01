#!/usr/bin/env ts-node

import 'dotenv/config';
import { closeConnection, createMonitoringConnection, initMonitoringSchema } from '../../lib/monitoringDb';
import { queryIntentPacketLearningReport } from '../../lib/intentPacketLearning';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(flag)) return arg.slice(flag.length);
  }
  return def;
}

async function main() {
  const keywords = (getArg('keywords') || '')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
  const namespaces = (getArg('namespaces') || '')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
  const sources = (getArg('sources') || '')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const report = await queryIntentPacketLearningReport(conn, {
      keywords: keywords.length ? keywords : null,
      namespaces: namespaces.length ? (namespaces as any) : null,
      sources: sources.length ? sources : null,
      startDate: getArg('start-date') || null,
      endDate: getArg('end-date') || null,
      market: getArg('market') || null,
    });

    const top = report.priors
      .filter((prior) => prior.searches > 0 || prior.paidImpressions > 0 || prior.decisions > 0)
      .sort((a, b) => (b.monetizedClicks - a.monetizedClicks) || (b.revenue - a.revenue))
      .slice(0, 20)
      .map((prior) => ({
        feature: `${prior.feature.namespace}:${prior.feature.key}`,
        label: prior.feature.label,
        observations: prior.observations,
        searches: prior.searches,
        monetizedClicks: prior.monetizedClicks,
        revenue: prior.revenue,
        searchToClickRate: prior.searchToClickRate,
        revenuePerClick: prior.revenuePerClick,
        deltaSearchToClickRate: prior.deltas.searchToClickRate,
        deltaRevenuePerClick: prior.deltas.revenuePerClick,
        paidCtr: prior.paidCtr,
        deltaPaidCtr: prior.deltas.paidCtr,
        approvalRate: prior.approvalRate,
        deltaApprovalRate: prior.deltas.approvalRate,
      }));

    console.log(JSON.stringify({
      summary: report.summary,
      globalBaseline: report.globalBaseline,
      packetSummary: report.packetSummary || null,
      topPriors: top,
    }, null, 2));
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
