#!/usr/bin/env ts-node

/**
 * Snapshot hourly session metrics into a PST-aligned snapshot table.
 *
 * At a given snapshot_pst time, we materialize hourly aggregates over a trailing
 * window of PST business days, only including hours whose ts_pst <= snapshot_pst.
 *
 * This enables "today vs prior N days at the same wall-clock time" reporting.
 */

import 'dotenv/config';
import {
  allRows,
  closeConnection,
  createMonitoringConnection,
  runSql,
  sqlString,
} from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

// Default trailing window in days (inclusive of today_pst)
const DEFAULT_TRAILING_DAYS = 3;

async function getSnapshotTiming(conn: any, overrideIso?: string): Promise<{
  snapshotPst: string;
  todayPst: string;
  trailingStartPst: string;
  trailingEndPst: string;
}> {
  let snapshotExpr: string;
  if (overrideIso) {
    // Treat override as PST timestamp
    snapshotExpr = `${sqlString(overrideIso)}::TIMESTAMP`;
  } else {
    // Compute snapshot time as "now in PST" by subtracting 8 hours from UTC now
    snapshotExpr = `now() - INTERVAL 8 HOUR`;
  }

  const rows = await allRows<{
    snapshot_pst: string;
    today_pst: string;
    trailing_start_pst: string;
    trailing_end_pst: string;
  }>(
    conn,
    `
    WITH params AS (
      SELECT
        ${snapshotExpr} AS snapshot_pst,
        date_trunc('day', ${snapshotExpr}) AS today_pst
    ),
    window AS (
      SELECT
        snapshot_pst,
        today_pst,
        date_trunc('day', today_pst - INTERVAL ${DEFAULT_TRAILING_DAYS} DAY) AS trailing_start_pst,
        today_pst AS trailing_end_pst
      FROM params
    )
    SELECT
      snapshot_pst,
      today_pst,
      trailing_start_pst,
      trailing_end_pst
    FROM window
  `
  );

  if (!rows.length) {
    throw new Error('Failed to compute snapshot timing');
  }

  const row = rows[0] as any;
  return {
    snapshotPst: row.snapshot_pst,
    todayPst: row.today_pst,
    trailingStartPst: row.trailing_start_pst,
    trailingEndPst: row.trailing_end_pst,
  };
}

async function runSnapshot(): Promise<void> {
  const conn = createMonitoringConnection();

  // Optional override for testing: ISO timestamp interpreted as PST
  const overrideAsOf = process.env.SNAPSHOT_AS_OF_PST || undefined;

  try {
    await initMonitoringSchema(conn);

    const {
      snapshotPst,
      trailingStartPst,
      trailingEndPst,
    } = await getSnapshotTiming(conn, overrideAsOf);

    console.log(`\n# Hourly Snapshot Metrics`);
    console.log(`Snapshot PST: ${snapshotPst}`);
    console.log(`Window PST: ${trailingStartPst} → ${trailingEndPst}\n`);

    const snapshotLiteral = `${sqlString(snapshotPst)}::TIMESTAMP`;

    // Idempotency: clear any existing rows for this snapshot
    await runSql(
      conn,
      `
      DELETE FROM hourly_snapshot_metrics
      WHERE snapshot_pst = ${snapshotLiteral};
    `
    );

    // Core aggregation: join hourly sessions with campaign_index (including ad set fields),
    // stamp PST time, filter to trailing window and ts_pst <= snapshot_pst, then aggregate.
    const insertSql = `
      INSERT INTO hourly_snapshot_metrics (
        snapshot_pst,
        day_pst,
        hour_pst,
        media_source,
        rsoc_site,
        owner,
        lane,
        category,
        level,
        campaign_id,
        campaign_name,
        adset_id,
        adset_name,
        sessions,
        revenue,
        clicks,
        conversions,
        rpc
      )
      WITH hourly AS (
        SELECT
          shm.date,
          shm.campaign_id,
          shm.click_hour,
          shm.sessions,
          shm.revenue,
          shm.rpc,
          shm.owner,
          shm.lane,
          shm.category,
          shm.media_source,
          ci.rsoc_site,
          ci.level,
          ci.campaign_id AS ci_campaign_id,
          ci.campaign_name,
          ci.adset_id,
          ci.adset_name,
          -- Click timestamp in UTC: date + click_hour
          shm.date + shm.click_hour * INTERVAL 1 HOUR AS ts_utc,
          -- PST timestamp: UTC minus 8 hours
          (shm.date + shm.click_hour * INTERVAL 1 HOUR - INTERVAL 8 HOUR) AS ts_pst
        FROM session_hourly_metrics shm
        LEFT JOIN campaign_index ci
          ON ci.campaign_id = shm.campaign_id
         AND ci.date = shm.date
        WHERE shm.media_source IS NOT NULL
      ),
      stamped AS (
        SELECT
          *,
          date_trunc('day', ts_pst) AS day_pst,
          CAST(extract(hour FROM ts_pst) AS INTEGER) AS hour_pst
        FROM hourly
      ),
      params AS (
        SELECT
          ${snapshotLiteral} AS snapshot_pst
      ),
      window AS (
        SELECT
          snapshot_pst,
          date_trunc('day', snapshot_pst) - INTERVAL ${DEFAULT_TRAILING_DAYS} DAY AS start_day_pst,
          date_trunc('day', snapshot_pst) AS end_day_pst
        FROM params
      ),
      filtered AS (
        SELECT s.*
        FROM stamped s, window w
        WHERE s.day_pst BETWEEN w.start_day_pst AND w.end_day_pst
          AND s.ts_pst <= w.snapshot_pst
      )
      SELECT
        w.snapshot_pst AS snapshot_pst,
        f.day_pst,
        f.hour_pst,
        f.media_source,
        f.rsoc_site,
        f.owner,
        f.lane,
        f.category,
        f.level,
        COALESCE(f.ci_campaign_id, f.campaign_id) AS campaign_id,
        f.campaign_name,
        f.adset_id,
        f.adset_name,
        SUM(f.sessions)    AS sessions,
        SUM(f.revenue)     AS revenue,
        NULL               AS clicks,
        NULL               AS conversions,
        CASE
          WHEN SUM(f.sessions) > 0 THEN SUM(f.revenue) / SUM(f.sessions)
          ELSE 0
        END AS rpc
      FROM filtered f, window w
      GROUP BY
        w.snapshot_pst,
        f.day_pst,
        f.hour_pst,
        f.media_source,
        f.rsoc_site,
        f.owner,
        f.lane,
        f.category,
        f.level,
        COALESCE(f.ci_campaign_id, f.campaign_id),
        f.campaign_name,
        f.adset_id,
        f.adset_name
    `;

    await runSql(conn, insertSql);

    // Run-log entry
    const countRows = await allRows<{ row_count: number }>(
      conn,
      `
      SELECT COUNT(*) AS row_count
      FROM hourly_snapshot_metrics
      WHERE snapshot_pst = ${snapshotLiteral}
    `
    );

    const rowCount = Number(countRows[0]?.row_count || 0);

    await runSql(
      conn,
      `
      INSERT OR REPLACE INTO hourly_snapshot_runs (
        snapshot_pst,
        row_count,
        from_day_pst,
        to_day_pst,
        status,
        message
      )
      VALUES (
        ${snapshotLiteral},
        ${rowCount},
        date_trunc('day', ${sqlString(trailingStartPst)}::TIMESTAMP),
        date_trunc('day', ${sqlString(trailingEndPst)}::TIMESTAMP),
        'success',
        'ok'
      )
    `
    );

    console.log(`Inserted ${rowCount} rows into hourly_snapshot_metrics.`);
  } catch (err: any) {
    console.error('Error running snapshot:', err?.message || err);

    try {
      // Best-effort failure log using current time in PST
      await runSql(
        conn,
        `
        INSERT OR REPLACE INTO hourly_snapshot_runs (
          snapshot_pst,
          row_count,
          from_day_pst,
          to_day_pst,
          status,
          message
        )
        VALUES (
          now() - INTERVAL 8 HOUR,
          NULL,
          NULL,
          NULL,
          'failed',
          ${sqlString(err?.message || String(err))}
        )
      `
      );
    } catch (logErr) {
      console.error('Additionally failed to log snapshot failure:', logErr);
    }

    process.exitCode = 1;
  } finally {
    closeConnection(conn);
  }
}

runSnapshot().catch((err) => {
  console.error('Fatal error in snapshotHourlyMetrics:', err);
  process.exit(1);
});


