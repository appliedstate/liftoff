#!/usr/bin/env ts-node

/**
 * Debug script to understand why launch counts are high
 * Checks for duplicates, multiple levels, etc.
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getPSTDate(date: Date): string {
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

function getTodayPST(): string {
  return getPSTDate(new Date());
}

function getDaysAgoPST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPSTDate(date);
}

async function main() {
  const date = process.argv[2] || getTodayPST();
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log(`\n# Debug Launch Counts for ${date}\n`);
    
    // Check campaign_index for this date
    const campaignIndexStats = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT campaign_id) as unique_campaigns,
        COUNT(DISTINCT level) as unique_levels,
        COUNT(DISTINCT snapshot_source) as unique_sources
      FROM campaign_index
      WHERE date = '${date}'`
    );
    
    console.log('## campaign_index Statistics\n');
    const stats = campaignIndexStats[0];
    console.log(`Total Rows: ${Number(stats.total_rows || 0)}`);
    console.log(`Unique Campaign IDs: ${Number(stats.unique_campaigns || 0)}`);
    console.log(`Unique Levels: ${Number(stats.unique_levels || 0)}`);
    console.log(`Unique Sources: ${Number(stats.unique_sources || 0)}`);
    
    // Check for duplicates by level
    const byLevel = await allRows(
      conn,
      `SELECT 
        level,
        COUNT(*) as row_count,
        COUNT(DISTINCT campaign_id) as unique_campaigns
      FROM campaign_index
      WHERE date = '${date}'
      GROUP BY level
      ORDER BY row_count DESC`
    );
    
    console.log('\n## Breakdown by Level\n');
    console.log('| Level | Rows | Unique Campaigns |');
    console.log('|-------|------|-----------------|');
    for (const row of byLevel) {
      console.log(`| ${row.level} | ${row.row_count} | ${row.unique_campaigns} |`);
    }
    
    // Check for duplicates by source
    const bySource = await allRows(
      conn,
      `SELECT 
        snapshot_source,
        COUNT(*) as row_count,
        COUNT(DISTINCT campaign_id) as unique_campaigns
      FROM campaign_index
      WHERE date = '${date}'
      GROUP BY snapshot_source
      ORDER BY row_count DESC`
    );
    
    console.log('\n## Breakdown by Source\n');
    console.log('| Source | Rows | Unique Campaigns |');
    console.log('|--------|------|-----------------|');
    for (const row of bySource) {
      console.log(`| ${row.snapshot_source} | ${row.row_count} | ${row.unique_campaigns} |`);
    }
    
    // Check campaign_launches
    const launchStats = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total_launches,
        COUNT(DISTINCT campaign_id) as unique_campaigns,
        MIN(first_seen_date) as earliest_date,
        MAX(first_seen_date) as latest_date
      FROM campaign_launches`
    );
    
    console.log('\n## campaign_launches Statistics\n');
    const launchStatsRow = launchStats[0];
    console.log(`Total Launch Records: ${Number(launchStatsRow.total_launches || 0)}`);
    console.log(`Unique Campaign IDs: ${Number(launchStatsRow.unique_campaigns || 0)}`);
    console.log(`Earliest first_seen_date: ${launchStatsRow.earliest_date || 'N/A'}`);
    console.log(`Latest first_seen_date: ${launchStatsRow.latest_date || 'N/A'}`);
    
    // Check launches for this specific date
    const launchesForDate = await allRows(
      conn,
      `SELECT COUNT(*) as count FROM campaign_launches WHERE first_seen_date = '${date}'`
    );
    console.log(`\nLaunches with first_seen_date = ${date}: ${Number(launchesForDate[0]?.count || 0)}`);
    
    // Check for campaigns that appear multiple times in campaign_index on same date
    const duplicates = await allRows(
      conn,
      `SELECT 
        campaign_id,
        COUNT(*) as occurrence_count,
        GROUP_CONCAT(DISTINCT level) as levels,
        GROUP_CONCAT(DISTINCT snapshot_source) as sources
      FROM campaign_index
      WHERE date = '${date}'
      GROUP BY campaign_id
      HAVING COUNT(*) > 1
      ORDER BY occurrence_count DESC
      LIMIT 20`
    );
    
    if (duplicates.length > 0) {
      console.log('\n## Campaigns with Multiple Rows on Same Date (Top 20)\n');
      console.log('| Campaign ID | Occurrences | Levels | Sources |');
      console.log('|-------------|-------------|--------|---------|');
      for (const row of duplicates) {
        const campaignId = String(row.campaign_id || '').substring(0, 11);
        console.log(`| ${campaignId} | ${row.occurrence_count} | ${row.levels} | ${row.sources?.substring(0, 40)} |`);
      }
      
      const totalDuplicates = await allRows(
        conn,
        `SELECT COUNT(*) as count FROM (
          SELECT campaign_id
          FROM campaign_index
          WHERE date = '${date}'
          GROUP BY campaign_id
          HAVING COUNT(*) > 1
        )`
      );
      console.log(`\nTotal campaigns with duplicates: ${Number(totalDuplicates[0]?.count || 0)}`);
    }
    
    // Check what DISTINCT would return
    const distinctCampaigns = await allRows(
      conn,
      `SELECT COUNT(DISTINCT campaign_id) as count
      FROM campaign_index
      WHERE date = '${date}'
        AND campaign_id IS NOT NULL
        AND campaign_id != ''`
    );
    
    console.log(`\n## What trackCampaignLaunches Would See\n`);
    console.log(`DISTINCT campaign_id count: ${Number(distinctCampaigns[0]?.count || 0)}`);
    
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

