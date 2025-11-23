# Monitoring Pipeline Data Architecture

## Overview

**Single Database, Multiple Tables, Merged Campaign Data**

All API data flows into **one DuckDB database** (`/opt/liftoff/data/monitoring.duckdb`), but is organized into **5 tables** for different purposes.

## Database Structure

```
monitoring.duckdb (Single Database File)
├── campaign_index (MERGED campaign data from all APIs)
├── session_hourly_metrics (Session-level metrics)
├── endpoint_completeness (API health tracking)
├── campaign_index_runs (Audit log)
└── session_ingest_runs (Audit log)
```

## Data Flow: Campaign Index (Merged Table)

### The `campaign_index` Table

**This is where all 14 API endpoints merge their data into a single unified record per campaign.**

```
14 API Endpoints → CampaignAggregator → campaign_index Table
```

### Merging Process

1. **Fetch from 14 endpoints** (S1 Daily, Facebook Report, Taboola, Outbrain, etc.)
2. **Aggregate by campaign_id** using `CampaignAggregator` class
3. **Merge fields** from all sources:
   - Revenue from S1 Daily
   - Spend from platform-specific endpoints
   - Metadata (owner, lane, category) from S1 or Facebook
   - Media source from networkId mapping
4. **Write single row** per campaign/date/level to `campaign_index`

### Example: How Facebook Data Merges

```
Facebook Report API
  → spend_usd: $100
  → clicks: 500
  
Facebook Campaigns API
  → campaign_name: "Campaign ABC"
  → owner: "John"
  
S1 Daily API
  → revenue_usd: $200
  → sessions: 1000
  → buyer: "John" (owner)
  → category: "Finance"

Result in campaign_index:
  campaign_id: "12345"
  campaign_name: "Campaign ABC"
  owner: "John"
  category: "Finance"
  media_source: "facebook"
  spend_usd: 100
  revenue_usd: 200
  sessions: 1000
  clicks: 500
  roas: 2.0
```

### Example: How Taboola Data Merges

```
S1 Daily API (networkId=107)
  → revenue_usd: $150
  → sessions: 800
  → buyer: "Jane"
  → category: "Healthcare"
  
Taboola Report API (FAILING - 502)
  → spend_usd: NULL (missing)

Result in campaign_index:
  campaign_id: "67890"
  owner: "Jane"
  category: "Healthcare"
  media_source: "taboola"
  spend_usd: NULL (missing due to 502)
  revenue_usd: 150
  sessions: 800
  roas: NULL (can't calculate without spend)
```

## Table Details

### 1. `campaign_index` (Main Merged Table)

**Purpose**: Unified campaign data from all platforms

**Data Sources** (merged):
- S1 Daily V3 (revenue, sessions, clicks, metadata)
- S1 Reconciled (revenue, buyer)
- S1 RPC Average (RPC averages)
- Facebook Report (spend, clicks)
- Facebook Campaigns (metadata)
- Facebook Adsets (adset data)
- Facebook Pixel (conversions)
- Strategis Metrics (impressions)
- Taboola Report (spend) - currently failing
- Outbrain Hourly (spend)
- NewsBreak Report (spend)
- MediaGo Report (spend)
- Zemanta Reconciled (spend)
- SmartNews Report (spend)

**Key Fields**:
- `campaign_id` (primary key)
- `date`, `level`, `snapshot_source`
- `owner`, `lane`, `category`
- `media_source` (facebook, taboola, outbrain, etc.)
- `spend_usd`, `revenue_usd`, `sessions`, `clicks`, `conversions`
- `roas` (calculated)

**One row per**: `(campaign_id, date, level, snapshot_source)`

### 2. `session_hourly_metrics` (Session-Level Data)

**Purpose**: Hourly session/revenue breakdown by campaign

**Data Source**: S1 Hourly V3 (all platforms)

**Key Fields**:
- `campaign_id`, `date`, `click_hour`
- `sessions`, `revenue`, `rpc`
- `owner`, `lane`, `category`, `media_source` (joined from campaign_index)

**One row per**: `(campaign_id, date, click_hour)`

### 3. `endpoint_completeness` (Health Tracking)

**Purpose**: Track which endpoints succeeded/failed per date

**Data Source**: All API calls

**Key Fields**:
- `date`, `endpoint`, `platform`
- `status` (OK/PARTIAL/FAILED)
- `row_count`, `has_revenue`, `has_spend`
- `error_message`, `retry_count`

**One row per**: `(date, endpoint)`

### 4. `campaign_index_runs` (Audit Log)

**Purpose**: Track ingestion job runs

**One row per**: Ingestion run

### 5. `session_ingest_runs` (Audit Log)

**Purpose**: Track session ingestion job runs

**One row per**: Session ingestion run

## Query Examples

### Get All Campaign Data (Merged)

```sql
SELECT 
  campaign_id,
  campaign_name,
  owner,
  category,
  media_source,
  spend_usd,
  revenue_usd,
  sessions,
  clicks,
  roas
FROM campaign_index
WHERE date = '2025-11-23'
ORDER BY revenue_usd DESC;
```

### Join Campaign Index with Session Metrics

```sql
SELECT 
  c.campaign_id,
  c.campaign_name,
  c.media_source,
  c.revenue_usd as daily_revenue,
  SUM(s.revenue) as hourly_revenue_total,
  SUM(s.sessions) as hourly_sessions_total
FROM campaign_index c
LEFT JOIN session_hourly_metrics s
  ON c.campaign_id = s.campaign_id
  AND c.date = s.date
WHERE c.date = '2025-11-23'
GROUP BY c.campaign_id, c.campaign_name, c.media_source, c.revenue_usd;
```

### Check Endpoint Health

```sql
SELECT 
  date,
  endpoint,
  platform,
  status,
  row_count,
  has_revenue,
  has_spend,
  error_message
FROM endpoint_completeness
WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
ORDER BY date DESC, endpoint;
```

## Key Points

1. **Single Database**: All data in one DuckDB file (`monitoring.duckdb`)

2. **Campaign Data Merges**: All 14 API endpoints merge into `campaign_index` table

3. **Session Data Separate**: Session-level metrics stored separately in `session_hourly_metrics`

4. **Health Tracking**: Endpoint failures tracked in `endpoint_completeness`

5. **Audit Logs**: All ingestion runs logged for debugging

6. **Joinable**: Tables can be joined on `campaign_id` and `date` for comprehensive analysis

## Benefits of This Architecture

- **Unified View**: One table (`campaign_index`) has all campaign data from all platforms
- **No Manual Joins**: Data already merged and ready to query
- **Platform Agnostic**: Same schema for Facebook, Taboola, Outbrain, etc.
- **Health Monitoring**: Can see which endpoints are failing
- **Audit Trail**: Full history of ingestion runs

