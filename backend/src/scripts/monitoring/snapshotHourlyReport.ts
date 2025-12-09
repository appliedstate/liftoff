#!/usr/bin/env ts-node

/**
 * Snapshot Hourly Report (UTC)
 *
 * Compares today vs prior N days at the same snapshot time, by hour,
 * using pre-materialized hourly_snapshot_metrics.
 * 
 * Note: All times and dates are in UTC. Column names use "_pst" suffix for
 * backward compatibility, but values are UTC.
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
 *   --site=<site>              Filter by rsoc_site
 *   --days=<n>                 Number of days to compare (default: 3)
 *   --media-source=<sources>   Comma-separated media sources
 *   --campaign-id=<id>         Filter by campaign_id
 *   --campaign-name=<name>     Filter by campaign_name
 *   --adset-id=<id>            Filter by adset_id
 *   --adset-name=<name>        Filter by adset_name
 *   --owner=<owner>            Filter by owner
 *   --category=<category>      Filter by category
 *   --lane=<lane>              Filter by lane
 *   --level=<level>            Filter by level (campaign/adset)
 *   --as-of=<iso-timestamp>     Use snapshot as of specific UTC time (default: latest)
 */

import 'dotenv/config';
import {
  allRows,
  closeConnection,
  createMonitoringConnection,
  sqlString,
} from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

const DEFAULT_DAYS = 3;

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
  // If asOfIso is provided, use it; otherwise get the latest snapshot (more lenient)
  let query: string;
  if (asOfIso) {
    query = `
      SELECT max(snapshot_pst) AS current_snapshot
      FROM hourly_snapshot_metrics
      WHERE snapshot_pst <= ${sqlString(asOfIso)}::TIMESTAMP
    `;
  } else {
    // Just get the latest snapshot without time filtering
    query = `
      SELECT max(snapshot_pst) AS current_snapshot
      FROM hourly_snapshot_metrics
    `;
  }

  const rows = await allRows<{ current_snapshot: string }>(conn, query);

  const snap = rows[0]?.current_snapshot;
  // Convert DuckDB timestamp to ISO string if it's a Date object
  if (!snap) return null;
  const snapDate = new Date(snap);
  return snapDate.toISOString();
}

async function getMatchingSnapshots(
  conn: any,
  currentSnapshotUtc: string,
  days: number
): Promise<string[]> {
  // We look for, for each UTC day d = 0..days-1, the latest snapshot for that UTC day
  // whose time-of-day is <= current snapshot's time-of-day.
  const rows = await allRows<{ snapshot_pst: string }>(
    conn,
    `
    WITH current AS (
      SELECT
        ${sqlString(currentSnapshotUtc)}::TIMESTAMP AS snapshot_utc,
        date_trunc('day', ${sqlString(currentSnapshotUtc)}::TIMESTAMP) AS today_utc,
        extract(hour FROM ${sqlString(currentSnapshotUtc)}::TIMESTAMP) AS snap_hour,
        extract(minute FROM ${sqlString(currentSnapshotUtc)}::TIMESTAMP) AS snap_minute
    ),
    days AS (
      SELECT
        today_utc - d.generate_series * INTERVAL 1 DAY AS day_utc,
        snap_hour,
        snap_minute
      FROM current,
      generate_series(0, ${days - 1}) AS d
    ),
    candidates AS (
      SELECT
        h.snapshot_pst,
        d.day_utc,
        h.snapshot_pst AS snapshot_ts,
        date_trunc('day', h.snapshot_pst) AS snapshot_day,
        extract(hour FROM h.snapshot_pst) AS snapshot_hour,
        extract(minute FROM h.snapshot_pst) AS snapshot_minute
      FROM hourly_snapshot_metrics h
      JOIN days d
        ON date_trunc('day', h.snapshot_pst) = d.day_utc
    ),
    filtered AS (
      SELECT
        c.snapshot_pst,
        c.day_utc,
        c.snapshot_ts
      FROM candidates c
      JOIN current cp ON TRUE
      WHERE
        -- Only include snapshots up to the same UTC time-of-day
        (
          c.snapshot_hour < cp.snap_hour OR
          (c.snapshot_hour = cp.snap_hour AND c.snapshot_minute <= cp.snap_minute)
        )
    ),
    ranked AS (
      SELECT
        snapshot_pst,
        day_utc,
        row_number() OVER (PARTITION BY day_utc ORDER BY snapshot_ts DESC) AS rn
      FROM filtered
    )
    SELECT snapshot_pst
    FROM ranked
    WHERE rn = 1
    ORDER BY day_utc DESC
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
    const site = getFlag('site');
    const days = parseInt(getFlag('days') || String(DEFAULT_DAYS), 10);
    const mediaSources = getFlagList('media-source');
    
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
      // Debug: Check if table exists and has any data
      const debugRows = await allRows<any>(conn, `
        SELECT COUNT(*) as total_rows, 
               COUNT(DISTINCT snapshot_pst) as unique_snapshots,
               MIN(snapshot_pst) as earliest_snapshot,
               MAX(snapshot_pst) as latest_snapshot
        FROM hourly_snapshot_metrics
      `);
      
      // Always show debug info, even if table is empty
      console.log('DEBUG: Snapshot table status:');
      if (debugRows.length > 0) {
        const stats = debugRows[0];
        console.log(`  Total rows: ${stats.total_rows || 0}`);
        console.log(`  Unique snapshots: ${stats.unique_snapshots || 0}`);
        if (stats.earliest_snapshot) {
          console.log(`  Earliest snapshot: ${stats.earliest_snapshot}`);
        }
        if (stats.latest_snapshot) {
          console.log(`  Latest snapshot: ${stats.latest_snapshot}`);
        }
        
        if (stats.total_rows > 0) {
          // Also check what campaign IDs exist
          const campaignRows = await allRows<any>(conn, `
            SELECT DISTINCT campaign_id, COUNT(*) as row_count
            FROM hourly_snapshot_metrics
            GROUP BY campaign_id
            ORDER BY row_count DESC
            LIMIT 20
          `);
          console.log(`\n  Sample campaign IDs in snapshots (top 20):`);
          campaignRows.forEach((r: any) => {
            console.log(`    ${r.campaign_id}: ${r.row_count} rows`);
          });
        } else {
          console.log('\n  Table is empty. No snapshots have been created yet.');
          console.log('  To create snapshots, run: npm run monitor:snapshot-hourly');
        }
      } else {
        console.log('  Could not query snapshot table.');
      }
      return;
    }

    const snapshots = await getMatchingSnapshots(conn, currentSnapshot, days);
    if (!snapshots.length) {
      console.log('No matching snapshots found for requested window.');
      return;
    }

    console.log(`\n# Hourly Snapshot Report (UTC)`);
    console.log(`Site: ${site || 'ALL (no filter)'}`);
    console.log(`Media Sources: ${mediaSources && mediaSources.length > 0 ? mediaSources.join(', ') : 'ALL (no filter)'}`);
    console.log(`Days (including today): ${days}`);
    if (campaignId) console.log(`Campaign ID: ${campaignId}`);
    if (campaignName) console.log(`Campaign Name: ${campaignName}`);
    if (adsetId) console.log(`Ad Set ID: ${adsetId}`);
    if (adsetName) console.log(`Ad Set Name: ${adsetName}`);
    if (owner) console.log(`Owner: ${owner}`);
    if (category) console.log(`Category: ${category}`);
    if (lane) console.log(`Lane: ${lane}`);
    if (level) console.log(`Level: ${level}`);
    console.log(`Current snapshot_utc: ${currentSnapshot}`);
    console.log(`Comparing snapshots:`);
    snapshots.forEach((s) => console.log(`  - ${s}`));
    console.log('');

    const snapshotList = snapshots.map((s) => sqlString(s)).join(', ');

    // Build WHERE clause with optional filters
    const whereConditions: string[] = [
      `snapshot_pst IN (${snapshotList})`,
    ];
    
    // Only filter by site if explicitly provided
    if (site) {
      whereConditions.push(`rsoc_site = ${sqlString(site)}`);
    }
    
    // Only filter by media_source if explicitly provided
    if (mediaSources && mediaSources.length > 0) {
      const mediaSourceFilter = mediaSources
        .map((m) => sqlString(m))
        .join(', ');
      whereConditions.push(`media_source IN (${mediaSourceFilter})`);
    }

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
      whereConditions.push(`LOWER(owner) = LOWER(${sqlString(owner)})`);
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
      
      // Debug: Show what campaign IDs exist in snapshots
      const debugWhereConditions: string[] = [`snapshot_pst IN (${snapshotList})`];
      if (site) {
        debugWhereConditions.push(`rsoc_site = ${sqlString(site)}`);
      }
      if (mediaSources && mediaSources.length > 0) {
        const mediaSourceFilter = mediaSources.map((m) => sqlString(m)).join(', ');
        debugWhereConditions.push(`media_source IN (${mediaSourceFilter})`);
      }
      
      const debugCampaigns = await allRows<any>(conn, `
        SELECT DISTINCT campaign_id, COUNT(*) as row_count
        FROM hourly_snapshot_metrics
        WHERE ${debugWhereConditions.join(' AND ')}
        GROUP BY campaign_id
        ORDER BY row_count DESC
        LIMIT 20
      `);
      
      if (debugCampaigns.length > 0) {
        console.log(`\nDEBUG: Found ${debugCampaigns.length} campaign IDs in snapshots (matching site/media filters):`);
        debugCampaigns.forEach((r: any) => {
          const match = campaignId && r.campaign_id === campaignId ? ' ← LOOKING FOR THIS' : '';
          console.log(`  ${r.campaign_id}: ${r.row_count} rows${match}`);
        });
        
        if (campaignId && !debugCampaigns.some((r: any) => r.campaign_id === campaignId)) {
          const filterDesc = [];
          if (site) filterDesc.push(`site=${site}`);
          if (mediaSources && mediaSources.length > 0) filterDesc.push(`media_source IN (${mediaSources.join(', ')})`);
          console.log(`\n  ⚠ Campaign ID "${campaignId}" not found in snapshots${filterDesc.length > 0 ? ` with ${filterDesc.join(' and ')}` : ''}.`);
          
          // Check if campaign exists in snapshots with different site/media_source
          const allCampaignRows = await allRows<any>(conn, `
            SELECT DISTINCT campaign_id, rsoc_site, media_source, COUNT(*) as row_count
            FROM hourly_snapshot_metrics
            WHERE snapshot_pst IN (${snapshotList})
              AND campaign_id = ${sqlString(campaignId)}
            GROUP BY campaign_id, rsoc_site, media_source
            ORDER BY row_count DESC
          `);
          
          if (allCampaignRows.length > 0) {
            console.log(`\n  Campaign "${campaignId}" exists in snapshots with different filters:`);
            allCampaignRows.forEach((r: any) => {
              console.log(`    site=${r.rsoc_site || 'NULL'}, media_source=${r.media_source || 'NULL'}: ${r.row_count} rows`);
            });
            console.log(`\n  Try running with: --site=${allCampaignRows[0].rsoc_site || 'N/A'} --media-source=${allCampaignRows[0].media_source || 'N/A'}`);
          } else {
            console.log(`  Campaign "${campaignId}" not found in snapshots at all.`);
            console.log(`  This might mean the join with campaign_index failed (no facebook_campaign_id match).`);
          }
        }
        } else {
          const filterDesc = [];
          if (site) filterDesc.push(`site=${site}`);
          if (mediaSources && mediaSources.length > 0) filterDesc.push(`media_source IN (${mediaSources.join(', ')})`);
          console.log(`\nDEBUG: No campaigns found${filterDesc.length > 0 ? ` matching ${filterDesc.join(' and ')}` : ''}`);
        
        // If we're looking for a specific campaign, check if it exists without filters
        if (campaignId) {
          const unfilteredRows = await allRows<any>(conn, `
            SELECT DISTINCT campaign_id, rsoc_site, media_source, COUNT(*) as row_count
            FROM hourly_snapshot_metrics
            WHERE snapshot_pst IN (${snapshotList})
              AND campaign_id = ${sqlString(campaignId)}
            GROUP BY campaign_id, rsoc_site, media_source
            LIMIT 5
          `);
          
          if (unfilteredRows.length > 0) {
            console.log(`\n  Campaign "${campaignId}" exists in snapshots but with different site/media:`);
            unfilteredRows.forEach((r: any) => {
              console.log(`    site=${r.rsoc_site || 'NULL'}, media_source=${r.media_source || 'NULL'}: ${r.row_count} rows`);
            });
          }
        }
      }
      
      return;
    }

    // Group rows by snapshot and then by hour for display
    // Normalize snapshot_pst to ISO strings for consistent key matching
    const bySnapshot: Record<string, any[]> = {};
    for (const row of rows) {
      // Convert snapshot_pst to ISO string if it's a Date object
      const snapPst = row.snapshot_pst;
      const snapKey = snapPst instanceof Date ? snapPst.toISOString() : String(snapPst);
      if (!bySnapshot[snapKey]) bySnapshot[snapKey] = [];
      bySnapshot[snapKey].push(row);
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
    // Try to find matching snapshot rows by comparing ISO strings
    let currentSnapshotRows: any[] | undefined = undefined;
    for (const snapshotKey of snapshots) {
      // Try exact match first
      if (bySnapshot[snapshotKey]) {
        currentSnapshotRows = bySnapshot[snapshotKey];
        break;
      }
      // Try to find by comparing ISO strings (handle Date object conversion)
      for (const key in bySnapshot) {
        const keyDate = new Date(key);
        const snapshotDate = new Date(snapshotKey);
        if (!isNaN(keyDate.getTime()) && !isNaN(snapshotDate.getTime())) {
          // Compare timestamps (within 1 second tolerance)
          if (Math.abs(keyDate.getTime() - snapshotDate.getTime()) < 1000) {
            currentSnapshotRows = bySnapshot[key];
            break;
          }
        }
      }
      if (currentSnapshotRows) break;
    }
    
    // Fallback: use the first snapshot in bySnapshot if no match found
    if (!currentSnapshotRows || currentSnapshotRows.length === 0) {
      const firstKey = Object.keys(bySnapshot)[0];
      if (firstKey) {
        currentSnapshotRows = bySnapshot[firstKey];
      }
    }
    
    if (currentSnapshotRows && currentSnapshotRows.length > 0) {
      // Get unique days in this snapshot
      const uniqueDays = Array.from(
        new Set(currentSnapshotRows.map((r) => String(r.day_pst)))
      );

      // Extract the snapshot day from the snapshot timestamp (UTC)
      const snapshotTimestamp = new Date(snapshots[0]); // Use the first (most recent) snapshot
      const snapshotDayStr = snapshotTimestamp.toISOString().split('T')[0]; // YYYY-MM-DD format (UTC)
      
      // Find the snapshot day in uniqueDays by matching date strings
      // day_pst might be a Date object or a string, so we need to normalize both
      let snapshotDay: string | null = null;
      for (const day of uniqueDays) {
        // Try to parse day as a Date and compare
        const dayDate = new Date(day);
        if (!isNaN(dayDate.getTime())) {
          const dayStr = dayDate.toISOString().split('T')[0];
          if (dayStr === snapshotDayStr) {
            snapshotDay = day;
            break;
          }
        }
        // Also try direct string comparison if day is already in YYYY-MM-DD format
        if (day === snapshotDayStr || day.startsWith(snapshotDayStr)) {
          snapshotDay = day;
          break;
        }
      }
      
      // Fallback: if we can't find the snapshot day, use the chronologically most recent day
      if (!snapshotDay) {
        const sortedDays = uniqueDays
          .map((d) => ({ str: d, date: new Date(d) }))
          .filter((d) => !isNaN(d.date.getTime()))
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        if (sortedDays.length > 0) {
          snapshotDay = sortedDays[0].str;
        } else {
          snapshotDay = uniqueDays[0]; // Last resort fallback
        }
      }
      
      const snapshotDayRows = currentSnapshotRows.filter(
        (r) => String(r.day_pst) === snapshotDay
      );
      const snapshotDayHours = snapshotDayRows.map((r) => Number(r.hour_pst));
      const maxHourPst = snapshotDayHours.length > 0 
        ? Math.max(...snapshotDayHours)
        : 23; // Fallback to 23 if no rows found
      
      // Note: snapshotDay is the day the snapshot was taken, maxHourPst is the hour (0-23)

      // For each day, compute cumulative totals up to the snapshot hour
      for (const day of uniqueDays) {
        const dayRows = currentSnapshotRows
          .filter((r) => String(r.day_pst) === day)
          .sort((a, b) => Number(a.hour_pst) - Number(b.hour_pst));

        // Only include hours up to the snapshot hour (UTC)
        const filteredDayRows = dayRows.filter((r) => {
          const hour = Number(r.hour_pst);
          return hour <= maxHourPst;
        });

        // Aggregate by hour first (in case there are multiple rows per hour due to dimensions)
        const hourlyAgg: Record<number, { sessions: number; revenue: number }> = {};
        for (const r of filteredDayRows) {
          const hour = Number(r.hour_pst);
          if (hour > maxHourPst) continue; // Extra safety check
          if (!hourlyAgg[hour]) {
            hourlyAgg[hour] = { sessions: 0, revenue: 0 };
          }
          hourlyAgg[hour].sessions += Number(r.sessions || 0);
          hourlyAgg[hour].revenue += Number(r.revenue || 0);
        }

        // Sum up the aggregated hourly totals (only up to maxHourPst)
        let cumSessions = 0;
        let cumRevenue = 0;
        const sortedHours = Object.keys(hourlyAgg)
          .map(Number)
          .filter((h) => h <= maxHourPst)
          .sort((a, b) => a - b);
        for (const hour of sortedHours) {
          cumSessions += hourlyAgg[hour].sessions;
          cumRevenue += hourlyAgg[hour].revenue;
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

    // Sort by day descending (most recent first) - parse dates properly
    dayTotals.sort((a, b) => {
      const dateA = new Date(a.day);
      const dateB = new Date(b.day);
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
        // Fallback to string comparison if dates can't be parsed
        return b.day.localeCompare(a.day);
      }
      return dateB.getTime() - dateA.getTime();
    });

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


