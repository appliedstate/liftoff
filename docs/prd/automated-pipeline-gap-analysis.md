# Fully Automated Pipeline — Gap Analysis

## Document Purpose
Comprehensive analysis of current state vs. desired fully automated pipeline, identifying gaps and what needs to be built.

**Status**: 🔴 GAP ANALYSIS  
**Version**: 1.0 (2025-01-XX)

---

## Desired End-to-End Flow

```
System1 CSV Export + Meta Ad Library
    ↓
Opportunity Engine (scoring & ranking)
    ↓
Campaign Blueprints (per opportunity)
    ↓
Creative Factory (iterated creatives)
    ↓
Article Factory (pages + headlines)
    ↓
Campaign Launcher (creates campaigns per lane)
    ↓
Campaign Launch (fully automated)
```

---

## Current State Assessment

### ✅ BUILT / EXISTS

#### 1. Input Sources
- ✅ **System1 CSV Export**: Scripts exist (`analyzeSystem1.ts`, `s1Intake.ts`)
- ✅ **System1 Normalization**: Parquet files, clustering
- ✅ **Meta Ad Library**: Discovery service exists (documented in PRD)

#### 2. Opportunity Scoring
- ✅ **Opportunity Scoring Script**: `backend/src/scripts/system1/score_opportunities.ts`
  - Scores clusters as opportunities
  - Calculates ΔCM with confidence intervals
  - Ranks by ΔCM/slot and ΔCM/$
  - Outputs: `opportunities_ranked_by_slot.csv`, `opportunities_ranked_by_budget.csv`

#### 3. Blueprint Generation
- ✅ **Blueprint Generator Script**: `backend/src/scripts/system1/generate_blueprint.ts`
  - Creates launch-ready plans from scored opportunities
  - Defines lane mix, budgets, creatives
  - Sets KPI targets and test plans

#### 4. Documentation & Architecture
- ✅ **Campaign Factory PRD**: `docs/prd/campaign-factory-from-intel-prd.md`
- ✅ **Creative Factory PRD**: `docs/creative/40-creative-factory.md`
- ✅ **Flow Diagrams**: Complete mermaid diagrams exist
- ✅ **Database Schema**: Defined in PRD

---

### 🟡 PARTIALLY BUILT / IN PROGRESS

#### 1. Strategis Integration
- 🟡 **Status**: Planning complete, implementation not started
- 🟡 **What Exists**:
  - Complete specifications (`strategis-relay-endpoints-spec.md`)
  - Implementation plan (`strategis-campaign-setup-implementation-plan.md`)
  - Routing answers confirmed
- 🟡 **What's Missing**:
  - Strategis relay endpoints (not built yet)
  - Liftoff campaign factory service (not built yet)
  - Database schema (not created yet)

#### 2. Creative Factory
- 🟡 **Status**: PRD exists, automation unclear
- 🟡 **What Exists**:
  - Creative factory PRD with process
  - Hook ideation agent (Elon) exists
  - Naming conventions defined
- 🟡 **What's Missing**:
  - Automated creative batch generation
  - Asset rendering automation
  - QA automation
  - Integration with campaign factory

#### 3. Article Factory
- 🟡 **Status**: Exists but integration unclear
- 🟡 **What Exists**:
  - Article factory PRD (`docs/content/30-article-factory.md`)
  - LPID selection logic documented
- 🟡 **What's Missing**:
  - Automated LPID query/selection
  - Headline generation automation
  - Integration with campaign factory

---

### ❌ NOT BUILT / MISSING

#### 1. Campaign Factory Service
- ❌ **Status**: Not built
- ❌ **What's Missing**:
  - `backend/src/services/campaignFactory.ts` (orchestration service)
  - `backend/src/services/namingGenerator.ts` (naming conventions)
  - `backend/src/services/strategisClient.ts` (Strategis API client)
  - `backend/src/services/strategisFacebookClient.ts` (Facebook relay client)
  - `backend/src/services/campaignFactorySaga.ts` (error handling/rollback)
  - `backend/src/routes/campaignFactory.ts` (API routes)

#### 2. Database Schema
- ❌ **Status**: Not created
- ❌ **What's Missing**:
  - `campaign_plans` table
  - `campaign_mappings` table
  - `campaign_requests` table
  - `campaign_errors` table
  - `campaign_blueprints` table (if not exists)
  - `campaign_launches` table (if not exists)

#### 3. Campaign Launcher
- ❌ **Status**: Documented but not implemented
- ❌ **What's Missing**:
  - `backend/src/services/campaignLauncher.ts`
  - Integration with Strategis relay endpoints
  - Pre-flight checks automation
  - Launch execution automation
  - Freeze period management

#### 4. Orchestration & Automation
- ❌ **Status**: Manual process
- ❌ **What's Missing**:
  - End-to-end orchestration service
  - Automated workflow from opportunities → launch
  - Status tracking and monitoring
  - Error handling and retries

---

## Gap Analysis by Component

### Component 1: Opportunity Engine → Blueprint

**Current State**: ✅ **EXISTS**
- Opportunity scoring script works
- Blueprint generation script works
- Outputs CSV files

**Gap**: 🟡 **INTEGRATION**
- Not integrated into automated pipeline
- Manual execution required
- No database storage (CSV only)
- No API endpoints

**What's Needed**:
- [ ] Convert scripts to services
- [ ] Store opportunities in database
- [ ] Create API endpoints for scoring/generation
- [ ] Automated weekly refresh

---

### Component 2: Blueprint → Creative Factory

**Current State**: 🟡 **PARTIAL**
- Creative factory PRD exists
- Hook ideation agent (Elon) exists
- Process documented

**Gap**: ❌ **AUTOMATION**
- No automated creative batch generation
- No automated asset rendering
- No automated QA
- No integration with blueprints

**What's Needed**:
- [ ] Automated creative batch generator service
- [ ] Integration with hook ideation agent
- [ ] Asset rendering automation (video/image generation)
- [ ] QA automation (naming, compliance, format mix)
- [ ] Database storage for creatives
- [ ] Integration with campaign factory

---

### Component 3: Blueprint → Article Factory

**Current State**: 🟡 **PARTIAL**
- Article factory PRD exists
- LPID selection logic documented

**Gap**: ❌ **AUTOMATION**
- No automated LPID query/selection
- No automated headline generation
- No integration with blueprints

**What's Needed**:
- [ ] Automated LPID query service
- [ ] LPID selection automation (≥3k sessions, vRPS ≥ median)
- [ ] Headline generation automation
- [ ] Integration with campaign factory

---

### Component 4: Blueprint + Creatives + Articles → Campaign Launch

**Current State**: ❌ **NOT BUILT**
- Strategis integration planned but not built
- Campaign launcher documented but not implemented

**Gap**: ❌ **COMPLETE MISSING**
- No campaign factory service
- No Strategis integration
- No campaign launcher
- No automated launch execution

**What's Needed**:
- [ ] **Strategis Relay Endpoints** (Strategis engineering):
  - `POST /api/facebook/campaigns/create`
  - `POST /api/facebook/adsets/create`
  - `POST /api/facebook/adcreatives/create`
  - `POST /api/facebook/ads/create`
- [ ] **Liftoff Campaign Factory**:
  - Database schema
  - Naming generator service
  - Strategis API clients
  - Campaign factory orchestration service
  - Saga pattern for error handling
  - API routes
- [ ] **Campaign Launcher**:
  - Pre-flight checks automation
  - Launch execution service
  - Freeze period management
  - Status tracking

---

## Critical Path to Full Automation

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Build core campaign factory infrastructure

**Tasks**:
1. **Database Schema** (Week 1, Day 1-2):
   - Create `campaign_plans`, `campaign_mappings`, `campaign_requests`, `campaign_errors` tables
   - Create `campaign_blueprints`, `campaign_launches` tables (if not exist)

2. **Naming Generator** (Week 1, Day 2-3):
   - Implement `namingGenerator.ts`
   - Support campaign/ad set/ad naming conventions

3. **Strategis API Clients** (Week 1, Day 3-5):
   - Implement `strategisClient.ts` (templates, campaigns)
   - Implement `strategisFacebookClient.ts` (Facebook relay)

4. **Campaign Factory Service** (Week 2, Day 1-3):
   - Implement `campaignFactory.ts` (orchestration)
   - Integrate naming, Strategis clients
   - Store IDs in database

5. **Error Handling** (Week 2, Day 3-4):
   - Implement `campaignFactorySaga.ts` (rollback)
   - Error logging and retry logic

6. **API Routes** (Week 2, Day 4-5):
   - Create `campaignFactory.ts` routes
   - Request validation and authentication

**Dependencies**:
- Strategis relay endpoints must be built first (1-2 days)

---

### Phase 2: Creative & Article Integration (Weeks 3-4)

**Goal**: Integrate creative and article factories

**Tasks**:
1. **Creative Factory Integration** (Week 3):
   - Automated creative batch generation
   - Integration with hook ideation agent
   - Asset rendering automation
   - QA automation

2. **Article Factory Integration** (Week 3-4):
   - Automated LPID query/selection
   - Headline generation automation
   - Integration with campaign factory

3. **Blueprint Integration** (Week 4):
   - Connect opportunity engine → blueprint → creative → article → launch
   - Status tracking across pipeline

---

### Phase 3: Campaign Launcher (Weeks 5-6)

**Goal**: Build automated campaign launcher

**Tasks**:
1. **Pre-flight Checks** (Week 5, Day 1-2):
   - AEM purchase check
   - Signal health check
   - Creative readiness check
   - LPID check

2. **Launch Execution** (Week 5, Day 3-5):
   - Campaign creation per lane
   - Ad set creation
   - Ad creation
   - Enable all entities

3. **Freeze Period Management** (Week 6, Day 1-2):
   - Freeze period tracking
   - Monitor-only mode
   - Post-freeze validation

4. **Status Tracking** (Week 6, Day 3-5):
   - Launch status tracking
   - Error monitoring
   - Performance monitoring

---

### Phase 4: End-to-End Orchestration (Weeks 7-8)

**Goal**: Full automation from opportunities to launch

**Tasks**:
1. **Orchestration Service** (Week 7):
   - End-to-end workflow orchestration
   - Status tracking across all stages
   - Error handling and retries

2. **Automated Triggers** (Week 7-8):
   - Weekly opportunity refresh
   - Automated blueprint generation
   - Automated creative production
   - Automated launch execution

3. **Monitoring & Alerts** (Week 8):
   - Pipeline health monitoring
   - Error alerts
   - Performance tracking

---

## Summary: What's Built vs. What's Needed

### ✅ What's Built (Current State)

1. **Input Sources**: ✅ System1 CSV processing, Meta Ad Library discovery
2. **Opportunity Scoring**: ✅ Scoring and ranking scripts
3. **Blueprint Generation**: ✅ Blueprint generator script
4. **Documentation**: ✅ Complete PRDs and architecture docs

### ❌ What's Missing (Gaps)

1. **Campaign Factory Service**: ❌ Not built
   - Naming generator
   - Strategis API clients
   - Campaign factory orchestration
   - Error handling (saga pattern)
   - API routes

2. **Database Schema**: ❌ Not created
   - Campaign plans, mappings, requests, errors tables

3. **Strategis Integration**: ❌ Not built
   - Strategis relay endpoints (needs Strategis engineering)
   - Liftoff integration code

4. **Campaign Launcher**: ❌ Not built
   - Pre-flight checks automation
   - Launch execution service
   - Freeze period management

5. **Creative Factory Automation**: ❌ Not automated
   - Batch generation automation
   - Asset rendering automation
   - QA automation

6. **Article Factory Automation**: ❌ Not automated
   - LPID query/selection automation
   - Headline generation automation

7. **End-to-End Orchestration**: ❌ Not built
   - Workflow orchestration service
   - Automated triggers
   - Status tracking

---

## Priority Ranking

### 🔴 CRITICAL (Blocks Launch)

1. **Strategis Relay Endpoints** (Strategis engineering, 1-2 days)
2. **Database Schema** (1 day)
3. **Campaign Factory Service** (1-2 weeks)
4. **Campaign Launcher** (1-2 weeks)

### 🟡 HIGH (Enables Full Automation)

5. **Creative Factory Automation** (1-2 weeks)
6. **Article Factory Automation** (1 week)
7. **End-to-End Orchestration** (1-2 weeks)

### 🟢 MEDIUM (Optimization)

8. **Opportunity Engine API** (convert scripts to services)
9. **Monitoring & Alerts** (1 week)
10. **Performance Optimization** (ongoing)

---

## Estimated Timeline

### Minimum Viable Automation (MVP)

**Timeline**: 4-6 weeks

**Includes**:
- Strategis relay endpoints (1-2 days)
- Database schema (1 day)
- Campaign factory service (1-2 weeks)
- Campaign launcher (1-2 weeks)
- Basic creative/article integration (1 week)

**Result**: Can launch campaigns manually via API, but automated end-to-end

---

### Full Automation

**Timeline**: 8-10 weeks

**Includes**:
- All MVP components
- Creative factory automation (1-2 weeks)
- Article factory automation (1 week)
- End-to-end orchestration (1-2 weeks)
- Monitoring & alerts (1 week)

**Result**: Fully automated pipeline from opportunities to launch

---

## Next Steps

### Immediate (This Week)

1. **Answer**: Do Strategis relay endpoints exist? (Check with Strategis team)
2. **Decision**: Start with MVP or full automation?
3. **Planning**: Schedule kickoff meeting with Strategis engineers

### Short Term (Next 2 Weeks)

1. **Build**: Database schema
2. **Build**: Naming generator service
3. **Build**: Strategis API clients (if relay endpoints exist)
4. **Build**: Basic campaign factory service

### Medium Term (Next 4-6 Weeks)

1. **Build**: Campaign launcher
2. **Integrate**: Creative factory automation
3. **Integrate**: Article factory automation
4. **Build**: End-to-end orchestration

---

## References

- **Campaign Factory PRD**: `docs/prd/campaign-factory-from-intel-prd.md`
- **Strategis Integration**: `docs/prd/strategis-campaign-setup-implementation-plan.md`
- **Creative Factory**: `docs/creative/40-creative-factory.md`
- **Article Factory**: `docs/content/30-article-factory.md`
- **Opportunity Scoring**: `backend/docs/system1-opportunity-scoring.md`

