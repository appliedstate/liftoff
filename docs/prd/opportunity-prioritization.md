# Opportunity Queue Prioritization

## How Opportunities Are Prioritized

Opportunities in the queue are prioritized using a **two-tier ranking system**:

1. **Primary**: `predicted_delta_cm` (Predicted Contribution Margin) — **DESC**
2. **Secondary**: `confidence_score` (Confidence in Estimate) — **DESC**

---

## Current Implementation

### Database Query (from `opportunityQueue.ts`)

```typescript
// Get pending opportunities
async getPending(limit: number = 20): Promise<Opportunity[]> {
  const result = await pool.query(
    `SELECT * FROM opportunities 
     WHERE status = 'pending' 
     ORDER BY predicted_delta_cm DESC NULLS LAST, confidence_score DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(row => this.mapRowToOpportunity(row));
}

// List opportunities (with filters)
async list(filters: {...}): Promise<Opportunity[]> {
  // ... filters ...
  query += ' ORDER BY predicted_delta_cm DESC NULLS LAST, confidence_score DESC NULLS LAST';
  // ...
}
```

**Key Points**:
- `predicted_delta_cm DESC` — Highest contribution margin first
- `confidence_score DESC` — Highest confidence first (tiebreaker)
- `NULLS LAST` — Opportunities without scores go to the end

---

## What is `predicted_delta_cm`?

**Predicted Contribution Margin** = Estimated incremental profit from launching this opportunity

### Calculation (from `score_opportunities.ts`)

```typescript
ΔCM = EstimatedRevenue - Cost - FixedCosts

Where:
- EstimatedRevenue = Budget × RevenuePerDollar × ConversionMultiplier
- RevenuePerDollar = System1 RPS / WeightedCPC
- ConversionMultiplier = 0.4 (40% of System1 performance in paid)
- Cost = RecommendedBudget
- FixedCosts = $100 per launch
```

**Example**:
- Budget: $1,000
- Revenue per dollar: $2.50
- Conversion multiplier: 0.4
- Estimated revenue: $1,000 × $2.50 × 0.4 = $1,000
- Cost: $1,000
- Fixed costs: $100
- **ΔCM = $1,000 - $1,000 - $100 = -$100** (negative = not profitable)

---

## What is `confidence_score`?

**Confidence Score** (0-1) = How reliable the ΔCM estimate is

### Calculation (from `score_opportunities.ts`)

```typescript
confidence = min(
  dataVolumeScore * consistencyScore,
  0.95
)

Where:
dataVolumeScore = 
  (keywords / 100) * 0.3 +      // Up to 30% from keyword count
  (revenue / 10000) * 0.3 +     // Up to 30% from revenue
  (clicks / 1000) * 0.2 +       // Up to 20% from clicks
  (searches / 5000) * 0.2,      // Up to 20% from searches
  capped at 1.0

consistencyScore = 
  0.8 if avgRPC > 0 && avgRPS > 0 (has consistent data)
  0.5 otherwise (inconsistent data)
```

**Example**:
- 200 keywords → 0.6 (60% of max)
- $15,000 revenue → 0.45 (45% of max)
- 1,500 clicks → 0.3 (30% of max)
- 8,000 searches → 0.32 (32% of max)
- **dataVolumeScore = 0.6 + 0.45 + 0.3 + 0.32 = 1.67 → capped at 1.0**
- **consistencyScore = 0.8** (has RPC/RPS data)
- **confidence = min(1.0 × 0.8, 0.95) = 0.8** (80% confidence)

---

## Prioritization Examples

### Example 1: High ΔCM, High Confidence

| Opportunity | predicted_delta_cm | confidence_score | Rank |
|-------------|-------------------|------------------|------|
| A | $500 | 0.9 | **1st** |
| B | $300 | 0.8 | 2nd |
| C | $200 | 0.7 | 3rd |

**Result**: A wins (highest ΔCM)

---

### Example 2: Tie on ΔCM, Different Confidence

| Opportunity | predicted_delta_cm | confidence_score | Rank |
|-------------|-------------------|------------------|------|
| A | $500 | 0.9 | **1st** |
| B | $500 | 0.7 | 2nd |
| C | $300 | 0.8 | 3rd |

**Result**: A wins (same ΔCM, higher confidence)

---

### Example 3: Missing Data

| Opportunity | predicted_delta_cm | confidence_score | Rank |
|-------------|-------------------|------------------|------|
| A | $500 | 0.9 | **1st** |
| B | NULL | 0.8 | **Last** |
| C | $300 | NULL | 2nd |

**Result**: A wins, B goes to end (NULLS LAST)

---

## Database Indexes

The database has an index optimized for this query:

```sql
CREATE INDEX IF NOT EXISTS idx_opportunities_predicted_delta_cm 
ON opportunities(predicted_delta_cm DESC);
```

**Why**: Speeds up `ORDER BY predicted_delta_cm DESC` queries

---

## API Endpoints

### Get Pending Opportunities (Ranked)

```bash
GET /api/opportunities/pending?limit=20
```

**Returns**: Top 20 pending opportunities, ranked by ΔCM → confidence

**Response**:
```json
[
  {
    "id": "uuid-1",
    "angle": "juvederm_botox",
    "predicted_delta_cm": 500,
    "confidence_score": 0.9,
    "revenue_potential": 10000,
    "status": "pending"
  },
  {
    "id": "uuid-2",
    "angle": "weight_loss",
    "predicted_delta_cm": 300,
    "confidence_score": 0.8,
    "revenue_potential": 8000,
    "status": "pending"
  }
]
```

### List Opportunities (With Filters)

```bash
GET /api/opportunities?status=pending&minConfidence=0.7&limit=50
```

**Returns**: Filtered opportunities, still ranked by ΔCM → confidence

---

## Alternative Ranking Strategies

The scoring script (`score_opportunities.ts`) also generates two alternative rankings:

### 1. Ranked by ΔCM/Slot (Slot-Limited)

```typescript
// For scenarios where you can only launch N campaigns per day
const rankedBySlot = opportunities
  .filter(op => op.confidence >= min_confidence_threshold)
  .sort((a, b) => b.predicted_delta_cm - a.predicted_delta_cm);
```

**Use Case**: Maximize profit when limited by launch capacity

---

### 2. Ranked by ΔCM/$ (Budget-Limited)

```typescript
// For scenarios where you have a fixed budget
const rankedByBudget = opportunities
  .filter(op => op.confidence >= min_confidence_threshold && op.recommended_budget > 0)
  .sort((a, b) => {
    const roiA = a.predicted_delta_cm / a.recommended_budget;
    const roiB = b.predicted_delta_cm / b.recommended_budget;
    return roiB - roiA;
  });
```

**Use Case**: Maximize ROI when limited by budget

**Example**:
- Opportunity A: ΔCM = $500, Budget = $1,000 → ROI = 0.5
- Opportunity B: ΔCM = $300, Budget = $500 → ROI = 0.6
- **B wins** (higher ROI per dollar)

---

## Current Prioritization Logic

**Default**: ΔCM/Slot ranking (maximize absolute profit)

**Why**: 
- Assumes launch capacity is the constraint
- Prioritizes highest-value opportunities first
- Confidence score breaks ties

**When to Use Alternatives**:
- **Budget-Limited**: Use ΔCM/$ ranking (maximize ROI)
- **Risk-Averse**: Filter by `minConfidence` (e.g., `minConfidence=0.8`)
- **Category-Focused**: Filter by `category` (e.g., `category=Healthcare`)

---

## Summary

**Prioritization Formula**:
```
Priority = predicted_delta_cm DESC, confidence_score DESC
```

**What This Means**:
1. **Highest profit potential first** (`predicted_delta_cm`)
2. **Most reliable estimates first** (`confidence_score` as tiebreaker)
3. **Missing data goes to end** (`NULLS LAST`)

**Key Fields**:
- `predicted_delta_cm`: Estimated incremental profit
- `confidence_score`: Reliability of estimate (0-1)
- `revenue_potential`: Total revenue opportunity
- `recommended_budget`: Suggested test budget

**Current Behavior**: Opportunities are automatically ranked when queried, ensuring the highest-value, most-reliable opportunities are processed first.



