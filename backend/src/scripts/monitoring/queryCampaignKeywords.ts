#!/usr/bin/env ts-node

/**
 * Query keyword-level performance for a specific campaign from S1 session-level API
 * 
 * Usage:
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --adset-id=120231668335910424 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --ad-id=120234479088370424 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --show-sample=true --date=2025-12-08
 * 
 * Notes:
 *   - campaign-id: Strategis campaign ID (e.g., sipuli0615)
 *   - The script maps Facebook campaign IDs from session data to Strategis campaign IDs using campaign_index
 *   - Revenue is calculated from the revenue_updates array (sum of all revenue values)
 *   - You can filter by adset-id or ad-id to drill down further
 */

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';
import { createMonitoringConnection, allRows, closeConnection, sqlString } from '../../lib/monitoringDb';

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

async function findFacebookCampaignIds(conn: any, strategisCampaignId: string, dateStr: string): Promise<Set<string>> {
  const fbCampaignIds = new Set<string>();
  
  try {
    // Method 1: Query session_hourly_metrics to find Facebook campaign IDs for this Strategis campaign
    // The campaign_id in session_hourly_metrics should be the Strategis campaign ID
    // But we need to find the corresponding Facebook campaign IDs from the session data
    // Actually, session_hourly_metrics doesn't have Facebook campaign IDs...
    
    // Method 2: Query campaign_index to find Facebook campaign IDs in raw_payload
    const date = new Date(dateStr);
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - 30); // Look back 30 days for mapping
    
    const rows = await allRows<any>(conn, `
      SELECT DISTINCT campaign_id, raw_payload, media_source
      FROM campaign_index
      WHERE campaign_id = ${sqlString(strategisCampaignId)}
        AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
        AND date <= ${sqlString(dateStr)}
        AND raw_payload IS NOT NULL
    `);
    
    for (const row of rows) {
      // Try to extract Facebook campaign ID from raw_payload
      try {
        const raw = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload;
        // Check various possible field names for Facebook campaign ID
        const fbCampaignId = 
          raw?.fbCampaignId || 
          raw?.fb_campaign_id || 
          raw?.facebookCampaignId || 
          raw?.properties?.fbCampaignId ||
          raw?.properties?.fb_campaign_id ||
          raw?.campaign_id; // Sometimes campaign_id in raw might be Facebook ID
        
        if (fbCampaignId && String(fbCampaignId).length > 10) { // Facebook IDs are long numbers
          fbCampaignIds.add(String(fbCampaignId));
        }
      } catch {
        // Ignore malformed JSON
      }
    }
    
    // Method 3: If still not found, try querying by matching campaign name patterns
    // This is a fallback - we'll look for campaigns with similar names
    if (fbCampaignIds.size === 0) {
      const nameRows = await allRows<any>(conn, `
        SELECT DISTINCT campaign_id, campaign_name, raw_payload
        FROM campaign_index
        WHERE campaign_id LIKE ${sqlString(`%${strategisCampaignId}%`)}
          AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
          AND date <= ${sqlString(dateStr)}
      `);
      
      for (const row of nameRows) {
        if (row.campaign_id === strategisCampaignId) {
          try {
            const raw = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload;
            const fbCampaignId = 
              raw?.fbCampaignId || 
              raw?.fb_campaign_id || 
              raw?.facebookCampaignId ||
              raw?.properties?.fbCampaignId;
            if (fbCampaignId && String(fbCampaignId).length > 10) {
              fbCampaignIds.add(String(fbCampaignId));
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  } catch (error: any) {
    console.warn(`Warning: Could not query campaign mapping: ${error.message}`);
  }
  
  return fbCampaignIds;
}

async function main(): Promise<void> {
  const campaignId = getFlag('campaign-id'); // This is Strategis campaign ID
  const adsetId = getFlag('adset-id');
  const adId = getFlag('ad-id');
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

  if (!campaignId && !showSample) {
    console.error('Error: --campaign-id is required (or use --show-sample=true to see sample data)');
    console.error('  You can also use --adset-id or --ad-id to filter by those instead');
    process.exit(1);
  }

  console.log(`\n# Keyword Performance for Campaign: ${campaignId || '(filtering by adset/ad)'}`);
  console.log(`Date Range: ${dateStr} (last ${days} days)\n`);

  // Load campaign mapping from monitoring database
  const conn = createMonitoringConnection();
  let fbCampaignIds: Set<string> = new Set();
  
  if (campaignId) {
    console.log('Loading campaign mapping from monitoring database...');
    fbCampaignIds = await findFacebookCampaignIds(conn, campaignId, dateStr);
    
    if (fbCampaignIds.size > 0) {
      console.log(`  ✓ Found ${fbCampaignIds.size} Facebook campaign ID(s) for Strategis campaign ${campaignId}:`);
      console.log(`    ${Array.from(fbCampaignIds).slice(0, 5).join(', ')}${fbCampaignIds.size > 5 ? '...' : ''}`);
    } else {
      console.log(`  ⚠ Warning: Could not find Facebook campaign IDs for Strategis campaign ${campaignId}`);
      console.log(`    Will try to match by Strategis campaign ID directly (may not work)`);
      console.log(`    Tip: Check if campaign_index has data for this campaign with Facebook IDs in raw_payload`);
    }
  }
  
  closeConnection(conn);

  // Try S1 API first with keyword dimensions
  const api = new StrategisApi({
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    networkId: process.env.STRATEGIS_NETWORK_ID,
    timezone: process.env.STRATEGIS_TIMEZONE || 'UTC',
  });

  const keywordStats = new Map<string, { sessions: number; revenue: number; rpc: number }>();

  // Query S1 session-level API (includes keywords)
  console.log('\nQuerying S1 session-level API for keyword data...\n');
  
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

      // Filter by campaign/adset/ad and aggregate by keyword
      for (const session of sessions) {
        // Get Facebook campaign ID from session
        const fbCampaignId = session.campaign_id || session.campaignId;
        if (!fbCampaignId) continue;
        
        // Check if this Facebook campaign ID maps to our Strategis campaign ID
        let matchesCampaign = false;
        if (campaignId) {
          if (fbCampaignIds.has(String(fbCampaignId))) {
            matchesCampaign = true;
          } else {
            // Also try direct match (in case campaign_id in session is actually Strategis ID)
            const fbCampaignIdStr = String(fbCampaignId).toLowerCase().trim();
            const searchCampaignId = campaignId.toLowerCase().trim();
            if (fbCampaignIdStr === searchCampaignId || fbCampaignIdStr.includes(searchCampaignId)) {
              matchesCampaign = true;
            }
          }
        } else {
          matchesCampaign = true; // No campaign filter
        }
        
        // Filter by adset_id if provided
        if (adsetId) {
          const sessionAdsetId = session.adset_id || session.adsetId;
          if (!sessionAdsetId || String(sessionAdsetId).toLowerCase() !== adsetId.toLowerCase()) {
            continue;
          }
        }
        
        // Filter by ad_id if provided
        if (adId) {
          const sessionAdId = session.ad_id || session.adId;
          if (!sessionAdId || String(sessionAdId).toLowerCase() !== adId.toLowerCase()) {
            continue;
          }
        }
        
        if (!matchesCampaign) continue;
        
        matchingSessions++;
        
        // Extract keyword (try various field names)
        const keyword = 
          session.keyword || 
          session.keyword_text || 
          session.keywordText || 
          session.keyword_name ||
          session.keyword_strategis;
        
        if (!keyword || keyword.trim() === '') continue;

        // Calculate total revenue from revenue_updates array
        let revenue = 0;
        if (session.revenue_updates && Array.isArray(session.revenue_updates)) {
          // Sum all revenue values from the updates
          revenue = session.revenue_updates.reduce((sum: number, update: any) => {
            const rev = Number(update.revenue || 0);
            return sum + (isNaN(rev) ? 0 : rev);
          }, 0);
        } else {
          // Fallback to direct revenue field
          revenue = Number(
            session.total_revenue || 
            session.revenue || 
            session.estimated_revenue || 
            session.revenue_usd ||
            0
          );
        }
        
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

