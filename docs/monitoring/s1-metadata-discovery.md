# S1 Daily Report Metadata Discovery

## Key Finding
**S1 Daily Report (`/api/s1/report/daily-v3`) already includes campaign metadata!**

According to Tahmid (Oct 24, 2025), the S1 daily report response includes these fields:

```typescript
{
  strategisCampaignId: string,
  campaignId: string,
  date: string,
  impressions: string,
  clicks: string,
  searches: string,
  estimated_revenue: string,  // This is Revenue
  networkId: string,          // Platform identifier!
  buyer: string,              // Owner/buyer!
  networkAccountId: string,
  adAccountId: string,
  organization: string,
  category: string,           // Business category!
  networkCampaignName: string,
  networkCampaignId: string,
  rsocSite: string,
  budget: string,
  status: string,
  bidStrategy: string
}
```

## Impact

### ✅ What This Means
1. **We can get owner (buyer) and category directly from S1 daily** - no need for separate campaign metadata API!
2. **We can identify platform via `networkId`** - networkId=112 is Facebook, others map to Taboola/Outbrain/etc.
3. **We're already calling this endpoint** - we just weren't extracting these fields!

### 🔧 Changes Made
1. Updated `mergeS1Daily()` to extract `buyer` → `owner`, `category`, `networkAccountId`, `networkCampaignName`
2. Added `networkId` → platform mapping (starting with 112=facebook)
3. Updated `fetchS1Daily()` and `fetchS1Hourly()` to optionally query **all networks** (not just Facebook)
4. Updated ingestion scripts to query all networks by default

## Next Steps

### 1. Test the Changes
Run the ingestion script and verify:
- Owner/buyer data is now populated
- Category data is populated  
- Media source is correctly identified from networkId
- We're getting campaigns from all platforms (not just Facebook)

### 2. Discover NetworkId Mappings
We need to identify networkId values for:
- Taboola: ?
- Outbrain: ?
- NewsBreak: ?
- MediaGo: ?
- GoogleAds: ?
- Zemanta: ?
- SmartNews: ?

**How to discover**: After running ingestion with `includeAllNetworks=true`, check the `networkId` values in the raw S1 daily data and map them to platforms.

### 3. Still Missing: Spend Data
S1 daily includes revenue but **not spend**. We still need to query platform-specific endpoints for spend:
- Facebook: `/api/facebook/report` ✅ (already doing this)
- Taboola: Need to find endpoint
- Outbrain: Need to find endpoint
- NewsBreak: Need to find endpoint
- MediaGo: Need to find endpoint

### 4. Still Missing: Lane
S1 daily includes `buyer` (owner) and `category`, but **not `lane`**. We may need to:
- Query Facebook endpoints for lane (if available)
- Or maintain a manual mapping table
- Or check if lane is in campaign properties

## Updated Data Flow

```
1. S1 Daily (all networks) → Extract: buyer, category, networkId, revenue, sessions
2. Map networkId → media_source (facebook, taboola, etc.)
3. Facebook Report → Extract: spend, lane (if available)
4. Merge all sources → campaign_index table
```

## Questions for Devin/Tahmid

1. What are the networkId values for each platform? (Taboola, Outbrain, NewsBreak, MediaGo, etc.)
2. Does S1 daily include `lane` field, or is that only in Facebook reports?
3. What endpoints return spend data for non-Facebook platforms?
4. Should we query S1 daily without `networkId` filter to get all platforms, or query multiple times with specific networkIds?

