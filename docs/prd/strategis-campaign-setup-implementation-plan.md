# Strategis Campaign Setup — Complete Implementation Plan

## Document Purpose
Complete step-by-step implementation plan for setting up Strategis campaign integration, including what needs to be built on both Liftoff and Strategis sides.

**Status**: 🔴 IMPLEMENTATION PLAN  
**Version**: 1.0 (2025-01-XX)

---

## Overview

This integration requires work on **both sides**:
1. **Liftoff**: Build campaign factory service, database schema, API clients
2. **Strategis**: Build Facebook API relay endpoints, request indexing (optional)

**Timeline**: 
- Strategis relay endpoints: 1-2 days (MVP) or 3-5 days (production-ready)
- Liftoff implementation: 1-2 weeks

---

## Part 1: Strategis Engineering Tasks

### 🔴 CRITICAL: Facebook API Relay Endpoints

**Timeline**: 1-2 days (MVP) or 3-5 days (production-ready)

#### Required Endpoints

1. **`POST /api/facebook/campaigns/create`**
   - Create Facebook campaign
   - Support idempotency via `clientRequestKey`
   - Pass through Facebook API errors

2. **`POST /api/facebook/adsets/create`**
   - Create Facebook ad set
   - Support idempotency
   - Handle targeting, optimization, budget

3. **`POST /api/facebook/adcreatives/create`**
   - Create Facebook creative
   - Support link and video creatives (MVP)
   - Support all creative types (production)

4. **`POST /api/facebook/ads/create`**
   - Create Facebook ad
   - Link creative to ad set
   - Support idempotency

#### Implementation Details

**File**: `strategis-api/lib/api/facebook.js`

**Pattern**: Follow existing update endpoint patterns

**Key Features**:
- Use existing `organizationUsers.getOrgFacebookCredentials()`
- Implement idempotency cache (in-memory for MVP, Redis for production)
- Pass through Facebook API errors
- Return Facebook API responses

**See**: `strategis-relay-endpoints-spec.md` for complete specifications

---

### 🟡 OPTIONAL: Request Indexing System

**Timeline**: 2-4 days (if needed)

**Purpose**: Track campaign creation requests from Liftoff

**What to Build**:
- Database table for campaign requests
- API endpoints: `GET /api/campaign-requests`, `PUT /api/campaign-requests/:id/status`
- Index by requestId, organization, status

**Priority**: Can be added later if needed

---

## Part 2: Liftoff Engineering Tasks

### 🔴 CRITICAL: Database Schema

**Timeline**: 1 day

#### Tables to Create

1. **`campaign_plans`**
   - Store campaign plan data from Attention Engine
   - Fields: requestId, hookSetId, brand, objective, market, etc.
   - Generated names (campaign, ad sets, ads)

2. **`campaign_mappings`**
   - Store ID mappings (Liftoff ↔ Strategis ↔ Facebook)
   - Fields: strategisCampaignIds, facebookCampaignId, facebookAdSetIds, etc.
   - Tracking URLs

3. **`campaign_requests`**
   - Track requests for idempotency
   - Fields: requestId, clientRequestKey, status, step

4. **`campaign_errors`**
   - Store error logs
   - Fields: step, error_type, error_message, error_details

**See**: `strategis-campaign-data-storage.md` for complete SQL schema

---

### 🔴 CRITICAL: Naming Generator Service

**Timeline**: 1 day

**File**: `backend/src/services/namingGenerator.ts`

**Functions**:
- `generateCampaignName()` — Campaign name from inputs
- `generateAdSetName()` — Ad set name from inputs
- `generateAdName()` — Ad name from inputs
- `generateStrategisCampaignName()` — Combined campaign + ad set name

**See**: `strategis-campaign-setup-implementation-guide.md` for code examples

---

### 🔴 CRITICAL: Strategis API Client

**Timeline**: 1 day

**File**: `backend/src/services/strategisClient.ts`

**Functions**:
- `createTemplate()` — Create template
- `createCampaign()` — Create Strategis tracking campaign
- `getCampaign()` — Get campaign by ID

**Endpoints**:
- `POST /api/templates`
- `POST /api/campaigns`
- `GET /api/campaigns/:id`

**See**: `strategis-campaign-setup-implementation-guide.md` for code examples

---

### 🔴 CRITICAL: Strategis Facebook API Relay Client

**Timeline**: 1 day

**File**: `backend/src/services/strategisFacebookClient.ts`

**Functions**:
- `createCampaign()` — Create Facebook campaign via Strategis relay
- `createAdSet()` — Create Facebook ad set via Strategis relay
- `createCreative()` — Create Facebook creative via Strategis relay
- `createAd()` — Create Facebook ad via Strategis relay

**Endpoints** (to be built by Strategis):
- `POST /api/facebook/campaigns/create`
- `POST /api/facebook/adsets/create`
- `POST /api/facebook/adcreatives/create`
- `POST /api/facebook/ads/create`

**See**: `strategis-relay-endpoints-spec.md` for API specifications

---

### 🔴 CRITICAL: Campaign Factory Service

**Timeline**: 2-3 days

**File**: `backend/src/services/campaignFactory.ts`

**Purpose**: Orchestrate campaign creation across all systems

**Functions**:
- `createCampaignWithNaming()` — Complete campaign creation flow
- `createTemplateIfNeeded()` — Create template (idempotent)
- `createFacebookCampaign()` — Create Facebook campaign
- `createFacebookAdSets()` — Create Facebook ad sets
- `createStrategisCampaigns()` — Create Strategis tracking campaigns
- `createFacebookAds()` — Create Facebook ads

**Flow**:
1. Generate names from Attention Engine
2. Create template in Strategis (if needed)
3. Create Facebook campaign (via Strategis relay)
4. Create Facebook ad sets (via Strategis relay)
5. Create Strategis tracking campaigns
6. Create Facebook ads (via Strategis relay)
7. Store all IDs in database

**See**: `strategis-campaign-setup-implementation-guide.md` for code examples

---

### 🟡 HIGH: Saga Pattern for Error Handling

**Timeline**: 1-2 days

**File**: `backend/src/services/campaignFactorySaga.ts`

**Purpose**: Handle failures and rollback

**Features**:
- Track creation steps
- Rollback on failure
- Retry logic
- Error logging

**See**: `strategis-campaign-setup-implementation-guide.md` for saga pattern

---

### 🟡 HIGH: API Routes

**Timeline**: 1 day

**File**: `backend/src/routes/campaignFactory.ts`

**Endpoints**:
- `POST /api/campaign-factory/create` — Create campaign
- `GET /api/campaign-factory/requests/:requestId` — Get request status
- `GET /api/campaign-factory/plans/:planId` — Get campaign plan
- `GET /api/campaign-factory/mappings/:mappingId` — Get ID mappings

---

### 🟢 MEDIUM: Query & Management APIs

**Timeline**: 1-2 days

**Endpoints**:
- `GET /api/campaign-factory/plans` — List campaign plans (with filters)
- `GET /api/campaign-factory/mappings` — List mappings (with filters)
- `GET /api/campaign-factory/by-hook-set/:hookSetId` — Get campaigns by hook set
- `GET /api/campaign-factory/by-facebook/:fbCampaignId` — Get mapping by Facebook ID

---

## Part 3: Configuration & Environment

### Environment Variables

**Liftoff** (`backend/.env`):

```bash
# Strategis API Configuration
STRATEGIS_API_BASE_URL=https://api.strategis.internal
STRATEGIS_API_KEY=your-strategis-api-key

# Database Configuration (if not already set)
DATABASE_URL=postgresql://user:password@localhost:5432/liftoff

# Campaign Factory Configuration
CAMPAIGN_FACTORY_ENABLED=true
CAMPAIGN_FACTORY_DRY_RUN=false
```

**Strategis** (if needed):
- Facebook API credentials (already configured)
- Idempotency cache configuration (Redis or in-memory)

---

### Database Migrations

**Liftoff**: Create migration files for:
1. `campaign_plans` table
2. `campaign_mappings` table
3. `campaign_requests` table
4. `campaign_errors` table
5. Indexes

**See**: `strategis-campaign-data-storage.md` for SQL schema

---

## Part 4: Testing Strategy

### Unit Tests

**Liftoff**:
- [ ] Naming generator functions
- [ ] API client methods (with mocks)
- [ ] Campaign factory logic
- [ ] Saga rollback logic

**Strategis**:
- [ ] Relay endpoint handlers
- [ ] Idempotency logic
- [ ] Error handling

---

### Integration Tests

**Liftoff**:
- [ ] Full campaign creation flow (with sandbox accounts)
- [ ] Error handling and rollback
- [ ] Idempotency (duplicate requests)

**Strategis**:
- [ ] Facebook API relay (with Facebook sandbox)
- [ ] Idempotency cache
- [ ] Error pass-through

---

### Manual Testing

1. **Create test campaign**:
   - Generate campaign plan
   - Create in Strategis
   - Create in Facebook (via Strategis relay)
   - Verify IDs stored correctly

2. **Test idempotency**:
   - Send duplicate request
   - Verify same IDs returned

3. **Test error handling**:
   - Send invalid data
   - Verify rollback works
   - Verify errors logged

---

## Part 5: Implementation Phases

### Phase 1: Foundation (Week 1)

**Liftoff**:
- [ ] Create database schema
- [ ] Implement naming generator
- [ ] Implement Strategis API client
- [ ] Implement Strategis Facebook relay client (basic)

**Strategis**:
- [ ] Build MVP relay endpoints (campaign, ad set, ad, creative)
- [ ] Implement basic idempotency
- [ ] Basic error handling

**Deliverable**: Can create campaigns end-to-end (MVP)

---

### Phase 2: Production Hardening (Week 2)

**Liftoff**:
- [ ] Implement campaign factory service
- [ ] Implement saga pattern for rollback
- [ ] Add API routes
- [ ] Add query APIs
- [ ] Comprehensive error handling

**Strategis**:
- [ ] Redis-based idempotency (if needed)
- [ ] Enhanced error handling
- [ ] Rate limiting
- [ ] Monitoring/logging

**Deliverable**: Production-ready implementation

---

### Phase 3: Testing & Rollout (Week 3)

**Both**:
- [ ] Integration testing
- [ ] End-to-end testing with real accounts
- [ ] Performance testing
- [ ] Documentation
- [ ] Rollout to production

**Deliverable**: Production deployment

---

## Part 6: Dependencies & Prerequisites

### Liftoff Prerequisites

- [ ] PostgreSQL database (for campaign data storage)
- [ ] Database migration system (if not already set up)
- [ ] Strategis API access (API key)
- [ ] Strategis base URL (for API calls)
- [ ] Facebook sandbox account (for testing)

### Strategis Prerequisites

- [ ] Facebook API credentials (already configured)
- [ ] Idempotency cache (Redis or in-memory)
- [ ] Facebook sandbox account (for testing)
- [ ] API endpoint routing (add new endpoints)

### Shared Prerequisites

- [ ] Network access between Liftoff and Strategis
- [ ] Authentication mechanism (API keys, etc.)
- [ ] Testing environment (sandbox accounts)

---

## Part 7: Step-by-Step Setup Checklist

### For Strategis Engineers

#### Day 1: MVP Endpoints

- [ ] Review `strategis-relay-endpoints-spec.md`
- [ ] Set up Facebook API client (if not exists)
- [ ] Implement `POST /api/facebook/campaigns/create`
- [ ] Implement `POST /api/facebook/adsets/create`
- [ ] Implement `POST /api/facebook/ads/create`
- [ ] Implement basic idempotency (in-memory cache)
- [ ] Test with Facebook sandbox account

#### Day 2: Creative Endpoint & Testing

- [ ] Implement `POST /api/facebook/adcreatives/create`
- [ ] Enhance error handling
- [ ] Add request validation
- [ ] Integration testing
- [ ] Document API contracts

---

### For Liftoff Engineers

#### Week 1: Foundation

**Day 1-2: Database & Naming**
- [ ] Create database migration for campaign tables
- [ ] Implement naming generator service
- [ ] Write unit tests

**Day 3-4: API Clients**
- [ ] Implement Strategis API client
- [ ] Implement Strategis Facebook relay client
- [ ] Write unit tests (with mocks)

**Day 5: Campaign Factory (Basic)**
- [ ] Implement basic campaign factory
- [ ] Test with Strategis sandbox

#### Week 2: Production Features

**Day 1-2: Campaign Factory (Complete)**
- [ ] Implement full campaign creation flow
- [ ] Implement saga pattern for rollback
- [ ] Add error handling

**Day 3: API Routes**
- [ ] Create API routes
- [ ] Add request validation
- [ ] Add authentication middleware

**Day 4-5: Testing & Documentation**
- [ ] Integration testing
- [ ] End-to-end testing
- [ ] Update documentation

---

## Part 8: Configuration Data Needed

### From Strategis

**Liftoff needs to know**:
- [ ] List of available templates (or how to create them)
- [ ] Valid category values
- [ ] Valid organization names
- [ ] Valid destination values ("S1", "Lincx", etc.)
- [ ] Facebook ad account mappings (organization → ad accounts)

**APIs Needed** (or documentation):
- `GET /api/templates?organization=Interlincx`
- `GET /api/categories`
- `GET /api/organizations`
- `GET /api/destinations`
- `GET /api/organizations/:org/facebook-accounts`

---

## Part 9: Questions to Answer Before Implementation

### 🔴 CRITICAL

1. **Routing & Article Selection** (see `strategis-routing-questions.md`):
   - How does Strategis determine final destination URL?
   - Is `properties.article` required or optional?
   - How are template variables resolved?

2. **Configuration Data**:
   - How to get list of templates?
   - What categories are valid?
   - What destinations are valid?

3. **Testing**:
   - Do we have Facebook sandbox accounts?
   - Do we have Strategis test environment?
   - How to test end-to-end?

### 🟡 HIGH

4. **Idempotency**:
   - Should Liftoff check database before calling Strategis?
   - Or rely on Strategis idempotency only?

5. **Error Handling**:
   - What's the rollback strategy?
   - How to handle partial failures?

---

## Part 10: Quick Start Guide

### For Strategis Engineers

1. **Review Specifications**:
   - Read `strategis-relay-endpoints-spec.md`
   - Review existing Facebook API code patterns

2. **Build MVP Endpoints**:
   - Start with campaign creation endpoint
   - Add ad set, ad, creative endpoints
   - Implement basic idempotency

3. **Test**:
   - Test with Facebook sandbox account
   - Verify idempotency works
   - Verify errors pass through correctly

4. **Deploy**:
   - Deploy to staging
   - Share API documentation with Liftoff
   - Coordinate testing

---

### For Liftoff Engineers

1. **Set Up Database**:
   - Create migration files
   - Run migrations
   - Verify tables created

2. **Implement Services**:
   - Naming generator
   - Strategis API client
   - Strategis Facebook relay client
   - Campaign factory

3. **Test**:
   - Unit tests for all services
   - Integration tests with Strategis staging
   - End-to-end test with sandbox accounts

4. **Deploy**:
   - Deploy to staging
   - Test with real campaign plans
   - Monitor and iterate

---

## Part 11: Success Criteria

### MVP Success Criteria

- [ ] Can create Facebook campaign via Strategis relay
- [ ] Can create Facebook ad sets via Strategis relay
- [ ] Can create Facebook ads via Strategis relay
- [ ] Can create Strategis tracking campaigns
- [ ] All IDs stored in Liftoff database
- [ ] Idempotency works (duplicate requests return same IDs)
- [ ] Basic error handling works

### Production Success Criteria

- [ ] All MVP criteria met
- [ ] Rollback works on failures
- [ ] Comprehensive error logging
- [ ] Monitoring and alerts
- [ ] Documentation complete
- [ ] Performance acceptable (< 5 min for full campaign creation)
- [ ] Reliability > 99% success rate

---

## Part 12: Rollout Plan

### Phase 1: Staging (Week 1-2)

- [ ] Deploy Strategis relay endpoints to staging
- [ ] Deploy Liftoff campaign factory to staging
- [ ] Test with sandbox accounts
- [ ] Fix issues and iterate

### Phase 2: Limited Production (Week 3)

- [ ] Deploy to production (feature flag)
- [ ] Test with 1-2 real campaigns
- [ ] Monitor closely
- [ ] Gather feedback

### Phase 3: Full Rollout (Week 4+)

- [ ] Enable for all campaigns
- [ ] Monitor performance
- [ ] Optimize as needed

---

## Summary: What Needs to Be Built

### Strategis (1-2 days MVP, 3-5 days production)

- [ ] `POST /api/facebook/campaigns/create`
- [ ] `POST /api/facebook/adsets/create`
- [ ] `POST /api/facebook/adcreatives/create`
- [ ] `POST /api/facebook/ads/create`
- [ ] Idempotency support
- [ ] Error handling

### Liftoff (1-2 weeks)

- [ ] Database schema (campaign_plans, campaign_mappings, etc.)
- [ ] Naming generator service
- [ ] Strategis API client
- [ ] Strategis Facebook relay client
- [ ] Campaign factory service
- [ ] Saga pattern for rollback
- [ ] API routes
- [ ] Query APIs
- [ ] Testing

---

## Next Steps

1. **Answer Routing Questions**: See `strategis-routing-questions.md`
2. **Schedule Kickoff Meeting**: Align on timeline and responsibilities
3. **Set Up Environments**: Staging environments for both sides
4. **Start Implementation**: Begin with MVP endpoints and database schema
5. **Test & Iterate**: Test early and often

---

## References

- **Complete Requirements**: `strategis-campaign-setup-requirements.md`
- **Relay Endpoints Spec**: `strategis-relay-endpoints-spec.md`
- **Data Storage**: `strategis-campaign-data-storage.md`
- **Implementation Guide**: `strategis-campaign-setup-implementation-guide.md`
- **Routing Questions**: `strategis-routing-questions.md`
- **Engineering Checklist**: `strategis-engineering-checklist.md`

