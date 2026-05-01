#!/usr/bin/env ts-node

/**
 * Query campaign launches over a date range, grouped by buyer/owner.
 *
 * "Launched" here means: the campaign was first observed in our `campaign_index`
 * ingestion pipeline and recorded into `campaign_launches.first_seen_date`.
 *
 * Usage:
 *   npm run monitor:range-launches -- --start=2025-12-18 --end=2025-12-31
 *
 * Notes:
 * - Date strings are treated as the same convention used by the ingestion cron
 *   (typically UTC via `date -u +%Y-%m-%d` on the server).
 * - This script reads from DuckDB at MONITORING_DB_PATH (defaults to ./data/monitoring.duckdb).
 */

import 'dotenv/config';
import { allRows, closeConnection, createMonitoringConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

function getFlagList(name: string): string[] | undefined {
  const value = getFlag(name);
  if (!value) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function requireDateFlag(name: string): string {
  const value = getFlag(name);
  if (!value) {
    throw new Error(`Missing required flag --${name}=YYYY-MM-DD`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date for --${name}: ${value} (expected YYYY-MM-DD)`);
  }
  return value;
}

async function main(): Promise<void> {
  const start = requireDateFlag('start');
  const end = requireDateFlag('end');
  const mediaSources = getFlagList('media-sources');
  const mediaSourceFilter =
    mediaSources && mediaSources.length > 0
      ? `AND COALESCE(NULLIF(cl.media_source,''), 'UNKNOWN') IN (${mediaSources
          .map((s) => `'${s.replace(/'/g, "''")}'`)
          .join(', ')})`
      : '';

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);

    console.log(`\n# Campaign launches (first-seen)`);
    console.log(`Range: ${start} → ${end}\n`);
    if (mediaSources && mediaSources.length > 0) {
      console.log(`Media sources: ${mediaSources.join(', ')}\n`);
    }

    const totals = await allRows<any>(
      conn,
      `
      SELECT
        COUNT(*) AS campaigns,
        COUNT(DISTINCT COALESCE(NULLIF(owner,''), 'UNKNOWN')) AS owners,
        COUNT(DISTINCT COALESCE(NULLIF(media_source,''), 'UNKNOWN')) AS media_sources,
        SUM(CASE WHEN owner IS NULL OR owner = '' OR owner = 'UNKNOWN' THEN 1 ELSE 0 END) AS unknown_owner_campaigns
      FROM campaign_launches cl
      WHERE first_seen_date BETWEEN DATE '${start}' AND DATE '${end}'
      ${mediaSourceFilter}
      `
    );

    const t = totals[0] || {};
    console.log(`Total campaigns: ${Number(t.campaigns || 0)}`);
    console.log(`Distinct owners: ${Number(t.owners || 0)} (unknown owner campaigns: ${Number(t.unknown_owner_campaigns || 0)})`);
    console.log(`Distinct media sources: ${Number(t.media_sources || 0)}\n`);

    const byOwner = await allRows<any>(
      conn,
      `
      SELECT
        COALESCE(NULLIF(owner,''), 'UNKNOWN') AS owner,
        COUNT(*) AS campaigns
      FROM campaign_launches cl
      WHERE first_seen_date BETWEEN DATE '${start}' AND DATE '${end}'
      ${mediaSourceFilter}
      GROUP BY 1
      ORDER BY campaigns DESC, owner ASC
      `
    );

    console.log('## By buyer/owner');
    for (const row of byOwner) {
      console.log(`- ${row.owner}: ${Number(row.campaigns || 0)}`);
    }

    const byDay = await allRows<any>(
      conn,
      `
      SELECT
        first_seen_date,
        COUNT(*) AS campaigns
      FROM campaign_launches cl
      WHERE first_seen_date BETWEEN DATE '${start}' AND DATE '${end}'
      ${mediaSourceFilter}
      GROUP BY 1
      ORDER BY first_seen_date ASC
      `
    );

    console.log('\n## By day');
    for (const row of byDay) {
      const day = String(row.first_seen_date).slice(0, 10);
      console.log(`- ${day}: ${Number(row.campaigns || 0)}`);
    }

    // Optional enrichment: site/account from campaign_index on the same first_seen_date
    const topCombos = await allRows<any>(
      conn,
      `
      SELECT
        COALESCE(NULLIF(cl.owner,''), 'UNKNOWN') AS owner,
        COALESCE(NULLIF(cl.media_source,''), 'UNKNOWN') AS media_source,
        COALESCE(ci.rsoc_site, 'N/A') AS rsoc_site,
        COALESCE(ci.s1_google_account, 'N/A') AS s1_google_account,
        COUNT(*) AS campaigns
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci
        ON ci.campaign_id = cl.campaign_id
       AND ci.date = cl.first_seen_date
      WHERE cl.first_seen_date BETWEEN DATE '${start}' AND DATE '${end}'
      ${mediaSourceFilter}
      GROUP BY 1,2,3,4
      ORDER BY campaigns DESC, owner ASC
      LIMIT 25
      `
    );

    if (topCombos.length > 0) {
      console.log('\n## Top 25 owner × network × site combos');
      for (const row of topCombos) {
        console.log(
          `- ${row.owner} → ${row.media_source} → ${row.rsoc_site} (${row.s1_google_account}): ${Number(row.campaigns || 0)}`
        );
      }
    }

    console.log('');
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});


