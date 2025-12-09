#!/usr/bin/env ts-node

/**
 * Snapshot hourly session metrics into a UTC-aligned snapshot table.
 *
 * At a given snapshot_utc time, we materialize hourly aggregates over a trailing
 * window of UTC days, only including hours whose ts_utc <= snapshot_utc.
 *
 * This enables "today vs prior N days at the same wall-clock time" reporting.
 * Note: Column names still use "_pst" suffix for backward compatibility, but values are UTC.
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

// Default trailing window in days (inclusive of today_utc)
const DEFAULT_TRAILING_DAYS = 3;

async function getSnapshotTiming(
  _conn: any,
  overrideIso?: string
): Promise<{
  snapshotUtc: string;
  todayUtc: string;
  trailingStartUtc: string;
  trailingEndUtc: string;
}> {
  let snapshotUtcDate: Date;
  if (overrideIso) {
    snapshotUtcDate = new Date(overrideIso);
  } else {
    snapshotUtcDate = new Date(); // Current UTC time
  }

  const todayUtc = snapshotUtcDate.toISOString().slice(0, 10); // YYYY-MM-DD

  const trailingStart = new Date(
    snapshotUtcDate.getTime() - DEFAULT_TRAILING_DAYS * 24 * 60 * 60 * 1000
  );
  const trailingStartUtc = trailingStart.toISOString().slice(0, 10);

  const snapshotUtcIso = snapshotUtcDate.toISOString();

  return {
    snapshotUtc: snapshotUtcIso,
    todayUtc,
    trailingStartUtc,
    trailingEndUtc: todayUtc,
  };
}

async function runSnapshot(): Promise<void> {
  const conn = createMonitoringConnection();

  // Optional override for testing: ISO timestamp in UTC
  const overrideAsOf = process.env.SNAPSHOT_AS_OF_UTC || undefined;

  try {
    await initMonitoringSchema(conn);

    const {
      snapshotUtc,
      trailingStartUtc,
      trailingEndUtc,
    } = await getSnapshotTiming(conn, overrideAsOf);

    console.log(`\n# Hourly Snapshot Metrics (UTC)`);
    const snapshotDate = new Date(snapshotUtc);
    const utcHour = snapshotDate.getUTCHours();
    const utcMinute = snapshotDate.getUTCMinutes();
    console.log(`Snapshot UTC: ${snapshotUtc} (hour ${utcHour}:${String(utcMinute).padStart(2, '0')})`);
    console.log(`Window UTC: ${trailingStartUtc} → ${trailingEndUtc}\n`);

    const snapshotLiteral = `${sqlString(snapshotUtc)}::TIMESTAMP`;

    // Idempotency: clear any existing rows for this snapshot
    await runSql(
      conn,
      `
      DELETE FROM hourly_snapshot_metrics
      WHERE snapshot_pst = ${snapshotLiteral};
    `
    );

    // Debug: Check if we have data in session_hourly_metrics
    const debugSessionRows = await allRows<any>(conn, `
      SELECT COUNT(*) as total_rows,
             COUNT(DISTINCT campaign_id) as unique_campaigns,
             MIN(date) as earliest_date,
             MAX(date) as latest_date,
             COUNT(DISTINCT date) as unique_dates
      FROM session_hourly_metrics
      WHERE media_source IS NOT NULL
    `);
    
    if (debugSessionRows.length > 0) {
      const stats = debugSessionRows[0];
      console.log(`DEBUG: session_hourly_metrics table status:`);
      console.log(`  Total rows: ${stats.total_rows || 0}`);
      console.log(`  Unique campaigns: ${stats.unique_campaigns || 0}`);
      console.log(`  Date range: ${stats.earliest_date || 'N/A'} to ${stats.latest_date || 'N/A'}`);
      console.log(`  Unique dates: ${stats.unique_dates || 0}`);
      
      // Check what click hours exist for the date range
      const clickHourRows = await allRows<any>(conn, `
        SELECT 
          date,
          click_hour,
          COUNT(*) as row_count,
          SUM(sessions) as total_sessions
        FROM session_hourly_metrics
        WHERE date >= DATE '${trailingStartUtc}'
          AND date <= DATE '${trailingEndUtc}'
          AND media_source IS NOT NULL
        GROUP BY date, click_hour
        ORDER BY date, click_hour
      `);
      
      if (clickHourRows.length > 0) {
        const dates = Array.from(new Set(clickHourRows.map((r: any) => r.date)));
        console.log(`\nDEBUG: Click hours available:`);
        console.log(`  UTC dates: ${dates.join(', ')}`);
        console.log(`  Total hour rows: ${clickHourRows.length}`);
        if (clickHourRows.length <= 50) {
          clickHourRows.forEach((r: any) => {
            console.log(`    ${r.date} hour ${r.click_hour}: ${r.row_count} rows, ${r.total_sessions || 0} sessions`);
          });
        }
      }
      
      // Check campaign_index
      const indexRows = await allRows<any>(conn, `
        SELECT COUNT(*) as total_rows,
               COUNT(DISTINCT campaign_id) as unique_campaigns
        FROM campaign_index
        WHERE date >= DATE '${trailingStartUtc}' AND date <= DATE '${trailingEndUtc}'
      `);
      console.log(`\nDEBUG: campaign_index table status:`);
      console.log(`  Total rows: ${indexRows[0]?.total_rows || 0}`);
      console.log(`  Unique campaigns: ${indexRows[0]?.unique_campaigns || 0}`);
    }

    // Core aggregation: join hourly sessions with campaign_index,
    // filter to trailing window and ts_utc <= snapshot_utc, then aggregate.
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
          shm.campaign_id AS fb_campaign_id,
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
          ci.campaign_id AS strategis_campaign_id,
          ci.campaign_name,
          ci.adset_id,
          ci.adset_name,
          -- UTC timestamp: date + click_hour
          shm.date + shm.click_hour * INTERVAL 1 HOUR AS ts_utc
        FROM session_hourly_metrics shm
        LEFT JOIN campaign_index ci
          ON ci.facebook_campaign_id = shm.campaign_id
         AND ci.date = shm.date
        WHERE shm.media_source IS NOT NULL
          AND shm.date >= DATE '${trailingStartUtc}'
          AND shm.date <= DATE '${trailingEndUtc}'
      ),
      stamped AS (
        SELECT
          *,
          date_trunc('day', ts_utc) AS day_utc,
          CAST(extract(hour FROM ts_utc) AS INTEGER) AS hour_utc
        FROM hourly
      ),
      params AS (
        SELECT
          ${snapshotLiteral} AS snapshot_utc
      ),
      snap_window AS (
        SELECT
          snapshot_utc,
          date_trunc('day', snapshot_utc) - INTERVAL ${DEFAULT_TRAILING_DAYS} DAY AS start_day_utc,
          date_trunc('day', snapshot_utc) AS end_day_utc
        FROM params
      ),
      filtered AS (
        SELECT s.*
        FROM stamped s, snap_window w
        WHERE s.day_utc BETWEEN w.start_day_utc AND w.end_day_utc
          AND s.ts_utc <= w.snapshot_utc
      )
      SELECT
        w.snapshot_utc AS snapshot_pst,
        f.day_utc AS day_pst,
        f.hour_utc AS hour_pst,
        COALESCE(f.media_source, 'UNKNOWN') AS media_source,
        COALESCE(f.rsoc_site, 'UNKNOWN') AS rsoc_site,
        COALESCE(f.owner, 'UNKNOWN') AS owner,
        COALESCE(f.lane, 'UNKNOWN') AS lane,
        COALESCE(f.category, 'UNKNOWN') AS category,
        COALESCE(f.level, 'UNKNOWN') AS level,
        COALESCE(f.strategis_campaign_id, f.fb_campaign_id) AS campaign_id,
        f.campaign_name,
        COALESCE(f.adset_id, 'UNKNOWN') AS adset_id,
        f.adset_name,
        SUM(f.sessions)    AS sessions,
        SUM(f.revenue)     AS revenue,
        NULL               AS clicks,
        NULL               AS conversions,
        CASE
          WHEN SUM(f.sessions) > 0 THEN SUM(f.revenue) / SUM(f.sessions)
          ELSE 0
        END AS rpc
      FROM filtered f, snap_window w
      GROUP BY
        w.snapshot_utc,
        f.day_utc,
        f.hour_utc,
        COALESCE(f.media_source, 'UNKNOWN'),
        COALESCE(f.rsoc_site, 'UNKNOWN'),
        COALESCE(f.owner, 'UNKNOWN'),
        COALESCE(f.lane, 'UNKNOWN'),
        COALESCE(f.category, 'UNKNOWN'),
        COALESCE(f.level, 'UNKNOWN'),
        COALESCE(f.strategis_campaign_id, f.fb_campaign_id),
        f.campaign_name,
        COALESCE(f.adset_id, 'UNKNOWN'),
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

    const rowCount = countRows[0]?.row_count || 0;
    console.log(`Inserted ${rowCount} rows into hourly_snapshot_metrics.`);

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
      ) VALUES (
        ${snapshotLiteral},
        ${rowCount},
        DATE '${trailingStartUtc}',
        DATE '${trailingEndUtc}',
        'success',
        NULL
      )
    `
    );

    console.log(`\nSnapshot completed successfully.`);
  } catch (err: any) {
    console.error(`Error running snapshot: ${err?.message || err}`);
    console.error(err?.stack);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

runSnapshot().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
