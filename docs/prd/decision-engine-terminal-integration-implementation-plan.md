# Decision Engine → Terminal Integration: Implementation Plan

## Document Purpose
This document provides a concrete implementation plan based on answers from Devin's code exploration and confirmed Decision schema from Liftoff.

**Status**: ✅ **READY TO IMPLEMENT** - Based on confirmed findings  
**Date**: 2025-01-XX  
**Owner**: Engineering (Platform)

---

## Key Findings (CONFIRMED)

### ✅ What We Know

1. **Terminal for Facebook does NOT exist** - Needs to be built in strategis-api
2. **Decision schema confirmed** - From `backend/src/lib/decisions.ts`:
   ```typescript
   {
     decision_id: string;
     id: string; // adset_id or campaign_id
     level: 'adset' | 'campaign';
     account_id: string | null;
     action: 'bump_budget' | 'trim_budget' | 'hold';
     budget_multiplier: number | null;
     bid_cap_multiplier: number | null;
     spend_delta_usd?: number | null;
     reason: string;
     policy_version?: string;
     confidence?: number | null;
     date: string;
     snapshot_dir: string;
     created_at: string;
   }
   ```

3. **Meta API endpoints exist** - strategis-static calls:
   - `PUT /api/facebook/campaigns/${id}/budget`
   - `PUT /api/facebook/adsets/${id}/budget`
   - `PUT /api/facebook/adsets/${id}/bid`
   - Budgets/bids multiplied by 100 (cents conversion)

4. **Decision Engine generates decisions** - `/api/decision-engine/suggest` works

### ❌ What Needs to Be Built

1. **Terminal `/execute` endpoint** in strategis-api
2. **Terminal HTTP client** in Decision Engine
3. **Meta API execution logic** (fetch current, calculate new, execute)
4. **Guard enforcement** (cooldowns, freeze periods, learning phase)
5. **State synchronization** between Decision Engine and Terminal

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Decision Engine (Liftoff)       │
│                                         │
│  POST /api/decision-engine/suggest      │
│  → Generates Decision[] objects ✅      │
│                                         │
│  POST /api/decision-engine/execute     │
│  → Calls Terminal client ⚠️ (TO BUILD) │
└──────────────┬──────────────────────────┘
               │
               │ HTTP POST
               │
┌──────────────▼──────────────────────────┐
│      Terminal Client (Liftoff)          │
│                                         │
│  backend/src/lib/terminalClient.ts      │
│  → HTTP client to Terminal API          │
└──────────────┬──────────────────────────┘
               │
               │ HTTPS
               │
┌──────────────▼──────────────────────────┐
│    Terminal Service (strategis-api)     │
│                                         │
│  POST /api/terminal/execute ⚠️ (BUILD) │
│  → Validates guards                     │
│  → Executes Meta API calls              │
│  → Updates cooldowns                    │
│  → Returns results                      │
└──────────────┬──────────────────────────┘
               │
               │ Uses existing endpoints
               │
┌──────────────▼──────────────────────────┐
│   Strategis Facebook API Endpoints      │
│                                         │
│  PUT /api/facebook/campaigns/:id/budget│
│  PUT /api/facebook/adsets/:id/budget   │
│  PUT /api/facebook/adsets/:id/bid      │
│  ✅ (Already exist)                     │
└─────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Terminal Service (strategis-api)

#### Task 1.1: Create Terminal Route Module

**File**: `strategis-api/server/routes/terminal.js`

**Endpoints to implement**:

1. **`POST /api/terminal/execute`**
   ```javascript
   // Request
   {
     decisions: Decision[],
     idempotencyKey: string,
     dryRun?: boolean,
     correlationId?: string
   }
   
   // Response
   {
     executionId: string,
     acceptedCount: number,
     rejectedCount: number,
     results: Array<{
       decision_id: string,
       status: 'success' | 'failed' | 'rejected',
       error?: string,
       guard_type?: string,
       changes?: {
         current_budget?: number,
         new_budget?: number,
         current_bid_cap?: number,
         new_bid_cap?: number
       }
     }>
   }
   ```

2. **`GET /api/terminal/state`** (read-only)
   ```javascript
   // Response
   {
     cooldowns: Array<{
       level: 'adset' | 'campaign',
       id: string,
       action: string,
       expires_at: string
     }>,
     policyVersion: string,
     lastUpdated: string
   }
   ```

#### Task 1.2: Implement Decision Execution Logic

**File**: `strategis-api/lib/services/terminal.js`

**Functions needed**:

```javascript
// 1. Validate Decision schema
function validateDecision(decision) {
  // Check required fields
  // Validate action values
  // Validate multipliers
}

// 2. Check guards
async function checkGuards(decision) {
  // Cooldown check (Redis)
  // Freeze period check (fetch campaign created_time)
  // Learning phase check (fetch adset status)
  // Portfolio caps check
}

// 3. Execute budget change
async function executeBudgetChange(decision) {
  // Fetch current budget from Meta API
  // Calculate: new_budget = current_budget * budget_multiplier
  // Validate bounds
  // Call PUT /api/facebook/{level}s/{id}/budget
  // Return result
}

// 4. Execute bid cap change
async function executeBidCapChange(decision) {
  // Fetch current bid cap from Meta API
  // Calculate: new_bid_cap = current_bid_cap * bid_cap_multiplier
  // Call PUT /api/facebook/adsets/{id}/bid
  // Return result
}

// 5. Update cooldowns
async function updateCooldown(decision) {
  // Set Redis key: cooldown:{level}:{id}:{action}
  // TTL: 24 hours
}
```

#### Task 1.3: Integrate with Existing Facebook Endpoints

**Use existing endpoints**:
- `PUT /api/facebook/campaigns/:id/budget` (already exists)
- `PUT /api/facebook/adsets/:id/budget` (already exists)
- `PUT /api/facebook/adsets/:id/bid` (already exists)

**Note**: Budgets/bids need to be multiplied by 100 (cents conversion)

#### Task 1.4: Add Guard Enforcement

**Cooldowns** (Redis):
```javascript
// Check cooldown
const cooldownKey = `cooldown:${decision.level}:${decision.id}:${decision.action}`;
const cooldownUntil = await redis.get(cooldownKey);
if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
  return { status: 'rejected', guard_type: 'cooldown' };
}

// Set cooldown after execution
await redis.setex(cooldownKey, 86400, expiresAt.toISOString());
```

**Freeze Periods**:
```javascript
// Fetch campaign created_time
const campaign = await fetchCampaignMetadata(decision.id);
const hoursSinceLaunch = (Date.now() - new Date(campaign.created_time)) / 3600000;
if (hoursSinceLaunch < 48) {
  return { status: 'rejected', guard_type: 'freeze' };
}
```

**Learning Phase**:
```javascript
// Only block budget increases during learning
if (decision.action === 'bump_budget') {
  const adset = await fetchAdsetStatus(decision.id);
  if (adset.status === 'LEARNING' || adset.status === 'LEARNING_LIMITED') {
    return { status: 'rejected', guard_type: 'learning' };
  }
}
```

#### Task 1.5: Add Execution Logging

**PostgreSQL table**: `terminal_executions`
```sql
CREATE TABLE terminal_executions (
  id UUID PRIMARY KEY,
  execution_id VARCHAR(255),
  decision_id VARCHAR(255),
  account_id VARCHAR(255),
  level VARCHAR(50),
  entity_id VARCHAR(255),
  action VARCHAR(50),
  status VARCHAR(50),
  error TEXT,
  guard_type VARCHAR(50),
  changes JSONB,
  executed_at TIMESTAMP,
  correlation_id VARCHAR(255)
);
```

---

### Phase 2: Decision Engine Integration (Liftoff)

#### Task 2.1: Create Terminal HTTP Client

**File**: `backend/src/lib/terminalClient.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { Decision } from './decisions';

export interface TerminalExecuteRequest {
  decisions: Decision[];
  idempotencyKey: string;
  dryRun?: boolean;
  correlationId?: string;
}

export interface TerminalExecuteResponse {
  executionId: string;
  acceptedCount: number;
  rejectedCount: number;
  results: Array<{
    decision_id: string;
    status: 'success' | 'failed' | 'rejected';
    error?: string;
    guard_type?: string;
    changes?: {
      current_budget?: number;
      new_budget?: number;
      current_bid_cap?: number;
      new_bid_cap?: number;
    };
  }>;
}

export class TerminalClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TERMINAL_API_BASE_URL || 'https://api.strategis.internal';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.TERMINAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.TERMINAL_API_TIMEOUT || 30000),
    });
  }

  async executeDecisions(request: TerminalExecuteRequest): Promise<TerminalExecuteResponse> {
    const response = await this.client.post<TerminalExecuteResponse>(
      '/api/terminal/execute',
      request
    );
    return response.data;
  }

  async getState(): Promise<any> {
    const response = await this.client.get('/api/terminal/state');
    return response.data;
  }
}
```

#### Task 2.2: Add Execute Endpoint to Decision Engine

**File**: `backend/src/routes/decisionEngine.ts`

```typescript
import { TerminalClient } from '../lib/terminalClient';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const terminalClient = new TerminalClient();

// Generate idempotency key from decisions
function generateIdempotencyKey(decisions: Decision[]): string {
  const key = decisions
    .map(d => `${d.account_id}:${d.level}:${d.id}:${d.action}:${d.date}`)
    .join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}

// POST /api/decision-engine/execute
router.post('/execute', authenticateUser, async (req, res) => {
  try {
    const { decisions, dryRun } = req.body || {};
    
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({
        code: 'bad_request',
        message: 'decisions[] array required'
      });
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(decisions);
    const correlationId = uuidv4();

    // Execute via Terminal
    const result = await terminalClient.executeDecisions({
      decisions,
      idempotencyKey,
      dryRun: dryRun !== false && process.env.TERMINAL_DRY_RUN !== 'false',
      correlationId,
    });

    return res.status(200).json({
      success: true,
      executionId: result.executionId,
      acceptedCount: result.acceptedCount,
      rejectedCount: result.rejectedCount,
      results: result.results,
      note: dryRun ? 'Dry-run mode: no actual changes applied' : 'Execution completed',
    });
  } catch (err: any) {
    console.error('decision-engine.execute error', err);
    return res.status(500).json({
      code: 'internal_error',
      message: err?.message || 'Execution failed',
    });
  }
});
```

#### Task 2.3: Update `/applied` Endpoint

**Current**: Updates local cooldowns after manual confirmation  
**Update**: Can be called after Terminal execution to sync local state

```typescript
// POST /api/decision-engine/applied
// Can be called after Terminal execution to sync local cooldowns
// Terminal already updates its own cooldowns, but Decision Engine
// may want to keep local copy for faster access
```

---

## Environment Variables

### Liftoff (Decision Engine)
```bash
TERMINAL_API_BASE_URL=https://api.strategis.internal
TERMINAL_API_KEY=<service-token>
TERMINAL_API_TIMEOUT=30000
TERMINAL_DRY_RUN=true  # Set to false for production
```

### strategis-api (Terminal)
```bash
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://...
TERMINAL_COOLDOWN_HOURS=24
TERMINAL_FREEZE_HOURS=48
TERMINAL_DRY_RUN=true  # Set to false for production
```

---

## Testing Strategy

### Phase 1: Unit Tests

1. **Decision validation** - Test schema validation
2. **Guard checks** - Test cooldown, freeze, learning guards
3. **Budget calculation** - Test multiplier logic
4. **Error handling** - Test Meta API error scenarios

### Phase 2: Integration Tests

1. **Dry-run mode** - Test full flow without Meta API writes
2. **Single decision** - Test one budget change end-to-end
3. **Batch decisions** - Test multiple decisions in one call
4. **Guard violations** - Test rejection scenarios

### Phase 3: End-to-End Tests

1. **Full workflow** - Decision Engine → Terminal → Meta API
2. **Error recovery** - Test retry logic
3. **State sync** - Test cooldown synchronization
4. **Audit trail** - Verify execution logging

---

## Rollout Plan

### Week 1: Terminal Service (strategis-api)
- [ ] Create route module
- [ ] Implement `/execute` endpoint
- [ ] Add guard enforcement
- [ ] Add execution logging
- [ ] Unit tests

### Week 2: Decision Engine Integration (Liftoff)
- [ ] Create Terminal client
- [ ] Add `/execute` endpoint
- [ ] Integration tests
- [ ] Update documentation

### Week 3: Testing & Validation
- [ ] Dry-run testing
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Security review

### Week 4: Production Rollout
- [ ] Deploy to staging
- [ ] Monitor for 1 week
- [ ] Deploy to production (dry-run)
- [ ] Enable execution after validation

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

## Open Questions

1. **Authentication**: How should Liftoff authenticate to Terminal?
   - API key? JWT? Service account?
   - Where are credentials stored?

2. **Deployment**: Where should Terminal be deployed?
   - Add routes to strategis-api?
   - Separate microservice?
   - User preference?

3. **State Sync**: Who is authoritative for cooldowns?
   - Terminal maintains cooldowns (recommended)
   - Decision Engine reads via `/state` endpoint
   - Or sync both ways?

4. **Async Execution**: Is async pattern needed for Phase 1?
   - Synchronous acceptable for MVP?
   - Expected batch sizes?

---

## Related Documents

- **Answers Document**: `decision-engine-terminal-integration-answers.md` (from Devin)
- **Questions Document**: `decision-engine-terminal-integration-questions.md`
- **Architecture Summary**: `decision-engine-terminal-integration-summary.md`
- **Terminal PRD**: `docs/prd/terminal-facebook-bidder-prd.md`



