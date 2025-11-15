# Decision Engine → Terminal Integration: Architecture Summary

## Document Purpose
This document clarifies the architecture for integrating Decision Engine (Liftoff) with Terminal (strateg.is) to execute Facebook campaign changes.

**Status**: 🟡 **ARCHITECTURE CLARIFICATION**  
**Date**: 2025-01-XX  
**Owner**: Engineering (Platform)

---

## Architecture Overview

### Current State

```
┌─────────────────────────────────────────────────────────┐
│                    Liftoff Backend                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌──────────────────┐         │
│  │  Strategist  │         │ Decision Engine  │         │
│  │  (Analysis)  │────────>│ (Policy/Decide) │         │
│  └──────────────┘         └────────┬─────────┘         │
│                                     │                   │
│                                     │ Generates         │
│                                     │ Decision objects  │
│                                     │                   │
│                                     ▼                   │
│                            ┌──────────────────┐         │
│                            │ Decision Files    │         │
│                            │ data/decisions/   │         │
│                            └──────────────────┘         │
│                                     │                   │
│                                     │ ❌ Missing Link   │
│                                     │                   │
└─────────────────────────────────────┼───────────────────┘
                                      │
                                      │ Need to send
                                      │ Decision objects
                                      │
┌─────────────────────────────────────▼───────────────────┐
│              Terminal (strateg.is)                       │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  POST /api/terminal/execute                  │      │
│  │  - Accepts Decision objects                  │      │
│  │  - Validates guards                         │      │
│  │  - Executes via Meta Ads API                │      │
│  │  - Returns execution results                │      │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  Meta Ads API                                 │      │
│  │  - PATCH campaigns (budget)                  │      │
│  │  - PATCH ad sets (budget, bid_cap)          │      │
│  └──────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

---

## The Flow We Need

### Step 1: Decision Engine Generates Decisions ✅ (DONE)

**Endpoint**: `POST /api/decision-engine/suggest`

**What it does**:
- Reads performance data from snapshots
- Applies policies (Kelly, UCB, lane-specific)
- Checks cooldowns and confidence gates
- Generates Decision objects
- Writes to `data/decisions/{date}/decisions_*.jsonl`

**Decision Object Format**:
```typescript
{
  decision_id: "2025-01-15:adset:123456789",
  id: "123456789",  // adset_id or campaign_id
  level: "adset",   // or "campaign"
  account_id: "act_123",
  action: "bump_budget",  // or "trim_budget" or "hold"
  budget_multiplier: 1.2,  // 20% increase
  bid_cap_multiplier: null,  // or 0.9 for -10%
  spend_delta_usd: 50.0,
  reason: "ROAS 1.35 ≥ 1.3",
  policy_version: "v1",
  date: "2025-01-15",
  snapshot_dir: "/path/to/snapshot",
  created_at: "2025-01-15T07:00:00Z"
}
```

---

### Step 2: Decision Engine Sends to Terminal ❌ (NEEDED)

**What we need to build**:

**Option A: HTTP Client (if Terminal is separate service)**
```typescript
// backend/src/lib/terminalClient.ts
import axios from 'axios';

export class TerminalClient {
  async executeDecisions(decisions: Decision[]): Promise<ExecutionResult> {
    const response = await axios.post(
      `${process.env.TERMINAL_API_BASE_URL}/api/terminal/execute`,
      {
        decisions,
        idempotencyKey: generateIdempotencyKey(decisions),
        dryRun: process.env.TERMINAL_DRY_RUN === 'true',
        correlationId: uuidv4()
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.TERMINAL_API_KEY}`
        }
      }
    );
    return response.data;
  }
}
```

**Option B: Direct Function Calls (if Terminal is in Liftoff)**
```typescript
// If Terminal routes are in same process
import { executeDecisions } from '../routes/terminal';

const result = await executeDecisions(decisions);
```

**Questions for Devin**:
- [ ] Is Terminal a separate HTTP service?
- [ ] What's the base URL?
- [ ] What's the authentication method?

---

### Step 3: Terminal Executes via Meta API ❌ (NEEDED)

**What Terminal needs to do**:

1. **Validate Guards**:
   - Check cooldowns (has entity been changed recently?)
   - Check freeze periods (is campaign in 48-72h post-launch freeze?)
   - Check signal health (is ad set in Learning Limited?)
   - Check portfolio caps (max budget changes per day?)

2. **Convert Decisions to Meta API Calls**:
   ```typescript
   // For each decision:
   if (decision.action === 'bump_budget' && decision.level === 'adset') {
     // Fetch current budget from Meta API
     const currentBudget = await metaApi.getAdSet(decision.id).daily_budget;
     
     // Calculate new budget
     const newBudget = currentBudget * decision.budget_multiplier;
     
     // Execute change
     await metaApi.updateAdSet(decision.id, {
       daily_budget: newBudget
     });
   }
   
   if (decision.bid_cap_multiplier) {
     const currentBidCap = await metaApi.getAdSet(decision.id).bid_amount;
     const newBidCap = currentBidCap * decision.bid_cap_multiplier;
     
     await metaApi.updateAdSet(decision.id, {
       bid_amount: newBidCap
     });
   }
   ```

3. **Handle Errors**:
   - Retry on 429 (rate limits)
   - Retry on 5xx (server errors)
   - Log failures
   - Return partial results if some succeed, some fail

**Questions for Devin**:
- [ ] Does Terminal have Meta API integration?
- [ ] How does Terminal fetch current budgets/bid caps?
- [ ] What's the retry strategy?
- [ ] How are errors handled?

---

### Step 4: Terminal Returns Results ❌ (NEEDED)

**Response Format** (proposed):
```typescript
{
  jobId: string,  // For async execution
  acceptedCount: number,
  rejected: Array<{
    decision_id: string,
    reason: string,
    guard_type: 'cooldown' | 'freeze' | 'signal_health' | 'portfolio_cap'
  }>,
  executed: Array<{
    decision_id: string,
    status: 'success' | 'failed',
    meta_api_response?: any,
    error?: string
  }>
}
```

**Questions for Devin**:
- [ ] Is execution synchronous or async?
- [ ] What's the exact response format?
- [ ] How do we poll for async job status?

---

### Step 5: Decision Engine Updates State ❌ (NEEDED)

**After Terminal executes**:

1. **Mark decisions as applied**:
   ```typescript
   POST /api/decision-engine/applied
   {
     decisions: executedDecisions,
     cooldown_hours: 24
   }
   ```
   - Updates local cooldowns
   - Records applied timestamp

2. **Sync state with Terminal** (if Terminal maintains its own state):
   - Option A: Terminal updates its own cooldowns, Decision Engine reads via `/api/terminal/state`
   - Option B: Decision Engine updates Terminal's state via API
   - Option C: Shared state storage (Redis, PostgreSQL)

**Questions for Devin**:
- [ ] Does Terminal maintain its own cooldown registry?
- [ ] How do we keep state in sync?
- [ ] Who is the source of truth for cooldowns?

---

## Implementation Checklist

### Decision Engine Side (Liftoff)

- [ ] **Create Terminal HTTP Client**
  - File: `backend/src/lib/terminalClient.ts`
  - Methods: `executeDecisions()`, `getJobStatus()`, `getState()`
  - Error handling, retries, timeouts

- [ ] **Add Execute Endpoint to Decision Engine**
  - File: `backend/src/routes/decisionEngine.ts`
  - Endpoint: `POST /api/decision-engine/execute`
  - Reads decisions from files or accepts as request body
  - Calls Terminal client
  - Returns execution results

- [ ] **Update `/applied` Endpoint**
  - Ensure it works with Terminal execution results
  - Syncs cooldowns properly

### Terminal Side (strateg.is)

- [ ] **Implement `/execute` Endpoint**
  - Accepts Decision objects
  - Validates guards
  - Executes via Meta API
  - Returns results

- [ ] **Meta API Integration**
  - Fetch current budgets/bid caps
  - Calculate new values from multipliers
  - Execute updates
  - Handle errors and retries

- [ ] **State Management**
  - Cooldown registry
  - Execution history
  - Audit logging

- [ ] **Observability**
  - Metrics (success rate, latency)
  - Logs (execution details)
  - Alerts (failures, guard violations)

---

## Key Findings (CONFIRMED)

### ✅ What We Know (from Devin's Answers)

1. **Terminal for Facebook does NOT exist** - Needs to be built in strategis-api
2. **Decision schema confirmed** - From `backend/src/lib/decisions.ts`
3. **Meta API endpoints exist** - strategis-static calls budget/bid endpoints
4. **Decision Engine generates decisions** - `/api/decision-engine/suggest` works

### ❌ What Needs to Be Built

1. **Terminal `/execute` endpoint** in strategis-api
2. **Terminal HTTP client** in Decision Engine
3. **Meta API execution logic** (fetch current, calculate new, execute)
4. **Guard enforcement** (cooldowns, freeze periods, learning phase)

See `decision-engine-terminal-integration-implementation-plan.md` for detailed implementation plan.

---

## Next Steps

1. **Schedule call with Devin** to answer questions
2. **Confirm API contract** - Get exact schemas
3. **Build Terminal client** in Decision Engine
4. **Implement `/execute`** in Terminal (if missing)
5. **Test end-to-end** with dry-run mode first
6. **Deploy to staging** for validation
7. **Production rollout** with monitoring

---

## Related Documents

- **Questions for Devin**: `docs/prd/decision-engine-terminal-integration-questions.md`
- **Terminal PRD**: `docs/prd/terminal-facebook-bidder-prd.md`
- **Integration Playbook**: `docs/operations/terminal-strategist-integration-playbook.md`
- **Architecture Comparison**: `docs/prd/strategist-vs-decider-comparison.md`

