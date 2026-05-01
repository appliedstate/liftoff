---
title: "Meeting Intelligence Architecture Decision"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Meeting Intelligence Architecture Decision

## Decision

Build meeting-intelligence ingestion, normalization, persistence, and action-item tracking in `Node/TypeScript` inside the existing backend and monitoring stack.

Use `Python` for downstream modeling, scoring, simulation, board synthesis support, and capital-allocation logic.

## Decision Type

Architecture decision record.

## Prime-Directive Test

This decision is valid because it best supports the prime directive:

Maximize durable net profit growth per unit of constrained company capacity, while never allowing projected monthly net profit to fall below the configured floor.

The architecture should minimize friction to:

- capture operating context quickly
- persist it reliably
- connect it to action ownership
- feed structured data into the allocator and decision systems

## Board Qualification

The most relevant board seats for this decision were:

- `Patrick Collison`: internal economic infrastructure and developer systems
- `Jensen Huang`: full-stack architecture and tooling leverage
- `Jeff Bezos`: operating mechanisms and execution reliability
- `Jim Simons`: downstream model-data quality
- `Founding Partner Seat`: adoption reality and fit to actual operating pain
- `Operator`: final execution owner tied to current repo reality

## Why This Decision Wins

### 1. Repo Reality

The operational data plane already lives primarily in `Node/TypeScript`.

Existing anchors:

- Strategis / reporting backend:
  - [backend/src/lib/strategisApi.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategisApi.ts)
- opportunity queue:
  - [backend/src/services/opportunityQueue.ts](/Users/ericroach/code/liftoff/backend/src/services/opportunityQueue.ts)
- workflow orchestration:
  - [backend/src/routes/workflow.ts](/Users/ericroach/code/liftoff/backend/src/routes/workflow.ts)
- intent packet routes:
  - [backend/src/routes/intentPackets.ts](/Users/ericroach/code/liftoff/backend/src/routes/intentPackets.ts)
- monitoring / ingestion system:
  - [docs/monitoring/complete-system-documentation.md](/Users/ericroach/code/liftoff/docs/monitoring/complete-system-documentation.md)

### 2. Meeting Intelligence Is An Operating-System Problem First

The first problem is not advanced modeling.

The first problem is:

- ingesting transcripts
- normalizing participants
- extracting action items
- assigning owners
- storing structured facts
- linking them to buyers, systems, and workflows

That is better aligned with the backend/service layer than with the modeling layer.

### 3. Python Should Remain Focused On Decision Science

Python is still the correct home for:

- capital allocation models
- simulation
- forecasting
- probabilistic scoring
- board-support analysis
- later transcript classification models if needed

The boundary should be:

- `Node/TypeScript`: operational ingestion and persistence
- `Python`: analytical and allocation logic over structured data

### 4. This Minimizes Capacity Waste

Creating a second operational backend for ingestion would increase:

- integration cost
- maintenance burden
- ownership ambiguity
- latency to first value

This violates the prime directive because it consumes company capacity without increasing durable profit fast enough.

## Rejected Alternatives

### Alternative A

Build the full meeting-intelligence pipeline in Python.

Rejected because:

- poor fit to the current repo’s operational service layer
- increases stack fragmentation
- makes action-item and workflow integration slower
- forces dual ownership for adjacent backend concerns

### Alternative B

Defer persistence and only do ad hoc transcript summarization in chat.

Rejected because:

- loses context
- breaks auditability
- prevents action-item tracking
- does not produce reusable operating memory

## Architecture Boundary

### Node / TypeScript Owns

- source connectors
- transcript file ingestion
- Slack listener ingestion
- Google Meet transcript ingestion
- participant resolution
- structured extraction persistence
- meeting/action-item APIs
- operator-facing query endpoints

### Python Owns

- meeting-derived scoring models
- board synthesis assistance
- bottleneck ranking
- opportunity-ranking models
- allocator extensions consuming meeting-derived facts

## Immediate Implementation Consequence

The first deliverable should be a backend schema and service layer for:

- `meeting_sessions`
- `meeting_participants`
- `transcript_segments`
- `meeting_ideas`
- `meeting_decisions`
- `meeting_action_items`
- `meeting_open_questions`
- `person_voice_signals`

## Review Trigger

Revisit this decision only if one of these becomes true:

1. transcript ingestion volume materially exceeds backend capacity
2. the team standardizes on a different shared data-plane architecture
3. Python-native workflows become the dominant operating interface
4. the Node implementation materially slows modeling work instead of accelerating it
