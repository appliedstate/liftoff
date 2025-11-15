# Terminal-Strategist Integration Q&A

## Document Purpose
This document outlines critical questions for Devin (strateg.is code agent) to establish a complete understanding of how Terminal and Strategist systems can work together to execute Facebook campaign changes. The goal is to build a seamless integration where Strategist analyzes performance and generates recommendations, while Terminal executes those changes with proper safety guards.

---

## System Overview

### Terminal (hosted in strateg.is)
- **Location**: Hosted in strateg.is system
- **Role**: Execution engine — executes budget and bid changes
- **Capabilities**:
  - Budget adjustments (bump/trim)
  - Bid cap adjustments
  - Pause/unpause campaigns and ad sets
  - Cooldown management
  - Safety guards and freeze periods
- **PRD**: `docs/prd/terminal-facebook-bidder-prd.md`
- **Routes**: `backend/src/routes/terminal.ts` (in Liftoff, but interfaces with strateg.is Terminal)

### Strategist (built in Liftoff)
- **Location**: `backend/src/routes/strategist.ts` in Liftoff codebase
- **Role**: Decision/recommendation engine — analyzes performance and generates recommendations
- **Capabilities**:
  - Query reconciled performance data
  - Generate recommendations (`/recommendations` endpoint)
  - Chat interface for analysis (`/chat` endpoint)
  - Performance monitoring and SLO evaluation
  - Can trigger Terminal actions via `/exec` endpoint (currently limited)

---

## Role Division

**Strategist (Liftoff)**:
- Analyzes performance data
- Generates recommendations (bump/trim/hold decisions)
- Evaluates gates (signal health, learning density, ROAS thresholds)
- Provides chat interface for human analysis
- Monitors SLOs and data quality

**Terminal (strateg.is)**:
- Executes the actual budget/bid changes
- Enforces cooldowns and safety guards
- Manages freeze periods
- Applies changes to Facebook campaigns/ad sets via Meta Ads API
- Logs all actions for audit trail

**Flow**: Strategist analyzes → generates recommendations → Terminal executes (with guards)

---

## SYSTEMATIC QUESTIONS

### 1. Architecture & Deployment

**Q1.1**: Where exactly is Terminal hosted? Is it:
- A separate service/API in strateg.is infrastructure?
- Part of the same Liftoff backend but with different routing?
- A completely independent system that Liftoff calls via HTTP?

**Q1.2**: What is the network topology between Liftoff and strateg.is Terminal?
- Same VPC/network?
- Public API endpoints?
- Private service mesh?
- Authentication mechanism (API keys, OAuth, service accounts)?

**Q1.3**: Is Terminal a stateless service or does it maintain state?
- Where does it store cooldowns, policy state, and decision logs?
- Does it share state with Liftoff or maintain its own database?

**Q1.4**: What is the deployment model?
- Containerized service?
- Cron job?
- Long-running service?
- How does it scale?

### 2. Data Flow & Integration Points

**Q2.1**: How should Strategist pass recommendations to Terminal?
- Direct HTTP API calls from Strategist to Terminal endpoints?
- Message queue (RabbitMQ, SQS, etc.)?
- Shared database/state store?
- File-based handoff (decisions written to shared storage)?

**Q2.2**: What is the exact API contract between Strategist and Terminal?
- Request format for execution requests?
- Response format (success/failure, change logs)?
- Error handling and retry logic?
- Idempotency keys?

**Q2.3**: How does Terminal access the same reconciled data that Strategist uses?
- Does Terminal query Liftoff's `/api/strategist/reconciled` endpoint?
- Does Terminal have direct access to snapshot storage?
- Is there a shared data layer?

**Q2.4**: What is the decision format that Terminal expects?
- Does it match the `Decision` type in `backend/src/lib/decisions.ts`?
- Are there additional fields required?
- How are batch decisions handled?

### 3. Execution Flow & Orchestration

**Q3.1**: What triggers Terminal execution?
- Scheduled cron job (daily at 07:15)?
- On-demand API calls from Strategist?
- Webhook from Strategist when recommendations are ready?
- Manual trigger?

**Q3.2**: What is the complete execution flow?
1. Strategist generates recommendations → where are they stored?
2. Terminal reads recommendations → from where?
3. Terminal validates and applies guards → what happens if guards fail?
4. Terminal executes changes → how are results communicated back?
5. Terminal logs actions → where and in what format?

**Q3.3**: How does Terminal handle partial failures?
- If 10 recommendations are sent, but 3 fail guards, what happens?
- Does Terminal continue with the remaining 7?
- How are failures reported back to Strategist?

**Q3.4**: What is the dry-run vs. live execution model?
- How does Terminal distinguish between dry-run and live?
- Can Strategist request dry-run mode?
- How are dry-run results formatted?

### 4. State Management & Cooldowns

**Q4.1**: Where is cooldown state stored?
- Terminal's own storage (`data/terminal_state/cooldowns.json`)?
- Shared database?
- How does Strategist know if an entity is in cooldown before generating recommendations?

**Q4.2**: How is policy state synchronized?
- Terminal maintains `policy_state.json` — does Strategist need access to this?
- Should Strategist respect Terminal's policy state when generating recommendations?
- How is policy state updated after Terminal learns from outcomes?

**Q4.3**: What happens when Terminal updates cooldowns after execution?
- Does Strategist need to be notified?
- Should Strategist query Terminal's `/api/terminal/state` endpoint before generating new recommendations?
- Is there a cache invalidation mechanism?

### 5. Safety Guards & Validation

**Q5.1**: What guards does Terminal enforce that Strategist should also check?
- Cooldowns (already checked in Terminal `/simulate`)
- Freeze periods (48-72h post-launch)
- Signal health (EMQ p50 ≥ 5, latency p50 ≤ 300s)
- Learning phase status
- Portfolio-level caps

**Q5.2**: Should Strategist pre-validate recommendations against Terminal's guards?
- Call Terminal `/simulate` before generating final recommendations?
- Or let Terminal handle all validation?

**Q5.3**: How are freeze periods tracked?
- Where is launch date stored?
- How does Strategist know if an entity is in freeze period?
- Should Strategist filter frozen entities from recommendations?

**Q5.4**: What is the relationship between Strategist's SLO evaluation and Terminal's guards?
- If Strategist's SLO check fails, should it prevent calling Terminal?
- Or does Terminal have its own independent SLO checks?

### 6. Error Handling & Observability

**Q6.1**: How are execution errors communicated?
- HTTP status codes?
- Structured error responses?
- Webhook callbacks?
- Log aggregation system?

**Q6.2**: What observability exists for the integration?
- Logs for Strategist → Terminal calls?
- Metrics for execution success/failure rates?
- Tracing for end-to-end flow?
- Alerts for failures?

**Q6.3**: How are audit trails maintained?
- Terminal logs actions — where?
- Does Strategist log when it calls Terminal?
- How are these logs correlated?

---

## TECHNICAL QUESTIONS

### 7. API Endpoints & Contracts

**Q7.1**: What are the exact Terminal endpoints that Strategist should call?
- Current Terminal routes in Liftoff: `/simulate`, `/suggest`, `/applied`, `/learn`, `/state`, `/reconciled`, `/summary`
- Are these the same endpoints in strateg.is Terminal?
- Are there additional execution endpoints not yet in Liftoff?

**Q7.2**: What is the `/execute` endpoint mentioned in the PRD?
- The PRD mentions `POST /api/terminal/execute` — does this exist?
- What is the request/response format?
- How does it differ from `/suggest` + `/applied`?

**Q7.3**: How should Strategist call Terminal endpoints?
- Direct HTTP calls using `axios`/`fetch`?
- Is there a shared client library?
- What authentication is required?

**Q7.4**: What is the relationship between Terminal routes in Liftoff vs. strateg.is?
- `backend/src/routes/terminal.ts` exists in Liftoff — is this a proxy?
- Or is this the actual Terminal implementation that will be moved to strateg.is?
- Should Strategist call local Terminal routes or remote strateg.is endpoints?

### 8. Decision Format & Schema

**Q8.1**: What is the exact Decision schema that Terminal expects?
```typescript
// From backend/src/lib/decisions.ts
type Decision = {
  decision_id: string;
  id: string;
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
- Is this the correct format?
- Are there additional required fields?
- What are valid values for `action`? (pause/resume mentioned in PRD)

**Q8.2**: How are batch decisions handled?
- Can Strategist send multiple decisions in one API call?
- What is the maximum batch size?
- How are partial failures handled in batches?

**Q8.3**: How does Terminal interpret `budget_multiplier`?
- Is it applied to current budget from Facebook API?
- Or is it applied to a budget value in the decision?
- What happens if current budget differs from expected?

**Q8.4**: What is the relationship between `budget_multiplier` and `spend_delta_usd`?
- Should Strategist provide both?
- Which takes precedence?
- How does Terminal calculate actual budget change?

### 9. Cooldown & State Synchronization

**Q9.1**: How should Strategist check cooldowns before generating recommendations?
- Call Terminal `/api/terminal/state` to get cooldowns?
- Cache cooldown state locally?
- How often should cooldown state be refreshed?

**Q9.2**: What happens when Terminal updates cooldowns after execution?
- Does Terminal notify Strategist?
- Should Strategist poll Terminal state?
- Is there a webhook mechanism?

**Q9.3**: How is policy state (`policy_state.json`) used?
- Should Strategist read this before generating recommendations?
- Does Terminal's `/simulate` endpoint use this automatically?
- How does Strategist's recommendation logic align with Terminal's policy state?

**Q9.4**: What is the `/learn` endpoint and how does it relate to Strategist?
- Terminal `/learn` updates policy state from decisions + outcomes
- Should Strategist trigger this?
- Or is it a separate scheduled process?

### 10. Execution Flow Implementation

**Q10.1**: What is the recommended flow for Strategist to execute recommendations?
1. Strategist generates recommendations via `/recommendations`
2. Strategist calls Terminal `/simulate` to validate?
3. Strategist calls Terminal `/execute` (or `/suggest` + `/applied`)?
4. Terminal executes and updates cooldowns
5. How does Strategist know execution completed?

**Q10.2**: How should Strategist's `/exec` endpoint integrate with Terminal?
- Currently `/exec` only allows allowlisted commands (echo, node, ts-node)
- Should it be extended to call Terminal endpoints?
- Or should Strategist call Terminal directly without `/exec`?

**Q10.3**: What is the difference between Terminal `/suggest` and `/simulate`?
- `/simulate` takes rows and returns intents
- `/suggest` reads from snapshots and writes decisions
- Should Strategist use one or both?

**Q10.4**: How does Terminal's `/applied` endpoint work?
- It marks decisions as applied and updates cooldowns
- Should Strategist call this after Terminal executes?
- Or does Terminal call this automatically?

### 11. Data Access & Snapshots

**Q11.1**: How does Terminal access reconciled snapshots?
- Does it call Strategist `/api/strategist/reconciled`?
- Or does it have direct access to snapshot storage?
- What is the snapshot path format it expects?

**Q11.2**: What is the relationship between Terminal's `/reconciled` endpoint and Strategist's `/reconciled`?
- Are they accessing the same data?
- Should they be unified?
- Or is Terminal's endpoint for strateg.is-specific use?

**Q11.3**: How does Terminal know which snapshot to use?
- Does it use `latestSnapshotDir()` like Strategist?
- How does it handle date selection?
- What happens if snapshot is not ready?

### 12. Safety Guards Implementation

**Q12.1**: How are freeze periods tracked and checked?
- Where is launch date stored?
- Does Terminal check freeze periods automatically?
- Should Strategist also check before generating recommendations?

**Q12.2**: How is signal health checked?
- PRD mentions EMQ p50 ≥ 5, latency p50 ≤ 300s
- Where is this data stored?
- Does Terminal query this, or should Strategist provide it?

**Q12.3**: How are portfolio-level guards enforced?
- Never pause all prospecting lanes
- Per-account and per-lane daily spend caps
- Does Terminal enforce these, or should Strategist pre-filter?

**Q12.4**: What is the learning density gate?
- PRD mentions "pace ≥ 50 events/ad set/week"
- Where is this calculated?
- Should Strategist check this before recommending bumps?

### 13. Error Handling & Retries

**Q13.1**: What happens when Terminal API calls fail?
- Network errors
- Terminal service down
- Invalid request format
- How should Strategist handle these?

**Q13.2**: What is Terminal's retry logic?
- Does Terminal retry failed Meta API calls?
- How many retries?
- What backoff strategy?

**Q13.3**: How are Meta API errors handled?
- Rate limits (429)
- Invalid entity IDs
- Budget too low/high
- Does Terminal handle these gracefully?

**Q13.4**: What is the idempotency model?
- PRD mentions idempotency keys
- How are they generated?
- How does Terminal ensure idempotency?

### 14. Testing & Development

**Q14.1**: How can we test the integration locally?
- Can Terminal run locally?
- Mock Terminal endpoints?
- Test data setup?

**Q14.2**: What is the dry-run mode?
- How is it enabled?
- Does it prevent actual Meta API calls?
- How are dry-run results formatted?

**Q14.3**: How do we validate the integration?
- End-to-end tests?
- Integration tests?
- Manual testing procedures?

---

## INTEGRATION DESIGN QUESTIONS

### 15. Proposed Integration Patterns

**Q15.1**: Should Strategist call Terminal synchronously or asynchronously?
- Synchronous: Strategist waits for Terminal execution to complete
- Asynchronous: Strategist submits recommendations, Terminal processes later
- Hybrid: Strategist submits, Terminal processes, webhook callback

**Q15.2**: Should there be a recommendation queue?
- Strategist generates recommendations → queue
- Terminal polls queue → executes
- Benefits: decoupling, retry, rate limiting

**Q15.3**: Should Strategist and Terminal share a database?
- Shared state for cooldowns, policy, decisions
- Benefits: consistency, no sync issues
- Drawbacks: tight coupling

**Q15.4**: Should Terminal be called directly or via a proxy?
- Direct HTTP calls from Strategist to Terminal
- Proxy layer in Liftoff (`/api/terminal/*` routes)
- Benefits: authentication, logging, rate limiting

### 16. Current Implementation Gaps

**Q16.1**: What is missing in the current implementation?
- Strategist `/exec` doesn't call Terminal endpoints
- No direct integration between Strategist recommendations and Terminal execution
- Terminal routes exist in Liftoff but may not be the actual strateg.is Terminal

**Q16.2**: What needs to be built?
- HTTP client in Strategist to call Terminal APIs
- Recommendation → Decision conversion logic
- Error handling and retry logic
- State synchronization mechanism

**Q16.3**: What needs to be clarified?
- Exact API contracts
- Authentication mechanism
- Deployment topology
- State management approach

---

## NEXT STEPS

After Devin answers these questions, we should:

1. **Create Integration Specification**
   - Define exact API contracts
   - Document request/response formats
   - Specify error handling

2. **Design State Synchronization**
   - How cooldowns are shared
   - How policy state is synchronized
   - How decisions are tracked

3. **Implement Integration Layer**
   - HTTP client for Terminal calls
   - Recommendation → Decision conversion
   - Error handling and retries

4. **Build Runbook**
   - Document responsibilities
   - Define handoff points
   - Specify error recovery procedures

5. **Test Integration**
   - Unit tests
   - Integration tests
   - End-to-end validation

---

## References

- Terminal PRD: `docs/prd/terminal-facebook-bidder-prd.md`
- Terminal Routes: `backend/src/routes/terminal.ts`
- Strategist Routes: `backend/src/routes/strategist.ts`
- Decision Schema: `backend/src/lib/decisions.ts`
- State Management: `backend/src/lib/state.ts`

