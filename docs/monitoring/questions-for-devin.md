# Questions for Devin: Strategis API Data Coverage

## Goal
Build a monitoring pipeline that tracks campaigns across **all media sources** (Facebook, Taboola, Outbrain, NewsBreak, MediaGo, GoogleAds, Zemanta, SmartNews) with:
- Campaign metadata (owner, lane, category, media_source)
- Spend data (for ROAS calculation)
- Revenue/session data (already have from S1)

## Context
We're currently hitting **Facebook-specific endpoints** (`/api/facebook/report`, `/api/facebook/campaigns`) which only return Facebook campaigns. We need to find the Strategis API endpoints that return data for **all platforms** (Taboola, Outbrain, NewsBreak, MediaGo, etc.).

## Current Situation
- ✅ **S1 Hourly/Daily**: We're pulling revenue/sessions from `/api/s1/report/hourly-v3` and `/api/s1/report/daily-v3`
- ❌ **Campaign Metadata**: Only getting Facebook campaigns from `/api/facebook/campaigns` and `/api/facebook/report` - missing owner/lane/category for non-Facebook campaigns
- ❌ **Spend Data**: Only getting Facebook spend - missing Taboola/Outbrain/NewsBreak/MediaGo spend
- ❌ **Media Source Attribution**: 147 campaigns have NULL `media_source` - likely Taboola/Outbrain/NewsBreak/MediaGo campaigns

## Questions for Devin

### 1. Campaign Metadata (Owner, Lane, Category, Media Source)

**Q1.1**: What Strategis API endpoint returns campaign metadata (owner, lane, category, media_source) for **ALL campaigns** regardless of platform?

- We know `POST /api/campaigns` exists for creating campaigns - is there a `GET /api/campaigns` endpoint to query/list campaigns?
- Does it return `properties.buyer` (owner), `properties.lane`, `category`, and `properties.networkName` (media_source)?
- Can we filter by `organization` and date range?
- What are the query parameters? (e.g., `GET /api/campaigns?organization=Interlincx&dateStart=...&dateEnd=...`)

**Q1.1a**: Alternatively, is there a Strategis endpoint that returns reconciled/day report data with campaign metadata included?
- Our backend has `/api/strategist/query` that returns owner/lane/category/source from snapshots - what Strategis API endpoint provides this same data?
- Is there a `/api/report` or `/api/reconciled` endpoint that includes campaign metadata fields?

**Q1.2**: If campaign metadata is stored in Strategis but not exposed via API, where is it stored?
- Is it in the campaign `properties` object?
- Do we need to query a different service/database?

**Q1.3**: For campaigns that exist in S1 revenue data but don't have metadata in Strategis, how do we identify which platform they're from?
- Does S1 hourly/daily data include `source` or `networkName` fields?
- Is there a campaign_id → platform mapping table?

### 2. Spend Data for Non-Facebook Platforms

**Q2.1**: What Strategis API endpoints return spend data for:
- Taboola
- Outbrain  
- NewsBreak
- MediaGo
- GoogleAds
- Zemanta
- SmartNews

**Q2.2**: Are there platform-specific report endpoints like:
- `/api/taboola/report` or `/api/taboola/daily`?
- `/api/outbrain/report`?
- `/api/newsbreak/report`?
- `/api/mediago/report`?

**Q2.3**: Or is there a unified endpoint that accepts `networkName` parameter?
- Example: `/api/report?networkName=taboola&dateStart=...&dateEnd=...`

**Q2.4**: What fields do these endpoints return?
- Spend (USD)
- Impressions, clicks, conversions
- Campaign IDs (strategisCampaignId or platform-specific IDs?)

### 3. S1 Report Coverage

**Q3.1**: Does `/api/s1/report/hourly-v3` include revenue from **all platforms** or just Facebook?
- We're currently querying with `networkId=112` - is this Facebook-specific?
- Should we query without `networkId` to get all platforms?
- Or query multiple times with different `networkId` values?

**Q3.2**: Does S1 hourly/daily data include a `source` or `networkName` field to identify which platform the traffic came from?
- If yes, what are the possible values? (taboola, outbrain, newsbreak, mediago, facebook, etc.)
- If no, how do we map `strategisCampaignId` → platform?

**Q3.3**: What are the `networkId` values for each platform?
- Facebook: 112?
- Taboola: ?
- Outbrain: ?
- NewsBreak: ?
- MediaGo: ?

### 4. Campaign ID Mapping

**Q4.1**: How do we map between:
- Strategis campaign IDs (`strategisCampaignId`)
- Platform-specific campaign IDs (e.g., Facebook `campaignId`, Taboola campaign IDs)
- S1 campaign IDs

**Q4.2**: When we see a `strategisCampaignId` in S1 revenue data, how do we determine:
- Which platform it's from?
- Who owns it (buyer/owner)?
- What lane/category it belongs to?

### 5. Recommended Approach

**Q5.1**: What's the recommended way to build a complete campaign index that includes:
- All campaigns (Facebook + Taboola + Outbrain + NewsBreak + MediaGo + etc.)
- Owner, lane, category for each campaign
- Media source/platform identification
- Spend data for ROAS calculation

**Q5.2**: Should we:
- Query Strategis campaign metadata API to get all campaigns with properties?
- Then join with platform-specific spend reports?
- Then join with S1 revenue data?

**Q5.3**: Are there any existing Strategis endpoints that already merge this data?
- Something like `/api/campaigns/performance` that includes spend + revenue + metadata?

## Current API Calls We're Making

```typescript
// Facebook-specific (only gets Facebook campaigns)
/api/facebook/report?level=campaign&dimensions=campaignId&...
/api/facebook/campaigns?dateStart=...&dateEnd=...
/api/facebook/adsets/day?dateStart=...&dateEnd=...

// S1 Revenue (might be Facebook-only due to networkId=112?)
/api/s1/report/daily-v3?networkId=112&dimensions=date-strategisCampaignId&...
/api/s1/report/hourly-v3?networkId=112&dimensions=date-hour-strategisCampaignId&...
/api/s1/rpc-average?networkId=112&dimensions=strategisCampaignId&...

// Strategis metrics (Facebook-only due to networkName=facebook)
/api/strategis-report?networkName=facebook&dimensions=date-strategisCampaignId&...
/api/facebook-pixel-report?networkName=facebook&dimensions=date-strategisCampaignId&...
```

## What We Need

```typescript
// Campaign metadata for ALL platforms
GET /api/campaigns?organization=Interlincx&dateStart=...&dateEnd=...
// Returns: { id, name, category, properties: { buyer, lane, networkName }, ... }

// Spend data for each platform
GET /api/taboola/report?dateStart=...&dateEnd=...&dimensions=date-strategisCampaignId
GET /api/outbrain/report?dateStart=...&dateEnd=...&dimensions=date-strategisCampaignId
GET /api/newsbreak/report?dateStart=...&dateEnd=...&dimensions=date-strategisCampaignId
GET /api/mediago/report?dateStart=...&dateEnd=...&dimensions=date-strategisCampaignId
// Or unified:
GET /api/report?networkName=taboola&dateStart=...&dateEnd=...&dimensions=date-strategisCampaignId

// S1 revenue for ALL platforms (not just Facebook)
GET /api/s1/report/hourly-v3?dimensions=date-hour-strategisCampaignId-source&...
// (without networkId filter, or with source field included)
```

## Expected Data Structure

For each campaign, we need:
```typescript
{
  strategisCampaignId: string,
  campaignName: string,
  owner: string,           // buyer/owner
  lane: string,            // ASC, LAL_1, LAL_2_5, Contextual, Sandbox, Warm
  category: string,        // Healthcare, Finance, etc.
  mediaSource: string,    // facebook, taboola, outbrain, newsbreak, mediago, etc.
  spendUsd: number,       // from platform spend reports
  revenueUsd: number,     // from S1 reports
  sessions: number,       // from S1 reports
  clicks: number,         // from platform reports
  roas: number           // calculated: revenueUsd / spendUsd
}
```

