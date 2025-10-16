---
title: Digital Self‑Management (DSM)
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Digital Self‑Management (DSM)

Principle
- Shared, automated metrics create flat execution: builders and operators see the same truth.

Data layers (AI Oversight PRD)
- Staging → Curated → Serving with materialized views and pg_cron.
- Serving layer is a versioned, read‑only HTTP API; MCP tools are thin adapters.

Scheduling & SLAs
- Daily metrics freshness T+15 minutes (≥99% target); API availability 99.9%.
- Backfills via admin endpoints with bounded ranges and audit.

Access & governance
- RLS on curated tables; least‑privilege read roles for API/MCP; secrets in platform vaults only.
- Versioned endpoints with pagination and bounded windows; no direct engine access for agents.

Observability
- Refresh logs with start/finish/status/rows; API metrics (latency, error rate, rate limits); dashboards for freshness and SLA adherence.

Controls surfaced in DSM
- Feature flags, error budgets, and rollbacks are visible; incidents trigger stop‑the‑line and RCA within 2 business days.

Interfaces
- REST API v1 plus OpenAPI schema; MCP tools mirror API resources.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Experiment Board — `./05-experiment-board.md`


