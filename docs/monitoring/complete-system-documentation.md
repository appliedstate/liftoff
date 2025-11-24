# Complete Monitoring System Documentation

**Last Updated**: November 2025  
**Purpose**: Comprehensive documentation of the campaign monitoring and launch tracking system built for analyzing RPC drops and tracking campaign launches across all media sources.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Data Sources & API Integration](#data-sources--api-integration)
5. [Scripts & Tools](#scripts--tools)
6. [Data Flow](#data-flow)
7. [Timezone Handling](#timezone-handling)
8. [Key Design Decisions](#key-design-decisions)
9. [Usage Examples](#usage-examples)
10. [Known Issues & Limitations](#known-issues--limitations)
11. [Future Enhancements](#future-enhancements)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

### What This System Does

This monitoring system provides:

1. **Campaign Performance Tracking**: Revenue, spend, ROAS, RPC, sessions, clicks across all media sources
2. **Campaign Launch Detection**: Tracks when campaigns are first launched by buyer, network, and site
3. **Multi-Platform Coverage**: Facebook, Taboola, MediaGo, Outbrain, NewsBreak, Zemanta, SmartNews
4. **Buyer Attribution**: Links campaigns to media buyers (Anastasia, Cook, Dan, Phillip, tj, ben, mike, brie)
5. **Site & Account Mapping**: Maps campaigns to RSOC sites and S1 Google AdSense accounts
6. **Daily P&L Reporting**: Profit & loss by network, buyer, and site
7. **Launch Velocity Tracking**: Monitor how many campaigns each buyer launches per day

### Why It Was Built

**Original Problem**: Need to analyze RPC (Revenue Per Click) drops, specifically identifying categories with large RPC drops on November 21st.

**Evolution**: Expanded to:
- Pull session-level data across all media sources
- Build a campaign index for monitoring
- Track campaign launches by buyer
- Monitor performance by network, site, and buyer
- Provide daily P&L reports

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Strategis API                            │
│  (https://strategis.lincx.in)                              │
│  - S1 Daily/Reconciled Reports                             │
│  - Facebook Reports                                         │
│  - Platform Spend Reports (Taboola, MediaGo, etc.)        │
│  - All data in UTC timezone                                 │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ (Authenticated API Calls)
                     │
┌────────────────────▼──────────────────────────────────────┐
│              Ingestion Scripts (Node.js)                    │
│  - ingestCampaignIndex.ts (campaign metadata)              │
│  - ingestSessionMetrics.ts (session-level data)             │
│  - trackCampaignLaunches.ts (launch detection)            │
│  Uses: DuckDB Node.js library (duckdb npm package)          │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ (Store data via Node.js DuckDB library)
                     │
┌────────────────────▼──────────────────────────────────────┐
│              DuckDB Database File                           │
│  /opt/liftoff/data/monitoring.duckdb                      │
│  (Accessed via Node.js library, NOT CLI)                   │
│                                                             │
│  Tables:                                                    │
│  - campaign_index (campaign metadata & performance)        │
│  - session_hourly_metrics (hourly session data)            │
│  - campaign_launches (launch tracking)                     │
│  - endpoint_completeness (API health tracking)              │
│  - campaign_index_runs (ingestion audit log)               │
│  - session_ingest_runs (session ingestion audit log)      │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ (Query via Node.js scripts)
                     │
┌────────────────────▼──────────────────────────────────────┐
│              Query & Reporting Scripts (Node.js)            │
│  - reportDailyPL.ts (P&L by network/buyer)                │
│  - queryDateLaunches.ts (launches by date)                 │
│  - queryBuyerNetworkSiteActivity.ts (buyer activity)       │
│  - reportLaunchVelocity.ts (launch velocity)               │
│  - summarizeLaunches.ts (launch summaries)                  │
│  Uses: DuckDB Node.js library (duckdb npm package)          │
└─────────────────────────────────────────────────────────────┘
```

**⚠️ CRITICAL**: We use **DuckDB Node.js library** (`duckdb` npm package), NOT the DuckDB CLI.  
All database access is through Node.js scripts via `npm run` commands.

### Deployment Architecture

- **Server**: Hetzner server at `root@5.78.105.235`
- **Database**: DuckDB file at `/opt/liftoff/data/monitoring.duckdb`
- **Database Access**: Via DuckDB Node.js library (`duckdb` npm package), NOT CLI
- **Cron Jobs**: Hourly ingestion at :20 past the hour
- **Authentication**: IX ID service (`https://ix-id.lincx.la`) for Strategis API access

**⚠️ IMPORTANT**: Do NOT install DuckDB CLI. We use the Node.js library only.

---

## Database Schema

### `campaign_index`

**Purpose**: Central table storing campaign metadata and performance metrics from all sources.

**Key Fields**:
- `campaign_id` (TEXT): Strategis campaign ID (canonical ID across all sources)
- `date` (DATE): UTC date (from Strategis API)
- `level` (TEXT): 'campaign' or 'adset'
- `snapshot_source` (TEXT): Data source (e.g., 's1_daily_v3', 'facebook_report')
- `owner` (TEXT): Media buyer (Anastasia, Cook, Dan, etc.)
- `lane` (TEXT): Buyer lane/team
- `category` (TEXT): Campaign category
- `media_source` (TEXT): Platform (facebook, taboola, mediago, etc.)
- `rsoc_site` (TEXT): Site where traffic originated
- `s1_google_account` (TEXT): S1 Google AdSense account
- `spend_usd` (DOUBLE): Campaign spend
- `revenue_usd` (DOUBLE): Campaign revenue
- `sessions` (DOUBLE): Number of sessions
- `clicks` (DOUBLE): Number of clicks
- `conversions` (DOUBLE): Number of conversions
- `roas` (DOUBLE): Return on ad spend
- `raw_payload` (JSON): Original API response

**Data Sources**: Merged from multiple Strategis API endpoints:
- S1 Daily/Reconciled reports (revenue, buyer, category)
- Facebook reports (spend, impressions)
- Platform spend reports (Taboola, MediaGo, Outbrain, etc.)

### `session_hourly_metrics`

**Purpose**: Hourly session-level metrics aggregated by campaign and click hour.

**Key Fields**:
- `date` (DATE): UTC date
- `campaign_id` (TEXT): Campaign ID
- `click_hour` (INTEGER): Hour of day (0-23)
- `sessions` (INTEGER): Number of sessions
- `revenue` (DOUBLE): Revenue for this hour
- `rpc` (DOUBLE): Revenue per click
- `traffic_source` (TEXT): Media source (enriched from campaign_index)
- `owner`, `lane`, `category`, `media_source`: Enriched from campaign_index

**Data Source**: S1 Hourly reports (`/api/s1/report/hourly-v3`)

### `campaign_launches`

**Purpose**: Tracks when campaigns were first detected (launched).

**Key Fields**:
- `campaign_id` (TEXT): Campaign ID (PRIMARY KEY)
- `first_seen_date` (DATE): First date campaign appeared in campaign_index
- `owner` (TEXT): Media buyer
- `lane` (TEXT): Buyer lane
- `category` (TEXT): Campaign category
- `media_source` (TEXT): Platform
- `campaign_name` (TEXT): Campaign name
- `account_id` (TEXT): Account ID
- `detected_at` (TIMESTAMP): When we detected this launch

**Note**: `first_seen_date` means "first seen in our data", not necessarily actual launch date. See [Campaign Launch Detection Logic](#campaign-launch-detection-logic).

### `endpoint_completeness`

**Purpose**: Tracks API endpoint health and data quality.

**Key Fields**:
- `date` (DATE): UTC date
- `endpoint` (TEXT): API endpoint name
- `platform` (TEXT): Media platform
- `status` (TEXT): 'OK', 'PARTIAL', or 'FAILED'
- `row_count` (INTEGER): Number of rows returned
- `has_revenue` (BOOLEAN): Whether revenue data present
- `has_spend` (BOOLEAN): Whether spend data present
- `error_message` (TEXT): Error details if failed
- `retry_count` (INTEGER): Number of retries attempted

### `campaign_index_runs` & `session_ingest_runs`

**Purpose**: Audit logs for ingestion runs.

**Key Fields**:
- `date` (DATE): Date being ingested
- `row_count` (INTEGER): Number of rows processed
- `status` (TEXT): 'success' or 'failed'
- `started_at`, `finished_at` (TIMESTAMP): Timing information

---

## Data Sources & API Integration

### Strategis API Client

**Location**: `backend/src/lib/strategistClient.ts` and `backend/src/lib/strategisApi.ts`

**Authentication**: 
- Uses IX ID service (`https://ix-id.lincx.la`)
- JWT-based authentication
- Credentials: `IX_ID_EMAIL`, `IX_ID_PASSWORD`

**Base URL**: `https://strategis.lincx.in`

**Default Parameters**:
- `organization`: 'Interlincx'
- `adSource`: 'rsoc'
- `timezone`: 'UTC' (all data is UTC)
- `dbSource`: 'ch' (ClickHouse backend)

### API Endpoints Used

#### 1. S1 Reports (Revenue Data)

**Daily Report** (`/api/s1/report/daily-v3`):
- Returns: Revenue, clicks, sessions, buyer, category, rsocSite
- Dimensions: `date-strategisCampaignId-buyer`
- Used for: Campaign revenue and buyer attribution

**Reconciled Report** (`/api/s1/report/reconciled`):
- Returns: Finalized revenue data (1-2 days delayed)
- Used for: More accurate revenue data

**Hourly Report** (`/api/s1/report/hourly-v3`):
- Returns: Hourly session-level data
- Dimensions: `date-hour-strategisCampaignId`
- Used for: Session metrics and RPC by click hour

**RPC Average** (`/api/s1/rpc-average`):
- Returns: 3-day rolling average RPC
- Used for: RPC trend analysis

#### 2. Facebook Reports

**Campaign Report** (`/api/facebook/report`):
- Returns: Spend, impressions, clicks, conversions
- Used for: Facebook campaign performance

**Campaigns Metadata** (`/api/facebook/campaigns`):
- Returns: Campaign metadata (budget, status, bid strategy)
- Used for: Campaign configuration

**Adsets Report** (`/api/facebook/adsets/day`):
- Returns: Adset-level performance
- Used for: Adset breakdown

**Pixel Report** (`/api/facebook-pixel-report`):
- Returns: Pixel-level data
- Used for: Granular tracking

#### 3. Platform Spend Reports

**Taboola** (`/api/taboola/report`):
- Returns: Taboola spend data
- Status: Currently returning 502 errors (upstream issue)

**MediaGo** (`/api/mediago/report`):
- Returns: MediaGo spend data

**Outbrain** (`/api/outbrain/report/hourly`):
- Returns: Outbrain spend data

**NewsBreak** (`/api/newsbreak/report`):
- Returns: NewsBreak spend data

**Zemanta** (`/api/zemanta/reconciled-report`):
- Returns: Zemanta spend data

**SmartNews** (`/api/smartnews/report`):
- Returns: SmartNews spend data

### Network ID Mappings

**Location**: `backend/src/lib/networkIds.ts`

Maps `networkId` from S1 reports to platform names:

```typescript
'107' → 'taboola'
'108' → 'gemini'
'109' → 'outbrain'
'110' → 'facebookDigitalMoses'
'111' → 'tiktok'
'112' → 'facebook'
'113' → 'mediago'
'114' → 'googleads'
'115' → 'zemanta'
'116' → 'newsbreak'
'117' → 'smartnews'
```

### Site to S1 Google Account Mapping

**Location**: `backend/src/scripts/monitoring/ingestCampaignIndex.ts` (hardcoded mapping)

Maps `rsocSite` to S1 Google AdSense accounts:

- `secretprice.com` → `Huntley Media`
- `wesoughtit.com` → `Zeus LLC`
- `trivia-library.com` → `Huntley Media`
- `searchalike.com` → `System1OpCo`
- `read.classroom67.com` → `N/A`

---

## Scripts & Tools

### Data Ingestion Scripts

#### `ingestCampaignIndex.ts`

**Purpose**: Ingest campaign metadata and performance from all Strategis API endpoints.

**Usage**:
```bash
npm run monitor:ingest-campaigns -- --date=2025-11-22 --mode=remote
```

**What It Does**:
1. Fetches data from multiple API endpoints:
   - S1 Daily (all networks)
   - S1 Reconciled (all networks)
   - Facebook reports
   - Platform spend reports (Taboola, MediaGo, Outbrain, etc.)
2. Merges data using `CampaignAggregator` class
3. Extracts: owner, lane, category, media_source, rsocSite, s1GoogleAccount
4. Stores in `campaign_index` table
5. Records endpoint completeness in `endpoint_completeness` table

**Key Features**:
- Retry logic with exponential backoff (for 502/503 errors)
- Data quality checks (row counts, financial indicators)
- Optional/non-fatal platform spend endpoints (continues if Taboola 502s)
- Handles missing data gracefully

#### `ingestSessionMetrics.ts`

**Purpose**: Ingest hourly session-level metrics.

**Usage**:
```bash
npm run monitor:ingest-sessions -- --date=2025-11-22
```

**What It Does**:
1. Fetches S1 Hourly report for all networks
2. Aggregates by campaign and click hour
3. Calculates RPC (Revenue Per Click)
4. Enriches with campaign metadata from `campaign_index`
5. Stores in `session_hourly_metrics` table

#### `trackCampaignLaunches.ts`

**Purpose**: Detect new campaign launches by comparing current campaigns with historical launches.

**Usage**:
```bash
npm run monitor:track-launches -- 2025-11-22
```

**What It Does**:
1. Queries `campaign_index` for specified date
2. Compares with `campaign_launches` table
3. Identifies new campaigns (not seen before)
4. Records with `first_seen_date` and buyer info
5. Updates existing campaigns if earlier date found

**Note**: Uses PST dates currently (needs UTC conversion fix).

### Query & Reporting Scripts

#### `reportDailyPL.ts`

**Purpose**: Daily P&L report by network and buyer.

**Usage**:
```bash
npm run monitor:daily-pl                    # Yesterday (PST)
npm run monitor:daily-pl -- 2025-11-22      # Specific date (PST)
```

**Output**:
- Overall summary (total spend, revenue, profit/loss, ROAS)
- P&L by network
- P&L by buyer
- Detailed buyer → network breakdown
- Top 10 performing combinations
- Revenue by site

**Timezone**: Converts PST input dates to UTC for queries.

#### `queryDateLaunches.ts`

**Purpose**: Show all campaign launches for a specific date.

**Usage**:
```bash
npm run monitor:date-launches -- 2025-11-22
```

**Output**:
- Summary by buyer
- Summary by network
- Summary by site
- Detailed breakdown: buyer → network → site
- Top 20 combinations
- Warning about campaigns that may have been launched earlier

**Timezone**: Converts PST input dates to UTC for queries.

#### `queryBuyerNetworkSiteActivity.ts`

**Purpose**: Query specific buyer-network-site activity over date range.

**Usage**:
```bash
# All Cook's Taboola launches (all sites)
npm run monitor:buyer-activity -- Cook taboola 2

# Cook's Taboola launches on wesoughtit.com
npm run monitor:buyer-activity -- Cook taboola wesoughtit.com 2
```

**Output**:
- Campaign launches by date
- Performance metrics per campaign
- Daily summaries
- Category breakdown
- Overall summary

#### `summarizeLaunches.ts`

**Purpose**: Human-readable summary of campaign launches.

**Usage**:
```bash
npm run monitor:launches-summary -- 2025-11-22
```

**Output**:
- Total campaigns launched
- Top buyers with percentages
- By network with percentages
- Top buyer-network combinations
- Top sites

#### `reportLaunchVelocity.ts`

**Purpose**: Report campaign launch velocity by buyer over date range.

**Usage**:
```bash
npm run monitor:launch-velocity -- 7    # Last 7 days
```

**Output**:
- Total launches by buyer
- Daily launches by buyer (table format)
- Average launches per day by buyer
- Media sources per buyer

### Utility Scripts

#### `backfillCampaignLaunches.ts`

**Purpose**: Backfill historical campaign launches chronologically.

**Usage**:
```bash
npm run monitor:backfill-launches -- 23 0    # Nov 1-22 (23 days back, 0 days forward)
```

**What It Does**:
- Processes dates chronologically (oldest first)
- Sets `first_seen_date` to earliest date campaign appears
- Respects Nov 1 baseline (skips if already set)

#### `setNov1Baseline.ts`

**Purpose**: Set November 1st as baseline for campaign launches.

**Usage**:
```bash
npm run monitor:set-baseline -- --confirm
```

**What It Does**:
- Clears `campaign_launches` table
- Populates with all campaigns found on Nov 1
- Marks them as `first_seen_date = '2025-11-01'`
- Allows tracking incremental launches from Nov 2 onwards

#### `fillMissingOwners.ts`

**Purpose**: Fill in missing owner information from historical data.

**Usage**:
```bash
npm run monitor:fill-owners
```

**What It Does**:
- Finds campaigns with UNKNOWN/NULL owner in `campaign_launches`
- Looks back at all `campaign_index` dates to find owner info
- Updates `campaign_launches` with found owner info

#### `checkAvailableDates.ts`

**Purpose**: Check which dates have data in `campaign_index`.

**Usage**:
```bash
npm run monitor:check-dates
```

**Output**: List of all dates with data, row counts, unique campaigns

#### `debugLaunchCounts.ts`

**Purpose**: Debug campaign launch counts (diagnostic).

**Usage**:
```bash
npm run monitor:debug-launches
```

**Output**: Shows duplicate rows, breakdown by level/source, statistics

---

## Data Flow

### Daily Ingestion Flow

```
1. Cron Job (Hour :20)
   ↓
2. ingestCampaignIndex.ts
   - Fetches from Strategis API (UTC dates)
   - Merges data from multiple endpoints
   - Stores in campaign_index (UTC dates)
   ↓
3. ingestSessionMetrics.ts
   - Fetches hourly session data
   - Aggregates by campaign and hour
   - Enriches with campaign_index metadata
   - Stores in session_hourly_metrics
   ↓
4. trackCampaignLaunches.ts
   - Compares current campaigns with historical
   - Detects new launches
   - Stores in campaign_launches
```

### Query Flow

```
User Query (PST date)
   ↓
Query Script
   - Converts PST → UTC
   - Queries campaign_index (UTC dates)
   - Joins with campaign_launches
   - Returns results
   ↓
Display (shows both PST and UTC dates)
```

### Data Merging Logic

**CampaignAggregator** (`ingestCampaignIndex.ts`):

1. **S1 Daily/Reconciled**: Primary source for revenue, buyer, category, rsocSite
2. **Facebook Reports**: Adds spend, impressions, conversions
3. **Platform Spend Reports**: Adds platform-specific spend
4. **Facebook Campaigns/Adsets**: Adds metadata (budget, status)
5. **S1 RPC Average**: Adds RPC trends
6. **Pixel Reports**: Adds pixel-level data

**Merge Strategy**:
- Uses `strategisCampaignId` as join key
- Merges by date + campaign_id
- Prefers non-null values (uses `setIfEmpty` helper)
- Stores raw payloads for debugging

---

## Timezone Handling

### Critical Issue

**Problem**: Strategis API uses UTC, but query scripts were using PST dates.

**Impact**: Queries missed data or returned wrong dates.

**Solution**: Convert PST input dates to UTC before querying.

### How It Works

1. **Data Ingestion**: Always uses UTC dates (from Strategis API)
2. **Data Storage**: Dates stored in UTC
3. **User Input**: Accept PST dates (user-friendly)
4. **Query Conversion**: Convert PST → UTC before querying
5. **Display**: Show both PST and UTC dates in output

### Conversion Logic

```typescript
// PST date input: "2025-11-22"
// Convert to UTC: "2025-11-22" (or "2025-11-23" depending on time)
// Query: WHERE ci.date = '2025-11-22' (UTC)
```

PST is UTC-8, so:
- Nov 22 PST 00:00 = Nov 22 UTC 08:00
- Most data for "Nov 22 PST" is in "Nov 22 UTC"

### Fixed Scripts

✅ `reportDailyPL.ts`  
✅ `queryDateLaunches.ts`

### Remaining Issue

⚠️ `campaign_launches.first_seen_date` may still be stored in PST (from `trackCampaignLaunches`). Needs fix to standardize on UTC.

**See**: `docs/monitoring/timezone-handling.md` for detailed documentation.

---

## Key Design Decisions

### 1. DuckDB vs PostgreSQL/ClickHouse

**Decision**: Use DuckDB Node.js library for local file-based storage.

**Rationale**:
- Simple deployment (single file, no server)
- No database server needed
- Fast for analytical queries
- Good for single-server deployment
- Access via Node.js (no CLI installation needed)

**Trade-offs**:
- Not suitable for multi-user concurrent access
- File-based (backup = copy file)
- Limited compared to PostgreSQL/ClickHouse for scale

**Implementation**: Uses `duckdb` npm package (v1.4.1), NOT DuckDB CLI. All access is through Node.js scripts.

### 2. Single `campaign_index` Table

**Decision**: Merge all data sources into one `campaign_index` table.

**Rationale**:
- Simplifies queries (one table instead of many)
- Easier to join with other tables
- Single source of truth for campaign metadata

**Trade-offs**:
- Table can get large (many rows per campaign per date)
- Requires careful deduplication logic

### 3. First-Seen Launch Detection

**Decision**: Use "first seen in our data" as launch date.

**Rationale**:
- Simple to implement
- Works with available data sources
- Good enough for monitoring launch velocity

**Limitations**:
- Not actual launch date (could be delayed activity)
- May mark campaigns as "launched" when they first show stats

**Future**: Could use campaign creation timestamps if available from platform APIs.

### 4. Nov 1 Baseline

**Decision**: Set Nov 1 as baseline, track incremental launches from Nov 2.

**Rationale**:
- Separates historical campaigns from new launches
- Focuses on tracking new activity
- Avoids inflating launch counts with historical data

### 5. PST for User Input, UTC for Storage

**Decision**: Accept PST dates from users, store/query in UTC.

**Rationale**:
- PST is more intuitive for users (business hours)
- UTC matches Strategis API (technical requirement)
- Conversion handles the mismatch

---

## Usage Examples

### Daily Workflow

```bash
# 1. Check what dates have data
npm run monitor:check-dates

# 2. Ingest campaign data for yesterday (if not done by cron)
npm run monitor:ingest-campaigns -- --date=2025-11-22 --mode=remote

# 3. Ingest session metrics
npm run monitor:ingest-sessions -- --date=2025-11-22

# 4. Track new launches
npm run monitor:track-launches -- 2025-11-22

# 5. View daily P&L
npm run monitor:daily-pl -- 2025-11-22

# 6. View launches for date
npm run monitor:date-launches -- 2025-11-22

# 7. Check launch velocity
npm run monitor:launch-velocity -- 7
```

### Analyzing Specific Buyer Activity

```bash
# See all of Cook's Taboola launches (all sites, last 2 days)
npm run monitor:buyer-activity -- Cook taboola 2

# See Cook's Taboola launches on wesoughtit.com
npm run monitor:buyer-activity -- Cook taboola wesoughtit.com 2

# Get summary of launches
npm run monitor:launches-summary -- 2025-11-22
```

### Backfilling Historical Data

```bash
# Set Nov 1 baseline
npm run monitor:set-baseline -- --confirm

# Backfill launches from Nov 2-22
npm run monitor:backfill-launches -- 23 0

# Fill missing owner info
npm run monitor:fill-owners
```

### Debugging

```bash
# Check endpoint health
npm run monitor:test-endpoints

# Debug launch counts
npm run monitor:debug-launches

# Check available dates
npm run monitor:check-dates

# Verify data
npm run monitor:verify
```

---

## Known Issues & Limitations

### 1. Taboola Spend Data Missing

**Issue**: `/api/taboola/report` returns 502 errors.

**Impact**: Taboola spend data not available, but revenue/sessions/clicks are captured from S1 reports.

**Status**: Upstream Strategis API issue, needs escalation.

**Workaround**: Revenue data still available from S1 reports.

### 2. Timezone Mismatch in `campaign_launches`

**Issue**: `campaign_launches.first_seen_date` may be stored in PST while `campaign_index.date` is UTC.

**Impact**: Queries using UTC dates might miss some launches.

**Fix Needed**: Update `trackCampaignLaunches.ts` to use UTC dates.

### 3. "First Seen" vs "Actually Launched"

**Issue**: `first_seen_date` means "first seen in our data", not actual launch date.

**Impact**: Campaigns may be marked as "launched" when they first show activity, not when actually created.

**Mitigation**: Scripts warn about this, check for campaigns with $0 spend/0 sessions.

### 4. Missing Site Data

**Issue**: Some campaigns have `rsoc_site = NULL` or `s1_google_account = NULL`.

**Impact**: Can't map all campaigns to sites/accounts.

**Possible Causes**:
- Data not available in S1 reports
- Site mapping incomplete
- Historical campaigns missing site attribution

### 5. UNKNOWN Owner Campaigns

**Issue**: Many campaigns have `owner = 'UNKNOWN'`.

**Impact**: Can't attribute launches to buyers.

**Causes**:
- Historical campaigns (before Nov 1 baseline)
- Missing buyer data in S1 reports
- Data ingestion gaps

**Mitigation**: `fillMissingOwners.ts` script looks back at historical data.

### 6. DuckDB Schema Limitations

**Issue**: DuckDB version on server doesn't support `PRIMARY KEY` or `AUTO_INCREMENT`.

**Impact**: Schema uses simpler structure, no enforced uniqueness.

**Workaround**: Application logic handles deduplication.

---

## Future Enhancements

### High Priority

1. **Fix Timezone in `campaign_launches`**: Store UTC dates consistently
2. **Use Campaign Creation Timestamps**: If available from platform APIs, use actual launch dates
3. **Resolve Taboola 502**: Get spend data working
4. **Improve Site Mapping**: Complete rsocSite → s1GoogleAccount mapping

### Medium Priority

1. **PostgreSQL Migration**: Consider migrating to PostgreSQL for better multi-user support
2. **Real-time Alerts**: Alert on RPC drops, launch velocity changes
3. **Dashboard**: Web UI for viewing reports
4. **Historical Backfill**: Backfill all historical campaign data
5. **Data Validation**: More robust data quality checks

### Low Priority

1. **Campaign Factory Integration**: Track campaigns from creation system
2. **Automated Budget Adjustments**: Action endpoints to adjust budgets
3. **Media Asset Retrieval**: Pull images/videos by ad ID
4. **Advanced Filtering**: Query endpoints with complex filters (ROAS > 40%, etc.)

---

## Troubleshooting

### No Data Returned

**Check**:
1. Is data ingested for that date? `npm run monitor:check-dates`
2. Is timezone conversion correct? Check UTC date in output
3. Are campaigns in `campaign_index`? Query directly: `SELECT * FROM campaign_index WHERE date = '2025-11-22' LIMIT 10`

### Wrong Dates

**Check**:
1. Is timezone conversion working? Scripts should show both PST and UTC dates
2. Is data stored in UTC? Check `campaign_index.date` values
3. Is query using UTC? Check SQL queries use `utcDate` not `pstDate`

### Missing Owner/Buyer Data

**Check**:
1. Run `npm run monitor:fill-owners` to backfill from historical data
2. Check if S1 reports include buyer field: Query `campaign_index` for `buyer IS NOT NULL`
3. Verify S1 API includes buyer in dimensions: `dimensions=date-strategisCampaignId-buyer`

### API Errors (502, 503)

**Check**:
1. Is Strategis API up? `npm run monitor:test-endpoints`
2. Are credentials valid? Check `IX_ID_EMAIL`, `IX_ID_PASSWORD`
3. Is retry logic working? Check `endpoint_completeness` table for retry counts

### Inflated Launch Counts

**Check**:
1. Are campaigns deduplicated? `npm run monitor:debug-launches`
2. Is baseline set? Check `campaign_launches` for Nov 1 baseline
3. Are dates correct? Verify `first_seen_date` values make sense

---

## Environment Variables

Required on server:

```bash
export IX_ID_EMAIL="roach@interlincx.com"
export IX_ID_PASSWORD="<password>"
export STRATEGIS_API_BASE_URL="https://strategis.lincx.in"
export IX_ID_BASE_URL="https://ix-id.lincx.la"
export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb"
export STRATEGIS_ORGANIZATION="Interlincx"
export STRATEGIS_AD_SOURCE="rsoc"
```

---

## Cron Job Setup

On Hetzner server (`/opt/liftoff/backend`):

```bash
# Campaign index ingestion (hourly at :20)
20 * * * * cd /opt/liftoff/backend && MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" IX_ID_EMAIL="roach@interlincx.com" IX_ID_PASSWORD="<password>" STRATEGIS_API_BASE_URL="https://strategis.lincx.in" IX_ID_BASE_URL="https://ix-id.lincx.la" npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +\%Y-\%m-\%d) >> /opt/liftoff/logs/campaign-index.log 2>&1

# Session metrics ingestion (hourly at :25)
25 * * * * cd /opt/liftoff/backend && MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" IX_ID_EMAIL="roach@interlincx.com" IX_ID_PASSWORD="<password>" STRATEGIS_API_BASE_URL="https://strategis.lincx.in" IX_ID_BASE_URL="https://ix-id.lincx.la" npm run monitor:ingest-sessions -- --date=$(date -u +\%Y-\%m-\%d) >> /opt/liftoff/logs/session-metrics.log 2>&1

# Campaign launch tracking (hourly at :30)
30 * * * * cd /opt/liftoff/backend && MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" IX_ID_EMAIL="roach@interlincx.com" IX_ID_PASSWORD="<password>" STRATEGIS_API_BASE_URL="https://strategis.lincx.in" IX_ID_BASE_URL="https://ix-id.lincx.la" npm run monitor:track-launches -- $(date -u +\%Y-\%m-\%d) >> /opt/liftoff/logs/launch-tracking.log 2>&1
```

**Note**: Uses `date -u` to get UTC date for ingestion (matches Strategis API timezone).

---

## File Structure

```
backend/
├── src/
│   ├── lib/
│   │   ├── monitoringDb.ts          # DuckDB connection & schema
│   │   ├── strategistClient.ts       # IX ID authentication
│   │   ├── strategisApi.ts          # Strategis API client
│   │   ├── networkIds.ts            # Network ID mappings
│   │   ├── endpointMonitoring.ts    # Retry logic & data quality
│   │   └── dateUtils.ts             # Timezone utilities
│   └── scripts/
│       └── monitoring/
│           ├── ingestCampaignIndex.ts      # Campaign data ingestion
│           ├── ingestSessionMetrics.ts     # Session data ingestion
│           ├── trackCampaignLaunches.ts    # Launch detection
│           ├── reportDailyPL.ts            # P&L reporting
│           ├── queryDateLaunches.ts        # Date-based queries
│           ├── queryBuyerNetworkSiteActivity.ts  # Buyer activity
│           ├── summarizeLaunches.ts        # Launch summaries
│           ├── reportLaunchVelocity.ts     # Launch velocity
│           ├── backfillCampaignLaunches.ts # Historical backfill
│           ├── setNov1Baseline.ts          # Baseline setup
│           ├── fillMissingOwners.ts        # Owner backfill
│           └── [other utility scripts]
└── package.json

docs/
└── monitoring/
    ├── complete-system-documentation.md  # This file
    ├── timezone-handling.md              # Timezone details
    ├── campaign-launch-tracking.md       # Launch tracking docs
    ├── campaign-launch-detection-logic.md # Detection logic
    ├── data-architecture.md              # Architecture overview
    ├── session-index.md                  # Session data docs
    ├── capabilities-and-gaps.md          # Feature matrix
    └── [other docs]
```

---

## Key Learnings & Decisions

### What We Learned

1. **Strategis API Structure**: Multiple endpoints needed for complete data (S1 reports, Facebook reports, platform spend)
2. **Timezone Complexity**: UTC vs PST requires careful conversion
3. **Data Merging**: Need robust logic to merge disparate data sources
4. **Launch Detection**: "First seen" vs "actually launched" distinction matters
5. **DuckDB Limitations**: Version differences require schema adjustments

### Design Patterns Used

1. **Aggregator Pattern**: `CampaignAggregator` merges multiple data sources
2. **Retry Pattern**: Exponential backoff for transient API failures
3. **Completeness Tracking**: Record endpoint health for monitoring
4. **Baseline Pattern**: Nov 1 baseline for incremental tracking
5. **Timezone Conversion**: PST input → UTC storage/query → PST display

---

## For Future Agents/Developers

### Getting Started

1. **Read This Document**: Understand the system architecture
2. **Check Environment**: Verify environment variables are set
3. **Test Queries**: Run `npm run monitor:check-dates` to see what data exists
4. **Review Schema**: Check `monitoringDb.ts` for table structures
5. **Test API**: Run `npm run monitor:test-endpoints` to verify API access

### Common Tasks

**Add New Platform**:
1. Add networkId mapping to `networkIds.ts`
2. Add fetch method to `strategisApi.ts`
3. Add to ingestion steps in `ingestCampaignIndex.ts`
4. Test with `npm run monitor:test-endpoints`

**Add New Query**:
1. Create script in `backend/src/scripts/monitoring/`
2. Use `dateUtils.ts` for timezone conversion
3. Query `campaign_index` with UTC dates
4. Add npm script to `package.json`

**Fix Timezone Issues**:
1. Check if script uses PST or UTC dates
2. Convert PST → UTC before querying
3. Display both timezones in output
4. Test with known dates

### Debugging Checklist

- [ ] Check timezone conversion (PST → UTC)
- [ ] Verify data exists for date (`checkAvailableDates`)
- [ ] Check endpoint health (`endpoint_completeness` table)
- [ ] Verify API credentials
- [ ] Check DuckDB file permissions
- [ ] Verify DuckDB npm package installed (`npm list duckdb`)
- [ ] **DO NOT** try to use DuckDB CLI - use npm scripts only
- [ ] Review error logs
- [ ] Test individual endpoints (`testAllEndpoints`)

### Important Notes

1. **All data is UTC**: Strategis API uses UTC, store/query in UTC
2. **User input is PST**: Convert PST → UTC before querying
3. **Campaign launches**: "First seen" not "actually launched"
4. **Taboola spend**: Currently unavailable (502 errors)
5. **Nov 1 baseline**: All campaigns on Nov 1 are baseline, track incremental from Nov 2

---

## Summary

This monitoring system provides comprehensive campaign performance tracking and launch detection across all media sources. It ingests data from Strategis APIs, stores it in DuckDB, and provides query/reporting tools for analysis.

**Key Capabilities**:
- ✅ Multi-platform coverage (Facebook, Taboola, MediaGo, Outbrain, NewsBreak, etc.)
- ✅ Buyer attribution and launch tracking
- ✅ Daily P&L reporting
- ✅ Site and S1 Google Account mapping
- ✅ Hourly session metrics
- ✅ Launch velocity tracking

**Key Limitations**:
- ⚠️ Taboola spend data unavailable (502 errors)
- ⚠️ Timezone mismatch in `campaign_launches` (needs UTC fix)
- ⚠️ "First seen" not "actually launched"
- ⚠️ Some campaigns missing owner/site data

**Next Steps**:
1. Fix timezone in `campaign_launches` table
2. Resolve Taboola 502 errors
3. Consider PostgreSQL migration for scale
4. Add real-time alerts for RPC drops

---

**End of Documentation**

