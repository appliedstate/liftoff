---
title: KPIs as Experiments
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — KPIs as Experiments

Each KPI is a falsifiable hypothesis with an owner, metric definition, target band, and guardrails. Review weekly; iterate fast.

1) Deployment Frequency
- Hypothesis: smaller PRs and staged canaries increase deploys/week without raising failure rate.
- Metric: prod deploys per week.
- Target: +50% from baseline; red if change failure rate rises >5pp.
- Levers: trunk‑based dev, canaries, automated checks.
- Owner: platform lead.

2) Lead Time for Change
- Hypothesis: simplifying pipelines and reviews reduces PR‑to‑prod time.
- Metric: median hours from merge to prod.
- Target: −30% from baseline; red if MTTR worsens.
- Levers: CI parallelization, faster reviews, smaller changes.
- Owner: eng lead.

3) Data Freshness SLA
- Hypothesis: pg_cron tuning and materialized views meet T+15m for daily metrics.
- Metric: % intervals meeting T+15m.
- Target: ≥99%; red if <97%.
- Levers: cron cadence, query optimizations, monitoring.
- Owner: data lead.

4) API Error Rate
- Hypothesis: defensive coding and observability keep 5xx below threshold.
- Metric: % 5xx over rolling 7d.
- Target: ≤0.5%; red if >1%.
- Levers: circuit breakers, retries, error budgets.
- Owner: platform lead.

5) Agent Served via API
- Hypothesis: MCP tooling aligned to API v1 raises % of agent queries using official endpoints.
- Metric: % agent queries via MCP → API.
- Target: ≥100% of agent queries via API; red if agents read direct DB.
- Levers: tool adoption, API coverage.
- Owner: AI tools lead.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Strateg.is Facebook Metrics PRD — `../../prd/strategis-facebook-metrics-endpoint.md`
- Experiment Board — `./05-experiment-board.md`


