#!/usr/bin/env ts-node

import { createMonitoringConnection, allRows, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  
  try {
    const campaigns = await allRows(conn, 'SELECT COUNT(*) as count FROM campaign_index');
    const sessions = await allRows(conn, 'SELECT COUNT(*) as count FROM session_hourly_metrics');
    const recentCampaigns = await allRows(
      conn,
      `SELECT date, COUNT(*) as count FROM campaign_index GROUP BY date ORDER BY date DESC LIMIT 5`
    );
    const recentSessions = await allRows(
      conn,
      `SELECT date, COUNT(*) as count FROM session_hourly_metrics GROUP BY date ORDER BY date DESC LIMIT 5`
    );
    
    console.log('\n=== Monitoring Database Summary ===');
    console.log('Campaign Index:', campaigns[0]);
    console.log('Session Metrics:', sessions[0]);
    console.log('\nRecent Campaign Dates:');
    recentCampaigns.forEach((row: any) => {
      console.log(`  ${row.date}: ${row.count} campaigns`);
    });
    console.log('\nRecent Session Dates:');
    recentSessions.forEach((row: any) => {
      console.log(`  ${row.date}: ${row.count} hourly records`);
    });
    console.log('');
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

