# Decision Engine → Terminal Integration: Current Status

## Document Purpose
Quick reference for the current state of Decision Engine → Terminal integration, based on Devin's code exploration and confirmed findings.

**Status**: ✅ **READY TO BUILD** - All questions answered, implementation plan ready  
**Last Updated**: 2025-01-XX

---

## Executive Summary

**The Situation**:
- ✅ Decision Engine generates decisions (DONE)
- ❌ Terminal execution endpoint doesn't exist (NEEDS TO BE BUILT)
- ✅ Meta API endpoints exist in strategis (CAN USE)
- ❌ Integration between Decision Engine and Terminal (NEEDS TO BE BUILT)

**The Solution**:
1. Build Terminal `/execute` endpoint in strategis-api
2. Build Terminal HTTP client in Decision Engine
3. Wire up end-to-end flow

---

## What's Confirmed ✅

### Decision Schema (from Liftoff)
```typescript
{
  decision_id: string;
  id: string; // adset_id or campaign_id
  level: 'adset' | 'campaign';
  account_id: string | null;
  action: 'bump_budget' | 'trim_budget' | 'hold';
  budget_multiplier: number | null; // e.g., 1.2 for +20%
  bid_cap_multiplier: number | null; // e.g., 0.9 for -10%
  reason: string;
  date: string;
  snapshot_dir: string;
  created_at: string;
}
```

### Meta API Endpoints (exist in strategis)
- `PUT /api/facebook/campaigns/:id/budget` ✅
- `PUT /api/facebook/adsets/:id/budget` ✅
- `PUT /api/facebook/adsets/:id/bid` ✅
- **Note**: Budgets/bids multiplied by 100 (cents conversion)

### Decision Engine Status
- ✅ `/api/decision-engine/suggest` - Generates decisions
- ✅ Writes Decision files to `data/decisions/`
- ✅ Applies policies (Kelly, UCB, lane-specific)
- ✅ Enforces cooldowns and confidence gates

---

## What Needs to Be Built ❌

### 1. Terminal Service (strategis-api)

**Location**: `strategis-api/server/routes/terminal.js`

**Endpoints**:
- `POST /api/terminal/execute` - Execute Decision objects
- `GET /api/terminal/state` - Read cooldowns/policy state

**Functionality**:
- Validate Decision schema
- Check guards (cooldowns, freeze, learning, portfolio)
- Fetch current budgets/bid caps from Meta API
- Calculate new values: `new_budget = current_budget * budget_multiplier`
- Execute Meta API calls
- Update cooldowns (Redis)
- Log executions (PostgreSQL)

### 2. Terminal Client (Liftoff)

**Location**: `backend/src/lib/terminalClient.ts`

**Functionality**:
- HTTP client to Terminal API
- `executeDecisions()` method
- `getState()` method
- Error handling and retries

### 3. Decision Engine Execute Endpoint (Liftoff)

**Location**: `backend/src/routes/decisionEngine.ts`

**Endpoint**: `POST /api/decision-engine/execute`

**Functionality**:
- Accept Decision objects (from files or request body)
- Generate idempotency key
- Call Terminal client
- Return execution results

---

## The Flow

```
1. Decision Engine generates decisions
   POST /api/decision-engine/suggest
   → Returns Decision[] ✅

2. Decision Engine sends to Terminal
   POST /api/decision-engine/execute
   → Calls Terminal client ⚠️ (TO BUILD)
   → POST /api/terminal/execute (strategis-api) ⚠️ (TO BUILD)

3. Terminal executes
   → Validates guards
   → Fetches current budgets
   → Calculates new values
   → Calls Meta API endpoints ✅ (exist)
   → Updates cooldowns
   → Returns results

4. Decision Engine processes results
   → Updates local state
   → Logs outcomes
```

---

## Implementation Checklist

### strategis-api (Terminal Service)

- [ ] Create `server/routes/terminal.js`
- [ ] Implement `POST /api/terminal/execute`
  - [ ] Decision schema validation
  - [ ] Guard checks (cooldowns, freeze, learning)
  - [ ] Meta API execution (budget/bid changes)
  - [ ] Cooldown updates (Redis)
  - [ ] Execution logging (PostgreSQL)
- [ ] Implement `GET /api/terminal/state`
- [ ] Add error handling and retries
- [ ] Add metrics and logging
- [ ] Write tests

### Liftoff (Decision Engine)

- [x] Create `backend/src/lib/terminalClient.ts` ✅
  - [x] HTTP client implementation
  - [x] `executeDecisions()` method
  - [x] `getState()` method
  - [x] `simulate()` method
  - [x] Error handling and retries
- [x] Add `POST /api/decision-engine/execute` endpoint ✅
  - [x] Accept Decision objects
  - [x] Generate idempotency key
  - [x] Call Terminal client
  - [x] Return results
- [ ] Update environment variables (TERMINAL_API_BASE_URL, TERMINAL_API_KEY)
- [ ] Install uuid package (`npm install uuid @types/uuid`)
- [ ] Write integration tests

---

## Key Decisions Needed

1. **Authentication**: How should Liftoff authenticate to Terminal?
   - API key? JWT? Service account?
   - **Recommendation**: API key (simplest)

2. **Deployment**: Where should Terminal be deployed?
   - Add routes to strategis-api? (recommended for MVP)
   - Separate microservice? (future)

3. **State Sync**: Who maintains cooldowns?
   - Terminal authoritative (recommended)
   - Decision Engine reads via `/state` endpoint

4. **Execution Model**: Synchronous or async?
   - Synchronous for Phase 1 MVP (simpler)
   - Async for Phase 2 (if needed)

---

## Next Steps

1. **Review implementation plan** - `decision-engine-terminal-integration-implementation-plan.md`
2. **Start Terminal service** - Build `/execute` endpoint in strategis-api
3. **Build Terminal client** - HTTP client in Decision Engine
4. **Test end-to-end** - Dry-run mode first
5. **Deploy to staging** - Validate before production

---

## Related Documents

- **Implementation Plan**: `decision-engine-terminal-integration-implementation-plan.md` ⭐ START HERE
- **Answers from Devin**: `decision-engine-terminal-integration-answers.md` (attached)
- **Architecture Summary**: `decision-engine-terminal-integration-summary.md`
- **Questions Document**: `decision-engine-terminal-integration-questions.md`

