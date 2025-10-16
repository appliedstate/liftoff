---
title: Automation and Tests
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Automation and Tests

Automation scope
- CI/CD pipelines, data refresh jobs (pg_cron), materialized view rebuilds, and API deployments.
- Observability pipelines for freshness, latency, error rates, and budgets.
- MCP tools generation and verification from OpenAPI.

Test strategy
- Unit: data transforms, API handlers, auth/RLS policies (where testable), utility modules.
- Integration: curated view refreshes vs fixtures; API routes ↔ DB; auth and pagination behaviors.
- Contract: OpenAPI schema conformance; MCP tools return exactly API shapes.
- E2E (staging): deploy canaries; verify SLOs; rollback drill.

CI/CD gates
- Block deploy if: freshness <99%, API 5xx >0.5%, change failure rate threshold breached, tests <95% pass.
- Required artifacts: change notes, runbook link, dashboard link, rollback plan.

Security & governance
- Secrets via platform vault; RLS enforced; least‑privilege read roles for API/MCP.
- Schema migrations must include rollback scripts and data safety checks.

Metrics for automation quality
- Deployment frequency, lead time, change failure rate, MTTR; API error rate; % agent queries via API.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Experiment Board — `./05-experiment-board.md`


