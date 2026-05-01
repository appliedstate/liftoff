---
date: 2026-04-29
title: "Operator Working Session — Capital Allocation Operating System Ground Truth — Outcomes"
type: outcomes
participants:
  - Eric Roach
  - Codex
context:
  team: Operator / Systems Architecture
  company: Liftoff
source_transcript: ./transcript.md
tags:
  - meeting
  - outcomes
  - operating-system
  - capital-allocation
  - board
---

# Executive Summary

This session established the canonical design logic for Liftoff's operating system. The key move was to stop treating the problem as a narrow capital allocator and instead define a full company-state system governed by a prime directive, constrained by real operating physics, and guided by a durable digital board. The most important implementation decision was to build meeting intelligence and action ownership first, because that is the upstream bottleneck currently corrupting memory, execution follow-through, buyer scorecards, and eventually capital allocation itself.

## Decisions

- Decision: The system is a company operating system, not just a capital allocation engine.
- Decision: The prime directive is to maximize durable net profit growth per unit of constrained company capacity while never falling below the configured monthly net-profit floor.
- Decision: The system must model real business entities including people, buyers, accounts, contracts, systems, workflows, plays, and constraints.
- Decision: The digital board is a durable mechanism for ambiguous strategic choices; routine execution does not require board intervention.
- Decision: The durable partner voice should be represented by a Founding Partner Seat, with Narbeh Ghazalian as the current occupant.
- Decision: Slack, Google Meet, and manual markdown transcripts are first-class operating inputs.
- Decision: Meeting intelligence plus action ownership is the first major subsystem to build.
- Decision: Node/TypeScript owns ingestion, persistence, and workflow mechanics; Python owns modeling, simulation, and allocation logic.
- Decision: Existing repo components are not truth and must pass first-principles validation before they are treated as canonical.
- Decision: All operator recommendations must explain why the item belongs in the system, why now, what bottleneck it solves, and end with a direct approval sentence.
- Decision: Board decisions must be tracked with telemetry so decision velocity and later quality can be measured.
- Decision: Before DB bootstrap, seed the system with at least two canonical meetings: one real media-buying incident review and one operator-ground-truth architecture session.

## Actions (Tasks)

- [ ] Stand up the first local meeting-intelligence database and import seed meetings into it — Owner: Codex — Due: 2026-04-29 — Priority: H
- [ ] Continue collecting canonical meetings from Google Meet, Slack, and markdown so the system has grounded operating history — Owner: Eric — Due: 2026-05-01 — Priority: H
- [ ] Pull canonical buyer names from Strategis and prepare buyer scorecard grounding — Owner: Codex — Due: 2026-04-30 — Priority: H
- [ ] Define the first person/account/contract mapping for Nautilus, Adnet, System1, and major operator roles — Owner: Codex — Due: 2026-04-30 — Priority: H
- [ ] Keep capturing founder/operator concerns as structured signals, especially around opportunity sniffing, intent packets, execution, and consultant follow-through — Owner: Eric — Due: 2026-05-01 — Priority: H

## Projects

- Project: Capital Allocation Operating System — Outcome: A production-grade decision engine grounded in live operating state and constrained business reality — Owner: Eric / Codex
- Project: Digital Board — Outcome: A durable strategic decision mechanism with memory, principles, and telemetry — Owner: Eric / Codex
- Project: Meeting Intelligence — Outcome: Structured extraction of ideas, decisions, action items, voice signals, and execution state from conversations — Owner: Codex
- Project: Repo Reality Audit — Outcome: A first-principles classification of existing systems so future builds extend validated primitives instead of assumptions — Owner: Codex

## Principles

- Principle: Optimize the real scarce resource, not just cash.
- Principle: Buyer attention, account capacity, workflow throughput, engineering bandwidth, and policy risk are primary constraints.
- Principle: Existing software is evidence, not truth.
- Principle: Important conversations must become structured operating state.
- Principle: The board should govern ambiguity, not slow down routine execution.
- Principle: The system should prefer mechanisms over dashboards.
- Principle: Recommendations to the operator must reduce decision friction.
- Principle: The unit of learning is not just the campaign; it is also the move, the play, the workflow intervention, and the system improvement.

## Product PRDs

- PRD: Capital Allocation Operating Contract — Link: [capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md) — Status: active
- PRD: Digital Board Constitution — Link: [digital-board-constitution.md](/Users/ericroach/code/liftoff/docs/prd/digital-board-constitution.md) — Status: active
- PRD: Meeting Intelligence Spec — Link: [meeting-intelligence-spec.md](/Users/ericroach/code/liftoff/docs/prd/meeting-intelligence-spec.md) — Status: active
- PRD: Repo Reality Audit — Link: [repo-reality-audit.md](/Users/ericroach/code/liftoff/docs/prd/repo-reality-audit.md) — Status: active

## Risks and Unknowns

- Risk: The system may drift back into abstract allocator design if meetings, people, and contracts are not kept in the loop — Mitigation: treat company-state capture as a hard dependency, not optional context.
- Risk: Existing repo components may be over-trusted because they already exist — Mitigation: maintain the first-principles validation doctrine and explicit component classification.
- Risk: Board personas could become theatrical rather than operational — Mitigation: constrain board use to real strategic tradeoffs and measure outcomes through telemetry.
- Risk: Ground truth may stay in markdown only and fail to enter the live system — Mitigation: bootstrap the local DB immediately after seed records are prepared.

## Notes Organized by Workflow

1. Trigger/Context
The session started from a request to ground the capital allocation engine in the actual business: people, traffic sources, contracts, systems, buyer incentives, and real workflow pain.

2. Inputs
Inputs included business structure, current pain points, digital board concept, founder concerns, available transcript sources, repo reality, and the need for a durable spec.

3. Process
The session progressively sharpened the objective, defined the prime directive, selected the board, formalized founder voice capture, split implementation responsibilities between Node and Python, established first-principles validation doctrine, audited the repo, and selected the next subsystem to build.

4. Outputs
The session produced a durable operating contract, a board constitution, first-principles validation doctrine, repo audit, meeting-intelligence architecture decision, operator approval standard, board telemetry spec, and the implemented meeting-intelligence subsystem.

5. Feedback/Monitoring
The system should monitor whether these decisions lead to better execution follow-through, better buyer scorecards, faster operator decisions, and cleaner eventual capital-allocation inputs.

## Source References

- See transcript: [transcript.md](/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-ad-hoc-eric-codex-operating-system-ground-truth/transcript.md)
- Board next-build review: [board-review-next-build-2026-04-29.md](/Users/ericroach/code/liftoff/docs/prd/board-review-next-build-2026-04-29.md)
- Operating contract: [capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md)
