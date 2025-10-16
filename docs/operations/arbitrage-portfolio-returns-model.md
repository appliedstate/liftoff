# Arbitrage Portfolio Returns Model — Jim (Quant) + Aion (Ops)

> Objective: Design a portfolio and cashflow model to scale daily net margin to $10,000 while respecting ROI on capital, compensation and overhead guardrails, and cash conversion dynamics (System One 70% weekly, 30% EOM+30).

Stakeholders: Phil, Andrew, Dan, Ben, Mike, Anastasia, TJ, Brie

Inventory: Meta properties, Taboola, Outbrain, NewsBreak, MediaGo; SmartNews reinstatement opportunity.

References:
- `../ai-agents/jim-simons.md`
- `../ai-agents/aion.md`
- `../operations/compensation-policy.md`
- `../operations/facebook-margin-5k-plan.md`

---

## 1) Definitions and Notation

- Revenue (daily): \( R_d \)
- Ad Spend (daily): \( S_d \)
- Net Margin (daily): \( M_d = R_d - S_d - other\_variable\_costs \)  
  If other variable costs are embedded in revenue share and traffic costs, treat \( M_d \) as your realized “after platform/partner” net.
- Capital At Risk (working capital tied up): \( K \)
- Portfolio Return on Invested Capital (daily): \( ROIC_d = M_d / K \)
- Volatility of margin (daily std dev): \( \sigma_M \)
- Edge half‑life (days): \( t_{1/2} \) with decay \( \lambda = \ln(2)/t_{1/2} \)
- Risk budget (max daily drawdown tolerance): \( DD_{max} \)
\- Buyer efficiency (monthly): effective payout incl. salary = buyer_total_comp_month / portfolio_margin_month

Cash conversion (System One):
- 70% of revenue collected weekly (assume collected following week on a fixed weekday)
- 30% collected Net 30 from end of month (EOM+30)

---

## 2) Jim’s Quant Portfolio Model (Allocation + Risk)

Principles (see `jim-simons.md`): model everything, quantify uncertainty, assume decay.

### 2.1 Campaign Grouping and Signals
- Group campaigns by channel × placement × creative family (e.g., Meta|Reels|Family A).
- For each group g, estimate expected daily net margin \( \mathbb{E}[M_g] \), variance \( Var[M_g] \), Sharpe‑like score \( \mathcal{S}_g = \mathbb{E}[M_g] / \sigma_{M,g} \).
- Track decay: down‑weight edges by \( w_g = e^{-\lambda_g \cdot age} \).

### 2.2 Budget Allocation Rule (Fractional Kelly with Constraints)
- For each group g with controllable spend \( S_g \) and expected margin rate \( m_g = \mathbb{E}[M_g]/S_g \):
  - Compute Kelly‑style fraction \( f_g = \max\{0, \mathbb{E}[M_g] / Var[M_g]\} \) on normalized units.
  - Use conservative fraction \( f^{*}_g = c \cdot f_g \), with \( c \in [0.1,0.3] \) to reflect cash and drawdown constraints.
  - Allocate budget proportionally to \( f^{*}_g \cdot w_g \) subject to:
    - Per‑buyer risk budget \( DD_{max,buyer} \) and per‑channel caps
    - Cross‑platform diversification: \( \le 35\% \) of total at any single platform bucket
    - Kill rule: if 3‑day rolling \( M_g < 0 \) and \( 95\% \) CI below 0, pause and recycle budget
    - Efficiency guard: if buyer’s effective payout incl. salary breaches red band for 2 consecutive weeks, slow scale to neutral until efficiency recovers

### 2.3 Portfolio Risk Guardrails
- Daily portfolio max drawdown: stop‑out if \( M_d < -DD_{max} \)
- Rolling 30‑day EBITDA proxy auto‑throttle per compensation policy
- Buyer‑level: \( \le 15\% \) of total daily risk per buyer; new buyers \( \le 8\% \) until two consecutive profitable weeks

### 2.4 Target Math to $10k/day
- Let average stabilized campaign net margin be \( \overline{m} \) per day; required count \( N = 10000 / \overline{m} \)
  - Example A: \( \overline{m} = 500 \Rightarrow N = 20 \)
  - Example B: \( \overline{m} = 250 \Rightarrow N = 40 \)
- If current baseline is ~$5k/day, incremental \( \Delta M = 5k/day \). Allocate additional risk capital toward highest \( \mathcal{S}_g \) buckets and new venue (SmartNews) until \( \sum_g \mathbb{E}[M_g] \approx 10k/day \).

---

## 3) Aion’s Operational Layer (MVB + Cadence)

Principles (see `aion.md`): rate of iteration is king; delete before optimizing; DRIs own results.

### 3.1 72‑Hour MVB
- Reactivate SmartNews with a narrow MVB:
  - 3 creatives × 2 headlines × 2 landers cloned from top performing Taboola/Outbrain family
  - Budget: $1.5k/day pilot; guardrail: pause cell if ROAS < 1.1 after 2k clicks unless strong learning signal
  - Telemetry: daily ROAS, CPM, CTR, CVR, margin; variance and half‑life estimates
- Replace Sliide gap: redeploy budget to the top two non‑Sliide buckets by \( \mathcal{S}_g \) with 20% step‑ups per day contingent on stable \( CI(M_g) > 0 \).

### 3.2 Launch and Kill/Keep/Scale Rules
- Launch quota per buyer: ≥7/week; breakeven within 72h for ≥4/week
- Kill: 3‑day negative margin with 95% CI → pause
- Keep: 3‑day positive with \( CI(M_g) > 0 \) → hold
- Scale: step‑up 15–25% daily while \( dM/dS > 0 \) and \( CI(M_g) > 0 \)

### 3.3 DRIs and Ownership
- Phil, Andrew, Dan, Ben, Mike, Anastasia, TJ, Brie each own a platform mix with clear budgets and risk caps; senior buyers mentor new venue spins (SmartNews).

### 3.4 "Do This Next"
1) Reallocate Sliide budget to top two \( \mathcal{S}_g \) buckets (today)
2) Launch SmartNews MVB (72h) with tight guardrails
3) Raise launch throughput to ≥7/week/buyer; instrument variance and CI on margin
4) Weekly rebalance using \( \mathcal{S}_g \cdot w_g \) and auto‑throttle flags
5) Track cashflow realizations vs. spend; adjust \( c \) in fractional Kelly by cash cushion
6) Monitor buyer efficiency bands weekly; coach and reassign budgets to maintain green/yellow

---

## 4) Cash Flow Model (70/30 Receipts) and Working Capital

Assumptions:
- System One pays 70% of revenue weekly (Week+1), 30% Net 30 from EOM
- Ad spend cash leaves T+0 (same day) or T+1; treat as immediate for prudence

### 4.1 Schedule Mechanics
- For daily revenue \( R_d \) in week W:
  - Collected: \( 0.7 \cdot R_W \) on the following scheduled weekly payday
- For month revenue \( R_{mo} \):
  - Collected: \( 0.3 \cdot R_{mo} \) on EOM+30

### 4.2 Working Capital Approximation
Let \( S_d \) be daily spend. Receipts lag spend, so required working capital is roughly:
\[ K \approx \sum_{days\ in\ lag} (S_d - Receipts_d) \]
Practical approximation for steady state with daily margin \( M_d \) and revenue share \( \alpha = R/S \):
\[ R = \alpha S,\quad M = R - S = (\alpha - 1)S \Rightarrow S = M/(\alpha - 1) \]
If \( \alpha = 1.25 \) (25% margin before overhead/comp), then \( S \approx 4M \).

Cash receipts timing implies at least 1–2 weeks of spend float plus 30% month‑end lag. For a target \( M = 10k/day \) and \( \alpha = 1.25 \):
- Daily spend \( S \approx 40k \)
- Weekly spend \( \approx 280k \)
- Working capital cushion target: 2× weekly spend minus expected 70% weekly receipts; plus a month‑end 30% tail. Maintain \( K \ge 1.5–2.5 \times \) weekly spend for safety unless empirical receipts variance proves tighter.

### 4.3 Cash Flow Example (Illustrative)
Month with 30 days, uniform \( R = 50k/day \), \( S = 40k/day \), \( M = 10k/day \):
- Weekly receipts: \( 0.7 \times 350k = 245k \)
- Month‑end tail: \( 0.3 \times 1.5M = 450k \) paid on EOM+30
- Outflows: spend \( 1.2M \); Inflows during month: \( 3 \times 245k = 735k \); Net float buildup during month ≈ \( 1.2M - 735k = 465k \); tail clears EOM+30

Implication: you need ~0.5–0.8M liquidity to support $10k/day net margin at these ratios. Tighten with actual \( \alpha \), spend terms, and payment calendars.

---

## 5) Compensation and Overhead Integration

Guardrails (see `compensation-policy.md`):
- Total variable comp ≤ 35% of net margin
- Buyer compensation cap ≤ 20% of net margin
- Profit retention target 50–60% of net margin to cover overhead + profit

At $10k/day (≈ $300k/month):
- Company retains target: $150k–$180k for overhead + profit
- Total variable comp budget (max): $105k
- Illustrative buyer payouts follow tiered schedule; enforce 30‑day cash realization and clawbacks

Operational rule: payouts accrue but release upon cash collection (align with 70/30). If cash cushion < threshold, auto‑throttle variable comp (−50%) until EBITDA proxy recovers (policy).

---

## 6) Buyer‑Level Portfolio Template

Use this template per buyer weekly. Fill one row per platform × placement bucket.

| Buyer | Channel | Placement | Daily Spend ($) | Expected Margin % | Net Margin/day ($) | CI sign? | Variance (σ) | Edge Age (d) | Decay w | Risk Cap ($) | Action |
|---|---|---|---:|---:|---:|:--:|---:|---:|---:|---:|---|
| Phil | Meta | Reels | 8,000 | 22% | 1,760 | + | 600 | 9 | 0.73 | 3,000 | Scale 20% |
| Andrew | Taboola | Sliide‑alt | 5,000 | 18% | 900 | + | 450 | 5 | 0.70 | 2,000 | Keep |
| Dan | Outbrain | Feed | 4,000 | 12% | 480 | ? | 520 | 2 | 0.62 | 1,500 | Kill if −3d |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

Rollup per buyer: sum \( M_g \), check against comp caps, and verify risk utilization vs. \( DD_{max,buyer} \).

---

## 7) Scaling Plan to $10k/day

1) Replace Sliide shortfall: move budget to two highest \( \mathcal{S}_g \) non‑Sliide buckets with step‑ups (today + next 3 days)
2) SmartNews MVB: $1.5k/day test; target ≥$500/day net margin within 7 days across 2–3 cells
3) MediaGo/NewsBreak expansions: 2 new cells per buyer this week with explicit kill gates
4) Creative factory: 3× weekly iterations against top two families; bounty hooks active
5) Stabilize 20–40 campaigns at \( \overline{m} = $250–$500 \) to reach $10k/day; re‑balance weekly

Telemetry to track daily: margin by bucket, \( \mathcal{S}_g \), CI sign, cash cushion vs. required K, guardrail flags, payout accrual vs. collected cash.

---

## 8) Daily Ops Checklist and Risk Controls

Morning
- Check prior‑day \( M_d \), CI sign per bucket, and drawdown vs. \( DD_{max} \)
- Auto‑pause red buckets; pre‑approve scale on green with bandwidth

Midday
- Monitor step‑ups; confirm \( dM/dS > 0 \)
- Validate SmartNews learning; keep within guardrails

EOD
- Reconcile spend vs. receipts forecast (70/30 model)
- Update accrual for comp; evaluate auto‑throttle flags

Weekly
- Rebalance via \( \mathcal{S}_g \cdot w_g \); rotate out decayed edges
- Throughput check: launches ≥7/buyer; ≥4 breakeven in 72h
- Review buyer payout projections vs. caps and cash collection

---

## 9) Formulas (Quick Reference)

- Net Margin: \( M = R - S - v \) (v = other variable costs)
- Margin Rate: \( m = M/S = \alpha - 1 \) where \( \alpha = R/S \)
- Working Capital (steady state, rough): \( K \approx weeks\_to\_collect \times weekly\_spend - weekly\_70\%\_receipts + month\_tail\times0.3\times monthly\_revenue \)
- Sharpe‑like: \( \mathcal{S} = \mathbb{E}[M]/\sigma_M \)
- Decay weight: \( w = e^{-\lambda \cdot age}, \; \lambda=\ln(2)/t_{1/2} \)
- Fractional Kelly scaling: \( f^* = c \cdot (\mathbb{E}[M]/Var[M]) \), clipped to [0, f\_max]

---

## 10) Implementation Notes

- All payouts accrue but release on cash collection (align to 70/30). See `compensation-policy.md`.
- Instrument weekly receipts schedule and EOM tails in the terminal dashboard. Maintain a live cash cushion meter.
- Treat SmartNews as a new independent bucket; begin with low \( c \) in fractional Kelly until CI positive for 5+ days.


