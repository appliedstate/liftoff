---
title: Rules of Autonomy
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Rules of Autonomy (Sign‑to‑Work)

These rules govern product/data/automation work. Autonomy is granted within these bounds to maximize cycle time and quality.

Canonical engineering/productivity rules (ladder to BOS 1, 6–14)
- Make requirements less dumb; write the simplest spec that solves the KPI.
- Delete before optimizing; prefer removing steps and code paths.
- Simplify, then optimize; small PRs, clean interfaces, clear ownership.
- Accelerate cycle time; ship daily with canaries and rollbacks.
- Automate last; validate manually before building automation.

Quality, safety, and change management
- CI/CD with staged canaries; automatic rollback on SLO breach.
- Versioned, read‑only reporting API for consumers and agents; MCP is a thin wrapper only.
- Data governance: strict RLS; least‑privilege roles; no secrets in source.
- Non‑reversible changes (schemas, public APIs, security posture) require pre‑approval via brief and risk assessment.

Data & DSM truth
- Three‑layer model: staging → curated → serving (materialized views; pg_cron refreshes).
- Freshness, latency, and error budgets are first‑class; work stops to fix red SLAs.

Communication & observability
- Every deploy links to change notes, dashboards, and health checks.
- Incidents: ack ≤30m; mitigation start ≤2h; post‑incident review within 2 business days.

KPIs (owned by Liftoff squads)
- Deployment frequency, lead time for change, change failure rate, MTTR.
- Data freshness SLA adherence; API latency and error rate; agent served‑via‑API ratio.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Facebook Metrics PRD — `../../prd/strategis-facebook-metrics-endpoint.md`
- Creative Factory — `../../creative/40-creative-factory.md`
- Human Control System — `../../operations/human-control-system.md`

Sign‑to‑Work Acknowledgement
- I have read and agree to operate within these rules and guardrails. Name/Date: ________________________


