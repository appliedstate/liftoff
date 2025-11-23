#!/usr/bin/env ts-node

/**
 * Verify owner breakdown to show the numbers clearly
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log('\n# Owner Breakdown Verification\n');
    
    // Total breakdown
    const total = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN owner IS NULL OR owner = 'UNKNOWN' OR owner = '' THEN 1 END) as unknown,
        COUNT(CASE WHEN owner IS NOT NULL AND owner != '' AND owner != 'UNKNOWN' THEN 1 END) as known
      FROM campaign_launches`
    );
    
    const stats = total[0];
    console.log(`Total Campaigns: ${Number(stats.total || 0)}`);
    console.log(`With Owner Info: ${Number(stats.known || 0)}`);
    console.log(`Missing Owner Info: ${Number(stats.unknown || 0)}`);
    console.log(`Coverage: ${((Number(stats.known || 0) / Number(stats.total || 1)) * 100).toFixed(1)}%\n`);
    
    // Breakdown by owner
    const byOwner = await allRows(
      conn,
      `SELECT 
        COALESCE(owner, 'UNKNOWN') as owner,
        COUNT(*) as count
      FROM campaign_launches
      GROUP BY owner
      ORDER BY count DESC`
    );
    
    console.log('## Breakdown by Owner\n');
    console.log('| Owner | Count |');
    console.log('|-------|-------|');
    
    let knownTotal = 0;
    for (const row of byOwner) {
      const owner = String(row.owner || 'UNKNOWN');
      const count = Number(row.count || 0);
      if (owner !== 'UNKNOWN') {
        knownTotal += count;
      }
      console.log(`| ${owner} | ${count} |`);
    }
    
    console.log(`\nKnown Owners Total: ${knownTotal}`);
    console.log(`This should match "With Owner Info: ${Number(stats.known || 0)}"\n`);
    
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

