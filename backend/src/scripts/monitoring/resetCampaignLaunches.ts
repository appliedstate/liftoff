#!/usr/bin/env ts-node

/**
 * Reset campaign_launches table and optionally re-run backfill
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const confirm = process.argv[2];
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    if (confirm !== '--confirm') {
      // Check current state
      const stats = await allRows(
        conn,
        `SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT campaign_id) as unique_campaigns,
          MIN(first_seen_date) as earliest,
          MAX(first_seen_date) as latest
        FROM campaign_launches`
      );
      
      const row = stats[0];
      console.log('\n# Current campaign_launches State\n');
      console.log(`Total Records: ${Number(row.total || 0)}`);
      console.log(`Unique Campaigns: ${Number(row.unique_campaigns || 0)}`);
      console.log(`Earliest first_seen_date: ${row.earliest || 'N/A'}`);
      console.log(`Latest first_seen_date: ${row.latest || 'N/A'}`);
      
      // Check for duplicates
      const duplicates = await allRows(
        conn,
        `SELECT first_seen_date, COUNT(*) as count
        FROM campaign_launches
        GROUP BY first_seen_date
        ORDER BY count DESC
        LIMIT 10`
      );
      
      console.log('\n## Launches by Date (Top 10)\n');
      console.log('| Date | Count |');
      console.log('|------|-------|');
      for (const dup of duplicates) {
        console.log(`| ${dup.first_seen_date} | ${dup.count} |`);
      }
      
      console.log('\n⚠️  To reset campaign_launches table, run:');
      console.log('   npm run monitor:reset-launches -- --confirm\n');
      return;
    }
    
    // Actually delete
    console.log('\n[resetCampaignLaunches] Deleting all records from campaign_launches...');
    await runSql(conn, 'DELETE FROM campaign_launches');
    
    const afterStats = await allRows(
      conn,
      `SELECT COUNT(*) as count FROM campaign_launches`
    );
    
    console.log(`[resetCampaignLaunches] Deleted. Remaining records: ${Number(afterStats[0]?.count || 0)}`);
    console.log('\n[resetCampaignLaunches] Done! You can now re-run backfill:\n');
    console.log('   npm run monitor:backfill-launches -- 7 0\n');
    
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

