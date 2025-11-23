# Strategis API Endpoints Summary

## Total API Calls: 15 Endpoints

### Critical Endpoints (Required - Fail Fast)
These provide revenue and core metadata. If these fail, ingestion stops.

1. **S1 Daily V3** (`/api/s1/report/daily-v3`)
   - Purpose: Revenue, sessions, buyer, category, networkId, rsocSite
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `timezone`, `dbSource=ch`, `dimensions=date-strategisCampaignId-buyer`
   - Fetches: All networks (no networkId filter)

2. **S1 Reconciled** (`/api/s1/high-level-report`)
   - Purpose: Reconciled revenue with buyer field directly
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `timezone`, `dbSource=ch`, `dimensions=date-strategisCampaignId`
   - Fetches: All networks (no networkId filter)

### Important Endpoints (Non-Critical - Continue on Failure)
These provide additional metadata and spend data. Failures are logged but don't stop ingestion.

3. **S1 RPC Average** (`/api/s1/rpc-average`)
   - Purpose: 3-day RPC averages
   - Parameters: `date`, `days=3`, `organization`, `adSource`, `networkId`, `timezone`, `dimensions=strategisCampaignId`

4. **Facebook Report** (`/api/facebook/report`)
   - Purpose: Facebook spend, clicks, conversions
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `networkName=facebook`, `level=campaign`, `dimensions=campaignId`, `cached=1`, `dbSource=ch`

5. **Facebook Campaigns** (`/api/facebook/campaigns`)
   - Purpose: Campaign metadata (budget, status)
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `dbSource=ch`

6. **Facebook Adsets** (`/api/facebook/adsets/day`)
   - Purpose: Adset spend and metadata
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `dbSource=ch`

7. **Facebook Pixel** (`/api/facebook-pixel-report`)
   - Purpose: Pixel conversion data
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `networkName=facebook`, `dimensions=date-strategisCampaignId`, `timezone`

8. **Strategis Metrics (FB)** (`/api/strategis-report`)
   - Purpose: Strategis impressions, clicks
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `networkName=facebook`, `dbSource=ch`, `timezone`, `dimensions=date-strategisCampaignId`

### Platform Spend Endpoints (Optional - Continue on Failure)
These provide spend data for ROAS calculation. Failures are logged but don't stop ingestion.

9. **Taboola Report** (`/api/taboola/report`)
   - Purpose: Taboola spend, clicks, conversions
   - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `dimension=date-strategisCampaignId` (note: singular "dimension")
   - Status: ⚠️ Currently returning 502 Bad Gateway

10. **Outbrain Hourly** (`/api/outbrain-hourly-report`)
    - Purpose: Outbrain spend data
    - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `ignoreHours`

11. **NewsBreak Report** (`/api/newsbreak/report`)
    - Purpose: NewsBreak spend data
    - Parameters: `dateStart`, `dateEnd`, `organization`, `dimensions=date-strategisCampaignId`

12. **MediaGo Report** (`/api/mediago/report`)
    - Purpose: MediaGo spend data
    - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `timezone`, `dimensions=date-strategisCampaignId`

13. **Zemanta Reconciled** (`/api/zemanta/reconciled-report`)
    - Purpose: Zemanta spend data
    - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `dimensions=date-strategisCampaignId`, `dbSource=level`

14. **SmartNews Report** (`/api/smartnews/report`)
    - Purpose: SmartNews spend data
    - Parameters: `dateStart`, `dateEnd`, `organization`, `dimensions=date-strategisCampaignId`

15. **GoogleAds Report** (`/api/googleads/report`)
    - Purpose: GoogleAds spend data
    - Parameters: `dateStart`, `dateEnd`, `organization`, `adSource`, `timezone`, `dimensions=date-strategisCampaignId`

## Diagnosing Failures

### Run Endpoint Test Script

On the server, run:

```bash
cd /opt/liftoff/backend
IX_ID_EMAIL="roach@interlincx.com" \
IX_ID_PASSWORD="pitdyd-vazsi1-Jinrow" \
STRATEGIS_API_BASE_URL="https://strategis.lincx.in" \
STRATEGIS_ALLOW_SELF_SIGNED=1 \
STRATEGIS_ORGANIZATION="Interlincx" \
STRATEGIS_AD_SOURCE="rsoc" \
STRATEGIS_NETWORK_ID="112" \
STRATEGIS_TIMEZONE="UTC" \
npm run monitor:test-endpoints -- 2025-11-23
```

This will test all 15 endpoints and show which ones are working/failing.

## Common Error Types & Fixes

### 502 Bad Gateway
- **Cause**: Strategis API server is down or overloaded
- **Fix**: 
  - Wait and retry (transient issue)
  - Check Strategis API status
  - These endpoints are optional, so ingestion continues

### 401 Unauthorized
- **Cause**: JWT token expired or invalid
- **Fix**: 
  - Token auto-refreshes, but if persistent, check `IX_ID_EMAIL` and `IX_ID_PASSWORD` env vars
  - Verify JWT is being issued correctly

### 404 Not Found
- **Cause**: Wrong endpoint URL or parameter name
- **Fix**: 
  - Verify endpoint path matches Strategis API docs
  - Check parameter names (e.g., `dimension` vs `dimensions`)

### Empty Results (0 rows)
- **Cause**: No data for that date/platform
- **Fix**: 
  - Normal if no campaigns ran that day
  - Check if date is too recent (data may not be available yet)

## Current Status

Based on server logs:
- ✅ **S1 Daily**: Working (provides revenue + metadata for all platforms)
- ✅ **S1 Reconciled**: Working (provides buyer/lane)
- ✅ **Facebook endpoints**: Working
- ❌ **Taboola**: 502 Bad Gateway (optional - ingestion continues)
- ⚠️ **Other platforms**: Unknown (need to test)

## Next Steps

1. **Run test script** on server to see which endpoints are failing
2. **Check Strategis API status** - 502 errors suggest server-side issues
3. **Verify parameter names** - Some endpoints use `dimension` (singular), others use `dimensions` (plural)
4. **Contact Devin** if endpoints are consistently failing - may need to adjust endpoint URLs or parameters

## Resilience & Monitoring (Devin's Recommendations Implemented)

The ingestion pipeline now includes:

### 1. Retry Logic
- **Automatic retries** with exponential backoff for transient failures (502, 503, 504, 408)
- **3 retries** for critical endpoints, **2 retries** for optional endpoints
- Prevents false failures from temporary API outages

### 2. Data Quality Checks
- **Row count validation**: Warns if row count is <50% of 7-day average
- **Required field checks**: Validates campaign IDs are present
- **Financial indicators**: Tracks whether endpoints return revenue/spend data

### 3. Completeness Tracking
- **`endpoint_completeness` table**: Tracks status (OK/PARTIAL/FAILED) per endpoint/date/platform
- **Retry counts**: Records how many retries were attempted
- **Error messages**: Stores detailed error information for debugging
- **Expected vs actual**: Compares row counts to historical averages

### 4. Alerting Strategy
- **Critical failures**: Fail entire pipeline (S1 daily/reconciled)
- **Platform-critical**: Log warnings, continue pipeline (Facebook, major spend sources)
- **Optional**: Log warnings, continue pipeline (small platforms)

### 5. Partial Data Signaling
- Completeness table allows downstream systems to detect incomplete data
- Can query `endpoint_completeness` to see which platforms have missing spend data
- Enables accurate ROI reporting by flagging incomplete cost data

The ingestion pipeline is designed to be resilient:
- **Critical endpoints** (S1 daily/reconciled) fail fast - ensures we always have revenue data
- **Optional endpoints** (platform spend) log warnings but continue - ensures we get partial data even if some platforms are down
- **Revenue data** is always captured (from S1) even if spend data fails
- **Completeness tracking** enables backfill and data quality monitoring

