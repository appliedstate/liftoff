# System1 Opportunity Scoring System

## Overview

The System1 Opportunity Scoring System maximizes **incremental contribution margin per day (ΔCM/day)** by ranking and scoring opportunities from System1 keyword/slug data.

## Architecture

### Core Components

1. **Opportunity Scoring** (`score_opportunities.ts`)
   - Scores clusters (categories) as opportunities
   - Calculates predicted ΔCM with confidence intervals
   - Ranks by ΔCM/slot and ΔCM/$

2. **Blueprint Generator** (`generate_blueprint.ts`)
   - Creates launch-ready plans from scored opportunities
   - Defines lane mix (ASC/LAL/Interest), budgets, creatives
   - Sets KPI targets and test plans

3. **Ranking System**
   - **By ΔCM/Slot**: For slot-limited scenarios (max launches/day)
   - **By ΔCM/$**: For budget-limited scenarios (max budget/day)

## Usage

### 1. Score Opportunities

```bash
npm run system1:score -- 2025-11-07
```

**Outputs:**
- `opportunities_ranked_by_slot.csv` - Ranked by ΔCM per launch slot
- `opportunities_ranked_by_budget.csv` - Ranked by ΔCM per dollar
- `opportunities_detailed.json` - Full opportunity data with metadata

### 2. Generate Blueprints

```bash
npm run system1:blueprint -- 2025-11-07
```

**Outputs:**
- `blueprints.json` - Launch-ready blueprints
- `blueprints_summary.csv` - Summary of all blueprints

## ΔCM Calculation

```
ΔCM = EstimatedRevenue - Cost - FixedCosts

Where:
- EstimatedRevenue = Budget × RevenuePerDollar × ConversionMultiplier
- RevenuePerDollar = System1 RPS / WeightedCPC
- ConversionMultiplier = 0.4 (40% of System1 performance in paid)
- Cost = RecommendedBudget
- FixedCosts = $100 per launch
```

**Confidence Score:**
- Based on data volume (keywords, revenue, clicks, searches)
- Higher confidence = more data = more reliable estimate

## Opportunity Fields

Each opportunity includes:

- **Metrics**: Revenue, clicks, searches, keywords, slugs
- **ΔCM Estimate**: Predicted contribution margin
- **Confidence**: 0-1 score indicating reliability
- **Lane Mix**: Recommended ASC/LAL/Interest percentages
- **Budget**: Recommended test budget
- **Top Keywords**: Best-performing keywords for hooks
- **Top Slugs**: Best-performing landing pages
- **Risk Flags**: Overlap risk, conflicts
- **Test Plan**: Freeze window, success/kill thresholds

## Guardrails

### Built-in Constraints

- **Min Confidence**: Only score opportunities with confidence ≥ 0.6
- **Max Budget**: Cap at $5,000 per opportunity (configurable)
- **Target CPA**: Default $25 (configurable)
- **Freeze Window**: 72 hours (configurable)

### Risk Detection

- **Overlap Risk**: Detects similar clusters/categories
- **Geo Conflicts**: Identifies geographic overlaps (TODO)
- **Audience Conflicts**: Flags competing audiences

## Configuration

Edit `getDefaultConfig()` in `score_opportunities.ts`:

```typescript
{
  baseline_ctr: { asc: 0.015, lal: 0.012, interest: 0.008 },
  baseline_cvr: { asc: 0.03, lal: 0.025, interest: 0.02 },
  baseline_cpc: { asc: 0.50, lal: 0.45, interest: 0.40 },
  avg_aov: 50.0,
  fixed_costs_per_launch: 100.0,
  target_cpa: 25.0,
  max_budget_per_opportunity: 5000.0,
  min_confidence_threshold: 0.6,
}
```

## Blueprint Structure

Each blueprint includes:

```json
{
  "opportunity_id": "cluster_name",
  "lanes": [
    { "type": "ASC", "budget": 200, "percentage": 40 },
    { "type": "LAL", "budget": 175, "percentage": 35 },
    { "type": "Interest", "budget": 125, "percentage": 25 }
  ],
  "hooks": ["keyword1", "keyword2", ...],
  "formats": [
    { "format": "9:16", "percentage": 40 },
    { "format": "4:5", "percentage": 30 },
    { "format": "1:1", "percentage": 30 }
  ],
  "landing_pages": [
    { "slug": "slug1", "priority": 1 }
  ],
  "target_cpa": 25.0,
  "freeze_window_hours": 72,
  "canary_lanes": ["ASC"],
  "promotion_ladder": [...]
}
```

## Next Steps

1. **Launch Orchestrator**: Implement preflight → launch → freeze workflow
2. **Monitoring System**: Track actuals vs predicted ΔCM
3. **Learning Loop**: Update priors based on performance
4. **Overlap Detection**: Enhanced geo/audience conflict detection
5. **API Integration**: Expose opportunities via API for agent consumption

## Example Agent Instruction

```
Objective: Increase ΔCM/day by +$12k in 21 days.

Constraints:
- Budget: $X/day
- Max launches: 10/day
- Freeze: 72h
- Target CPA: $25
- Creative capacity: 30/day

Process:
1. Run system1:score to get ranked opportunities
2. Select top-K by ΔCM/slot (if slot-limited) or ΔCM/$ (if budget-limited)
3. Generate blueprints for selected opportunities
4. Launch with freeze window
5. Monitor and promote/prune based on performance
6. Report daily ΔCM/day, win rate, breaches
```

## Success Metrics

- **ΔCM/day**: Total incremental contribution margin
- **ΔCM/slot**: Efficiency per launch slot
- **ΔCM/$**: ROI per dollar spent
- **Win Rate**: % of launches meeting success threshold
- **False Positive Rate**: % of launches that fail after freeze
- **Time-to-Positive-CM**: Days until positive contribution margin



