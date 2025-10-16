---
title: Rapid Iteration in Production
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Rapid Iteration in Production

Principles
- Prefer many small, safe deploys with canaries and fast rollback.
- Instrument everything; SLOs (freshness, latency, error rate) gate promotion.

CI/CD and canaries
- Trunk‑based development; small PRs; automated checks; staged rollouts.
- Canary for data (materialized views) and for functions/APIs with health gates.
- Automatic rollback on SLO breach or error budget exhaustion.

Change health and evidence
- Each deploy links change notes, dashboards, error budget status, and rollback plan.
- Incidents: ack ≤30m; mitigation ≤2h; RCA within 2 business days.

Feature flags and reversibility
- Use flags to de‑risk; run reversible experiments for ≤2 weeks before hardening.

Metrics to watch during iteration
- Deployment frequency, lead time, change failure rate, MTTR; freshness SLA adherence; API error rate.

References
- Experiment Board — `./05-experiment-board.md`
- DSM — `./06-digital-self-management.md`
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`


