# Liftoff Current State — Clarification

## What's Built vs. What's Missing

### ✅ BUILT (Campaign Factory)

1. **Database Schema** ✅
   - `campaign_plans` table
   - `campaign_mappings` table
   - `campaign_requests` table
   - `campaign_errors` table

2. **Naming Generator** ✅
   - `generateCampaignName()` — Generates campaign names from inputs
   - `generateAdSetName()` — Generates ad set names
   - `generateAdName()` — Generates ad names
   - `generateStrategisCampaignName()` — Combined names for Strategis

3. **Strategis API Clients** ✅
   - `strategisClient.ts` — Templates and campaigns
   - `strategisFacebookClient.ts` — Facebook relay (ready, waiting for Strategis endpoints)

4. **Campaign Factory Service** ✅
   - `campaignFactory.ts` — Orchestrates campaign creation
   - Stores all IDs in database
   - Error logging

5. **API Routes** ✅
   - `POST /api/campaign-factory/create` — Create campaign
   - `GET /api/campaign-factory/requests/:requestId` — Get status
   - `GET /api/campaign-factory/plans` — List plans

**Status**: ✅ **COMPLETE** — Ready to use once Strategis endpoints are built

---

### ✅ NOW BUILT (Opportunity Queue)

**Status**: ✅ **BUILT** — Just created

**What Was Built**:
- ✅ `005_create_opportunities.sql` — Opportunities table migration
- ✅ `006_create_campaign_blueprints.sql` — Blueprints table migration
- ✅ `opportunityQueue.ts` — Opportunity queue service
- ✅ `opportunityQueue.ts` routes — API endpoints for opportunities and blueprints

**What Still Exists**:
- ✅ `score_opportunities.ts` — Scores and ranks opportunities (outputs CSV)
- ✅ `generate_blueprint.ts` — Generates blueprints (outputs JSON)

**What's Still Missing**:
- ❌ Integration script: CSV → Database (import scored opportunities)
- ❌ Integration: Opportunity → Blueprint → Campaign Factory (automated flow)

**Impact**: 
- Opportunities are scored but stored as CSV files, not in database
- No way to query/manage opportunities programmatically
- No automated flow from opportunities → campaigns

---

## Campaign Naming Flow

### How Campaigns Are Named When Opportunities Are Processed

**Current Flow** (when using Campaign Factory):

1. **Opportunity → Blueprint** (manual or script):
   - Opportunity data includes: angle, category, keywords, etc.
   - Blueprint generator creates campaign plan

2. **Blueprint → Campaign Plan**:
   ```typescript
   {
     brand: "BrandX",
     objective: "CONVERSIONS",
     hookSetId: "hookset_juvederm_2025_10_21", // Generated from opportunity
     market: "US",
     channel: "FB",
     date: "2025-10-22",
     // ... other fields
   }
   ```

3. **Campaign Factory → Names**:
   ```typescript
   // Uses namingGenerator service
   const campaignName = generateCampaignName({
     brand: plan.brand,
     objective: plan.objective,
     hookSetId: plan.hookSetId, // From opportunity/blueprint
     market: plan.market,
     channel: plan.channel,
     date: plan.date,
   });
   // Result: "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22"
   ```

**Naming is Built** ✅ — The naming generator service handles this automatically.

---

## What Needs to Be Built: Opportunity Queue

### Missing Components

1. **Database Tables**:
   - `opportunities` table (store scored opportunities)
   - `campaign_blueprints` table (store blueprints)

2. **Opportunity Queue Service**:
   - `opportunityQueue.ts` — Manage opportunity lifecycle
   - Methods: `addOpportunity()`, `getPending()`, `updateStatus()`, etc.

3. **Integration Service**:
   - `opportunityToCampaign.ts` — Convert opportunity → blueprint → campaign plan → campaign factory

4. **API Routes**:
   - `POST /api/opportunities/score` — Score opportunities from System1
   - `GET /api/opportunities` — List opportunities (with filters)
   - `POST /api/opportunities/:id/generate-blueprint` — Generate blueprint
   - `POST /api/opportunities/:id/launch` — Launch campaign from opportunity

---

## Current State Summary

### ✅ Ready to Use (Once Strategis Endpoints Exist)

- Campaign Factory can create campaigns with proper naming
- All IDs stored in database
- Error handling and logging

### ❌ Not Built (Blocks Full Automation)

- Opportunity Queue (database + service)
- Integration: Opportunity → Blueprint → Campaign Factory
- Automated workflow orchestration

---

## Recommendation

**Option 1: Build Opportunity Queue Now** (Recommended)
- Create `opportunities` and `campaign_blueprints` tables
- Build opportunity queue service
- Integrate with campaign factory
- **Timeline**: 1-2 days

**Option 2: Use Campaign Factory Manually**
- Manually create campaign plans from CSV outputs
- Call Campaign Factory API directly
- **Timeline**: Can use now (once Strategis endpoints exist)

---

## Next Steps

1. **Immediate**: Wait for Strategis relay endpoints (blocker)
2. **Short Term**: Build Opportunity Queue (1-2 days)
3. **Medium Term**: Build integration service (1 day)
4. **Long Term**: Full automation orchestration (1 week)

