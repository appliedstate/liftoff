---
title: "Repo Reality Audit"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Repo Reality Audit

## Purpose

This document defines how Liftoff audits the existing repo against first principles before extending it.

The goal is to prevent the system from inheriting accidental assumptions, local optimizations, or incomplete abstractions simply because they already exist.

## Governing Rule

Existing artifacts are evidence, not truth.

They must be classified before they are treated as part of the canonical operating system.

## Audit Objective

For every meaningful existing component, determine:

1. what real-world function it maps to
2. whether it supports the prime directive
3. whether it reflects actual operating reality
4. whether it should be extended, refactored, wrapped, or ignored

## Classification Categories

Every audited component must be assigned one classification.

### `canonical_primitive`

Definition:

Maps cleanly to a real business primitive or indispensable system function.

Examples:

- a trustworthy entity model
- a core workflow primitive
- a durable API contract
- a system-of-record table with known semantics

### `useful_but_incomplete`

Definition:

Provides real value and maps to reality, but misses important variables, ownership, controls, or feedback loops.

Examples:

- an opportunity queue without clear ownership or closed-loop outcome tracking
- a scorecard without comp or bottleneck context

### `local_optimization`

Definition:

Improves one narrow task but is not a reliable abstraction of the larger system.

Examples:

- a dashboard tailored to one operator’s daily view
- a workflow hack that increases local speed but hides strategic constraints

### `legacy_or_misleading`

Definition:

Creates conceptual drag, wrong incentives, incorrect assumptions, or false confidence.

Examples:

- a metric that flatters activity instead of profit
- a flow that encodes buyer convenience rather than prime-directive alignment

### `unknown_until_validated`

Definition:

Potentially important but not yet grounded enough to classify confidently.

## Audit Criteria

Every component should be reviewed against the same questions.

### A. Physics Fit

1. What business variable or mechanism does this represent?
2. Is that variable upstream, downstream, or orthogonal to net profit?
3. Does the component reflect real constraints such as buyer attention, account capacity, workflow throughput, or working capital?

### B. Prime-Directive Fit

1. How does this improve durable net profit growth?
2. Does it protect or endanger the monthly net profit floor?
3. Does it create reusable edge or only local convenience?

### C. Control-System Fit

1. Does it create better decisions, better action, or better learning?
2. Does it expose who owns the next step?
3. Does it support a closed loop between observation and action?

### D. Reality Fit

1. Do operators actually use it?
2. Does it match current workflow reality?
3. Does it omit important human or account constraints?

### E. Risk Fit

1. Could it create false confidence?
2. Could it hide bottlenecks?
3. Could it incentivize behavior that conflicts with the prime directive?

## Audit Output Format

Each audited component should produce a record with:

- `component_name`
- `path_or_system`
- `type`
- `business_function`
- `classification`
- `prime_directive_support`
- `known_gaps`
- `risks_if_misused`
- `recommended_action`
- `owner`
- `reviewed_at`

### Recommended Actions

- `extend_directly`
- `wrap_with_new_contract`
- `refactor_before_use`
- `quarantine`
- `ignore_for_now`

## Priority Audit Targets

These should be audited first because they sit closest to the prime directive.

### 1. Opportunity Discovery And Queue

Targets:

- [backend/src/services/opportunityQueue.ts](/Users/ericroach/code/liftoff/backend/src/services/opportunityQueue.ts)
- [docs/prd/opportunity-prioritization.md](/Users/ericroach/code/liftoff/docs/prd/opportunity-prioritization.md)
- [backend/docs/system1-opportunity-scoring.md](/Users/ericroach/code/liftoff/backend/docs/system1-opportunity-scoring.md)

### 2. Intent Packet System

Targets:

- [backend/src/routes/intentPackets.ts](/Users/ericroach/code/liftoff/backend/src/routes/intentPackets.ts)
- [backend/src/lib/intentPacket.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacket.ts)
- [backend/src/lib/intentPacketLaunch.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketLaunch.ts)

### 3. L2L Workflow And Launch Flow

Targets:

- [docs/operations/64-l2l-flywheel.md](/Users/ericroach/code/liftoff/docs/operations/64-l2l-flywheel.md)
- [backend/src/routes/workflow.ts](/Users/ericroach/code/liftoff/backend/src/routes/workflow.ts)

### 4. Monitoring / Reporting / Buyer Attribution

Targets:

- [docs/monitoring/data-architecture.md](/Users/ericroach/code/liftoff/docs/monitoring/data-architecture.md)
- [docs/monitoring/complete-system-documentation.md](/Users/ericroach/code/liftoff/docs/monitoring/complete-system-documentation.md)
- [backend/src/lib/strategisApi.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategisApi.ts)

### 5. Human Control And Scorecard System

Targets:

- [docs/operations/human-control-system.md](/Users/ericroach/code/liftoff/docs/operations/human-control-system.md)
- [docs/operations/compensation-policy.md](/Users/ericroach/code/liftoff/docs/operations/compensation-policy.md)

### 6. Capital Allocation Engine

Targets:

- [scripts/capital_allocation_engine.py](/Users/ericroach/code/liftoff/scripts/capital_allocation_engine.py)
- [docs/operations/arbitrage-portfolio-returns-model.md](/Users/ericroach/code/liftoff/docs/operations/arbitrage-portfolio-returns-model.md)

## Minimum Useful First Audit Pass

The first pass does not need to be perfect.

It is sufficient if it:

1. classifies the top priority components
2. identifies what can be trusted
3. identifies what must be wrapped or refactored
4. prevents the next implementation step from inheriting a bad abstraction

## Anti-Failure Rule

Do not let the audit turn into passive documentation.

Each classification must lead to one of:

- keep and extend
- refactor
- wrap
- quarantine

## Suggested Immediate Use

Before implementing the next major subsystem:

1. audit the existing related components
2. classify them
3. write the new contract around the parts that survive
4. only then build on top
