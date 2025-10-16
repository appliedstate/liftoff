# PRD — Arbitrage Portfolio Reporting & Equity Pack

Linkage: `../operations/arbitrage-portfolio-returns-model.md`, `../operations/compensation-policy.md`, `../ai-agents/jim-simons.md`, `../ai-agents/aion.md`, `../ai-agents/zuck.md`

## 1) Objective
Deliver a reliable reporting system that powers daily operations and produces a clear, investor‑grade equity pack. It must quantify net margin, ROI on capital, cashflow (70/30 receipts), compensation vs guardrails, buyer efficiency including base salary, and scaling progress to $10k/day net margin.

## 2) Scope
- In‑scope: Data model, ingestion, transformations, dashboards, monthly equity pack, cashflow/working capital forecasting, buyer compensation accruals.
- Out‑of‑scope (Phase 1): Real‑time streaming, ML forecasting beyond simple decay/sharpe metrics.

## 3) Users & Stakeholders
- Operators (buyers, leads): daily performance, kill/keep/scale gates
- Finance (controller/CFO): cash forecasting, accruals, comp, overhead
- Equity holders/board: monthly pack, risk posture, scale roadmap, compliance

## 4) Data Sources & Required Inputs

### 4.1 Ad Platforms (daily granularity)
- Meta, Taboola, Outbrain, NewsBreak, MediaGo, SmartNews
- Fields (min set):
  - date, platform, account_id, campaign_id, adset_id (or equivalent), ad_id
  - buyer_owner, placement, country, device (if available)
  - spend, impressions, clicks, CPM, CPC, CTR
  - conversions (primary), conversion_value (if available), CVR
  - learning/diagnostic states (Meta), delivery flags (if available)

### 4.2 Revenue/Partners (System One + others)
- Daily revenue realized; corrections/adjustments; 70/30 payment schedule metadata
- Fields:
  - date, partner, product/placement tag, gross_revenue, adjustments, net_revenue
  - payment_terms: {weekly_70, eom_plus_30_30}
  - scheduled_payment_date (derived), payment_batch_id

### 4.3 Internal Mapping & Policy
- Buyer roster and ownership map: buyer → platform accounts, risk caps, seniority
- Creative families, landers, experiments (for assisted margin)
- Compensation policy parameters and guardrails (caps, tiers)
- Overhead model (fixed/variable by month)

### 4.4 Calendars & Controls
- Banking/payments calendar; known holidays; cutoff times
- Guardrail parameters: DD_max, throughput quotas, kill/scale rules

## 5) Data Model (Schema)

Tables (logical):
1) `dim_buyer`
   - buyer_id, name, start_date, seniority_level, risk_cap_daily
2) `dim_platform_account`
   - platform, account_id, buyer_id, status
3) `dim_creative_family`
   - family_id, description, product, lander_url
4) `fact_spend_daily`
   - date, platform, account_id, campaign_id, adset_id, ad_id, placement, country, device
   - spend, impressions, clicks, ctr, cpc, cpm, conversions, conversion_value, cvr
5) `fact_revenue_daily`
   - date, partner, product_tag, gross_revenue, adjustments, net_revenue
6) `bridge_traffic_to_revenue`
   - date, platform, account_id, campaign_id, matching_key(s), partner, product_tag, attribution_weight
7) `fact_margin_daily` (derived)
   - date, platform, account_id, campaign_id, buyer_id, revenue, spend, net_margin, margin_rate
8) `fact_variance_daily` (derived)
   - date, entity_keys..., sigma_margin, ci_sign, sharpe_like
9) `fact_decay`
   - entity_keys..., edge_age_days, half_life_days, decay_weight
10) `fact_cashflow_schedule` (derived)
    - date, receipts_70, receipts_30, scheduled_payment_date, realized_flag
11) `fact_working_capital`
    - date, spend_outflows, receipts_inflows, cumulative_float, cash_cushion_required
12) `fact_comp_accruals`
    - month, buyer_id, portfolio_margin, payout_calc, payout_capped, accrual_status, paid_date
13) `fact_assisted_margin`
    - window_start, window_end, buyer_id, assisted_margin, evidence_link
14) `fact_overhead`
    - month, fixed_overhead, variable_overhead, notes
15) `fact_buyer_costs`
    - month, buyer_id, base_salary_allocated, bonuses, other_costs

Notes:
- `fact_margin_daily` aligns to `arbitrage-portfolio-returns-model.md` definitions.
- Attribution can be bridged by agreed keys; start with product/placement tagging; refine later.

## 6) Transformations & Core Metrics
- Net Margin: M = revenue − spend − variable_costs (if any)
- Margin Rate: m = M / spend; Revenue/Spend ratio α = revenue / spend
- Sharpe‑like: S = E[M] / σ_M (rolling window)
- Decay weight: w = exp(−ln(2) · age_days / half_life)
- CI sign: positive if 95% CI(M) > 0
- Rolling 30‑day EBITDA proxy per policy
- Working capital: steady‑state float based on 70/30 schedule and spend profile
- Comp payout: tiered schedule with 20% cap of portfolio margin; accrual = payable on cash collection

Buyer efficiency (includes salary):
- base_salary_monthly = annual_base_salary / 12
- buyer_total_comp_month = variable_comp_capped + base_salary_monthly
- buyer_total_cost_month = buyer_total_comp_month + allocated_buyer_other_costs (optional)
- buyer_net_contribution = portfolio_margin_month − buyer_total_cost_month
- buyer_efficiency_ratio = buyer_net_contribution / portfolio_margin_month
- margin_per_comp_dollar = portfolio_margin_month / buyer_total_comp_month
- effective_payout_rate_incl_salary = buyer_total_comp_month / portfolio_margin_month
\- efficiency_targets: set band goals per buyer seniority (review quarterly)
  - Senior: effective_payout_rate_incl_salary ≤ 22% (green), 22–26% (yellow), >26% (red)
  - Mid: ≤ 26% (green), 26–30% (yellow), >30% (red)
  - New: ≤ 32% (green), 32–36% (yellow), >36% (red)

## 7) Reports & Equity Pack

### 7.1 Daily & Intra‑Day Operator Dashboard — Strateg.is
- Strateg.is is the primary operator dashboard (daily + intra‑day).
- By buyer and platform: spend, revenue, net margin, CI sign, S, decay w, guardrail flags
- Kill/keep/scale candidates; throughput versus quota; risk utilization vs DD_max
\- Buyer efficiency tiles: effective_payout_rate_incl_salary vs target band, buyer_net_contribution trend

### 7.2 Weekly Rebalance Sheet
- Allocation deltas by S × w; top/bottom 10 buckets; decay exits; SmartNews status

### 7.3 Monthly Equity Pack (Board‑ready)
- Executive Summary: net margin, growth, major wins/losses, next month’s plan
- P&L Bridge: revenue, spend, net margin; overhead; EBITDA proxy
- Cash Flow & Working Capital: 70/30 receipts realized vs scheduled; cushion coverage
- Compensation vs Guardrails: buyer payouts vs 20% cap, total variable ≤35% net margin
- Buyer Efficiency Economics: margin, variable payout, salary allocation, net contribution, effective payout rate incl. salary, margin_per_comp_dollar
\- Efficiency Targeting: show band compliance by buyer and deltas vs prior month
- Portfolio Quality: CI distribution, Sharpe‑like improvements, decay exits
- Scale Roadmap to $10k/day: campaign count at $250–$500/day margin, gaps, timelines
- Risk & Controls: drawdown events, auto‑throttle triggers, compliance notes

Deliverables: PDF + live dashboard links; CSV exports for all tables above.

## 8) Cadence & SLAs
- Ingestion: nightly by 06:00 local; retries until 10:00
- Daily dashboard refresh: by 07:00
- Strateg.is intra‑day refresh: rolling updates during trading hours; target SLA ≤30 minutes lag
- Weekly rebalance: Mondays 09:00
- Monthly equity pack: EOM + 3 business days (draft), final by EOM + 5
- Data quality SLA: ≥99% row completeness on fact tables; reconciliation ≤1% variance to platform totals

## 9) Acceptance Criteria
1) Data: All tables populated for the last 90 days with <1% reconciliation error
2) Cashflow: Receipts schedule correctly forecasts and reconciles 70/30 payments
3) Comp: Accruals match policy tiers and caps; payout dates align to cash collection
4) Ops: Kill/keep/scale flags align with CI rules and appear by 07:00 daily
5) Equity Pack: One‑click export compiles the monthly pack with all sections above
6) Security: RBAC limits buyer‑level viewing to own portfolios; finance sees all; board sees aggregate and sanitized buyer details
7) Buyer Efficiency: effective_payout_rate_incl_salary, buyer_net_contribution, and margin_per_comp_dollar are calculated and visible per buyer

## 10) Implementation Plan (MVB → Phase 2)
- MVB (1–2 weeks):
  - Source CSV exports from platforms + System One; stage in a simple DB or Sheets
  - Implement transformations in SQL/DBT or Python scripts
  - Build dashboards in Strateg.is (primary) and/or Looker/Metabase/Sheets; generate the first monthly pack
- Phase 2: API integrations, automated attribution bridge, anomaly detection, forecasting

## 11) Risks & Mitigations
- Attribution ambiguity → start with product/placement tagging and reconcile at aggregate
- Payment timing variance → parameterize schedule; show min/most‑likely/max cashflow
- Platform schema drift → versioned ingestion; validation checks

## 12) Zuck Review (Consultation Plan)
- Timing: After 7 days of telemetry on the model (or immediately for Meta‑specific stacking)
- Inputs: campaign architecture, AEM ranking, learning states, delivery diagnostics, creative rotation cadence
- Expected Output: consolidation and Advantage+/CBO alignment; budget ramp cadence; signal enrichment plan

## 13) Model Efficiency & Effectiveness (Assessment)
- Efficiency: High — fractional‑Kelly with decay and CI gates focuses capital on higher confidence edges; comp accruals align to cash collection.
- Effectiveness: Strong for portfolio control and scale discipline; dependent on signal quality and steady attribution. Recommend Zuck consult to harden Meta‑specific architecture (consolidation, AEM, Advantage+).


