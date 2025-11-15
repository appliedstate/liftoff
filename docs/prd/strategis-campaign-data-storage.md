# Strategis Campaign Setup — Data Storage Architecture

## Document Purpose
This document defines what data needs to be stored, where it should be stored, and how to track mappings between Liftoff, Strategis, and Facebook campaign IDs.

**Status**: 🔴 ARCHITECTURE DESIGN  
**Version**: 1.0 (2025-01-XX)

---

## Problem Statement

Liftoff needs to:
1. **Generate campaign plans** (Attention Engine)
2. **Create campaigns in Strategis** (tracking setup)
3. **Create campaigns in Facebook** (via Strategis relay)
4. **Track mappings** between all three systems
5. **Query and manage** campaigns across systems

**Question**: Where should all this data be stored?

---

## Data Flow & Storage Requirements

### Complete Data Flow

```
Liftoff Attention Engine
    ↓ (generates campaign plan)
    ↓
Liftoff Database (PostgreSQL?)
    ├─→ Store campaign plan
    ├─→ Store generated IDs
    └─→ Store mappings (Liftoff ↔ Strategis ↔ Facebook)
    ↓
Liftoff Campaign Factory
    ├─→ Create in Strategis → Store Strategis IDs
    └─→ Create in Facebook (via Strategis) → Store Facebook IDs
    ↓
Update mappings in Liftoff Database
```

---

## What Data Needs to Be Stored

### 1. Campaign Plan Data (Liftoff)

**Source**: Attention Engine generates campaign plans

**What to Store**:
```typescript
interface CampaignPlan {
  // Liftoff IDs
  id: string;                        // Liftoff campaign plan ID
  requestId: string;                 // Unique request ID for idempotency
  
  // Campaign Metadata
  brand: string;
  objective: string;
  hookSetId: string;
  market: string;
  channel: string;
  date: string;                      // YYYY-MM-DD
  category: string;
  
  // Account & Organization
  adAccountId: string;               // Facebook ad account (act_*)
  organization: string;              // "Interlincx"
  
  // Tracking Configuration
  domain: string;
  destination: string;                // "S1" or "Lincx"
  templateId: string;                 // Strategis template ID
  
  // Generated Names
  campaignName: string;               // Generated from naming convention
  adSetNames: string[];              // Generated for each ad set
  adNames: string[][];               // Generated for each ad (per ad set)
  
  // Ad Sets
  adSets: AdSetPlan[];
  
  // Status
  status: "draft" | "pending" | "creating" | "active" | "paused" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

interface AdSetPlan {
  // Naming Components
  audienceKey: string;
  placementKey: string;
  optimizationEvent: string;
  budgetType: "CBO" | "ABO";
  version: number;
  
  // Targeting
  targeting: TargetingSpec;
  
  // Optimization
  pixelId: string;
  customEventType: string;
  
  // Budget
  dailyBudget: string;                // In micros
  bidStrategy: string;
  
  // Schedule
  startTime?: string;
  
  // Ads
  ads: AdPlan[];
}
```

### 2. Campaign Mappings (Liftoff)

**Purpose**: Track IDs across all three systems

**What to Store**:
```typescript
interface CampaignMapping {
  // Liftoff IDs
  campaignPlanId: string;            // Liftoff campaign plan ID
  requestId: string;                 // Request ID for idempotency
  
  // Strategis IDs
  strategisTemplateId: string;       // Template ID (one per template)
  strategisCampaignIds: string[];     // One per Facebook ad set
  
  // Facebook IDs
  facebookCampaignId: string;         // Facebook campaign ID
  facebookAdSetIds: string[];         // Facebook ad set IDs
  facebookCreativeIds: string[];      // Facebook creative IDs
  facebookAdIds: string[];            // Facebook ad IDs
  
  // Tracking URLs
  trackingUrls: string[];             // Strategis tracking URLs (one per ad set)
  
  // Status
  status: "pending" | "creating" | "active" | "failed";
  createdAt: Date;
  updatedAt: Date;
  
  // Errors
  errors: Array<{
    step: string;
    error: string;
    timestamp: Date;
  }>;
}
```

### 3. Strategis Campaign Data (Strategis)

**What Strategis Stores**:
- Campaign objects (via `POST /api/campaigns`)
- Template objects (via `POST /api/templates`)
- Facebook credentials per organization
- Click/event data (Redis → LevelDB → ClickHouse)

**What Liftoff Needs to Query**:
- Strategis campaign IDs
- Tracking URLs
- Performance data (if available via API)

---

## Storage Architecture Options

### Option A: Liftoff Database Only (Recommended)

**Storage Location**: Liftoff PostgreSQL database

**What to Store**:
- ✅ Campaign plans (full plan data)
- ✅ Campaign mappings (all IDs)
- ✅ Request tracking (idempotency)
- ✅ Status tracking
- ✅ Error logs

**Pros**:
- ✅ Single source of truth
- ✅ Easy to query and manage
- ✅ Full control over data
- ✅ Can track relationships easily

**Cons**:
- ⚠️ Need to sync with Strategis for status updates
- ⚠️ Need to query Strategis for performance data

**Database Schema**:

```sql
-- Campaign Plans
CREATE TABLE campaign_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Campaign Metadata
  brand VARCHAR(255) NOT NULL,
  objective VARCHAR(100) NOT NULL,
  hook_set_id VARCHAR(255) NOT NULL,
  market VARCHAR(10) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  
  -- Account & Organization
  ad_account_id VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  
  -- Tracking Configuration
  domain VARCHAR(255) NOT NULL,
  destination VARCHAR(50) NOT NULL,
  strategis_template_id VARCHAR(255),
  
  -- Generated Names
  campaign_name TEXT NOT NULL,
  ad_set_names TEXT[] NOT NULL,
  ad_names TEXT[][] NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Mappings (Liftoff ↔ Strategis ↔ Facebook)
CREATE TABLE campaign_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_plan_id UUID NOT NULL REFERENCES campaign_plans(id),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Strategis IDs
  strategis_template_id VARCHAR(255),
  strategis_campaign_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  
  -- Facebook IDs
  facebook_campaign_id VARCHAR(255),
  facebook_ad_set_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  facebook_creative_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  facebook_ad_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  
  -- Tracking URLs
  tracking_urls TEXT[] NOT NULL DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Request Tracking (for idempotency)
CREATE TABLE campaign_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  client_request_key VARCHAR(255) UNIQUE,
  
  campaign_plan_id UUID REFERENCES campaign_plans(id),
  campaign_mapping_id UUID REFERENCES campaign_mappings(id),
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  step VARCHAR(100),                  -- Current step in creation process
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Error Logs
CREATE TABLE campaign_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_plan_id UUID REFERENCES campaign_plans(id),
  campaign_mapping_id UUID REFERENCES campaign_mappings(id),
  request_id VARCHAR(255),
  
  step VARCHAR(100) NOT NULL,        -- Which step failed
  error_type VARCHAR(100),
  error_message TEXT NOT NULL,
  error_details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaign_plans_request_id ON campaign_plans(request_id);
CREATE INDEX idx_campaign_plans_hook_set_id ON campaign_plans(hook_set_id);
CREATE INDEX idx_campaign_plans_status ON campaign_plans(status);
CREATE INDEX idx_campaign_mappings_campaign_plan_id ON campaign_mappings(campaign_plan_id);
CREATE INDEX idx_campaign_mappings_request_id ON campaign_mappings(request_id);
CREATE INDEX idx_campaign_mappings_facebook_campaign_id ON campaign_mappings(facebook_campaign_id);
CREATE INDEX idx_campaign_requests_client_request_key ON campaign_requests(client_request_key);
```

---

### Option B: Distributed Storage (Liftoff + Strategis)

**Storage Location**: 
- Liftoff: Campaign plans, mappings
- Strategis: Campaign objects, tracking data

**Pros**:
- ✅ Each system stores what it owns
- ✅ Strategis has its own data

**Cons**:
- ❌ Harder to query across systems
- ❌ Need to sync data
- ❌ More complex to manage

**Not Recommended**: Adds complexity without clear benefit

---

## Recommended Architecture: Liftoff Database

### Data Storage Strategy

**Liftoff Database Stores**:
1. ✅ **Campaign Plans** — Full campaign plan data from Attention Engine
2. ✅ **Campaign Mappings** — All IDs (Liftoff, Strategis, Facebook)
3. ✅ **Request Tracking** — Idempotency and status
4. ✅ **Error Logs** — Error tracking and debugging

**Strategis Stores**:
- Campaign objects (for tracking)
- Template objects
- Click/event data

**Liftoff Queries Strategis For**:
- Performance data (if available via API)
- Status updates (if needed)

---

## Data Flow with Storage

### Step 1: Generate Campaign Plan

```typescript
// Attention Engine generates plan
const campaignPlan = {
  brand: "BrandX",
  objective: "CONVERSIONS",
  hookSetId: "hookset_juvederm_2025_10_21",
  // ... other fields
};

// Store in Liftoff database
const savedPlan = await db.campaignPlans.create({
  ...campaignPlan,
  requestId: generateRequestId(),
  status: "draft"
});
```

### Step 2: Create Strategis Template (if needed)

```typescript
// Check if template exists
let templateId = await db.getTemplateId(organization, templateKey);

if (!templateId) {
  // Create template in Strategis
  const template = await strategisAPI.post('/api/templates', {
    key: 'facebook-tracking-template',
    value: templateValue,
    organization: organization
  });
  
  templateId = template.id;
  
  // Store template ID in Liftoff (for reference)
  await db.templates.upsert({
    organization,
    key: templateKey,
    strategisTemplateId: templateId
  });
}

// Update campaign plan with template ID
await db.campaignPlans.update(savedPlan.id, {
  strategisTemplateId: templateId
});
```

### Step 3: Create Facebook Campaign (via Strategis)

```typescript
// Create Facebook campaign via Strategis relay
const fbCampaign = await strategisFacebookAPI.post('/api/facebook/campaigns/create', {
  organization: organization,
  adAccountId: adAccountId,
  name: campaignName,
  // ... other fields
  clientRequestKey: `campaign-${savedPlan.requestId}`
});

// Store Facebook campaign ID
await db.campaignMappings.create({
  campaignPlanId: savedPlan.id,
  requestId: savedPlan.requestId,
  facebookCampaignId: fbCampaign.id,
  status: "creating"
});
```

### Step 4: Create Facebook Ad Sets (via Strategis)

```typescript
const fbAdSetIds = [];

for (const [index, adSetPlan] of savedPlan.adSets.entries()) {
  const fbAdSet = await strategisFacebookAPI.post('/api/facebook/adsets/create', {
    organization: organization,
    campaign_id: fbCampaign.id,
    name: adSetNames[index],
    // ... other fields
    clientRequestKey: `adset-${savedPlan.requestId}-${index}`
  });
  
  fbAdSetIds.push(fbAdSet.id);
  
  // Update mapping
  await db.campaignMappings.update(savedPlan.id, {
    facebookAdSetIds: fbAdSetIds
  });
}
```

### Step 5: Create Strategis Tracking Campaigns

```typescript
const strategisCampaignIds = [];
const trackingUrls = [];

for (const [index, fbAdSetId] of fbAdSetIds.entries()) {
  // Create Strategis campaign
  const strategisCampaign = await strategisAPI.post('/api/campaigns', {
    name: `${campaignName} - ${adSetNames[index]}`,
    category: category,
    template: { id: templateId },
    properties: {
      buyer: brand,
      networkName: "facebook",
      destination: destination,
      domain: domain,
      fbCampaignId: fbCampaign.id,
      fbAdSetId: fbAdSetId
    },
    organizations: [organization]
  });
  
  strategisCampaignIds.push(strategisCampaign.id);
  trackingUrls.push(`https://r.strateg.is/route?campaignId=${strategisCampaign.id}&fbclid={{fbclid}}`);
  
  // Update mapping
  await db.campaignMappings.update(savedPlan.id, {
    strategisCampaignIds: strategisCampaignIds,
    trackingUrls: trackingUrls
  });
}
```

### Step 6: Create Facebook Ads (via Strategis)

```typescript
const fbAdIds = [];

for (const [adSetIndex, adSetPlan] of savedPlan.adSets.entries()) {
  for (const [adIndex, adPlan] of adSetPlan.ads.entries()) {
    // Create creative first (if needed)
    const creative = await strategisFacebookAPI.post('/api/facebook/adcreatives/create', {
      organization: organization,
      object_story_spec: buildCreativeSpec(adPlan, trackingUrls[adSetIndex]),
      clientRequestKey: `creative-${savedPlan.requestId}-${adSetIndex}-${adIndex}`
    });
    
    // Create ad
    const fbAd = await strategisFacebookAPI.post('/api/facebook/ads/create', {
      organization: organization,
      adset_id: fbAdSetIds[adSetIndex],
      name: adNames[adSetIndex][adIndex],
      creative: { creative_id: creative.id },
      status: "PAUSED",
      clientRequestKey: `ad-${savedPlan.requestId}-${adSetIndex}-${adIndex}`
    });
    
    fbAdIds.push(fbAd.id);
    
    // Update mapping
    await db.campaignMappings.update(savedPlan.id, {
      facebookAdIds: fbAdIds,
      facebookCreativeIds: [...existingCreativeIds, creative.id]
    });
  }
}

// Mark as complete
await db.campaignMappings.update(savedPlan.id, {
  status: "active"
});
```

---

## Query Patterns

### Find Campaign by Request ID

```typescript
const mapping = await db.campaignMappings.findOne({
  where: { requestId: requestId },
  include: [{ model: CampaignPlan }]
});
```

### Find Campaign by Facebook Campaign ID

```typescript
const mapping = await db.campaignMappings.findOne({
  where: { facebookCampaignId: fbCampaignId },
  include: [{ model: CampaignPlan }]
});
```

### Find All Campaigns for Hook Set

```typescript
const plans = await db.campaignPlans.findAll({
  where: { hookSetId: hookSetId },
  include: [{ model: CampaignMapping }]
});
```

### Get Campaign Status

```typescript
const status = await db.campaignMappings.findOne({
  where: { requestId: requestId },
  attributes: ['status', 'errors']
});
```

---

## Idempotency Strategy

### Using Request ID

**Liftoff generates**: `requestId` (UUID or deterministic)

**Stored in**:
- `campaign_plans.request_id`
- `campaign_mappings.request_id`
- `campaign_requests.request_id`

**Usage**:
- Check if `requestId` exists before creating
- If exists, return existing mapping
- If not, proceed with creation

### Using Client Request Key

**Liftoff generates**: `clientRequestKey` for each API call

**Format**: `{type}-{requestId}-{index}`

**Examples**:
- `campaign-req-abc-123`
- `adset-req-abc-123-0`
- `ad-req-abc-123-0-0`

**Stored in**:
- `campaign_requests.client_request_key`
- Passed to Strategis relay endpoints

**Usage**:
- Strategis checks idempotency cache
- Liftoff also checks database before calling Strategis

---

## Data Synchronization

### One-Way Sync (Liftoff → Strategis)

**Liftoff creates** → Strategis stores

**No sync needed**: Strategis is the source of truth for its own data

### Status Updates

**If Strategis provides status API**:
- Poll Strategis for campaign status
- Update Liftoff database

**If not**:
- Liftoff tracks status based on creation results
- Strategis status is separate (for tracking)

---

## Summary

### Storage Location: Liftoff Database (PostgreSQL)

**What Liftoff Stores**:
- ✅ Campaign plans (full data)
- ✅ Campaign mappings (all IDs)
- ✅ Request tracking (idempotency)
- ✅ Error logs

**What Strategis Stores**:
- Campaign objects (for tracking)
- Template objects
- Click/event data

**Benefits**:
- ✅ Single source of truth for campaign data
- ✅ Easy to query and manage
- ✅ Full control over data
- ✅ Can track relationships easily

---

## Next Steps

1. **Design Database Schema**: Create tables in Liftoff database
2. **Implement Data Access Layer**: Repository/service layer for database operations
3. **Implement Campaign Factory**: Use database for storage and idempotency
4. **Add Query APIs**: Endpoints to query campaign data
5. **Add Monitoring**: Track creation success/failure rates

---

## References

- **Requirements**: `strategis-campaign-setup-requirements.md`
- **Relay Endpoints**: `strategis-relay-endpoints-spec.md`
- **Implementation Guide**: `strategis-campaign-setup-implementation-guide.md`

