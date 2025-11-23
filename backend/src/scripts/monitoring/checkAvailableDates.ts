#!/usr/bin/env ts-node

/**
 * Check which dates have data in campaign_index
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log('\n# Available Dates in campaign_index\n');
    
    const dates = await allRows(
      conn,
      `SELECT 
        date,
        COUNT(*) as total_rows,
        COUNT(DISTINCT campaign_id) as unique_campaigns
      FROM campaign_index
      WHERE campaign_id IS NOT NULL
        AND campaign_id != ''
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30`
    );
    
    if (dates.length === 0) {
      console.log('No data found in campaign_index.');
      console.log('Run ingestCampaignIndex first to populate data.\n');
      return;
    }
    
    console.log('| Date | Total Rows | Unique Campaigns |');
    console.log('|------|------------|------------------|');
    
    for (const row of dates) {
      const date = String(row.date || 'N/A');
      const rows = Number(row.total_rows || 0);
      const campaigns = Number(row.unique_campaigns || 0);
      console.log(`| ${date} | ${rows} | ${campaigns} |`);
    }
    
    const minDate = dates[dates.length - 1]?.date;
    const maxDate = dates[0]?.date;
    
    console.log(`\nDate Range: ${minDate} to ${maxDate}`);
    console.log(`Total dates with data: ${dates.length}\n`);
    
    console.log('To backfill these dates, run:');
    if (dates.length > 0) {
      const daysBack = Math.ceil((new Date().getTime() - new Date(maxDate).getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  npm run monitor:backfill-launches -- ${daysBack + 1} 0`);
    }
    console.log('');
    
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

