# Campaign ID Extraction Requirements

## Overview

For the `strategisCampaignId` extraction to work properly in `ingestCampaignIndex.ts`, several conditions must be met. This document outlines what must be true for the extraction to succeed.

## Critical Requirements

### 1. Campaign Names Must Be Available in API Responses

**Requirement**: Facebook API responses (`/api/facebook/campaigns`, `/api/facebook/adsets`, `/api/facebook/report`) must include campaign names.

**Field Names**: The extraction looks for campaign names in these fields:
- `campaign_name`
- `name`
- `adset_name` (for adsets, as fallback)

**What Happens If Missing**: 
- If campaign names are not in the API response, extraction cannot happen
- Campaigns will use Facebook campaign IDs as primary keys
- Warning: `"Using Facebook campaign ID X as primary key because no Strategis campaign ID found"`

**How to Verify**:
```bash
# Check what fields are in the API response
npm run monitor:ingest-campaigns -- --date=2025-12-08 --level=campaign 2>&1 | grep "DEBUG:"
```

### 2. Campaign Names Must Follow the Naming Pattern

**Requirement**: Campaign names must follow the pattern: `{strategisCampaignId}_{suffix}`

**Pattern**: `campaignName.split('_')[0]` extracts the Strategis campaign ID

**Examples**:
- ✅ `sire1f06al_20241208_facebook` → extracts `sire1f06al`
- ✅ `sipuli0615_20241208_facebook` → extracts `sipuli0615`
- ❌ `Facebook Campaign 12345` → no underscore, extraction fails
- ❌ `12345_20241208_facebook` → first part is all digits (Facebook ID), extraction fails

**What Happens If Pattern Doesn't Match**:
- Extraction logic checks:
  1. Length < 15 characters
  2. Not all digits (`!/^\d+$/.test(extractedId)`)
  3. Alphanumeric pattern (`/^[a-z0-9_-]+$/i.test(extractedId)`)
- If any check fails, extraction is skipped
- Campaign will use Facebook campaign ID as primary key

### 3. Extraction Must Happen Before Aggregate Finalization

**Requirement**: The extraction logic must run in the merge methods (`mergeFacebookCampaigns`, `mergeFacebookAdsets`, `mergeFacebookReport`) **before** `toRecords()` is called.

**Current Implementation**:
- Extraction happens in:
  1. `ensureAggregate()` - tries to extract from campaign name in the row
  2. `mergeFacebookCampaigns()` - extracts after setting campaign name
  3. `mergeFacebookAdsets()` - extracts from adset name or campaign name
  4. `mergeFacebookReport()` - extracts from campaign name

**What Happens If Too Late**:
- If extraction happens after `toRecords()`, the warning is already printed
- The aggregate key is already set to Facebook campaign ID
- Database records will have Facebook IDs as `campaign_id`

### 4. Campaign Name Must Be Set Before Extraction

**Requirement**: `agg.campaignName` must be set before the extraction logic runs.

**Current Flow**:
```typescript
const campaignName = pick(row, ['campaign_name', 'name']);
this.setIfEmpty(agg, 'campaignName', campaignName);

// THEN extraction runs
if (!agg.strategisCampaignId && campaignName) {
  // Extract strategisCampaignId...
}
```

**What Happens If Not Set**:
- If `campaignName` is `null` or `undefined`, extraction is skipped
- Debug logging will show: `"DEBUG: No campaign name available for Facebook campaign ID X"`

### 5. Aggregate Key Update Must Succeed

**Requirement**: When extraction succeeds, the aggregate key must be updated from Facebook ID to Strategis ID.

**Current Logic**:
```typescript
if (agg.key !== extractedId && String(agg.key).length > 10) {
  // Move aggregate to new key (Strategis ID)
  this.aggregates.delete(agg.key);
  agg.key = extractedId;
  this.aggregates.set(extractedId, agg);
}
```

**What Happens If Update Fails**:
- If there's a conflict with an existing aggregate, merging logic handles it
- If the key update fails silently, the aggregate remains keyed by Facebook ID
- Warning will still be printed in `toRecords()`

## Data Flow Requirements

### Facebook Campaigns API (`/api/facebook/campaigns`)

**Must Return**:
- `campaign_name` or `name` field with format: `{strategisCampaignId}_{date}_{network}`
- `id` or `campaign_id` field with Facebook campaign ID

**Example Response**:
```json
{
  "id": "23853138382980292",
  "name": "sire1f06al_20241208_facebook",
  "status": "ACTIVE"
}
```

### Facebook Adsets API (`/api/facebook/adsets`)

**Must Return**:
- `campaign_name` or `name` field (campaign name)
- `adset_name` or `adSetName` field (adset name, may contain Strategis ID)
- `campaign_id` field with Facebook campaign ID

**Example Response**:
```json
{
  "campaign_id": "23853138382980292",
  "campaign_name": "sire1f06al_20241208_facebook",
  "adset_name": "sire1f06al_audience1_placement1",
  "id": "123456789"
}
```

### Facebook Report API (`/api/facebook/report`)

**Must Return**:
- `campaign_name` or `name` field with format: `{strategisCampaignId}_{date}_{network}`
- `campaign_id` or `campaignId` field with Facebook campaign ID (when `dimensions='campaignId'`)

## Troubleshooting Checklist

If extraction is not working, check:

1. ✅ **Are campaign names in the API response?**
   - Check debug output: `"DEBUG: No campaign name available"`
   - Verify API response includes `campaign_name` or `name` field

2. ✅ **Do campaign names follow the pattern?**
   - Check debug output: `"DEBUG: Could not extract Strategis ID from campaign name"`
   - Verify names have format: `{strategisCampaignId}_{suffix}`
   - Verify first part is alphanumeric, not all digits

3. ✅ **Is extraction running?**
   - Check that `mergeFacebookCampaigns`, `mergeFacebookAdsets`, or `mergeFacebookReport` is being called
   - Verify extraction logic is executing (check debug output)

4. ✅ **Is the aggregate key being updated?**
   - Check that `agg.key` changes from Facebook ID to Strategis ID
   - Verify no conflicts with existing aggregates

5. ✅ **Is `strategisCampaignId` being set?**
   - Check that `agg.strategisCampaignId` is set after extraction
   - Verify it's not being overwritten later

## Expected Behavior When Working

When extraction works correctly:

1. **No warnings**: `"Using Facebook campaign ID as primary key"` warnings should not appear
2. **Strategis IDs in database**: `campaign_index.campaign_id` should contain Strategis IDs (e.g., `sire1f06al`)
3. **Facebook IDs stored separately**: `campaign_index.facebook_campaign_id` should contain Facebook IDs
4. **Queryable by Strategis ID**: Queries like `WHERE campaign_id = 'sire1f06al'` should work

## Common Issues

### Issue: Campaign names not in API response

**Symptom**: Debug shows `"No campaign name available"`

**Solution**: 
- Verify Facebook API endpoints return campaign names
- Check API response structure
- May need to use a different API endpoint or add campaign name to response

### Issue: Campaign names don't follow pattern

**Symptom**: Debug shows extraction failed with specific reason

**Solution**:
- Verify campaign naming convention matches `{strategisCampaignId}_{suffix}`
- May need to adjust extraction pattern if naming convention is different
- Check if campaigns are created with correct naming format

### Issue: Extraction runs but key doesn't update

**Symptom**: Extraction succeeds but warnings still appear

**Solution**:
- Check for conflicts with existing aggregates
- Verify aggregate key update logic is working
- May need to merge aggregates differently

## Related Files

- `backend/src/scripts/monitoring/ingestCampaignIndex.ts` - Extraction implementation
- `backend/docs/monitoring/campaign-id-mapping.md` - Overall mapping documentation
- `backend/src/lib/strategisApi.ts` - API client that fetches campaign data

