# Strategis Campaign Setup — Critical Path Questions Summary

## Document Purpose
This document summarizes the **critical path questions** that must be answered before implementation, based on the new understanding that:
1. Liftoff must tunnel through Strategis Facebook API (not registered with Facebook)
2. Strategis requires significant setup (templates, tracking, etc.)
3. Strategis may need to build Facebook API relay endpoints

**Status**: 🔴 CRITICAL — Blocks Implementation  
**Version**: 1.0 (2025-01-XX)

---

## Architecture Decision Required

### 🔴 CRITICAL: Decision Point

**Question**: Can Liftoff register its own Facebook app, or must all Facebook API calls go through Strategis?

### Option A: Strategis Relay (If Business Requirement)
```
Liftoff → Strategis (setup) → Strategis Facebook API Relay → Facebook
```
**Timeline**: Months | **Effort**: High | **Requires**: Build relay endpoints

### Option B: Direct to Meta (If Possible)
```
Liftoff → Meta Ads API (direct) + Strategis API (tracking)
```
**Timeline**: Days/weeks | **Effort**: Low | **Requires**: Facebook app registration

**See**: `strategis-facebook-api-architecture-decision.md` for complete decision framework.

---

## 🔴 CRITICAL Path Questions (Must Answer First)

### 0. Architecture Decision (MUST ANSWER FIRST)

**Question**: Can Liftoff register its own Facebook app, or must all Facebook API calls go through Strategis?

**Current Strategis Facebook API Status**:
- ✅ EXISTS: `GET /api/facebook/campaigns`, `PUT /api/facebook/campaigns/:id/budget`, `PUT /api/facebook/campaigns/:id/status`, etc.
- ❌ DOES NOT EXIST: `POST /api/facebook/campaigns`, `POST /api/facebook/adsets`, `POST /api/facebook/ads`

**Impact**: Determines entire integration architecture. **BLOCKS ALL IMPLEMENTATION**.

**Document**: See `strategis-facebook-api-architecture-decision.md` for complete decision framework.

### 1. Facebook API Relay Architecture (If Option A)

**Questions** (Only if building Strategis relay):
- What endpoints need to be built? (Create campaign, ad set, ad, creative)
- How does authentication work? (Strategis manages Facebook tokens per organization)
- What's the API contract? (Meta Ads API format recommended for consistency)
- Timeline for building endpoints?

**Impact**: Required if Option A chosen. **BLOCKS IMPLEMENTATION IF OPTION A**.

**Document**: See Q1-Q3 in `strategis-campaign-setup-additional-questions.md`

---

### 2. Strategis Setup Requirements

**Questions**:
- What's the complete setup checklist? (Templates, tracking, audiences, etc.)
- How to configure templates programmatically?
- How to configure tracking (pixels, events, UTMs) via API?
- How to handle assets/creatives?

**Impact**: Required for campaign setup automation. **BLOCKS CAMPAIGN CREATION**.

**Document**: See Q4-Q7 in `strategis-campaign-setup-additional-questions.md`

---

### 3. Complete Integration Flow

**Questions**:
- Step-by-step flow: Strategis setup → Strategis campaign → Facebook creation?
- How to link Strategis campaign to Facebook campaign?
- How to handle state synchronization?
- What's the rollback strategy?

**Impact**: Determines implementation sequence. **BLOCKS IMPLEMENTATION DESIGN**.

**Document**: See Q8-Q10 in `strategis-campaign-setup-additional-questions.md`

---

## 🟡 HIGH Priority Questions (Answer Soon)

### 4. Configuration Data Requirements

**Questions**:
- What template IDs are available?
- What categories/organizations/destinations are valid?
- How to get configuration data (list templates, etc.)?

**Impact**: Required for API calls. **BLOCKS API IMPLEMENTATION**.

**Document**: See Q11-Q12 in `strategis-campaign-setup-additional-questions.md`

---

## Proposed Flow (Needs Confirmation)

```
1. Configure Strategis
   ├─→ Select/configure template (API?)
   ├─→ Setup tracking (pixels, events, UTMs) (API?)
   └─→ Configure other requirements (API?)

2. Create Strategis Campaign
   └─→ POST /api/campaigns ✅ (confirmed)

3. Create Facebook Campaign (via Strategis relay)
   └─→ POST /api/strategis/facebook/campaigns? ❓ (NEEDS CONFIRMATION)

4. Create Facebook Ad Sets (via Strategis relay)
   └─→ POST /api/strategis/facebook/adsets? ❓ (NEEDS CONFIRMATION)

5. Create Facebook Ads (via Strategis relay)
   └─→ POST /api/strategis/facebook/ads? ❓ (NEEDS CONFIRMATION)

6. Link & Activate
   ├─→ Update Strategis campaign with Facebook IDs
   └─→ Activate campaigns (if needed)
```

**Questions for Devin**:
- Does this flow match reality?
- What endpoints exist vs need to be built?
- What's the actual API contract?

---

## Next Steps

1. **Schedule follow-up session with Devin** — Answer 🔴 CRITICAL questions first
2. **Prioritize implementation** — Based on what exists vs needs building
3. **Plan collaboration** — Work with Strategis engineers to build relay endpoints if needed
4. **Update documentation** — Document answers and update implementation guide

---

## References

- **Additional Questions**: `docs/prd/strategis-campaign-setup-additional-questions.md` (15 detailed questions)
- **Previous Answers**: `docs/prd/strategis-facebook-campaign-setup-answers.md`
- **Implementation Guide**: `docs/prd/strategis-campaign-setup-implementation-guide.md` (needs update after answers)
- **Exploration**: `docs/prd/strategis-campaign-setup-exploration.md`

