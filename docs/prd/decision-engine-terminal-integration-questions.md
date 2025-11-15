# Decision Engine → Terminal Integration: Questions for Devin

## Document Purpose
This document outlines critical questions for Devin (strateg.is) to establish how Decision Engine (Liftoff) should integrate with Terminal (strateg.is) to execute Facebook campaign budget and bid changes.

**Status**: 🔴 **CRITICAL QUESTIONS** - Need answers before implementation  
**Date**: 2025-01-XX  
**Owner**: Engineering (Platform)

---

## Current Architecture Clarification

### What We Have (Liftoff)
- **Decision Engine** (`/api/decision-engine/*`):
  - Generates Decision objects via `/suggest`
  - Applies policies (Kelly, UCB, lane-specific)
  - Enforces cooldowns and confidence gates
  - Writes Decision files to `data/decisions/`
  - **Does NOT execute Meta API calls**

### What We Need (strateg.is)
- **Terminal Service**:
  - Accepts Decision objects
  - Executes changes via Meta Ads API
  - Enforces execution-time guards
  - Returns execution results

---

## CRITICAL Questions for Devin

### Q1: Terminal Service Location & API

**Question**: Where is Terminal actually hosted, and what is its API contract?

**Context**: 
- PRD mentions Terminal as a strateg.is service
- But we see Terminal routes in Liftoff (`backend/src/routes/decisionEngine.ts` - formerly terminal.ts)
- Need to understand: Is Terminal a separate service, or part of Liftoff?

**Specifics Needed**:
- [ ] **Is Terminal a separate HTTP service in strateg.is?**
  - If yes: What's the base URL? (`https://terminal-api.strategis.internal`?)
  - If no: Is it part of Liftoff backend?
  
- [ ] **What is the exact API contract for execution?**
  - Endpoint: `POST /api/terminal/execute`?
  - Request format: Decision objects?
  - Response format: Job ID? Synchronous or async?
  
- [ ] **Authentication**: How does Liftoff authenticate to Terminal?
  - Service token? API key? OAuth?
  - Where do we get credentials?

---

### Q2: Decision Execution Endpoint

**Question**: Does Terminal have a `/execute` endpoint that accepts Decision objects and executes them via Meta API?

**Context**: 
- Decision Engine generates Decision objects with:
  - `id` (adset_id or campaign_id)
  - `level` ('adset' | 'campaign')
  - `action` ('bump_budget' | 'trim_budget' | 'hold')
  - `budget_multiplier` (e.g., 1.2 for +20%)
  - `bid_cap_multiplier` (e.g., 0.9 for -10%)
  - `reason`, `date`, `snapshot_dir`, etc.

**Specifics Needed**:
- [ ] **Does `POST /api/terminal/execute` exist?**
  - If yes: What's the exact request/response schema?
  - If no: What endpoint should we use?
  
- [ ] **Request Format**:
```typescript
// Is this correct?
POST /api/terminal/execute
{
  decisions: Decision[];
  idempotencyKey: string;
  dryRun?: boolean;
  correlationId?: string;
}
```

- [ ] **Response Format**:
```typescript
// Is this correct?
{
  jobId: string;  // For async execution?
  acceptedCount: number;
  rejected: Array<{ decision_id: string; reason: string }>;
  // Or synchronous results?
}
```

- [ ] **Execution Model**: Synchronous or async?
  - If async: How do we poll for job status?
  - Endpoint: `GET /api/terminal/jobs/:jobId`?

---

### Q3: Meta API Execution Details

**Question**: How does Terminal actually execute changes via Meta Ads API?

**Context**: Decision Engine generates decisions like:
- `bump_budget` with `budget_multiplier: 1.2` → increase budget by 20%
- `trim_budget` with `budget_multiplier: 0.8` → decrease budget by 20%
- `bid_cap_multiplier: 0.9` → decrease bid cap by 10%

**Specifics Needed**:
- [ ] **How does Terminal convert `budget_multiplier` to actual budget?**
  - Does Terminal fetch current budget from Meta API first?
  - Formula: `new_budget = current_budget * budget_multiplier`?
  
- [ ] **Campaign vs Ad Set Level**:
  - Campaign budget: `PATCH /{campaign_id}` with `daily_budget`?
  - Ad Set budget: `PATCH /{adset_id}` with `daily_budget`?
  - Ad Set bid cap: `PATCH /{adset_id}` with `bid_amount`?
  
- [ ] **Meta API Calls**:
  - Which endpoints does Terminal call?
  - How does Terminal handle Meta API errors (429, 5xx)?
  - Retry logic? Backoff strategy?
  
- [ ] **Idempotency**: 
  - How does Terminal ensure idempotent execution?
  - Uses `idempotencyKey` from request?

---

### Q4: Execution Guards & Safety

**Question**: What guards does Terminal enforce before executing?

**Context**: Decision Engine already applies some guards (cooldowns, confidence), but Terminal should have execution-time guards too.

**Specifics Needed**:
- [ ] **What guards does Terminal check?**
  - Cooldowns? (Does Terminal maintain its own cooldown registry?)
  - Freeze periods? (48-72h post-launch freeze?)
  - Signal health? (Learning Limited status?)
  - Portfolio caps? (Max budget changes per day?)
  
- [ ] **Guard Violations**:
  - How are rejected decisions communicated?
  - In response? Via separate endpoint?
  
- [ ] **Dry Run Mode**:
  - Does Terminal support `dryRun: true`?
  - What does dry-run return? (Simulated results?)

---

### Q5: State Synchronization

**Question**: How do we keep Decision Engine and Terminal state in sync?

**Context**: 
- Decision Engine maintains cooldowns in `data/terminal_state/cooldowns.json`
- Decision Engine maintains policy state in `data/terminal_state/policy_state.json`
- Terminal might maintain its own state

**Specifics Needed**:
- [ ] **Does Terminal maintain its own cooldown registry?**
  - If yes: How do we sync?
  - If no: Does Terminal read from Decision Engine's state?
  
- [ ] **After Execution**:
  - Does Terminal update cooldowns?
  - Should Decision Engine call `/applied` endpoint after Terminal executes?
  - Or does Terminal automatically update cooldowns?
  
- [ ] **State Storage**:
  - Where does Terminal store state? (Redis? PostgreSQL? Files?)
  - Can Decision Engine read Terminal's state?

---

### Q6: Error Handling & Observability

**Question**: How do we handle errors and track execution?

**Specifics Needed**:
- [ ] **Error Responses**:
  - What happens if Terminal is unavailable?
  - What happens if Meta API call fails?
  - Partial failures? (Some decisions succeed, some fail?)
  
- [ ] **Audit Trail**:
  - Does Terminal log all executions?
  - Can we query execution history?
  - Endpoint: `GET /api/terminal/actions`?
  
- [ ] **Observability**:
  - Metrics? (Success rate, latency, etc.)
  - Logs? (Where? Format?)
  - Alerts? (How are we notified of failures?)

---

## Proposed Integration Flow

Based on our understanding, here's what we think the flow should be:

```
1. Decision Engine generates decisions
   POST /api/decision-engine/suggest
   → Returns Decision[] objects

2. Decision Engine sends decisions to Terminal
   POST /api/terminal/execute (strateg.is)
   {
     decisions: Decision[],
     idempotencyKey: string,
     dryRun: false
   }
   → Returns { jobId: string, acceptedCount: number, rejected: [...] }

3. Terminal executes via Meta API
   - Validates guards
   - Calls Meta Ads API for each decision
   - Updates cooldowns
   - Logs results

4. Decision Engine polls for completion (if async)
   GET /api/terminal/jobs/:jobId
   → Returns { status: 'completed', results: [...] }

5. Decision Engine marks as applied
   POST /api/decision-engine/applied
   → Updates local cooldowns
```

**Questions**:
- [ ] Is this flow correct?
- [ ] What needs to change?
- [ ] Are we missing any steps?

---

## Implementation Priorities

### Phase 1: Basic Execution (MVP)
1. ✅ Decision Engine generates decisions (DONE)
2. ❌ Terminal `/execute` endpoint (NEEDED)
3. ❌ Decision Engine → Terminal HTTP client (NEEDED)
4. ❌ Meta API execution in Terminal (NEEDED)

### Phase 2: Async & Observability
1. ❌ Async job pattern (if needed)
2. ❌ Job status polling
3. ❌ Error handling & retries
4. ❌ Metrics & logging

### Phase 3: Production Hardening
1. ❌ State synchronization
2. ❌ Guard enforcement
3. ❌ Audit trail
4. ❌ Monitoring & alerts

---

## Next Steps

1. **Schedule call with Devin** to answer these questions
2. **Confirm Terminal API contract** - Get exact schemas
3. **Build Terminal HTTP client** in Decision Engine
4. **Implement `/execute` endpoint** in Terminal (if missing)
5. **Test end-to-end flow** with dry-run mode first

---

## Related Documents

- **Terminal PRD**: `docs/prd/terminal-facebook-bidder-prd.md`
- **Integration Playbook**: `docs/operations/terminal-strategist-integration-playbook.md`
- **Previous Q&A**: `docs/prd/terminal-strategist-integration-qa.md`
- **Architecture Comparison**: `docs/prd/strategist-vs-decider-comparison.md`

