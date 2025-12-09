# Campaign ID Mapping: S1 Session Data ↔ Facebook Campaign IDs ↔ Strategis Campaign IDs

## Overview

This document explains how S1 session-level data connects to Facebook campaign IDs and Strategis campaign IDs. Understanding this mapping is critical for querying keyword-level data and matching sessions to campaigns.

## Key Linking Mechanism: `strategisCampaignId`

The **`strategisCampaignId`** is the central key that links all data sources together. It's extracted from Facebook campaign names using the pattern:

```javascript
campaignName.split('_')[0]
```

For example, if a Facebook campaign name is `sire1f06al_20241208_facebook`, the `strategisCampaignId` is `sire1f06al`.

## Data Flow Architecture

### 1. Traffic Flow (`/route` endpoint)

When traffic comes through the `/route` endpoint (`strategis-api/lib/api/index.js`):

1. **Generates a `sessionId`** (unique per request)
2. **Maps `sessionId` → `networkClickId`** (stored in Redis lookup `lookups:sessionIdNetworkClickId`)
3. **Records identifiers**:
   - `strategisCampaignId` (extracted from campaign name)
   - `networkCampaignId` (Facebook campaign ID)
   - Other identifiers

### 2. S1 Reports APIs

**Endpoints** (`strategis-api/lib/api/s1-reports.js`):
- `GET /api/s1/report` - Daily S1 report with `campaignId` field
- `GET /api/s1/report/hourly-v2` and `hourly-v3` - Hourly S1 data
- `GET /api/s1/high-level-report` - High-level aggregated S1 data

**Key Details**:
- Uses `networkId: NETWORK_IDS.FACEBOOK` (value: 109) to filter Facebook traffic
- `subId` in S1 reports follows format: `{campaignId}_{segment}_{device}_{country}_{sessionId}`
- `extractSessionId()` utility function parses `subId` to get `sessionId` for joining

### 3. Facebook Reports APIs

**Endpoints** (`strategis-api/lib/api/facebook.js`):
- `GET /api/facebook/report` - Facebook insights with `networkCampaignId`
- `GET /api/facebook/hourly-report-v2` - Hourly Facebook data

### 4. Redis Lookup Tables

**Lookup Tables** (`strategis-api/lib/models/lookups.js`) - Redis hash tables that map IDs:

- `campaignIdStrategisCampaignIdKey` - Maps Facebook `networkCampaignId` → `strategisCampaignId`
- `strategisCampaignIdBuyerKey` - Maps `strategisCampaignId` → buyer
- `facebookAdIdCampaignIdKey` - Maps Facebook ad ID → campaign ID

### 5. Combined Report Functions

**Functions** (`strategis-static/client/api/reports.js`):
- `getFacebookS1ReconciledReport()` - Combines Facebook + S1 + Strategis data
- `getFacebookHourlyReportV2()` - Hourly Facebook data

## Data Connection Flow

```
Traffic → /route → sessionId generated → mapped to networkClickId
                 → strategisCampaignId extracted from campaign name
                 → stored in Redis lookups

S1 Data → subId contains sessionId → extract sessionId → join with lookups → get strategisCampaignId

Facebook Data → networkCampaignId → lookup campaignIdStrategisCampaignId → get strategisCampaignId
```

## Implementation in Monitoring System

### `campaign_index` Table

The `campaign_index` table stores mappings between:
- `campaign_id` (Strategis campaign ID, e.g., `sire1f06al`)
- `facebook_campaign_id` (Facebook campaign ID, e.g., `120231668335880424`)
- `campaign_name` (Facebook campaign name, e.g., `sire1f06al_20241208_facebook`)

### `session_hourly_metrics` Table

The `session_hourly_metrics` table stores:
- `campaign_id` (Facebook campaign ID from session data)
- Other session metrics

### Join Logic (from `snapshotHourlyMetrics.ts`)

```sql
FROM session_hourly_metrics shm
LEFT JOIN campaign_index ci
  ON ci.facebook_campaign_id = shm.campaign_id
 AND ci.date = shm.date
```

This join links Facebook campaign IDs from session data to Strategis campaign IDs in `campaign_index`.

### Querying Keyword Data (`queryCampaignKeywords.ts`)

**Challenge**: S1 session-level API (`/api/s1/report/get-session-rev`) returns:
- `campaign_id` (Facebook campaign ID)
- `keyword` (keyword data)
- **BUT NOT** `campaign_name` or `strategisCampaignId`

**Solution**: 
1. **Pre-build lookup map**: Query `campaign_index` to build `facebook_campaign_id → campaign_name` map
2. **Reverse lookup**: Join `session_hourly_metrics` with `campaign_index` to find Facebook IDs that map to Strategis ID
3. **On-the-fly lookup**: If pre-built map is empty, query `campaign_index` for each Facebook campaign ID encountered

**Matching Logic**:
```typescript
// Method 1: Direct Facebook ID match (if fbCampaignIds populated)
if (fbCampaignIds.has(String(fbCampaignId))) {
  matchesCampaign = true;
}

// Method 2: Extract strategisCampaignId from campaign name
const strategisId = campaignName.split('_')[0];
if (strategisId === campaignId) {
  matchesCampaign = true;
}

// Method 3: Campaign name pattern matching
if (campaignName.includes(campaignId) || campaignName.startsWith(campaignId + '_')) {
  matchesCampaign = true;
}
```

## Common Issues and Solutions

### Issue: `fbCampaignIds` is empty

**Cause**: `campaign_index` doesn't have `facebook_campaign_id` populated for the Strategis campaign ID.

**Solution**: Use reverse lookup from `session_hourly_metrics`:
```sql
SELECT DISTINCT shm.campaign_id AS fb_campaign_id, ci.campaign_name
FROM session_hourly_metrics shm
INNER JOIN campaign_index ci
  ON ci.facebook_campaign_id = shm.campaign_id
 AND ci.date = shm.date
WHERE ci.campaign_id = 'sire1f06al'
  AND shm.date = DATE '2025-12-08'
  AND shm.media_source = 'facebook'
```

If INNER JOIN finds nothing, try LEFT JOIN with campaign name pattern matching.

### Issue: Campaign names not in S1 session API response

**Cause**: S1 session-level API doesn't return `campaign_name` field.

**Solution**: 
1. Build lookup map from `campaign_index` before processing sessions
2. Use on-the-fly lookup for each Facebook campaign ID if map is empty
3. Extract `strategisCampaignId` from campaign name when available

### Issue: Sessions not matching

**Cause**: Multiple possible causes:
- `fbCampaignIds` not populated
- Campaign names not available
- Strategis ID extraction failing

**Solution**: 
1. Ensure `campaign_index` has `facebook_campaign_id` populated (run `monitor:ingest-campaigns` for both `campaign` and `adset` levels)
2. Use reverse lookup from `session_hourly_metrics`
3. Add debug logging to see why sessions aren't matching

## Best Practices

1. **Always populate `campaign_index`** before querying keywords:
   ```bash
   npm run monitor:ingest-campaigns -- --date=2025-12-08 --level=campaign
   npm run monitor:ingest-campaigns -- --date=2025-12-08 --level=adset
   ```

2. **Use reverse lookup** when direct lookup fails - query `session_hourly_metrics` joined with `campaign_index`

3. **Extract `strategisCampaignId` from campaign names** using `campaignName.split('_')[0]` pattern

4. **Match by Facebook campaign ID** when available - this is the most reliable method

5. **Document any new mapping logic** to avoid backtracking

## Related Files

- `backend/src/scripts/monitoring/queryCampaignKeywords.ts` - Keyword query script
- `backend/src/scripts/monitoring/snapshotHourlyMetrics.ts` - Snapshot aggregation (shows join logic)
- `backend/src/scripts/monitoring/ingestCampaignIndex.ts` - Campaign index ingestion
- `backend/src/lib/monitoringDb.ts` - Database schema definitions
