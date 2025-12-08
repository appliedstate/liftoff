#!/usr/bin/env ts-node

/**
 * Snapshot Hourly Report
 *
 * Compares today vs prior N days at the same snapshot time, by hour,
 * using pre-materialized hourly_snapshot_metrics.
 *
 * Usage:
 *   npm run monitor:snapshot-report
 *   npm run monitor:snapshot-report -- --site=wesoughtit.com --days=3
 *   npm run monitor:snapshot-report -- --campaign-id=123456789
 *   npm run monitor:snapshot-report -- --adset-id=987654321
 *   npm run monitor:snapshot-report -- --owner=John --category=beauty
 *   npm run monitor:snapshot-report -- --media-source=mediago,facebook
 *   npm run monitor:snapshot-report -- --as-of=2025-12-08T12:00:00Z
 *
 * Filters:
 *   --site=<site>              Filter by rsoc_site (default: wesoughtit.com)
 *   --days=<n>                 Number of days to compare (default: 3)
 *   --media-source=<sources>   Comma-separated media sources (default: mediago,facebook)
 *   --campaign-id=<id>         Filter by campaign_id
 *   --campaign-name=<name>     Filter by campaign_name
 *   --adset-id=<id>            Filter by adset_id
 *   --adset-name=<name>        Filter by adset_name
 *   --owner=<owner>            Filter by owner
 *   --category=<category>      Filter by category
 *   --lane=<lane>              Filter by lane
 *   --level=<level>            Filter by level (campaign/adset)
 *   --as-of=<iso-timestamp>     Use snapshot as of specific time (default: latest)
 */

import 'dotenv/config';
import {
  allRows,
  closeConnection,
  createMonitoringConnection,
  sqlString,
} from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

const DEFAULT_SITE = 'wesoughtit.com';
const DEFAULT_DAYS = 3;
const DEFAULT_MEDIA_SOURCES = ['mediago', 'facebook'];

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

function getFlagList(name: string): string[] | undefined {
  const value = getFlag(name);
  if (!value) return undefined;
  return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

async function getCurrentSnapshot(conn: any, asOfIso?: string): Promise<string | null> {
  const asOfExpr = asOfIso
    ? `${sqlString(asOfIso)}::TIMESTAMP`
    : 'now() - INTERVAL 8 HOUR'; // treat as PST "now"

  const rows = await allRows<{ current_snapshot: string }>(
    conn,
    `
    SELECT max(snapshot_pst) AS current_snapshot
    FROM hourly_snapshot_metrics
    WHERE snapshot_pst <= ${asOfExpr}
  `
  );

  const snap = rows[0]?.current_snapshot;
  // Convert DuckDB timestamp to ISO string if it's a Date object
  if (!snap) return null;
  const snapDate = new Date(snap);
  return snapDate.toISOString();
}

async function getMatchingSnapshots(
  conn: any,
  currentSnapshotPst: string,
  days: number
): Promise<string[]> {
  // We look for, for each day d = 0..days-1, the latest snapshot for that PST day
  // whose local time-of-day is <= current snapshot's local time-of-day.
  const rows = await allRows<{ snapshot_pst: string }>(
    conn,
    `
    WITH current AS (
      SELECT
        ${sqlString(currentSnapshotPst)}::TIMESTAMP AS snapshot_pst,
        ( ${sqlString(currentSnapshotPst)}::TIMESTAMP - INTERVAL 8 HOUR ) AS snapshot_pst_local
    ),
    current_parts AS (
      SELECT
        snapshot_pst,
        date_trunc('day', snapshot_pst_local) AS today_pst,
        extract(hour FROM snapshot_pst_local) AS snap_hour,
        extract(minute FROM snapshot_pst_local) AS snap_minute
      FROM current
    ),
    days AS (
      SELECT
        today_pst - d.generate_series * INTERVAL 1 DAY AS day_pst,
        snap_hour,
        snap_minute
      FROM current_parts,
      generate_series(0, ${days - 1}) AS d
    ),
    candidates AS (
      SELECT
        h.snapshot_pst,
        d.day_pst,
        (h.snapshot_pst - INTERVAL 8 HOUR) AS local_ts,
        date_trunc('day', h.snapshot_pst - INTERVAL 8 HOUR) AS local_day,
        extract(hour FROM h.snapshot_pst - INTERVAL 8 HOUR) AS local_hour,
        extract(minute FROM h.snapshot_pst - INTERVAL 8 HOUR) AS local_minute
      FROM hourly_snapshot_metrics h
      JOIN days d
        ON date_trunc('day', h.snapshot_pst - INTERVAL 8 HOUR) = d.day_pst
    ),
    filtered AS (
      SELECT
        c.snapshot_pst,
        c.day_pst,
        c.local_ts
      FROM candidates c
      JOIN current_parts cp ON TRUE
      WHERE
        -- Only include snapshots up to the same local time-of-day
        (
          extract(hour FROM c.local_ts) < cp.snap_hour OR
          (extract(hour FROM c.local_ts) = cp.snap_hour AND extract(minute FROM c.local_ts) <= cp.snap_minute)
        )
    ),
    ranked AS (
      SELECT
        snapshot_pst,
        day_pst,
        row_number() OVER (PARTITION BY day_pst ORDER BY local_ts DESC) AS rn
      FROM filtered
    )
    SELECT snapshot_pst
    FROM ranked
    WHERE rn = 1
    ORDER BY day_pst DESC
  `
  );

  return rows.map((r) => {
    const snap = r.snapshot_pst;
    if (!snap) return null;
    const snapDate = new Date(snap);
    return snapDate.toISOString();
  }).filter((s): s is string => s !== null);
}

async function main(): Promise<void> {
  const conn = createMonitoringConnection();

  try {
    await initMonitoringSchema(conn);

    const asOfIso = getFlag('as-of');
    const site = getFlag('site') || DEFAULT_SITE;
    const days = parseInt(getFlag('days') || String(DEFAULT_DAYS), 10);
    const mediaSources = getFlagList('media-source') || DEFAULT_MEDIA_SOURCES;
    
    // Optional filters for drilling down
    const campaignId = getFlag('campaign-id');
    const campaignName = getFlag('campaign-name');
    const adsetId = getFlag('adset-id');
    const adsetName = getFlag('adset-name');
    const owner = getFlag('owner');
    const category = getFlag('category');
    const lane = getFlag('lane');
    const level = getFlag('level');

    const currentSnapshot = await getCurrentSnapshot(conn, asOfIso);
    if (!currentSnapshot) {
      console.log('No snapshots available in hourly_snapshot_metrics.');
      return;
    }

    const snapshots = await getMatchingSnapshots(conn, currentSnapshot, days);
    if (!snapshots.length) {
      console.log('No matching snapshots found for requested window.');
      return;
    }

    console.log(`\n# Hourly Snapshot Report`);
    console.log(`Site: ${site}`);
    console.log(`Media Sources: ${mediaSources.join(', ')}`);
    console.log(`Days (including today): ${days}`);
    if (campaignId) console.log(`Campaign ID: ${campaignId}`);
    if (campaignName) console.log(`Campaign Name: ${campaignName}`);
    if (adsetId) console.log(`Ad Set ID: ${adsetId}`);
    if (adsetName) console.log(`Ad Set Name: ${adsetName}`);
    if (owner) console.log(`Owner: ${owner}`);
    if (category) console.log(`Category: ${category}`);
    if (lane) console.log(`Lane: ${lane}`);
    if (level) console.log(`Level: ${level}`);
    console.log(`Current snapshot_pst: ${currentSnapshot}`);
    console.log(`Comparing snapshots:`);
    snapshots.forEach((s) => console.log(`  - ${s}`));
    console.log('');

    const snapshotList = snapshots.map((s) => sqlString(s)).join(', ');
    const mediaSourceFilter = mediaSources
      .map((m) => sqlString(m))
      .join(', ');

    // Build WHERE clause with optional filters
    const whereConditions: string[] = [
      `snapshot_pst IN (${snapshotList})`,
      `rsoc_site = ${sqlString(site)}`,
      `media_source IN (${mediaSourceFilter})`,
    ];

    if (campaignId) {
      whereConditions.push(`campaign_id = ${sqlString(campaignId)}`);
    }
    if (campaignName) {
      whereConditions.push(`campaign_name = ${sqlString(campaignName)}`);
    }
    if (adsetId) {
      whereConditions.push(`adset_id = ${sqlString(adsetId)}`);
    }
    if (adsetName) {
      whereConditions.push(`adset_name = ${sqlString(adsetName)}`);
    }
    if (owner) {
      whereConditions.push(`owner = ${sqlString(owner)}`);
    }
    if (category) {
      whereConditions.push(`category = ${sqlString(category)}`);
    }
    if (lane) {
      whereConditions.push(`lane = ${sqlString(lane)}`);
    }
    if (level) {
      whereConditions.push(`level = ${sqlString(level)}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const rows = await allRows<any>(
      conn,
      `
      SELECT
        snapshot_pst,
        day_pst,
        hour_pst,
        media_source,
        rsoc_site,
        owner,
        category,
        lane,
        level,
        campaign_id,
        campaign_name,
        adset_id,
        adset_name,
        sessions,
        revenue,
        rpc
      FROM hourly_snapshot_metrics
      WHERE ${whereClause}
      ORDER BY snapshot_pst, day_pst, hour_pst, media_source, category, owner, campaign_id, adset_id
    `
    );

    if (!rows.length) {
      console.log('No snapshot metrics found for the selected criteria.');
      return;
    }

    // Group rows by snapshot and then by hour for display
    const bySnapshot: Record<string, any[]> = {};
    for (const row of rows) {
      const key = row.snapshot_pst;
      if (!bySnapshot[key]) bySnapshot[key] = [];
      bySnapshot[key].push(row);
    }

    // Display by snapshot, showing cumulative totals per day
    for (const [snapshot, snapshotRows] of Object.entries(bySnapshot)) {
      console.log(`\n## Snapshot: ${snapshot}`);

      // Group by day_pst and hour_pst
      const byDayHour: Record<string, any[]> = {};
      for (const r of snapshotRows) {
        const key = `${r.day_pst} ${String(r.hour_pst).padStart(2, '0')}:00`;
        if (!byDayHour[key]) byDayHour[key] = [];
        byDayHour[key].push(r);
      }

      const sortedKeys = Object.keys(byDayHour).sort();

      // Track cumulative totals per day
      const cumulativeByDay: Record<string, { sessions: number; revenue: number }> = {};

      for (const key of sortedKeys) {
        const hourRows = byDayHour[key];
        const dayPst = hourRows[0].day_pst;
        const hourPst = hourRows[0].hour_pst;

        const totalSessions = hourRows.reduce(
          (sum, r) => sum + Number(r.sessions || 0),
          0
        );
        const totalRevenue = hourRows.reduce(
          (sum, r) => sum + Number(r.revenue || 0),
          0
        );
        const rpc =
          totalSessions > 0 ? totalRevenue / totalSessions : 0;

        // Update cumulative totals
        if (!cumulativeByDay[dayPst]) {
          cumulativeByDay[dayPst] = { sessions: 0, revenue: 0 };
        }
        cumulativeByDay[dayPst].sessions += totalSessions;
        cumulativeByDay[dayPst].revenue += totalRevenue;

        const cumRpc =
          cumulativeByDay[dayPst].sessions > 0
            ? cumulativeByDay[dayPst].revenue / cumulativeByDay[dayPst].sessions
            : 0;

        console.log(
          `- ${key} | sessions=${totalSessions.toFixed(
            0
          )} | revenue=$${totalRevenue.toFixed(2)} | rpc=$${rpc.toFixed(4)} | cum_sessions=${cumulativeByDay[dayPst].sessions.toFixed(
            0
          )} | cum_revenue=$${cumulativeByDay[dayPst].revenue.toFixed(2)} | cum_rpc=$${cumRpc.toFixed(4)}`
        );
      }
    }

    // Add day-to-day comparison summary
    // For each snapshot, compute cumulative totals for each day up to the snapshot hour
    console.log(`\n## Day-to-Day Cumulative Comparison (at snapshot time)`);
    const dayTotals: Array<{ day: string; sessions: number; revenue: number; rpc: number }> = [];
    
    // Get the current snapshot (most recent)
    const currentSnapshotKey = snapshots[0];
    const currentSnapshotRows = bySnapshot[currentSnapshotKey];
    
    if (currentSnapshotRows && currentSnapshotRows.length > 0) {
      // Get unique days in this snapshot
      const uniqueDays = Array.from(
        new Set(currentSnapshotRows.map((r) => String(r.day_pst)))
      ).sort();

      // Get the snapshot day (most recent day) and its maximum hour
      const snapshotDay = uniqueDays[uniqueDays.length - 1]; // Most recent day
      const snapshotDayRows = currentSnapshotRows.filter(
        (r) => String(r.day_pst) === snapshotDay
      );
      const maxHourPst = Math.max(
        ...snapshotDayRows.map((r) => Number(r.hour_pst))
      );

      // For each day, compute cumulative totals up to the snapshot hour
      for (const day of uniqueDays) {
        const dayRows = currentSnapshotRows
          .filter((r) => String(r.day_pst) === day)
          .sort((a, b) => Number(a.hour_pst) - Number(b.hour_pst));

        // Only include hours up to the snapshot hour (in PST)
        const filteredDayRows = dayRows.filter((r) => Number(r.hour_pst) <= maxHourPst);

        let cumSessions = 0;
        let cumRevenue = 0;
        for (const r of filteredDayRows) {
          cumSessions += Number(r.sessions || 0);
          cumRevenue += Number(r.revenue || 0);
        }

        const rpc = cumSessions > 0 ? cumRevenue / cumSessions : 0;
        dayTotals.push({
          day,
          sessions: cumSessions,
          revenue: cumRevenue,
          rpc,
        });
      }
    }

    // Sort by day descending (most recent first)
    dayTotals.sort((a, b) => b.day.localeCompare(a.day));

    if (dayTotals.length > 0) {
      for (const totals of dayTotals) {
        console.log(
          `- ${totals.day} | cum_sessions=${totals.sessions.toFixed(
            0
          )} | cum_revenue=$${totals.revenue.toFixed(2)} | cum_rpc=$${totals.rpc.toFixed(4)}`
        );
      }
    } else {
      console.log('(No day-to-day comparison data available)');
    }

    console.log('\n');
  } catch (err: any) {
    console.error('Error running snapshot report:', err?.message || err);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Fatal error in snapshotHourlyReport:', err);
  process.exit(1);
});


