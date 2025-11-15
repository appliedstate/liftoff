# Strategis Campaign Setup — Quick Start Checklist

## Document Purpose
Quick reference checklist for setting up Strategis campaign integration. Use this to track progress and ensure nothing is missed.

**Status**: ✅ CHECKLIST — Ready to Use  
**Version**: 1.0 (2025-01-XX)

---

## 🔴 CRITICAL: Prerequisites

### Questions to Answer First

- [ ] **Routing**: How does Strategis determine final destination URL? (See `strategis-routing-questions.md`)
- [ ] **Article**: Is `properties.article` required or optional?
- [ ] **Configuration**: How to get list of templates, categories, organizations, destinations?

### Environment Setup

**Liftoff**:
- [ ] PostgreSQL database available
- [ ] Database migration system set up
- [ ] Strategis API base URL and API key
- [ ] Facebook sandbox account for testing

**Strategis**:
- [ ] Facebook API credentials configured
- [ ] Idempotency cache (Redis or in-memory)
- [ ] Facebook sandbox account for testing
- [ ] Staging environment for testing

---

## Part 1: Strategis Engineering (1-2 days MVP)

### Day 1: Core Endpoints

- [ ] Review `strategis-relay-endpoints-spec.md`
- [ ] Implement `POST /api/facebook/campaigns/create`
- [ ] Implement `POST /api/facebook/adsets/create`
- [ ] Implement `POST /api/facebook/ads/create`
- [ ] Implement basic idempotency (in-memory cache)
- [ ] Test with Facebook sandbox account

### Day 2: Creative & Polish

- [ ] Implement `POST /api/facebook/adcreatives/create`
- [ ] Enhance error handling
- [ ] Add request validation
- [ ] Integration testing
- [ ] Document API contracts
- [ ] Deploy to staging

---

## Part 2: Liftoff Engineering (1-2 weeks)

### Week 1: Foundation

#### Database Setup (Day 1)

- [ ] Create migration: `campaign_plans` table
- [ ] Create migration: `campaign_mappings` table
- [ ] Create migration: `campaign_requests` table
- [ ] Create migration: `campaign_errors` table
- [ ] Create indexes
- [ ] Run migrations
- [ ] Verify tables created

#### Naming Generator (Day 1-2)

- [ ] Create `backend/src/services/namingGenerator.ts`
- [ ] Implement `generateCampaignName()`
- [ ] Implement `generateAdSetName()`
- [ ] Implement `generateAdName()`
- [ ] Implement `generateStrategisCampaignName()`
- [ ] Write unit tests

#### API Clients (Day 2-3)

- [ ] Create `backend/src/services/strategisClient.ts`
- [ ] Implement `createTemplate()`
- [ ] Implement `createCampaign()`
- [ ] Implement `getCampaign()`
- [ ] Create `backend/src/services/strategisFacebookClient.ts`
- [ ] Implement `createCampaign()` (Facebook via Strategis)
- [ ] Implement `createAdSet()` (Facebook via Strategis)
- [ ] Implement `createCreative()` (Facebook via Strategis)
- [ ] Implement `createAd()` (Facebook via Strategis)
- [ ] Write unit tests (with mocks)

#### Campaign Factory (Day 4-5)

- [ ] Create `backend/src/services/campaignFactory.ts`
- [ ] Implement `createCampaignWithNaming()`
- [ ] Implement template creation logic
- [ ] Implement Facebook campaign creation
- [ ] Implement Facebook ad set creation
- [ ] Implement Strategis campaign creation
- [ ] Implement Facebook ad creation
- [ ] Implement ID storage in database
- [ ] Write unit tests

### Week 2: Production Features

#### Error Handling (Day 1-2)

- [ ] Create `backend/src/services/campaignFactorySaga.ts`
- [ ] Implement saga pattern
- [ ] Implement rollback logic
- [ ] Implement error logging
- [ ] Write unit tests

#### API Routes (Day 2-3)

- [ ] Create `backend/src/routes/campaignFactory.ts`
- [ ] Implement `POST /api/campaign-factory/create`
- [ ] Implement `GET /api/campaign-factory/requests/:requestId`
- [ ] Implement `GET /api/campaign-factory/plans/:planId`
- [ ] Implement `GET /api/campaign-factory/mappings/:mappingId`
- [ ] Add request validation
- [ ] Add authentication middleware

#### Query APIs (Day 3-4)

- [ ] Implement `GET /api/campaign-factory/plans` (with filters)
- [ ] Implement `GET /api/campaign-factory/mappings` (with filters)
- [ ] Implement `GET /api/campaign-factory/by-hook-set/:hookSetId`
- [ ] Implement `GET /api/campaign-factory/by-facebook/:fbCampaignId`

#### Testing & Documentation (Day 4-5)

- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Update documentation
- [ ] Code review

---

## Part 3: Configuration

### Environment Variables

**Liftoff** (`backend/.env`):
- [ ] `STRATEGIS_API_BASE_URL`
- [ ] `STRATEGIS_API_KEY`
- [ ] `DATABASE_URL` (if not already set)
- [ ] `CAMPAIGN_FACTORY_ENABLED`
- [ ] `CAMPAIGN_FACTORY_DRY_RUN`

### Configuration Data

**Need from Strategis**:
- [ ] List of available templates
- [ ] Valid category values
- [ ] Valid organization names
- [ ] Valid destination values
- [ ] Facebook ad account mappings

---

## Part 4: Testing

### Unit Tests

**Liftoff**:
- [ ] Naming generator tests
- [ ] Strategis API client tests (mocked)
- [ ] Strategis Facebook client tests (mocked)
- [ ] Campaign factory tests (mocked)
- [ ] Saga rollback tests

**Strategis**:
- [ ] Relay endpoint tests
- [ ] Idempotency tests
- [ ] Error handling tests

### Integration Tests

**Liftoff**:
- [ ] Full campaign creation flow (with Strategis staging)
- [ ] Error handling and rollback
- [ ] Idempotency (duplicate requests)

**Strategis**:
- [ ] Facebook API relay (with Facebook sandbox)
- [ ] Idempotency cache
- [ ] Error pass-through

### Manual Testing

- [ ] Create test campaign end-to-end
- [ ] Verify IDs stored correctly
- [ ] Test idempotency (duplicate request)
- [ ] Test error handling (invalid data)
- [ ] Verify tracking URLs work
- [ ] Verify Facebook campaigns created correctly

---

## Part 5: Deployment

### Staging Deployment

**Strategis**:
- [ ] Deploy relay endpoints to staging
- [ ] Share API documentation with Liftoff
- [ ] Coordinate testing

**Liftoff**:
- [ ] Deploy campaign factory to staging
- [ ] Test with Strategis staging
- [ ] Fix issues and iterate

### Production Deployment

**Phase 1: Limited**:
- [ ] Deploy with feature flag
- [ ] Test with 1-2 real campaigns
- [ ] Monitor closely

**Phase 2: Full Rollout**:
- [ ] Enable for all campaigns
- [ ] Monitor performance
- [ ] Optimize as needed

---

## Quick Reference: File Structure

### Liftoff Files to Create

```
backend/src/
├── services/
│   ├── namingGenerator.ts          # Generate names
│   ├── strategisClient.ts          # Strategis API client
│   ├── strategisFacebookClient.ts  # Strategis Facebook relay client
│   ├── campaignFactory.ts          # Main orchestration
│   └── campaignFactorySaga.ts      # Error handling/rollback
├── routes/
│   └── campaignFactory.ts           # API routes
└── migrations/
    ├── 001_create_campaign_plans.sql
    ├── 002_create_campaign_mappings.sql
    ├── 003_create_campaign_requests.sql
    └── 004_create_campaign_errors.sql
```

### Strategis Files to Modify/Create

```
strategis-api/lib/api/
└── facebook.js                      # Add create endpoints

strategis-api/lib/services/
└── facebook.js                      # May need updates
```

---

## Success Criteria

### MVP (Week 1-2)

- [ ] Can create Facebook campaign via Strategis relay
- [ ] Can create Facebook ad sets via Strategis relay
- [ ] Can create Facebook ads via Strategis relay
- [ ] Can create Strategis tracking campaigns
- [ ] All IDs stored in Liftoff database
- [ ] Idempotency works
- [ ] Basic error handling works

### Production (Week 3-4)

- [ ] All MVP criteria met
- [ ] Rollback works on failures
- [ ] Comprehensive error logging
- [ ] Monitoring and alerts
- [ ] Documentation complete
- [ ] Performance acceptable (< 5 min)
- [ ] Reliability > 99%

---

## Timeline Summary

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Strategis MVP** | 1-2 days | Build 4 relay endpoints, idempotency, basic error handling |
| **Liftoff Foundation** | 1 week | Database, naming, API clients, basic campaign factory |
| **Liftoff Production** | 1 week | Saga pattern, API routes, query APIs, testing |
| **Testing & Rollout** | 1 week | Integration testing, staging, limited production, full rollout |

**Total Timeline**: 3-4 weeks

---

## Next Steps

1. **Answer Routing Questions** (see `strategis-routing-questions.md`)
2. **Schedule Kickoff Meeting** with Strategis engineers
3. **Set Up Environments** (staging for both sides)
4. **Start Implementation** (begin with MVP endpoints and database)
5. **Test Early** (test with sandbox accounts as soon as possible)

---

## References

- **Implementation Plan**: `strategis-campaign-setup-implementation-plan.md`
- **Relay Endpoints Spec**: `strategis-relay-endpoints-spec.md`
- **Data Storage**: `strategis-campaign-data-storage.md`
- **Implementation Guide**: `strategis-campaign-setup-implementation-guide.md`
- **Routing Questions**: `strategis-routing-questions.md`

