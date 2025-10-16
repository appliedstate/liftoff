---
title: Digital Self‑Management (DSM)
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Digital Self‑Management (DSM)

Principle
- Everyone sees the same numbers in real time; decisions are made from shared dashboards and APIs.

Data layers (aligned to AI Oversight PRD)
- Staging: raw platform and revenue extracts.
- Curated: fact_margin_daily, fact_revenue_daily, dim_buyer, bridge tables, assisted_margin, cashflow schedule.
- Serving: versioned HTTP API exposing curated views; MCP tools call the same API.

Scheduling & SLAs
- Materialized views refresh via pg_cron; daily metrics freshness T+15 minutes (target ≥99%).
- Strateg.is daily dashboard by 07:00; intra‑day updates ≤30 minutes lag during trading hours.
- Weekly rebalance Monday 09:00; monthly equity pack EOM+3 (draft), EOM+5 (final).

Access & governance
- Read‑only roles for API/MCP; strict RLS by role; audit logs for admin routes.
- No secrets in source; platform secrets manager only.

Observability
- metadata.refresh_log: job_name, started_at, finished_at, status, rows_affected, error_message.
- API metrics: latency, error rate; dashboards for freshness, last successful run, SLA adherence.

Controls & guardrails surfaced in DSM
- Auto‑throttle flags (EBITDA proxy, drawdown, cash cushion) shown on dashboards and via API.
- Kill/keep/scale flags per bucket based on CI(M), variance, and decay.

Interfaces
- REST API (read‑only) for curated views; OpenAPI schema in repo.
- MCP tools: get_daily_metrics, get_freshness mirror the API.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`
- Experiment Board — `./05-experiment-board.md`


