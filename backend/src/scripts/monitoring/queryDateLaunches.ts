#!/usr/bin/env ts-node

/**
 * Query all campaign launches for a specific date, grouped by buyer, network, and site
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
    
    console.log(`\n# Campaign Launches for ${date}\n`);
    
    // Get all launches for this date, grouped by buyer, network, and site
    const launches = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.owner, 'UNKNOWN') as owner,
        COALESCE(cl.media_source, 'UNKNOWN') as media_source,
        COALESCE(ci.rsoc_site, 'N/A') as site,
        COALESCE(ci.s1_google_account, 'N/A') as s1_account,
        COUNT(*) as campaign_count,
        SUM(ci.spend_usd) as total_spend,
        SUM(ci.revenue_usd) as total_revenue,
        SUM(ci.sessions) as total_sessions,
        SUM(ci.clicks) as total_clicks,
        SUM(ci.conversions) as total_conversions
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = '${date}'
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner, cl.media_source, ci.rsoc_site, ci.s1_google_account
      ORDER BY campaign_count DESC, cl.owner, cl.media_source, ci.rsoc_site`
    );
    
    if (launches.length === 0) {
      console.log(`No campaign launches found for ${date}.`);
      console.log(`\nNote: Make sure trackCampaignLaunches has been run for this date.`);
      console.log(`Run: npm run monitor:track-launches -- ${date}\n`);
      return;
    }
    
    const totalCampaigns = launches.reduce((sum, row) => sum + Number(row.campaign_count || 0), 0);
    console.log(`📊 **Total Campaigns Launched: ${totalCampaigns}**\n`);
    
    // Summary by Buyer
    console.log('## 👥 Summary by Buyer\n');
    const byBuyer = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.owner, 'UNKNOWN') as owner,
        COUNT(*) as campaign_count
      FROM campaign_launches cl
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.owner
      ORDER BY campaign_count DESC`
    );
    
    console.log('| Buyer | Campaigns | Percentage |');
    console.log('|-------|-----------|------------|');
    for (const row of byBuyer) {
      const buyer = String(row.owner || 'UNKNOWN');
      const count = Number(row.campaign_count || 0);
      const percentage = ((count / totalCampaigns) * 100).toFixed(1);
      console.log(`| ${buyer.padEnd(11)} | ${String(count).padStart(9)} | ${percentage.padStart(10)}% |`);
    }
    
    // Summary by Network
    console.log('\n## 🌐 Summary by Network\n');
    const byNetwork = await allRows(
      conn,
      `SELECT 
        COALESCE(cl.media_source, 'UNKNOWN') as media_source,
        COUNT(*) as campaign_count
      FROM campaign_launches cl
      WHERE cl.first_seen_date = '${date}'
      GROUP BY cl.media_source
      ORDER BY campaign_count DESC`
    );
    
    console.log('| Network | Campaigns | Percentage |');
    console.log('|---------|-----------|------------|');
    for (const row of byNetwork) {
      const network = String(row.media_source || 'UNKNOWN');
      const count = Number(row.campaign_count || 0);
      const percentage = ((count / totalCampaigns) * 100).toFixed(1);
      console.log(`| ${network.padEnd(7)} | ${String(count).padStart(9)} | ${percentage.padStart(10)}% |`);
    }
    
    // Summary by Site
    console.log('\n## 🌍 Summary by Site\n');
    const bySite = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.rsoc_site, 'N/A') as site,
        COALESCE(ci.s1_google_account, 'N/A') as s1_account,
        COUNT(*) as campaign_count
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = '${date}'
      WHERE cl.first_seen_date = '${date}'
      GROUP BY ci.rsoc_site, ci.s1_google_account
      ORDER BY campaign_count DESC`
    );
    
    console.log('| Site | S1 Google Account | Campaigns | Percentage |');
    console.log('|------|-------------------|-----------|------------|');
    for (const row of bySite) {
      const site = String(row.site || 'N/A').substring(0, 20).padEnd(20);
      const s1Account = String(row.s1_account || 'N/A').substring(0, 17).padEnd(17);
      const count = Number(row.campaign_count || 0);
      const percentage = ((count / totalCampaigns) * 100).toFixed(1);
      console.log(`| ${site} | ${s1Account} | ${String(count).padStart(9)} | ${percentage.padStart(10)}% |`);
    }
    
    // Detailed breakdown: Buyer → Network → Site
    console.log('\n## 📋 Detailed Breakdown: Buyer → Network → Site\n');
    console.log('| Buyer | Network | Site | S1 Google Account | Campaigns | Spend | Revenue | Sessions | Clicks |');
    console.log('|-------|---------|------|-------------------|-----------|-------|---------|----------|--------|');
    
    for (const row of launches) {
      const buyer = String(row.owner || 'UNKNOWN').substring(0, 11).padEnd(11);
      const network = String(row.media_source || 'UNKNOWN').substring(0, 7).padEnd(7);
      const site = String(row.site || 'N/A').substring(0, 20).padEnd(20);
      const s1Account = String(row.s1_account || 'N/A').substring(0, 17).padEnd(17);
      const count = String(row.campaign_count).padStart(9);
      const spend = `$${Number(row.total_spend || 0).toFixed(2)}`.padStart(5);
      const revenue = `$${Number(row.total_revenue || 0).toFixed(2)}`.padStart(7);
      const sessions = Number(row.total_sessions || 0).toLocaleString().padStart(8);
      const clicks = Number(row.total_clicks || 0).toLocaleString().padStart(6);
      
      console.log(`| ${buyer} | ${network} | ${site} | ${s1Account} | ${count} | ${spend} | ${revenue} | ${sessions} | ${clicks} |`);
    }
    
    // Top combinations summary
    console.log('\n## 🔥 Top 20 Buyer-Network-Site Combinations\n');
    const topCombos = launches.slice(0, 20);
    for (let i = 0; i < topCombos.length; i++) {
      const combo = topCombos[i];
      const buyer = String(combo.owner || 'UNKNOWN');
      const network = String(combo.media_source || 'UNKNOWN');
      const site = String(combo.site || 'N/A');
      const count = Number(combo.campaign_count || 0);
      console.log(`${i + 1}. **${buyer}** → **${network}** → **${site}**: ${count} campaigns`);
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

