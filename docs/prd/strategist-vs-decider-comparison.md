# Strategist vs Decider: What Each Does Differently

## Executive Summary

**Strategist** = **Analysis & High-Level Recommendations**
- Analyzes performance data
- Generates strategic recommendations
- Provides chat interface for human analysis
- Simple ROAS-based logic

**Decision Engine** = **Policy Application & Executable Decision Generation**
- Applies sophisticated policy rules (Kelly, UCB, lane-specific)
- Enforces operational guards (cooldowns, confidence checks)
- Generates executable Decision objects
- Persists decisions for audit trail

**Terminal** (strateg.is) = **Execution Engine**
- Takes Decision objects
- Executes via Meta Ads API
- Applies execution-time guards

---

## Detailed Comparison

### 1. **What Strategist Does That Decision Engine Doesn't**

#### Data Analysis & Querying
- ✅ **Query reconciled data** (`/query` endpoint)
  - Complex filtering (owner, lane, category, ROAS thresholds)
  - Date range queries
  - CSV/JSON export
  - Overlay reconciliation data on day snapshots

- ✅ **SLO Evaluation**
  - Checks data freshness
  - Validates completeness (null rates)
  - Validates accuracy (reconciliation consistency)
  - Blocks recommendations if SLOs fail

- ✅ **Chat Interface** (`/chat`, `/ask`)
  - LLM-powered analysis
  - Human-readable explanations
  - Interactive Q&A

- ✅ **Performance Monitoring**
  - Tracks query metrics
  - Records validation summaries
  - Health checks

#### High-Level Recommendations
- ✅ **Simple ROAS Logic**
  ```typescript
  // Strategist uses basic thresholds
  if (roas >= 1.3) → bump_budget (+20%)
  if (roas < 0.8) → trim_budget (-20%)
  else → hold
  ```

- ✅ **Signal Quality Checks**
  - Minimum clicks threshold (20)
  - Revenue signal validation
  - Budget support check

- ✅ **Read-Only Recommendations**
  - Returns recommendations in memory
  - No persistence
  - No state management

---

### 2. **What Decision Engine Does That Strategist Doesn't**

#### Sophisticated Policy Application
- ✅ **Multiple Policy Modes**
  - **Simple**: Basic ROAS thresholds
  - **Kelly**: Kelly Criterion for position sizing
  - **UCB**: Upper Confidence Bound for exploration

- ✅ **Lane-Specific Policies**
  ```typescript
  // Decider applies different thresholds per lane
  const lanePolicy = getLanePolicy(lane);
  // ASC might have roas_up: 1.3
  // LAL might have roas_up: 1.2
  // Contextual might have roas_up: 1.4
  ```

- ✅ **Policy State Integration**
  - Uses historical ROAS mean/variance
  - Confidence scaling based on update count
  - Sigma-based gating (blocks if variance too high)
  - Half-life decay for policy learning

#### Operational Guards & Safety
- ✅ **Cooldown Enforcement**
  ```typescript
  // Decider checks cooldowns before generating decisions
  if (cooldown.next_eligible_ts > now) {
    action = 'hold'; // Force hold if in cooldown
  }
  ```

- ✅ **Confidence Gating**
  ```typescript
  // Blocks decisions if insufficient data
  if (updates < minUpdates || sigma > maxSigma) {
    action = 'hold';
  }
  ```

- ✅ **Spend Delta Calculation**
  ```typescript
  // Calculates actual dollar impact
  const utilization = spend / budget;
  const spendDelta = budget * delta * utilization;
  ```

#### Decision Persistence & Audit
- ✅ **Writes Decisions to Files**
  - JSONL format for machine reading
  - CSV format for human review
  - Summary text files
  - Organized by date

- ✅ **Decision Metadata**
  - `decision_id`: Unique identifier
  - `snapshot_dir`: Links to source data
  - `policy_version`: Tracks policy used
  - `created_at`: Timestamp

- ✅ **State Management**
  - Manages cooldown registry
  - Tracks policy state per entity
  - Updates cooldowns after decisions applied

---

## Code Comparison

### Strategist `/recommendations` Logic
```typescript
// Simple, straightforward
function simulate(r: any) {
  const roas = revenue / spend;
  if (roas >= 1.3) return { action: 'bump_budget', delta: 0.2 };
  if (roas < 0.8) return { action: 'trim_budget', delta: -0.2 };
  return { action: 'hold', delta: 0 };
}
// Returns recommendations in memory
```

### Decision Engine `/suggest` Logic
```typescript
// Complex, policy-aware
function simulate_kelly(r: any) {
  const edge = roas - 1.0;
  const frac = Math.max(-0.5, Math.min(0.5, edge));
  // Kelly sizing
  if (frac > 0.05) return { action: 'bump_budget', delta: frac };
  // ...
}

// Applies policy state
const st = entityPolicy[id];
const stepScale = calculateConfidenceScale(st);
delta = delta * stepScale;

// Checks cooldowns
if (cooldowns[id]?.next_eligible_ts > now) {
  action = 'hold';
}

// Writes to files
writeDecisionBatch(date, decisions, summary);
```

---

## The Flow

```
Performance Data
    ↓
[Strategist] Analyzes & Recommends
    ├─ Queries reconciled data
    ├─ Evaluates SLOs
    ├─ Simple ROAS logic
    └─ Returns recommendations (in memory)
    ↓
[Decision Engine] Applies Rules & Generates Decisions
    ├─ Applies policy modes (Kelly/UCB)
    ├─ Lane-specific thresholds
    ├─ Policy state integration
    ├─ Cooldown checks
    ├─ Confidence gating
    ├─ Calculates spend deltas
    └─ Writes Decision objects to files
    ↓
[Terminal] Executes Decisions
    ├─ Reads Decision files
    ├─ Validates execution guards
    ├─ Calls Meta Ads API
    └─ Updates cooldowns
```

---

## Key Differences Summary

| Aspect | Strategist | Decision Engine |
|--------|-----------|---------|
| **Purpose** | Analysis & recommendations | Policy application & decision generation |
| **Complexity** | Simple ROAS logic | Sophisticated policies (Kelly, UCB) |
| **State** | Stateless (in-memory) | Stateful (cooldowns, policy) |
| **Guards** | SLO checks only | Cooldowns, confidence, policy state |
| **Persistence** | None | Writes Decision files |
| **Lane Awareness** | No | Yes (lane-specific policies) |
| **Policy Learning** | No | Yes (updates from outcomes) |
| **Human Interface** | Chat, Q&A | File-based, programmatic |
| **Output** | Recommendations | Executable Decisions |

---

## Why Two Components?

### Separation of Concerns

**Strategist** = **"What should we do?"**
- Strategic analysis
- Human-readable insights
- High-level recommendations
- Data quality validation

**Decision Engine** = **"How do we do it safely?"**
- Operational rules
- Safety guards
- Executable format
- Audit trail

**Terminal** = **"Do it."**
- Actual execution
- Meta API calls
- Execution guards

### Benefits of Separation

1. **Different Update Cadences**
   - Strategist: Analysis logic changes frequently
   - Decision Engine: Policy rules change less frequently
   - Terminal: Execution logic changes rarely

2. **Different Users**
   - Strategist: Media buyers, analysts (chat interface)
   - Decision Engine: Automated systems, scripts
   - Terminal: Execution infrastructure

3. **Different Testing Needs**
   - Strategist: Test analysis accuracy
   - Decision Engine: Test policy correctness, guard effectiveness
   - Terminal: Test execution reliability

4. **Different Scaling**
   - Strategist: High query volume, read-heavy
   - Decision Engine: Batch processing, write-heavy
   - Terminal: Rate-limited by Meta API

---

## Naming Confirmation

Based on this analysis:

- **Strategist** = Analysis & Recommendations ✅ (keep name)
- **Decision Engine** = Policy Application & Decision Generation ✅ (renamed from Terminal)
- **Terminal** = Execution Engine ✅ (keep name, in strateg.is)

**Flow**: Strategist → Decision Engine → Terminal

**Decision Engine** is the perfect name because:
1. It **decides** what actions to take (bump/trim/hold)
2. It applies **decision rules** (policies, guards)
3. It generates **Decision objects**
4. It's the **decision point** before execution

---

## Updated Architecture

```
┌─────────────────┐
│   Strategist    │  Analysis & Recommendations
│  (Liftoff)      │  - Query data
└────────┬────────┘  - SLO checks
         │           - Simple ROAS logic
         │           - Chat interface
         ↓
┌─────────────────┐
│ Decision Engine │  Policy Application & Decisions
│  (Liftoff)      │  - Kelly/UCB policies
└────────┬────────┘  - Lane-specific rules
         │           - Cooldown checks
         │           - Confidence gating
         │           - Writes Decision files
         ↓
┌─────────────────┐
│    Terminal     │  Execution Engine
│  (strateg.is)   │  - Reads Decision files
└─────────────────┘  - Executes via Meta API
                     - Updates cooldowns
```

---

## References

- Strategist Routes: `backend/src/routes/strategist.ts`
- Decision Engine Routes: `backend/src/routes/decisionEngine.ts`
- Decision Schema: `backend/src/lib/decisions.ts`

