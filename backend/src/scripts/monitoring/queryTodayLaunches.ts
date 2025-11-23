#!/usr/bin/env ts-node

/**
 * Quick query to show today's campaign launches by buyer
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log(`\n# Campaign Launches for ${date}\n`);
    
    // Check if we have any launches for this date
    const launches = await allRows(
      conn,
      `SELECT 
        owner,
        COUNT(*) as launch_count,
        GROUP_CONCAT(DISTINCT media_source) as media_sources
      FROM campaign_launches
      WHERE first_seen_date = '${date}'
      GROUP BY owner
      ORDER BY launch_count DESC`
    );
    
    if (launches.length === 0) {
      console.log(`No campaign launches found for ${date}.`);
      console.log(`\nNote: Make sure trackCampaignLaunches has been run for this date.`);
      console.log(`Run: npm run monitor:track-launches -- ${date}\n`);
      return;
    }
    
    const total = launches.reduce((sum, row) => sum + Number(row.launch_count || 0), 0);
    
    console.log(`Total Campaigns Launched: ${total}\n`);
    console.log('| Buyer | Launches | Media Sources |');
    console.log('|-------|-----------|----------------|');
    
    for (const row of launches) {
      const owner = String(row.owner || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      const sources = String(row.media_sources || 'N/A').substring(0, 40);
      
      console.log(`| ${owner} | ${count} | ${sources} |`);
    }
    
    // Show detailed breakdown
    console.log('\n## Detailed Breakdown\n');
    const details = await allRows(
      conn,
      `SELECT 
        campaign_id,
        campaign_name,
        owner,
        media_source,
        lane,
        category
      FROM campaign_launches
      WHERE first_seen_date = '${date}'
      ORDER BY owner, media_source, campaign_name
      LIMIT 100`
    );
    
    if (details.length > 0) {
      console.log('| Campaign ID | Campaign Name | Owner | Media Source | Lane | Category |');
      console.log('|-------------|---------------|-------|--------------|------|----------|');
      
      for (const row of details) {
        const campaignId = String(row.campaign_id || '').substring(0, 11);
        const campaignName = String(row.campaign_name || 'N/A').substring(0, 13);
        const owner = String(row.owner || 'UNKNOWN').substring(0, 5);
        const mediaSource = String(row.media_source || 'N/A').substring(0, 12);
        const lane = String(row.lane || 'N/A').substring(0, 4);
        const category = String(row.category || 'N/A').substring(0, 7);
        
        console.log(`| ${campaignId} | ${campaignName} | ${owner} | ${mediaSource} | ${lane} | ${category} |`);
      }
      
      if (details.length === 100) {
        const totalForDate = await allRows(
          conn,
          `SELECT COUNT(*) as total FROM campaign_launches WHERE first_seen_date = '${date}'`
        );
        const totalCount = Number(totalForDate[0]?.total || 0);
        if (totalCount > 100) {
          console.log(`\n... and ${totalCount - 100} more campaigns`);
        }
      }
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

