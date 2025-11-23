#!/usr/bin/env ts-node

/**
 * Summarize campaign launches in a more digestible format
 * Groups by buyer, network, and site with clear totals
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getPSTDate(date: Date): string {
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
    
    console.log(`\n# Campaign Launch Summary for ${date}\n`);
    
    // Get total launches
    const totalResult = await allRows(
      conn,
      `SELECT COUNT(*) as total FROM campaign_launches WHERE first_seen_date = '${date}'`
    );
    const total = Number(totalResult[0]?.total || 0);
    
    if (total === 0) {
      console.log(`No campaign launches found for ${date}.`);
      console.log(`\nNote: Make sure trackCampaignLaunches has been run for this date.`);
      console.log(`Run: npm run monitor:track-launches -- ${date}\n`);
      return;
    }
    
    console.log(`📊 **Total Campaigns Launched: ${total}**\n`);
    
    // Summary by Buyer (top buyers)
    console.log('## 👥 Top Buyers\n');
    const byBuyer = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.owner, 'UNKNOWN') as owner,
        COUNT(*) as launch_count,
        GROUP_CONCAT(DISTINCT cl.media_source) as networks
      FROM campaign_launches cl
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner
      ORDER BY launch_count DESC
      LIMIT 10`
    );
    
    for (const row of byBuyer) {
      const owner = String(row.owner || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      const networks = String(row.networks || '').split(',').filter(Boolean).join(', ');
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`- **${owner}**: ${count} campaigns (${percentage}%) - Networks: ${networks || 'N/A'}`);
    }
    
    // Summary by Network
    console.log('\n## 🌐 By Network\n');
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
    
    for (const row of byNetwork) {
      const network = String(row.media_source || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`- **${network}**: ${count} campaigns (${percentage}%)`);
    }
    
    // Top buyer-network combinations
    console.log('\n## 🔥 Top Buyer-Network Combinations\n');
    const byBuyerNetwork = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.owner, 'UNKNOWN') as owner,
        COALESCE(cl.media_source, 'UNKNOWN') as media_source,
        COUNT(*) as launch_count
      FROM campaign_launches cl
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner, cl.media_source
      ORDER BY launch_count DESC
      LIMIT 15`
    );
    
    for (const row of byBuyerNetwork) {
      const owner = String(row.owner || 'UNKNOWN');
      const network = String(row.media_source || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      console.log(`- **${owner}** on **${network}**: ${count} campaigns`);
    }
    
    // Top sites
    console.log('\n## 🌍 Top Sites\n');
    const bySite = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.rsoc_site, 'N/A') as site,
        COALESCE(ci.s1_google_account, 'N/A') as s1_account,
        COUNT(*) as launch_count
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = '${date}'
      WHERE cl.first_seen_date = '${date}'
      GROUP BY ci.rsoc_site, ci.s1_google_account
      ORDER BY launch_count DESC
      LIMIT 10`
    );
    
    for (const row of bySite) {
      const site = String(row.site || 'N/A');
      const s1Account = String(row.s1_google_account || 'N/A');
      const count = Number(row.launch_count || 0);
      console.log(`- **${site}** (${s1Account}): ${count} campaigns`);
    }
    
    // Buyer-Network-Site breakdown (top combinations)
    console.log('\n## 📋 Top Buyer-Network-Site Combinations\n');
    const byBuyerNetworkSite = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.owner, 'UNKNOWN') as owner,
        COALESCE(cl.media_source, 'UNKNOWN') as media_source,
        COALESCE(ci.rsoc_site, 'N/A') as site,
        COALESCE(ci.s1_google_account, 'N/A') as s1_account,
        COUNT(*) as launch_count
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = '${date}'
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner, cl.media_source, ci.rsoc_site, ci.s1_google_account
      ORDER BY launch_count DESC
      LIMIT 20`
    );
    
    for (const row of byBuyerNetworkSite) {
      const owner = String(row.owner || 'UNKNOWN');
      const network = String(row.media_source || 'UNKNOWN');
      const site = String(row.site || 'N/A');
      const s1Account = String(row.s1_google_account || 'N/A');
      const count = Number(row.launch_count || 0);
      console.log(`- **${owner}** → **${network}** → **${site}** (${s1Account}): ${count} campaigns`);
    }
    
    // Unknown campaigns warning
    const unknownCount = await allRows(
      conn,
      `SELECT COUNT(*) as count FROM campaign_launches 
       WHERE first_seen_date = '${date}' 
       AND (owner IS NULL OR owner = 'UNKNOWN' OR owner = '')`
    );
    const unknownTotal = Number(unknownCount[0]?.count || 0);
    
    if (unknownTotal > 0) {
      console.log(`\n⚠️  **Note**: ${unknownTotal} campaigns (${((unknownTotal / total) * 100).toFixed(1)}%) have UNKNOWN owner.`);
      console.log(`   These may be historical campaigns or campaigns missing buyer data.`);
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

