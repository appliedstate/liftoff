# Terminal-Strategist Integration: Follow-Up Questions for Devin

## Document Purpose
This document contains critical follow-up questions based on Devin's initial responses. These questions address **MISSING** items and **PROPOSED** assumptions that need confirmation before full implementation.

**Priority Legend:**
- 🔴 **CRITICAL**: Blocks implementation, must answer before Phase 1
- 🟡 **HIGH**: Important for Phase 2, should answer soon
- 🟢 **MEDIUM**: Nice to have, can proceed with assumptions

---

## CRITICAL Questions (Block Phase 1)

### C1: Terminal Service Location & Access

**Question**: Where exactly is the Terminal service hosted, and how do we access it?

**Context**: Devin's response says "PROPOSED: Independent HTTP service in strategis infrastructure" but we need:
- Exact URL or DNS name
- Network topology (private vs public)
- Current authentication mechanism
- Whether it exists today or needs to be built

**Specifics Needed**:
- [ ] Terminal service base URL
- [ ] Authentication method (API key, OAuth, service account)
- [ ] Network access requirements (VPN, VPC peering, public HTTPS)
- [ ] Current deployment status (exists vs needs building)

**Impact**: Cannot implement HTTP client without this information.

---

### C2: API Contract Confirmation

**Question**: Can you confirm the exact API contract for Terminal endpoints?

**Context**: Devin provided PROPOSED contracts, but we need confirmation:
- Do these endpoints exist today?
- Are request/response formats correct?
- What are the actual error response formats?

**Specifics Needed**:
- [ ] `POST /api/terminal/simulate` - exact request/response schema
- [ ] `POST /api/terminal/execute` - exact request/response schema
- [ ] `GET /api/terminal/jobs/:jobId` - exact response schema
- [ ] `GET /api/terminal/state` - exact response schema
- [ ] Error response format (structured errors vs HTTP codes only)

**Impact**: Cannot implement client without confirmed contracts.

---

### C3: Decision Schema Validation

**Question**: Is the Decision schema in `backend/src/lib/decisions.ts` the correct format Terminal expects?

**Context**: We have a Decision type in Liftoff, but need to confirm:
- Are all fields required?
- Are there additional fields Terminal needs?
- What are valid `action` values? (pause/resume mentioned in PRD)

**Specifics Needed**:
- [ ] Confirm Decision schema matches Terminal expectations
- [ ] List any additional required fields
- [ ] Valid action values (bump_budget, trim_budget, hold, pause, resume, adjust_bid_cap?)
- [ ] Required vs optional fields

**Impact**: Recommendations won't execute if schema mismatch.

---

### C4: Current Terminal Implementation Status

**Question**: What is the current state of Terminal implementation?

**Context**: We see Terminal routes in Liftoff (`backend/src/routes/terminal.ts`), but:
- Is this a proxy to strateg.is Terminal?
- Is this the actual implementation?
- What's the relationship between Liftoff routes and strateg.is service?

**Specifics Needed**:
- [ ] Current implementation location (Liftoff vs strateg.is)
- [ ] Migration plan (if moving from Liftoff to strateg.is)
- [ ] Compatibility requirements during transition
- [ ] Which endpoints are production-ready today?

**Impact**: Determines integration approach and migration path.

---

## HIGH Priority Questions (Block Phase 2)

### H1: State Storage & Synchronization

**Question**: How is state (cooldowns, policy) actually stored and synchronized?

**Context**: Devin PROPOSED Redis + PostgreSQL, but we need:
- Current implementation details
- How Strategist should access state
- Cache invalidation mechanism
- State ownership (Terminal authoritative?)

**Specifics Needed**:
- [ ] Current storage implementation (files vs database vs Redis)
- [ ] How Strategist should read cooldowns (API vs direct access)
- [ ] Cache invalidation strategy (events vs polling vs TTL)
- [ ] State ownership model (Terminal authoritative?)

**Impact**: Affects Phase 2 state synchronization implementation.

---

### H2: Execution Flow Confirmation

**Question**: What is the actual execution flow today vs proposed?

**Context**: Devin PROPOSED async job pattern, but we need:
- Does Terminal support async jobs today?
- Or is it synchronous?
- How should Strategist handle execution?

**Specifics Needed**:
- [ ] Current execution model (sync vs async)
- [ ] Job ID pattern (if async)
- [ ] Polling mechanism (if async)
- [ ] Timeout expectations

**Impact**: Determines Phase 2 async implementation approach.

---

### H3: Guard Implementation Details

**Question**: What guards are actually implemented in Terminal today?

**Context**: PRD mentions many guards, but we need:
- Which are implemented?
- Which are planned?
- How are they configured?

**Specifics Needed**:
- [ ] Cooldown implementation status
- [ ] Freeze period implementation status
- [ ] Signal health check implementation
- [ ] Portfolio-level guard implementation
- [ ] Learning density gate implementation
- [ ] Configuration mechanism (env vars vs config file vs API)

**Impact**: Affects recommendation filtering and validation logic.

---

### H4: Error Handling & Retry Logic

**Question**: What is Terminal's actual error handling and retry behavior?

**Context**: Devin PROPOSED retry logic, but we need:
- Current implementation
- Meta API error handling
- Idempotency implementation

**Specifics Needed**:
- [ ] Retry logic for Terminal API calls
- [ ] Retry logic for Meta API calls (in Terminal)
- [ ] Idempotency key format and handling
- [ ] Error response structure
- [ ] Rate limit handling

**Impact**: Affects error handling and reliability.

---

## MEDIUM Priority Questions (Nice to Have)

### M1: Observability & Monitoring

**Question**: What observability exists today for Terminal?

**Context**: Need to understand:
- Logging format
- Metrics available
- Tracing support

**Specifics Needed**:
- [ ] Log format and location
- [ ] Available metrics
- [ ] Distributed tracing support
- [ ] Alert configuration

**Impact**: Helps with monitoring and debugging.

---

### M2: Testing Infrastructure

**Question**: How can we test Terminal integration locally?

**Context**: Need to set up local testing:
- Mock Terminal service?
- Test Terminal instance?
- Sandbox Meta account?

**Specifics Needed**:
- [ ] Local Terminal setup instructions
- [ ] Mock Terminal service availability
- [ ] Test Meta account setup
- [ ] Integration test examples

**Impact**: Enables faster development and testing.

---

### M3: Performance & Scaling

**Question**: What are Terminal's performance characteristics?

**Context**: Need to understand:
- Expected latency
- Throughput limits
- Scaling behavior

**Specifics Needed**:
- [ ] Expected API latency (p50, p99)
- [ ] Maximum batch size
- [ ] Rate limits
- [ ] Scaling strategy

**Impact**: Helps with capacity planning and optimization.

---

## Questions About PROPOSED Answers

### P1: Async Job Pattern

**Question**: Devin PROPOSED async job pattern with polling. Is this the right approach?

**Alternatives to Consider**:
- Synchronous execution (simpler, but blocking)
- Webhook callbacks (more efficient, but requires webhook infrastructure)
- Message queue (better for high volume, but more complex)

**Need Confirmation**: Which approach should we use?

---

### P2: State Caching Strategy

**Question**: Devin PROPOSED 5-minute TTL cache. Is this appropriate?

**Considerations**:
- Cooldowns update immediately after execution
- 5-minute cache might miss recent updates
- Should we use cache invalidation events instead?

**Need Confirmation**: Cache TTL vs event-based invalidation?

---

### P3: Pre-Validation Strategy

**Question**: Devin PROPOSED optional pre-validation with `/simulate`. When should we use it?

**Considerations**:
- Adds latency but reduces failed executions
- Useful for user-facing interfaces
- May be unnecessary for automated flows

**Need Confirmation**: When to use pre-validation?

---

## Questions About Integration Approach

### I1: Direct Calls vs Proxy

**Question**: Should Strategist call Terminal directly or via Liftoff proxy?

**Context**: Terminal routes exist in Liftoff. Should we:
- Call strateg.is Terminal directly?
- Use Liftoff `/api/terminal/*` routes as proxy?
- Migrate routes from Liftoff to strateg.is?

**Need Confirmation**: Recommended integration pattern?

---

### I2: Recommendation Storage

**Question**: Where should Strategist store recommendations before execution?

**Considerations**:
- In-memory (simple, but lost on restart)
- Database (persistent, but requires schema)
- File system (matches current decision storage)

**Need Confirmation**: Storage location for recommendations?

---

### I3: Execution Trigger

**Question**: What should trigger execution?

**Options**:
- On-demand API calls from Strategist
- Scheduled cron job
- Webhook from Strategist
- Manual trigger

**Need Confirmation**: Recommended trigger mechanism?

---

## Questions About Missing Features

### F1: Freeze Period Tracking

**Question**: How are freeze periods actually tracked?

**Context**: PRD mentions 48-72h freeze, but:
- Where is launch date stored?
- How does Terminal check freeze status?
- Should Strategist also check?

**Need Confirmation**: Freeze period implementation details?

---

### F2: Signal Health Data

**Question**: Where does signal health data come from?

**Context**: PRD mentions EMQ p50 ≥ 5, latency p50 ≤ 300s, but:
- Where is this data stored?
- How does Terminal access it?
- Should Strategist provide it?

**Need Confirmation**: Signal health data source and format?

---

### F3: Learning Loop

**Question**: How does the `/learn` endpoint work?

**Context**: Terminal `/learn` updates policy state, but:
- What triggers it?
- What data does it need?
- How does Strategist provide outcome data?

**Need Confirmation**: Learning loop implementation and integration?

---

## Summary of Information Needed

### Before Phase 1 (CRITICAL)
1. ✅ Terminal service URL and authentication
2. ✅ Confirmed API contracts
3. ✅ Decision schema validation
4. ✅ Current implementation status

### Before Phase 2 (HIGH)
1. ✅ State storage details
2. ✅ Execution flow confirmation
3. ✅ Guard implementation status
4. ✅ Error handling details

### Before Production (MEDIUM)
1. ✅ Observability setup
2. ✅ Testing infrastructure
3. ✅ Performance characteristics

---

## Next Steps

1. **Schedule follow-up session** with Devin to answer CRITICAL questions
2. **Review current Terminal code** in strateg.is to answer implementation questions
3. **Create API specification** document based on confirmed contracts
4. **Build proof-of-concept** with confirmed information
5. **Iterate** based on testing and feedback

---

## How to Use This Document

1. **For Devin**: Answer questions in order of priority (CRITICAL → HIGH → MEDIUM)
2. **For Implementation Team**: Use answers to update playbook and runbook
3. **For Product**: Use to understand integration requirements and dependencies

---

## References

- Initial Q&A: `docs/prd/terminal-strategist-integration-qa.md` (Devin's responses)
- Integration Playbook: `docs/operations/terminal-strategist-integration-playbook.md`
- Operational Runbook: `docs/operations/terminal-strategist-integration-runbook.md`
- Terminal PRD: `docs/prd/terminal-facebook-bidder-prd.md`

