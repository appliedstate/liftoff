# Strategis Facebook API Architecture — Decision Framework

## Document Purpose
This document clarifies the architecture decision: **Should Liftoff call Meta Ads API directly, or tunnel through Strategis?**

**Status**: ✅ DECISION MADE — **Option A: Strategis Relay Required**  
**Version**: 1.1 (2025-01-XX)

**🔴 CONFIRMED**: Hard requirement to route through Strategis. Option A is the only viable path.

---

## Current Strategis Facebook Integration

### ✅ What EXISTS in Strategis

**Read/Update Operations**:
- `GET /api/facebook/campaigns` — Fetch campaigns from Facebook
- `PUT /api/facebook/campaigns/:id/budget` — Update campaign budget
- `PUT /api/facebook/campaigns/:id/status` — Update campaign status
- `PUT /api/facebook/adsets/:id/budget` — Update ad set budget
- `PUT /api/facebook/adsets/:id/status` — Update ad set status
- `PUT /api/facebook/adsets/:id/bid` — Update ad set bid
- `POST /api/facebook/update-campaigns-batch` — Batch updates

### ❌ What DOES NOT EXIST in Strategis

**Create Operations** (Required for campaign setup):
- `POST /api/facebook/campaigns` — Create campaign
- `POST /api/facebook/adsets` — Create ad set
- `POST /api/facebook/ads` — Create ad
- `POST /api/facebook/adcreatives` — Create creative

---

## How Strategis Accesses Facebook

**Current Implementation**:
- Strategis stores Facebook credentials per organization
- `organizationUsers.getOrgFacebookCredentials(organization)` returns auth tokens
- Strategis calls Meta Graph API directly using these tokens
- Code location: `strategis-api/lib/services/facebook.js`
- Token caching: 11 hours

---

## The Critical Question

### Is "tunneling through Strategis" a BUSINESS REQUIREMENT or a WORKAROUND?

---

## Option A: Business/Compliance Requirement

**If your organization mandates**:
- ✅ Only Strategis can hold Facebook credentials
- ✅ All Facebook API calls must go through Strategis
- ✅ Liftoff cannot have its own Facebook app registration

**Then you need**: Build Facebook relay endpoints in Strategis

**Timeline**: Months  
**Effort**: High  
**Requires**: Strategis engineering collaboration

---

## Option B: Workaround (Liftoff Lacks Credentials)

**If the reason is simply**:
- ✅ Liftoff doesn't have a Facebook app registered yet
- ✅ Liftoff doesn't have access to the ad accounts

**Then you should**: Register Liftoff as a Facebook app and call Meta Ads API directly

**Timeline**: Days/weeks  
**Effort**: Low  
**Requires**: Facebook app registration process

---

## Decision Matrix

| Situation | Recommendation | Timeline | Effort |
|-----------|---------------|----------|--------|
| **Liftoff CAN get FB app credentials** | **Option B: Direct to Meta** | Days/weeks | Low |
| **Liftoff CANNOT get credentials**<br/>Policy requires Strategis-only | **Build Strategis Relay** | Months | High |

---

## Option A: Build Strategis Relay (If Required)

### Minimum Viable Endpoints Needed

#### 1. Create Campaign

**Endpoint**: `POST /api/facebook/campaigns/create`

**Request**:
```json
{
  "organization": "Interlincx",
  "adAccountId": "123456789",
  "name": "Campaign Name",
  "objective": "CONVERSIONS",
  "status": "PAUSED",
  "special_ad_categories": [],
  "clientRequestKey": "idempotency-key-123"
}
```

**Response**:
```json
{
  "id": "120212345678901234",
  "name": "Campaign Name"
}
```

#### 2. Create Ad Set

**Endpoint**: `POST /api/facebook/adsets/create`

**Request**:
```json
{
  "organization": "Interlincx",
  "campaign_id": "120212345678901234",
  "name": "Ad Set Name",
  "optimization_goal": "OFFSITE_CONVERSIONS",
  "billing_event": "IMPRESSIONS",
  "bid_amount": 100,
  "daily_budget": 5000,
  "targeting": { /* targeting spec */ },
  "status": "PAUSED",
  "clientRequestKey": "idempotency-key-456"
}
```

**Response**:
```json
{
  "id": "120212345678901235",
  "name": "Ad Set Name"
}
```

#### 3. Create Ad

**Endpoint**: `POST /api/facebook/ads/create`

**Request**:
```json
{
  "organization": "Interlincx",
  "adset_id": "120212345678901235",
  "name": "Ad Name",
  "creative": {
    "creative_id": "120212345678901236"
  },
  "status": "PAUSED",
  "clientRequestKey": "idempotency-key-789"
}
```

**Response**:
```json
{
  "id": "120212345678901237",
  "name": "Ad Name"
}
```

### Implementation in Strategis

**File**: `strategis-api/lib/api/facebook.js`

```javascript
function createCampaign(req, res, opts, cb) {
  body(req, res, function (err, body) {
    if (err) return cb(err);
    
    const { organization, adAccountId, clientRequestKey, ...campaignData } = body;
    
    // Check idempotency
    if (clientRequestKey) {
      const cached = await checkIdempotencyCache(clientRequestKey);
      if (cached) return send(req, res, cached);
    }
    
    // Get Facebook credentials
    organizationUsers.getOrgFacebookCredentials(organization, (err, credentials) => {
      if (err) return cb(err);
      
      const { authToken } = credentials;
      
      // Call Meta Graph API
      const url = `${config.facebook.host}/act_${adAccountId}/campaigns`;
      jsonist.post(url, {
        access_token: authToken,
        ...campaignData
      }, function (err, fbCampaign) {
        if (err) return cb(err);
        
        // Store in idempotency cache
        if (clientRequestKey) {
          storeIdempotencyCache(clientRequestKey, fbCampaign);
        }
        
        send(req, res, fbCampaign);
      });
    });
  });
}
```

---

## Option B: Direct to Meta Ads API (Recommended if Possible)

### Implementation Flow

```
Liftoff Attention Engine
    ↓ (generates campaign plan + naming)
    ↓
Liftoff Campaign Factory
    ├─→ Meta Ads API (direct)
    │     ├─→ Create campaign
    │     ├─→ Create ad sets
    │     ├─→ Create creatives
    │     └─→ Create ads
    │
    └─→ Strategis API (tracking)
          ├─→ Create template (if needed)
          └─→ Create tracking campaigns
                POST /api/campaigns with FB IDs
```

### Advantages

- ✅ **Faster implementation** — No Strategis changes needed
- ✅ **Simpler architecture** — Direct API calls
- ✅ **Better error handling** — Direct access to Facebook errors
- ✅ **More control** — Full Meta Ads API features available
- ✅ **Existing Strategis endpoints** — Use for tracking setup

### Requirements

1. **Facebook App Registration**:
   - Register Liftoff as Facebook app
   - Get app ID and app secret
   - Request `ads_management` permission
   - Get access tokens for ad accounts

2. **Ad Account Access**:
   - Request access to Facebook ad accounts
   - Get ad account IDs (`act_*`)

3. **Meta Ads API Client**:
   - Implement Meta Ads API client in Liftoff
   - Handle authentication and token refresh
   - Implement retry logic and error handling

---

## Complete Integration Flow Comparison

### Option A: Strategis Relay (If Required)

```
1. Liftoff → Strategis (create template if needed)
   POST /api/templates

2. Liftoff → Strategis Facebook Relay (create campaign)
   POST /api/facebook/campaigns/create

3. Liftoff → Strategis Facebook Relay (create adsets)
   POST /api/facebook/adsets/create

4. Liftoff → Strategis Facebook Relay (create ads)
   POST /api/facebook/ads/create

5. Liftoff → Strategis API (create tracking campaigns)
   POST /api/campaigns with FB IDs

6. Liftoff → Store mappings
```

### Option B: Direct to Meta (Recommended)

```
1. Liftoff → Meta Ads API (create campaign)
   POST https://graph.facebook.com/v24.0/act_{adAccountId}/campaigns

2. Liftoff → Meta Ads API (create ad sets)
   POST https://graph.facebook.com/v24.0/adcampaigns

3. Liftoff → Meta Ads API (create creatives)
   POST https://graph.facebook.com/v24.0/adcreatives

4. Liftoff → Meta Ads API (create ads)
   POST https://graph.facebook.com/v24.0/ads

5. Liftoff → Strategis API (create template if needed)
   POST /api/templates

6. Liftoff → Strategis API (create tracking campaigns)
   POST /api/campaigns with FB IDs

7. Liftoff → Store mappings
```

---

## Strategis Setup Requirements (Both Options)

### Template Creation

**Endpoint**: `POST /api/templates`

**Request**:
```json
{
  "key": "facebook-template",
  "value": "http://{{domain}}/{{article}}?subid={{campaignId}}&fbclid={{networkClickId}}",
  "organization": "Interlincx"
}
```

### Campaign Creation (Tracking)

**Endpoint**: `POST /api/campaigns` ✅ (exists)

**Request**:
```json
{
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "category": "Healthcare",
  "template": { "id": "template-id" },
  "properties": {
    "buyer": "BrandX",
    "networkName": "facebook",
    "networkAccountId": "act_123456789",
    "destination": "S1",
    "domain": "advertiser.com",
    "fbAdAccount": "123456789",
    "fbCampaignId": "120212345678901234",
    "fbAdSetId": "120212345678901235"
  },
  "organizations": ["Interlincx"]
}
```

### Tracking Configuration

- ✅ **Automatic via `/route` endpoint** — No separate tracking API needed
- ✅ **Pixel/CAPI configuration** — Happens on advertiser side (NOT in Strategis)
- ✅ **Template-based** — Tracking URLs configured via templates

---

## ✅ DECISION CONFIRMED

### 🎯 Architecture: Option A — Strategis Relay (REQUIRED)

**Status**: Hard requirement confirmed — All Facebook API calls must route through Strategis.

**Implementation Plan**:
- ✅ Start with create-only endpoints
- ✅ Use Meta-compatible payload format
- ✅ Add idempotency support
- ✅ Plan for creative/asset endpoints in Phase 2

**Next Steps**: See "Building Strategis Relay Endpoints" section below.

---

## Next Steps

1. **Decision Point**: Determine if Liftoff can get Facebook app credentials
2. **If Option B**: Start Facebook app registration process
3. **If Option A**: Plan Strategis relay endpoint development with Strategis engineers
4. **Update Implementation Guide**: Based on chosen option
5. **Build Proof of Concept**: Test with sandbox accounts

---

## References

- **Answers Document**: `docs/prd/strategis-facebook-campaign-setup-answers.md`
- **Additional Questions**: `docs/prd/strategis-campaign-setup-additional-questions.md`
- **Implementation Guide**: `docs/prd/strategis-campaign-setup-implementation-guide.md`
- **Critical Path**: `docs/prd/strategis-campaign-setup-critical-path.md`

