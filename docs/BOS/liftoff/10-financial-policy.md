---
title: Financial Policy
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Financial Policy

Objectives
- Fund capability‑compounding infrastructure (data, APIs, automation) that reduces cycle time and unit cost.

Investment principles
- Stage‑gated funding by learning milestones and KPI movement (DORA, freshness, adoption, cost per query).
- Prefer small, reversible investments; graduate to durable spend after 2–4 weeks of positive signal.
- Build‑vs‑buy requires explicit ROI rationale, including run costs and operational risk.

Budgeting & guardrails
- Maintain error budgets and SLOs as first‑class; feature work pauses when red.
- Track infra and team cost telemetry: cost per query, per dashboard user, per deploy.
- Deprecate low‑ROI systems; concentrate spend where KPI per $ is highest.

Approvals & governance
- Joint owner approval for public API changes, schema migrations with durability, and security posture shifts.
- All migrations ship with rollback scripts and data safety checks.

Reporting
- Weekly: KPI and spend roll‑up vs targets; next automation bets with expected KPI/$.
- Quarterly: portfolio review of bets; reallocate to highest compounding ROI.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`

