# Campaign Launch Detection Logic

## How We Determine "Launched Today"

Currently, we detect campaign launches using a **first-seen** approach:

### Current Logic

1. **Data Ingestion** (`ingestCampaignIndex`):
   - Pulls campaign data from Strategis APIs for a specific date
   - Sources include: S1 daily/reconciled reports, Facebook reports, platform spend reports (Taboola, Outbrain, MediaGo, etc.)
   - Stores campaigns in `campaign_index` table with a `date` field

2. **Launch Detection** (`trackCampaignLaunches`):
   - Queries `campaign_index` for campaigns that appear on a given date
   - Compares with `campaign_launches` table (campaigns we've seen before)
   - If a `campaign_id` appears in `campaign_index` for date X but doesn't exist in `campaign_launches`, it's marked as "new"
   - Records it with `first_seen_date = date X`

### What This Actually Means

A campaign appearing in `campaign_index` for a date means:
- **The campaign had activity** (spend, revenue, clicks, impressions) on that date
- **OR** the campaign existed in the platform's system on that date (from Facebook campaigns/adsets metadata)

### Limitations

**"Launched today" is actually "first seen in our data today"**, which could mean:

1. ✅ **Actually launched today** - Campaign was created and started running today
2. ⚠️ **Launched earlier, first activity today** - Campaign was created days/weeks ago but had its first spend/activity today
3. ⚠️ **Launched earlier, first time in our data** - Campaign existed but this is the first time our ingestion picked it up (e.g., due to data delays, API issues, or new data sources)

### Data Sources and Their Meaning

| Source | What It Indicates |
|--------|-------------------|
| **S1 Daily/Reconciled** | Campaign had revenue/clicks/searches on this date |
| **Facebook Reports** | Campaign had spend/impressions/clicks on this date |
| **Facebook Campaigns/Adsets** | Campaign exists in Facebook's system (metadata) |
| **Platform Spend Reports** | Campaign had spend on this platform on this date |

### Example Scenarios

**Scenario 1: True Launch**
- Campaign created in Facebook on Nov 23
- Starts spending immediately
- Appears in `campaign_index` for Nov 23
- Detected as "launched Nov 23" ✅

**Scenario 2: Delayed Activity**
- Campaign created in Facebook on Nov 20
- No spend until Nov 23
- Appears in `campaign_index` for Nov 23 (first time with activity)
- Detected as "launched Nov 23" (but actually launched Nov 20) ⚠️

**Scenario 3: Data Delay**
- Campaign created Nov 22
- Had activity Nov 22
- But S1 data delayed, appears in Nov 23 ingestion
- Detected as "launched Nov 23" (but actually launched Nov 22) ⚠️

## Potential Improvements

### Option 1: Use Campaign Creation Date (More Accurate)

If available from platform APIs:
- Facebook: `created_time` field from campaigns/adsets endpoints
- Other platforms: Similar creation timestamp fields
- Use actual creation date instead of first-seen date

**Pros:** More accurate launch dates
**Cons:** Requires API access to creation timestamps, may not be available for all platforms

### Option 2: Use Earliest Activity Date

Track the earliest date a campaign had any activity:
- First spend date
- First impression date
- First click date

**Pros:** More accurate than "first seen in our data"
**Cons:** Still not the true launch date, just earliest activity

### Option 3: Hybrid Approach

- If creation date available → use creation date
- Else → use first activity date
- Fallback → use first-seen date

### Option 4: Campaign Factory Integration

If campaigns come from a "campaign factory" system:
- Track when campaigns are created in the factory
- Use factory creation timestamp as launch date
- More accurate than inferring from activity data

## Current Recommendation

For now, the **first-seen approach is reasonable** because:
1. It's simple and works with current data sources
2. For active campaigns, first activity usually happens close to launch
3. It provides a good proxy for launch velocity

**However**, you should be aware that:
- Some "launches" may actually be campaigns that launched earlier but had delayed activity
- Launch velocity numbers may be slightly inflated if campaigns are paused and restarted (they'll appear as "new" again if they drop out of `campaign_index`)

## Questions to Consider

1. **Do you have access to campaign creation timestamps** from Facebook/other platforms?
2. **Is there a campaign factory system** that tracks when campaigns are created?
3. **How important is precision** vs. having a quick proxy for launch velocity?
4. **Should paused/restarted campaigns** be counted as new launches?

## Next Steps

If you want more accurate launch detection, we can:
1. Check if Facebook campaigns/adsets endpoints return `created_time`
2. Modify `trackCampaignLaunches` to use creation dates when available
3. Add fallback logic for platforms without creation dates
4. Track both "first seen" and "first activity" dates for comparison

