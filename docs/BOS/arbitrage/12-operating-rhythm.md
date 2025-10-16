---
title: Operating Rhythm
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Operating Rhythm (Daily/Weekly)

Daily checklist
- Morning (by 07:00)
  - Review prior‑day portfolio net margin (M_d), CI sign per bucket, drawdown vs `DD_max`.
  - Auto‑pause red buckets; pre‑approve scale on green with bandwidth.
  - Verify data freshness SLAs met; investigate gaps.
- Midday
  - Monitor step‑ups; confirm \( dM/dS > 0 \) and \( CI(M) > 0 \).
  - Validate new launches; keep within guardrails and policy.
- End of day
  - Reconcile spend vs receipts forecast (70/30 schedule) and cash cushion.
  - Update comp accruals and guardrail flags; log major decisions with evidence.

Weekly review (owners + operators)
- Inputs
  - Experiment Board, Strateg.is dashboards, receipts schedule, comp accruals, risk utilization.
- Agenda
  - What moved which KPI, by how much, at what cost? (financial efficiency)
  - Rebalance using \( \mathcal{S} \times w \) (Sharpe × decay); rotate out decayed edges.
  - Top/bottom 10 buckets; diversification and per‑buyer risk check.
  - Launch throughput: ≥7/buyer; ≥4 breakeven in 72h.
  - Buyer efficiency bands and payouts vs caps (variable ≤35%, buyer ≤20%).
  - Cash cushion vs required \( K \); actions if below threshold.
  - Approvals needed (non‑reversible/policy‑sensitive changes).
- Outputs
  - Kill/keep/scale decisions; rebalanced budgets and caps.
  - Owner notes and risks; list of experiments for next week.

SLAs
- Daily dashboards by 07:00; weekly review Mondays 09:00; monthly equity pack EOM+3 (draft), EOM+5 (final).

References
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`
- Owner Alignment — `./02-owner-alignment.md`


