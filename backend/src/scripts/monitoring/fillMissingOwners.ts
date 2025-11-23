#!/usr/bin/env ts-node

/**
 * Fill in missing owner/buyer information by looking at historical campaign_index data
 * If a campaign has UNKNOWN owner on one date but has owner data on another date, use that
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql, sqlString } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log('\n# Filling Missing Owner Information\n');
    
    // Find campaigns in campaign_launches with UNKNOWN or NULL owner
    const campaignsWithUnknownOwner = await allRows(
      conn,
      `SELECT campaign_id, first_seen_date, owner
      FROM campaign_launches
      WHERE owner IS NULL OR owner = 'UNKNOWN' OR owner = ''
      ORDER BY first_seen_date DESC
      LIMIT 100`
    );
    
    console.log(`Found ${campaignsWithUnknownOwner.length} campaigns with missing owner info\n`);
    
    if (campaignsWithUnknownOwner.length === 0) {
      console.log('No campaigns with missing owner information found.\n');
      return;
    }
    
    // Check campaign_index for these campaigns across all dates to find owner info
    let updated = 0;
    let found = 0;
    
    for (const campaign of campaignsWithUnknownOwner.slice(0, 50)) { // Process first 50
      const campaignId = campaign.campaign_id;
      
      // Look for this campaign in campaign_index with owner info
      const withOwner = await allRows(
        conn,
        `SELECT DISTINCT owner, date
        FROM campaign_index
        WHERE campaign_id = ${sqlString(campaignId)}
          AND owner IS NOT NULL
          AND owner != ''
          AND owner != 'UNKNOWN'
        ORDER BY date DESC
        LIMIT 1`
      );
      
      if (withOwner.length > 0) {
        const owner = withOwner[0].owner;
        const foundDate = withOwner[0].date;
        found++;
        
        console.log(`Found owner for ${campaignId.substring(0, 12)}: ${owner} (from ${foundDate})`);
        
        // Update campaign_launches
        await runSql(
          conn,
          `UPDATE campaign_launches
          SET owner = ${sqlString(owner)}
          WHERE campaign_id = ${sqlString(campaignId)}`
        );
        updated++;
      }
    }
    
    console.log(`\nUpdated ${updated} campaigns with owner information`);
    console.log(`Found owner info for ${found} out of ${Math.min(50, campaignsWithUnknownOwner.length)} checked\n`);
    
    // Show summary
    const summary = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN owner IS NULL OR owner = 'UNKNOWN' OR owner = '' THEN 1 END) as unknown,
        COUNT(CASE WHEN owner IS NOT NULL AND owner != '' AND owner != 'UNKNOWN' THEN 1 END) as known
      FROM campaign_launches`
    );
    
    const stats = summary[0];
    console.log('## Summary\n');
    console.log(`Total Campaigns: ${Number(stats.total || 0)}`);
    console.log(`With Owner Info: ${Number(stats.known || 0)}`);
    console.log(`Missing Owner Info: ${Number(stats.unknown || 0)}`);
    console.log(`Coverage: ${((Number(stats.known || 0) / Number(stats.total || 1)) * 100).toFixed(1)}%\n`);
    
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

