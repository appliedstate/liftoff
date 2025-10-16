---
title: Purpose & Scope
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Purpose & Scope

Purpose: build enduring capabilities, products, and systems that compound throughput, quality, and cost efficiency across the company. Ladder to BOS: invest in automation, data, and product surfaces that shrink cycle time and raise the ceiling for all arbitrage and non‑arbitrage lines.

Top links
- BOS Sections 6–14 (DSM, iteration, automation, financial policy, onboarding)
- PRD: AI Oversight Data Access/Scheduling — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- PRD: Strateg.is Facebook Metrics — `../../prd/strategis-facebook-metrics-endpoint.md`
- Docs: Creative Factory/Automation — `../../creative/40-creative-factory.md`
- Docs: Human Control System — `../../operations/human-control-system.md`

Objectives
- Reduce cycle time for experiment → decision across teams (target 50%+ improvement).
- Increase deployment frequency and reliability of data/automation (DORA metrics).
- Provide a single, versioned API surface for reporting data usable by apps and AI agents.

Scope (v1)
- Include: curated data models, API v1, MCP tools, pg_cron scheduling, observability, CI/CD and canaries for data and functions.
- Exclude (v1): net‑new warehouse; complex orchestration beyond SQL + simple jobs.

Primary KPIs (experiments)
- Cycle time (PR → prod) and deployment frequency for data/API.
- Data freshness SLA adherence; error rate and SLO violations.
- Product/adoption: daily active users of dashboards/tools; time‑to‑insight.
- Unit economics: infra cost per query and per dashboard user.

Guardrails
- Read‑only consumption for agents via API; strict RLS and least privilege.
- Versioned endpoints with pagination and bounded windows; no direct engine calls by agents.
- Observability: refresh logs, API latency/error budgets; rollback on breach.

Operating rhythm
- Daily: ship; small safe changes; monitor freshness and error budgets.
- Weekly: KPI review; prioritize automation that removes manual steps for arbitrage operations.
- Quarterly: re‑validate KPI set and investment portfolio vs thousand‑year goal.

Data and DSM
- Three‑layer model (staging, curated, serving) with materialized views; pg_cron.
- MCP tools as thin wrappers over API; no business logic in MCP.

Outcomes
- Shared infrastructure increases speed and quality of arbitrage operations and future products; compounding capability aligns to BOS Sections 6–12 and 14.


