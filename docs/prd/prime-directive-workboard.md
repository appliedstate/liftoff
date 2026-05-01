---
title: "Prime Directive Workboard"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Prime Directive Workboard

## Purpose

This document keeps the main workstreams in view as the system is built.

It exists to prevent local optimization.

Every new feature, integration, or workflow change should map back to the prime directive and to one of the workstreams below.

## Prime Directive

Maximize durable net profit growth per unit of constrained company capacity, while never allowing projected monthly net profit to fall below the configured floor.

## Board-Governance Rule

No major workstream should proceed without an explicit answer to:

1. Which constraint does this relieve?
2. How does it improve durable net profit?
3. Which board seats are the best lenses for the decision?
4. What metric proves this work mattered?

## Current Highest-Leverage Workstreams

These are the main items the system should stay focused on.

They are ordered by current expected leverage against the prime directive.

### 1. Opportunity Sniffing And Opportunity Supply

Question:

Are we creating enough high-quality opportunities to feed profitable launches?

Why this matters:

- If opportunity supply is weak, buyers optimize scarcity instead of scaling.
- Founder feedback already points to weak opportunity sniffing.

What already exists:

- opportunity queue service:
  - [backend/src/services/opportunityQueue.ts](/Users/ericroach/code/liftoff/backend/src/services/opportunityQueue.ts)
- opportunity prioritization PRD:
  - [docs/prd/opportunity-prioritization.md](/Users/ericroach/code/liftoff/docs/prd/opportunity-prioritization.md)
- System1 opportunity scoring docs:
  - [backend/docs/system1-opportunity-scoring.md](/Users/ericroach/code/liftoff/backend/docs/system1-opportunity-scoring.md)
- manual batch guide:
  - [docs/prd/manual-batch-processing-guide.md](/Users/ericroach/code/liftoff/docs/prd/manual-batch-processing-guide.md)

Main gap:

Opportunity discovery is not yet integrated tightly enough into buyer throughput and board-level prioritization.

Board seats:

- Founding Partner Seat
- Jim Simons
- Jeff Bezos
- Patrick Collison

Primary metrics:

- new qualified opportunities per week
- opportunity-to-launch conversion rate
- predicted vs realized contribution margin
- opportunities with explicit owner

### 2. Intent Packet Cracking

Question:

Are we systematically discovering and refining new high-value intent packets, or are buyers only pursuing easy launches?

Why this matters:

- This is a direct expression of the founder concern.
- Intent packets are upstream of profitable supply.

What already exists:

- intent packet routes:
  - [backend/src/routes/intentPackets.ts](/Users/ericroach/code/liftoff/backend/src/routes/intentPackets.ts)
- intent packet launch logic:
  - [backend/src/lib/intentPacketLaunch.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketLaunch.ts)
- intent packet discovery / learning endpoints:
  - [backend/src/routes/intentPackets.ts](/Users/ericroach/code/liftoff/backend/src/routes/intentPackets.ts)

Main gap:

No clear role, scorecard, or operating cadence exists yet for a dedicated intent-packet exploration function.

Board seats:

- Founding Partner Seat
- Elon Musk
- Mark Zuckerberg
- Jim Simons

Primary metrics:

- new intent packets generated per week
- intent packets launched per week
- hit rate of new intent packets
- average time from idea to live intent packet

### 3. Buyer Throughput And Bias Correction

Question:

Are buyers constrained by real scarcity, or are they self-selecting only easy launches?

Why this matters:

- Buyer attention is one of the main constrained resources.
- Throughput and selection bias directly affect durable net profit.

What already exists:

- human control system:
  - [docs/operations/human-control-system.md](/Users/ericroach/code/liftoff/docs/operations/human-control-system.md)
- compensation policy:
  - [docs/operations/compensation-policy.md](/Users/ericroach/code/liftoff/docs/operations/compensation-policy.md)
- buyer scorecard references:
  - [docs/operations/templates/buyer-scorecard.md](/Users/ericroach/code/liftoff/docs/operations/templates/buyer-scorecard.md)

Main gap:

Buyer scorecards are not yet connected tightly enough to opportunity mix, intent-packet exploration, or transcript-derived concerns.

Board seats:

- Founding Partner Seat
- Warren Buffett
- Jeff Bezos
- Mark Zuckerberg

Primary metrics:

- launches per buyer per week
- 72h breakeven rate
- margin per buyer
- percentage of launches from net-new opportunities
- buyer opportunity concentration

### 4. Meeting Intelligence And Execution Follow-Through

Question:

Are important concerns turning into owned actions, or are they dying in conversation?

Why this matters:

- Founder feedback explicitly identifies follow-through problems.
- This is how voice becomes operating leverage instead of chat residue.

What already exists:

- meeting intelligence spec:
  - [docs/prd/meeting-intelligence-spec.md](/Users/ericroach/code/liftoff/docs/prd/meeting-intelligence-spec.md)
- digital board constitution:
  - [docs/prd/digital-board-constitution.md](/Users/ericroach/code/liftoff/docs/prd/digital-board-constitution.md)

Main gap:

No first-class transcript/action-item pipeline exists yet.

Board seats:

- Founding Partner Seat
- Jeff Bezos
- Patrick Collison
- Jensen Huang

Primary metrics:

- action items with owner
- action-item completion rate
- repeated concerns without owner
- repeated concerns without resolution

### 5. Tracking Hygiene And Platform Readiness

Question:

Are profitable opportunities being lost because the underlying tracking and platform readiness is weak?

Examples already named:

- Facebook pixel updating
- consultant coordination
- platform/account setup follow-through

Why this matters:

- Broken tracking breaks learning.
- Broken learning breaks scale.

What already exists:

- launch protocol and flywheel docs:
  - [docs/operations/64-l2l-flywheel.md](/Users/ericroach/code/liftoff/docs/operations/64-l2l-flywheel.md)
- S1 / Strategis integration docs:
  - [docs/prd/system1-ramp-content-generator-integration-notes.md](/Users/ericroach/code/liftoff/docs/prd/system1-ramp-content-generator-integration-notes.md)
- monitoring docs:
  - [docs/monitoring/complete-system-documentation.md](/Users/ericroach/code/liftoff/docs/monitoring/complete-system-documentation.md)

Main gap:

These concerns are discussed, but not yet modeled as explicit execution-risk workstreams with owners.

Board seats:

- Mark Zuckerberg
- Jeff Bezos
- Founding Partner Seat
- Jensen Huang

Primary metrics:

- tracking issues open > 24h
- pixel health incidents
- launch blocked by tracking issue
- time-to-resolution for platform readiness incidents

### 6. Buyer Scorecards, Compensation, And Capital Assignment

Question:

Are we allocating capital to the right buyers, with the right incentive and risk structure?

Why this matters:

- capital allocation without buyer context is incomplete
- compensation affects behavior and edge-sharing

What already exists:

- compensation policy:
  - [docs/operations/compensation-policy.md](/Users/ericroach/code/liftoff/docs/operations/compensation-policy.md)
- arbitrage portfolio returns model:
  - [docs/operations/arbitrage-portfolio-returns-model.md](/Users/ericroach/code/liftoff/docs/operations/arbitrage-portfolio-returns-model.md)
- reporting PRD:
  - [docs/prd/arbitrage-portfolio-reporting-prd.md](/Users/ericroach/code/liftoff/docs/prd/arbitrage-portfolio-reporting-prd.md)

Main gap:

There is not yet a canonical buyer scorecard feeding the allocator.

Board seats:

- Warren Buffett
- Jim Simons
- Founding Partner Seat
- Patrick Collison

Primary metrics:

- margin by buyer
- effective payout rate
- assisted margin
- capital deployed by buyer
- retained net margin after comp

### 7. Account / Contract / Capacity Constraints

Question:

What real capacity constraints are binding scale right now?

Examples:

- Nautilus BM vs Adnet BM
- System1 request / contract limits
- NewsBreak buying capacity
- payout timing / working capital

Why this matters:

- If scale is constrained by accounts or contracts, traffic allocation alone is the wrong lever.

What already exists:

- capital allocation operating contract:
  - [docs/prd/capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md)
- adnet SLA / agreement:
  - [docs/private/agreements/interlincx-adnet-sla-arbitrage-agreement.md](/Users/ericroach/code/liftoff/docs/private/agreements/interlincx-adnet-sla-arbitrage-agreement.md)

Main gap:

These constraints are not yet formalized into system tables and scoring rules.

Board seats:

- Warren Buffett
- Mark Zuckerberg
- Founding Partner Seat
- Patrick Collison

Primary metrics:

- account utilization
- policy risk by account
- blocked launches by account
- days of working-capital runway

### 8. Closed-Loop Allocator Integration

Question:

Can the allocator consume all of the above and make better multi-resource decisions?

Why this matters:

- This is the convergence point.

What already exists:

- Python allocator:
  - [scripts/capital_allocation_engine.py](/Users/ericroach/code/liftoff/scripts/capital_allocation_engine.py)
- operating contract:
  - [docs/prd/capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md)

Main gap:

The allocator still needs buyer, account, contract, and meeting-derived context.

Board seats:

- Jim Simons
- Warren Buffett
- Patrick Collison
- Jensen Huang

Primary metrics:

- projected monthly net profit
- monthly profit floor adherence
- capital-to-margin efficiency
- durable margin forecast at horizon

## Near-Term Build Order

To stay aligned with the prime directive, the next build sequence should be:

1. Meeting intelligence schema and ingestion path
2. Canonical buyer scorecards from Strategis / monitoring
3. Explicit opportunity and intent-packet workstream scoreboards
4. Platform account and contract schema
5. Execution-gap tracking for follow-through items
6. Allocator integration with buyer/account/meeting context

## Anti-Drift Rules

Do not allow the build to drift into:

- dashboard polish without decision leverage
- transcript summarization without action extraction
- opportunity scoring without launch ownership
- allocation logic without buyer/account constraints
- board personas without measurable operating impact

## Weekly Review Template

Every weekly review should answer:

1. Which workstream most limits the prime directive right now?
2. What changed this week in opportunity supply?
3. What changed this week in buyer throughput?
4. What repeated concerns did meetings surface?
5. Which execution gaps remain ownerless?
6. Which account or contract constraints are binding?
7. What should the allocator learn next?
