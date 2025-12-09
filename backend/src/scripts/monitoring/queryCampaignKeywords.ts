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

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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

  const db = openSessionRevenueDb();
  if (!db) {
    console.error('Error: session_revenue.duckdb database not found.');
    console.error('Expected locations:');
    console.error('  - backend/data/session_revenue.duckdb');
    console.error('  - /opt/liftoff/data/session_revenue.duckdb');
    console.error('\nNote: Keyword data comes from the session_revenue database.');
    console.error('If this database doesn\'t exist, keywords may not be available.');
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

  // Extract keyword data
  const keywordStats = new Map<string, { sessions: number; revenue: number; rpc: number }>();

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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

