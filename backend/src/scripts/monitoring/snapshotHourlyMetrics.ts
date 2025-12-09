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
const PST_OFFSET_MS = 8 * 60 * 60 * 1000;

async function getSnapshotTiming(
  _conn: any,
  overrideIso?: string
): Promise<{
  snapshotPst: string;
  todayPst: string;
  trailingStartPst: string;
  trailingEndPst: string;
}> {
  // Snapshot time: We want the current UTC time, but we'll treat it as if it represents PST
  // The snapshot_pst timestamp should be UTC, but represents the PST wall-clock time
  // So if it's 6:32 PM UTC (10:32 AM PST), we store 6:32 PM UTC but interpret it as 10:32 AM PST
  let snapshotUtcDate: Date;
  if (overrideIso) {
    snapshotUtcDate = new Date(overrideIso);
  } else {
    snapshotUtcDate = new Date(); // Current UTC time
  }

  // Helper: Convert UTC date to PST date string (YYYY-MM-DD)
  const toPstDateOnly = (utcDate: Date): string => {
    // Convert UTC to PST by subtracting 8 hours
    const pstDate = new Date(utcDate.getTime() - PST_OFFSET_MS);
    const y = pstDate.getUTCFullYear();
    const m = String(pstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(pstDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayPst = toPstDateOnly(snapshotUtcDate);

  const trailingStart = new Date(
    snapshotUtcDate.getTime() - DEFAULT_TRAILING_DAYS * 24 * 60 * 60 * 1000
  );
  const trailingStartPst = toPstDateOnly(trailingStart);

  // Store UTC timestamp - DuckDB will compare ts_pst (which is UTC-8) to this UTC timestamp
  // So if snapshot is 18:32 UTC, and ts_pst is 10:32 PST (which is 18:32 UTC), they match
  const snapshotPstIso = snapshotUtcDate.toISOString();

  return {
    snapshotPst: snapshotPstIso,
    todayPst,
    trailingStartPst,
    trailingEndPst: todayPst,
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
    // Convert snapshot UTC to PST for display
    const snapshotPstDisplay = new Date(new Date(snapshotPst).getTime() - PST_OFFSET_MS);
    const pstHour = snapshotPstDisplay.getUTCHours();
    const pstMinute = snapshotPstDisplay.getUTCMinutes();
    console.log(`Snapshot UTC: ${snapshotPst} (PST: ${pstHour}:${String(pstMinute).padStart(2, '0')})`);
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
      console.log(`\nDEBUG: session_hourly_metrics table status:`);
      console.log(`  Total rows: ${stats.total_rows || 0}`);
      console.log(`  Unique campaigns: ${stats.unique_campaigns || 0}`);
      console.log(`  Date range: ${stats.earliest_date || 'N/A'} to ${stats.latest_date || 'N/A'}`);
      console.log(`  Unique dates: ${stats.unique_dates || 0}`);
      
      // Check for the specific campaign
      const campaignRows = await allRows<any>(conn, `
        SELECT COUNT(*) as row_count,
               COUNT(DISTINCT date) as date_count,
               SUM(sessions) as total_sessions,
               SUM(revenue) as total_revenue
        FROM session_hourly_metrics
        WHERE campaign_id = 'siqd18d06g4'
          AND media_source IS NOT NULL
      `);
      
      if (campaignRows.length > 0 && campaignRows[0].row_count > 0) {
        console.log(`\nDEBUG: Campaign siqd18d06g4 in session_hourly_metrics:`);
        console.log(`  Rows: ${campaignRows[0].row_count}`);
        console.log(`  Dates: ${campaignRows[0].date_count}`);
        console.log(`  Total sessions: ${campaignRows[0].total_sessions || 0}`);
        console.log(`  Total revenue: ${campaignRows[0].total_revenue || 0}`);
      } else {
        console.log(`\nDEBUG: Campaign siqd18d06g4 NOT found in session_hourly_metrics`);
        console.log(`  Checking what campaign IDs exist...`);
        const sampleCampaigns = await allRows<any>(conn, `
          SELECT DISTINCT campaign_id, COUNT(*) as row_count
          FROM session_hourly_metrics
          WHERE media_source IS NOT NULL
          GROUP BY campaign_id
          ORDER BY row_count DESC
          LIMIT 10
        `);
        console.log(`  Sample campaign IDs (top 10):`);
        sampleCampaigns.forEach((r: any) => {
          console.log(`    ${r.campaign_id}: ${r.row_count} rows`);
        });
      }
      
      // Check what click hours exist for Dec 8
      const clickHourRows = await allRows<any>(conn, `
        SELECT 
          click_hour,
          COUNT(*) as row_count,
          SUM(sessions) as total_sessions
        FROM session_hourly_metrics
        WHERE date = DATE '2025-12-08'
          AND media_source IS NOT NULL
        GROUP BY click_hour
        ORDER BY click_hour
      `);
      
      if (clickHourRows.length > 0) {
        const minHour = clickHourRows[0].click_hour;
        const maxHour = clickHourRows[clickHourRows.length - 1].click_hour;
        console.log(`\nDEBUG: Click hours in session_hourly_metrics for 2025-12-08:`);
        console.log(`  UTC click hours: ${minHour} to ${maxHour} (${clickHourRows.length} hours)`);
        console.log(`  PST hours (UTC-8): ${(minHour - 8 + 24) % 24} to ${(maxHour - 8 + 24) % 24}`);
        console.log(`  Snapshot was at: ${new Date(snapshotPst).toISOString()} (PST hour ${(new Date(snapshotPst).getUTCHours() - 8 + 24) % 24})`);
        
        // Show sample of hours
        if (clickHourRows.length <= 24) {
          clickHourRows.forEach((r: any) => {
            const pstHour = (r.click_hour - 8 + 24) % 24;
            console.log(`    UTC hour ${r.click_hour} (PST hour ${pstHour}): ${r.row_count} rows, ${r.total_sessions || 0} sessions`);
          });
        } else {
          console.log(`  (Showing first 10 and last 5 hours)`);
          clickHourRows.slice(0, 10).forEach((r: any) => {
            const pstHour = (r.click_hour - 8 + 24) % 24;
            console.log(`    UTC hour ${r.click_hour} (PST hour ${pstHour}): ${r.row_count} rows`);
          });
          console.log(`    ...`);
          clickHourRows.slice(-5).forEach((r: any) => {
            const pstHour = (r.click_hour - 8 + 24) % 24;
            console.log(`    UTC hour ${r.click_hour} (PST hour ${pstHour}): ${r.row_count} rows`);
          });
        }
      }
      
      // Check campaign_index
      const indexRows = await allRows<any>(conn, `
        SELECT COUNT(*) as total_rows,
               COUNT(DISTINCT campaign_id) as unique_campaigns
        FROM campaign_index
        WHERE date >= '2025-12-05' AND date <= '2025-12-08'
      `);
      console.log(`\nDEBUG: campaign_index table status (2025-12-05 to 2025-12-08):`);
      console.log(`  Total rows: ${indexRows[0]?.total_rows || 0}`);
      console.log(`  Unique campaigns: ${indexRows[0]?.unique_campaigns || 0}`);
    }

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
          shm.campaign_id AS fb_campaign_id, -- This is Facebook campaign ID from session data
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
          ci.campaign_id AS strategis_campaign_id, -- Strategis campaign ID from campaign_index
          ci.campaign_name,
          ci.adset_id,
          ci.adset_name,
          -- Click timestamp in UTC: date + click_hour
          shm.date + shm.click_hour * INTERVAL 1 HOUR AS ts_utc,
          -- PST timestamp: UTC minus 8 hours
          (shm.date + shm.click_hour * INTERVAL 1 HOUR - INTERVAL 8 HOUR) AS ts_pst
        FROM session_hourly_metrics shm
        LEFT JOIN campaign_index ci
          ON ci.facebook_campaign_id = shm.campaign_id  -- Join via Facebook campaign ID
         -- For UTC date N+1 (hours 0-7), join with PST day N (UTC date N)
         -- For UTC date N (hours 8-23), join with PST day N (UTC date N)
         -- So we join on the PST day, which is shm.date for hours 8-23, or shm.date - 1 day for hours 0-7
         AND ci.date = CASE 
           WHEN shm.click_hour < 8 THEN shm.date - INTERVAL 1 DAY  -- UTC hours 0-7 map to previous PST day
           ELSE shm.date  -- UTC hours 8-23 map to same PST day
         END
        WHERE shm.media_source IS NOT NULL
          -- Include UTC dates that could contribute to PST days in the window
          -- PST day N includes UTC dates N (hours 8-23) and N+1 (hours 0-7)
          -- So we need to include UTC dates from start_day_pst to end_day_pst+1
          AND shm.date >= (SELECT date_trunc('day', snapshot_pst - INTERVAL 8 HOUR) - INTERVAL ${DEFAULT_TRAILING_DAYS} DAY FROM params)
          AND shm.date <= (SELECT date_trunc('day', snapshot_pst - INTERVAL 8 HOUR) + INTERVAL 1 DAY FROM params)
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
      snap_window AS (
        SELECT
          snapshot_pst,
          -- Convert snapshot_pst (UTC) to PST for day calculation
          -- snapshot_pst is UTC timestamp representing PST wall-clock time
          -- To get PST day: subtract 8 hours, then truncate to day
          date_trunc('day', snapshot_pst - INTERVAL 8 HOUR) - INTERVAL ${DEFAULT_TRAILING_DAYS} DAY AS start_day_pst,
          date_trunc('day', snapshot_pst - INTERVAL 8 HOUR) AS end_day_pst
        FROM params
      ),
      filtered AS (
        SELECT s.*
        FROM stamped s, snap_window w
        WHERE s.day_pst BETWEEN w.start_day_pst AND w.end_day_pst
          -- Compare: ts_pst (PST-represented timestamp) <= snapshot_pst (UTC)
          -- ts_pst = UTC timestamp - 8 hours (represents PST wall-clock time)
          -- snapshot_pst = UTC timestamp (represents PST wall-clock time at UTC)
          -- To compare: convert snapshot_pst to PST-represented timestamp, OR convert ts_pst back to UTC
          -- Method: ts_pst + 8 hours = original UTC timestamp, compare with snapshot_pst (UTC)
          AND (s.ts_pst + INTERVAL 8 HOUR) <= w.snapshot_pst
      ),
      debug_filtered AS (
        SELECT 
          COUNT(*) as filtered_count,
          MIN(day_pst) as min_day,
          MAX(day_pst) as max_day,
          MIN(hour_pst) as min_hour,
          MAX(hour_pst) as max_hour,
          COUNT(DISTINCT day_pst) as unique_days
        FROM filtered
      )
      SELECT
        w.snapshot_pst AS snapshot_pst,
        f.day_pst,
        f.hour_pst,
        COALESCE(f.media_source, 'UNKNOWN') AS media_source,
        COALESCE(f.rsoc_site, 'UNKNOWN') AS rsoc_site,
        COALESCE(f.owner, 'UNKNOWN') AS owner,
        COALESCE(f.lane, 'UNKNOWN') AS lane,
        COALESCE(f.category, 'UNKNOWN') AS category,
        COALESCE(f.level, 'UNKNOWN') AS level,
        COALESCE(f.strategis_campaign_id, f.fb_campaign_id) AS campaign_id, -- Use Strategis ID if available, fallback to Facebook ID
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
        w.snapshot_pst,
        f.day_pst,
        f.hour_pst,
        COALESCE(f.media_source, 'UNKNOWN'),
        COALESCE(f.rsoc_site, 'UNKNOWN'),
        COALESCE(f.owner, 'UNKNOWN'),
        COALESCE(f.lane, 'UNKNOWN'),
        COALESCE(f.category, 'UNKNOWN'),
        COALESCE(f.level, 'UNKNOWN'),
        COALESCE(f.strategis_campaign_id, f.fb_campaign_id), -- Use Strategis ID if available, fallback to Facebook ID
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


