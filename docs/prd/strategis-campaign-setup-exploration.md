# Strategis Campaign Setup & Naming Convention Integration — Exploration Guide

## Document Purpose
This document outlines the exploration needed with Devin (Strategis agent) to understand how to:
1. Set up campaigns programmatically in Strategis
2. Have the Attention Engine control naming conventions for both Facebook campaigns AND Strategis tracking
3. Eliminate the manual dual-setup process (currently: set up in Strategis → then set up in Liftoff)

**Status**: ✅ Answers Confirmed — See `strategis-facebook-campaign-setup-answers.md`  
**Owner**: Engineering (Platform) · Collaborators: Growth, Attention Factory  
**Version**: 1.0 (2025-01-XX)

---

## Current State & Problem

### Current Workflow (Manual, Duplicated)
1. **Team sets up campaign in Strategis**:
   - Create campaign/tracking structure in Strategis
   - Set up naming conventions manually
   - Configure tracking parameters

2. **Team sets up campaign in Liftoff**:
   - Create campaign structure via Meta Ads API
   - Apply naming conventions (from Attention Engine)
   - Configure budgets, targeting, creatives

**Problem**: 
- Dual manual setup is error-prone and time-consuming
- Naming conventions may diverge between Strategis and Facebook
- Attention Engine generates naming but can't apply it to Strategis
- No single source of truth for campaign structure

### Desired State (Automated, Unified)
1. **Attention Engine generates campaign plan**:
   - Campaign structure (campaigns, ad sets, ads)
   - Naming conventions (applied to both platforms)
   - Targeting, budgets, creatives

2. **Single API call creates in both systems**:
   - Strategis: Campaign/tracking structure with naming
   - Facebook: Campaign structure via Meta Ads API with naming
   - Both use identical naming conventions from Attention Engine

---

## System Overview

### Components
- **Attention Engine (Liftoff)**: Generates hooks, creatives, media plans, and naming conventions
- **Strategis**: Platform for campaign tracking, performance analysis, and automation
- **Strategis Ad Manager**: Proposed service to create Facebook campaigns (see `docs/prd/strategis-facebook-ad-manager-prd.md`)
- **Meta Ads API**: External API for Facebook campaign creation

### Current Architecture
```
Attention Engine (Liftoff)
    ↓ (generates campaign plan + naming)
    ├─→ Manual Setup in Strategis ❌
    └─→ Manual Setup in Facebook ❌
```

### Desired Architecture
```
Attention Engine (Liftoff)
    ↓ (generates campaign plan + naming)
    ├─→ Strategis API (campaign setup + naming) ✅
    └─→ Meta Ads API (campaign setup + naming) ✅
```

---

## Key Questions for Devin (Strategis Agent)

### 🔴 CRITICAL: Campaign Creation in Strategis

#### Q1: Strategis Campaign Creation API
**Question**: Does Strategis expose APIs to programmatically create campaigns and tracking structures?

**What We Need**:
- [ ] API endpoint(s) for campaign creation
- [ ] API endpoint(s) for ad set/tracking setup
- [ ] Request/response schemas
- [ ] Authentication method
- [ ] Idempotency support

**Context**: We need to create campaigns in Strategis with the same naming conventions that Attention Engine generates for Facebook.

---

#### Q2: Naming Convention Application
**Question**: How does Strategis handle campaign/tracking naming? Can we set names programmatically?

**What We Need**:
- [ ] How to set campaign names in Strategis
- [ ] How to set ad set/tracking names
- [ ] Naming format requirements (delimiters, length limits, special characters)
- [ ] Whether Strategis has its own naming conventions we need to follow

**Context**: Attention Engine generates names like:
- Campaign: `{Brand} | {Objective} | {HookSet} | {Market} | FB | {YYYY-MM-DD}`
- Ad Set: `{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{N}`
- Ad: `{CreativeType} | {HookId} | {Variant} | {Format} | {Lang}`

We need to apply these same names to Strategis tracking structures.

---

#### Q3: Campaign Structure Mapping
**Question**: How does Strategis structure campaigns? Does it mirror Facebook's hierarchy (Campaign → Ad Set → Ad)?

**What We Need**:
- [ ] Strategis object model (campaigns, ad sets, ads, tracking groups?)
- [ ] How Strategis structures map to Facebook structures
- [ ] Whether we can create a full hierarchy in one API call
- [ ] Whether Strategis requires additional metadata beyond Facebook

**Context**: We need to create matching structures in both systems with consistent naming.

---

### 🟡 HIGH: Integration Points

#### Q4: Strategis Ad Manager Service
**Question**: Is there a Strategis "Ad Manager" service (as proposed in `docs/prd/strategis-facebook-ad-manager-prd.md`) that can create Facebook campaigns? Or should we call Meta Ads API directly from Liftoff?

**What We Need**:
- [ ] Does Strategis Ad Manager exist?
- [ ] If yes, API endpoints and schemas
- [ ] If no, should we build it or call Meta Ads API directly?
- [ ] How does it relate to Terminal (execution engine)?

**Context**: The PRD proposes Strategis Ad Manager as the service that creates Facebook campaigns. We need to know if this exists or needs to be built.

---

#### Q5: Single Source of Truth
**Question**: Should Strategis be the single source of truth for campaign structure, or should Liftoff coordinate both systems?

**What We Need**:
- [ ] Recommended architecture (Strategis-first vs Liftoff-first)
- [ ] How to handle failures (if Strategis succeeds but Facebook fails, or vice versa)
- [ ] State synchronization requirements
- [ ] Rollback strategy

**Context**: We need to ensure consistency between Strategis and Facebook campaigns.

---

#### Q6: Tracking Setup
**Question**: What tracking setup is required in Strategis when creating campaigns?

**What We Need**:
- [ ] Required tracking parameters (pixel IDs, conversion events, UTM parameters?)
- [ ] How to configure tracking for campaigns/ad sets
- [ ] Whether tracking setup is separate from campaign creation
- [ ] How tracking relates to Facebook pixel/events

**Context**: Currently team manually sets up tracking in Strategis. We need to automate this.

---

### 🟢 MEDIUM: Naming Convention Details

#### Q7: Naming Convention Validation
**Question**: Does Strategis validate naming conventions? Are there constraints we need to follow?

**What We Need**:
- [ ] Maximum name length
- [ ] Allowed/forbidden characters
- [ ] Required format patterns
- [ ] Whether Strategis enforces naming conventions

**Context**: We want to ensure Attention Engine naming works in both systems.

---

#### Q8: Naming Synchronization
**Question**: If a campaign name changes in Facebook, should it sync to Strategis (and vice versa)?

**What We Need**:
- [ ] Whether Strategis supports name updates
- [ ] Whether we should sync name changes bidirectionally
- [ ] How to handle name conflicts

**Context**: Names may change after creation (e.g., version bumps, corrections).

---

## Proposed Integration Flow

### Option A: Strategis-First (If Strategis Ad Manager Exists)
```
Attention Engine (Liftoff)
    ↓ (generates campaign plan + naming)
    ↓
Strategis Ad Manager API
    ├─→ Create in Strategis (campaign + tracking + naming)
    └─→ Create in Facebook (campaign + ad sets + ads + naming)
    ↓
Return IDs from both systems
```

**Pros**:
- Single API call
- Strategis coordinates both systems
- Ensures consistency

**Cons**:
- Requires Strategis Ad Manager to exist
- More complex error handling

---

### Option B: Liftoff-Coordinated (If No Strategis Ad Manager)
```
Attention Engine (Liftoff)
    ↓ (generates campaign plan + naming)
    ↓
Liftoff Campaign Factory
    ├─→ Strategis API (create campaign + tracking + naming)
    └─→ Meta Ads API (create campaign + ad sets + ads + naming)
    ↓
Store mappings (Strategis ID ↔ Facebook ID)
```

**Pros**:
- Works with existing Strategis APIs
- Liftoff controls the flow
- Can handle partial failures

**Cons**:
- Two API calls to coordinate
- Need to handle consistency

---

### Option C: Parallel Creation (Simplest)
```
Attention Engine (Liftoff)
    ↓ (generates campaign plan + naming)
    ↓
Parallel API Calls
    ├─→ Strategis API (create campaign + naming)
    └─→ Meta Ads API (create campaign + naming)
    ↓
Store mappings
```

**Pros**:
- Simple to implement
- Independent systems

**Cons**:
- No coordination
- Risk of inconsistency
- Need to handle failures separately

---

## Naming Convention Flow

### Current Naming Convention (from `docs/marketing/buyer-guide-naming-and-campaign-templates.md`)

**Campaign Name**:
```
{Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {YYYY-MM-DD}
Example: BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22
```

**Ad Set Name**:
```
{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType=CBO|ABO} | v{N}
Example: ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1
```

**Ad Name**:
```
{CreativeType=IMG|VID} | {HookId} | {Variant} | {Format=1x1|4x5|9x16} | {Lang}
Example: VID | H123 | A | 4x5 | EN
```

### How Attention Engine Generates Names

**Inputs**:
- Brand (from campaign plan)
- Objective (CONVERSIONS, LEAD_GENERATION, etc.)
- HookSet ID (e.g., `hookset_juvederm_2025_10_21`)
- Market (US, CA, etc.)
- Channel (FB, IG, etc.)
- Date (campaign launch date)
- Audience keys (from targeting plan)
- Placement keys (from placement plan)
- Creative metadata (type, hook ID, variant, format, language)

**Output**: Fully formatted names for campaigns, ad sets, and ads

### Application to Strategis

**Question**: How do these names map to Strategis structures?

**What We Need**:
- [ ] Does Strategis use the same naming format?
- [ ] Does Strategis have additional naming requirements?
- [ ] How to map Facebook campaign/ad set/ad names to Strategis equivalents?

---

## Implementation Requirements

### From Strategis Side

1. **Campaign Creation API**:
   - Endpoint to create campaigns with naming
   - Endpoint to create ad sets/tracking groups with naming
   - Support for Attention Engine naming format

2. **Naming Convention Support**:
   - Accept names in Attention Engine format
   - Validate naming (if required)
   - Store names for tracking/analysis

3. **Tracking Setup**:
   - Configure tracking parameters (pixel, events, UTMs)
   - Link tracking to campaigns/ad sets
   - Support for conversion event tracking

### From Liftoff Side

1. **Naming Generator**:
   - Generate names from Attention Engine inputs
   - Format names according to convention
   - Validate names before sending to APIs

2. **Integration Service**:
   - Call Strategis API for campaign creation
   - Call Meta Ads API for campaign creation
   - Handle naming synchronization
   - Store ID mappings

3. **Error Handling**:
   - Handle partial failures (Strategis succeeds, Facebook fails, or vice versa)
   - Retry logic
   - Rollback strategy

---

## Open Questions Summary

### Before Implementation (CRITICAL)
1. ✅ Does Strategis expose campaign creation APIs?
2. ✅ How to apply naming conventions in Strategis?
3. ✅ How does Strategis structure map to Facebook structure?
4. ✅ Does Strategis Ad Manager exist, or should we call Meta Ads API directly?

### For Integration (HIGH)
5. ✅ What tracking setup is required in Strategis?
6. ✅ Should Strategis or Liftoff coordinate campaign creation?
7. ✅ How to handle failures and consistency?

### For Optimization (MEDIUM)
8. ✅ Naming validation requirements in Strategis?
9. ✅ Should name changes sync bidirectionally?
10. ✅ Additional Strategis metadata requirements?

---

## Next Steps

1. **Schedule exploration session with Devin**:
   - Review this document
   - Answer CRITICAL questions first
   - Discuss integration approach

2. **Review existing Strategis APIs**:
   - Document current API surface
   - Identify gaps for campaign creation
   - Understand naming/tracking requirements

3. **Design integration architecture**:
   - Choose integration approach (A, B, or C)
   - Define API contracts
   - Plan error handling

4. **Build proof of concept**:
   - Implement naming generator
   - Test Strategis API calls
   - Test Facebook API calls
   - Verify naming consistency

5. **Iterate based on feedback**:
   - Test with real campaigns
   - Refine naming conventions if needed
   - Optimize integration flow

---

## References

- **✅ Answers Document**: `docs/prd/strategis-facebook-campaign-setup-answers.md`
- **✅ Implementation Guide**: `docs/prd/strategis-campaign-setup-implementation-guide.md`
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`
- **Strategis Ad Manager PRD**: `docs/prd/strategis-facebook-ad-manager-prd.md` (Note: Proposed but doesn't exist)
- **Campaign Factory PRD**: `docs/prd/campaign-factory-from-intel-prd.md`
- **Terminal Integration**: `docs/prd/terminal-strategist-integration-qa.md`
- **Terminal Follow-Up**: `docs/prd/terminal-strategist-followup-questions.md`

---

## Appendix: Actual Strategis API (Confirmed)

### ✅ Confirmed: Actual Strategis Campaign Creation API

**Endpoint**: `POST /api/campaigns` (NOT `/api/strategis/campaigns/create`)

**Request Schema** (Actual):
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
    "fbPage": "PageName",
    "fbCampaignId": "120000000000001",
    "fbAdSetId": "238600000000001"
  },
  "organizations": ["Interlincx"]
}
```

**Key Findings**:
- ❌ No `adSets` array — Strategis doesn't model ad sets (flat structure)
- ❌ No `tracking` object — Tracking handled via templates
- ❌ No `clientRequestKey` — No built-in idempotency
- ✅ One Strategis campaign per Facebook ad set
- ✅ Store Facebook IDs in `properties` object

**See**: `docs/prd/strategis-facebook-campaign-setup-answers.md` for full answers and `docs/prd/strategis-campaign-setup-implementation-guide.md` for implementation details.

