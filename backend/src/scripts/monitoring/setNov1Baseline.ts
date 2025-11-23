#!/usr/bin/env ts-node

/**
 * Set November 1, 2025 as the baseline date
 * All campaigns appearing on Nov 1 are marked as launched on Nov 1
 * Then subsequent days will only track NEW campaigns
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql, sqlString } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const baselineDate = '2025-11-01';
  const confirm = process.argv[2];
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    // Check if Nov 1 data exists
    const nov1Campaigns = await allRows(
      conn,
      `SELECT COUNT(DISTINCT campaign_id) as count
      FROM campaign_index
      WHERE date = '${baselineDate}'
        AND campaign_id IS NOT NULL
        AND campaign_id != ''`
    );
    
    const count = Number(nov1Campaigns[0]?.count || 0);
    
    if (count === 0) {
      console.log(`\n⚠️  No campaigns found in campaign_index for ${baselineDate}`);
      console.log(`Please ingest data for Nov 1 first:`);
      console.log(`  npm run monitor:ingest-campaigns -- --date=${baselineDate} --mode=remote\n`);
      return;
    }
    
    console.log(`\n# Setting November 1, 2025 as Baseline Date\n`);
    console.log(`Found ${count} campaigns in campaign_index for ${baselineDate}`);
    
    if (confirm !== '--confirm') {
      console.log(`\nThis will:`);
      console.log(`1. Clear all existing campaign_launches records`);
      console.log(`2. Mark all ${count} campaigns from Nov 1 as launched on Nov 1`);
      console.log(`3. Set Nov 1 as the baseline - all future tracking will be incremental\n`);
      console.log(`⚠️  To proceed, run:`);
      console.log(`   npm run monitor:set-baseline -- --confirm\n`);
      return;
    }
    
    console.log(`\n[setNov1Baseline] Clearing existing campaign_launches...`);
    await runSql(conn, 'DELETE FROM campaign_launches');
    
    console.log(`[setNov1Baseline] Processing ${baselineDate} campaigns...`);
    
    // Get all campaigns from Nov 1
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
      WHERE date = '${baselineDate}'
        AND campaign_id IS NOT NULL
        AND campaign_id != ''
      GROUP BY campaign_id
      ORDER BY campaign_id`
    );
    
    console.log(`[setNov1Baseline] Found ${campaigns.length} unique campaigns for baseline`);
    
    // Insert all Nov 1 campaigns as baseline
    let inserted = 0;
    for (const campaign of campaigns) {
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
          '${baselineDate}',
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
    
    console.log(`[setNov1Baseline] Successfully set ${inserted} campaigns as baseline (launched on ${baselineDate})`);
    
    // Show breakdown
    const byOwner = await allRows(
      conn,
      `SELECT 
        COALESCE(owner, 'UNKNOWN') as owner,
        COUNT(*) as count
      FROM campaign_launches
      WHERE first_seen_date = '${baselineDate}'
      GROUP BY owner
      ORDER BY count DESC`
    );
    
    console.log(`\n## Baseline Campaigns by Owner\n`);
    console.log('| Owner | Count |');
    console.log('|-------|-------|');
    for (const row of byOwner) {
      console.log(`| ${row.owner} | ${row.count} |`);
    }
    
    console.log(`\n[setNov1Baseline] Done!`);
    console.log(`\nNow you can track incremental launches:`);
    console.log(`  npm run monitor:backfill-launches -- <days_back> 0`);
    console.log(`  Or track specific dates: npm run monitor:track-launches -- <date>\n`);
    
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

