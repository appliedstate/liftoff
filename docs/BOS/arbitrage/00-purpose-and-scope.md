---
title: Purpose & Scope
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Purpose & Scope

Purpose: operate a disciplined capital-allocation portfolio that converts attention/inventory into cash with strict risk controls, comp guardrails, and fast iteration. Ladder to BOS: we treat markets as experiments; scale edges while they exist; unwind quickly when efficiency decays.

Top links
- PRD: Arbitrage Portfolio Reporting — `../../prd/arbitrage-portfolio-reporting-prd.md`
- Model: Portfolio Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`
- PRD: AI Oversight Data Access/Scheduling — `../../prd/ai-oversight-data-access-and-scheduling-prd.md`
- Agreement: Interlincx × Adnet SLA — `../../private/agreements/interlincx-adnet-sla-arbitrage-agreement.md`
- PRD: Strateg.is Facebook Metrics — `../../prd/strategis-facebook-metrics-endpoint.md`

Objectives
- Reach and sustain $10k/day net margin with acceptable drawdown and cash cushion.
- Maintain policy/compliance and account safety across platforms (Meta, Taboola, Outbrain, MediaGo, NewsBreak; SmartNews when reinstated).
- Produce an investor‑grade monthly equity pack and daily/intra‑day operator dashboards.

Scope (v1)
- Include: portfolio allocation, reporting, comp accruals, cashflow modeling (70/30), buyer efficiency, guardrail automation.
- Exclude (v1): ML forecasting beyond decay/Sharpe, real‑time streaming beyond intra‑day Strateg.is refresh.

Primary KPIs (experiments)
- Net margin/day and margin rate by bucket (platform × placement × creative family).
- Sharpe‑like score and CI sign for margin.
- Drawdown vs `DD_max` and risk utilization by buyer.
- Working capital cushion vs required K (70/30 receipts model).
- Buyer efficiency: effective payout incl. salary bands by seniority; margin_per_comp_dollar.

Guardrails (policy)
- Stop‑out if daily portfolio margin < −`DD_max`.
- Kill if 3‑day rolling margin < 0 and 95% CI below 0.
- Comp caps: variable ≤35% portfolio net; buyer ≤20%; accrual release on cash collection.
- Spend diversification: ≤35% total at any single platform bucket; per‑buyer ≤15% of daily risk (new buyers ≤8%).

Operating rhythm
- Intraday: Strateg.is updates; alerts on kill/scale; budget step‑ups 15–25% while dM/dS > 0 with positive CI.
- Daily: 07:00 dashboards; reconcile spend vs receipts forecast; update comp accruals; check guardrails.
- Weekly: rebalance by `S × w` (Sharpe × decay); launch quota ≥7/buyer; ≥4 breakeven in 72h.
- Monthly: equity pack (EOM+3 draft, EOM+5 final); review efficiency bands and cash cushion.

Data and DSM
- Curated facts/dimensions; materialized aggregates; versioned API for agents (see AI Oversight PRD).
- Freshness SLAs: T+15m daily metrics; 99.9% API availability.

Outcomes
- Capital deployed to best edges with rapid exit on decay; transparent cash conversion; repeatable scale discipline aligned to BOS Sections 4–12.


