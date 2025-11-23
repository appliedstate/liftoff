# Taboola Data Coverage Analysis

## Summary

**Yes, we still get Taboola data from other endpoints!** We're only missing Taboola **spend** data.

## What We're Getting for Taboola

### ✅ From S1 Daily V3 (`/api/s1/report/daily-v3`)
- **Revenue** (`estimated_revenue`)
- **Sessions** (`searches`)
- **Clicks**
- **Conversions**
- **Campaign metadata**:
  - `strategisCampaignId`
  - `networkCampaignName`
  - `networkAccountId`
  - `buyer` (owner/lane)
  - `category`
  - `networkId` = `107` (maps to `taboola`)
  - `rsocSite`
- **Status**: ✅ Working (140 rows for 2025-11-23)

### ✅ From S1 Reconciled (`/api/s1/high-level-report`)
- **Reconciled revenue** (`estimated_revenue`)
- **Sessions** (`searches`)
- **Clicks**
- **Buyer** (owner/lane) - directly included
- **Category**
- **Status**: ✅ Working (0 rows for 2025-11-23, but endpoint works)

### ✅ From S1 RPC Average (`/api/s1/rpc-average`)
- **3-day RPC averages**
- **Status**: ✅ Working (339 rows for 2025-11-23)

### ✅ From Session Hourly Metrics (`/api/s1/report/hourly-v3`)
- **Hourly session/revenue breakdown**
- **RPC by click hour**
- **Status**: ✅ Working (fetches all platforms including Taboola)

## What We're Missing

### ❌ Taboola Spend Data (`/api/taboola/report`)
- **Spend** (`spent`, `spend_usd`)
- **Budget** data
- **Status**: ❌ HTTP 502 Bad Gateway (all parameter variations fail)

## Impact

### What Works
- ✅ **Revenue tracking**: We have Taboola revenue from S1
- ✅ **Session tracking**: We have Taboola sessions from S1
- ✅ **Campaign metadata**: Owner, category, media_source all populated
- ✅ **ROAS calculation**: Can calculate RPC (Revenue Per Click)
- ✅ **Campaign identification**: Can identify Taboola campaigns via `networkId=107`

### What's Broken
- ❌ **ROAS calculation**: Cannot calculate ROAS (Return On Ad Spend) without spend
- ❌ **Spend tracking**: Missing Taboola spend data
- ❌ **Budget monitoring**: Cannot track budget vs spend

## Data Flow

```
Taboola Campaigns:
├── Revenue/Sessions/Clicks → S1 Daily V3 ✅
├── Reconciled Revenue → S1 Reconciled ✅
├── RPC Averages → S1 RPC Average ✅
├── Hourly Metrics → S1 Hourly V3 ✅
└── Spend → Taboola Report ❌ (502 Bad Gateway)
```

## Database Status

### `campaign_index` Table
- **Taboola campaigns**: ✅ Present (from S1 Daily)
- **Revenue**: ✅ Populated
- **Sessions**: ✅ Populated
- **Clicks**: ✅ Populated
- **Owner/Lane**: ✅ Populated (from `buyer` field)
- **Category**: ✅ Populated
- **Media Source**: ✅ Set to `taboola` (from `networkId=107`)
- **Spend**: ❌ NULL (missing from Taboola endpoint)

### `session_hourly_metrics` Table
- **Taboola sessions**: ✅ Present (from S1 Hourly)
- **Revenue by hour**: ✅ Present
- **RPC by hour**: ✅ Calculated

## Verification Query

To verify Taboola data in the database:

```sql
-- Check Taboola campaigns in campaign_index
SELECT 
  campaign_id,
  campaign_name,
  owner,
  category,
  media_source,
  revenue_usd,
  sessions,
  clicks,
  spend_usd,  -- This will be NULL
  CASE 
    WHEN spend_usd > 0 THEN revenue_usd / spend_usd 
    ELSE NULL 
  END as roas
FROM campaign_index
WHERE media_source = 'taboola'
  AND date = '2025-11-23'
ORDER BY revenue_usd DESC;
```

## Conclusion

**We have comprehensive Taboola data except for spend.** The pipeline is working correctly:
- Revenue, sessions, clicks, and metadata are all captured
- Only spend data is missing due to the Taboola endpoint 502 error
- Once the endpoint is fixed, we can backfill missing spend data

## Next Steps

1. **Monitor Taboola campaigns**: Can still track performance via revenue/sessions
2. **Escalate Taboola endpoint**: Fix the 502 error to restore spend data
3. **Backfill spend**: Once fixed, backfill missing spend for affected dates
4. **ROAS calculation**: Will be accurate once spend data is restored

