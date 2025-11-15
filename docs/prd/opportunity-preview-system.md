# Opportunity Preview System — User Guide

## Purpose

Preview system for manual batch processing. Allows you to:
1. Queue up opportunities
2. See all required information for an opportunity
3. Preview how campaigns will be set up BEFORE running them
4. Review campaign names, ad sets, tracking URLs, etc.

---

## How to Use

### Step 1: Queue Opportunities

**Add opportunities to queue** (from CSV or manually):

```bash
POST /api/opportunities
{
  "source": "system1",
  "angle": "Insurance Quotes",
  "category": "Finance",
  "revenue_potential": 5000,
  "confidence_score": 0.85,
  "recommended_budget": 5000,
  "recommended_lane_mix": {
    "asc": 33,
    "lal": 17,
    "interest": 50
  },
  "status": "pending"
}
```

**Or list pending opportunities**:

```bash
GET /api/opportunities/pending?limit=20
```

---

### Step 2: Preview Opportunity

**Get full preview** (shows everything that will be created):

```bash
GET /api/opportunities/:id/preview?brand=BrandX&adAccountId=act_123&organization=Interlincx&domain=brandx.com&destination=S1&strategisTemplateId=template-123&category=Healthcare&pixelId=123456789
```

**Response includes**:
- ✅ Opportunity details
- ✅ Generated blueprint
- ✅ Campaign plan with all naming
- ✅ What will be created (Facebook campaigns, ad sets, Strategis campaigns)
- ✅ Required information checklist
- ✅ Missing information warnings

---

### Step 3: Review Preview

**Check the preview response**:

```json
{
  "opportunity": { ... },
  "blueprint": { ... },
  "campaignPlan": {
    "campaignName": "BrandX | CONVERSIONS | hookset_insurance_quotes_2025_01_15 | US | FB | 2025-01-15",
    "adSetNames": [
      "asc | advplus_all_auto | PURCHASE | CBO | v1",
      "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"
    ],
    "strategisCampaignNames": [
      "BrandX | CONVERSIONS | hookset_insurance_quotes | US | FB | 2025-01-15 - asc | advplus_all_auto | PURCHASE | CBO | v1",
      "BrandX | CONVERSIONS | hookset_insurance_quotes | US | FB | 2025-01-15 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"
    ],
    "adSets": [ ... ]
  },
  "willCreate": {
    "facebookCampaign": {
      "name": "BrandX | CONVERSIONS | hookset_insurance_quotes_2025_01_15 | US | FB | 2025-01-15",
      "objective": "CONVERSIONS",
      "status": "PAUSED",
      "isCBO": true
    },
    "facebookAdSets": [ ... ],
    "strategisCampaigns": [ ... ]
  },
  "requiredInfo": {
    "hasAllRequired": true,
    "missing": [],
    "present": [ ... ]
  }
}
```

---

### Step 4: Check Required Info

**Get checklist of required information**:

```bash
GET /api/opportunities/:id/required-info
```

**Response**:
```json
{
  "opportunity": {
    "hasAngle": true,
    "hasCategory": true,
    "hasRevenuePotential": true,
    "hasConfidenceScore": true,
    "hasRecommendedBudget": true
  },
  "config": {
    "required": [
      "brand",
      "adAccountId",
      "organization",
      "domain",
      "destination",
      "strategisTemplateId",
      "category"
    ],
    "optional": [
      "article",
      "fbPage",
      "pixelId"
    ]
  }
}
```

---

### Step 5: Execute (After Review)

**Once you've reviewed the preview and confirmed everything looks good**:

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

## Example Workflow

### Manual Batch Processing

```bash
# 1. List pending opportunities
GET /api/opportunities/pending?limit=10

# 2. Preview each opportunity
GET /api/opportunities/abc-123/preview?brand=BrandX&adAccountId=act_123&organization=Interlincx&domain=brandx.com&destination=S1&strategisTemplateId=template-123&category=Healthcare&pixelId=123456789

# 3. Review preview response
# - Check campaign names
# - Check ad set names
# - Check tracking URLs
# - Check required info checklist

# 4. If preview looks good, execute
POST /api/workflow/process-opportunity/abc-123
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

# 5. Repeat for next opportunity
```

---

## Preview Response Structure

### What You'll See

1. **Opportunity Details**:
   - Angle, category, revenue potential
   - Confidence score, recommended budget
   - Top keywords, top slugs

2. **Generated Blueprint**:
   - Lane mix (ASC %, LAL %, Interest %)
   - Budget plan
   - Targeting configuration
   - Creative requirements
   - KPI targets

3. **Campaign Plan**:
   - Generated campaign name
   - Generated ad set names
   - Generated Strategis campaign names
   - Ad set configurations

4. **What Will Be Created**:
   - Facebook campaign details
   - Facebook ad set details
   - Strategis campaign details
   - Tracking URLs

5. **Required Info Checklist**:
   - ✅ What's present
   - ❌ What's missing
   - ⚠️ Warnings

---

## Benefits

✅ **See Before You Create**: Preview everything before executing  
✅ **Catch Errors Early**: Required info checklist shows what's missing  
✅ **Review Naming**: See all generated names before launch  
✅ **Batch Processing**: Queue multiple opportunities, preview each, execute when ready  
✅ **No Surprises**: Know exactly what will be created

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/opportunities` | POST | Add opportunity to queue |
| `/api/opportunities/pending` | GET | List pending opportunities |
| `/api/opportunities/:id` | GET | Get opportunity details |
| `/api/opportunities/:id/preview` | GET | **Preview opportunity (shows everything)** |
| `/api/opportunities/:id/required-info` | GET | **Get required info checklist** |
| `/api/workflow/process-opportunity/:id` | POST | Execute opportunity (after preview) |

---

## Example: Full Preview Request

```bash
curl "http://localhost:3001/api/opportunities/abc-123/preview?brand=BrandX&adAccountId=act_123456789&organization=Interlincx&domain=brandx.com&destination=S1&strategisTemplateId=template-123&category=Healthcare&pixelId=123456789012345"
```

**Response Preview**:
- Shows all campaign names
- Shows all ad set names
- Shows all Strategis campaign names
- Shows tracking URLs
- Shows required info checklist
- Shows what will be created

---

## Next Steps

1. **Queue Opportunities**: Add opportunities to queue
2. **Preview Each**: Use preview endpoint to see setup
3. **Review**: Check names, configs, required info
4. **Execute**: Process when ready

