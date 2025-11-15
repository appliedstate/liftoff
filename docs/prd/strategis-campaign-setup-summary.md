# Strategis Campaign Setup — Executive Summary

## Document Purpose
Quick reference for the Strategis campaign setup integration project, including critical decision points and next steps.

**Status**: 🔴 Architecture Decision Required  
**Last Updated**: 2025-01-XX

---

## ✅ Architecture Decision Confirmed

### Option A: Strategis Relay (REQUIRED)

**Status**: Hard requirement confirmed — All Facebook API calls must route through Strategis.

| Option | Timeline | Effort | Status |
|--------|----------|--------|--------|
| **Option A: Strategis Relay** | Months | High | ✅ **REQUIRED** |
| ~~Option B: Direct to Meta~~ | ~~Days/weeks~~ | ~~Low~~ | ❌ **Not Allowed** |

---

## Current State

### Strategis Facebook API — What Exists

**✅ Read/Update Operations**:
- `GET /api/facebook/campaigns` — Fetch campaigns
- `PUT /api/facebook/campaigns/:id/budget` — Update budget
- `PUT /api/facebook/campaigns/:id/status` — Update status
- `PUT /api/facebook/adsets/:id/budget` — Update ad set budget
- `PUT /api/facebook/adsets/:id/status` — Update ad set status
- `PUT /api/facebook/adsets/:id/bid` — Update bid
- `POST /api/facebook/update-campaigns-batch` — Batch updates

**❌ Create Operations** (DO NOT EXIST):
- `POST /api/facebook/campaigns` — Create campaign
- `POST /api/facebook/adsets` — Create ad set
- `POST /api/facebook/ads` — Create ad
- `POST /api/facebook/adcreatives` — Create creative

### Strategis Campaign API — What Exists

**✅ Tracking Campaign Creation**:
- `POST /api/campaigns` — Create Strategis tracking campaign
- `POST /api/templates` — Create/configure templates

---

## Architecture Options

### Option A: Strategis Relay (If Business Requirement)

**Flow**:
```
Liftoff → Strategis (setup templates)
      → Strategis Facebook Relay (create FB campaigns/adsets/ads) [NEEDS BUILDING]
      → Strategis API (create tracking campaigns)
```

**Requirements**:
- Build 4+ new Strategis endpoints
- Collaborate with Strategis engineers
- Timeline: Months

**Use Case**: If organization policy requires all Facebook API calls through Strategis

---

### Option B: Direct to Meta (Recommended)

**Flow**:
```
Liftoff → Meta Ads API (create FB campaigns/adsets/ads) [DIRECT]
      → Strategis API (create tracking campaigns)
```

**Requirements**:
- Register Liftoff as Facebook app
- Get ad account access
- Implement Meta Ads API client
- Timeline: Days/weeks

**Use Case**: If Liftoff can get Facebook app credentials

---

## Strategis Setup Requirements (Both Options)

### 1. Template Creation
- **Endpoint**: `POST /api/templates`
- **Purpose**: Configure tracking URL patterns
- **Frequency**: One-time per URL pattern

### 2. Campaign Creation (Tracking)
- **Endpoint**: `POST /api/campaigns`
- **Purpose**: Create Strategis tracking campaign
- **Frequency**: One per Facebook ad set
- **Naming**: Combine campaign + ad set name

### 3. Tracking Configuration
- **Automatic**: Via `/route` endpoint
- **Templates**: Handle URL patterns
- **Pixel/CAPI**: Configured on advertiser side (not in Strategis)

---

## Key Findings

### ✅ Confirmed
- Strategis campaign creation API exists (`POST /api/campaigns`)
- Template system exists (`POST /api/templates`)
- Strategis uses flat structure (one campaign per Facebook ad set)
- Tracking is template-based and automatic
- Strategis stores Facebook credentials per organization

### ❌ Does Not Exist
- Strategis endpoints to create Facebook campaigns/adsets/ads
- Built-in idempotency in Strategis
- Automatic name synchronization

### ⚠️ Needs Clarification
- Can Liftoff register as Facebook app? (Architecture decision)
- What template IDs are available?
- What categories/organizations/destinations are valid?

---

## Next Steps

### Immediate (This Week)

1. **✅ DECISION CONFIRMED**: Option A — Strategis Relay Required
   - Hard requirement confirmed
   - All Facebook API calls must route through Strategis

2. **Schedule Meeting with Strategis Engineers**:
   - Review relay endpoint specification
   - Define API contracts
   - Plan development timeline
   - Assign resources

3. **Review Specification**:
   - See `strategis-relay-endpoints-spec.md` for detailed endpoint specs
   - Confirm implementation approach
   - Align on error handling and idempotency

### Short Term (Next 2 Weeks)

4. **Document Answers**: Update answers document with architecture decision
5. **Update Implementation Guide**: Based on chosen option
6. **Build Proof of Concept**: Test with sandbox accounts

### Medium Term (Next Month)

7. **Implement Core Services**: Naming generator, API clients, campaign factory
8. **Add Database Schema**: Store campaign mappings
9. **Implement Error Handling**: Saga pattern, rollback logic

---

## Documentation Index

### Decision & Architecture
- **Architecture Decision**: `strategis-facebook-api-architecture-decision.md` ⭐ **START HERE**
- **Critical Path**: `strategis-campaign-setup-critical-path.md`
- **This Summary**: `strategis-campaign-setup-summary.md`

### Answers & Questions
- **Answers Document**: `strategis-facebook-campaign-setup-answers.md`
- **Additional Questions**: `strategis-campaign-setup-additional-questions.md`
- **Exploration**: `strategis-campaign-setup-exploration.md`

### Implementation
- **Implementation Guide**: `strategis-campaign-setup-implementation-guide.md` (needs update after decision)
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`

---

## Quick Reference: Integration Flow

### Option B: Direct to Meta (Recommended)

```typescript
// 1. Generate names from Attention Engine
const campaignName = generateCampaignName(plan);
const adSetNames = generateAdSetNames(plan);

// 2. Create Facebook campaign (direct)
const fbCampaign = await metaAdsAPI.createCampaign({
  name: campaignName,
  objective: 'CONVERSIONS',
  // ...
});

// 3. Create Facebook ad sets (direct)
for (const adSetPlan of plan.adSets) {
  const fbAdSet = await metaAdsAPI.createAdSet({
    campaign_id: fbCampaign.id,
    name: generateAdSetName(adSetPlan),
    // ...
  });
  
  // 4. Create Strategis tracking campaign
  await strategisAPI.createCampaign({
    name: `${campaignName} - ${generateAdSetName(adSetPlan)}`,
    properties: {
      fbCampaignId: fbCampaign.id,
      fbAdSetId: fbAdSet.id,
      // ...
    }
  });
}
```

### Option A: Strategis Relay (If Required)

```typescript
// 1. Generate names from Attention Engine
const campaignName = generateCampaignName(plan);

// 2. Create Facebook campaign (via Strategis relay)
const fbCampaign = await strategisFacebookAPI.createCampaign({
  organization: 'Interlincx',
  adAccountId: plan.adAccountId,
  name: campaignName,
  objective: 'CONVERSIONS',
  // ...
});

// 3. Create Facebook ad sets (via Strategis relay)
for (const adSetPlan of plan.adSets) {
  const fbAdSet = await strategisFacebookAPI.createAdSet({
    organization: 'Interlincx',
    campaign_id: fbCampaign.id,
    name: generateAdSetName(adSetPlan),
    // ...
  });
  
  // 4. Create Strategis tracking campaign
  await strategisAPI.createCampaign({
    name: `${campaignName} - ${generateAdSetName(adSetPlan)}`,
    properties: {
      fbCampaignId: fbCampaign.id,
      fbAdSetId: fbAdSet.id,
      // ...
    }
  });
}
```

---

## Questions for Devin (If Option A)

If building Strategis relay, these questions become critical:

1. **Timeline**: How long to build create endpoints?
2. **API Contract**: Use Meta Ads API format or Strategis-wrapped?
3. **Idempotency**: How to implement `clientRequestKey`?
4. **Creative Upload**: How to handle asset uploads?
5. **Error Handling**: How to handle Facebook API errors?

**See**: `strategis-campaign-setup-additional-questions.md` for full list.

---

## Recommendation

### 🎯 FIRST: Make the Architecture Decision

**Question**: Can Liftoff register as Facebook app?

- **If YES** → **Option B: Direct to Meta** (Fastest path)
- **If NO** → **Option A: Strategis Relay** (Requires building endpoints)

**⚠️ Don't build the relay unless it's a hard requirement.** Getting Liftoff registered with Facebook is much faster.

---

## Status

- ✅ **Exploration Complete** — Questions identified
- ✅ **Architecture Options Defined** — Option A vs Option B
- 🔴 **Decision Required** — Can Liftoff register as Facebook app?
- ⏭️ **Implementation Pending** — Waiting on architecture decision

