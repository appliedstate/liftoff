#!/usr/bin/env ts-node

/**
 * Query campaign launches for a specific date, broken down by buyer, network, and site
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
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
    await initMonitoringSchema(conn);
    
    console.log(`\n# Campaign Launches for ${date}\n`);
    
    // Check if we have any launches for this date
    const launches = await allRows(
      conn,
      `SELECT 
        cl.owner,
        cl.media_source,
        ci.rsoc_site,
        ci.s1_google_account,
        COUNT(*) as launch_count
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = '${date}'
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner, cl.media_source, ci.rsoc_site, ci.s1_google_account
      ORDER BY launch_count DESC, cl.owner, cl.media_source, ci.rsoc_site`
    );
    
    if (launches.length === 0) {
      console.log(`No campaign launches found for ${date}.`);
      console.log(`\nNote: Make sure trackCampaignLaunches has been run for this date.`);
      console.log(`Run: npm run monitor:track-launches -- ${date}\n`);
      return;
    }
    
    const total = launches.reduce((sum, row) => sum + Number(row.launch_count || 0), 0);
    
    console.log(`Total Campaigns Launched: ${total}\n`);
    
    // Summary by buyer
    console.log('## Summary by Buyer\n');
    const byBuyer = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.owner, 'UNKNOWN') as owner,
        COUNT(*) as launch_count
      FROM campaign_launches cl
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner
      ORDER BY launch_count DESC`
    );
    
    console.log('| Buyer | Launches |');
    console.log('|-------|----------|');
    for (const row of byBuyer) {
      console.log(`| ${String(row.owner || 'UNKNOWN').padEnd(11)} | ${String(row.launch_count).padStart(8)} |`);
    }
    
    // Summary by network
    console.log('\n## Summary by Network\n');
    const byNetwork = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.media_source, 'UNKNOWN') as media_source,
        COUNT(*) as launch_count
      FROM campaign_launches cl
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.media_source
      ORDER BY launch_count DESC`
    );
    
    console.log('| Network | Launches |');
    console.log('|--------|----------|');
    for (const row of byNetwork) {
      console.log(`| ${String(row.media_source || 'UNKNOWN').padEnd(6)} | ${String(row.launch_count).padStart(8)} |`);
    }
    
    // Detailed breakdown by buyer, network, and site
    console.log('\n## Detailed Breakdown by Buyer, Network, and Site\n');
    console.log('| Buyer | Network | Site | S1 Google Account | Launches |');
    console.log('|-------|---------|------|-------------------|----------|');
    
    for (const row of launches) {
      const owner = String(row.owner || 'UNKNOWN').padEnd(11);
      const network = String(row.media_source || 'UNKNOWN').padEnd(7);
      const site = String(row.rsoc_site || 'N/A').padEnd(4);
      const s1Account = String(row.s1_google_account || 'N/A').padEnd(17);
      const count = String(row.launch_count).padStart(8);
      
      console.log(`| ${owner} | ${network} | ${site} | ${s1Account} | ${count} |`);
    }
    
    // Show campaign list
    console.log('\n## Campaign Details\n');
    const campaignDetails = await allRows(
      conn,
      `SELECT 
        cl.campaign_id,
        cl.campaign_name,
        cl.owner,
        cl.media_source,
        cl.lane,
        cl.category,
        ci.rsoc_site,
        ci.s1_google_account
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = '${date}'
      WHERE cl.first_seen_date = '${date}'
      ORDER BY cl.owner, cl.media_source, ci.rsoc_site, cl.campaign_name
      LIMIT 200`
    );
    
    if (campaignDetails.length > 0) {
      console.log('| Campaign ID | Campaign Name | Buyer | Network | Site | S1 Account | Lane | Category |');
      console.log('|-------------|---------------|-------|---------|------|------------|------|----------|');
      
      for (const row of campaignDetails) {
        const campaignId = String(row.campaign_id || '').substring(0, 12);
        const campaignName = String(row.campaign_name || 'N/A').substring(0, 13);
        const owner = String(row.owner || 'UNKNOWN').substring(0, 5);
        const network = String(row.media_source || 'N/A').substring(0, 7);
        const site = String(row.rsoc_site || 'N/A').substring(0, 4);
        const s1Account = String(row.s1_google_account || 'N/A').substring(0, 10);
        const lane = String(row.lane || 'N/A').substring(0, 4);
        const category = String(row.category || 'N/A').substring(0, 7);
        
        console.log(`| ${campaignId} | ${campaignName} | ${owner} | ${network} | ${site} | ${s1Account} | ${lane} | ${category} |`);
      }
      
      const totalForDate = await allRows(
        conn,
        `SELECT COUNT(*) as total FROM campaign_launches WHERE first_seen_date = '${date}'`
      );
      const totalCount = Number(totalForDate[0]?.total || 0);
      if (totalCount > 200) {
        console.log(`\n... and ${totalCount - 200} more campaigns`);
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

