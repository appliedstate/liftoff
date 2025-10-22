---
id: attention/10-attention-engine-factory
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: Attention Engine Factory — Decisioning & Telemetry for Experiment Throughput
purpose: Blueprint for the factory that turns ideas into shippable experiments with tight telemetry, deletes waste quickly, and scales winners — at a fixed 72h MVB cadence.
dependencies:
  - ../README.md
  - ../creative/40-creative-factory.md
  - ../operations/human-control-system.md
  - ../prd/attention/decisioning-telemetry-experimentation-prd.md
  - ../prd/attention/buyer-flow-simplification-prd.md
  - ../prd/attention/one-button-exit-simulation-prd.md
kpis:
  experiment_throughput_per_week: ">= 12 experiments/week shipped"
  decision_latency_p95_hours: "<= 24"
  buyer_flow_steps: "-3 steps vs baseline (kept)"
  exit_latency_p95_hours: "<= 24"
  mvb_cadence_adherence: ">= 80% of cycles hit 72h"
licensing: internal
---

# 10 — Attention Engine Factory

We "make the thing that makes the thing" for attention: a decisioning/telemetry factory that ships experiments (not opinions), deletes before optimizing, and enforces an MVB cadence.

---

## 1) North Star & Guardrails

- North Star: maximize Session ROAS via faster, cheaper learning per unit of attention.
- Guardrails (physics, not opinions):
  - Delete before optimizing: always remove steps first; only optimize what survives.
  - One‑button exit: p95 exit latency ≤ 24h; weekly simulation required.
  - 72h MVB cadence: idea → build → ship → telemetry → delete or scale.
  - Agent guardrails: relevance and safety checks, tool risk ratings, schema-validated outputs, and human-in-the-loop for high-risk actions. See `../ai-agents/openai-agent-best-practices.md` and `../ai-agents/openai-practical-guide-to-building-agents.pdf`.

---

## 2) Workflow Map (DAG)

1. Intake (Impact Filter) → triage within 12h to ship/hold/kill.
2. Blueprint → minimal hypothesis, measurable KPI, telemetry spec, DoD.
3. Instrument → event schema, freshness signals, gates.
4. Launch → smallest viable experiment; change‑log opened.
5. Observe → real‑time telemetry to decision board (p95 latency ≤ 15m where possible).
6. Decide → automatic gates and owner call within 24h of stable read.
7. Act → delete (archive artifacts) or scale (promote to production lanes).
8. Learn → capture deltas, update playbooks, queue next test.

---

## 3) Factory Artifacts (linked PRDs)

- Decisioning & Telemetry Experimentation Platform — `../prd/attention/decisioning-telemetry-experimentation-prd.md`
- Buyer Flow Simplification — `../prd/attention/buyer-flow-simplification-prd.md`
- One‑Button Exit Simulation & Policy — `../prd/attention/one-button-exit-simulation-prd.md`

---

## 4) SLAs

- Triage ≤ 12h, Blueprint ≤ 12h, Launch ≤ 24h after blueprint.
- Decision latency p95 ≤ 24h from first stable read.
- MVB cadence adherence ≥ 80%.

---

## 5) Ownership & Rhythm

- DRIs: Architect (throughput), Launch Engineer (ship), Telemetry Owner (signals), Ops (cleanup/scale).
- Rhythm: Daily ship; Mon/Thu promotion-prune; Weekly exit simulation; 72h MVB cycles.

---

## 6) Interfaces

- Terminal (automation brain) for guardrails and actions.
- Reporting/oversight API for decision surfaces and freshness.
- Creative/Article factories for inputs and surfaces.

---

## 7) Subsystems (how pieces connect)

- Facebook Discovery System
  - Role: sources winning categories/ad concepts; produces ranked backlogs and winners lists.
  - Inputs: Meta Ad Library via SearchApi, heuristics; outputs CSV/JSON backlogs.
  - Feeds: Iterate (inputs winners for brand-swap), Creative Factory (briefs), Weekly Orchestrator (quotas).
  - Doc: `../prd/facebook-category-discovery-pipeline.md`

- Iterate (Creative Variant Generator)
  - Role: generates fast brand-swapped variants from Discovery winners for testing.
  - Inputs: Discovery list id/ad ids, brand asset; outputs gallery + manifest under `runs/`.
  - Feeds: Creative Factory D1; Sandbox lane tests; Terminal promotion/prune via Mon/Thu SOP.
  - Doc: `../prd/iterate.md`

- Strateg.is (Reporting) + Terminal (Bidder) + Launcher (Entity Setup)
  - Strateg.is: reconciled reporting + decision surfaces; exposes API consumed by factory gates.
  - Launcher: creates/shards entities (ASC, LAL) per Weekly Orchestrator quotas.
  - Terminal: automation brain that applies gates, scales budgets, rotates, and enforces cooldowns.
  - Docs: `../prd/strategis-facebook-metrics-endpoint.md`, `/operations/55-entity-roadmap-and-orchestrator.md`, `/operations/61-promotion-prune-scale.md`

---

## 8) Changelog

- 2025-10-21: v1 created.


