#!/usr/bin/env ts-node

/**
 * Backfill campaign launches from historical dates
 * Processes dates in order and sets first_seen_date to the earliest date a campaign appears
 * This allows us to see what was actually launched on each day
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql, sqlString } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getPSTDate(date: Date): string {
  // Convert to PST (UTC-8) and return YYYY-MM-DD
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

function getTodayPST(): string {
  return getPSTDate(new Date());
}

function getDaysAgoPST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPSTDate(date);
}

function getPSTDate(date: Date): string {
  // Convert to PST (UTC-8) and return YYYY-MM-DD
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

function getTodayPST(): string {
  return getPSTDate(new Date());
}

function getDaysAgoPST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPSTDate(date);
}

async function processDate(conn: any, date: string, baselineDate: string, dryRun: boolean = false): Promise<number> {
  console.log(`\n[backfillCampaignLaunches] Processing ${date}...`);
  
  // Get all campaigns from campaign_index for this date
  // Use GROUP BY to handle cases where same campaign appears multiple times (different levels/sources)
  const campaigns = await allRows(
    conn,
    `SELECT 
      campaign_id,
      MAX(owner) as owner,
      MAX(lane) as lane,
      MAX(category) as category,
      MAX(media_source) as media_source,
      MAX(campaign_name) as campaign_name,
      MAX(account_id) as account_id
    FROM campaign_index
    WHERE date = '${date}'
      AND campaign_id IS NOT NULL
      AND campaign_id != ''
    GROUP BY campaign_id
    ORDER BY campaign_id`
  );
  
  console.log(`[backfillCampaignLaunches] Found ${campaigns.length} campaigns in campaign_index for ${date}`);
  
  if (campaigns.length === 0) {
    console.log(`[backfillCampaignLaunches] No campaigns found for ${date}, skipping`);
    return 0;
  }
  
  // Get existing launches to check if we should update first_seen_date
  const existingLaunches = await allRows(
    conn,
    `SELECT campaign_id, first_seen_date FROM campaign_launches`
  );
  
  const existingMap = new Map<string, string>();
  for (const row of existingLaunches) {
    existingMap.set(row.campaign_id, row.first_seen_date);
  }
  
  let newCampaigns = 0;
  let updatedCampaigns = 0;
  
  for (const campaign of campaigns) {
    const campaignId = campaign.campaign_id;
    const existingFirstSeen = existingMap.get(campaignId);
    
    if (!existingFirstSeen) {
      // New campaign - insert it
      // For baseline date (Nov 1), all campaigns are marked as launched on that date
      // For subsequent dates, only NEW campaigns are tracked
      if (!dryRun) {
        await runSql(
          conn,
          `DELETE FROM campaign_launches WHERE campaign_id = ${sqlString(campaignId)}`
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
            ${sqlString(campaignId)},
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
      }
      newCampaigns++;
    } else if (date === baselineDate) {
      // If processing baseline date and campaign already exists, update it to baseline date
      if (!dryRun) {
        await runSql(
          conn,
          `UPDATE campaign_launches
          SET first_seen_date = '${baselineDate}',
              owner = ${sqlString(campaign.owner)},
              lane = ${sqlString(campaign.lane)},
              category = ${sqlString(campaign.category)},
              media_source = ${sqlString(campaign.media_source)},
              campaign_name = ${sqlString(campaign.campaign_name)},
              account_id = ${sqlString(campaign.account_id)}
          WHERE campaign_id = ${sqlString(campaignId)}`
        );
      }
      updatedCampaigns++;
    } else if (existingFirstSeen > date && existingFirstSeen !== baselineDate) {
      // Existing campaign but this date is earlier - update first_seen_date
      // But don't update if existing date is baseline (baseline takes precedence)
      if (!dryRun) {
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
          WHERE campaign_id = ${sqlString(campaignId)}`
        );
      }
      updatedCampaigns++;
      console.log(`  Updating ${campaignId}: ${existingFirstSeen} -> ${date}`);
    }
    // If existingFirstSeen <= date or is baseline date, keep the existing date
  }
  
  console.log(`[backfillCampaignLaunches] ${date}: ${newCampaigns} new, ${updatedCampaigns} updated`);
  return newCampaigns + updatedCampaigns;
}

async function main() {
  const startDaysAgo = parseInt(process.argv[2] || '7', 10);
  const endDaysAgo = parseInt(process.argv[3] || '0', 10);
  const dryRun = process.argv[4] === '--dry-run';
  const baselineDate = '2025-11-01';
  
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    // Check what dates actually have data first
    const availableDates = await allRows(
      conn,
      `SELECT DISTINCT date
      FROM campaign_index
      WHERE campaign_id IS NOT NULL
        AND campaign_id != ''
        AND date >= '${baselineDate}'
      ORDER BY date DESC
      LIMIT 30`
    );
    
    if (availableDates.length === 0) {
      console.log('\n[backfillCampaignLaunches] No data found in campaign_index.');
      console.log('Run ingestCampaignIndex first to populate data.\n');
      return;
    }
    
    const todayPST = getTodayPST();
    const startDate = getDaysAgoPST(startDaysAgo);
    const endDate = getDaysAgoPST(endDaysAgo);
    
    // Ensure we start from baseline date or later
    const actualStartDate = startDate < baselineDate ? baselineDate : startDate;
    
    console.log(`\n[backfillCampaignLaunches] Backfilling campaign launches`);
    console.log(`Baseline Date: ${baselineDate} (all campaigns on this date are baseline)`);
    console.log(`Today (PST): ${todayPST}`);
    console.log(`Requested Date Range: ${startDate} to ${endDate}`);
    console.log(`Actual Date Range: ${actualStartDate} to ${endDate} (adjusted for baseline)\n`);
    
    // Get actual dates that have data and fall within the requested range (Nov 1+)
    const datesWithData = availableDates
      .map((r: any) => String(r.date).slice(0, 10))
      .filter((d: string) => d >= actualStartDate && d <= endDate);
    
    if (datesWithData.length === 0) {
      console.log(`\n⚠️  No data found in campaign_index for dates ${actualStartDate} to ${endDate}`);
      console.log(`Available dates: ${availableDates.map((r: any) => String(r.date).slice(0, 10)).join(', ')}`);
      console.log('\nTo backfill available dates, use:');
      console.log(`  npm run monitor:backfill-launches -- <days_back> <days_forward>`);
      console.log(`  Or track specific date: npm run monitor:track-launches -- <date>\n`);
      return;
    }
    
    console.log(`Dates with data in range: ${datesWithData.join(', ')}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);
    
    // Process dates in chronological order (oldest first), but skip Nov 1 if it's already set as baseline
    const existingBaseline = await allRows(
      conn,
      `SELECT COUNT(*) as count FROM campaign_launches WHERE first_seen_date = '${baselineDate}'`
    );
    
    const hasBaseline = Number(existingBaseline[0]?.count || 0) > 0;
    
    if (hasBaseline && datesWithData.includes(baselineDate)) {
      console.log(`[backfillCampaignLaunches] Baseline (${baselineDate}) already set, skipping...`);
      const datesToProcess = datesWithData.filter(d => d !== baselineDate).sort();
      console.log(`[backfillCampaignLaunches] Processing incremental dates: ${datesToProcess.join(', ')}\n`);
      var dates = datesToProcess;
    } else {
      // Process dates in chronological order (oldest first)
      var dates = datesWithData.sort();
    }
    
    console.log(`Processing ${dates.length} dates: ${dates.join(', ')}\n`);
    
    let totalProcessed = 0;
    for (const date of dates) {
      const count = await processDate(conn, date, baselineDate, dryRun);
      totalProcessed += count;
    }
    
    console.log(`\n[backfillCampaignLaunches] Done! Processed ${totalProcessed} campaigns total`);
    
    if (dryRun) {
      console.log('\n[backfillCampaignLaunches] This was a dry run. Run without --dry-run to apply changes.');
    }
    
    console.log('\n');
  } catch (err: any) {
    console.error('[backfillCampaignLaunches] Error:', err?.message || err);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

