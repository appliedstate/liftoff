# Manual Batch Processing — Quick Guide

## Workflow for Manual Batch Processing

### Step 1: Queue Opportunities

**Option A: From System1 Scoring Script** (Recommended)

1. **Run opportunity scoring script**:
   ```bash
   npm run system1:score -- 2025-11-07
   ```

2. **Output files**:
   - `opportunities_ranked_by_slot.csv` - Ranked opportunities
   - `opportunities_detailed.json` - Full opportunity data

3. **Extract data from CSV/JSON**:
   - `total_revenue` → Use as `revenue_potential`
   - `predicted_delta_cm` → Predicted contribution margin
   - `confidence` → Confidence score
   - `recommended_budget` → Recommended budget
   - `recommended_lane_mix` → Lane mix percentages

**Option B: Add manually** (if not using scoring script):

```bash
POST /api/opportunities
{
  "source": "system1",
  "angle": "Insurance Quotes",
  "category": "Finance",
  "revenue_potential": 5000,  // From System1 CSV: total_revenue column
  "confidence_score": 0.85,   // From scoring script: confidence column
  "recommended_budget": 5000, // From scoring script: recommended_budget column
  "recommended_lane_mix": {
    "asc": 33,
    "lal": 17,
    "interest": 50
  },
  "status": "pending"
}
```

**Where `revenue_potential` comes from**:
- **System1 CSV**: `total_revenue` column (aggregated revenue from all keywords/slugs in cluster)
- **Scoring Script**: Calculated from cluster data (`cluster.total_revenue`)
- **Calculation**: Sum of revenue across all keywords/slugs in the cluster/category

**List pending opportunities**:

```bash
GET /api/opportunities/pending?limit=20
```

---

### Step 2: Preview Opportunity (See Everything Before Running)

**Get full preview** - Shows all required information and how campaigns will be set up:

```bash
GET /api/opportunities/:id/preview?brand=BrandX&adAccountId=act_123&organization=Interlincx&domain=brandx.com&destination=S1&strategisTemplateId=template-123&category=Healthcare&pixelId=123456789
```

**What You'll See**:
- ✅ Opportunity details (angle, category, revenue, confidence)
- ✅ Generated blueprint (lane mix, budgets, targeting)
- ✅ Campaign plan with all naming:
  - Campaign name: `BrandX | CONVERSIONS | hookset_insurance_quotes_2025_01_15 | US | FB | 2025-01-15`
  - Ad set names: `asc | advplus_all_auto | PURCHASE | CBO | v1`
  - Strategis campaign names: Combined names
- ✅ What will be created:
  - Facebook campaign details
  - Facebook ad set details
  - Strategis campaign details
  - Tracking URLs
- ✅ Required info checklist:
  - What's present ✅
  - What's missing ❌
  - Warnings ⚠️

---

### Step 3: Check Required Info

**Get checklist**:

```bash
GET /api/opportunities/:id/required-info
```

**Shows**:
- What opportunity data is present
- What config is required
- What's optional

---

### Step 4: Execute (After Review)

**Once preview looks good**:

```bash
POST /api/workflow/process-opportunity/:id
{
  "brand": "BrandX",
  "adAccountId": "act_123",
  "organization": "Interlincx",
  "domain": "brandx.com",
  "destination": "S1",
  "strategisTemplateId": "template-123",
  "category": "Healthcare",
  "pixelId": "123456789"
}
```

---

## Example: Complete Workflow

```bash
# 1. List pending opportunities
curl http://localhost:3001/api/opportunities/pending?limit=10

# 2. Preview first opportunity
curl "http://localhost:3001/api/opportunities/abc-123/preview?brand=BrandX&adAccountId=act_123456789&organization=Interlincx&domain=brandx.com&destination=S1&strategisTemplateId=template-123&category=Healthcare&pixelId=123456789012345"

# 3. Review the preview response:
# - Check campaign names
# - Check ad set names  
# - Check tracking URLs
# - Check required info checklist

# 4. If everything looks good, execute
curl -X POST http://localhost:3001/api/workflow/process-opportunity/abc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "BrandX",
    "adAccountId": "act_123456789",
    "organization": "Interlincx",
    "domain": "brandx.com",
    "destination": "S1",
    "strategisTemplateId": "template-123",
    "category": "Healthcare",
    "pixelId": "123456789012345"
  }'

# 5. Repeat for next opportunity
```

---

## Preview Response Example

```json
{
  "opportunity": {
    "id": "abc-123",
    "angle": "Insurance Quotes",
    "category": "Finance",
    "revenue_potential": 5000,
    "confidence_score": 0.85,
    "recommended_budget": 5000
  },
  "campaignPlan": {
    "campaignName": "BrandX | CONVERSIONS | hookset_insurance_quotes_2025_01_15 | US | FB | 2025-01-15",
    "adSetNames": [
      "asc | advplus_all_auto | PURCHASE | CBO | v1",
      "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"
    ],
    "strategisCampaignNames": [
      "BrandX | CONVERSIONS | hookset_insurance_quotes | US | FB | 2025-01-15 - asc | advplus_all_auto | PURCHASE | CBO | v1"
    ]
  },
  "willCreate": {
    "facebookCampaign": {
      "name": "BrandX | CONVERSIONS | hookset_insurance_quotes_2025_01_15 | US | FB | 2025-01-15",
      "objective": "CONVERSIONS",
      "status": "PAUSED"
    },
    "strategisCampaigns": [
      {
        "name": "BrandX | CONVERSIONS | hookset_insurance_quotes | US | FB | 2025-01-15 - asc | advplus_all_auto | PURCHASE | CBO | v1",
        "trackingUrl": "https://r.strateg.is/route?campaignId=<strategis-id>&fbclid={{fbclid}}"
      }
    ]
  },
  "requiredInfo": {
    "hasAllRequired": true,
    "missing": [],
    "present": [
      "opportunity.angle",
      "config.brand",
      "config.adAccountId",
      "config.strategisTemplateId",
      "pixelId"
    ]
  }
}
```

---

## Key Features

✅ **Preview Before Execute**: See everything that will be created  
✅ **Required Info Checklist**: Know what's missing before running  
✅ **Campaign Names**: See all generated names  
✅ **Tracking URLs**: See Strategis tracking URLs  
✅ **Batch Processing**: Queue multiple, preview each, execute when ready

---

## API Endpoints Summary

| Endpoint | Purpose |
|----------|---------|
| `GET /api/opportunities/pending` | List queued opportunities |
| `GET /api/opportunities/:id/preview` | **Preview opportunity (shows everything)** |
| `GET /api/opportunities/:id/required-info` | **Get required info checklist** |
| `POST /api/workflow/process-opportunity/:id` | Execute opportunity (after preview) |

