#!/usr/bin/env ts-node

/**
 * Query specific buyer-network-site activity for a date range
 * Shows campaign launches and performance metrics
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

function getDaysAgoPST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPSTDate(date);
}

async function main() {
  const buyerArg = process.argv[2];
  const networkArg = process.argv[3];
  const arg3 = process.argv[4];
  const arg4 = process.argv[5];
  const debug = process.argv.includes('--debug');
  
  if (!buyerArg || !networkArg) {
    console.log('Usage: npm run monitor:buyer-activity -- <buyer> <network> [site] [days_back] [--debug]');
    console.log('Example (all sites, 2 days): npm run monitor:buyer-activity -- Cook taboola 2');
    console.log('Example (specific site, 2 days): npm run monitor:buyer-activity -- Cook taboola wesoughtit.com 2');
    console.log('Example (with debug): npm run monitor:buyer-activity -- Cook taboola wesoughtit.com 2 --debug');
    return;
  }
  
  // Smart argument parsing: if arg3 is a number, it's days_back, not a site
  let site: string | undefined;
  let daysBack: number;
  
  if (arg3 && !isNaN(parseInt(arg3))) {
    // arg3 is a number, so it's days_back (no site specified)
    daysBack = parseInt(arg3, 10);
    site = undefined;
  } else if (arg3) {
    // arg3 is a string, so it's a site name
    site = arg3;
    daysBack = arg4 && !isNaN(parseInt(arg4)) ? parseInt(arg4, 10) : 2;
  } else {
    // No arg3, default to 2 days, all sites
    daysBack = 2;
    site = undefined;
  }
  
  const buyer = buyerArg;
  const network = networkArg;
  const endDate = getTodayPST();
  const startDate = getDaysAgoPST(daysBack - 1);
  
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    const siteFilter = site ? ` → ${site}` : ' (All Sites)';
    console.log(`\n# ${buyer} Activity: ${network}${siteFilter}`);
    console.log(`Date Range: ${startDate} to ${endDate} (Last ${daysBack} days)\n`);
    
    // Build query with optional site filter
    const siteCondition = site ? `AND ci.rsoc_site = '${site}'` : '';
    
    // Get campaign launches for this buyer-network combination (optionally filtered by site)
    const launches = await allRows(
      conn,
      `SELECT 
        cl.campaign_id,
        cl.campaign_name,
        cl.first_seen_date,
        cl.owner,
        cl.media_source,
        cl.lane,
        cl.category,
        ci.rsoc_site,
        ci.s1_google_account,
        ci.spend_usd,
        ci.revenue_usd,
        ci.sessions,
        ci.clicks,
        ci.conversions,
        ci.roas
      FROM campaign_launches cl
      LEFT JOIN campaign_index ci 
        ON cl.campaign_id = ci.campaign_id 
        AND ci.date = cl.first_seen_date
      WHERE cl.first_seen_date >= '${startDate}'
        AND cl.first_seen_date <= '${endDate}'
        AND cl.owner = '${buyer}'
        AND cl.media_source = '${network}'
        ${siteCondition}
      ORDER BY ci.rsoc_site, cl.first_seen_date DESC, cl.campaign_name`
    );
    
    if (launches.length === 0) {
      const siteText = site ? ` + ${site}` : '';
      console.log(`No campaigns found for ${buyer} + ${network}${siteText} in this date range.`);
      console.log(`\nChecking what data exists...`);
      
      // Debug: show what buyer-network-site combinations exist
      const availableCombos = await allRows(
        conn,
        `SELECT DISTINCT
          cl.owner,
          cl.media_source,
          ci.rsoc_site,
          COUNT(*) as count
        FROM campaign_launches cl
        LEFT JOIN campaign_index ci 
          ON cl.campaign_id = ci.campaign_id 
          AND ci.date = cl.first_seen_date
        WHERE cl.first_seen_date >= '${startDate}'
          AND cl.first_seen_date <= '${endDate}'
        GROUP BY cl.owner, cl.media_source, ci.rsoc_site
        ORDER BY count DESC
        LIMIT 20`
      );
      
      if (availableCombos.length > 0) {
        console.log('\nAvailable buyer-network-site combinations in this date range:');
        console.log('| Buyer | Network | Site | Count |');
        console.log('|-------|---------|------|-------|');
        for (const combo of availableCombos) {
          console.log(`| ${String(combo.owner || 'NULL').padEnd(5)} | ${String(combo.media_source || 'NULL').padEnd(7)} | ${String(combo.rsoc_site || 'NULL').padEnd(4)} | ${String(combo.count).padStart(5)} |`);
        }
      }
      return;
    }
    
    // If no site filter, show breakdown by site first
    if (!site) {
      const bySite = await allRows(
        conn,
        `SELECT 
          COALESCE(ci.rsoc_site, 'N/A') as site,
          COALESCE(ci.s1_google_account, 'N/A') as s1_account,
          COUNT(*) as campaign_count,
          SUM(ci.spend_usd) as total_spend,
          SUM(ci.revenue_usd) as total_revenue,
          SUM(ci.sessions) as total_sessions,
          SUM(ci.clicks) as total_clicks
        FROM campaign_launches cl
        LEFT JOIN campaign_index ci 
          ON cl.campaign_id = ci.campaign_id 
          AND ci.date = cl.first_seen_date
        WHERE cl.first_seen_date >= '${startDate}'
          AND cl.first_seen_date <= '${endDate}'
          AND cl.owner = '${buyer}'
          AND cl.media_source = '${network}'
        GROUP BY ci.rsoc_site, ci.s1_google_account
        ORDER BY campaign_count DESC`
      );
      
      if (bySite.length > 0) {
        console.log('## 📊 Breakdown by Site\n');
        console.log('| Site | S1 Google Account | Campaigns | Spend | Revenue | Sessions | Clicks |');
        console.log('|------|-------------------|-----------|-------|---------|----------|--------|');
        for (const row of bySite) {
          const siteName = String(row.site || 'N/A').padEnd(20);
          const s1Account = String(row.s1_account || 'N/A').substring(0, 17).padEnd(17);
          const count = String(row.campaign_count).padStart(9);
          const spend = `$${Number(row.total_spend || 0).toFixed(2)}`.padStart(5);
          const revenue = `$${Number(row.total_revenue || 0).toFixed(2)}`.padStart(7);
          const sessions = Number(row.total_sessions || 0).toLocaleString().padStart(8);
          const clicks = Number(row.total_clicks || 0).toLocaleString().padStart(6);
          console.log(`| ${siteName} | ${s1Account} | ${count} | ${spend} | ${revenue} | ${sessions} | ${clicks} |`);
        }
        console.log('');
      }
    }
    
    if (debug) {
      console.log('\n[DEBUG] Raw launch data:');
      console.log(JSON.stringify(launches, null, 2));
      console.log('');
    }
    
    // Group by site and date
    const bySiteAndDate: Record<string, Record<string, any[]>> = {};
    for (const launch of launches) {
      const site = String(launch.rsoc_site || 'N/A');
      const date = String(launch.first_seen_date);
      if (!bySiteAndDate[site]) {
        bySiteAndDate[site] = {};
      }
      if (!bySiteAndDate[site][date]) {
        bySiteAndDate[site][date] = [];
      }
      bySiteAndDate[site][date].push(launch);
    }
    
    // Group by date (for overall summary)
    const byDate: Record<string, any[]> = {};
    for (const launch of launches) {
      const date = String(launch.first_seen_date);
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(launch);
    }
    
    const totalCampaigns = launches.length;
    console.log(`📊 **Total Campaigns Launched: ${totalCampaigns}**\n`);
    
    // Helper function to show date breakdown
    function showDateBreakdown(date: string, campaigns: any[], siteLabel: string) {
      // Extract just the date part (YYYY-MM-DD) from the date string
      const dateOnly = date.includes('T') ? date.split('T')[0] : date.slice(0, 10);
      console.log(`## ${dateOnly} (${campaigns.length} campaigns)\n`);
      
      // Aggregate metrics for this date
      const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend_usd) || 0), 0);
      const totalRevenue = campaigns.reduce((sum, c) => sum + (Number(c.revenue_usd) || 0), 0);
      const totalSessions = campaigns.reduce((sum, c) => sum + (Number(c.sessions) || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0);
      const totalConversions = campaigns.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0);
      const avgROAS = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
      const rpc = totalClicks > 0 ? (totalRevenue / totalClicks) : 0;
      
      if (totalSpend > 0 || totalRevenue > 0) {
        console.log(`**Performance Summary:**`);
        console.log(`- Spend: $${totalSpend.toFixed(2)}`);
        console.log(`- Revenue: $${totalRevenue.toFixed(2)}`);
        console.log(`- ROAS: ${(avgROAS * 100).toFixed(1)}%`);
        console.log(`- Sessions: ${totalSessions.toLocaleString()}`);
        console.log(`- Clicks: ${totalClicks.toLocaleString()}`);
        console.log(`- Conversions: ${totalConversions.toLocaleString()}`);
        console.log(`- RPC: $${rpc.toFixed(4)}`);
        console.log('');
      }
      
      console.log('| Campaign ID | Campaign Name | Category | Lane | Spend | Revenue | ROAS | Sessions | Clicks | Conversions |');
      console.log('|-------------|---------------|----------|------|-------|---------|------|----------|--------|-------------|');
      
      for (const campaign of campaigns) {
        const campaignId = String(campaign.campaign_id || '').substring(0, 11);
        const campaignName = String(campaign.campaign_name || 'N/A').substring(0, 13);
        const category = String(campaign.category || 'N/A').substring(0, 7);
        const lane = String(campaign.lane || 'N/A').substring(0, 4);
        const spend = Number(campaign.spend_usd || 0).toFixed(2);
        const revenue = Number(campaign.revenue_usd || 0).toFixed(2);
        const roas = campaign.roas ? (Number(campaign.roas) * 100).toFixed(1) + '%' : 'N/A';
        const sessions = Number(campaign.sessions || 0).toLocaleString();
        const clicks = Number(campaign.clicks || 0).toLocaleString();
        const conversions = Number(campaign.conversions || 0).toLocaleString();
        
        console.log(`| ${campaignId} | ${campaignName} | ${category} | ${lane} | $${spend} | $${revenue} | ${roas} | ${sessions} | ${clicks} | ${conversions} |`);
      }
      
      // Show if any campaigns are missing performance data
      const missingData = campaigns.filter(c => 
        !c.spend_usd && !c.revenue_usd && !c.sessions && !c.clicks
      );
      if (missingData.length > 0) {
        console.log(`\n⚠️  Note: ${missingData.length} campaign(s) have no performance data in campaign_index for ${dateOnly}`);
        console.log(`   This may mean the campaign hasn't spent yet or data hasn't been ingested.`);
      }
      
      console.log('');
    }
    
    // Show breakdown by site and date (if multiple sites or no site filter)
    if (!site && Object.keys(bySiteAndDate).length > 0) {
      for (const [siteName, dates] of Object.entries(bySiteAndDate).sort()) {
        const siteCampaigns = Object.values(dates).flat();
        console.log(`\n## 🌍 Site: ${siteName} (${siteCampaigns.length} campaigns)\n`);
        
        for (const [date, campaigns] of Object.entries(dates).sort().reverse()) {
          showDateBreakdown(date, campaigns, siteName);
        }
      }
    } else {
      // Show breakdown by date (single site specified)
      for (const [date, campaigns] of Object.entries(byDate).sort().reverse()) {
        showDateBreakdown(date, campaigns, site || 'All Sites');
      }
    }
    
    // Overall summary
    const overallSpend = launches.reduce((sum, c) => sum + (Number(c.spend_usd) || 0), 0);
    const overallRevenue = launches.reduce((sum, c) => sum + (Number(c.revenue_usd) || 0), 0);
    const overallSessions = launches.reduce((sum, c) => sum + (Number(c.sessions) || 0), 0);
    const overallClicks = launches.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0);
    const overallConversions = launches.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0);
    const overallROAS = overallSpend > 0 ? (overallRevenue / overallSpend) : 0;
    const overallRPC = overallClicks > 0 ? (overallRevenue / overallClicks) : 0;
    
    console.log('## Overall Summary (All Dates)\n');
    console.log(`- **Total Campaigns**: ${totalCampaigns}`);
    console.log(`- **Total Spend**: $${overallSpend.toFixed(2)}`);
    console.log(`- **Total Revenue**: $${overallRevenue.toFixed(2)}`);
    console.log(`- **Overall ROAS**: ${(overallROAS * 100).toFixed(1)}%`);
    console.log(`- **Total Sessions**: ${overallSessions.toLocaleString()}`);
    console.log(`- **Total Clicks**: ${overallClicks.toLocaleString()}`);
    console.log(`- **Total Conversions**: ${overallConversions.toLocaleString()}`);
    console.log(`- **Overall RPC**: $${overallRPC.toFixed(4)}`);
    
    // Category breakdown
    const byCategory: Record<string, number> = {};
    for (const launch of launches) {
      const cat = String(launch.category || 'N/A');
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    
    if (Object.keys(byCategory).length > 0) {
      console.log('\n## Category Breakdown\n');
      for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
        console.log(`- **${category}**: ${count} campaigns`);
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
