---
title: KPIs as Experiments
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — KPIs as Experiments

Each KPI is a falsifiable hypothesis with an owner, metric definition, target band, and guardrails. Review weekly; iterate fast.

1) Net Margin/day
- Hypothesis: increasing allocation to highest \( \mathcal{S} \times w \) buckets will raise daily net margin without breaching drawdown or cash cushion thresholds.
- Metric: portfolio net margin per day ($).
- Target: $10k/day by ramp; green if ≥$7k and rising 2 weeks; red if < $3k.
- Guardrails: stop‑out at −`DD_max`; diversification limits; comp caps.
- Owner: portfolio lead.

2) Sharpe‑like (30d)
- Hypothesis: consolidation and guardrails reduce variance, lifting \( \mathcal{S} = E[M]/\sigma_M \).
- Metric: 30‑day \( \mathcal{S} \).
- Target: ≥1.0; red if <0.5.
- Levers: consolidation, kill rules, step‑up cadence.
- Owner: quant lead.

3) CI Positive % of Buckets
- Hypothesis: raising launch throughput and improving creative families increases % of buckets with positive CI(M).
- Metric: % of active buckets with 95% CI(M) > 0.
- Target: ≥65%; red if <50%.
- Levers: launch throughput ≥7/buyer/week; creative factory cadence; policy‑safe landers.
- Owner: ops lead.

4) Cash Cushion vs Required K
- Hypothesis: scheduling and receipts forecasting maintain cushion ≥ policy threshold while scaling.
- Metric: cushion / required \( K \) from 70/30 model.
- Target: ≥1.5×; red if <1.2×.
- Levers: pacing, receipts tracking, credit lines.
- Owner: finance.

5) Buyer Efficiency (incl. salary)
- Hypothesis: coaching and budget redeployments keep effective payout within bands by seniority.
- Metric: buyer_total_comp_month / portfolio_margin_month.
- Target: Senior ≤22% (green), 22–26% (yellow), >26% (red). Bands per model.
- Levers: budget reallocations, mentoring, throughput targets.
- Owner: ops lead.

References
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`
- Experiment Board — `./05-experiment-board.md`


