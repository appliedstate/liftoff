# Campaign Launch Velocity Tracking

This system tracks campaign launches by detecting new campaigns that appear in the `campaign_index` table and recording when they were first seen, along with buyer/owner information.

## Overview

After the Friday pause and relaunch, we need to track:
- How many new campaigns each buyer has launched in the last 2 days
- Daily launch velocity by buyer
- Launch velocity relative to campaign factory output

## Database Schema

### `campaign_launches` Table

Tracks when campaigns were first detected:

```sql
CREATE TABLE campaign_launches (
  campaign_id TEXT NOT NULL PRIMARY KEY,
  first_seen_date DATE NOT NULL,
  owner TEXT,
  lane TEXT,
  category TEXT,
  media_source TEXT,
  campaign_name TEXT,
  account_id TEXT,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

## Scripts

### 1. `trackCampaignLaunches.ts`

Detects new campaigns by comparing current `campaign_index` entries with the `campaign_launches` table.

**Usage:**
```bash
# Track launches for today
npm run monitor:track-launches

# Track launches for a specific date
npm run monitor:track-launches -- 2025-11-23
```

**What it does:**
1. Queries `campaign_index` for the specified date
2. Compares with existing `campaign_launches` records
3. Identifies new campaigns (not seen before)
4. Records new campaigns with their first_seen_date and buyer info
5. Prints summary by owner and media source

**Output:**
```
[trackCampaignLaunches] Tracking new campaigns for 2025-11-23...

[trackCampaignLaunches] Found 128 campaigns in campaign_index for 2025-11-23
[trackCampaignLaunches] Found 500 campaigns already tracked
[trackCampaignLaunches] Detected 15 new campaigns

New Campaigns by Owner:
  ben: 8
  tj: 4
  dan: 2
  mike: 1

New Campaigns by Media Source:
  mediago: 10
  facebook: 3
  taboola: 2
```

### 2. `reportLaunchVelocity.ts`

Reports launch velocity by buyer/owner over a specified number of days.

**Usage:**
```bash
# Report for last 7 days (default)
npm run monitor:launch-velocity

# Report for last 14 days
npm run monitor:launch-velocity -- 14

# Report for last 2 days
npm run monitor:launch-velocity -- 2
```

**Output includes:**
- Summary by buyer (total launches, first/last launch dates, avg/day)
- Daily breakdown showing launches per buyer per day
- Last 2 days summary (as requested)
- Launches by media source

**Example output:**
```markdown
# Campaign Launch Velocity Report (Last 7 Days)

## Summary by Buyer/Owner

| Owner | Total Launches | First Launch | Last Launch | Avg/Day |
|-------|----------------|--------------|-------------|---------|
| ben   | 45            | 2025-11-17  | 2025-11-23 | 6.4     |
| tj    | 32            | 2025-11-18  | 2025-11-23 | 4.6     |
| dan   | 18            | 2025-11-19  | 2025-11-23 | 2.6     |

## Daily Launch Breakdown

| Date       | ben | tj  | dan | Total |
|------------|-----|-----|-----|-------|
| 2025-11-23 | 8   | 4   | 2   | 14    |
| 2025-11-22 | 12  | 6   | 3   | 21    |
| 2025-11-21 | 5   | 3   | 1   | 9     |

## Last 2 Days Summary

| Owner | Launches (Last 2 Days) |
|-------|------------------------|
| ben   | 20                    |
| tj    | 10                    |
| dan   | 5                     |
```

## Cron Job Setup

### On Hetzner Server

The tracking script should run **after** `ingestCampaignIndex` completes, so it can detect new campaigns from the latest data.

**Recommended schedule:**
- Run `trackCampaignLaunches` at **:25 past each hour** (5 minutes after campaign ingestion at :20)

**Add to crontab:**

```bash
# SSH into server
ssh root@5.78.105.235

# Edit crontab
crontab -e

# Add these lines (adjust paths as needed):
25 * * * * cd /opt/liftoff/backend && export IX_ID_EMAIL="roach@interlincx.com" && export IX_ID_PASSWORD="your-password" && export STRATEGIS_API_BASE_URL="https://strategis.lincx.in" && export IX_ID_BASE_URL="https://ix-id.lincx.la" && export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" && /usr/bin/npm run monitor:track-launches >> /opt/liftoff/logs/track-launches.log 2>&1
```

**Or use a wrapper script** (`/opt/liftoff/scripts/track-launches.sh`):

```bash
#!/bin/bash
cd /opt/liftoff/backend
export IX_ID_EMAIL="roach@interlincx.com"
export IX_ID_PASSWORD="your-password"
export STRATEGIS_API_BASE_URL="https://strategis.lincx.in"
export IX_ID_BASE_URL="https://ix-id.lincx.la"
export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb"

/usr/bin/npm run monitor:track-launches >> /opt/liftoff/logs/track-launches.log 2>&1
```

Then in crontab:
```
25 * * * * /opt/liftoff/scripts/track-launches.sh
```

## Workflow

1. **Hourly (at :20):** `ingestCampaignIndex` runs, populating `campaign_index` with latest campaigns
2. **Hourly (at :25):** `trackCampaignLaunches` runs, detecting new campaigns and recording them
3. **On-demand:** `reportLaunchVelocity` can be run anytime to see launch velocity

## Initial Setup

To backfill historical data, run `trackCampaignLaunches` for past dates:

```bash
# Backfill last 7 days
for i in {0..6}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  npm run monitor:track-launches -- $date
done
```

## Querying Launch Data Directly

You can also query the `campaign_launches` table directly:

```sql
-- Launches in last 2 days by owner
SELECT 
  owner,
  COUNT(*) as launches
FROM campaign_launches
WHERE first_seen_date >= DATE('now', '-2 days')
GROUP BY owner
ORDER BY launches DESC;

-- Daily launch velocity
SELECT 
  first_seen_date,
  owner,
  COUNT(*) as launches
FROM campaign_launches
WHERE first_seen_date >= DATE('now', '-7 days')
GROUP BY first_seen_date, owner
ORDER BY first_seen_date DESC, launches DESC;
```

## Notes

- Campaigns are tracked by `campaign_id` (primary key)
- Once a campaign is recorded, it won't be re-recorded even if it appears on later dates
- The `first_seen_date` represents when the campaign was first detected in our system
- Buyer/owner information comes from the `campaign_index` table (populated from S1 reports)

