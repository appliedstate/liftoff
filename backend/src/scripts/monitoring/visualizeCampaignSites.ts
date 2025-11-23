#!/usr/bin/env ts-node

/**
 * Visualize campaign site and S1 Google Account mappings in markdown table format
 * for display in chat/console
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const mediaSource = process.argv[3] || null;
  const conn = createMonitoringConnection();
  
  try {
    console.log(`\n# Campaign Site & S1 Google Account Mappings for ${date}\n`);
    
    let whereClause = `date = '${date}'`;
    if (mediaSource) {
      whereClause += ` AND media_source = '${mediaSource}'`;
    }
    
    // Get comprehensive summary
    const summary = await allRows(
      conn,
      `SELECT 
        COALESCE(s1_google_account, 'UNMAPPED') as account,
        rsoc_site,
        COUNT(DISTINCT campaign_id) as campaigns,
        SUM(revenue_usd) as revenue,
        SUM(sessions) as sessions,
        SUM(spend_usd) as spend,
        CASE 
          WHEN SUM(spend_usd) > 0 THEN SUM(revenue_usd) / SUM(spend_usd)
          ELSE NULL
        END as roas,
        CASE 
          WHEN SUM(sessions) > 0 THEN SUM(revenue_usd) / SUM(sessions)
          ELSE NULL
        END as rpc
      FROM campaign_index
      WHERE ${whereClause}
        AND (rsoc_site IS NOT NULL OR s1_google_account IS NOT NULL)
      GROUP BY s1_google_account, rsoc_site
      ORDER BY revenue DESC`
    );
    
    if (summary.length === 0) {
      console.log('No data found for this date.');
      return;
    }
    
    // Markdown table format
    console.log('## Summary by S1 Google Account & RSOC Site\n');
    console.log('| S1 Google Account | RSOC Site | Campaigns | Revenue | Sessions | Spend | ROAS | RPC |');
    console.log('|-------------------|-----------|-----------|---------|----------|-------|------|-----|');
    
    for (const row of summary) {
      const account = String(row.account || 'UNMAPPED');
      const site = String(row.rsoc_site || 'N/A');
      const campaigns = Number(row.campaigns || 0);
      const revenue = Number(row.revenue || 0);
      const sessions = Number(row.sessions || 0);
      const spend = Number(row.spend || 0);
      const roas = Number(row.roas || 0);
      const rpc = Number(row.rpc || 0);
      
      const roasStr = spend > 0 ? `${roas.toFixed(2)}x` : 'N/A';
      const rpcStr = sessions > 0 ? `$${rpc.toFixed(2)}` : 'N/A';
      
      console.log(`| ${account} | ${site} | ${campaigns} | $${revenue.toFixed(2)} | ${sessions} | $${spend.toFixed(2)} | ${roasStr} | ${rpcStr} |`);
    }
    
    // Get top campaigns
    const topCampaigns = await allRows(
      conn,
      `SELECT 
        campaign_id,
        campaign_name,
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
      LIMIT 20`
    );
    
    if (topCampaigns.length > 0) {
      console.log('\n## Top 20 Campaigns by Revenue\n');
      console.log('| Campaign ID | Campaign Name | RSOC Site | S1 Google Account | Revenue | Sessions | Spend | ROAS |');
      console.log('|------------|---------------|-----------|-------------------|---------|----------|-------|------|');
      
      for (const row of topCampaigns) {
        const campaignId = String(row.campaign_id || '').substring(0, 11);
        const campaignName = String(row.campaign_name || 'N/A').substring(0, 13);
        const site = String(row.rsoc_site || 'N/A').substring(0, 9);
        const account = String(row.s1_google_account || 'N/A').substring(0, 17);
        const revenue = Number(row.revenue_usd || 0);
        const sessions = Number(row.sessions || 0);
        const spend = Number(row.spend_usd || 0);
        const roas = Number(row.roas || 0);
        
        const roasStr = spend > 0 ? `${roas.toFixed(2)}x` : 'N/A';
        
        console.log(`| ${campaignId} | ${campaignName} | ${site} | ${account} | $${revenue.toFixed(2)} | ${sessions} | $${spend.toFixed(2)} | ${roasStr} |`);
      }
    }
    
    // Account summary
    const accountSummary = await allRows(
      conn,
      `SELECT 
        COALESCE(s1_google_account, 'UNMAPPED') as account,
        COUNT(DISTINCT campaign_id) as campaigns,
        COUNT(DISTINCT rsoc_site) as sites,
        SUM(revenue_usd) as revenue,
        SUM(sessions) as sessions,
        SUM(spend_usd) as spend,
        CASE 
          WHEN SUM(spend_usd) > 0 THEN SUM(revenue_usd) / SUM(spend_usd)
          ELSE NULL
        END as roas
      FROM campaign_index
      WHERE ${whereClause}
      GROUP BY s1_google_account
      ORDER BY revenue DESC`
    );
    
    if (accountSummary.length > 0) {
      console.log('\n## Summary by S1 Google Account\n');
      console.log('| S1 Google Account | Campaigns | Sites | Revenue | Sessions | Spend | ROAS |');
      console.log('|-------------------|-----------|-------|---------|----------|-------|------|');
      
      for (const row of accountSummary) {
        const account = String(row.account || 'UNMAPPED');
        const campaigns = Number(row.campaigns || 0);
        const sites = Number(row.sites || 0);
        const revenue = Number(row.revenue || 0);
        const sessions = Number(row.sessions || 0);
        const spend = Number(row.spend || 0);
        const roas = Number(row.roas || 0);
        
        const roasStr = spend > 0 ? `${roas.toFixed(2)}x` : 'N/A';
        
        console.log(`| ${account} | ${campaigns} | ${sites} | $${revenue.toFixed(2)} | ${sessions} | $${spend.toFixed(2)} | ${roasStr} |`);
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

