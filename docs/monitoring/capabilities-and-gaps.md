# Monitoring Database: Current Capabilities & Gaps

## ✅ What We CAN Monitor Now

### 1. **Revenue & Sessions Across ALL Media Sources**
- **Source**: S1 Hourly Reports (`/api/s1/report/hourly-v3`)
- **Coverage**: Taboola, Outbrain, NewsBreak, MediaGo, Facebook, GoogleAds, Zemanta, SmartNews
- **Data**: Revenue, sessions, clicks aggregated by campaign and hour
- **Why**: S1 tracks revenue from ALL traffic sources regardless of where the click originated

### 2. **Campaign Metadata (Facebook-Focused)**
- **Source**: Facebook API endpoints + S1 daily reports
- **Coverage**: Facebook campaigns primarily
- **Data**: Campaign names, owner, lane, category, adset info, spend, ROAS
- **Stored in**: `campaign_index` table

### 3. **Cross-Reference Capabilities**
Both tables use `campaign_id` (strategisCampaignId) as the join key, enabling:

```sql
-- Revenue by media source (from session data)
SELECT 
  s.media_source,
  SUM(s.revenue) as total_revenue,
  SUM(s.sessions) as total_sessions,
  AVG(s.rpc) as avg_rpc
FROM session_hourly_metrics s
WHERE s.date = '2025-11-23'
GROUP BY s.media_source;

-- Revenue by owner/lane (joined with campaign metadata)
SELECT 
  c.owner,
  c.lane,
  SUM(s.revenue) as revenue,
  SUM(s.sessions) as sessions,
  AVG(s.rpc) as rpc
FROM session_hourly_metrics s
JOIN campaign_index c ON s.campaign_id = c.campaign_id
WHERE s.date = '2025-11-23'
GROUP BY c.owner, c.lane;

-- RPC by click hour and media source
SELECT 
  s.click_hour,
  s.media_source,
  SUM(s.revenue) as revenue,
  SUM(s.sessions) as sessions,
  SUM(s.revenue) / NULLIF(SUM(s.sessions), 0) as rpc
FROM session_hourly_metrics s
WHERE s.date = '2025-11-23'
GROUP BY s.click_hour, s.media_source
ORDER BY s.click_hour, s.media_source;
```

## ⚠️ Current Gaps

### 1. **Spend Data for Non-Facebook Sources**
- **Missing**: Taboola, Outbrain, NewsBreak, MediaGo spend data
- **Impact**: Cannot calculate ROAS for non-Facebook campaigns
- **Why**: We only pull Facebook spend from `/api/facebook/report` and `/api/facebook/adsets/day`
- **Solution Needed**: Add API calls to fetch spend from:
  - Taboola API
  - Outbrain API  
  - NewsBreak API
  - MediaGo API

### 2. **Campaign Metadata for Non-Facebook Sources**
- **Missing**: Owner, lane, category attribution for Taboola/Outbrain/NewsBreak/MediaGo campaigns
- **Impact**: Cannot filter/group by buyer for non-Facebook campaigns
- **Why**: Campaign index only pulls metadata from Facebook endpoints
- **Solution Needed**: Either:
  - Pull campaign metadata from each platform's API
  - Or maintain a manual mapping table (campaign_id → owner/lane/category)

### 3. **Media Source Attribution in Session Data**
- **Current**: S1 hourly data may not explicitly include `media_source` field
- **Impact**: `session_hourly_metrics.media_source` might be NULL for non-Facebook campaigns
- **Why**: We enrich session data from `campaign_index`, which is Facebook-focused
- **Solution Needed**: 
  - Check if S1 API returns `source` or `networkName` field
  - Or query S1 with different `networkId` values for each platform
  - Or maintain a campaign_id → media_source lookup

### 4. **Network ID Filtering**
- **Current**: We query S1 with `networkId=112` (which might be Facebook-specific)
- **Impact**: Might be missing revenue from other networks
- **Solution Needed**: 
  - Query S1 without `networkId` filter (get all networks)
  - Or query multiple times with different `networkId` values
  - Or use `networkName` parameter instead

## 📊 Example Queries You CAN Run Now

### Revenue by Media Source (if media_source is populated)
```sql
SELECT 
  media_source,
  COUNT(DISTINCT campaign_id) as campaigns,
  SUM(sessions) as sessions,
  SUM(revenue) as revenue,
  SUM(revenue) / NULLIF(SUM(sessions), 0) as rpc
FROM session_hourly_metrics
WHERE date = '2025-11-23'
GROUP BY media_source;
```

### RPC by Click Hour (all sources)
```sql
SELECT 
  click_hour,
  SUM(sessions) as sessions,
  SUM(revenue) as revenue,
  SUM(revenue) / NULLIF(SUM(sessions), 0) as rpc
FROM session_hourly_metrics
WHERE date = '2025-11-23'
GROUP BY click_hour
ORDER BY click_hour;
```

### Campaign Performance (Facebook campaigns with metadata)
```sql
SELECT 
  c.campaign_name,
  c.owner,
  c.lane,
  c.category,
  SUM(s.revenue) as revenue,
  SUM(s.sessions) as sessions,
  AVG(s.rpc) as rpc,
  c.spend_usd as spend,
  c.roas
FROM session_hourly_metrics s
JOIN campaign_index c ON s.campaign_id = c.campaign_id
WHERE s.date = '2025-11-23' AND c.media_source = 'facebook'
GROUP BY c.campaign_id, c.campaign_name, c.owner, c.lane, c.category, c.spend_usd, c.roas;
```

## 🔧 Recommended Next Steps

1. **Verify S1 Data Coverage**
   - Check if S1 hourly returns `source` or `networkName` field
   - Query S1 without `networkId` filter to see all networks
   - Verify revenue from Taboola/Outbrain/etc. is included

2. **Add Non-Facebook Spend Sources**
   - Research API endpoints for Taboola, Outbrain, NewsBreak, MediaGo spend
   - Add fetch methods to `StrategisApi` class
   - Merge spend data into `campaign_index` table

3. **Improve Media Source Attribution**
   - If S1 doesn't provide `media_source`, create a lookup table
   - Or query each platform's campaign API to map campaign_id → platform

4. **Add Query Helper Scripts**
   - Create SQL query templates for common analyses
   - Build a dashboard or reporting script

