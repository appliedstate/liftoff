#!/usr/bin/env ts-node

/**
 * Track new campaign launches by detecting campaigns that appear for the first time
 * Compares current campaign_index entries with campaign_launches table
 * Records new campaigns with their first_seen_date and buyer/owner info
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql, sqlString, sqlNumber } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const conn = createMonitoringConnection();
  
  try {
    // Ensure schema is initialized
    await initMonitoringSchema(conn);
    
    console.log(`\n[trackCampaignLaunches] Tracking new campaigns for ${date}...\n`);
    
    // Get all unique campaigns from campaign_index for this date
    const currentCampaigns = await allRows(
      conn,
      `SELECT DISTINCT
        campaign_id,
        owner,
        lane,
        category,
        media_source,
        campaign_name,
        account_id
      FROM campaign_index
      WHERE date = '${date}'
        AND campaign_id IS NOT NULL
        AND campaign_id != ''
      ORDER BY campaign_id`
    );
    
    console.log(`[trackCampaignLaunches] Found ${currentCampaigns.length} campaigns in campaign_index for ${date}`);
    
    if (currentCampaigns.length === 0) {
      console.log('[trackCampaignLaunches] No campaigns found. Make sure campaign_index has been populated for this date.');
      return;
    }
    
    // Get all campaigns we've already seen
    const existingLaunches = await allRows(
      conn,
      `SELECT campaign_id FROM campaign_launches`
    );
    
    const existingCampaignIds = new Set(existingLaunches.map((r: any) => r.campaign_id));
    console.log(`[trackCampaignLaunches] Found ${existingCampaignIds.size} campaigns already tracked`);
    
    // Find new campaigns
    const newCampaigns = currentCampaigns.filter((c: any) => !existingCampaignIds.has(c.campaign_id));
    
    console.log(`[trackCampaignLaunches] Detected ${newCampaigns.length} new campaigns\n`);
    
    if (newCampaigns.length === 0) {
      console.log('[trackCampaignLaunches] No new campaigns detected.');
      return;
    }
    
    // Group by owner for summary
    const byOwner: Record<string, number> = {};
    for (const campaign of newCampaigns) {
      const owner = campaign.owner || 'UNKNOWN';
      byOwner[owner] = (byOwner[owner] || 0) + 1;
    }
    
    console.log('New Campaigns by Owner:');
    for (const [owner, count] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${owner}: ${count}`);
    }
    console.log('');
    
    // Insert new campaigns into campaign_launches
    // DuckDB doesn't support INSERT OR REPLACE, so we use DELETE then INSERT
    let inserted = 0;
    for (const campaign of newCampaigns) {
      try {
        // Delete if exists (shouldn't happen, but handle edge cases)
        await runSql(
          conn,
          `DELETE FROM campaign_launches WHERE campaign_id = ${sqlString(campaign.campaign_id)}`
        );
        
        // Insert new record
        await runSql(
          conn,
          `INSERT INTO campaign_launches (
            campaign_id,
            first_seen_date,
            owner,
            lane,
            category,
            media_source,
            campaign_name,
            account_id,
            detected_at
          ) VALUES (
            ${sqlString(campaign.campaign_id)},
            '${date}',
            ${sqlString(campaign.owner)},
            ${sqlString(campaign.lane)},
            ${sqlString(campaign.category)},
            ${sqlString(campaign.media_source)},
            ${sqlString(campaign.campaign_name)},
            ${sqlString(campaign.account_id)},
            CURRENT_TIMESTAMP
          )`
        );
        inserted++;
      } catch (err: any) {
        // Handle duplicate key errors
        if (err?.message?.includes('PRIMARY KEY') || err?.message?.includes('UNIQUE')) {
          console.warn(`[trackCampaignLaunches] Campaign ${campaign.campaign_id} already exists, skipping`);
        } else {
          throw err;
        }
      }
    }
    
    console.log(`[trackCampaignLaunches] Successfully tracked ${inserted} new campaigns`);
    
    // Show breakdown by media source
    const byMediaSource: Record<string, number> = {};
    for (const campaign of newCampaigns) {
      const source = campaign.media_source || 'UNKNOWN';
      byMediaSource[source] = (byMediaSource[source] || 0) + 1;
    }
    
    console.log('\nNew Campaigns by Media Source:');
    for (const [source, count] of Object.entries(byMediaSource).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${source}: ${count}`);
    }
    
    console.log('\n[trackCampaignLaunches] Done!\n');
  } catch (err: any) {
    console.error('[trackCampaignLaunches] Error:', err?.message || err);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

