# Buyer Scorecard (One Page)

> Purpose: Monthly snapshot of portfolio results, innovation output, and shared-edge impact. Use alongside Strateg.is for intra-day ops.

## Header
- Buyer: __________  Month: ________  Seniority: [New/Mid/Senior]
- Accounts/Platforms: __________________________________________
- Primary score metric: `Net Margin`
- Leading indicators: `Session ROAS` / `vRPS` / `72h hit rate`

## KPIs (Month-to-Date)
- Spend: $__________   Revenue: $__________   Net Margin: $__________  (alpha = revenue/spend: ___)
- Variable Comp (policy): $__________   Base Salary (alloc): $__________
- Total Comp (incl. salary): $__________
- Net Contribution (Margin - Total Comp): $__________
- Effective Payout Rate (incl. salary): ________%
- Margin per Comp Dollar: ________x

## Efficiency Band (RAG)
- Target by Seniority:
  - Senior: green <= 22%, yellow 22-26%, red > 26%
  - Mid: green <= 26%, yellow 26-30%, red > 30%
  - New: green <= 32%, yellow 32-36%, red > 36%
- Current Band: [ Green | Yellow | Red ]

## Portfolio Quality
- CI Positive Buckets: ____ / ____  |  Sharpe-like Avg: ____
- Decay Exits this Month: ____  |  New Cells Launched: ____  |  72h Breakeven Cells: ____
- Session ROAS (7d): ____  |  vRPS vs baseline: ____  |  Launch hit rate: ____

## Discovery & Team Lift
- Validated Discoveries: ____ total
- Discovery Mix: ____ fast optimization  |  ____ creative/article/keyword  |  ____ category/funnel
- Discovery Bounties Earned: $__________
- Published Plays This Month: ____
- Adopting Buyers Using My Plays: ____
- Assisted Margin From Shared Plays: $__________
- Scale Dividends Earned: $__________

## Weighted Score
- Individual Output (50%): ________
- Discovery (25%): ________
- Team Lift (25%): ________
- Manager Assessment: [ Strong | On Track | Needs Attention ]

## Guardrails
- Drawdown Events: ____  |  Auto-Throttle Flags: [ ]
- Kill/Keep/Scale Compliance: [ ] Passed  |  [ ] Issues
- Alpha Window Compliance: [ ] Passed  |  [ ] Issues
- Documentation Compliance: [ ] Passed  |  [ ] Issues

## Notes & Actions (Top 3)
1. _______________________________________________________________
2. _______________________________________________________________
3. _______________________________________________________________

---

### Calculation Reference
- buyer_total_comp_month = variable_comp_capped + (annual_base_salary / 12)
- buyer_net_contribution = portfolio_margin_month - buyer_total_comp_month
- effective_payout_rate_incl_salary = buyer_total_comp_month / portfolio_margin_month
- margin_per_comp_dollar = portfolio_margin_month / buyer_total_comp_month
- scorecard_weights = 50% individual output + 25% discovery + 25% team lift
