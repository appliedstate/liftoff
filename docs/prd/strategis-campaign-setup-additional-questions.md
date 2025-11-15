# Strategis Campaign Setup — Additional Critical Questions for Devin

## Document Purpose
This document contains **additional critical questions** based on new understanding:
1. Strategis requires significant setup beyond campaign creation (templates, tracking, etc.)
2. Liftoff must tunnel through Strategis Facebook API connection (Liftoff not registered with Facebook)
3. Strategis may not have endpoints to push to Facebook API yet (needs relay/proxy)
4. Full flow: Liftoff → Strategis (setup) → Facebook (via Strategis)

**Status**: Questions for Devin  
**Priority**: 🔴 CRITICAL — Blocks Implementation  
**Version**: 1.0 (2025-01-XX)

---

## 🔴 CRITICAL: Facebook API Relay Architecture

### Q1: Facebook API Access & Authentication

**Question**: How does Strategis expose Facebook API access? Do you have endpoints that proxy/relay Facebook API calls?

**What We Need**:
- [ ] Does Strategis expose Facebook API endpoints (e.g., `POST /api/facebook/campaigns`)?
- [ ] How does authentication work? (Do we pass Facebook access tokens, or does Strategis manage tokens?)
- [ ] What's the API contract? (Same as Meta Ads API, or wrapped/abstracted?)
- [ ] Are there rate limits or quotas we need to be aware of?
- [ ] Does Strategis handle Facebook API versioning?

**Context**: Liftoff is not registered with Facebook, so we must tunnel all Facebook API calls through Strategis.

**Impact**: Determines entire integration architecture.

---

### Q2: Facebook API Relay Implementation Status

**Question**: Does Strategis currently have endpoints to create Facebook campaigns/adsets/ads, or does this need to be built?

**What We Need**:
- [ ] Current status: What Facebook API endpoints exist in Strategis today?
- [ ] What needs to be built: Which endpoints are missing?
- [ ] Timeline: How long to build missing endpoints?
- [ ] Priority: Can we work together to build these endpoints?

**Context**: We need to create campaigns, ad sets, creatives, and ads in Facebook via Strategis.

**Impact**: Determines if we need to build Strategis endpoints first.

---

### Q3: Facebook API Relay Request/Response Format

**Question**: If Strategis proxies Facebook API calls, what's the request/response format?

**What We Need**:
- [ ] Do we send Meta Ads API payloads directly, or Strategis-specific format?
- [ ] Does Strategis validate/transform requests before forwarding?
- [ ] How are Facebook API errors handled? (Passed through or wrapped?)
- [ ] What's the response format? (Facebook response or Strategis wrapper?)

**Example Scenarios**:
```typescript
// Option A: Direct Meta Ads API format
POST /api/strategis/facebook/campaigns
{
  "name": "...",
  "objective": "CONVERSIONS",
  "special_ad_categories": ["NONE"],
  // ... Meta Ads API format
}

// Option B: Strategis-wrapped format
POST /api/strategis/facebook/campaigns
{
  "campaign": { /* Meta Ads API payload */ },
  "strategisMetadata": { /* Additional tracking */ }
}
```

**Impact**: Determines request/response handling in Liftoff.

---

## 🔴 CRITICAL: Strategis Campaign Setup Requirements

### Q4: Complete Strategis Campaign Setup Checklist

**Question**: What is the complete list of setup steps required in Strategis before a campaign can be launched?

**What We Need**:
- [ ] Template selection/configuration (what templates exist? how to configure?)
- [ ] Tracking setup (pixels, conversion events, UTM parameters)
- [ ] Audience configuration (if Strategis manages audiences)
- [ ] Budget/bid strategy configuration
- [ ] Creative/asset setup (if Strategis manages assets)
- [ ] Any other required configuration

**Context**: We need to automate the full setup process, not just campaign creation.

**Impact**: Determines what we need to configure via API.

---

### Q5: Template System & Configuration

**Question**: How does Strategis template system work? How do we configure templates programmatically?

**What We Need**:
- [ ] What templates exist? (List available templates)
- [ ] How to select a template? (Template ID, name, or criteria?)
- [ ] How to configure template parameters? (API endpoints for template config)
- [ ] What template parameters are required vs optional?
- [ ] Can we create custom templates via API?
- [ ] How do templates relate to tracking setup?

**Context**: Templates seem to handle tracking configuration. We need to understand how to set this up.

**Impact**: Critical for tracking setup automation.

---

### Q6: Tracking Configuration API

**Question**: How do we configure tracking (pixels, conversion events, UTMs) in Strategis via API?

**What We Need**:
- [ ] API endpoint(s) for tracking configuration
- [ ] How to set pixel IDs and conversion events
- [ ] How to configure UTM parameters
- [ ] How tracking relates to templates
- [ ] Can tracking be set per campaign, or is it account-level?
- [ ] How to validate tracking setup?

**Context**: Tracking is essential for campaign performance measurement.

**Impact**: Required for campaign setup automation.

---

### Q7: Asset/Creative Management

**Question**: How does Strategis handle creative assets? Do we upload assets to Strategis or reference external URLs?

**What We Need**:
- [ ] Does Strategis have asset upload endpoints?
- [ ] How to reference assets in campaign creation? (IDs, URLs?)
- [ ] What asset types are supported? (Images, videos, etc.)
- [ ] How do assets flow from Liftoff → Strategis → Facebook?
- [ ] Are assets stored in Strategis or just referenced?

**Context**: We need to create ads with creatives. Understanding asset flow is critical.

**Impact**: Determines creative/asset integration approach.

---

## 🟡 HIGH: Integration Flow & Handoffs

### Q8: Complete Campaign Setup Flow

**Question**: What's the complete step-by-step flow for setting up a campaign end-to-end?

**What We Need**:
- [ ] Step 1: Configure Strategis (templates, tracking) — what APIs?
- [ ] Step 2: Create Strategis campaign — `POST /api/campaigns` (confirmed)
- [ ] Step 3: Create Facebook campaign — via Strategis relay?
- [ ] Step 4: Create Facebook ad sets — via Strategis relay?
- [ ] Step 5: Create Facebook ads — via Strategis relay?
- [ ] Step 6: Link Strategis campaign to Facebook campaign — how?
- [ ] Step 7: Activate campaign — what APIs?

**Context**: We need to understand the complete flow to automate it.

**Impact**: Determines implementation sequence.

---

### Q9: Campaign State Synchronization

**Question**: How do we keep Strategis and Facebook campaigns in sync?

**What We Need**:
- [ ] How to link Strategis campaign to Facebook campaign? (Store IDs in properties?)
- [ ] How to handle state changes? (Pause/resume, budget changes)
- [ ] Does Strategis poll Facebook for state, or do we push updates?
- [ ] What happens if Facebook campaign is deleted? (Does Strategis know?)
- [ ] How to handle name changes? (Sync bidirectionally?)

**Context**: We need to maintain consistency between systems.

**Impact**: Affects state management and error handling.

---

### Q10: Error Handling & Rollback

**Question**: How do we handle failures in the multi-step setup process?

**What We Need**:
- [ ] If Facebook creation fails, how to rollback Strategis setup?
- [ ] If Strategis setup fails, how to rollback Facebook creation?
- [ ] What's the recommended rollback strategy?
- [ ] Are there any transaction-like guarantees?
- [ ] How to handle partial failures? (Some ad sets succeed, others fail)

**Context**: Multi-step process requires robust error handling.

**Impact**: Determines saga/rollback implementation.

---

## 🟡 HIGH: Data & Configuration Requirements

### Q11: Required Configuration Data

**Question**: What configuration data does Strategis need that we might not have in Liftoff?

**What We Need**:
- [ ] Template IDs — how to get list of available templates?
- [ ] Category values — what categories are valid?
- [ ] Organization names — what organizations exist?
- [ ] Destination values — what destinations are valid? (e.g., "S1")
- [ ] Network account mappings — how to map Facebook ad accounts?
- [ ] Any other required configuration we need to provide

**Context**: We need to know what data to collect/configure before calling APIs.

**Impact**: Determines data requirements and validation.

---

### Q12: Idempotency & Deduplication

**Question**: How do we prevent duplicate campaigns if requests are retried?

**What We Need**:
- [ ] Does Strategis support idempotency keys?
- [ ] How to check if campaign already exists? (Query by name? Query by properties?)
- [ ] What's the recommended deduplication strategy?
- [ ] Should we implement idempotency in Liftoff or Strategis?

**Context**: Network failures and retries could create duplicates.

**Impact**: Affects reliability and error handling.

---

## 🟢 MEDIUM: Advanced Features

### Q13: Campaign Updates & Modifications

**Question**: How do we update campaigns after creation?

**What We Need**:
- [ ] How to update campaign names? (Strategis and Facebook)
- [ ] How to update budgets? (Via Strategis or Facebook directly?)
- [ ] How to pause/resume campaigns?
- [ ] How to add/remove ad sets?
- [ ] How to update targeting?

**Context**: Campaigns need ongoing management.

**Impact**: Affects post-creation management features.

---

### Q14: Performance Data & Reporting

**Question**: How do we get performance data from Strategis?

**What We Need**:
- [ ] API endpoints for performance data
- [ ] How performance data relates to Facebook campaigns
- [ ] What metrics are available?
- [ ] How to query performance by Strategis campaign ID or Facebook campaign ID?

**Context**: We need to track campaign performance.

**Impact**: Affects reporting and optimization features.

---

### Q15: Testing & Sandbox Support

**Question**: How do we test the integration without affecting production?

**What We Need**:
- [ ] Is there a Strategis sandbox/test environment?
- [ ] How to use Facebook sandbox accounts via Strategis?
- [ ] Are there test templates we can use?
- [ ] How to validate setup without creating real campaigns?

**Context**: We need to test before production deployment.

**Impact**: Affects testing strategy.

---

## Summary: Critical Path Questions

### Must Answer Before Implementation (🔴 CRITICAL)

1. **Q1-Q3**: Facebook API relay architecture (how to tunnel through Strategis)
2. **Q4-Q7**: Strategis setup requirements (templates, tracking, assets)
3. **Q8**: Complete flow (step-by-step process)
4. **Q9-Q10**: State sync and error handling

### Should Answer Soon (🟡 HIGH)

5. **Q11-Q12**: Configuration data and idempotency
6. **Q13-Q14**: Updates and reporting (for Phase 2)

### Nice to Have (🟢 MEDIUM)

7. **Q15**: Testing support

---

## Proposed Integration Architecture (Based on Current Understanding)

```
Liftoff Attention Engine
    ↓ (generates campaign plan + naming + creatives)
    ↓
Liftoff Campaign Factory
    ├─→ Step 1: Configure Strategis
    │     ├─→ Select/configure template
    │     ├─→ Setup tracking (pixels, events, UTMs)
    │     └─→ Configure other requirements
    │
    ├─→ Step 2: Create Strategis Campaign
    │     └─→ POST /api/campaigns (confirmed)
    │
    ├─→ Step 3: Create Facebook Campaign (via Strategis relay)
    │     └─→ POST /api/strategis/facebook/campaigns? (NEEDS CONFIRMATION)
    │
    ├─→ Step 4: Create Facebook Ad Sets (via Strategis relay)
    │     └─→ POST /api/strategis/facebook/adsets? (NEEDS CONFIRMATION)
    │
    ├─→ Step 5: Create Facebook Ads (via Strategis relay)
    │     └─→ POST /api/strategis/facebook/ads? (NEEDS CONFIRMATION)
    │
    └─→ Step 6: Link & Activate
          ├─→ Update Strategis campaign with Facebook IDs
          └─→ Activate campaigns (if needed)
```

**Questions for Devin**: 
- Does this flow match reality?
- What endpoints exist vs need to be built?
- What's the actual API contract?

---

## Next Steps

1. **Schedule follow-up session with Devin** to answer these questions
2. **Prioritize questions** — start with 🔴 CRITICAL
3. **Document answers** in `strategis-facebook-campaign-setup-answers.md`
4. **Update implementation guide** based on answers
5. **Design API contracts** for any endpoints that need to be built
6. **Plan collaboration** with Strategis engineers for relay implementation

---

## References

- **Initial Answers**: `docs/prd/strategis-facebook-campaign-setup-answers.md`
- **Implementation Guide**: `docs/prd/strategis-campaign-setup-implementation-guide.md`
- **Exploration Document**: `docs/prd/strategis-campaign-setup-exploration.md`

