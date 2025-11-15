# Terminal-Strategist Integration: Answers from Liftoff Codebase

## Document Purpose
This document provides **CONFIRMED** answers to critical questions based on actual code analysis of the Liftoff codebase. These answers are based on the current implementation in `backend/src/routes/terminal.ts`, `backend/src/lib/decisions.ts`, and related files.

**Status**: ✅ **CONFIRMED** - Based on actual code analysis

---

## CRITICAL Questions - Answered

### C1: Terminal Service Location & Access

**Answer**: ✅ **CONFIRMED** - Terminal is currently **part of the Liftoff backend**, not a separate strateg.is service.

**Evidence**:
- Terminal routes exist in `backend/src/routes/terminal.ts` in Liftoff
- Routes are mounted in the same Express app as Strategist
- Uses same authentication middleware (`authenticateUser`)
- Same file system for state storage

**Current Implementation**:
- **Base URL**: Same as Strategist (`/api/terminal/*`)
- **Authentication**: Same as Strategist (via `authenticateUser` middleware)
- **Network**: Same process, no network calls needed
- **Deployment**: Part of Liftoff backend deployment

**Implications**:
- No HTTP client needed - direct function calls or same-process API calls
- No separate service deployment
- State is shared via file system (`data/terminal_state/`)
- Can call Terminal endpoints directly from Strategist routes

**Action Required**:
- ⚠️ **CLARIFY**: Is Terminal moving to strateg.is, or staying in Liftoff?
- If moving: Need migration plan and HTTP client
- If staying: Can use direct integration (no HTTP needed)

---

### C2: API Contract Confirmation

**Answer**: ✅ **CONFIRMED** - Current Terminal endpoints and contracts:

#### Available Endpoints:

**1. POST `/api/terminal/simulate`**
```typescript
// Request
{
  rows: Array<{
    adset_id?: string;
    campaign_id?: string;
    level: 'adset' | 'campaign';
    account_id: string;
    roas: number;
    supports_budget_change?: boolean;
    supports_bid_cap?: boolean;
    impressions?: number;
  }>;
  policy?: {
    roas_up?: number;
    roas_hold?: number;
    roas_down?: number;
    step_up?: number;
    step_down?: number;
    max_step_up?: number;
    max_step_down?: number;
  };
  mode?: 'simple' | 'kelly' | 'ucb';
}

// Response
{
  intents: Array<{
    id: string;
    level: 'adset' | 'campaign';
    account_id: string;
    action: 'bump_budget' | 'trim_budget' | 'hold';
    budget_multiplier: number;
    bid_cap_multiplier: number | null;
    reason: string;
  }>;
}
```

**2. POST `/api/terminal/suggest`**
```typescript
// Request (query params)
{
  level?: 'adset' | 'campaign';
  date?: string; // YYYY-MM-DD
  mode?: 'simple' | 'kelly' | 'ucb';
  account_ids?: string; // comma-separated
  owner?: string;
}

// Response
{
  meta: {
    date: string;
    level: 'adset' | 'campaign';
    mode: string;
    snapshot_dir: string;
  };
  data: Decision[]; // Array of Decision objects
  files: {
    jsonlPath: string;
    csvPath: string;
    summaryPath: string;
  };
  summary: string;
}
```

**3. POST `/api/terminal/applied`**
```typescript
// Request
{
  decisions: Decision[];
  cooldown_hours?: number; // default: 24
}

// Response
{
  updated: number;
}
```

**4. GET `/api/terminal/state`**
```typescript
// Response
{
  policy: Record<string, PolicyState>;
  cooldowns: Record<string, CooldownRecord>;
}
```

**5. POST `/api/terminal/learn`**
```typescript
// Request (query params)
{
  date?: string; // YYYY-MM-DD
  level?: 'adset' | 'campaign';
}

// Response
{
  date: string;
  level: 'adset' | 'campaign';
  learned_from: number;
  policy_size: number;
}
```

**Missing Endpoint**: ❌ **No `/execute` endpoint exists** - Terminal doesn't actually execute Meta API calls yet!

**Implications**:
- Terminal currently only generates decisions (`/suggest`)
- Decisions are written to files (`data/decisions/`)
- `/applied` marks decisions as applied and updates cooldowns
- **No actual Meta API execution** in current implementation

---

### C3: Decision Schema Validation

**Answer**: ✅ **CONFIRMED** - Decision schema from `backend/src/lib/decisions.ts`:

```typescript
export type Decision = {
  decision_id: string;                    // Required: format `${date}:${level}:${id}`
  id: string;                             // Required: Facebook adset_id or campaign_id
  level: 'adset' | 'campaign';            // Required
  account_id: string | null;               // Required (can be null)
  action: 'bump_budget' | 'trim_budget' | 'hold';  // Required: only 3 actions supported
  budget_multiplier: number | null;        // Required: e.g., 1.2 for 20% increase
  bid_cap_multiplier: number | null;       // Required: e.g., 0.9 for 10% decrease
  spend_delta_usd?: number | null;         // Optional: calculated spend delta
  reason: string;                          // Required: human-readable explanation
  policy_version?: string;                 // Optional: defaults to 'v1'
  confidence?: number | null;              // Optional: confidence score
  date: string;                           // Required: YYYY-MM-DD
  snapshot_dir: string;                    // Required: path to snapshot directory
  created_at: string;                      // Required: ISO timestamp
};
```

**Key Findings**:
- ✅ Schema is well-defined and matches Terminal's expectations
- ✅ Only 3 actions supported: `bump_budget`, `trim_budget`, `hold`
- ❌ **No `pause` or `resume` actions** (mentioned in PRD but not implemented)
- ✅ `budget_multiplier` is primary mechanism (not absolute budget)
- ✅ `spend_delta_usd` is calculated, not required

**Action Required**:
- ⚠️ **CLARIFY**: Do we need `pause`/`resume` actions? If so, need to add to schema and Terminal logic

---

### C4: Current Terminal Implementation Status

**Answer**: ✅ **CONFIRMED** - Terminal is **part of Liftoff**, not strateg.is service.

**Current State**:
- ✅ Routes exist in `backend/src/routes/terminal.ts`
- ✅ Decision generation works (`/suggest` endpoint)
- ✅ Cooldown management works (file-based)
- ✅ Policy learning works (`/learn` endpoint)
- ❌ **No Meta API execution** - Terminal doesn't actually call Facebook API
- ❌ **No async job pattern** - Synchronous responses only
- ❌ **No `/execute` endpoint** - Only `/suggest` + `/applied` pattern

**Architecture**:
```
Liftoff Backend (Single Process)
├── /api/strategist/* (Strategist routes)
├── /api/terminal/* (Terminal routes)
└── Shared State
    ├── data/terminal_state/cooldowns.json
    ├── data/terminal_state/policy_state.json
    └── data/decisions/ (decision files)
```

**Implications**:
- **Current**: Terminal and Strategist are in same process - can call directly
- **Future**: If Terminal moves to strateg.is, need HTTP client
- **Gap**: Missing Meta API execution layer

---

## HIGH Priority Questions - Answered

### H1: State Storage & Synchronization

**Answer**: ✅ **CONFIRMED** - File-based storage in Liftoff:

**Storage Location**:
```typescript
// From backend/src/lib/state.ts
TERMINAL_STATE_BASE = process.env.TERMINAL_STATE_BASE || 
  path.join(process.cwd(), 'data', 'terminal_state')

// Files:
- data/terminal_state/cooldowns.json
- data/terminal_state/policy_state.json
- data/terminal_state/applied/{date}/applied_{timestamp}.jsonl
```

**State Structure**:
```typescript
// Cooldowns
Record<string, {
  id: string;
  level: 'adset' | 'campaign';
  last_action?: 'bump_budget' | 'trim_budget' | 'hold';
  last_change_ts?: string; // ISO
  changes_last_7d?: number;
  next_eligible_ts?: string; // ISO
}>

// Policy State
Record<string, {
  id: string;
  level: 'adset' | 'campaign';
  roas_mean?: number;
  roas_var?: number;
  updates?: number;
  half_life_days?: number;
}>
```

**Synchronization**:
- ✅ **Same process** - No sync needed, direct file access
- ✅ **Load functions**: `loadCooldowns()`, `loadPolicy()`
- ✅ **Save functions**: `saveCooldowns()`, `savePolicy()`
- ✅ **State endpoint**: `GET /api/terminal/state` exposes current state

**Implications**:
- Strategist can call `loadCooldowns()` directly (same process)
- No HTTP calls needed for state access
- No cache invalidation needed (direct file reads)

---

### H2: Execution Flow Confirmation

**Answer**: ✅ **CONFIRMED** - Current flow is **synchronous**, no async jobs:

**Current Flow**:
1. Strategist generates recommendations (`/api/strategist/recommendations`)
2. Strategist calls Terminal `/suggest` → generates Decision objects
3. Decisions written to files (`data/decisions/{date}/`)
4. Manual or scheduled process calls `/applied` → updates cooldowns
5. **Missing**: Actual Meta API execution

**No Async Pattern**:
- ❌ No job IDs
- ❌ No polling mechanism
- ❌ No background workers
- ✅ Synchronous responses only

**Gap Identified**:
- Terminal generates decisions but doesn't execute them
- Need to add Meta API execution layer
- Need to add async job pattern if execution takes time

---

### H3: Guard Implementation Details

**Answer**: ✅ **CONFIRMED** - Guards implemented in code:

**1. Cooldown Guard** ✅
```typescript
// From terminal.ts line 205-209
const cd = cooldowns[id];
const nowIso = new Date().toISOString();
if (cd && cd.next_eligible_ts && cd.next_eligible_ts > nowIso && sim.action !== 'hold') {
  sim.action = 'hold';
}
```

**2. Policy Confidence Guard** ✅
```typescript
// From terminal.ts line 476-480
const minUpdates = Number(process.env.TERMINAL_MIN_UPDATES ?? '3');
const maxSigma = Number(process.env.TERMINAL_MAX_SIGMA ?? '0.5');
if (updates < minUpdates || sigma > maxSigma) {
  sim.action = 'hold';
  sim.delta = 0;
}
```

**3. Budget Support Guard** ✅
```typescript
// From terminal.ts line 120-124
if (!supportsBudget && (action === 'bump_budget' || action === 'trim_budget')) {
  action = 'hold';
  delta = 0;
}
```

**Missing Guards** ❌:
- Freeze period check (not implemented)
- Signal health check (not implemented)
- Portfolio-level caps (not implemented)
- Learning density gate (not implemented)

---

### H4: Error Handling & Retry Logic

**Answer**: ✅ **CONFIRMED** - Basic error handling, no retry logic:

**Current Error Handling**:
```typescript
// Standard Express error handling
catch (err) {
  console.error('terminal.simulate error', err);
  return res.status(500).json({ 
    code: 'internal_error', 
    message: 'Simulation failed' 
  });
}
```

**No Retry Logic**:
- ❌ No retry for failed operations
- ❌ No exponential backoff
- ❌ No circuit breaker
- ✅ Basic try/catch only

**Implications**:
- Need to add retry logic for Meta API calls (when implemented)
- Need to add circuit breaker for resilience
- Need structured error responses

---

## Key Findings Summary

### ✅ What EXISTS:
1. Terminal routes in Liftoff (`/api/terminal/*`)
2. Decision generation (`/suggest` endpoint)
3. Cooldown management (file-based)
4. Policy learning (`/learn` endpoint)
5. State inspection (`/state` endpoint)
6. Decision schema well-defined

### ❌ What's MISSING:
1. **Meta API execution** - Terminal doesn't actually call Facebook API
2. **Async job pattern** - No job IDs or polling
3. **`/execute` endpoint** - Only `/suggest` + `/applied` pattern
4. **Freeze period guards** - Not implemented
5. **Signal health checks** - Not implemented
6. **Retry logic** - Basic error handling only

### ⚠️ What Needs CLARIFICATION:
1. **Is Terminal moving to strateg.is?** - Current implementation is in Liftoff
2. **When will Meta API execution be added?** - Critical gap
3. **Do we need async jobs?** - Depends on execution time
4. **Do we need pause/resume actions?** - PRD mentions but not implemented

---

## Recommended Integration Approach

### Option 1: Keep Terminal in Liftoff (Simplest)
**Pros**:
- No HTTP client needed
- Direct function calls
- Shared state access
- Faster development

**Cons**:
- Tight coupling
- Can't scale independently
- strateg.is can't use Terminal directly

**Implementation**:
```typescript
// In Strategist route
import { loadCooldowns } from '../lib/state';
import { writeDecisionBatch } from '../lib/decisions';

// Direct function calls, no HTTP
const cooldowns = loadCooldowns();
const decisions = generateDecisions(recommendations, cooldowns);
writeDecisionBatch(date, decisions, summary);
```

### Option 2: Move Terminal to strateg.is (Future)
**Pros**:
- Service independence
- Can scale separately
- strateg.is can use directly
- Better separation of concerns

**Cons**:
- Need HTTP client
- Need state synchronization
- More complex
- Migration effort

**Implementation**:
- Use HTTP client (as in playbook)
- Add state sync mechanism
- Implement async jobs if needed

---

## Next Steps

### Immediate (This Week):
1. ✅ **Answer**: Terminal is in Liftoff, not strateg.is
2. ✅ **Answer**: No `/execute` endpoint - use `/suggest` + `/applied`
3. ✅ **Answer**: Decision schema confirmed
4. ⚠️ **CLARIFY**: Is Terminal moving to strateg.is?

### Short Term (Next 2 Weeks):
1. **Add Meta API execution** - Critical missing piece
2. **Decide on architecture** - Stay in Liftoff or move to strateg.is?
3. **Implement integration** - Based on architecture decision
4. **Add missing guards** - Freeze periods, signal health, etc.

### Medium Term (Next Month):
1. **Add async jobs** - If execution takes time
2. **Add retry logic** - For Meta API resilience
3. **Add observability** - Metrics and logging
4. **Production deployment** - With monitoring

---

## Updated Questions for Devin

Based on codebase analysis, here are the **REAL** questions we need answered:

1. **Architecture Decision**: Is Terminal staying in Liftoff or moving to strateg.is?
2. **Meta API Execution**: When will Terminal actually execute Meta API calls?
3. **Async Pattern**: Do we need async jobs, or is synchronous OK?
4. **Missing Guards**: When will freeze periods, signal health, etc. be implemented?
5. **Pause/Resume**: Do we need these actions, or just budget changes?

---

## References

- Terminal Routes: `backend/src/routes/terminal.ts` (lines 1-677)
- Decision Schema: `backend/src/lib/decisions.ts` (lines 1-67)
- State Management: `backend/src/lib/state.ts` (lines 1-64)
- Strategist Routes: `backend/src/routes/strategist.ts`



