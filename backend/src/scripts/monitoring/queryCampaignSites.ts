#!/usr/bin/env ts-node

/**
 * Query script to show campaigns with their rsoc_site and S1 Google AdSense account mappings
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const mediaSource = process.argv[3] || null; // Optional filter by media_source
  const conn = createMonitoringConnection();
  
  try {
    console.log(`\n=== Campaigns with Site & S1 Google Account Mappings for ${date} ===\n`);
    
    // Build query with optional media_source filter
    let whereClause = `date = '${date}'`;
    if (mediaSource) {
      whereClause += ` AND media_source = '${mediaSource}'`;
    }
    
    // Get campaigns with site mappings
    const campaigns = await allRows(
      conn,
      `SELECT 
        campaign_id,
        campaign_name,
        media_source,
        owner,
        lane,
        category,
        rsoc_site,
        s1_google_account,
        revenue_usd,
        sessions,
        spend_usd,
        CASE 
          WHEN spend_usd > 0 THEN revenue_usd / spend_usd
          ELSE NULL
        END as roas
      FROM campaign_index
      WHERE ${whereClause}
        AND (rsoc_site IS NOT NULL OR s1_google_account IS NOT NULL)
      ORDER BY revenue_usd DESC
      LIMIT 50`
    );
    
    if (campaigns.length === 0) {
      console.log('No campaigns with site mappings found for this date.');
      
      // Check if any campaigns exist at all
      const anyCampaigns = await allRows(
        conn,
        `SELECT COUNT(*) as total
        FROM campaign_index
        WHERE ${whereClause}`
      );
      
      if (anyCampaigns[0] && Number(anyCampaigns[0].total) > 0) {
        console.log(`\nNote: Found ${anyCampaigns[0].total} campaigns but none have rsoc_site or s1_google_account populated.`);
        console.log('This may indicate that S1 Daily reports are not returning rsocSite field.');
      }
      return;
    }
    
    console.log(`Found ${campaigns.length} campaigns with site mappings\n`);
    
    // Group by S1 Google Account
    const byAccount = await allRows(
      conn,
      `SELECT 
        COALESCE(s1_google_account, 'UNMAPPED') as account,
        COUNT(DISTINCT campaign_id) as campaign_count,
        COUNT(DISTINCT rsoc_site) as site_count,
        SUM(revenue_usd) as total_revenue,
        SUM(sessions) as total_sessions,
        SUM(spend_usd) as total_spend
      FROM campaign_index
      WHERE ${whereClause}
      GROUP BY s1_google_account
      ORDER BY total_revenue DESC`
    );
    
    if (byAccount.length > 0) {
      console.log('📊 Revenue by S1 Google AdSense Account:\n');
      console.log('┌─────────────────────┬────────────┬──────────────┬─────────────┬──────────────┬──────────────┐');
      console.log('│ S1 Google Account  │ Campaigns  │ Sites        │ Revenue    │ Sessions     │ Spend        │');
      console.log('├─────────────────────┼────────────┼──────────────┼─────────────┼──────────────┼──────────────┤');
      
      let totalCampaigns = 0;
      let totalRevenue = 0;
      let totalSessions = 0;
      let totalSpend = 0;
      
      for (const row of byAccount) {
        const account = String(row.account || 'UNMAPPED').substring(0, 19).padEnd(19);
        const campaigns = Number(row.campaign_count || 0);
        const sites = Number(row.site_count || 0);
        const revenue = Number(row.total_revenue || 0);
        const sessions = Number(row.total_sessions || 0);
        const spend = Number(row.total_spend || 0);
        
        totalCampaigns += campaigns;
        totalRevenue += revenue;
        totalSessions += sessions;
        totalSpend += spend;
        
        console.log(`│ ${account} │ ${campaigns.toString().padStart(10)} │ ${sites.toString().padStart(12)} │ $${revenue.toFixed(2).padStart(10)} │ ${sessions.toFixed(0).padStart(12)} │ $${spend.toFixed(2).padStart(12)} │`);
      }
      
      console.log('├─────────────────────┼────────────┼──────────────┼─────────────┼──────────────┼──────────────┤');
      console.log(`│ TOTAL               │ ${totalCampaigns.toString().padStart(10)} │              │ $${totalRevenue.toFixed(2).padStart(10)} │ ${totalSessions.toFixed(0).padStart(12)} │ $${totalSpend.toFixed(2).padStart(12)} │`);
      console.log('└─────────────────────┴────────────┴──────────────┴─────────────┴──────────────┴──────────────┘');
    }
    
    // Show detailed campaign list
    console.log('\n📋 Campaign Details (with Site & Account Mappings):\n');
    console.log('┌──────────────┬──────────────────────────────────────────┬──────────────┬─────────────────────┬─────────────────────┬──────────────┬─────────────┐');
    console.log('│ Campaign ID  │ Campaign Name                             │ Media Source │ RSOC Site           │ S1 Google Account   │ Revenue      │ Sessions    │');
    console.log('├──────────────┼──────────────────────────────────────────┼──────────────┼─────────────────────┼─────────────────────┼──────────────┼─────────────┤');
    
    for (const row of campaigns) {
      const campaignId = String(row.campaign_id || '').substring(0, 12).padEnd(12);
      const campaignName = String(row.campaign_name || 'N/A').substring(0, 40).padEnd(40);
      const mediaSource = String(row.media_source || 'UNKNOWN').substring(0, 12).padEnd(12);
      const rsocSite = String(row.rsoc_site || 'N/A').substring(0, 19).padEnd(19);
      const s1Account = String(row.s1_google_account || 'N/A').substring(0, 19).padEnd(19);
      const revenue = Number(row.revenue_usd || 0);
      const sessions = Number(row.sessions || 0);
      
      console.log(`│ ${campaignId} │ ${campaignName} │ ${mediaSource} │ ${rsocSite} │ ${s1Account} │ $${revenue.toFixed(2).padStart(11)} │ ${sessions.toFixed(0).padStart(11)} │`);
    }
    
    console.log('└──────────────┴──────────────────────────────────────────┴──────────────┴─────────────────────┴─────────────────────┴──────────────┴─────────────┘');
    
    if (campaigns.length === 50) {
      const totalWithSites = await allRows(
        conn,
        `SELECT COUNT(*) as total
        FROM campaign_index
        WHERE ${whereClause}
          AND (rsoc_site IS NOT NULL OR s1_google_account IS NOT NULL)`
      );
      const total = Number(totalWithSites[0]?.total || 0);
      if (total > 50) {
        console.log(`\n... and ${total - 50} more campaigns with site mappings`);
      }
    }
    
    // Show site to account mapping summary
    const siteMapping = await allRows(
      conn,
      `SELECT 
        rsoc_site,
        s1_google_account,
        COUNT(DISTINCT campaign_id) as campaign_count,
        SUM(revenue_usd) as revenue
      FROM campaign_index
      WHERE ${whereClause}
        AND rsoc_site IS NOT NULL
      GROUP BY rsoc_site, s1_google_account
      ORDER BY revenue DESC
      LIMIT 20`
    );
    
    if (siteMapping.length > 0) {
      console.log('\n📍 Site → S1 Google Account Mapping:\n');
      console.log('┌─────────────────────┬─────────────────────┬────────────┬──────────────┐');
      console.log('│ RSOC Site          │ S1 Google Account   │ Campaigns  │ Revenue     │');
      console.log('├─────────────────────┼─────────────────────┼────────────┼──────────────┤');
      
      for (const row of siteMapping) {
        const site = String(row.rsoc_site || 'N/A').substring(0, 19).padEnd(19);
        const account = String(row.s1_google_account || 'UNMAPPED').substring(0, 19).padEnd(19);
        const campaigns = Number(row.campaign_count || 0);
        const revenue = Number(row.revenue || 0);
        
        console.log(`│ ${site} │ ${account} │ ${campaigns.toString().padStart(10)} │ $${revenue.toFixed(2).padStart(11)} │`);
      }
      
      console.log('└─────────────────────┴─────────────────────┴────────────┴──────────────┘');
    }
    
    // Coverage statistics
    const coverage = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total_campaigns,
        COUNT(DISTINCT rsoc_site) as unique_sites,
        COUNT(DISTINCT s1_google_account) as unique_accounts,
        COUNT(CASE WHEN rsoc_site IS NOT NULL THEN 1 END) as campaigns_with_site,
        COUNT(CASE WHEN s1_google_account IS NOT NULL THEN 1 END) as campaigns_with_account
      FROM campaign_index
      WHERE ${whereClause}`
    );
    
    if (coverage.length > 0) {
      const stats = coverage[0];
      console.log('\n📈 Coverage Statistics:');
      console.log(`  Total Campaigns: ${Number(stats.total_campaigns || 0)}`);
      console.log(`  Campaigns with RSOC Site: ${Number(stats.campaigns_with_site || 0)}`);
      console.log(`  Campaigns with S1 Google Account: ${Number(stats.campaigns_with_account || 0)}`);
      console.log(`  Unique RSOC Sites: ${Number(stats.unique_sites || 0)}`);
      console.log(`  Unique S1 Google Accounts: ${Number(stats.unique_accounts || 0)}`);
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

