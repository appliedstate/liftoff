#!/usr/bin/env ts-node

/**
 * Query keyword-level performance for a specific campaign from S1 session-level API
 * 
 * Usage:
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --show-sample=true --date=2025-12-08
 */

import 'dotenv/config';
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

async function main(): Promise<void> {
  const campaignId = getFlag('campaign-id');
  const dateStr = getFlag('date') || todayUtc();
  const days = parseInt(getFlag('days') || '3', 10);
  const showSample = getFlag('show-sample') === 'true';

  // If --show-sample flag is set, just display sample data and exit
  if (showSample) {
    const api = new StrategisApi({
      organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
      adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
      networkId: process.env.STRATEGIS_NETWORK_ID,
      timezone: process.env.STRATEGIS_TIMEZONE || 'UTC',
    });

    console.log(`\n# Sample Session Data from S1 API`);
    console.log(`Date: ${dateStr}\n`);

    try {
      const sessions = await api.fetchS1SessionRevenue(dateStr, false);
      console.log(`Fetched ${sessions.length} total sessions\n`);

      if (sessions.length === 0) {
        console.log('No sessions found for this date.');
        return;
      }

      // Show first 5 sessions with all fields
      console.log('Sample Sessions (first 5):');
      console.log('='.repeat(100));
      for (let i = 0; i < Math.min(5, sessions.length); i++) {
        const session = sessions[i];
        console.log(`\nSession ${i + 1}:`);
        console.log(JSON.stringify(session, null, 2));
        console.log('-'.repeat(100));
      }

      // Show unique campaign IDs
      const campaignIds = new Set<string>();
      const campaignIdFields = new Set<string>();
      
      for (const session of sessions.slice(0, 100)) { // Check first 100 sessions
        for (const [key, value] of Object.entries(session)) {
          if (key.toLowerCase().includes('campaign') && value) {
            campaignIdFields.add(key);
            campaignIds.add(String(value));
          }
        }
      }

      console.log(`\nCampaign ID Fields Found: ${Array.from(campaignIdFields).join(', ')}`);
      console.log(`\nSample Campaign IDs (first 20):`);
      console.log(Array.from(campaignIds).slice(0, 20).join(', '));

      // Show all field names
      console.log(`\n\nAll Fields in Session Data:`);
      const allFields = new Set<string>();
      for (const session of sessions.slice(0, 10)) {
        Object.keys(session).forEach(field => allFields.add(field));
      }
      console.log(Array.from(allFields).sort().join(', '));

    } catch (error: any) {
      console.error('Error fetching sample data:', error.message);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Response: ${JSON.stringify(error.response.data).substring(0, 500)}`);
      }
    }
    return;
  }

  if (!campaignId) {
    console.error('Error: --campaign-id is required (or use --show-sample=true to see sample data)');
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

  // Query S1 session-level API (includes keywords)
  console.log('Querying S1 session-level API for keyword data...\n');
  
  for (let d = 0; d < days; d++) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - d);
    const queryDate = date.toISOString().slice(0, 10);

    try {
      console.log(`Fetching session data for ${queryDate}...`);
      // Fetch session-level data (includes keywords)
      const sessions = await api.fetchS1SessionRevenue(queryDate, false); // Include zero-revenue sessions
      
      console.log(`  ✓ Fetched ${sessions.length} sessions for ${queryDate}`);
      if (sessions.length > 0) {
        console.log(`  Sample session fields: ${Object.keys(sessions[0]).join(', ')}`);
        
        // Debug: Show sample campaign IDs to help identify the format
        const sampleCampaignIds = new Set<string>();
        for (let i = 0; i < Math.min(20, sessions.length); i++) {
          const session = sessions[i];
          const cid = session.campaign_id || session.strategisCampaignId || session.campaignId;
          if (cid) sampleCampaignIds.add(String(cid));
        }
        console.log(`  Sample campaign IDs (first 20): ${Array.from(sampleCampaignIds).slice(0, 10).join(', ')}`);
      }
      
      let matchingSessions = 0;

      // Filter by campaign and aggregate by keyword
      for (const session of sessions) {
        // Try various campaign ID field names
        const rowCampaignId = 
          session.strategisCampaignId || 
          session.campaign_id || 
          session.campaignId || 
          session.strategiscampaignid ||
          session.campaignId_strategis;
        
        if (!rowCampaignId) continue;
        
        // Case-insensitive comparison, and also check if campaignId is contained in the rowCampaignId
        const rowCampaignIdStr = String(rowCampaignId).toLowerCase().trim();
        const searchCampaignId = campaignId.toLowerCase().trim();
        
        if (rowCampaignIdStr !== searchCampaignId && !rowCampaignIdStr.includes(searchCampaignId) && !searchCampaignId.includes(rowCampaignIdStr)) {
          continue;
        }
        
        matchingSessions++;
        
        // Extract keyword (try various field names)
        const keyword = 
          session.keyword || 
          session.keyword_text || 
          session.keywordText || 
          session.keyword_name ||
          session.keyword_strategis;
        
        if (!keyword || keyword.trim() === '') continue;

        // Extract revenue (try various field names)
        const revenue = Number(
          session.total_revenue || 
          session.revenue || 
          session.estimated_revenue || 
          session.revenue_usd ||
          0
        );
        
        if (!keywordStats.has(keyword)) {
          keywordStats.set(keyword, { sessions: 0, revenue: 0, rpc: 0 });
        }

        const stats = keywordStats.get(keyword)!;
        stats.sessions += 1; // Each row is one session
        stats.revenue += revenue;
      }
      
      console.log(`  ✓ Processed ${matchingSessions} sessions matching campaign ${campaignId}, found ${keywordStats.size} unique keywords`);
    } catch (error: any) {
      console.error(`Error fetching session data from S1 API for ${queryDate}:`, error.message);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }

  // Calculate RPC and display results
  if (keywordStats.size > 0) {
    // Calculate RPC for each keyword
    for (const [keyword, stats] of keywordStats.entries()) {
      stats.rpc = stats.sessions > 0 ? stats.revenue / stats.sessions : 0;
    }

    const sortedKeywords = Array.from(keywordStats.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue);

    console.log(`\nFound ${sortedKeywords.length} keywords for campaign ${campaignId}:\n`);
    displayKeywordResults(sortedKeywords, keywordStats);
    return;
  }

  // No keyword data found
  console.log(`\nNo keyword data found for campaign ${campaignId} in the date range.`);
  console.log(`\nPossible reasons:`);
  console.log(`  - Campaign has no sessions in this date range`);
  console.log(`  - Sessions don't have keyword data`);
  console.log(`  - Campaign ID mismatch (check exact campaign_id)`);
  console.log(`\nTip: Verify the campaign ID matches exactly (case-sensitive).`);
  process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

