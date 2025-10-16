---
title: Implementation Blueprint
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Implementation Blueprint

MVB (1–2 weeks)
- Source platform CSVs + S1 revenue; stage in DB.
- Build curated tables and initial views (margin, receipts schedule, cash cushion).
- Strateg.is dashboards for daily ops; first monthly equity pack.
- Manual kill/keep/scale rules; dry‑run terminal actions with logging.

Phase 2 (2–3 weeks)
- API integration for data pulls; automate reconciliation; add decay/CI/Sharpe metrics.
- Implement Taboola early‑pause automation; weekly review export.
- Raise launch throughput; instrument variance/CI.

Phase 3 (1–2 weeks)
- Review queue, reinstatement workflow, allowlist management.
- Auto‑throttle signals (EBITDA proxy, drawdown, cushion) surfaced in dashboards.

Phase 4 (1–3 weeks)
- MediaGo integration contingent on API; otherwise campaign‑level pauses + manual workflow.
- CLI tools for non‑interactive runs; cron scheduling.

Success criteria
- <1% reconciliation error; daily dashboards by 07:00; equity pack EOM+5.
- Measurable reduction in wasted spend; time‑to‑pause <15 minutes median; ≤5% false‑positive reinstates.

References
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`
- Feasibility Assessment — `../../../feasibility-assessment-publisher-guardrails.md`
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`

