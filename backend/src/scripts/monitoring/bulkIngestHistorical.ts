#!/usr/bin/env ts-node

/**
 * Bulk ingest historical campaign data for a date range
 * Useful for backfilling campaign_index with historical dates
 */

import 'dotenv/config';
import { execSync } from 'child_process';

function getPSTDate(date: Date): string {
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

function getDaysAgoPST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPSTDate(date);
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  
  return dates;
}

async function main() {
  const startDateArg = process.argv[2];
  const endDateArg = process.argv[3];
  const dryRun = process.argv[4] === '--dry-run';
  
  if (!startDateArg || !endDateArg) {
    console.log('\nUsage: npm run monitor:bulk-ingest -- <start_date> <end_date> [--dry-run]');
    console.log('Example: npm run monitor:bulk-ingest -- 2025-11-01 2025-11-23');
    console.log('Dates should be in YYYY-MM-DD format\n');
    process.exit(1);
  }
  
  const dates = getDateRange(startDateArg, endDateArg);
  
  console.log(`\n# Bulk Ingest Historical Campaign Data\n`);
  console.log(`Date Range: ${startDateArg} to ${endDateArg}`);
  console.log(`Total Dates: ${dates.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will ingest data)'}\n`);
  
  if (!dryRun) {
    console.log('This will ingest campaign data for each date. This may take a while...\n');
  }
  
  const dbPath = process.env.MONITORING_DB_PATH || '/opt/liftoff/data/monitoring.duckdb';
  const envVars = `MONITORING_DB_PATH="${dbPath}"`;
  
  let success = 0;
  let failed = 0;
  const failedDates: string[] = [];
  
  for (const date of dates) {
    console.log(`\n[${date}] Ingesting campaign data...`);
    
    if (dryRun) {
      console.log(`  Would run: ${envVars} npm run monitor:ingest-campaigns -- --date=${date} --mode=remote`);
      success++;
    } else {
      try {
        execSync(
          `${envVars} npm run monitor:ingest-campaigns -- --date=${date} --mode=remote`,
          { stdio: 'inherit', cwd: process.cwd() }
        );
        success++;
        console.log(`[${date}] ✓ Success`);
      } catch (err: any) {
        failed++;
        failedDates.push(date);
        console.error(`[${date}] ✗ Failed: ${err?.message || err}`);
      }
    }
  }
  
  console.log(`\n# Summary\n`);
  console.log(`Total Dates: ${dates.length}`);
  console.log(`Successful: ${success}`);
  console.log(`Failed: ${failed}`);
  
  if (failedDates.length > 0) {
    console.log(`\nFailed Dates: ${failedDates.join(', ')}`);
  }
  
  if (!dryRun && success > 0) {
    console.log(`\nAfter ingestion, run:`);
    console.log(`  npm run monitor:backfill-launches -- <days_back> 0`);
    console.log(`  npm run monitor:fill-owners`);
  }
  
  console.log('\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

