---
title: Financial Policy
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Financial Policy

Objectives
- Scale net margin while preserving account safety and liquidity; align comp to realized cash.

Capital allocation
- Weekly rebalance using \( \mathcal{S} \times w \) (Sharpe × decay) with conservative Kelly factor \( c \in [0.1,0.3] \).
- Diversification: ≤35% of total at any single platform bucket; per‑buyer ≤15% daily risk (new ≤8%).
- Drawdown guardrail: portfolio stop‑out at −`DD_max`.

Liquidity & cash policy
- Base on 70/30 receipts schedule (weekly 70%, EOM+30 30%).
- Maintain working‑capital cushion \( K \ge 1.5–2.5\times \) weekly spend unless empirical variance supports lower.
- If cushion < threshold, auto‑throttle variable comp (−50%) and slow scale until restored.

Compensation alignment
- Variable comp ≤35% of portfolio net margin; buyer compensation ≤20% of portfolio margin.
- Accruals release upon cash collection; clawbacks for upstream adjustments.
- Efficiency bands by seniority (see Returns Model); budgets reassign when in red for 2 consecutive weeks.

Profit retention & overhead
- Target 50–60% of portfolio net margin retained for overhead + profit to fund resilience and new bets.

Approvals & non‑reversible changes
- Owner pre‑approval for large capital increases, partner onboarding/termination, and policy‑sensitive architectures.

Reporting
- Daily dashboards by 07:00; weekly rebalance note; monthly equity pack (P&L bridge, cashflow, comp vs caps, efficiency bands).

Related docs
- Finance Overview & Targets — `../../finance/public/README.md`
- Finance Metrics & Definitions — `../../finance/public/metrics.md`
- Private Templates — `../../finance/private/templates/`

References
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`

