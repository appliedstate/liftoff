#!/usr/bin/env ts-node

/**
 * Query script to check MediaGo click hour revenue for a specific date
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || '2025-11-23';
  const conn = createMonitoringConnection();
  
  try {
    console.log(`\n=== MediaGo Click Hour Revenue for ${date} ===\n`);
    
    // Check if we have MediaGo campaigns in campaign_index
    const mediagoCampaigns = await allRows(
      conn,
      `SELECT 
        COUNT(DISTINCT campaign_id) as campaign_count,
        SUM(revenue_usd) as total_revenue,
        SUM(sessions) as total_sessions
      FROM campaign_index
      WHERE media_source = 'mediago'
        AND date = '${date}'`
    );
    
    console.log('MediaGo Campaigns in campaign_index:');
    const ci = mediagoCampaigns[0];
    if (ci && Number(ci.campaign_count) > 0) {
      console.log(`  Campaigns: ${ci.campaign_count}`);
      console.log(`  Total Revenue: $${Number(ci.total_revenue || 0).toFixed(2)}`);
      console.log(`  Total Sessions: ${Number(ci.total_sessions || 0).toFixed(0)}`);
    } else {
      console.log('  No MediaGo campaigns found in campaign_index');
    }
    
    // Check session_hourly_metrics for MediaGo
    const mediagoHourly = await allRows(
      conn,
      `SELECT 
        click_hour,
        COUNT(DISTINCT campaign_id) as campaign_count,
        SUM(sessions) as sessions,
        SUM(revenue) as revenue,
        SUM(revenue) / NULLIF(SUM(sessions), 0) as rpc
      FROM session_hourly_metrics
      WHERE media_source = 'mediago'
        AND date = '${date}'
      GROUP BY click_hour
      ORDER BY click_hour`
    );
    
    console.log('\nMediaGo Click Hour Breakdown:');
    if (mediagoHourly.length > 0) {
      console.log('\nHour | Campaigns | Sessions | Revenue  | RPC');
      console.log('-----|-----------|----------|----------|----------');
      let totalSessions = 0;
      let totalRevenue = 0;
      for (const row of mediagoHourly) {
        const hour = Number(row.click_hour);
        const campaigns = Number(row.campaign_count);
        const sessions = Number(row.sessions || 0);
        const revenue = Number(row.revenue || 0);
        const rpc = row.rpc ? Number(row.rpc).toFixed(4) : 'N/A';
        totalSessions += sessions;
        totalRevenue += revenue;
        console.log(`  ${hour.toString().padStart(2)}  | ${campaigns.toString().padStart(9)} | ${sessions.toFixed(0).padStart(8)} | $${revenue.toFixed(2).padStart(7)} | $${rpc}`);
      }
      console.log('-----|-----------|----------|----------|----------');
      console.log(`Total |           | ${totalSessions.toFixed(0).padStart(8)} | $${totalRevenue.toFixed(2).padStart(7)} |`);
    } else {
      console.log('  No MediaGo hourly data found in session_hourly_metrics');
      console.log('\nPossible reasons:');
      console.log('  1. Session ingestion not run for this date');
      console.log('  2. No MediaGo campaigns had sessions on this date');
      console.log('  3. MediaGo campaigns not properly tagged with media_source');
    }
    
    // Check if session data exists but media_source is NULL
    const nullSource = await allRows(
      conn,
      `SELECT 
        COUNT(*) as count,
        SUM(revenue) as revenue,
        SUM(sessions) as sessions
      FROM session_hourly_metrics
      WHERE date = '${date}'
        AND media_source IS NULL`
    );
    
    if (nullSource[0] && Number(nullSource[0].count) > 0) {
      console.log('\n⚠️  Warning: Found session data with NULL media_source:');
      console.log(`  Rows: ${nullSource[0].count}`);
      console.log(`  Revenue: $${Number(nullSource[0].revenue || 0).toFixed(2)}`);
      console.log(`  Sessions: ${Number(nullSource[0].sessions || 0).toFixed(0)}`);
      console.log('  These may be MediaGo campaigns that need metadata join');
    }
    
    // Check session ingestion runs
    const runs = await allRows(
      conn,
      `SELECT 
        date,
        max_click_hour,
        session_count,
        campaign_count,
        status,
        finished_at
      FROM session_ingest_runs
      WHERE date = '${date}'
      ORDER BY finished_at DESC
      LIMIT 1`
    );
    
    if (runs.length > 0) {
      const run = runs[0];
      console.log('\nLast Session Ingestion Run:');
      console.log(`  Status: ${run.status}`);
      console.log(`  Max Click Hour: ${run.max_click_hour || 'N/A'}`);
      console.log(`  Session Count: ${Number(run.session_count || 0).toLocaleString()}`);
      console.log(`  Campaign Count: ${Number(run.campaign_count || 0)}`);
      console.log(`  Finished: ${run.finished_at || 'N/A'}`);
    } else {
      console.log('\n⚠️  No session ingestion run found for this date');
      console.log('  Run: npm run monitor:ingest-sessions -- --date=' + date);
    }
    
    console.log('\n');
  } catch (err: any) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

