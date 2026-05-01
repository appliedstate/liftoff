---
title: "Repo Reality Audit Pass 1"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Repo Reality Audit Pass 1

## Purpose

This is the first concrete audit pass applying:

- [capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md)
- [repo-reality-audit.md](/Users/ericroach/code/liftoff/docs/prd/repo-reality-audit.md)

The goal is to classify the highest-priority existing components before we build on them.

## First-Principles Frame

The business physics we are trying to support are:

1. opportunity supply feeds launch supply
2. conserved intent quality determines monetization quality
3. buyer attention and workflow throughput are hard constraints
4. tracking quality determines learning quality
5. learning quality determines scaling quality
6. capital allocation is downstream of opportunity, execution, and constraints

So the audit question is not whether a component exists.

The question is whether it maps cleanly to one of those variables or control loops.

## Summary Classification Table

| Component | Primary Paths | Classification | Why | Recommended Action |
|---|---|---|---|---|
| Opportunity Queue | [backend/src/services/opportunityQueue.ts](/Users/ericroach/code/liftoff/backend/src/services/opportunityQueue.ts), [docs/prd/opportunity-prioritization.md](/Users/ericroach/code/liftoff/docs/prd/opportunity-prioritization.md) | `useful_but_incomplete` | Real opportunity primitive exists, but ownership, discovery cadence, and closed-loop outcome tracking are incomplete | `wrap_with_new_contract` |
| Intent Packet System | [backend/src/routes/intentPackets.ts](/Users/ericroach/code/liftoff/backend/src/routes/intentPackets.ts), [backend/src/lib/intentPacket.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacket.ts) | `useful_but_incomplete` | Strong primitive for conserved intent from ad to article to widget, but not yet fully tied to exploration ownership and realized outcome loops | `extend_directly` |
| L2L Flywheel / Workflow Orchestration | [docs/operations/64-l2l-flywheel.md](/Users/ericroach/code/liftoff/docs/operations/64-l2l-flywheel.md), [backend/src/routes/workflow.ts](/Users/ericroach/code/liftoff/backend/src/routes/workflow.ts) | `useful_but_incomplete` | Canonical workflow logic is strong, but automation boundary and operational ownership are incomplete | `wrap_with_new_contract` |
| Monitoring / Strategis Data Plane | [backend/src/lib/strategisApi.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategisApi.ts), [docs/monitoring/data-architecture.md](/Users/ericroach/code/liftoff/docs/monitoring/data-architecture.md) | `useful_but_incomplete` | Best existing factual substrate for buyer/campaign economics, but not yet complete enough to be unquestioned system of record | `extend_directly` |
| Human Control System | [docs/operations/human-control-system.md](/Users/ericroach/code/liftoff/docs/operations/human-control-system.md) | `local_optimization` | Valuable management philosophy, but mixes ideals, hypothetical roster assumptions, and operating mechanics without canonical data contracts | `wrap_with_new_contract` |
| Capital Allocation Engine | [scripts/capital_allocation_engine.py](/Users/ericroach/code/liftoff/scripts/capital_allocation_engine.py), [docs/operations/arbitrage-portfolio-returns-model.md](/Users/ericroach/code/liftoff/docs/operations/arbitrage-portfolio-returns-model.md) | `useful_but_incomplete` | Strong scaffold for allocation logic and guardrails, but still synthetic and not grounded enough in buyer/account/contract reality | `extend_directly` |

## Detailed Findings

## 1. Opportunity Queue

### Business Function

Represents candidate opportunity supply before launch.

### Evidence Reviewed

- [backend/src/services/opportunityQueue.ts](/Users/ericroach/code/liftoff/backend/src/services/opportunityQueue.ts)
- [docs/prd/opportunity-prioritization.md](/Users/ericroach/code/liftoff/docs/prd/opportunity-prioritization.md)
- [backend/docs/system1-opportunity-scoring.md](/Users/ericroach/code/liftoff/backend/docs/system1-opportunity-scoring.md)

### What Survives First-Principles Validation

- An explicit opportunity object is necessary.
- Fields like `angle`, `category`, `predicted_delta_cm`, `confidence_score`, and `recommended_budget` map to real upstream decision variables.
- Ranking opportunities by predicted economic contribution is aligned with the prime directive.

### What Fails Or Is Missing

- No explicit owner for each opportunity.
- No explicit link to which buyer should work it.
- No explicit link to whether the opportunity came from founder voice, Slack, System1, or a meeting.
- No full closed loop from:
  - opportunity
  - to launch
  - to realized performance
  - to learning
- No visible mechanism for enforcing “someone is dedicated to sniffing out opportunity.”

### Classification

`useful_but_incomplete`

### Risks If Misused

- Creates the illusion that opportunity discovery is handled when it is only being stored.
- Can bias attention toward scored opportunities without fixing the discovery bottleneck.

### Recommended Action

`wrap_with_new_contract`

Meaning:

- keep the current opportunity object
- add owner, source, review cadence, meeting linkage, and post-launch outcome linkage
- connect it to buyer scorecards and intent-packet exploration

## 2. Intent Packet System

### Business Function

Represents conserved commercial intent from discovery through article and launch.

### Evidence Reviewed

- [backend/src/routes/intentPackets.ts](/Users/ericroach/code/liftoff/backend/src/routes/intentPackets.ts)
- [backend/src/lib/intentPacket.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacket.ts)
- [backend/src/lib/intentPacketLaunch.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketLaunch.ts)

### What Survives First-Principles Validation

- The intent packet abstraction is strong.
- It maps to a real physical requirement of the business:
  - keep ad promise, article framing, widget terms, and search intent coherent
- It directly affects monetization quality and policy risk.
- It creates a reusable abstraction better than raw campaign naming or buyer memory.

### What Fails Or Is Missing

- No explicit operating role dedicated to cracking net-new intent packets.
- Outcome loops are present in parts, but not yet central to management cadence.
- It is not yet clearly governed as a top-level exploration workstream.

### Classification

`useful_but_incomplete`

### Why Not `canonical_primitive` Yet

The concept is close to a canonical primitive, but the system around it is not yet mature enough to treat the current implementation as final truth.

### Recommended Action

`extend_directly`

Meaning:

- preserve the abstraction
- build scorecards, ownership, and learning loops around it
- do not discard it in favor of looser concepts

## 3. L2L Flywheel / Workflow Orchestration

### Business Function

Represents the end-to-end path from idea to launched campaign to learning.

### Evidence Reviewed

- [docs/operations/64-l2l-flywheel.md](/Users/ericroach/code/liftoff/docs/operations/64-l2l-flywheel.md)
- [backend/src/routes/workflow.ts](/Users/ericroach/code/liftoff/backend/src/routes/workflow.ts)

### What Survives First-Principles Validation

- The workflow decomposition is sound.
- It correctly identifies the chain:
  - opportunity
  - blueprint
  - creatives / LPIDs
  - tracking
  - launch
  - optimize
  - learn
- This is close to the real physics of launch throughput.

### What Fails Or Is Missing

- The route layer is thin and does not prove operational completeness.
- Ownership and state transitions are not yet tied cleanly to real human bottlenecks.
- Missing automation and asset-creation gaps are already acknowledged in the doc.
- It is still too easy for tribal buyer behavior to bypass the intended flow.

### Classification

`useful_but_incomplete`

### Risks If Misused

- Mistaking documented workflow for implemented workflow.
- Assuming launch throughput is solved because the flow is described well.

### Recommended Action

`wrap_with_new_contract`

Meaning:

- treat the flywheel as the canonical workflow hypothesis
- instrument it explicitly with workflow events and owners
- measure where it breaks in reality

## 4. Monitoring / Strategis Data Plane

### Business Function

Provides buyer-linked performance data across campaigns, networks, spend, and revenue.

### Evidence Reviewed

- [backend/src/lib/strategisApi.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategisApi.ts)
- [docs/monitoring/data-architecture.md](/Users/ericroach/code/liftoff/docs/monitoring/data-architecture.md)
- [docs/monitoring/complete-system-documentation.md](/Users/ericroach/code/liftoff/docs/monitoring/complete-system-documentation.md)
- [docs/prd/arbitrage-portfolio-reporting-prd.md](/Users/ericroach/code/liftoff/docs/prd/arbitrage-portfolio-reporting-prd.md)

### What Survives First-Principles Validation

- Campaign/buyer/platform/revenue/spend linkage is indispensable.
- The merged `campaign_index` concept is highly valuable.
- The system already captures many of the right state variables for economic control.

### What Fails Or Is Missing

- Known endpoint failures and incompleteness mean it is not a perfectly reliable source of truth yet.
- Buyer scorecards, comp integration, and action loops are not yet fully closed.
- This is more of a factual substrate than a fully operating decision system.

### Classification

`useful_but_incomplete`

### Recommended Action

`extend_directly`

Meaning:

- this is the best current factual base
- build canonical buyer scorecards and allocation inputs on top of it
- do not assume every feed is already complete or fully reconciled

## 5. Human Control System

### Business Function

Management operating doctrine for human productivity and accountability.

### Evidence Reviewed

- [docs/operations/human-control-system.md](/Users/ericroach/code/liftoff/docs/operations/human-control-system.md)

### What Survives First-Principles Validation

- “net margin contribution per human per week” is directionally aligned with the prime directive.
- The emphasis on commitments, measurement, and adjustment is sound.
- The distinction between revenue generation, cost control, scaling enablement, and knowledge transfer is useful.

### What Fails Or Is Missing

- It contains roster assumptions and objective targets that may not reflect current reality.
- It is not grounded in a canonical people model yet.
- It does not yet incorporate meeting-derived voice profiles, founder concerns, or explicit workflow bottlenecks.
- It can become a managerial overlay without being a real control system if not backed by data.

### Classification

`local_optimization`

### Why

It is valuable as an operating philosophy, but not yet safe to treat as canonical architecture.

### Recommended Action

`wrap_with_new_contract`

Meaning:

- preserve its useful control ideas
- re-express them through canonical tables:
  - people
  - buyer scorecards
  - action items
  - voice profiles
  - workflow events

## 6. Capital Allocation Engine

### Business Function

Allocates deployable capital across traffic assets subject to profit-floor and compounding logic.

### Evidence Reviewed

- [scripts/capital_allocation_engine.py](/Users/ericroach/code/liftoff/scripts/capital_allocation_engine.py)
- [docs/operations/arbitrage-portfolio-returns-model.md](/Users/ericroach/code/liftoff/docs/operations/arbitrage-portfolio-returns-model.md)

### What Survives First-Principles Validation

- Explicit monthly profit floor
- finite-horizon reasoning
- reserve, improvement, exploration, and winner buckets
- asset/cluster/risk framing
- audit trail orientation

These are aligned with the prime directive.

### What Fails Or Is Missing

- not yet connected to canonical buyer reality
- not yet connected to platform account constraints
- not yet connected to contract terms
- not yet connected to working-capital and payout reality in live data
- not yet connected to meeting-derived execution or opportunity signals

### Classification

`useful_but_incomplete`

### Recommended Action

`extend_directly`

Meaning:

- preserve the engine as the current allocation scaffold
- ground it in actual monitoring, people, contract, and meeting data before treating outputs as production truth

## Cross-Cutting Conclusions

### What Looks Strongest

The strongest current primitives are:

1. intent coherence as a business primitive
2. the L2L workflow shape
3. the monitoring / Strategis factual substrate
4. the allocation guardrail logic

### What Looks Weakest

The weakest current areas are:

1. explicit opportunity-sniffing ownership
2. explicit intent-packet exploration ownership
3. action ownership and follow-through memory
4. canonical buyer scorecards tied to real constraints

### What We Should Not Assume

We should not assume:

- opportunity discovery is handled because an opportunity queue exists
- workflow execution is solved because the flywheel is documented
- management control is solved because the human control system exists
- allocation outputs are production-real because the engine runs

## Immediate Next Actions

### 1. Build On These Directly

- monitoring / Strategis data plane
- intent packet abstraction
- capital allocation engine scaffold

### 2. Wrap These In Stronger Contracts

- opportunity queue
- L2L workflow
- human control system

### 3. Build Missing Canonical Layers

- meeting intelligence schema
- action-item ownership layer
- canonical people / buyer table
- buyer scorecards
- platform account / contract schema

## Recommended Build Sequence After This Audit

1. `meeting intelligence schema + manual markdown ingest`
2. `canonical buyer scorecards from Strategis / monitoring`
3. `opportunity ownership + intent-packet exploration ownership`
4. `platform account + contract constraint layer`
5. `allocator grounding to live buyer/account/meeting context`
