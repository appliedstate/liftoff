#!/usr/bin/env ts-node

import { createMonitoringConnection, allRows, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  
  try {
    console.log('\n=== Media Source Coverage ===\n');
    
    // Check what media sources we have in campaign_index
    const campaignSources = await allRows(
      conn,
      `SELECT media_source, COUNT(*) as count 
       FROM campaign_index 
       WHERE media_source IS NOT NULL 
       GROUP BY media_source 
       ORDER BY count DESC`
    );
    console.log('Campaign Index - Media Sources:');
    campaignSources.forEach((row: any) => {
      console.log(`  ${row.media_source || '(NULL)'}: ${row.count} campaigns`);
    });
    
    // Check what media sources we have in session data
    const sessionSources = await allRows(
      conn,
      `SELECT media_source, COUNT(*) as count, 
              SUM(sessions) as sessions, 
              SUM(revenue) as revenue
       FROM session_hourly_metrics 
       WHERE media_source IS NOT NULL 
       GROUP BY media_source 
       ORDER BY count DESC`
    );
    console.log('\nSession Metrics - Media Sources:');
    sessionSources.forEach((row: any) => {
      console.log(`  ${row.media_source || '(NULL)'}: ${row.count} records, ${row.sessions} sessions, $${row.revenue.toFixed(2)} revenue`);
    });
    
    // Check NULL media_source counts
    const nullCampaigns = await allRows(
      conn,
      `SELECT COUNT(*) as count FROM campaign_index WHERE media_source IS NULL`
    );
    const nullSessions = await allRows(
      conn,
      `SELECT COUNT(*) as count FROM session_hourly_metrics WHERE media_source IS NULL`
    );
    console.log(`\nNULL media_source: ${nullCampaigns[0].count} campaigns, ${nullSessions[0].count} session records`);
    
    // Check owner/lane coverage
    console.log('\n=== Buyer Attribution Coverage ===\n');
    const owners = await allRows(
      conn,
      `SELECT owner, COUNT(DISTINCT campaign_id) as campaigns,
              SUM(revenue_usd) as revenue
       FROM campaign_index 
       WHERE owner IS NOT NULL 
       GROUP BY owner 
       ORDER BY revenue DESC NULLS LAST`
    );
    console.log('Campaigns by Owner:');
    owners.forEach((row: any) => {
      console.log(`  ${row.owner}: ${row.campaigns} campaigns, $${(row.revenue || 0).toFixed(2)} revenue`);
    });
    
    // Revenue by media source (from sessions)
    console.log('\n=== Revenue by Media Source (Session Data) ===\n');
    const revenueBySource = await allRows(
      conn,
      `SELECT 
         COALESCE(media_source, 'UNKNOWN') as source,
         COUNT(DISTINCT campaign_id) as campaigns,
         SUM(sessions) as sessions,
         SUM(revenue) as revenue,
         SUM(revenue) / NULLIF(SUM(sessions), 0) as rpc
       FROM session_hourly_metrics
       GROUP BY media_source
       ORDER BY revenue DESC`
    );
    revenueBySource.forEach((row: any) => {
      console.log(`  ${row.source}:`);
      console.log(`    Campaigns: ${row.campaigns}`);
      console.log(`    Sessions: ${row.sessions}`);
      console.log(`    Revenue: $${row.revenue.toFixed(2)}`);
      console.log(`    RPC: $${row.rpc ? row.rpc.toFixed(4) : 'N/A'}`);
      console.log('');
    });
    
    // Check if we can join campaigns to sessions
    console.log('=== Cross-Reference Capability ===\n');
    const joinable = await allRows(
      conn,
      `SELECT 
         COUNT(DISTINCT s.campaign_id) as session_campaigns,
         COUNT(DISTINCT c.campaign_id) as indexed_campaigns,
         COUNT(DISTINCT CASE WHEN c.campaign_id IS NOT NULL THEN s.campaign_id END) as matched_campaigns
       FROM session_hourly_metrics s
       LEFT JOIN campaign_index c ON s.campaign_id = c.campaign_id`
    );
    const stats = joinable[0];
    console.log(`Session campaigns: ${stats.session_campaigns}`);
    console.log(`Indexed campaigns: ${stats.indexed_campaigns}`);
    console.log(`Matched (joinable): ${stats.matched_campaigns}`);
    console.log(`Match rate: ${((stats.matched_campaigns / stats.session_campaigns) * 100).toFixed(1)}%`);
    
    // Sample raw payload to see what fields S1 returns
    console.log('\n=== Sample Campaign Raw Payload ===\n');
    const sample = await allRows(
      conn,
      `SELECT raw_payload FROM campaign_index WHERE raw_payload IS NOT NULL LIMIT 1`
    );
    if (sample.length > 0) {
      console.log(JSON.stringify(sample[0].raw_payload, null, 2));
    }
    
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

