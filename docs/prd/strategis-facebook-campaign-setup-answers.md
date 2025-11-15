# Strategis Campaign Setup — Answers from Devin (Strategis Agent)

## Document Purpose
This document contains answers from Devin (Strategis agent) about campaign setup and naming convention integration. These answers inform the implementation approach.

**Status**: Answers Confirmed ✅  
**Owner**: Engineering (Platform)  
**Version**: 1.0 (2025-01-XX)

---

## Round 1 Answers

*(First round answers would be documented here if provided)*

---

## Round 2 Answers — Detailed Clarifications

### Q: Does the proposed API exist?

**Answer**: ❌ **NO** — The proposed API endpoint `POST /api/strategis/campaigns/create` does **NOT** exist.

### Q: What's the actual schema?

**Answer**: The actual Strategis API uses a simpler, flatter structure:

**Endpoint**: `POST /api/campaigns`

**Request Schema**:
```json
{
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22",
  "category": "Healthcare",
  "template": { "id": "template-id" },
  "properties": {
    "buyer": "BrandX",
    "networkName": "facebook",
    "networkAccountId": "act_123456789",
    "destination": "S1",
    "domain": "advertiser.com",
    "fbAdAccount": "123456789",
    "fbPage": "PageName"
  },
  "organizations": ["Interlincx"]
}
```

**Key Differences from Proposed Schema**:
- ❌ **No `adSets` array** — Strategis doesn't model ad sets
- ❌ **No `tracking` object** — Tracking is handled via templates
- ❌ **No `clientRequestKey`** — No built-in idempotency
- ✅ **Returns simple campaign object with ID**

### Q: How does it relate to Facebook campaign creation?

**Answer**: It **DOESN'T** — Strategis has **NO API** to create Facebook campaigns. You must call Meta Ads API directly.

**🔴 CRITICAL CLARIFICATION**: See `strategis-facebook-api-architecture-decision.md` for architecture decision framework.

**Current Strategis Facebook API Status**:
- ✅ EXISTS: `GET /api/facebook/campaigns`, `PUT /api/facebook/campaigns/:id/budget`, `PUT /api/facebook/campaigns/:id/status`, etc.
- ❌ DOES NOT EXIST: `POST /api/facebook/campaigns`, `POST /api/facebook/adsets`, `POST /api/facebook/ads`

**Architecture Decision Required**:
- **Option A**: Build Strategis relay endpoints (if business requirement)
- **Option B**: Register Liftoff as Facebook app and call Meta Ads API directly (recommended if possible)

---

## Recommended Integration Approach

### ✅ Option B: Liftoff-Coordinated (ONLY Viable Approach)

Based on the actual codebase, **Option B is the only viable approach**:

```
Attention Engine (Liftoff)
  ↓ generates naming
  ↓
Liftoff Campaign Factory
  ├─→ Meta Ads API (create FB campaign/adsets/ads)
  │     Returns: FB Campaign ID, Ad Set IDs, Ad IDs
  └─→ Strategis API (create tracking campaign)
        POST /api/campaigns with FB IDs in properties
```

---

## Mapping Attention Engine Names to Strategis

### Campaign Level: ✅ Direct Mapping

```typescript
// Attention Engine generates
const campaignName = "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22";

// Use in both systems
await createFacebookCampaign({ name: campaignName });
await createStrategisCampaign({ name: campaignName });
```

### Ad Set Level: ⚠️ Create Separate Strategis Campaigns

**Important**: For each Facebook ad set, create a separate Strategis campaign.

```typescript
// For each Facebook ad set, create a Strategis campaign
for (const adSet of adSets) {
  const adSetName = "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1";
  
  await createStrategisCampaign({
    name: `${campaignName} - ${adSetName}`,  // Combine names
    properties: {
      fbCampaignId: fbCampaign.id,
      fbAdSetId: adSet.id,  // Store ad set ID
      // ... other properties
    }
  });
}
```

### Ad Level: ❌ Strategis Doesn't Track Individual Ads

Tracking happens at campaign/ad set level only.

---

## Answers to Open Questions

| Question | Answer | Status |
|----------|--------|--------|
| Does Strategis expose campaign creation APIs? | ✅ YES — `POST /api/campaigns` | Confirmed |
| How to apply naming conventions? | ✅ Use `name` field, no restrictions | Confirmed |
| Structure mapping? | ⚠️ Flat structure, create one Strategis campaign per FB ad set | Confirmed |
| Strategis Ad Manager exist? | ❌ NO — call Meta Ads API directly | Confirmed |
| Tracking setup? | ✅ Automated via templates | Confirmed |
| Who coordinates? | ✅ Liftoff must coordinate | Confirmed |
| Handle failures? | ⚠️ Implement saga pattern with rollback | Needs Implementation |
| Naming validation? | ✅ None in Strategis, implement in Liftoff | Confirmed |
| Bidirectional sync? | ❌ Not automatic, requires custom implementation | Confirmed |
| Additional metadata? | ✅ Requires category, buyer, organizations, template | Confirmed |

---

## Key Findings Summary

### ✅ What Strategis Supports
- Campaign creation via `POST /api/campaigns`
- Campaign naming (no restrictions)
- Template-based tracking configuration
- Storing Facebook campaign/ad set IDs in properties

### ❌ What Strategis Does NOT Support
- Creating Facebook campaigns (must use Meta Ads API directly)
- Ad set modeling (flat structure, one Strategis campaign per FB ad set)
- Built-in idempotency
- Individual ad tracking
- Automatic name synchronization

### ⚠️ Implementation Requirements
- Liftoff must coordinate both systems
- Need to implement saga pattern for failure handling
- Need to implement idempotency in Liftoff
- Need to create one Strategis campaign per Facebook ad set
- Need to combine campaign + ad set names for Strategis campaigns

---

## Next Steps

1. ✅ **Answers Documented** — This document
2. ⏭️ **Create Implementation Guide** — Detailed code examples and patterns
3. ⏭️ **Update Exploration Document** — Mark questions as answered
4. ⏭️ **Design Integration Service** — Build Liftoff Campaign Factory service
5. ⏭️ **Implement Proof of Concept** — Test with real campaigns

---

## References

- **Exploration Document**: `docs/prd/strategis-campaign-setup-exploration.md`
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`
- **Strategis Ad Manager PRD**: `docs/prd/strategis-facebook-ad-manager-prd.md` (Note: This was proposed but doesn't exist)

