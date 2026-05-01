---
title: "Board Review — What To Build Next"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Board Review — What To Build Next

## Purpose

This document records the board-guided answer to:

What should Liftoff build next, given the prime directive?

It synthesizes:

- [capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md)
- [digital-board-constitution.md](/Users/ericroach/code/liftoff/docs/prd/digital-board-constitution.md)
- [prime-directive-workboard.md](/Users/ericroach/code/liftoff/docs/prd/prime-directive-workboard.md)
- [repo-reality-audit-pass-1.md](/Users/ericroach/code/liftoff/docs/prd/repo-reality-audit-pass-1.md)

## Prime Directive

Maximize durable net profit growth per unit of constrained company capacity, while never allowing projected monthly net profit to fall below the configured floor.

## Board Question

What is the next build step that most improves the prime directive?

## Board Synthesis

### Founding Partner Seat

The business is underweight on:

- opportunity sniffing
- dedicated intent-packet cracking
- execution follow-through

The biggest immediate risk is not lack of ideas in theory.

It is losing opportunity and execution context in conversation, then failing to convert it into owned action.

### Elon Musk

The bottleneck is not more dashboards.

The bottleneck is that the system does not convert human observations into durable operating state and clear next actions fast enough.

Build the shortest loop from:

- observation
- to structured fact
- to owned action
- to measured outcome

### Mark Zuckerberg

If tracking, intent, and launch quality are corrupted by missing follow-through, then downstream learning is corrupted.

The system needs a better control loop around:

- who noticed what
- who owns the fix
- whether it got resolved

before broader Meta optimization becomes trustworthy.

### Warren Buffett

Capital allocation is only as good as the quality of the operating information it consumes.

The business should not scale allocations on soft memory and weak follow-through.

Build the mechanism that increases decision reliability first.

### Jim Simons

The highest-value next system is the one that converts noisy unstructured operating data into structured facts and action records.

Without that, the allocator, scorecards, and buyer models are learning from incomplete state.

### Jeff Bezos

The next build should be a mechanism, not a report.

A mechanism that ensures important discussions produce:

- ideas
- decisions
- owners
- deadlines
- follow-up state

### Jensen Huang

The right move is infrastructure:

build the internal operating substrate that later systems can rely on.

Meeting intelligence is upstream infrastructure for:

- buyer scorecards
- bottleneck detection
- board memory
- allocator context

### Patrick Collison

The cleanest next primitive is a meeting-intelligence and action-ownership layer.

It creates reusable internal economic infrastructure and makes later systems easier to build correctly.

## Decision

The next thing to build is:

## `Meeting Intelligence + Action Ownership`

This means a backend system that ingests:

- Google Meet transcripts
- Slack channel / thread signals
- manual markdown transcripts

and produces:

- synthesized meeting records
- extracted ideas
- extracted concerns
- extracted decisions
- action items
- responsible owner for each action item
- participant voice signals
- unresolved-question tracking

## Why This Wins

### 1. It Relieves The Tightest Current Bottleneck

Current bottleneck:

important opportunity and execution information is discussed, but not turned into durable, queryable, owned operating state.

### 2. It Supports Multiple Higher-Level Workstreams At Once

This one subsystem directly supports:

- founder voice capture
- buyer bottleneck detection
- opportunity sniffing visibility
- intent-packet exploration ownership
- execution follow-through
- board memory
- allocator context

### 3. It Prevents False Precision Elsewhere

Without this layer:

- buyer scorecards miss qualitative constraints
- opportunity systems miss founder/operator context
- allocators overfit incomplete structured data

### 4. It Is A Reusable Primitive

This is not a one-off dashboard.

It is reusable internal infrastructure that future systems depend on.

## What Not To Build First

Do not build these first:

1. polished dashboards without action extraction
2. allocator sophistication before grounding meeting/execution reality
3. more opportunity scoring without explicit ownership and follow-through
4. board-session theater without durable memory and task tracking

## Immediate Build Scope

### Phase 1

Implement the schema and ingestion path for:

- `meeting_sessions`
- `meeting_participants`
- `transcript_segments`
- `meeting_ideas`
- `meeting_decisions`
- `meeting_action_items`
- `meeting_open_questions`
- `person_voice_signals`

### Phase 2

Support the first three source types:

- Google Meet transcripts
- Slack listening
- manual markdown transcripts

### Phase 3

Generate operator outputs:

- summary
- ideas
- decisions
- action items with owner
- unresolved questions
- recurring concerns

## The Build After That

Once meeting intelligence exists, the next build should be:

## `Canonical Buyer Scorecards`

Then:

1. opportunity ownership layer
2. intent-packet exploration ownership layer
3. platform-account and contract constraint layer
4. allocator grounding to live operating context

## Final Answer

The board’s answer is:

Build the meeting-intelligence and action-ownership system next.

Reason:

It is the highest-leverage missing primitive between human judgment and the rest of the operating system, and it best improves durable net profit growth per unit of constrained company capacity.

### Operator Approval Frame

Why this belongs in the system:

It converts high-value human discussion into durable operating state, owned action, and measurable follow-through.

Why this now:

Because opportunity, execution, and founder/operator context are currently being lost before they can shape buyer scorecards, allocator logic, and workflow correction.

Primary bottleneck relieved:

The missing control loop between human observation and accountable action.

Cost of delay:

The company keeps repeating concerns without durable ownership, keeps losing opportunity context, and keeps making downstream systems smarter than the upstream reality they depend on.

Approval ask:

Approve meeting intelligence and action ownership as the next subsystem to build.

If you agree, all you need to do is approve.
