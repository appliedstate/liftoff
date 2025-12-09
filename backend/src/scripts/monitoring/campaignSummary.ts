#!/usr/bin/env ts-node

/**
 * Campaign Performance Summary
 * 
 * Compares snapshot data with Strategis reported metrics
 * 
 * Usage:
 *   npm run monitor:campaign-summary -- --campaign-id=sire1f06al --date=2025-12-08
 */

import 'dotenv/config';
import {
  allRows,
  closeConnection,
  createMonitoringConnection,
  sqlString,
} from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

async function main(): Promise<void> {
  const campaignId = getFlag('campaign-id');
  const dateStr = getFlag('date') || new Date().toISOString().slice(0, 10);
  
  if (!campaignId) {
    console.error('Usage: npm run monitor:campaign-summary -- --campaign-id=<id> [--date=YYYY-MM-DD]');
    process.exit(1);
  }

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);

    console.log(`\n# Campaign Performance Summary`);
    console.log(`Campaign ID: ${campaignId}`);
    console.log(`Date: ${dateStr}\n`);

    // 1. Get snapshot data (full day if available)
    const snapshotRows = await allRows<any>(conn, `
      SELECT 
        SUM(sessions) AS total_sessions,
        SUM(revenue) AS total_revenue,
        COUNT(DISTINCT hour_pst) AS hours_with_data,
        MIN(hour_pst) AS first_hour,
        MAX(hour_pst) AS last_hour
      FROM hourly_snapshot_metrics
      WHERE campaign_id = ${sqlString(campaignId)}
        AND day_pst = DATE '${dateStr}'
    `);

    const snapshotData = snapshotRows[0] || { total_sessions: 0, total_revenue: 0, hours_with_data: 0 };

    // 2. Get session_hourly_metrics data (need to find via Facebook campaign ID)
    // First, find the Facebook campaign ID from campaign_index
    const fbIdRows = await allRows<any>(conn, `
      SELECT DISTINCT facebook_campaign_id
      FROM campaign_index
      WHERE campaign_id = ${sqlString(campaignId)}
        AND date = DATE '${dateStr}'
        AND facebook_campaign_id IS NOT NULL
      LIMIT 1
    `);

    let sessionData = { total_sessions: 0, total_revenue: 0, click_hours: 0 };
    if (fbIdRows.length > 0) {
      const fbCampaignId = fbIdRows[0].facebook_campaign_id;
      console.log(`Found Facebook campaign ID: ${fbCampaignId}\n`);
      
      const sessionRows = await allRows<any>(conn, `
        SELECT 
          SUM(sessions) AS total_sessions,
          SUM(revenue) AS total_revenue,
          COUNT(DISTINCT click_hour) AS click_hours
        FROM session_hourly_metrics
        WHERE campaign_id = ${sqlString(fbCampaignId)}
          AND date = DATE '${dateStr}'
      `);
      
      sessionData = sessionRows[0] || { total_sessions: 0, total_revenue: 0, click_hours: 0 };
    }

    // 3. Get campaign_index aggregated data
    const indexRows = await allRows<any>(conn, `
      SELECT 
        SUM(sessions) AS total_sessions,
        SUM(revenue_usd) AS total_revenue,
        SUM(clicks) AS total_clicks,
        COUNT(DISTINCT snapshot_source) AS sources
      FROM campaign_index
      WHERE campaign_id = ${sqlString(campaignId)}
        AND date = DATE '${dateStr}'
    `);

    const indexData = indexRows[0] || { total_sessions: 0, total_revenue: 0, total_clicks: 0, sources: 0 };

    // 4. Display summary
    console.log('## Snapshot Data (hourly_snapshot_metrics)');
    console.log(`  Sessions: ${Number(snapshotData.total_sessions || 0).toLocaleString()}`);
    console.log(`  Revenue: $${Number(snapshotData.total_revenue || 0).toFixed(2)}`);
    console.log(`  Hours with data: ${snapshotData.hours_with_data || 0} (${snapshotData.first_hour || 'N/A'}-${snapshotData.last_hour || 'N/A'})`);
    if (snapshotData.hours_with_data < 24) {
      console.log(`  ⚠ Missing hours: ${24 - (snapshotData.hours_with_data || 0)} hours (full day should have 24 hours)`);
    }

    console.log('\n## Session Hourly Metrics (session_hourly_metrics)');
    console.log(`  Sessions: ${Number(sessionData.total_sessions || 0).toLocaleString()}`);
    console.log(`  Revenue: $${Number(sessionData.total_revenue || 0).toFixed(2)}`);
    console.log(`  Click hours: ${sessionData.click_hours || 0}`);

    console.log('\n## Campaign Index Aggregated (campaign_index)');
    console.log(`  Sessions: ${Number(indexData.total_sessions || 0).toLocaleString()}`);
    console.log(`  Revenue: $${Number(indexData.total_revenue || 0).toFixed(2)}`);
    console.log(`  Clicks: ${Number(indexData.total_clicks || 0).toLocaleString()}`);
    console.log(`  Data sources: ${indexData.sources || 0}`);

    console.log('\n## Strategis Comparison');
    console.log(`  Strategis Reported Revenue: $2,322.81`);
    console.log(`  Strategis Reported S1 Clicks: 1,089`);
    
    const snapshotRevenue = Number(snapshotData.total_revenue || 0);
    const strategisRevenue = 2322.81;
    const revenueDiff = strategisRevenue - snapshotRevenue;
    const revenuePct = (revenueDiff / strategisRevenue) * 100;
    
    console.log(`\n  Revenue Comparison:`);
    console.log(`    Snapshot: $${snapshotRevenue.toFixed(2)}`);
    console.log(`    Strategis: $${strategisRevenue.toFixed(2)}`);
    console.log(`    Difference: $${Math.abs(revenueDiff).toFixed(2)} (${Math.abs(revenuePct).toFixed(1)}% ${revenueDiff > 0 ? 'lower' : 'higher'})`);

    const snapshotSessions = Number(snapshotData.total_sessions || 0);
    const strategisClicks = 1089;
    const sessionDiff = strategisClicks - snapshotSessions;
    const sessionPct = (sessionDiff / strategisClicks) * 100;
    
    console.log(`\n  Sessions/Clicks Comparison:`);
    console.log(`    Snapshot Sessions: ${snapshotSessions.toLocaleString()}`);
    console.log(`    Strategis S1 Clicks: ${strategisClicks.toLocaleString()}`);
    console.log(`    Difference: ${Math.abs(sessionDiff).toLocaleString()} (${Math.abs(sessionPct).toFixed(1)}% ${sessionDiff > 0 ? 'lower' : 'higher'})`);
    
    if (snapshotData.hours_with_data < 24) {
      console.log(`\n  ⚠ Note: Snapshot only includes ${snapshotData.hours_with_data} hours of data.`);
      console.log(`    Full day data may be higher. Check session_hourly_metrics for complete data.`);
    }

    // 5. Calculate sessions with revenue
    // Estimate: sessions with revenue ≈ revenue / average RPC
    const avgRpc = snapshotSessions > 0 ? snapshotRevenue / snapshotSessions : 0;
    const estimatedSessionsWithRevenue = avgRpc > 0 ? Math.round(snapshotRevenue / avgRpc) : 0;
    
    console.log(`\n  Estimated Sessions with Revenue:`);
    console.log(`    Based on average RPC: ~${estimatedSessionsWithRevenue.toLocaleString()} sessions`);
    console.log(`    (Total sessions: ${snapshotSessions.toLocaleString()}, Avg RPC: $${avgRpc.toFixed(4)})`);

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

