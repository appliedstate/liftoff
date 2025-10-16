---
title: Operating Rhythm
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Operating Rhythm (Daily/Weekly)

Daily checklist
- Ship small, safe changes behind flags; monitor change health (latency, error rate, freshness).
- If any SLO breaches (freshness, latency, error budgets): stop feature work; fix first.
- Attach change notes and dashboards to each deploy.

Weekly review (owners + squads)
- Inputs
  - Experiment Board, CI/CD metrics, API metrics, incident reviews, adoption telemetry.
- Agenda
  - DORA metrics (deploy frequency, lead time, change failure rate, MTTR): trends and blockers.
  - Freshness and error budgets: breaches, causes, prevention mechanisms.
  - Adoption: % agent queries via MCP → API; ops toil removed this week.
  - Next automation targets chosen to reduce arbitrage ops toil.
  - Approvals needed (schema/public API/security posture).
- Outputs
  - Next week’s experiments with owners and acceptance criteria.
  - Incident action items and deadlines.

SLAs
- API read endpoints availability 99.9%; freshness: T+15m for daily metrics; incident RCA within 2 business days.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Facebook Metrics PRD — `../../prd/strategis-facebook-metrics-endpoint.md`
- Owner Alignment — `./02-owner-alignment.md`


