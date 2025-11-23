#!/usr/bin/env ts-node

/**
 * Query script to show MediaGo campaigns by buyer/owner
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const conn = createMonitoringConnection();
  
  try {
    console.log(`\n=== MediaGo Campaigns by Buyer for ${date} ===\n`);
    
    // Get MediaGo campaigns grouped by buyer/owner
    const byBuyer = await allRows(
      conn,
      `SELECT 
        COALESCE(owner, 'UNKNOWN') as buyer,
        COUNT(DISTINCT campaign_id) as campaign_count,
        COUNT(DISTINCT campaign_name) as unique_campaign_names,
        SUM(revenue_usd) as total_revenue,
        SUM(sessions) as total_sessions,
        SUM(clicks) as total_clicks,
        SUM(spend_usd) as total_spend,
        CASE 
          WHEN SUM(spend_usd) > 0 THEN SUM(revenue_usd) / SUM(spend_usd)
          ELSE NULL
        END as roas,
        SUM(revenue_usd) / NULLIF(SUM(sessions), 0) as rpc
      FROM campaign_index
      WHERE media_source = 'mediago'
        AND date = '${date}'
      GROUP BY owner
      ORDER BY total_revenue DESC`
    );
    
    if (byBuyer.length === 0) {
      console.log('No MediaGo campaigns found for this date.');
      return;
    }
    
    console.log('📊 MediaGo Campaigns by Buyer:\n');
    console.log('┌─────────────┬───────────┬───────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('│ Buyer       │ Campaigns │ Revenue   │ Sessions    │ Clicks      │ Spend       │ ROAS        │ RPC         │');
    console.log('├─────────────┼───────────┼───────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    let totalCampaigns = 0;
    let totalRevenue = 0;
    let totalSessions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    
    for (const row of byBuyer) {
      const buyer = String(row.buyer || 'UNKNOWN').substring(0, 11).padEnd(11);
      const campaigns = Number(row.campaign_count || 0);
      const revenue = Number(row.total_revenue || 0);
      const sessions = Number(row.total_sessions || 0);
      const clicks = Number(row.total_clicks || 0);
      const spend = Number(row.total_spend || 0);
      const roas = row.roas ? Number(row.roas).toFixed(2) : 'N/A';
      const rpc = row.rpc ? Number(row.rpc).toFixed(4) : 'N/A';
      
      totalCampaigns += campaigns;
      totalRevenue += revenue;
      totalSessions += sessions;
      totalClicks += clicks;
      totalSpend += spend;
      
      console.log(`│ ${buyer} │ ${campaigns.toString().padStart(9)} │ $${revenue.toFixed(2).padStart(9)} │ ${sessions.toFixed(0).padStart(11)} │ ${clicks.toFixed(0).padStart(11)} │ $${spend.toFixed(2).padStart(9)} │ ${roas.padStart(11)} │ $${rpc.padStart(10)} │`);
    }
    
    console.log('├─────────────┼───────────┼───────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    const totalRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 'N/A';
    const totalRpc = totalSessions > 0 ? (totalRevenue / totalSessions).toFixed(4) : 'N/A';
    console.log(`│ TOTAL       │ ${totalCampaigns.toString().padStart(9)} │ $${totalRevenue.toFixed(2).padStart(9)} │ ${totalSessions.toFixed(0).padStart(11)} │ ${totalClicks.toFixed(0).padStart(11)} │ $${totalSpend.toFixed(2).padStart(9)} │ ${totalRoas.padStart(11)} │ $${totalRpc.padStart(10)} │`);
    console.log('└─────────────┴───────────┴───────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘');
    
    // Get detailed campaign list
    console.log('\n📋 MediaGo Campaign Details:\n');
    const campaigns = await allRows(
      conn,
      `SELECT 
        campaign_id,
        campaign_name,
        owner,
        lane,
        category,
        revenue_usd,
        sessions,
        clicks,
        spend_usd,
        CASE 
          WHEN spend_usd > 0 THEN revenue_usd / spend_usd
          ELSE NULL
        END as roas
      FROM campaign_index
      WHERE media_source = 'mediago'
        AND date = '${date}'
      ORDER BY revenue_usd DESC
      LIMIT 20`
    );
    
    if (campaigns.length > 0) {
      console.log('Top 20 MediaGo Campaigns by Revenue:\n');
      console.log('┌──────────────┬──────────────────────────────────────────┬─────────────┬───────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Campaign ID  │ Campaign Name                             │ Buyer       │ Revenue   │ Sessions    │ Clicks      │ Spend       │ ROAS        │');
      console.log('├──────────────┼──────────────────────────────────────────┼─────────────┼───────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      for (const row of campaigns) {
        const campaignId = String(row.campaign_id || '').substring(0, 12).padEnd(12);
        const campaignName = String(row.campaign_name || 'N/A').substring(0, 40).padEnd(40);
        const buyer = String(row.owner || 'UNKNOWN').substring(0, 11).padEnd(11);
        const revenue = Number(row.revenue_usd || 0);
        const sessions = Number(row.sessions || 0);
        const clicks = Number(row.clicks || 0);
        const spend = Number(row.spend_usd || 0);
        const roas = row.roas ? Number(row.roas).toFixed(2) : 'N/A';
        
        console.log(`│ ${campaignId} │ ${campaignName} │ ${buyer} │ $${revenue.toFixed(2).padStart(8)} │ ${sessions.toFixed(0).padStart(11)} │ ${clicks.toFixed(0).padStart(11)} │ $${spend.toFixed(2).padStart(8)} │ ${roas.padStart(11)} │`);
      }
      
      console.log('└──────────────┴──────────────────────────────────────────┴─────────────┴───────────┴─────────────┴─────────────┴─────────────┴─────────────┘');
      
      if (campaigns.length === 20) {
        const totalCampaigns = await allRows(
          conn,
          `SELECT COUNT(*) as total
          FROM campaign_index
          WHERE media_source = 'mediago'
            AND date = '${date}'`
        );
        const total = Number(totalCampaigns[0]?.total || 0);
        if (total > 20) {
          console.log(`\n... and ${total - 20} more campaigns`);
        }
      }
    }
    
    // Check buyer coverage
    const buyerCoverage = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total_campaigns,
        COUNT(DISTINCT owner) as unique_buyers,
        COUNT(CASE WHEN owner IS NULL THEN 1 END) as null_buyers
      FROM campaign_index
      WHERE media_source = 'mediago'
        AND date = '${date}'`
    );
    
    if (buyerCoverage.length > 0) {
      const coverage = buyerCoverage[0];
      console.log('\n📈 Buyer Coverage:');
      console.log(`  Total Campaigns: ${Number(coverage.total_campaigns || 0)}`);
      console.log(`  Unique Buyers: ${Number(coverage.unique_buyers || 0)}`);
      console.log(`  Campaigns with NULL buyer: ${Number(coverage.null_buyers || 0)}`);
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

