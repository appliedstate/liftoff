# Revenue Potential — Where It Comes From

## Quick Answer

**`revenue_potential` = `total_revenue` from System1 CSV/cluster data**

---

## Detailed Explanation

### Source: System1 Opportunity Scoring Script

**Step 1: Run Scoring Script**
```bash
npm run system1:score -- 2025-11-07
```

**Step 2: Check Output Files**

The script outputs:
- `opportunities_ranked_by_slot.csv` — Contains `total_revenue` column
- `opportunities_detailed.json` — Contains `total_revenue` field

**Step 3: Use `total_revenue` as `revenue_potential`**

When adding opportunities to queue, use:
```json
{
  "revenue_potential": <value from total_revenue column>
}
```

---

## How `total_revenue` is Calculated

### In `score_opportunities.ts`

1. **Reads System1 CSV data**:
   - Clusters keywords/slugs by category/angle
   - Aggregates revenue per cluster

2. **Calculates `total_revenue`**:
   ```typescript
   cluster.total_revenue = sum of all revenue from keywords/slugs in cluster
   ```

3. **Stored in opportunity**:
   ```typescript
   opportunity.total_revenue = cluster.total_revenue
   ```

4. **Output to CSV**:
   - Column name: `total_revenue`
   - This is what you use as `revenue_potential`

---

## CSV Column Mapping

When importing from `opportunities_ranked_by_slot.csv`:

| CSV Column | API Field | Description |
|------------|-----------|-------------|
| `total_revenue` | `revenue_potential` | Aggregated revenue from System1 |
| `predicted_delta_cm` | (not stored) | Predicted contribution margin |
| `confidence` | `confidence_score` | Confidence score (0-1) |
| `recommended_budget` | `recommended_budget` | Recommended test budget |
| `lane_mix_asc` | `recommended_lane_mix.asc` | ASC percentage |
| `lane_mix_lal` | `recommended_lane_mix.lal` | LAL percentage |
| `cluster_name` | `angle` | Opportunity angle/cluster name |
| `category` | `category` | Category |

---

## Example: From CSV to API

**CSV Row**:
```csv
rank,cluster_name,category,total_revenue,predicted_delta_cm,confidence,recommended_budget,lane_mix_asc,lane_mix_lal
1,Insurance Quotes,Finance,5000.00,250.50,0.85,5000.00,33,17
```

**API Request**:
```json
POST /api/opportunities
{
  "source": "system1",
  "angle": "Insurance Quotes",           // from cluster_name
  "category": "Finance",                  // from category
  "revenue_potential": 5000.00,          // from total_revenue
  "confidence_score": 0.85,              // from confidence
  "recommended_budget": 5000.00,         // from recommended_budget
  "recommended_lane_mix": {
    "asc": 0.33,                          // from lane_mix_asc / 100
    "lal": 0.17,                          // from lane_mix_lal / 100
    "interest": 0.50                      // calculated: 1 - asc - lal
  },
  "status": "pending"
}
```

---

## Summary

**To get `revenue_potential`**:

1. ✅ Run `npm run system1:score -- YYYY-MM-DD`
2. ✅ Open `opportunities_ranked_by_slot.csv`
3. ✅ Use `total_revenue` column value as `revenue_potential`
4. ✅ Or use `opportunities_detailed.json` and use `total_revenue` field

**It's the aggregated revenue from all keywords/slugs in that cluster/category from System1 data.**

