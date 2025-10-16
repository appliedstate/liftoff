---
title: Team Formation and Flow
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Team Formation and Flow

Squad topology
- Cross‑functional squads aligned to KPI rows (Experiment Board): product, platform, data, QA.
- Rotating liaison from arbitrage ops ensures we target toil‑reduction with measurable impact.

Roles
- Product (DRI): problem framing, acceptance criteria, releases.
- Platform: CI/CD, infra, API contracts, security/RBAC.
- Data: curated models, materialized views, freshness, backfills.
- QA: test plans, canaries, rollback drills.

Switching norms
- Individuals can switch squads to maximize company‑level value; owners help resolve staffing bottlenecks.

Rituals
- Daily: ship small, monitor SLOs; fix breaches before feature work.
- Weekly: review DORA, freshness, adoption; pick next automation targets that reduce arbitrage toil.

Interfaces to DSM & Experiment Board
- Each squad maintains evidence links on its Experiment Board row and change notes per deploy.

Escalation
- Non‑reversible schema/API/security changes require owner pre‑approval.

References
- Experiment Board — `./05-experiment-board.md`
- DSM — `./06-digital-self-management.md`


