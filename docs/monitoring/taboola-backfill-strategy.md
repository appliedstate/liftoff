# Taboola Backfill Strategy

## Overview
Once the Taboola endpoint is fixed, we need to backfill missing spend data for dates when the endpoint was failing.

## Current Status
- **Taboola endpoint**: `/api/taboola/report` returning 502 Bad Gateway
- **Impact**: Missing Taboola spend data (revenue still captured via S1)
- **Completeness tracking**: `endpoint_completeness` table tracks which dates failed

## Backfill Approach

### 1. Identify Missing Dates

Query `endpoint_completeness` to find dates with Taboola failures:

```sql
SELECT DISTINCT date
FROM endpoint_completeness
WHERE endpoint = 'taboola_report'
  AND status = 'FAILED'
ORDER BY date DESC;
```

### 2. Backfill Script

Create a backfill script that:
- Takes a date range as input
- Re-runs Taboola ingestion for those dates
- Updates `campaign_index` with spend data
- Records success in `endpoint_completeness`

**Example usage:**
```bash
npm run monitor:backfill-taboola -- --start-date=2025-11-20 --end-date=2025-11-23
```

### 3. Idempotency

The ingestion pipeline is already idempotent:
- `campaign_index` uses DELETE + INSERT pattern per (campaign_id, date, level, snapshot_source)
- Re-running for the same date will overwrite existing data safely
- No risk of double-counting

### 4. Validation

After backfill, verify:
- Row counts match expected values
- Spend data is non-zero for dates with Taboola traffic
- `endpoint_completeness` shows status='OK' for backfilled dates

## Implementation

### Option 1: Manual Backfill Script
Create a dedicated script that:
1. Queries `endpoint_completeness` for failed Taboola dates
2. Calls `ingestCampaignIndex` for each date
3. Verifies success

### Option 2: Extend Existing Script
Add `--backfill` flag to `ingestCampaignIndex.ts`:
- If `--backfill` is set, only fetch Taboola endpoint
- Skip other endpoints to speed up backfill
- Still update `campaign_index` with Taboola spend

### Option 3: Automated Backfill Job
Add a cron job that runs daily:
- Checks `endpoint_completeness` for recent failures
- Automatically backfills dates from T-7 days
- Sends alerts if backfill fails

## Recommended Approach

**Start with Option 1** (manual script) for immediate needs, then **add Option 3** (automated) for ongoing resilience.

## Testing

Before running full backfill:
1. Test with a single known-good date
2. Verify spend data appears in `campaign_index`
3. Check ROAS calculations are correct
4. Then run full date range

## Rollback Plan

If backfill causes issues:
- Data is stored by date, so can delete specific dates
- Re-run ingestion for affected dates
- `campaign_index_runs` table tracks all ingestion attempts

