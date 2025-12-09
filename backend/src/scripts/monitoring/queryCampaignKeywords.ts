#!/usr/bin/env ts-node

/**
 * Query keyword-level performance for a specific campaign from S1 session-level API
 * 
 * Usage:
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --fb-campaign-id=120231668335880424 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --campaign-id=sipuli0615 --adset-id=120231668335910424 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --fb-campaign-id=120231668335880424 --ad-id=120234479088370424 --date=2025-12-08 --days=3
 *   npm run monitor:campaign-keywords -- --show-sample=true --date=2025-12-08
 * 
 * Notes:
 *   - campaign-id: Strategis campaign ID (e.g., sipuli0615) - script will try to map to Facebook campaign IDs
 *   - fb-campaign-id: Facebook campaign ID (e.g., 120231668335880424) - use this if mapping fails
 *   - The script maps Facebook campaign IDs from session data to Strategis campaign IDs using campaign_index
 *   - Revenue is calculated from the revenue_updates array (sum of all revenue values)
 *   - You can filter by adset-id or ad-id to drill down further
 */

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';
import { createMonitoringConnection, allRows, closeConnection, sqlString, initMonitoringSchema } from '../../lib/monitoringDb';

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

type KeywordStats = {
  sessions: number;
  sessionsWithRevenue: number;
  revenue: number;
  rpc: number; // Revenue per session (search)
  rpcPerClick: number; // Revenue per click (session with revenue)
};

function displayKeywordResults(
  sortedKeywords: Array<[string, KeywordStats]>,
  keywordStats: Map<string, KeywordStats>
): void {
  if (sortedKeywords.length === 0) {
    console.log('No keyword data found for this campaign.');
    return;
  }

  console.log(`Found ${sortedKeywords.length} keywords:\n`);
  console.log(
    'Keyword'.padEnd(40) + ' | ' +
    'Sessions'.padStart(10) + ' | ' +
    'Sessions w/Rev'.padStart(15) + ' | ' +
    'Revenue'.padStart(12) + ' | ' +
    'RPC/Search'.padStart(12) + ' | ' +
    'RPC/Click'.padStart(12)
  );
  console.log('-'.repeat(40) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(15) + '-+-' + '-'.repeat(12) + '-+-' + '-'.repeat(12) + '-+-' + '-'.repeat(12));
  
  let totalSessions = 0;
  let totalSessionsWithRevenue = 0;
  let totalRevenue = 0;

  for (const [keyword, stats] of sortedKeywords) {
    totalSessions += stats.sessions;
    totalSessionsWithRevenue += stats.sessionsWithRevenue;
    totalRevenue += stats.revenue;
    const keywordDisplay = keyword.length > 40 ? keyword.substring(0, 37) + '...' : keyword;
    console.log(
      keywordDisplay.padEnd(40) + ' | ' +
      stats.sessions.toString().padStart(10) + ' | ' +
      stats.sessionsWithRevenue.toString().padStart(15) + ' | ' +
      `$${stats.revenue.toFixed(2)}`.padStart(12) + ' | ' +
      `$${stats.rpc.toFixed(4)}`.padStart(12) + ' | ' +
      `$${stats.rpcPerClick.toFixed(4)}`.padStart(12)
    );
  }

  const overallRpc = totalSessions > 0 ? totalRevenue / totalSessions : 0;
  const overallRpcPerClick = totalSessionsWithRevenue > 0 ? totalRevenue / totalSessionsWithRevenue : 0;
  console.log('-'.repeat(40) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(15) + '-+-' + '-'.repeat(12) + '-+-' + '-'.repeat(12) + '-+-' + '-'.repeat(12));
  console.log(
    'TOTAL'.padEnd(40) + ' | ' +
    totalSessions.toString().padStart(10) + ' | ' +
    totalSessionsWithRevenue.toString().padStart(15) + ' | ' +
    `$${totalRevenue.toFixed(2)}`.padStart(12) + ' | ' +
    `$${overallRpc.toFixed(4)}`.padStart(12) + ' | ' +
    `$${overallRpcPerClick.toFixed(4)}`.padStart(12)
  );
  
  console.log(`\nSummary:`);
  console.log(`  Total Sessions (searches): ${totalSessions.toLocaleString()}`);
  console.log(`  Sessions with Revenue (clicks): ${totalSessionsWithRevenue.toLocaleString()}`);
  console.log(`  Conversion Rate: ${totalSessions > 0 ? ((totalSessionsWithRevenue / totalSessions) * 100).toFixed(2) : 0}%`);
  console.log(`  Revenue per Search (RPC/Search): $${overallRpc.toFixed(4)}`);
  console.log(`  Revenue per Click (RPC/Click): $${overallRpcPerClick.toFixed(4)}`);
}

/**
 * Find Strategis campaign ID by matching campaign name across different data sources.
 * This links Facebook campaigns (with Facebook IDs) to Strategis campaigns (with Strategis IDs).
 */
async function findStrategisIdByCampaignName(
  conn: any,
  campaignName: string | null | undefined,
  fbCampaignId: string,
  startDate: string,
  endDate: string
): Promise<string | null> {
  if (!campaignName) {
    return null;
  }
  
  console.log(`  Searching for Strategis ID by campaign name: "${campaignName}"...`);
  
  // Case-insensitive search for campaigns with the same name from S1 sources
  // These should have Strategis IDs as their campaign_id
  const s1Rows = await allRows<any>(conn, `
    SELECT DISTINCT campaign_id, campaign_name, facebook_campaign_id, date, snapshot_source, owner, lane, category
    FROM campaign_index
    WHERE LOWER(TRIM(campaign_name)) = LOWER(TRIM(${sqlString(campaignName)}))
      AND snapshot_source IN ('s1_daily_v3', 's1_reconciled')
      AND campaign_id IS NOT NULL
      AND (
        campaign_id LIKE '%sipuli%' 
        OR LENGTH(campaign_id) < 15 
        OR NOT REGEXP_MATCHES(campaign_id, '^[0-9]+$')
      )
      AND date >= ${sqlString(startDate)}
      AND date <= ${sqlString(endDate)}
      AND media_source = 'facebook'
    ORDER BY date DESC, snapshot_source DESC
    LIMIT 10
  `);
  
  if (s1Rows.length > 0) {
    const strategisId = s1Rows[0].campaign_id;
    const s1CampaignName = s1Rows[0].campaign_name;
    const s1FacebookId = s1Rows[0].facebook_campaign_id;
    
    // If the S1 record already has this Facebook ID, perfect match!
    if (s1FacebookId === fbCampaignId) {
      console.log(`  ✓ Found exact match: Strategis ID ${strategisId} already linked to Facebook ID ${fbCampaignId}`);
      return strategisId;
    }
    
    // Otherwise, it's a name match - verify it's likely the same campaign
    console.log(`  ✓ Found Strategis campaign ID via name match: ${strategisId}`);
    console.log(`    Campaign name: "${s1CampaignName}"`);
    if (s1FacebookId) {
      console.log(`    S1 record has Facebook ID: ${s1FacebookId} (querying for: ${fbCampaignId})`);
    } else {
      console.log(`    S1 record has no Facebook ID - this is a new link!`);
    }
    console.log(`    Note: Verify this is the correct campaign match.`);
    return strategisId;
  }
  
  // Also check if any Facebook source records have this name and a Strategis ID
  // (in case Facebook data was ingested after S1 data)
  const fbRowsWithStrategisId = await allRows<any>(conn, `
    SELECT DISTINCT campaign_id, campaign_name, facebook_campaign_id, date, snapshot_source
    FROM campaign_index
    WHERE LOWER(TRIM(campaign_name)) = LOWER(TRIM(${sqlString(campaignName)}))
      AND snapshot_source IN ('facebook_campaigns', 'facebook_adsets', 'facebook_report')
      AND facebook_campaign_id = ${sqlString(fbCampaignId)}
      AND campaign_id IS NOT NULL
      AND (
        campaign_id LIKE '%sipuli%' 
        OR LENGTH(campaign_id) < 15 
        OR NOT REGEXP_MATCHES(campaign_id, '^[0-9]+$')
      )
      AND date >= ${sqlString(startDate)}
      AND date <= ${sqlString(endDate)}
      AND media_source = 'facebook'
    ORDER BY date DESC
    LIMIT 10
  `);
  
  if (fbRowsWithStrategisId.length > 0) {
    const strategisId = fbRowsWithStrategisId[0].campaign_id;
    console.log(`  ✓ Found Strategis campaign ID in Facebook source: ${strategisId}`);
    console.log(`    This Facebook campaign was already linked to a Strategis ID.`);
    return strategisId;
  }
  
  return null;
}

/**
 * Extract strategisCampaignId from campaign name using the pattern: campaignName.split('_')[0]
 * This is the standard way Strategis extracts campaign IDs from Facebook campaign names
 */
function extractStrategisCampaignIdFromName(campaignName: string | null | undefined): string | null {
  if (!campaignName || typeof campaignName !== 'string') {
    return null;
  }
  const parts = campaignName.trim().split('_');
  if (parts.length > 0 && parts[0]) {
    return parts[0];
  }
  return null;
}

/**
 * Query S1 API directly to find Strategis ID from Facebook campaign ID
 * Uses networkCampaignId dimension in S1 daily API to get the mapping
 * Also tries to extract from campaign names if available
 */
async function findStrategisIdFromS1Api(
  api: StrategisApi,
  fbCampaignId: string,
  dateStr: string
): Promise<string | null> {
  try {
    console.log(`  Querying S1 API directly for Facebook campaign ID ${fbCampaignId}...`);
    
    // Method 1: Query S1 daily API with networkCampaignId dimension
    // This returns both strategisCampaignId and networkCampaignId (Facebook campaign ID)
    const s1Data = await api.fetchS1DailyWithNetworkCampaignId(dateStr, '112'); // 112 = Facebook (note: docs say 109, but code uses 112)
    
    // Look for matching networkCampaignId (Facebook campaign ID)
    for (const row of s1Data) {
      const networkCampaignId = row.networkCampaignId || row.network_campaign_id;
      const strategisId = row.strategisCampaignId || row.strategis_campaign_id || row.strategiscampaignid;
      const campaignName = row.networkCampaignName || row.network_campaign_name || row.campaign_name || row.campaignName;
      
      // Direct match via networkCampaignId
      if (networkCampaignId && String(networkCampaignId) === String(fbCampaignId) && strategisId) {
        console.log(`  ✓ Found Strategis ID via S1 API (networkCampaignId match): ${strategisId} (Facebook ID: ${fbCampaignId})`);
        return String(strategisId);
      }
      
      // Also try extracting from campaign name if networkCampaignId matches
      if (networkCampaignId && String(networkCampaignId) === String(fbCampaignId) && campaignName) {
        const extractedId = extractStrategisCampaignIdFromName(campaignName);
        if (extractedId) {
          console.log(`  ✓ Found Strategis ID via S1 API (extracted from campaign name): ${extractedId} (Facebook ID: ${fbCampaignId}, Campaign: ${campaignName})`);
          return extractedId;
        }
      }
    }
    
    // Method 2: Try querying Facebook campaigns API to get campaign name, then extract Strategis ID
    try {
      console.log(`  Trying Facebook campaigns API to get campaign name...`);
      const fbCampaigns = await api.fetchFacebookCampaigns(dateStr);
      for (const campaign of fbCampaigns) {
        const campaignId = campaign.id || campaign.campaign_id || campaign.campaignId;
        const campaignName = campaign.name || campaign.campaign_name || campaign.campaignName;
        
        if (campaignId && String(campaignId) === String(fbCampaignId) && campaignName) {
          const extractedId = extractStrategisCampaignIdFromName(campaignName);
          if (extractedId) {
            console.log(`  ✓ Found Strategis ID via Facebook campaigns API (extracted from name): ${extractedId} (Facebook ID: ${fbCampaignId}, Campaign: ${campaignName})`);
            return extractedId;
          }
        }
      }
    } catch (error: any) {
      console.log(`  Could not query Facebook campaigns API: ${error.message}`);
    }
    
    console.log(`  ⚠ No match found in S1 API for Facebook campaign ID ${fbCampaignId}`);
    return null;
  } catch (error: any) {
    console.warn(`  Warning: Could not query S1 API for mapping: ${error.message}`);
    return null;
  }
}

async function findStrategisCampaignId(conn: any, fbCampaignId: string, dateStr: string, api?: StrategisApi): Promise<string | null> {
  // Reverse lookup: Find Strategis campaign ID from Facebook campaign ID
  // First try: Query S1 API directly (most reliable)
  if (api) {
    const s1ApiResult = await findStrategisIdFromS1Api(api, fbCampaignId, dateStr);
    if (s1ApiResult) {
      return s1ApiResult;
    }
  }
  
  // Fallback: Uses the facebook_campaign_id column in campaign_index (populated from Facebook adset/campaign APIs)
  try {
    const date = new Date(dateStr);
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - 30); // Look back 30 days
    
    // First try: Direct lookup using facebook_campaign_id column
    const directRows = await allRows<any>(conn, `
      SELECT DISTINCT campaign_id, campaign_name, facebook_campaign_id, date, snapshot_source
      FROM campaign_index
      WHERE facebook_campaign_id = ${sqlString(fbCampaignId)}
        AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
        AND date <= ${sqlString(dateStr)}
        AND media_source = 'facebook'
      ORDER BY date DESC
      LIMIT 10
    `);
    
    if (directRows.length > 0) {
      const foundCampaignId = directRows[0].campaign_id;
      // Check if campaign_id looks like a Strategis ID (alphanumeric, contains "sipuli", or short)
      // vs Facebook ID (long numeric string)
      const looksLikeStrategisId = foundCampaignId && (
        foundCampaignId.includes('sipuli') ||
        foundCampaignId.length < 15 ||
        /^[a-zA-Z0-9_-]+$/.test(foundCampaignId) && !/^\d+$/.test(foundCampaignId)
      );
      
      if (looksLikeStrategisId) {
        console.log(`  ✓ Found match via facebook_campaign_id column! Strategis campaign ID: ${foundCampaignId}`);
        return foundCampaignId;
      } else {
        // campaign_id is a Facebook ID, not a Strategis ID
        // Search for other campaigns with the same facebook_campaign_id that might have a Strategis ID
        console.log(`  ⚠ Found campaign but campaign_id (${foundCampaignId}) looks like a Facebook ID, not Strategis ID`);
        console.log(`  Searching for Strategis ID in other records...`);
        
        // Look for campaigns with same facebook_campaign_id but different campaign_id (which should be Strategis ID)
        // DuckDB doesn't support GLOB - use REGEXP_MATCHES for pattern matching
        const strategisRows = await allRows<any>(conn, `
          SELECT DISTINCT campaign_id, campaign_name, facebook_campaign_id, date, snapshot_source
          FROM campaign_index
          WHERE facebook_campaign_id = ${sqlString(fbCampaignId)}
            AND campaign_id != ${sqlString(foundCampaignId)}
            AND campaign_id IS NOT NULL
            AND (
              campaign_id LIKE '%sipuli%' 
              OR LENGTH(campaign_id) < 15 
              OR NOT REGEXP_MATCHES(campaign_id, '^[0-9]+$')
            )
            AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
            AND date <= ${sqlString(dateStr)}
          ORDER BY date DESC
          LIMIT 10
        `);
        
        if (strategisRows.length > 0) {
          console.log(`  ✓ Found Strategis campaign ID: ${strategisRows[0].campaign_id}`);
          return strategisRows[0].campaign_id;
        } else {
          // Try searching by campaign name to link Facebook campaign to Strategis ID
          const campaignName = directRows[0]?.campaign_name;
          const foundStrategisId = await findStrategisIdByCampaignName(
            conn, 
            campaignName, 
            fbCampaignId, 
            startDate.toISOString().slice(0, 10), 
            dateStr
          );
          
          if (foundStrategisId) {
            return foundStrategisId;
          }
          
          console.log(`  ⚠ No Strategis campaign ID found. Campaign may not exist in S1 data yet.`);
          console.log(`  Using Facebook campaign ID as fallback: ${foundCampaignId}`);
          return foundCampaignId; // Fallback to Facebook ID
        }
      }
    }
    
    // Fallback: Search in raw_payload (for older data that may not have facebook_campaign_id populated)
    console.log(`  No direct match found, searching raw_payload...`);
    const rows = await allRows<any>(conn, `
      SELECT DISTINCT campaign_id, campaign_name, raw_payload, date, snapshot_source
      FROM campaign_index
      WHERE date >= ${sqlString(startDate.toISOString().slice(0, 10))}
        AND date <= ${sqlString(dateStr)}
        AND raw_payload IS NOT NULL
        AND media_source = 'facebook'
      ORDER BY date DESC
      LIMIT 1000
    `);
    
    console.log(`  Checking ${rows.length} Facebook campaigns in campaign_index for Facebook campaign ID ${fbCampaignId}...`);
    
    let checkedCount = 0;
    for (const row of rows) {
      try {
        const raw = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload;
        
        // Check various possible field names for Facebook campaign ID
        const rawFbCampaignId = 
          raw?.fbCampaignId || 
          raw?.fb_campaign_id || 
          raw?.facebookCampaignId || 
          raw?.campaignId || // Facebook API might return campaignId as Facebook ID
          raw?.id || // Sometimes just 'id'
          raw?.properties?.fbCampaignId ||
          raw?.properties?.fb_campaign_id ||
          raw?.properties?.campaignId;
        
        checkedCount++;
        if (rawFbCampaignId && String(rawFbCampaignId) === String(fbCampaignId)) {
          // Found matching Facebook campaign ID, return the Strategis campaign ID
          console.log(`  ✓ Found match in raw_payload! Strategis campaign ID: ${row.campaign_id} (from ${row.snapshot_source})`);
          return row.campaign_id;
        }
      } catch {
        // Ignore malformed JSON
      }
    }
    
    console.log(`  ⚠ Checked ${checkedCount} campaigns but no Facebook campaign ID match found`);
    console.log(`  Note: The Facebook campaign ${fbCampaignId} may not be in campaign_index yet.`);
    console.log(`  Try running: npm run monitor:ingest-campaign-index -- --date=${dateStr} --level=adset`);
    console.log(`  This will populate facebook_campaign_id from Facebook adset data.`);
    
  } catch (error: any) {
    console.warn(`Warning: Could not query reverse campaign mapping: ${error.message}`);
  }
  
  return null;
}

async function findStrategisCampaignIdByAdset(conn: any, adsetId: string, dateStr: string): Promise<string | null> {
  // Alternative lookup: Find Strategis campaign ID by matching adset_id
  // campaign_index stores adset_id, so we can use that to find the Strategis campaign ID
  try {
    const date = new Date(dateStr);
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - 30);
    
    const rows = await allRows<any>(conn, `
      SELECT DISTINCT campaign_id, campaign_name, adset_id, date
      FROM campaign_index
      WHERE adset_id = ${sqlString(adsetId)}
        AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
        AND date <= ${sqlString(dateStr)}
        AND media_source = 'facebook'
      ORDER BY date DESC
      LIMIT 10
    `);
    
    if (rows.length > 0) {
      return rows[0].campaign_id; // Return the first match
    }
  } catch (error: any) {
    console.warn(`Warning: Could not query by adset_id: ${error.message}`);
  }
  
  return null;
}

async function findFacebookCampaignIds(conn: any, strategisCampaignId: string, dateStr: string): Promise<Set<string>> {
  const fbCampaignIds = new Set<string>();
  
  try {
    const date = new Date(dateStr);
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - 30); // Look back 30 days for mapping
    
    // Method 1: Direct lookup using facebook_campaign_id column (most efficient)
    const directRows = await allRows<any>(conn, `
      SELECT DISTINCT facebook_campaign_id
      FROM campaign_index
      WHERE campaign_id = ${sqlString(strategisCampaignId)}
        AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
        AND date <= ${sqlString(dateStr)}
        AND facebook_campaign_id IS NOT NULL
        AND media_source = 'facebook'
    `);
    
    for (const row of directRows) {
      if (row.facebook_campaign_id) {
        fbCampaignIds.add(String(row.facebook_campaign_id));
      }
    }
    
    // Method 2: Fallback - search in raw_payload (for older data)
    if (fbCampaignIds.size === 0) {
      const rows = await allRows<any>(conn, `
        SELECT DISTINCT raw_payload
        FROM campaign_index
        WHERE campaign_id = ${sqlString(strategisCampaignId)}
          AND date >= ${sqlString(startDate.toISOString().slice(0, 10))}
          AND date <= ${sqlString(dateStr)}
          AND raw_payload IS NOT NULL
          AND media_source = 'facebook'
      `);
      
      for (const row of rows) {
        try {
          const raw = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload;
          // Check various possible field names for Facebook campaign ID
          const fbCampaignId = 
            raw?.fbCampaignId || 
            raw?.fb_campaign_id || 
            raw?.facebookCampaignId || 
            raw?.properties?.fbCampaignId ||
            raw?.properties?.fb_campaign_id ||
            raw?.campaignId || // Facebook API might return campaignId as Facebook ID
            raw?.id; // Sometimes just 'id'
          
          if (fbCampaignId && String(fbCampaignId).length > 10 && !String(fbCampaignId).includes('sipuli')) {
            // Facebook IDs are long numbers, not short alphanumeric like Strategis IDs
            fbCampaignIds.add(String(fbCampaignId));
          }
        } catch {
          // Ignore malformed JSON
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
  const fbCampaignId = getFlag('fb-campaign-id'); // Facebook campaign ID (alternative to campaign-id)
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

  if (!campaignId && !fbCampaignId && !showSample) {
    console.error('Error: --campaign-id (Strategis ID) or --fb-campaign-id (Facebook ID) is required');
    console.error('  Or use --show-sample=true to see sample data');
    console.error('  You can also use --adset-id or --ad-id to filter by those instead');
    process.exit(1);
  }

  // Load campaign mapping from monitoring database
  const conn = createMonitoringConnection();
  // Ensure schema is initialized (adds facebook_campaign_id column if needed)
  await initMonitoringSchema(conn);
  
  // Initialize API early so we can use it for direct S1 API queries
  const api = new StrategisApi({
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    networkId: process.env.STRATEGIS_NETWORK_ID,
    timezone: process.env.STRATEGIS_TIMEZONE || 'UTC',
  });
  
  let fbCampaignIds: Set<string> = new Set();
  let foundStrategisId: string | null = null;
  const searchCampaignId = campaignId || fbCampaignId;
  
  if (fbCampaignId) {
    // User provided Facebook campaign ID directly - find the Strategis campaign ID
    // NOTE: This Facebook campaign ID was chosen from sample session data (--show-sample=true)
    // It's one of the campaigns that appeared in the API response for 2025-12-08
    fbCampaignIds.add(fbCampaignId);
    console.log(`Using Facebook campaign ID directly: ${fbCampaignId}`);
    console.log(`(This ID was from sample session data - it may not map to a Strategis campaign in campaign_index)`);
    console.log('Looking up Strategis campaign ID...');
    foundStrategisId = await findStrategisCampaignId(conn, fbCampaignId, dateStr, api);
    if (foundStrategisId) {
      console.log(`  ✓ Found Strategis campaign ID: ${foundStrategisId}`);
    } else {
      console.log(`  ⚠ Could not find Strategis campaign ID for Facebook campaign ${fbCampaignId}`);
      console.log(`    Possible reasons:`);
      console.log(`    - campaign_index stores Strategis campaign IDs, not Facebook campaign IDs`);
      console.log(`    - Facebook APIs return strategisCampaignId, not Facebook campaign IDs`);
      console.log(`    - This campaign may not be ingested into campaign_index yet`);
      console.log(`    - The mapping may need to be found via adset_id or ad_id instead`);
    }
  } else if (campaignId) {
    console.log('Loading campaign mapping from monitoring database...');
    fbCampaignIds = await findFacebookCampaignIds(conn, campaignId, dateStr);
    
    if (fbCampaignIds.size > 0) {
      console.log(`  ✓ Found ${fbCampaignIds.size} Facebook campaign ID(s) for Strategis campaign ${campaignId}:`);
      console.log(`    ${Array.from(fbCampaignIds).slice(0, 5).join(', ')}${fbCampaignIds.size > 5 ? '...' : ''}`);
    } else {
      console.log(`  ⚠ Warning: Could not find Facebook campaign IDs for Strategis campaign ${campaignId}`);
      console.log(`    Will try to match by Strategis campaign ID directly (may not work)`);
      console.log(`    Tip: Use --fb-campaign-id=<id> to provide Facebook campaign ID directly`);
      console.log(`    Tip: Or check if campaign_index has data for this campaign with Facebook IDs in raw_payload`);
    }
  }
  
  closeConnection(conn);

  // Display header with campaign IDs
  const displayId = fbCampaignId 
    ? `Facebook: ${fbCampaignId}${foundStrategisId ? ` (Strategis: ${foundStrategisId})` : ''}` 
    : campaignId 
    ? `Strategis: ${campaignId}` 
    : '(filtering by adset/ad)';
  console.log(`\n# Keyword Performance for Campaign: ${displayId}`);
  console.log(`Date Range: ${dateStr} (last ${days} days)\n`);

  // API was already initialized above for campaign ID lookup

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
        const campaignName = session.campaign_name || session.campaignName || session.networkCampaignName;
        
        // Extract strategisCampaignId from campaign name if available
        // Pattern: campaignName.split('_')[0] (as per Strategis architecture)
        let sessionStrategisId: string | null = null;
        if (campaignName) {
          sessionStrategisId = extractStrategisCampaignIdFromName(campaignName);
        }
        
        // Also check if session has strategisCampaignId directly
        const directStrategisId = session.strategisCampaignId || session.strategis_campaign_id || session.strategiscampaignid;
        if (directStrategisId) {
          sessionStrategisId = String(directStrategisId);
        }
        
        if (!fbCampaignId && !sessionStrategisId) continue;
        
        // Check if this session matches our search criteria
        let matchesCampaign = false;
        if (searchCampaignId) {
          if (fbCampaignIds.size > 0) {
            // We have Facebook campaign IDs to match against
            matchesCampaign = fbCampaignIds.has(String(fbCampaignId));
          } else if (campaignId) {
            // Match by Strategis campaign ID (from name extraction or direct field)
            if (sessionStrategisId && sessionStrategisId.toLowerCase() === campaignId.toLowerCase()) {
              matchesCampaign = true;
            } else if (fbCampaignId) {
              // Fallback: try direct match (in case campaign_id in session is actually Strategis ID)
              const fbCampaignIdStr = String(fbCampaignId).toLowerCase().trim();
              const searchId = campaignId.toLowerCase().trim();
              matchesCampaign = fbCampaignIdStr === searchId || fbCampaignIdStr.includes(searchId);
            }
          } else if (foundStrategisId) {
            // Match by found Strategis ID (from lookup)
            matchesCampaign = sessionStrategisId === foundStrategisId;
          } else if (fbCampaignId && fbCampaignIds.size === 0) {
            // If we're searching by Facebook campaign ID but haven't found Strategis ID yet
            // Match if the session's Facebook campaign ID matches
            matchesCampaign = String(fbCampaignId) === String(searchCampaignId);
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

        // Calculate total revenue for this session
        // 
        // IMPORTANT: Revenue calculation must be accurate as RPC depends on it.
        //
        // Revenue calculation priority:
        // 1. Sum of all revenue values in revenue_updates array - Each click hour reports incremental revenue
        //    This is the PRIMARY method: sum revenue from all reported click hours
        // 2. session.total_revenue - Only use if we can verify it's final (end of day, not mid-day snapshot)
        //    NOTE: total_revenue is updated throughout the day, so we should NOT use it for mid-day snapshots
        // 3. Direct revenue fields - Fallback only
        //
        // Note: revenue_updates array contains incremental revenue updates at different click hours.
        // Each update's revenue value represents the revenue reported for that specific click hour.
        // We MUST SUM all revenue values to get the total revenue for the session.
        let revenue = 0;
        
        if (session.revenue_updates && Array.isArray(session.revenue_updates) && session.revenue_updates.length > 0) {
          // PRIMARY METHOD: Sum all revenue values from revenue_updates
          // Each revenue value represents incremental revenue for that click hour
          revenue = session.revenue_updates.reduce((sum: number, update: any) => {
            const rev = Number(update.revenue || 0);
            if (!isNaN(rev) && rev > 0) {
              return sum + rev;
            }
            return sum;
          }, 0);
          
          // Only use total_revenue as validation/fallback if:
          // 1. Sum is zero or invalid AND total_revenue exists
          // 2. We're querying historical data (not current day) where total_revenue is final
          // For now, we prioritize the sum from revenue_updates as it's the source of truth
          if (revenue === 0 && session.total_revenue !== undefined && session.total_revenue !== null) {
            const totalRev = Number(session.total_revenue);
            if (!isNaN(totalRev) && totalRev > 0) {
              // Only use total_revenue if sum is zero (might be a session with no revenue updates yet)
              revenue = totalRev;
            }
          }
        } else if (session.total_revenue !== undefined && session.total_revenue !== null) {
          // Fallback: Use total_revenue only if revenue_updates is not available
          // WARNING: This may be mid-day data, so total_revenue might not be final
          const totalRev = Number(session.total_revenue);
          if (!isNaN(totalRev)) {
            revenue = totalRev;
          }
        } else {
          // Final fallback: Direct revenue fields
          revenue = Number(
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
      
      console.log(`  ✓ Processed ${matchingSessions} sessions matching campaign ${searchCampaignId || '(filtered)'}, found ${keywordStats.size} unique keywords`);
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
      stats.rpc = stats.sessions > 0 ? stats.revenue / stats.sessions : 0; // Revenue per search (session)
      stats.rpcPerClick = stats.sessionsWithRevenue > 0 ? stats.revenue / stats.sessionsWithRevenue : 0; // Revenue per click (session with revenue)
    }

    const sortedKeywords = Array.from(keywordStats.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue);

    const displayCampaignId = foundStrategisId || campaignId || searchCampaignId || '(filtered)';
    console.log(`\nFound ${sortedKeywords.length} keywords for campaign ${displayCampaignId}:\n`);
    displayKeywordResults(sortedKeywords, keywordStats);
    
    // Show verification info
    if (foundStrategisId || campaignId) {
      const strategisId = foundStrategisId || campaignId;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`VERIFICATION:`);
      console.log(`  Strategis Campaign ID: ${strategisId}`);
      if (fbCampaignId) {
        console.log(`  Facebook Campaign ID: ${fbCampaignId}`);
      }
      const totalRevenue = Array.from(keywordStats.values()).reduce((sum, stats) => sum + stats.revenue, 0);
      const totalSessions = Array.from(keywordStats.values()).reduce((sum, stats) => sum + stats.sessions, 0);
      console.log(`\n  Keyword Query Results:`);
      console.log(`    Total Sessions: ${totalSessions}`);
      console.log(`    Total Revenue: $${totalRevenue.toFixed(2)}`);
      console.log(`    Overall RPC: $${(totalRevenue / totalSessions).toFixed(4)}`);
      console.log(`\n  To verify revenue in snapshot report, run:`);
      console.log(`    npm run monitor:snapshot-report -- --campaign-id=${strategisId} --date=${dateStr} --days=${days}`);
      console.log(`${'='.repeat(80)}\n`);
    }
    
    return;
  }

  // No keyword data found
  console.log(`\nNo keyword data found for campaign ${searchCampaignId || '(filtered)'} in the date range.`);
  console.log(`\nPossible reasons:`);
  console.log(`  - Campaign has no sessions in this date range`);
  console.log(`  - Sessions don't have keyword data`);
  console.log(`  - Campaign ID mismatch (check exact campaign_id)`);
  console.log(`\nTips:`);
  console.log(`  - Use --fb-campaign-id=<id> to provide Facebook campaign ID directly`);
  console.log(`  - Use --show-sample=true to see sample campaign IDs from the API`);
  console.log(`  - Verify the campaign ID matches exactly (case-sensitive)`);
  process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

