#!/usr/bin/env ts-node

/**
 * Query specific buyer-network-site activity over a date range
 * Shows detailed campaign information and performance metrics
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
  const siteArg = process.argv[4];
  const daysArg = process.argv[5] || '2';
  
  if (!buyerArg || !networkArg || !siteArg) {
    console.log('Usage: npm run monitor:buyer-activity -- <buyer> <network> <site> [days]');
    console.log('Example: npm run monitor:buyer-activity -- Cook taboola wesoughtit.com 2');
    return;
  }
  
  const days = parseInt(daysArg, 10);
  const endDate = getTodayPST();
  const startDate = getDaysAgoPST(days - 1);
  
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log(`\n# ${buyerArg} Activity: ${networkArg} → ${siteArg}`);
    console.log(`Date Range: ${startDate} to ${endDate} (${days} days)\n`);
    
    // Get campaign launches for this buyer-network-site combination
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
        AND cl.owner = '${buyerArg}'
        AND cl.media_source = '${networkArg}'
        AND (ci.rsoc_site = '${siteArg}' OR ci.rsoc_site IS NULL)
      ORDER BY cl.first_seen_date DESC, cl.campaign_name`
    );
    
    if (launches.length === 0) {
      console.log(`No campaigns found for ${buyerArg} on ${networkArg} → ${siteArg} in this date range.`);
      console.log(`\nNote: Make sure campaign launches have been tracked for these dates.`);
      return;
    }
    
    // Group by date
    const byDate: Record<string, any[]> = {};
    for (const launch of launches) {
      const date = String(launch.first_seen_date);
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(launch);
    }
    
    // Summary stats
    const totalCampaigns = launches.length;
    const totalSpend = launches.reduce((sum, l) => sum + (Number(l.spend_usd) || 0), 0);
    const totalRevenue = launches.reduce((sum, l) => sum + (Number(l.revenue_usd) || 0), 0);
    const totalSessions = launches.reduce((sum, l) => sum + (Number(l.sessions) || 0), 0);
    const totalClicks = launches.reduce((sum, l) => sum + (Number(l.clicks) || 0), 0);
    const avgROAS = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
    
    console.log(`## Summary\n`);
    console.log(`- **Total Campaigns**: ${totalCampaigns}`);
    console.log(`- **Total Spend**: $${totalSpend.toFixed(2)}`);
    console.log(`- **Total Revenue**: $${totalRevenue.toFixed(2)}`);
    console.log(`- **Total Sessions**: ${totalSessions.toLocaleString()}`);
    console.log(`- **Total Clicks**: ${totalClicks.toLocaleString()}`);
    console.log(`- **Average ROAS**: ${avgROAS.toFixed(2)}x`);
    console.log(`- **S1 Google Account**: ${launches[0]?.s1_google_account || 'N/A'}\n`);
    
    // Breakdown by date
    console.log(`## Breakdown by Date\n`);
    const sortedDates = Object.keys(byDate).sort().reverse();
    
    for (const date of sortedDates) {
      const dateCampaigns = byDate[date];
      const dateSpend = dateCampaigns.reduce((sum, l) => sum + (Number(l.spend_usd) || 0), 0);
      const dateRevenue = dateCampaigns.reduce((sum, l) => sum + (Number(l.revenue_usd) || 0), 0);
      const dateROAS = dateSpend > 0 ? (dateRevenue / dateSpend) : 0;
      
      console.log(`### ${date} (${dateCampaigns.length} campaigns)`);
      console.log(`- Spend: $${dateSpend.toFixed(2)} | Revenue: $${dateRevenue.toFixed(2)} | ROAS: ${dateROAS.toFixed(2)}x\n`);
      
      // Show campaign details
      console.log('| Campaign ID | Campaign Name | Category | Spend | Revenue | Sessions | Clicks | ROAS |');
      console.log('|-------------|---------------|----------|-------|---------|----------|--------|------|');
      
      for (const campaign of dateCampaigns) {
        const campaignId = String(campaign.campaign_id || '').substring(0, 11);
        const campaignName = String(campaign.campaign_name || 'N/A').substring(0, 13);
        const category = String(campaign.category || 'N/A').substring(0, 7);
        const spend = (Number(campaign.spend_usd) || 0).toFixed(2);
        const revenue = (Number(campaign.revenue_usd) || 0).toFixed(2);
        const sessions = Number(campaign.sessions || 0).toLocaleString();
        const clicks = Number(campaign.clicks || 0).toLocaleString();
        const roas = campaign.roas ? Number(campaign.roas).toFixed(2) : 'N/A';
        
        console.log(`| ${campaignId} | ${campaignName} | ${category} | $${spend} | $${revenue} | ${sessions} | ${clicks} | ${roas} |`);
      }
      console.log('');
    }
    
    // Performance insights
    console.log(`## Performance Insights\n`);
    
    const campaignsWithData = launches.filter(l => Number(l.spend_usd || 0) > 0 || Number(l.revenue_usd || 0) > 0);
    const campaignsWithoutData = launches.filter(l => Number(l.spend_usd || 0) === 0 && Number(l.revenue_usd || 0) === 0);
    
    if (campaignsWithData.length > 0) {
      const topPerformers = launches
        .filter(l => Number(l.revenue_usd || 0) > 0)
        .sort((a, b) => Number(b.revenue_usd || 0) - Number(a.revenue_usd || 0))
        .slice(0, 5);
      
      if (topPerformers.length > 0) {
        console.log('**Top Performing Campaigns by Revenue:**');
        for (const campaign of topPerformers) {
          const name = String(campaign.campaign_name || campaign.campaign_id).substring(0, 40);
          const revenue = Number(campaign.revenue_usd || 0).toFixed(2);
          const spend = Number(campaign.spend_usd || 0).toFixed(2);
          const roas = campaign.roas ? Number(campaign.roas).toFixed(2) : 'N/A';
          console.log(`- ${name}: $${revenue} revenue, $${spend} spend, ${roas}x ROAS`);
        }
        console.log('');
      }
    }
    
    if (campaignsWithoutData.length > 0) {
      console.log(`⚠️  **Note**: ${campaignsWithoutData.length} campaigns have no spend/revenue data yet.`);
      console.log(`   This is normal for newly launched campaigns - data may take time to populate.\n`);
    }
    
    // Category breakdown
    const byCategory: Record<string, number> = {};
    for (const launch of launches) {
      const category = String(launch.category || 'N/A');
      byCategory[category] = (byCategory[category] || 0) + 1;
    }
    
    if (Object.keys(byCategory).length > 0) {
      console.log(`## Category Breakdown\n`);
      for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
        console.log(`- **${category}**: ${count} campaigns`);
      }
      console.log('');
    }
    
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

