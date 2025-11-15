# Strategis Campaign Setup — Complete Requirements & Field Mapping

## Document Purpose
This document specifies what Strategis needs to build and what data Liftoff will provide for campaign setup, including naming conventions, field mappings, and indexing requirements.

**Status**: 🔴 SPECIFICATION — For Strategis Engineering  
**Owner**: Strategis Engineering (with Liftoff collaboration)  
**Version**: 1.0 (2025-01-XX)

---

## Overview

Liftoff needs to:
1. **Set up tracking/templates in Strategis** (naming conventions, tracking configuration)
2. **Create Facebook campaigns via Strategis relay** (campaigns, ad sets, ads, creatives)
3. **Create Strategis tracking campaigns** (link to Facebook campaigns for performance tracking)

Strategis needs to:
1. **Index and store** Liftoff campaign requests
2. **Control Facebook API** via relay endpoints
3. **Store mappings** between Strategis campaigns and Facebook campaigns
4. **Apply naming conventions** consistently across both systems

---

## Complete Data Flow

```
Liftoff Attention Engine
    ↓ (generates campaign plan)
    ↓
Liftoff Campaign Factory
    ├─→ Step 1: Configure Strategis Requirements
    │     ├─→ Template setup (if needed)
    │     ├─→ Naming convention configuration
    │     └─→ Tracking configuration
    │
    ├─→ Step 2: Create Facebook Campaign (via Strategis relay)
    │     └─→ POST /api/facebook/campaigns/create
    │
    ├─→ Step 3: Create Facebook Ad Sets (via Strategis relay)
    │     └─→ POST /api/facebook/adsets/create (per ad set)
    │
    ├─→ Step 4: Create Facebook Ads (via Strategis relay)
    │     └─→ POST /api/facebook/ads/create (per ad)
    │
    └─→ Step 5: Create Strategis Tracking Campaigns
          └─→ POST /api/campaigns (one per Facebook ad set)
```

---

## Part 1: Strategis Requirements Setup

### What Strategis Needs to Store/Index

#### 1. Campaign Request Index

**Purpose**: Track all campaign creation requests from Liftoff

**Fields to Index**:
```typescript
{
  // Request Identification
  "requestId": "uuid-v4",                    // Unique request ID from Liftoff
  "clientRequestKey": "idempotency-key",     // For idempotency
  "organization": "Interlincx",             // Organization name
  "timestamp": "2025-01-XXT00:00:00Z",      // Request timestamp
  
  // Campaign Plan Metadata
  "hookSetId": "hookset_juvederm_2025_10_21", // Attention Engine hook set ID
  "brand": "BrandX",                          // Brand name
  "market": "US",                             // Market/geo
  "channel": "FB",                            // Channel (FB, IG, etc.)
  "objective": "CONVERSIONS",                 // Campaign objective
  
  // Naming Convention Template
  "namingConvention": {
    "campaign": "{Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {Date}",
    "adset": "{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{Version}",
    "ad": "{CreativeType} | {HookId} | {Variant} | {Format} | {Lang}"
  },
  
  // Status Tracking
  "status": "pending" | "in_progress" | "completed" | "failed",
  "facebookCampaignId": "120212345678901234", // After creation
  "strategisCampaignIds": ["strategis-id-1", "strategis-id-2"], // After creation
  
  // Error Tracking
  "errors": [],                               // Any errors encountered
  "retryCount": 0                             // Retry attempts
}
```

#### 2. Naming Convention Configuration

**Purpose**: Store and apply naming conventions consistently

**Fields to Store**:
```typescript
{
  "organization": "Interlincx",
  "namingTemplates": {
    "campaign": "{Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {Date}",
    "adset": "{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{Version}",
    "ad": "{CreativeType} | {HookId} | {Variant} | {Format} | {Lang}"
  },
  "delimiter": " | ",                         // Field delimiter
  "dateFormat": "YYYY-MM-DD",                 // Date format
  "versionFormat": "v{N}"                     // Version format
}
```

**API Endpoint Needed**: `POST /api/organizations/:org/naming-conventions`
- Store naming conventions per organization
- Used to generate names for Facebook and Strategis campaigns

---

## Part 2: Complete Strategis Setup for Facebook Campaign Tracking

### Overview

**Important**: Strategis tracking setup is separate from Facebook campaign creation. Strategis handles tracking URLs and click recording. Facebook campaign creation happens via the Strategis relay endpoints (see Part 3).

### Step 1: Create Template (One-Time per URL Pattern)

**Endpoint**: `POST /api/templates` ✅ (exists)

**Purpose**: Define tracking URL template with Mustache variables

**Required Fields**:
```typescript
{
  "key": string,                    // REQUIRED - Template identifier
  "value": string,                 // REQUIRED - Mustache template string
  "organization": string,           // REQUIRED - Organization name
  "notes": string                   // OPTIONAL - Description
}
```

**Example Request** (✅ CORRECTED based on actual Strategis routing code):
```json
{
  "key": "facebook-tracking-template",
  "value": "http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&subid2={{source}}_{{kwSetId}}_{{familyId}}&fbclid={{fbclid}}&utm_source=facebook&utm_medium=cpc&utm_campaign={{campaignId}}&utm_term={{ag}}",
  "organization": "Interlincx",
  "notes": "Template for Facebook campaign tracking"
}
```

**Key Corrections**:
- ✅ Use `{{fbclid}}` **NOT** `{{networkClickId}}` (Facebook-specific)
- ✅ Use Mustache section `{{#article}}/{{article}}{{/article}}` to handle missing article gracefully
- ✅ `{{ag}}` is auto-populated from `utm_term` (ad set ID) for Facebook

**Template Variables Available**:
- `{{domain}}` — Advertiser domain (from campaign properties)
- `{{article}}` — Landing page path (optional, from campaign properties or kwSet)
- `{{campaignId}}` — Strategis campaign ID (auto-populated)
- `{{source}}` — Source identifier (decorated with kwSetId and familyId)
- `{{kwSetId}}` — Keyword set ID (auto-populated)
- `{{familyId}}` — Family ID (auto-populated)
- `{{fbclid}}` — Facebook click ID (from query parameter, **use this NOT networkClickId**)
- `{{ag}}` — Ad group ID (auto-populated from `utm_term` for Facebook)
- `{{utm_term}}`, `{{utm_source}}`, `{{utm_campaign}}` — UTM parameters (from query)
- `{{zip}}`, `{{city}}`, `{{state}}`, `{{country}}` — Geo data (from IP geolocation)
- `{{hour}}` — Current hour (auto-populated)

**⚠️ IMPORTANT**: 
- For Facebook, use `{{fbclid}}` directly, **NOT** `{{networkClickId}}`
- `{{article}}` is optional — use Mustache section `{{#article}}/{{article}}{{/article}}` to handle gracefully

**Response**:
```json
{
  "id": "template-id-123",
  "key": "facebook-tracking-template",
  "value": "...",
  "organization": "Interlincx"
}
```

### Step 2: Create Strategis Campaign (Per Facebook Ad Set)

**Endpoint**: `POST /api/campaigns` ✅ (exists)

**Purpose**: Create tracking campaign for each Facebook ad set

**Required Fields** (from Liftoff):

```typescript
{
  // Campaign Identification
  "name": string,                    // REQUIRED - Generated from naming convention
  "category": string,                 // REQUIRED - Business category (e.g., "Healthcare", "Finance")
  
  // Template Configuration
  "template": {
    "id": string                      // REQUIRED - Template ID from Step 1
  },
  
  // Properties (Facebook Integration)
  "properties": {
    "buyer": string,                  // REQUIRED - Campaign owner/brand name
    "networkName": "facebook",        // REQUIRED - Always "facebook" for FB campaigns
    "destination": string,            // REQUIRED - "S1" or "Lincx"
    "domain": string,                 // REQUIRED - Advertiser domain
    
    // Optional but Recommended
    "networkAccountId": string,       // OPTIONAL - Facebook ad account ID (act_*)
    "article": string,                // OPTIONAL - Landing page path
    "fbPage": string,                 // OPTIONAL - Facebook page name/ID
    "fbAdAccount": string,            // OPTIONAL - Facebook ad account (numeric, no "act_")
    
    // Facebook Campaign References (set after Facebook creation)
    "fbCampaignId": string,          // OPTIONAL - Facebook campaign ID (set after creation)
    "fbAdSetId": string              // OPTIONAL - Facebook ad set ID (set after creation)
  },
  
  // Organization
  "organizations": string[]            // REQUIRED - Array with organization name
}
```

**Note**: Strategis does NOT support `metadata` field in campaign creation. Store any additional metadata separately if needed.

### Example Request:

```json
{
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "category": "Healthcare",
  "template": {
    "id": "facebook-template-s1"
  },
  "properties": {
    "buyer": "BrandX",
    "networkName": "facebook",
    "destination": "S1",
    "domain": "brandx.com",
    "networkAccountId": "act_123456789",
    "article": "landing-page",
    "fbPage": "BrandX Official",
    "fbAdAccount": "123456789",
    "fbCampaignId": "120212345678901234",
    "fbAdSetId": "120212345678901235"
  },
  "organizations": ["Interlincx"]
}
```

### What Happens Automatically

Once you create the Strategis campaign, Strategis automatically:

- ✅ **Generates tracking URL**: `https://r.strateg.is/route?campaignId=<strategis-campaign-id>`
- ✅ **Records clicks** when users visit the tracking URL
- ✅ **Renders template** with campaign properties + query params
- ✅ **Redirects to advertiser** with full tracking parameters
- ✅ **Stores events** in Redis → LevelDB → ClickHouse

### Tracking URL Usage

**Format**: `https://r.strateg.is/route?campaignId=<strategis-campaign-id>&fbclid={{fbclid}}`

**Usage in Facebook Ads**:
- Use this tracking URL as the destination URL in Facebook ad creatives
- Strategis will automatically:
  1. Record the click
  2. Render the template with all variables
  3. Redirect to the final advertiser URL with all tracking parameters

### What Strategis Does NOT Handle

**Facebook-Side Setup** (separate from Strategis):
- ❌ Creating Facebook campaigns/adsets/ads (handled via relay endpoints)
- ❌ Uploading creatives/images/videos
- ❌ Configuring Facebook Pixel on advertiser site
- ❌ Setting up Facebook Conversions API
- ❌ Configuring Facebook ad targeting
- ❌ Setting Facebook budgets/bids

**Advertiser-Side Setup** (separate from Strategis):
- ❌ Installing Facebook Pixel on landing page
- ❌ Configuring conversion events
- ❌ Setting up server-side conversion tracking

---

## Part 3: Fields Required for Facebook Campaign Creation (via Strategis Relay)

### Facebook Campaign Creation (`POST /api/facebook/campaigns/create`)

**Required Fields** (from Liftoff):

```typescript
{
  // Organization & Account
  "organization": string,             // REQUIRED - Organization name
  "adAccountId": string,              // REQUIRED - Facebook ad account (numeric, no "act_")
  
  // Campaign Details
  "name": string,                     // REQUIRED - Generated from naming convention
  "objective": string,                // REQUIRED - e.g., "CONVERSIONS", "LEAD_GENERATION"
  "status": "PAUSED" | "ACTIVE",     // REQUIRED - Usually "PAUSED" initially
  "special_ad_categories": string[],  // REQUIRED - e.g., ["NONE"]
  "buying_type": "AUCTION",           // REQUIRED - Always "AUCTION"
  
  // Budget Configuration
  "is_campaign_budget_optimized": boolean,  // REQUIRED - true for CBO, false for ABO
  "daily_budget": string,             // REQUIRED if CBO - Amount in micros (e.g., "50000000" = $50)
  
  // Idempotency
  "clientRequestKey": string          // REQUIRED - For idempotency
}
```

### Facebook Ad Set Creation (`POST /api/facebook/adsets/create`)

**Required Fields**:

```typescript
{
  // Organization & Campaign
  "organization": string,             // REQUIRED
  "campaign_id": string,              // REQUIRED - Facebook campaign ID
  
  // Ad Set Details
  "name": string,                     // REQUIRED - Generated from naming convention
  "optimization_goal": string,        // REQUIRED - e.g., "OFFSITE_CONVERSIONS"
  "billing_event": string,            // REQUIRED - Usually "IMPRESSIONS"
  "status": "PAUSED" | "ACTIVE",     // REQUIRED
  
  // Targeting
  "targeting": {
    "geo_locations": {
      "countries": string[]           // REQUIRED - e.g., ["US"]
    },
    "age_min": number,                // REQUIRED - e.g., 21
    "age_max": number,                // REQUIRED - e.g., 65
    "publisher_platforms": string[],   // REQUIRED - e.g., ["facebook", "instagram"]
    "facebook_positions": string[],    // OPTIONAL - e.g., ["feed", "story", "reels"]
    "instagram_positions": string[]    // OPTIONAL - e.g., ["feed", "story", "reels"]
  },
  
  // Optimization
  "promoted_object": {                // REQUIRED for conversions
    "pixel_id": string,                // REQUIRED - Facebook pixel ID
    "custom_event_type": string        // REQUIRED - e.g., "PURCHASE"
  },
  
  // Budget (for ABO only)
  "daily_budget": string,             // REQUIRED if ABO - Amount in micros
  
  // Bid Strategy
  "bid_strategy": string,              // REQUIRED - e.g., "LOWEST_COST_WITHOUT_CAP"
  
  // Schedule
  "start_time": string,                // OPTIONAL - ISO 8601 format
  
  // Idempotency
  "clientRequestKey": string           // REQUIRED
}
```

### Facebook Ad Creation (`POST /api/facebook/ads/create`)

**Required Fields**:

```typescript
{
  // Organization & Ad Set
  "organization": string,             // REQUIRED
  "adset_id": string,                 // REQUIRED - Facebook ad set ID
  
  // Ad Details
  "name": string,                     // REQUIRED - Generated from naming convention
  "status": "PAUSED" | "ACTIVE",     // REQUIRED
  
  // Creative
  "creative": {
    "creative_id": string             // REQUIRED - Pre-created creative ID
  },
  
  // Idempotency
  "clientRequestKey": string          // REQUIRED
}
```

---

## Part 4: Complete Field Mapping

### Campaign Setup Flow — Field Mapping

#### Step 1: Attention Engine Generates Plan

```typescript
interface CampaignPlan {
  // Core Identification
  brand: string;                      // "BrandX"
  objective: string;                   // "CONVERSIONS"
  hookSetId: string;                  // "hookset_juvederm_2025_10_21"
  market: string;                     // "US"
  channel: string;                     // "FB"
  date: string;                       // "2025-10-22"
  
  // Account & Organization
  adAccountId: string;                // "act_123456789"
  organization: string;                // "Interlincx"
  category: string;                   // "Healthcare"
  
  // Tracking Configuration
  domain: string;                     // "brandx.com"
  destination: string;                 // "S1"
  templateId: string;                 // "facebook-template-s1"
  
  // Ad Sets
  adSets: AdSetPlan[];
}

interface AdSetPlan {
  // Naming Components
  audienceKey: string;                // "ll_2p_purchasers_180"
  placementKey: string;                // "advplus_all_auto"
  optimizationEvent: string;          // "PURCHASE"
  budgetType: "CBO" | "ABO";         // "CBO"
  version: number;                    // 1
  
  // Targeting
  targeting: {
    countries: string[];              // ["US"]
    ageMin: number;                   // 21
    ageMax: number;                   // 65
    publisherPlatforms: string[];    // ["facebook", "instagram"]
    facebookPositions: string[];       // ["feed", "story", "reels"]
    instagramPositions: string[];     // ["feed", "story", "reels"]
  };
  
  // Optimization
  pixelId: string;                    // "123456789012345"
  customEventType: string;            // "PURCHASE"
  
  // Budget
  dailyBudget: string;                // "50000000" (micros)
  bidStrategy: string;                // "LOWEST_COST_WITHOUT_CAP"
  
  // Schedule
  startTime?: string;                 // ISO 8601
  
  // Ads
  ads: AdPlan[];
}

interface AdPlan {
  // Naming Components
  creativeType: "IMG" | "VID";       // "VID"
  hookId: string;                     // "H123"
  variant: string;                    // "A"
  format: "1x1" | "4x5" | "9x16";   // "4x5"
  lang: string;                       // "EN"
  
  // Creative
  creativeId: string;                 // Pre-created creative ID
}
```

#### Step 2: Generate Names (Liftoff)

```typescript
// Campaign Name
const campaignName = `${brand} | ${objective} | ${hookSetId} | ${market} | ${channel} | ${date}`;
// Result: "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22"

// Ad Set Name
const adSetName = `${audienceKey} | ${placementKey} | ${optimizationEvent} | ${budgetType} | v${version}`;
// Result: "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"

// Ad Name
const adName = `${creativeType} | ${hookId} | ${variant} | ${format} | ${lang}`;
// Result: "VID | H123 | A | 4x5 | EN"

// Strategis Campaign Name (combines campaign + ad set)
const strategisCampaignName = `${campaignName} - ${adSetName}`;
// Result: "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"
```

#### Step 3: Create Facebook Campaign (via Strategis)

```typescript
POST /api/facebook/campaigns/create
{
  organization: "Interlincx",
  adAccountId: "123456789",  // Numeric, no "act_"
  name: campaignName,
  objective: "CONVERSIONS",
  status: "PAUSED",
  special_ad_categories: ["NONE"],
  buying_type: "AUCTION",
  is_campaign_budget_optimized: true,
  daily_budget: "50000000",
  clientRequestKey: `campaign-${requestId}`
}
```

#### Step 4: Create Facebook Ad Sets (via Strategis)

```typescript
for (const adSet of adSets) {
  POST /api/facebook/adsets/create
  {
    organization: "Interlincx",
    campaign_id: fbCampaignId,
    name: adSetName,
    optimization_goal: "OFFSITE_CONVERSIONS",
    billing_event: "IMPRESSIONS",
    targeting: {
      geo_locations: { countries: adSet.targeting.countries },
      age_min: adSet.targeting.ageMin,
      age_max: adSet.targeting.ageMax,
      publisher_platforms: adSet.targeting.publisherPlatforms,
      facebook_positions: adSet.targeting.facebookPositions,
      instagram_positions: adSet.targeting.instagramPositions
    },
    promoted_object: {
      pixel_id: adSet.pixelId,
      custom_event_type: adSet.customEventType
    },
    status: "PAUSED",
    bid_strategy: adSet.bidStrategy,
    start_time: adSet.startTime,
    clientRequestKey: `adset-${requestId}-${index}`
  }
}
```

#### Step 5: Create Strategis Tracking Campaigns

```typescript
// One-time: Create template (if not exists)
const template = await strategisAPI.post('/api/templates', {
  key: 'facebook-tracking-template',
  // ✅ CORRECTED: Use {{fbclid}} NOT {{networkClickId}}, use Mustache section for optional article
  value: 'http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&subid2={{source}}_{{kwSetId}}_{{familyId}}&fbclid={{fbclid}}&utm_source=facebook&utm_medium=cpc&utm_campaign={{campaignId}}&utm_term={{ag}}',
  organization: organization,
  notes: 'Template for Facebook campaign tracking'
});

// For each Facebook ad set: Create Strategis tracking campaign
for (const [index, fbAdSet] of fbAdSets.entries()) {
  const strategisCampaign = await strategisAPI.post('/api/campaigns', {
    name: strategisCampaignName,  // Campaign + Ad Set combined
    category: category,            // e.g., "Healthcare"
    template: { id: template.id },
    properties: {
      buyer: brand,
      networkName: "facebook",
      destination: destination,        // "S1" or "Lincx"
      domain: domain,                 // "brandx.com"
      // Optional but recommended
      networkAccountId: adAccountId,  // "act_123456789"
      article: article,               // Landing page path
      fbAdAccount: adAccountId.replace("act_", ""),  // "123456789"
      fbPage: fbPage,                 // Facebook page name
      fbCampaignId: fbCampaignId,     // Set after Facebook creation
      fbAdSetId: fbAdSet.id           // Set after Facebook creation
    },
    organizations: [organization]
  });
  
  // Get tracking URL for use in Facebook ads
  const trackingUrl = `https://r.strateg.is/route?campaignId=${strategisCampaign.id}&fbclid={{fbclid}}`;
  
  // Use trackingUrl when creating Facebook ads (via relay endpoint)
}
```

---

## Part 5: What Strategis Needs to Build

### 1. Request Indexing System

**Purpose**: Track and index all campaign creation requests

**Requirements**:
- Store request metadata (requestId, organization, timestamp, status)
- Index by organization, hookSetId, status
- Support querying by requestId, organization, date range
- Track request status (pending, in_progress, completed, failed)
- Store Facebook and Strategis campaign IDs after creation

**API Endpoints Needed**:
- `GET /api/campaign-requests` — List requests (with filters)
- `GET /api/campaign-requests/:requestId` — Get request details
- `PUT /api/campaign-requests/:requestId/status` — Update status

### 2. Naming Convention Storage

**Purpose**: Store and apply naming conventions per organization

**Requirements**:
- Store naming templates per organization
- Support variable substitution ({Brand}, {Objective}, etc.)
- Apply naming conventions when creating campaigns
- Validate naming format

**API Endpoints Needed**:
- `POST /api/organizations/:org/naming-conventions` — Set naming conventions
- `GET /api/organizations/:org/naming-conventions` — Get naming conventions
- `POST /api/naming/generate` — Generate name from template and variables

### 3. Facebook API Relay Endpoints

**Purpose**: Relay Facebook API calls (see `strategis-relay-endpoints-spec.md`)

**Endpoints Needed**:
- `POST /api/facebook/campaigns/create`
- `POST /api/facebook/adsets/create`
- `POST /api/facebook/adcreatives/create`
- `POST /api/facebook/ads/create`

### 4. Campaign Mapping Storage

**Purpose**: Store mappings between Strategis and Facebook campaigns

**Requirements**:
- Link Strategis campaign ID to Facebook campaign ID
- Link Strategis campaign ID to Facebook ad set ID
- Support querying by Facebook IDs or Strategis IDs
- Store in `properties` field of Strategis campaign (already supported)

---

## Part 6: Required Configuration Data

### What Liftoff Needs from Strategis

1. **Template IDs**:
   - How to get list of available templates?
   - How to create new templates if needed?
   - API: `GET /api/templates?organization=Interlincx`

2. **Category Values**:
   - What categories are valid?
   - API: `GET /api/categories`

3. **Organization Names**:
   - What organizations exist?
   - API: `GET /api/organizations`

4. **Destination Values**:
   - What destinations are valid? (e.g., "S1")
   - API: `GET /api/destinations`

5. **Facebook Ad Account Mapping**:
   - How to map Facebook ad accounts to organizations?
   - API: `GET /api/organizations/:org/facebook-accounts`

---

## Summary: Field Checklist

### For Template Creation (`POST /api/templates`)

**Required Fields**:
- ✅ `key` — Template identifier (string)
- ✅ `value` — Mustache template string with variables
- ✅ `organization` — Organization name

**Optional Fields**:
- `notes` — Description/notes

### For Strategis Campaign Creation (`POST /api/campaigns`)

**Required Fields**:
- ✅ `name` — Generated from naming convention (campaign + ad set combined)
- ✅ `category` — Business category (e.g., "Healthcare", "Finance")
- ✅ `template.id` — Template ID from template creation
- ✅ `properties.buyer` — Campaign owner/brand name
- ✅ `properties.networkName` — "facebook"
- ✅ `properties.destination` — "S1" or "Lincx"
- ✅ `properties.domain` — Advertiser domain
- ✅ `organizations` — Array with organization name

**Optional but Recommended**:
- `properties.networkAccountId` — Facebook ad account (act_*)
- `properties.article` — Landing page path
- `properties.fbPage` — Facebook page name/ID
- `properties.fbAdAccount` — Facebook ad account (numeric, no "act_")
- `properties.fbCampaignId` — Facebook campaign ID (set after Facebook creation)
- `properties.fbAdSetId` — Facebook ad set ID (set after Facebook creation)

**Note**: Strategis does NOT support `metadata` field. Store any additional metadata separately if needed.

---

## Next Steps

1. **Review Field Requirements**: Strategis engineering team review
2. **Design Indexing System**: Request tracking and naming convention storage
3. **Build Relay Endpoints**: Facebook API relay (see `strategis-relay-endpoints-spec.md`)
4. **Create Configuration APIs**: Templates, categories, organizations, destinations
5. **Test Integration**: End-to-end testing with Liftoff

---

## References

- **Relay Endpoints Spec**: `strategis-relay-endpoints-spec.md`
- **Architecture Decision**: `strategis-facebook-api-architecture-decision.md`
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`
- **Implementation Guide**: `strategis-campaign-setup-implementation-guide.md`

