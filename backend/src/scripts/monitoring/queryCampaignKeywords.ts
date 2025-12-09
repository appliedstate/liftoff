#!/usr/bin/env ts-node

/**
 * Query keyword-level performance for a specific campaign from session_revenue database
 * 
 * Usage:
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --date=2025-12-08 --days=3
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
const duckdb: any = require('duckdb');
import { StrategisApi } from '../../lib/strategisApi';

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayKeywordResults(
  sortedKeywords: Array<[string, { sessions: number; revenue: number; rpc: number }]>,
  keywordStats: Map<string, { sessions: number; revenue: number; rpc: number }>
): void {
  if (sortedKeywords.length === 0) {
    console.log('No keyword data found for this campaign.');
    return;
  }

  console.log(`Found ${sortedKeywords.length} keywords:\n`);
  console.log('Keyword'.padEnd(40) + ' | Sessions'.padStart(10) + ' | Revenue'.padStart(12) + ' | RPC'.padStart(10));
  console.log('-'.repeat(40) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(12) + '-+-' + '-'.repeat(10));
  
  let totalSessions = 0;
  let totalRevenue = 0;

  for (const [keyword, stats] of sortedKeywords) {
    totalSessions += stats.sessions;
    totalRevenue += stats.revenue;
    const keywordDisplay = keyword.length > 40 ? keyword.substring(0, 37) + '...' : keyword;
    console.log(
      keywordDisplay.padEnd(40) + ' | ' +
      stats.sessions.toString().padStart(10) + ' | ' +
      `$${stats.revenue.toFixed(2)}`.padStart(12) + ' | ' +
      `$${stats.rpc.toFixed(4)}`.padStart(10)
    );
  }

  const overallRpc = totalSessions > 0 ? totalRevenue / totalSessions : 0;
  console.log('-'.repeat(40) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(12) + '-+-' + '-'.repeat(10));
  console.log(
    'TOTAL'.padEnd(40) + ' | ' +
    totalSessions.toString().padStart(10) + ' | ' +
    `$${totalRevenue.toFixed(2)}`.padStart(12) + ' | ' +
    `$${overallRpc.toFixed(4)}`.padStart(10)
  );
}

function openSessionRevenueDb(): any {
  // Try multiple possible paths
  const possiblePaths = [
    path.resolve(process.cwd(), 'data', 'session_revenue.duckdb'),
    path.resolve(process.cwd(), '..', 'data', 'session_revenue.duckdb'),
    '/opt/liftoff/data/session_revenue.duckdb',
  ];

  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      return new duckdb.Database(dbPath);
    }
  }

  return null;
}

async function main(): Promise<void> {
  const campaignId = getFlag('campaign-id');
  const dateStr = getFlag('date') || todayUtc();
  const days = parseInt(getFlag('days') || '3', 10);

  if (!campaignId) {
    console.error('Error: --campaign-id is required');
    process.exit(1);
  }

  console.log(`\n# Keyword Performance for Campaign: ${campaignId}`);
  console.log(`Date Range: ${dateStr} (last ${days} days)\n`);

  // Try S1 API first with keyword dimensions
  const api = new StrategisApi({
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    networkId: process.env.STRATEGIS_NETWORK_ID,
    timezone: process.env.STRATEGIS_TIMEZONE || 'UTC',
  });

  const keywordStats = new Map<string, { sessions: number; revenue: number; rpc: number }>();

  // Try querying S1 API with keyword dimensions
  console.log('Attempting to query S1 API with keyword dimensions...\n');
  
  for (let d = 0; d < days; d++) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - d);
    const queryDate = date.toISOString().slice(0, 10);

    try {
      // Try to fetch with keyword dimensions
      const rows = await api.fetchS1HourlyWithKeywords(queryDate, true);

      // Debug: log first row structure if available
      if (rows.length > 0 && d === 0) {
        console.log(`\nDebug: API returned ${rows.length} rows for ${queryDate}`);
        console.log('Sample row keys:', Object.keys(rows[0]));
        if (rows.length > 0) {
          const sampleRow = rows[0];
          console.log('Sample row (first row):', JSON.stringify(sampleRow, null, 2).substring(0, 500));
        }
      }

      for (const row of rows) {
        const rowCampaignId = row.strategisCampaignId || row.campaign_id || row.campaignId || row.strategiscampaignid;
        const keyword = row.keyword || row.keyword_text || row.keywordText || row.keyword_name;
        
        if (rowCampaignId !== campaignId) continue;
        
        // If no keyword field, this dimension might not be supported
        if (!keyword) {
          if (d === 0 && rows.length > 0) {
            console.log(`\nWarning: No keyword field found in API response for campaign ${campaignId}.`);
            console.log(`Available fields: ${Object.keys(row).join(', ')}`);
            console.log(`This campaign has ${rows.filter(r => (r.strategisCampaignId || r.campaign_id || r.campaignId) === campaignId).length} rows without keywords.`);
          }
          continue;
        }

        const sessions = Number(row.sessions || 0);
        const revenue = Number(row.revenue || row.estimated_revenue || 0);
        
        if (!keywordStats.has(keyword)) {
          keywordStats.set(keyword, { sessions: 0, revenue: 0, rpc: 0 });
        }

        const stats = keywordStats.get(keyword)!;
        stats.sessions += sessions;
        stats.revenue += revenue;
      }
    } catch (error: any) {
      console.error(`Error fetching from S1 API for ${queryDate}:`, error.message);
    }
  }

  // If we got data from API, use it
  if (keywordStats.size > 0) {
    // Calculate RPC and display
    for (const [keyword, stats] of keywordStats.entries()) {
      stats.rpc = stats.sessions > 0 ? stats.revenue / stats.sessions : 0;
    }

    const sortedKeywords = Array.from(keywordStats.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue);

    console.log(`Found ${sortedKeywords.length} keywords from S1 API:\n`);
    displayKeywordResults(sortedKeywords, keywordStats);
    return;
  }

  // Fallback to session_revenue database
  console.log('S1 API query returned no keyword data. Trying session_revenue database...\n');
  
  const db = openSessionRevenueDb();
  if (!db) {
    console.error('Error: session_revenue.duckdb database not found.');
    console.error('Expected locations:');
    console.error('  - backend/data/session_revenue.duckdb');
    console.error('  - /opt/liftoff/data/session_revenue.duckdb');
    console.error('\nNote: Keyword data may not be available.');
    console.error('The S1 hourly API may not support keyword dimensions, or keywords may not be tracked for this campaign.');
    process.exit(1);
  }

  const conn = db.connect();
  const all = (q: string) =>
    new Promise<any[]>((resolve, reject) =>
      conn.all(q, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows)))
    );

  // Build date range
  const dates: string[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - d);
    dates.push(date.toISOString().slice(0, 10));
  }
  const dateList = dates.map((d) => `'${d}'`).join(', ');

  // Query sessions with keywords
  const rows = await all(`
    SELECT 
      date,
      session_id,
      total_revenue,
      raw_data
    FROM s1_session_revenue
    WHERE date IN (${dateList})
  `);

  console.log(`Loaded ${rows.length} session rows from database\n`);

  // Extract keyword data (reuse keywordStats map)
  keywordStats.clear();

  for (const r of rows) {
    let campaignIdFromRow: string | null = null;
    let keyword: string | null = null;
    
    try {
      const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
      const cid = raw?.campaign_id ?? raw?.campaignId ?? null;
      const kw = raw?.keyword ?? null;
      campaignIdFromRow = cid ? String(cid).trim() : null;
      keyword = kw ? String(kw).trim() : null;
    } catch {
      // Ignore malformed raw_data
    }

    if (campaignIdFromRow !== campaignId || !keyword) continue;

    const revenue = typeof r.total_revenue === 'number' 
      ? r.total_revenue 
      : Number(r.total_revenue ?? 0) || 0;

    if (!keywordStats.has(keyword)) {
      keywordStats.set(keyword, { sessions: 0, revenue: 0, rpc: 0 });
    }

    const stats = keywordStats.get(keyword)!;
    stats.sessions += 1;
    stats.revenue += revenue;
  }

  // Calculate RPC for each keyword
  for (const [keyword, stats] of keywordStats.entries()) {
    stats.rpc = stats.sessions > 0 ? stats.revenue / stats.sessions : 0;
  }

  // Sort by revenue descending
  const sortedKeywords = Array.from(keywordStats.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue);

  if (sortedKeywords.length === 0) {
    console.log('No keyword data found for this campaign in the date range.');
    console.log(`\nChecked ${rows.length} total sessions across dates: ${dates.join(', ')}`);
    console.log('\nPossible reasons:');
    console.log('  - Campaign has no sessions in this date range');
    console.log('  - Sessions don\'t have keyword data in raw_data');
    console.log('  - Campaign ID mismatch (check exact campaign_id in database)');
    return;
  }

  displayKeywordResults(sortedKeywords, keywordStats);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

