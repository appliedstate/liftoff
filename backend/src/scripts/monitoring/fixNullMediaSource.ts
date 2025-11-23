#!/usr/bin/env ts-node

/**
 * Diagnostic and fix script for NULL media_source in session_hourly_metrics
 * Checks if campaigns exist in campaign_index and re-runs ingestion if needed
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const date = process.argv[2] || '2025-11-23';
  const conn = createMonitoringConnection();
  
  try {
    console.log(`\n=== Diagnosing NULL media_source for ${date} ===\n`);
    
    // Get campaigns with NULL media_source in session data
    const nullCampaigns = await allRows(
      conn,
      `SELECT DISTINCT campaign_id
      FROM session_hourly_metrics
      WHERE date = '${date}'
        AND media_source IS NULL`
    );
    
    if (nullCampaigns.length === 0) {
      console.log('✅ No campaigns with NULL media_source found!');
      return;
    }
    
    console.log(`Found ${nullCampaigns.length} campaigns with NULL media_source\n`);
    
    // Check if these campaigns exist in campaign_index
    const campaignIds = nullCampaigns.map((r: any) => `'${r.campaign_id}'`).join(',');
    const existingCampaigns = await allRows(
      conn,
      `SELECT DISTINCT campaign_id, media_source, owner, category
      FROM campaign_index
      WHERE campaign_id IN (${campaignIds})
        AND date = '${date}'`
    );
    
    console.log(`📊 Analysis:\n`);
    console.log(`  Total campaigns with NULL media_source: ${nullCampaigns.length}`);
    console.log(`  Campaigns found in campaign_index: ${existingCampaigns.length}`);
    
    if (existingCampaigns.length > 0) {
      console.log(`\n⚠️  ${existingCampaigns.length} campaigns exist in campaign_index but have NULL media_source:`);
      const nullInIndex = existingCampaigns.filter((c: any) => !c.media_source);
      const withSource = existingCampaigns.filter((c: any) => c.media_source);
      
      if (nullInIndex.length > 0) {
        console.log(`\n  Campaigns with NULL media_source in campaign_index: ${nullInIndex.length}`);
        nullInIndex.slice(0, 5).forEach((c: any) => {
          console.log(`    - ${c.campaign_id} (owner: ${c.owner || 'NULL'}, category: ${c.category || 'NULL'})`);
        });
        if (nullInIndex.length > 5) {
          console.log(`    ... and ${nullInIndex.length - 5} more`);
        }
      }
      
      if (withSource.length > 0) {
        console.log(`\n  Campaigns with media_source in campaign_index: ${withSource.length}`);
        const sourceCounts: Record<string, number> = {};
        withSource.forEach((c: any) => {
          sourceCounts[c.media_source] = (sourceCounts[c.media_source] || 0) + 1;
        });
        Object.entries(sourceCounts).forEach(([source, count]) => {
          console.log(`    - ${source}: ${count} campaigns`);
        });
      }
    } else {
      console.log(`\n⚠️  None of these campaigns exist in campaign_index!`);
      console.log(`  This means campaign ingestion hasn't run or didn't capture these campaigns.`);
    }
    
    // Check what media sources we do have
    const allSources = await allRows(
      conn,
      `SELECT media_source, COUNT(DISTINCT campaign_id) as count
      FROM campaign_index
      WHERE date = '${date}'
        AND media_source IS NOT NULL
      GROUP BY media_source
      ORDER BY count DESC`
    );
    
    console.log(`\n📈 Media sources in campaign_index for ${date}:`);
    if (allSources.length > 0) {
      allSources.forEach((row: any) => {
        console.log(`  - ${row.media_source}: ${row.count} campaigns`);
      });
    } else {
      console.log('  No campaigns with media_source found');
    }
    
    // Check S1 daily data to see if we can identify the platform
    console.log(`\n💡 Solution:`);
    console.log(`  1. Re-run campaign ingestion to populate media_source:`);
    console.log(`     npm run monitor:ingest-campaigns -- --date=${date} --mode=remote`);
    console.log(`\n  2. After campaign ingestion, re-run session ingestion to join metadata:`);
    console.log(`     npm run monitor:ingest-sessions -- --date=${date} --max-hour=23`);
    console.log(`\n  This will:`);
    console.log(`    - Fetch S1 Daily data (includes networkId for all platforms)`);
    console.log(`    - Map networkId → media_source (MediaGo = 113, Taboola = 107, etc.)`);
    console.log(`    - Update campaign_index with proper media_source`);
    console.log(`    - Re-join session data with campaign metadata`);
    
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

