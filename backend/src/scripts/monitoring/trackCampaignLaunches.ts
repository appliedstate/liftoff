#!/usr/bin/env ts-node

/**
 * Track new campaign launches by detecting campaigns that appear for the first time
 * Compares current campaign_index entries with campaign_launches table
 * Records new campaigns with their first_seen_date and buyer/owner info
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql, sqlString, sqlNumber } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getPSTDate(date: Date): string {
  // Convert to PST (UTC-8) and return YYYY-MM-DD
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

function getTodayPST(): string {
  return getPSTDate(new Date());
}

async function main() {
  const dateArg = process.argv[2];
  const date = dateArg || getTodayPST();
  const conn = createMonitoringConnection();
  
  try {
    // Ensure schema is initialized
    await initMonitoringSchema(conn);
    
    console.log(`\n[trackCampaignLaunches] Tracking new campaigns for ${date}...\n`);
    
    // Get all unique campaigns from campaign_index for this date
    // Use GROUP BY to handle cases where same campaign appears multiple times (different levels/sources)
    // Also look at historical dates to fill in missing owner/lane/category info
    const currentCampaigns = await allRows(
      conn,
      `SELECT 
        ci_date.campaign_id,
        -- Prefer owner from current date, fallback to historical
        COALESCE(
          NULLIF(MAX(ci_date.owner), ''),
          NULLIF(MAX(ci_date.owner), 'UNKNOWN'),
          (SELECT MAX(ci_hist.owner) 
           FROM campaign_index ci_hist 
           WHERE ci_hist.campaign_id = ci_date.campaign_id 
             AND ci_hist.owner IS NOT NULL 
             AND ci_hist.owner != '' 
             AND ci_hist.owner != 'UNKNOWN'
           LIMIT 1)
        ) as owner,
        -- Same for lane
        COALESCE(
          NULLIF(MAX(ci_date.lane), ''),
          NULLIF(MAX(ci_date.lane), 'UNKNOWN'),
          (SELECT MAX(ci_hist.lane) 
           FROM campaign_index ci_hist 
           WHERE ci_hist.campaign_id = ci_date.campaign_id 
             AND ci_hist.lane IS NOT NULL 
             AND ci_hist.lane != '' 
             AND ci_hist.lane != 'UNKNOWN'
           LIMIT 1)
        ) as lane,
        -- Same for category
        COALESCE(
          NULLIF(MAX(ci_date.category), ''),
          NULLIF(MAX(ci_date.category), 'UNKNOWN'),
          (SELECT MAX(ci_hist.category) 
           FROM campaign_index ci_hist 
           WHERE ci_hist.campaign_id = ci_date.campaign_id 
             AND ci_hist.category IS NOT NULL 
             AND ci_hist.category != '' 
             AND ci_hist.category != 'UNKNOWN'
           LIMIT 1)
        ) as category,
        MAX(ci_date.media_source) as media_source,
        MAX(ci_date.campaign_name) as campaign_name,
        MAX(ci_date.account_id) as account_id
      FROM campaign_index ci_date
      WHERE ci_date.date = '${date}'
        AND ci_date.campaign_id IS NOT NULL
        AND ci_date.campaign_id != ''
      GROUP BY ci_date.campaign_id
      ORDER BY ci_date.campaign_id`
    );
    
    console.log(`[trackCampaignLaunches] Found ${currentCampaigns.length} campaigns in campaign_index for ${date}`);
    console.log(`[trackCampaignLaunches] Note: Campaigns with UNKNOWN owner may have launched before November 1, 2025`);
    
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
    
    // Find new campaigns (campaigns not in campaign_launches)
    // Also check if existing campaigns should have earlier first_seen_date
    const newCampaigns: any[] = [];
    const existingCampaigns = await allRows(
      conn,
      `SELECT campaign_id, first_seen_date FROM campaign_launches`
    );
    
    const existingFirstSeenMap = new Map<string, string>();
    for (const row of existingCampaigns) {
      existingFirstSeenMap.set(row.campaign_id, row.first_seen_date);
    }
    
    for (const campaign of currentCampaigns) {
      const existingFirstSeen = existingFirstSeenMap.get(campaign.campaign_id);
      if (!existingFirstSeen) {
        // Truly new campaign
        newCampaigns.push(campaign);
      } else if (existingFirstSeen > date) {
        // Campaign exists but this date is earlier - we'll update it
        newCampaigns.push(campaign);
        console.log(`  Updating ${campaign.campaign_id}: ${existingFirstSeen} -> ${date} (earlier date found)`);
      }
      // If existingFirstSeen <= date, keep existing (earlier) date
    }
    
    console.log(`[trackCampaignLaunches] Detected ${newCampaigns.length} new/updated campaigns\n`);
    
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
    
    // Insert/update campaigns into campaign_launches
    // If campaign exists with later first_seen_date, update it to this (earlier) date
    let inserted = 0;
    let updated = 0;
    
    for (const campaign of newCampaigns) {
      try {
        const existingFirstSeen = existingFirstSeenMap.get(campaign.campaign_id);
        
        if (existingFirstSeen && existingFirstSeen > date) {
          // Update existing record with earlier date
          await runSql(
            conn,
            `UPDATE campaign_launches
            SET first_seen_date = '${date}',
                owner = ${sqlString(campaign.owner)},
                lane = ${sqlString(campaign.lane)},
                category = ${sqlString(campaign.category)},
                media_source = ${sqlString(campaign.media_source)},
                campaign_name = ${sqlString(campaign.campaign_name)},
                account_id = ${sqlString(campaign.account_id)}
            WHERE campaign_id = ${sqlString(campaign.campaign_id)}`
          );
          updated++;
        } else if (!existingFirstSeen) {
          // Insert new record
          await runSql(
            conn,
            `DELETE FROM campaign_launches WHERE campaign_id = ${sqlString(campaign.campaign_id)}`
          );
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
        }
      } catch (err: any) {
        // Handle duplicate key errors
        if (err?.message?.includes('PRIMARY KEY') || err?.message?.includes('UNIQUE')) {
          console.warn(`[trackCampaignLaunches] Campaign ${campaign.campaign_id} already exists, skipping`);
        } else {
          throw err;
        }
      }
    }
    
    console.log(`[trackCampaignLaunches] Successfully tracked ${inserted} new campaigns, ${updated} updated with earlier dates`);
    
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

