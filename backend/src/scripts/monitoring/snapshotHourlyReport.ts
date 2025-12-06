#!/usr/bin/env ts-node

/**
 * Snapshot Hourly Report
 *
 * Compares today vs prior N days at the same snapshot time, by hour,
 * using pre-materialized hourly_snapshot_metrics.
 *
 * Initial version:
 * - Hard-codes rsoc_site = 'wesoughtit.com'
 * - media_source IN ('mediago', 'facebook')
 * - Compares today vs prior 3 days
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
  return snap || null;
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
        today_pst - INTERVAL d DAY AS day_pst,
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

  return rows.map((r) => r.snapshot_pst);
}

async function main(): Promise<void> {
  const conn = createMonitoringConnection();

  try {
    await initMonitoringSchema(conn);

    const asOfFlag = process.argv.find((arg) => arg.startsWith('--as-of='));
    const asOfIso = asOfFlag ? asOfFlag.split('=')[1] : undefined;

    const site = DEFAULT_SITE;
    const days = DEFAULT_DAYS;
    const mediaSources = DEFAULT_MEDIA_SOURCES;

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
    console.log(`Current snapshot_pst: ${currentSnapshot}`);
    console.log(`Comparing snapshots:`);
    snapshots.forEach((s) => console.log(`  - ${s}`));
    console.log('');

    const snapshotList = snapshots.map((s) => sqlString(s)).join(', ');
    const mediaSourceFilter = mediaSources
      .map((m) => sqlString(m))
      .join(', ');

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
        sessions,
        revenue,
        rpc
      FROM hourly_snapshot_metrics
      WHERE snapshot_pst IN (${snapshotList})
        AND rsoc_site = ${sqlString(site)}
        AND media_source IN (${mediaSourceFilter})
      ORDER BY snapshot_pst, day_pst, hour_pst, media_source, category, owner
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

      for (const key of sortedKeys) {
        const hourRows = byDayHour[key];
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

        console.log(
          `- ${key} | sessions=${totalSessions.toFixed(
            0
          )} | revenue=$${totalRevenue.toFixed(2)} | rpc=$${rpc.toFixed(4)}`
        );
      }
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


