# Questions for Devin: Taboola 502 Bad Gateway

## Issue
The Taboola endpoint `/api/taboola/report` is consistently returning **502 Bad Gateway** errors.

**Test Request:**
```
GET https://strategis.lincx.in/api/taboola/report
Parameters:
  dateStart: 2025-11-23
  dateEnd: 2025-11-23
  organization: Interlincx
  adSource: rsoc
  dimension: date-strategisCampaignId
```

**Error Response:**
- HTTP 502: Bad Gateway
- Error occurs consistently (not intermittent)
- Other platform endpoints (Outbrain, MediaGo, NewsBreak, etc.) work fine

## Questions for Devin

### 1. Is the Taboola endpoint operational?
- Is `/api/taboola/report` currently working for other organizations/dates?
- Are there any known outages or maintenance windows?
- Should we be using a different endpoint for Taboola spend data?

### 2. Parameter validation
- Is `dimension` (singular) the correct parameter name? Other endpoints use `dimensions` (plural)
- Are all required parameters present? (dateStart, dateEnd, organization, adSource, dimension)
- Is there a specific date format or timezone requirement?

### 3. Authentication/Authorization
- Is our JWT token valid for Taboola endpoints?
- Are there any IP allowlisting or VPN requirements for Taboola?
- Does Taboola require different authentication than other platforms?

### 4. Backend/Infrastructure
- Is the Taboola upstream API (from Strategis → Taboola) down or rate-limited?
- Are there any Strategis API logs showing errors around Taboola requests?
- Is this a load balancer/nginx issue or an application-level issue?

### 5. Alternative endpoints
- Is there an alternative endpoint we should use? (e.g., `/api/taboola/daily` or `/api/taboola/reconciled-report`)
- Can we get Taboola spend data from S1 reports instead?
- Should we use a different `dbSource` parameter? (currently not specified, defaults to ClickHouse)

### 6. Data availability
- Is Taboola spend data available for 2025-11-23?
- Are there any date restrictions (e.g., data only available T+1 or T+2)?
- Should we query a different date range to test?

## Current Implementation

**Code Location:** `backend/src/lib/strategisApi.ts:169-178`

```typescript
async fetchTaboolaReport(date: string): Promise<any[]> {
  const params = {
    ...this.singleDayRange(date),
    organization: this.organization,
    adSource: this.adSource,
    dimension: 'date-strategisCampaignId', // Note: singular "dimension"
  };
  const payload = await this.client.get('/api/taboola/report', params);
  return extractRows(payload);
}
```

**Retry Logic:** Currently configured with 2 retries (optional endpoint), but 502 persists across retries.

## Impact

- **Pipeline Status**: ✅ Ingestion continues (Taboola is optional)
- **Data Completeness**: ⚠️ Taboola spend data missing (revenue still captured via S1)
- **ROAS Calculation**: ⚠️ Incomplete for Taboola campaigns (missing spend, have revenue)

## Devin's Answers & Analysis

### Most Likely Root Cause
Based on Devin's investigation, the 502 is most likely caused by:
1. **Taboola upstream API issue** (down, rate-limited, or timing out)
2. **Strategis application error** specific to Taboola endpoint
3. **Database query timeout** when fetching Taboola data

### Key Insights
- **Parameter mismatch unlikely**: 502 indicates gateway/application failure, not parameter validation (which would return 400/422)
- **Authentication likely fine**: Other endpoints work with same JWT token
- **Not a data availability issue**: 502 suggests processing failure, not missing data (which would return 200 with empty array)

### Recommended Actions (Priority Order)

1. **Check Strategis logs** (HIGHEST PRIORITY)
   - Look for errors around time of 502 requests
   - Will reveal if it's upstream Taboola or internal Strategis issue

2. **Test with historical date** (7-14 days ago)
   ```bash
   npm run monitor:test-taboola -- 2025-11-16
   ```

3. **Test without adSource parameter**
   - Remove `adSource: 'rsoc'` to see if it's RSOC-specific

4. **Test parameter variations**
   - Try `dimensions` (plural) instead of `dimension` (singular)
   - Try with `dbSource: 'ch'` or `dbSource: 'level'`
   - Try minimal parameters (date + org only)

5. **Contact Strategis/Taboola support**
   - If logs show upstream 502 → escalate to Taboola
   - If logs show internal error → escalate to Strategis team

### Test Script Available
Run `npm run monitor:test-taboola -- <date>` to test all parameter variations automatically.

## Next Steps

1. **Immediate**: Run test script with historical date to rule out data availability
2. **Short-term**: Check Strategis logs for detailed error messages
3. **If parameter fix works**: Update `ingestCampaignIndex.ts` with working combination
4. **Long-term**: Implement backfill once endpoint is fixed

