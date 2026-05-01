---
title: "Operator Delegated Approval Protocol"
owner: Eric Roach
status: active
date: 2026-04-30
---

# Operator Delegated Approval Protocol

## Purpose

This protocol defines how the operator can delegate a bounded block of approval authority to the system so work can continue without pausing for every recommendation.

The goal is to increase execution velocity while preserving:

- the prime directive
- first-principles rigor
- board-guided reasoning
- operator control at explicit checkpoints

## Governing Rule

The operator may pre-approve a bounded batch of changes.

Within that batch, the system may continue building without requesting explicit approval for each individual recommendation, provided every change stays inside the approved guardrails.

## Active Default Batch

Unless explicitly changed by the operator, the active delegated mode is:

- `batch_size = 10`
- checkpoint every `10` meaningful changes or `10` commits, whichever comes first
- review packet required at each checkpoint before continuing into the next batch

The active machine-readable batch state should be maintained in:

- [operator_batch_state.json](/Users/ericroach/code/liftoff/data/operator_batch_state.json)

## What Counts Toward The Batch

The counter should increment on meaningful build units, not tiny edits.

Examples that count:

1. a new subsystem slice
2. a new migration or schema expansion
3. a new backend route or service layer
4. a new dashboard/reporting surface
5. a new automation or scheduled loop
6. a meaningful new script or operator tool
7. a material PRD / contract / governance artifact that changes how the system operates
8. a commit that materially changes system behavior

Examples that normally do not count by themselves:

1. typo fixes
2. small refactors with no behavior change
3. formatting-only edits
4. tiny follow-up fixes to work from the same change unit

## Checkpoint Trigger

A checkpoint is required when either condition is hit:

1. `10` meaningful changes have been completed
2. `10` commits have been completed

At that point, the system should stop autonomous continuation and present a checkpoint packet.

## Checkpoint Packet

The checkpoint packet must include:

1. what was built
2. why each item belonged in the system
3. which bottleneck each item was intended to relieve
4. what the board / first-principles lens said
5. what seems to be landing well
6. what seems weak, risky, or overbuilt
7. what should happen in the next batch

The packet must end with a direct operator decision:

`If this matches your judgment, all you need to do is approve the next batch.`

## Required Reasoning Standard Inside A Batch

Even when individual approvals are delegated, every meaningful change must still satisfy:

1. prime-directive alignment
2. first-principles validation
3. bottleneck relevance
4. board-guided reasoning where the decision is ambiguous
5. practical implementation quality

The system is not authorized to "move fast" by dropping these standards.

## Guardrails

Delegated approval does **not** authorize the following without explicit operator approval:

1. destructive data deletion outside clearly safe local dev artifacts
2. irreversible production migrations
3. credential rotation or account-permission changes
4. changes that affect live spend, live campaign behavior, or live traffic routing
5. changes that materially alter compensation logic
6. changes that alter legal/contract interpretations presented as settled fact
7. broad repo refactors unrelated to the current bottleneck
8. anything that clearly conflicts with an existing explicit operator instruction

If a proposed change crosses a guardrail, the system must stop and ask.

## Escalation Rule

The system should also stop before the checkpoint if:

1. the first-principles case is weak
2. multiple board lenses materially disagree
3. a change appears to create more fragility than leverage
4. the next move affects a sensitive external system boundary

## Current Working Interpretation

For the current operating loop, delegated approval is best interpreted as:

`Continue building the next 10 meaningful system changes using first principles and the board, then stop and present a checkpoint review packet.`

## Review Questions At Each Checkpoint

At each checkpoint, the operator should be able to answer:

1. Did these 10 changes move the prime directive forward?
2. Which changes actually relieved a bottleneck?
3. Which changes should be doubled down on?
4. Which changes should be simplified, reverted, or redirected?
5. Does the next batch still have the right target?
