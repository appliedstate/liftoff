#!/usr/bin/env ts-node

/**
 * Report campaign launch velocity by buyer/owner
 * Shows how many campaigns each buyer has launched in recent days
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const days = parseInt(process.argv[2] || '7', 10);
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    const today = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    console.log(`\n# Campaign Launch Velocity Report (Last ${days} Days)\n`);
    console.log(`Date Range: ${startDate} to ${today}\n`);
    
    // Get launch velocity by owner and date
    const velocityByDate = await allRows(
      conn,
      `SELECT 
        first_seen_date,
        owner,
        COUNT(*) as launch_count
      FROM campaign_launches
      WHERE first_seen_date >= '${startDate}'
        AND first_seen_date <= '${today}'
      GROUP BY first_seen_date, owner
      ORDER BY first_seen_date DESC, launch_count DESC`
    );
    
    // Get totals by owner
    const totalsByOwner = await allRows(
      conn,
      `SELECT 
        owner,
        COUNT(*) as total_launches,
        MIN(first_seen_date) as first_launch,
        MAX(first_seen_date) as last_launch
      FROM campaign_launches
      WHERE first_seen_date >= '${startDate}'
        AND first_seen_date <= '${today}'
      GROUP BY owner
      ORDER BY total_launches DESC`
    );
    
    if (totalsByOwner.length === 0) {
      console.log('No campaign launches found in this period.');
      console.log('Make sure trackCampaignLaunches has been run for recent dates.\n');
      return;
    }
    
    // Summary by Owner
    console.log('## Summary by Buyer/Owner\n');
    console.log('| Owner | Total Launches | First Launch | Last Launch | Avg/Day |');
    console.log('|-------|----------------|--------------|-------------|---------|');
    
    for (const row of totalsByOwner) {
      const owner = String(row.owner || 'UNKNOWN');
      const total = Number(row.total_launches || 0);
      const firstLaunch = String(row.first_launch || 'N/A');
      const lastLaunch = String(row.last_launch || 'N/A');
      const avgPerDay = days > 0 ? (total / days).toFixed(1) : '0';
      
      console.log(`| ${owner} | ${total} | ${firstLaunch} | ${lastLaunch} | ${avgPerDay} |`);
    }
    
    // Daily breakdown
    console.log('\n## Daily Launch Breakdown\n');
    
    // Group by date
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of velocityByDate) {
      const date = String(row.first_seen_date);
      const owner = String(row.owner || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      
      if (!byDate[date]) {
        byDate[date] = {};
      }
      byDate[date][owner] = count;
    }
    
    // Get all owners
    const allOwners = new Set<string>();
    for (const dateData of Object.values(byDate)) {
      for (const owner of Object.keys(dateData)) {
        allOwners.add(owner);
      }
    }
    const sortedOwners = Array.from(allOwners).sort();
    
    // Print header
    console.log('| Date | ' + sortedOwners.join(' | ') + ' | Total |');
    console.log('|------|' + sortedOwners.map(() => '------').join('|') + '|-------|');
    
    // Print rows
    const sortedDates = Object.keys(byDate).sort().reverse();
    for (const date of sortedDates) {
      const dateData = byDate[date];
      const row: string[] = [date];
      let dateTotal = 0;
      
      for (const owner of sortedOwners) {
        const count = dateData[owner] || 0;
        row.push(count > 0 ? String(count) : '-');
        dateTotal += count;
      }
      
      row.push(String(dateTotal));
      console.log('| ' + row.join(' | ') + ' |');
    }
    
    // Last 2 days summary (as requested)
    console.log('\n## Last 2 Days Summary\n');
    const last2Days = sortedDates.slice(0, 2);
    const last2DaysStart = last2Days.length > 0 ? last2Days[last2Days.length - 1] : today;
    
    const last2DaysTotals = await allRows(
      conn,
      `SELECT 
        owner,
        COUNT(*) as launch_count
      FROM campaign_launches
      WHERE first_seen_date >= '${last2DaysStart}'
        AND first_seen_date <= '${today}'
      GROUP BY owner
      ORDER BY launch_count DESC`
    );
    
    console.log('| Owner | Launches (Last 2 Days) |');
    console.log('|-------|------------------------|');
    
    for (const row of last2DaysTotals) {
      const owner = String(row.owner || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      console.log(`| ${owner} | ${count} |`);
    }
    
    // Media source breakdown
    console.log('\n## Launches by Media Source (Last 2 Days)\n');
    const byMediaSource = await allRows(
      conn,
      `SELECT 
        media_source,
        COUNT(*) as launch_count
      FROM campaign_launches
      WHERE first_seen_date >= '${last2DaysStart}'
        AND first_seen_date <= '${today}'
      GROUP BY media_source
      ORDER BY launch_count DESC`
    );
    
    console.log('| Media Source | Launches |');
    console.log('|--------------|----------|');
    
    for (const row of byMediaSource) {
      const source = String(row.media_source || 'UNKNOWN');
      const count = Number(row.launch_count || 0);
      console.log(`| ${source} | ${count} |`);
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

