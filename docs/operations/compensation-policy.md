# Compensation Policy

## Overview
This policy governs variable compensation for media buyers and contributors to ensure fair ROI on efforts while maintaining healthy business profitability. Compensation is ROI-capped, tiered, and designed to scale with the business.

## Business-Level Profitability Guardrails

### Primary Guardrail: Variable Comp Cap
- **Total variable compensation** (buyers + assists + bounties + creative incentives) ≤ **35% of net margin**
- **Buyer compensation alone** ≤ **20% of net margin**
- **Auto-throttle trigger**: If rolling 30-day EBITDA proxy < 20%, reduce variable comp by 50% until recovery

### Profit Retention Target
- Aim to retain **50-60% of net margin** for overhead + profit
- This leaves room for business scaling while ensuring sustainability

## Buyer Compensation Structure

### Base Structure
- **Base salary**: Low/0 (performance-based model)
- **Portfolio ownership**: Each buyer owns their campaign portfolio
- **Monthly calculation**: Based on net margin contribution

### Tiered Revenue Share (Incremental)
Monthly portfolio margin tiers (incremental percentage):
- **$0–$20k**: 5%
- **$20k–$40k**: 7% (on the incremental amount)
- **$40k+**: 9% (on the incremental amount)

### ROI Protection Cap
- **Hard cap**: Total buyer compensation ≤ **20% of their portfolio margin**
- **Safety valve**: If tiered calculation exceeds cap, payout = cap amount

### Floors and Clawbacks
- **No payout** in months with net negative portfolio margin
- **30-day cash realization**: Payouts held until confirmed cash collection
- **Returns/chargebacks**: Reduce margin in the period they occur

## Assisted Margin (Idea Dividends)

### Eligibility
- Requires current Impact Filter with clear hypothesis
- Tagged in `strateg.is` with `ASSISTED_BY:{BUYER_NAME}`
- 30-day attribution window from idea launch

### Compensation
- **2-3% share** of attributed "assisted margin"
- **Cap**: Assisted payout ≤ **30% of base portfolio payout**
- **De-minimis**: Only count assists ≥ **$500 monthly margin uplift** per team member

### Attribution Rules
- Impact Filter must be current and approved
- Clear ownership and hypothesis documented
- Terminal checklists for proper tagging

## Bounties (Objective Performance Incentives)

### Launch Throughput Bounty
- **$250 bonus** if weekly launch rate ≥ 7 campaigns AND ≥4 breakeven in 72 hours (3+ consecutive weeks)

### Scaling Stability Bounty
- **$250 bonus** if ≥2 campaigns stabilized at ROAS ≥130% for 5+ consecutive days

### Creative Optimization Bounty
- **$100-200 bonus** for creative iterations that improve ROAS by ≥20% (tracked via A/B tests)

## Examples

### Scenario A: $5k/day net margin ($150k/month)
- Buyer portfolio: $120k margin
- Tiered calculation: 5% of first $20k ($1k) + 7% of next $20k ($1.4k) + 9% of $80k ($7.2k) = **$9.6k**
- Effective rate: 8%
- With assists/bounties: stays under 35% total variable comp
- Company retains: ≥$90k for overhead + profit

### Scenario B: $60k/month portfolio margin
- Tiered calculation: 5% of $20k ($1k) + 7% of $20k ($1.4k) + 9% of $20k ($1.8k) = **$4.2k**
- Effective rate: 7%
- Room for assists and bounties within guardrails

## Implementation Requirements

### strateg.is Integration
- `portfolio_margin`: Monthly net margin by owner
- `assisted_margin`: Tagged attribution with 30-day windows
- `effective_payout_rate`: Calculated vs. cap
- `guardrail_flags`: Auto-throttle triggers

### Terminal Automation
- Impact Filter validation checklists
- ASSISTED_BY tagging workflows
- Bounty eligibility tracking

### Human Control System Updates
- Weekly check-ins include Impact Filter links
- "Assisted candidates" tracking
- Performance vs. compensation transparency

## Review and Adjustment
- **Quarterly review** of all compensation plans
- **Annual calibration** of tiers and caps based on business performance
- **Key metrics**: ROI ratios, team retention, business profitability

## Emergency Provisions
- Auto-throttle activates if business profitability threatened
- Compensation can be paused during cash flow crises
- All changes require Impact Filter approval

