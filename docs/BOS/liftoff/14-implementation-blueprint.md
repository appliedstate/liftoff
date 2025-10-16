---
title: Implementation Blueprint
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Implementation Blueprint

Phase 1: Curated Data + API v1 (1–2 weeks)
- Create curated schemas and materialized views for initial metrics.
- Implement API v1 endpoints with pagination and freshness metadata; publish OpenAPI.
- Enable pg_cron for view refresh; dashboards for freshness and error budgets.

Phase 2: MCP Tools + Observability (1 week)
- Build MCP tools as thin wrappers over API v1; no business logic in MCP.
- Add logs/metrics dashboards; alerts on freshness, latency, error rate.

Phase 3: CI/CD & Canaries (1 week)
- Trunk‑based dev; canary deploys for data and functions; rollback scripts.
- Enforce CI gates (tests, SLO adherence) and change notes.

Phase 4: Toil Reduction Portfolio (ongoing)
- Prioritize automation that removes arbitrage ops toil; track KPI per $.
- Quarterly portfolio review; reallocate to highest ROI bets.

Success criteria
- 99% freshness for daily metrics; 99.9% API availability.
- +50% deploy frequency; −30% lead time; stable/declining error rate.
- 100% agent queries served via MCP → API.

References
- AI Oversight PRD — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`

