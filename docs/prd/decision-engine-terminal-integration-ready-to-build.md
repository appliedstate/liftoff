# Decision Engine → Terminal Integration: Ready to Build

## Document Purpose
Quick-start guide for implementing the Decision Engine → Terminal integration based on confirmed answers from Devin.

**Status**: ✅ **READY TO BUILD** - All questions answered, code structure provided  
**Date**: 2025-01-XX

---

## ✅ What's Been Built (Liftoff Side)

### 1. Terminal HTTP Client ✅
**File**: `backend/src/lib/terminalClient.ts`

- ✅ HTTP client with retry logic
- ✅ `executeDecisions()` method
- ✅ `getState()` method  
- ✅ `simulate()` method
- ✅ Error handling

### 2. Decision Engine Execute Endpoint ✅
**File**: `backend/src/routes/decisionEngine.ts`

- ✅ `POST /api/decision-engine/execute` endpoint
- ✅ Accepts Decision objects
- ✅ Generates idempotency key
- ✅ Calls Terminal client
- ✅ Returns execution results

### 3. Complete Terminal Spec ✅
**File**: `docs/prd/terminal-execution-endpoint-spec.md`

- ✅ Complete code structure for strategis-api
- ✅ Route handlers
- ✅ Service implementation
- ✅ Database schema
- ✅ Guard enforcement logic

---

## ❌ What Needs to Be Built (strategis-api Side)

### 1. Terminal Route Module

**File**: `strategis-api/server/routes/terminal.js`

**Endpoints**:
- `POST /api/terminal/execute` - Execute Decision objects
- `GET /api/terminal/state` - Get cooldowns/policy state
- `POST /api/terminal/simulate` - Dry-run validation

**See**: `docs/prd/terminal-execution-endpoint-spec.md` for complete code

### 2. Terminal Service

**File**: `strategis-api/lib/services/terminal.js`

**Functions**:
- `validateDecision()` - Schema validation
- `checkGuards()` - Cooldown, freeze, learning checks
- `executeBudgetChange()` - Fetch current, calculate new, execute
- `executeBidCapChange()` - Fetch current, calculate new, execute
- `updateCooldown()` - Redis cooldown management
- `logExecution()` - PostgreSQL audit logging

**See**: `docs/prd/terminal-execution-endpoint-spec.md` for complete code

### 3. Database Migration

**Table**: `terminal_executions`

```sql
CREATE TABLE terminal_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id VARCHAR(255) NOT NULL,
  decision_id VARCHAR(255) NOT NULL,
  account_id VARCHAR(255),
  level VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error TEXT,
  guard_type VARCHAR(50),
  changes JSONB,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correlation_id VARCHAR(255),
  organization VARCHAR(255) NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4. Facebook Service Integration

**Need to confirm**: Where are these methods implemented?
- `getCampaign({ id, organization })` - Fetch campaign with daily_budget, created_time
- `getAdSet({ id, organization })` - Fetch ad set with dailyBudget, bidAmount, status
- `updateCampaignBudget({ id, organization, dailyBudget })` - Update campaign budget
- `updateAdSetBudget({ id, organization, dailyBudget })` - Update ad set budget
- `updateAdSetBid({ id, organization, bidAmount })` - Update ad set bid cap

**Pattern from strategis-static**:
- Budgets/bids multiplied by 100 (cents conversion)
- Endpoints: `PUT /api/facebook/campaigns/:id/budget`, etc.

---

## Environment Variables Needed

### Liftoff
```bash
TERMINAL_API_BASE_URL=https://api.strategis.internal
TERMINAL_API_KEY=<service-token>
TERMINAL_API_TIMEOUT=30000
TERMINAL_DRY_RUN=true  # Set to false for production
```

### strategis-api
```bash
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://...
TERMINAL_COOLDOWN_HOURS=24
TERMINAL_FREEZE_HOURS=48
TERMINAL_DRY_RUN=true  # Set to false for production
```

---

## Dependencies to Install

### Liftoff
```bash
cd backend
npm install uuid
npm install --save-dev @types/uuid
```

---

## Testing the Integration

### Step 1: Test Decision Generation
```bash
curl -X POST http://localhost:3001/api/decision-engine/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "adset",
    "date": "2025-01-15"
  }'
```

### Step 2: Test Terminal Execution (Dry-Run)
```bash
curl -X POST http://localhost:3001/api/decision-engine/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "decisions": [{
      "decision_id": "2025-01-15:adset:123456789",
      "id": "123456789",
      "level": "adset",
      "account_id": "act_123",
      "action": "bump_budget",
      "budget_multiplier": 1.2,
      "bid_cap_multiplier": null,
      "reason": "ROAS 1.35 ≥ 1.3",
      "date": "2025-01-15",
      "snapshot_dir": "/path/to/snapshot",
      "created_at": "2025-01-15T07:00:00Z"
    }],
    "dryRun": true
  }'
```

**Expected Flow**:
1. Decision Engine receives request
2. Generates idempotency key
3. Calls Terminal client → `POST /api/terminal/execute` (strategis-api)
4. Terminal validates and executes (dry-run)
5. Returns results

---

## Next Steps

### Immediate (This Week)

1. **strategis-api**: Build Terminal routes and service
   - Copy code from `terminal-execution-endpoint-spec.md`
   - Adapt to existing strategis-api patterns
   - Confirm Facebook service interface

2. **Liftoff**: Install dependencies
   ```bash
   npm install uuid @types/uuid
   ```

3. **Both**: Set up environment variables
   - Configure Terminal API base URL
   - Set up authentication tokens

### Short Term (Next 2 Weeks)

1. **Test end-to-end** with dry-run mode
2. **Validate guard enforcement** (cooldowns, freeze periods)
3. **Test error handling** (Meta API failures, rate limits)
4. **Deploy to staging**

### Production (After Validation)

1. **Enable execution** (set `TERMINAL_DRY_RUN=false`)
2. **Monitor execution logs**
3. **Set up alerts** for failures
4. **Gradual rollout** (start with small batches)

---

## Key Files Reference

### Liftoff (Built ✅)
- `backend/src/lib/terminalClient.ts` - Terminal HTTP client
- `backend/src/routes/decisionEngine.ts` - Execute endpoint

### strategis-api (To Build ❌)
- `server/routes/terminal.js` - Route handlers
- `lib/services/terminal.js` - Execution logic
- `lib/services/facebook.js` - Meta API integration (may exist)

### Documentation
- `docs/prd/terminal-execution-endpoint-spec.md` - Complete Terminal spec ⭐
- `docs/prd/decision-engine-terminal-integration-implementation-plan.md` - Implementation plan
- `docs/prd/decision-engine-terminal-integration-status.md` - Status tracker

---

## Questions for strategis-api Team

1. **Facebook Service**: Where are the Facebook API methods?
   - `getCampaign()`, `getAdSet()`
   - `updateCampaignBudget()`, `updateAdSetBudget()`, `updateAdSetBid()`
   - Do they exist? Where? What's the interface?

2. **Authentication**: How should Liftoff authenticate?
   - API key? JWT? Service account?
   - Where do we get credentials?

3. **Deployment**: Add to existing strategis-api or separate service?
   - Recommendation: Add to strategis-api for MVP

4. **Redis/PostgreSQL**: Are these already set up?
   - Redis for cooldowns
   - PostgreSQL for execution logs

---

## Success Criteria

### Phase 1 MVP
- ✅ Terminal `/execute` endpoint accepts Decision objects
- ✅ Dry-run mode works (no Meta API writes)
- ✅ Basic guards enforced (cooldowns, idempotency)
- ✅ Execution logging works
- ✅ Decision Engine can call Terminal successfully

### Phase 2 Production
- ✅ Real Meta API execution works
- ✅ All guards enforced (freeze, learning, portfolio)
- ✅ Error handling and retries work
- ✅ State synchronization works
- ✅ Monitoring and alerts configured

---

*Ready to start building! See `terminal-execution-endpoint-spec.md` for complete code structure.*



