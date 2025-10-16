---
title: Experiment Board
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Experiment Board

One row per KPI experiment. Update weekly (squads), review weekly (owners).

| KPI | Definition | Current Value | Trend | Cost/Run | Financial Efficiency (ΔKPI per $) | Owner | Next Step |
|---|---|---|---|---|---|---|---|
| Deployment Frequency | Prod deploys per week |  |  | CI/CD cost |  |  |  |
| Lead Time for Change | PR merge → prod |  |  | Eng time |  |  |  |
| Data Freshness SLA | % intervals meeting T+15m |  |  | Infra |  |  |  |
| API Error Rate | % 5xx over rolling 7d |  |  | Infra |  |  |  |
| Agent Served via API | % agent queries via MCP → API |  |  | Dev |  |  |  |

Notes
- Source: CI/CD, observability, API metrics; see AI Oversight and Strateg.is PRDs.
- Owners review weekly: choose automation targets that reduce arbitrage ops toil.


