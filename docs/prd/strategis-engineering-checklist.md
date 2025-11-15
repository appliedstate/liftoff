# Strategis Engineering — Implementation Checklist

## Document Purpose
Quick reference checklist for Strategis engineers on what needs to be built for Liftoff campaign setup integration.

**Status**: 🔴 ACTION ITEMS — For Strategis Engineering  
**Version**: 1.0 (2025-01-XX)

---

## 🔴 CRITICAL: What Strategis Needs to Build

### 1. Request Indexing System

**Purpose**: Track and index all campaign creation requests from Liftoff

**What to Build**:
- [ ] Database table/schema for campaign requests
- [ ] Index by: `requestId`, `organization`, `hookSetId`, `status`, `timestamp`
- [ ] API endpoint: `GET /api/campaign-requests` (with filters)
- [ ] API endpoint: `GET /api/campaign-requests/:requestId`
- [ ] API endpoint: `PUT /api/campaign-requests/:requestId/status`

**Fields to Store**:
```typescript
{
  requestId: string,              // Unique request ID from Liftoff
  clientRequestKey: string,       // For idempotency
  organization: string,            // Organization name
  hookSetId: string,              // Attention Engine hook set ID
  status: "pending" | "in_progress" | "completed" | "failed",
  facebookCampaignId: string,     // After creation
  strategisCampaignIds: string[], // After creation
  timestamp: Date,
  errors: any[],
  retryCount: number
}
```

---

### 2. Naming Convention Storage & Application

**Purpose**: Store and apply naming conventions per organization

**What to Build**:
- [ ] Database table/schema for naming conventions (per organization)
- [ ] API endpoint: `POST /api/organizations/:org/naming-conventions`
- [ ] API endpoint: `GET /api/organizations/:org/naming-conventions`
- [ ] API endpoint: `POST /api/naming/generate` (generate name from template)
- [ ] Variable substitution engine ({Brand}, {Objective}, etc.)

**Naming Templates to Store**:
```typescript
{
  campaign: "{Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {Date}",
  adset: "{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{Version}",
  ad: "{CreativeType} | {HookId} | {Variant} | {Format} | {Lang}"
}
```

---

### 3. Facebook API Relay Endpoints

**Purpose**: Relay Facebook API calls (Liftoff → Strategis → Facebook)

**What to Build**:
- [ ] `POST /api/facebook/campaigns/create` — Create Facebook campaign
- [ ] `POST /api/facebook/adsets/create` — Create Facebook ad set
- [ ] `POST /api/facebook/adcreatives/create` — Create Facebook creative
- [ ] `POST /api/facebook/ads/create` — Create Facebook ad
- [ ] Idempotency support (via `clientRequestKey`)
- [ ] Error handling (pass through Facebook errors)

**See**: `strategis-relay-endpoints-spec.md` for detailed specifications

---

### 4. Configuration APIs

**Purpose**: Provide configuration data that Liftoff needs

**What to Build**:
- [ ] `GET /api/templates?organization=Interlincx` — List available templates
- [ ] `GET /api/categories` — List valid categories
- [ ] `GET /api/organizations` — List organizations
- [ ] `GET /api/destinations` — List valid destinations (e.g., "S1")
- [ ] `GET /api/organizations/:org/facebook-accounts` — List Facebook ad accounts

---

## ✅ What Already Exists (No Changes Needed)

- ✅ `POST /api/campaigns` — Create Strategis tracking campaign
- ✅ `POST /api/templates` — Create/configure templates
- ✅ `GET /api/facebook/campaigns` — Fetch Facebook campaigns
- ✅ `PUT /api/facebook/campaigns/:id/budget` — Update budget
- ✅ `PUT /api/facebook/campaigns/:id/status` — Update status
- ✅ `PUT /api/facebook/adsets/:id/budget` — Update ad set budget
- ✅ `PUT /api/facebook/adsets/:id/status` — Update ad set status
- ✅ `PUT /api/facebook/adsets/:id/bid` — Update bid
- ✅ `POST /api/facebook/update-campaigns-batch` — Batch updates

---

## 📋 Field Mapping: What Liftoff Will Send

### For Strategis Campaign Creation (`POST /api/campaigns`)

**Required Fields**:
```json
{
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "category": "Healthcare",
  "template": { "id": "facebook-template-s1" },
  "properties": {
    "buyer": "BrandX",
    "networkName": "facebook",
    "networkAccountId": "act_123456789",
    "destination": "S1",
    "domain": "brandx.com",
    "fbAdAccount": "123456789",
    "fbAdSetId": "120212345678901235"
  },
  "organizations": ["Interlincx"],
  "metadata": {
    "requestId": "req-abc-123",
    "hookSetId": "hookset_juvederm_2025_10_21",
    "createdBy": "liftoff"
  }
}
```

### For Facebook Campaign Creation (via Relay)

**Required Fields**:
```json
{
  "organization": "Interlincx",
  "adAccountId": "123456789",
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22",
  "objective": "CONVERSIONS",
  "status": "PAUSED",
  "special_ad_categories": ["NONE"],
  "buying_type": "AUCTION",
  "is_campaign_budget_optimized": true,
  "daily_budget": "50000000",
  "clientRequestKey": "campaign-req-abc-123"
}
```

---

## 🔄 Complete Flow

```
1. Liftoff → Strategis (index request)
   POST /api/campaign-requests
   
2. Liftoff → Strategis (create Facebook campaign via relay)
   POST /api/facebook/campaigns/create
   
3. Liftoff → Strategis (create Facebook ad sets via relay)
   POST /api/facebook/adsets/create (per ad set)
   
4. Liftoff → Strategis (create Facebook ads via relay)
   POST /api/facebook/ads/create (per ad)
   
5. Liftoff → Strategis (create tracking campaign)
   POST /api/campaigns (one per Facebook ad set)
   
6. Liftoff → Strategis (update request status)
   PUT /api/campaign-requests/:requestId/status
```

---

## 📚 Reference Documents

- **Complete Requirements**: `strategis-campaign-setup-requirements.md`
- **Relay Endpoints Spec**: `strategis-relay-endpoints-spec.md`
- **Architecture Decision**: `strategis-facebook-api-architecture-decision.md`
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`

---

## ⏱️ Priority & Timeline

### Phase 1: MVP (Required for Basic Functionality)
1. ✅ Facebook API relay endpoints (create campaign, ad set, ad)
2. ✅ Idempotency support
3. ✅ Basic error handling

**Timeline**: 4-6 weeks

### Phase 2: Enhanced Features
1. ⏭️ Request indexing system
2. ⏭️ Naming convention storage
3. ⏭️ Configuration APIs
4. ⏭️ Enhanced monitoring

**Timeline**: 2-4 weeks after Phase 1

---

## 🎯 Success Criteria

- [ ] Can create Facebook campaigns via Strategis relay
- [ ] Can create Facebook ad sets via Strategis relay
- [ ] Can create Facebook ads via Strategis relay
- [ ] Idempotency works (duplicate requests return same IDs)
- [ ] Errors are properly passed through from Facebook
- [ ] Can create Strategis tracking campaigns with Facebook IDs
- [ ] Naming conventions are applied consistently

---

## 📞 Questions?

Contact Liftoff engineering team for:
- Field mapping clarifications
- Naming convention questions
- Integration testing
- API contract alignment

