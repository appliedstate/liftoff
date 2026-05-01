#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { closeConnection, createMonitoringConnection, initMonitoringSchema } from '../../lib/monitoringDb';
import { clearIntentPacketObservationsBySource, recordIntentPacketObservations } from '../../lib/intentPacketLearning';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(flag)) return arg.slice(flag.length);
  }
  return def;
}

function normalizeKeyword(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildAnchorTokenSets(anchorKeywords: string[]): Array<Set<string>> {
  return anchorKeywords.map((keyword) => new Set(normalizeKeyword(keyword).split(/\s+/).filter((token) => token.length >= 2)));
}

function matchesAnchors(keyword: string, anchors: Array<Set<string>>): boolean {
  if (!anchors.length) return true;
  const tokens = new Set(normalizeKeyword(keyword).split(/\s+/).filter((token) => token.length >= 2));
  return anchors.some((anchor) => {
    let matches = 0;
    for (const token of anchor) {
      if (tokens.has(token)) matches += 1;
    }
    return matches >= Math.min(2, Math.max(1, anchor.size));
  });
}

async function main() {
  const rawDir = path.resolve(process.cwd(), getArg('raw-dir', '.local/strategis/s1/keywords/raw') || '.local/strategis/s1/keywords/raw');
  const startDate = getArg('start-date') || null;
  const endDate = getArg('end-date') || null;
  const anchors = (getArg('anchors') || '')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
  const source = getArg('source', 's1_raw_keyword_cache') || 's1_raw_keyword_cache';
  const replace = (getArg('replace', 'true') || 'true').toLowerCase() !== 'false';
  const anchorTokenSets = buildAnchorTokenSets(anchors);

  const files = fs.readdirSync(rawDir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => {
      const date = file.replace('.json', '');
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    })
    .sort();

  const observations: Array<any> = [];
  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const observedAt = `${payload.date || file.replace('.json', '')}T12:00:00.000Z`;
    for (const row of rows) {
      const keyword = String(row.keyword || '').trim();
      if (!keyword) continue;
      if (!matchesAnchors(keyword, anchorTokenSets)) continue;
      observations.push({
        observedAt,
        source,
        primaryKeyword: keyword,
        searches: Number(row.searches || 0),
        monetizedClicks: Number(row.clicks || 0),
        revenue: Number(row.estimated_revenue || row.revenue || 0),
        metadata: {
          strategisCampaignId: row.strategisCampaignId || null,
          widgetSearches: Number(row.widgetSearches || row.widget_searches || 0),
        },
      });
    }
  }

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    if (replace) {
      await clearIntentPacketObservationsBySource(conn, source, startDate, endDate);
    }
    const batchSize = 500;
    let inserted = 0;
    for (let index = 0; index < observations.length; index += batchSize) {
      const chunk = observations.slice(index, index + batchSize);
      const result = await recordIntentPacketObservations(conn, chunk);
      inserted += result.inserted;
    }
    console.log(JSON.stringify({
      source,
      rawDir,
      filesScanned: files.length,
      anchors,
      inserted,
      startDate,
      endDate,
    }, null, 2));
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
