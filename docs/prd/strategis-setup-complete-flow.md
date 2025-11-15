# Strategis Setup — Complete Flow & Field Reference

## Document Purpose
Complete reference for Strategis campaign tracking setup, including all required fields, examples, and the full integration flow.

**Status**: ✅ COMPLETE — Ready for Implementation  
**Version**: 1.0 (2025-01-XX)

---

## Complete Setup Flow

### Overview

Strategis tracking setup requires **2 API calls**:
1. ✅ Create template (one-time per URL pattern)
2. ✅ Create campaign (per Facebook ad set)

Facebook campaign creation is separate and handled via Strategis relay endpoints.

---

## Step 1: Create Template (One-Time)

### Endpoint
`POST /api/templates` ✅ (exists)

### Purpose
Define tracking URL template with Mustache variables. This is created once per URL pattern and reused across campaigns.

### Request

**✅ CORRECTED Template** (based on actual Strategis routing code):

```json
{
  "key": "facebook-tracking-template",
  "value": "http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&subid2={{source}}_{{kwSetId}}_{{familyId}}&fbclid={{fbclid}}&utm_source=facebook&utm_medium=cpc&utm_campaign={{campaignId}}&utm_term={{ag}}",
  "organization": "Interlincx",
  "notes": "Template for Facebook campaign tracking"
}
```

**Key Changes**:
- ✅ Use `{{fbclid}}` **NOT** `{{networkClickId}}` (Facebook-specific)
- ✅ Use Mustache section `{{#article}}/{{article}}{{/article}}` to handle missing article gracefully
- ✅ `{{ag}}` is auto-populated from `utm_term` (ad set ID) for Facebook

### Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | ✅ Yes | Template identifier (unique per organization) |
| `value` | string | ✅ Yes | Mustache template string with variables |
| `organization` | string | ✅ Yes | Organization name |
| `notes` | string | ❌ No | Optional description |

### Template Variables

Available variables in Mustache template:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{domain}}` | Advertiser domain | `brandx.com` |
| `{{article}}` | Landing page path | `landing-page` |
| `{{campaignId}}` | Strategis campaign ID | `strategis-campaign-123` |
| `{{source}}` | Source identifier | `fb` |
| `{{kwSetId}}` | Keyword set ID | `kw-123` |
| `{{familyId}}` | Family ID | `family-456` |
| `{{fbclid}}` | Facebook click ID (use directly, NOT networkClickId) | `abc123xyz` |
| `{{ag}}` | Additional parameter | `ag-value` |

### Response

```json
{
  "id": "template-id-123",
  "key": "facebook-tracking-template",
  "value": "http://{{domain}}/{{article}}?subid={{campaignId}}&...",
  "organization": "Interlincx"
}
```

---

## Step 2: Create Strategis Campaign (Per Facebook Ad Set)

### Endpoint
`POST /api/campaigns` ✅ (exists)

### Purpose
Create tracking campaign for each Facebook ad set. One Strategis campaign = one Facebook ad set.

### Request

```json
{
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "category": "Healthcare",
  "template": {
    "id": "template-id-123"
  },
  "properties": {
    "buyer": "BrandX",
    "networkName": "facebook",
    "destination": "S1",
    "domain": "brandx.com",
    "networkAccountId": "act_123456789",
    "article": "landing-page",
    "fbPage": "BrandX Official",
    "fbAdAccount": "123456789",
    "fbCampaignId": "120212345678901234",
    "fbAdSetId": "120212345678901235"
  },
  "organizations": ["Interlincx"]
}
```

### Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ Yes | Campaign name (campaign + ad set combined) |
| `category` | string | ✅ Yes | Business category (e.g., "Healthcare", "Finance") |
| `template.id` | string | ✅ Yes | Template ID from Step 1 |
| `properties.buyer` | string | ✅ Yes | Campaign owner/brand name |
| `properties.networkName` | string | ✅ Yes | Always "facebook" for FB campaigns |
| `properties.destination` | string | ✅ Yes | "S1" or "Lincx" |
| `properties.domain` | string | ✅ Yes | Advertiser domain |
| `organizations` | string[] | ✅ Yes | Array with organization name |

### Optional but Recommended Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `properties.networkAccountId` | string | ❌ No | Facebook ad account (act_*) |
| `properties.article` | string | ❌ No | Landing page path |
| `properties.fbPage` | string | ❌ No | Facebook page name/ID |
| `properties.fbAdAccount` | string | ❌ No | Facebook ad account (numeric, no "act_") |
| `properties.fbCampaignId` | string | ❌ No | Facebook campaign ID (set after FB creation) |
| `properties.fbAdSetId` | string | ❌ No | Facebook ad set ID (set after FB creation) |

### Response

```json
{
  "id": "strategis-campaign-456",
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "category": "Healthcare",
  "template": {
    "id": "template-id-123"
  },
  "properties": {
    "buyer": "BrandX",
    "networkName": "facebook",
    "destination": "S1",
    "domain": "brandx.com"
  },
  "organizations": ["Interlincx"]
}
```

### Tracking URL

**Automatically Generated**: `https://r.strateg.is/route?campaignId=<strategis-campaign-id>`

**Usage**: Use this URL in Facebook ad creatives as the destination URL.

**With Facebook Click ID**: `https://r.strateg.is/route?campaignId=<strategis-campaign-id>&fbclid={{fbclid}}`

---

## What Happens Automatically

Once you create the Strategis campaign, Strategis automatically:

1. ✅ **Generates tracking URL**: `https://r.strateg.is/route?campaignId=<id>`
2. ✅ **Records clicks** when users visit the tracking URL
3. ✅ **Renders template** with campaign properties + query params
4. ✅ **Redirects to advertiser** with full tracking parameters
5. ✅ **Stores events** in Redis → LevelDB → ClickHouse

**✅ ANSWERS CONFIRMED**: See `strategis-routing-answers-summary.md` for complete answers:
- ✅ How Strategis determines final destination URL (Mustache template rendering with merged query)
- ✅ How `properties.article` is used (optional, can be overridden by kwSet or query params)
- ✅ Template variable resolution (kwSet > Query Params > Properties > Defaults)
- ✅ Complete routing flow (non-blocking event recording, ~50-100ms redirect)

---

## Complete Integration Flow

### One-Time Setup

```typescript
// 1. Create template (once per URL pattern)
const template = await strategisAPI.post('/api/templates', {
  key: 'facebook-tracking-template',
  // ✅ CORRECTED: Use {{fbclid}} NOT {{networkClickId}}, use Mustache section for optional article
  value: 'http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&subid2={{source}}_{{kwSetId}}_{{familyId}}&fbclid={{fbclid}}&utm_source=facebook&utm_medium=cpc&utm_campaign={{campaignId}}&utm_term={{ag}}',
  organization: 'Interlincx',
  notes: 'Template for Facebook campaign tracking'
});
```

### Per Campaign Setup

```typescript
// 2. Create Facebook campaign (via Strategis relay)
const fbCampaign = await strategisFacebookAPI.post('/api/facebook/campaigns/create', {
  organization: 'Interlincx',
  adAccountId: '123456789',
  name: campaignName,
  objective: 'CONVERSIONS',
  // ... other fields
});

// 3. Create Facebook ad sets (via Strategis relay)
const fbAdSets = [];
for (const adSetPlan of plan.adSets) {
  const fbAdSet = await strategisFacebookAPI.post('/api/facebook/adsets/create', {
    organization: 'Interlincx',
    campaign_id: fbCampaign.id,
    name: adSetName,
    // ... other fields
  });
  fbAdSets.push(fbAdSet);
}

// 4. Create Strategis tracking campaign (one per Facebook ad set)
const strategisCampaigns = [];
for (const [index, fbAdSet] of fbAdSets.entries()) {
  const strategisCampaign = await strategisAPI.post('/api/campaigns', {
    name: `${campaignName} - ${adSetNames[index]}`,
    category: 'Healthcare',
    template: { id: template.id },
    properties: {
      buyer: 'BrandX',
      networkName: 'facebook',
      destination: 'S1',
      domain: 'brandx.com',
      fbCampaignId: fbCampaign.id,
      fbAdSetId: fbAdSet.id
    },
    organizations: ['Interlincx']
  });
  
  // 5. Get tracking URL
  const trackingUrl = `https://r.strateg.is/route?campaignId=${strategisCampaign.id}&fbclid={{fbclid}}`;
  
  // 6. Create Facebook ads (via Strategis relay) using trackingUrl
  for (const adPlan of plan.adSets[index].ads) {
    await strategisFacebookAPI.post('/api/facebook/ads/create', {
      organization: 'Interlincx',
      adset_id: fbAdSet.id,
      name: adName,
      creative: {
        // Use trackingUrl in creative destination URL
      }
    });
  }
  
  strategisCampaigns.push(strategisCampaign);
}
```

---

## What Strategis Does NOT Handle

### Facebook-Side Setup (Separate)
- ❌ Creating Facebook campaigns/adsets/ads (handled via relay endpoints)
- ❌ Uploading creatives/images/videos
- ❌ Configuring Facebook Pixel on advertiser site
- ❌ Setting up Facebook Conversions API
- ❌ Configuring Facebook ad targeting
- ❌ Setting Facebook budgets/bids

### Advertiser-Side Setup (Separate)
- ❌ Installing Facebook Pixel on landing page
- ❌ Configuring conversion events
- ❌ Setting up server-side conversion tracking

---

## Minimal Example

```typescript
// 1. Create template (once)
const template = await strategisAPI.post('/api/templates', {
  key: 'fb-template',
  // ✅ CORRECTED: Use {{fbclid}} NOT {{networkClickId}}
  value: 'http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&fbclid={{fbclid}}',
  organization: 'Interlincx'
});

// 2. Create campaign (per ad set)
const campaign = await strategisAPI.post('/api/campaigns', {
  name: 'Campaign Name',
  category: 'Healthcare',
  template: { id: template.id },
  properties: {
    buyer: 'BrandX',
    networkName: 'facebook',
    destination: 'S1',
    domain: 'advertiser.com'
  },
  organizations: ['Interlincx']
});

// 3. Use tracking URL in Facebook
const trackingUrl = `https://r.strateg.is/route?campaignId=${campaign.id}&fbclid={{fbclid}}`;

// 4. Create Facebook ad set with trackingUrl as destination
// (This is Facebook-side, not Strategis)
```

---

## Field Summary

### Template Creation

**Required**:
- ✅ `key` (string)
- ✅ `value` (Mustache template string)
- ✅ `organization` (string)

**Optional**:
- `notes` (string)

### Campaign Creation

**Required**:
- ✅ `name` (string)
- ✅ `category` (string)
- ✅ `template.id` (string)
- ✅ `properties.buyer` (string)
- ✅ `properties.networkName` (string) — Always "facebook"
- ✅ `properties.destination` (string) — "S1" or "Lincx"
- ✅ `properties.domain` (string)
- ✅ `organizations` (array of strings)

**Optional but Recommended**:
- `properties.fbCampaignId` (store Facebook campaign ID)
- `properties.fbAdSetId` (store Facebook ad set ID)
- `properties.networkAccountId` (Facebook ad account)
- `properties.article` (landing page path)
- `properties.fbPage` (Facebook page)
- `properties.fbAdAccount` (Facebook ad account numeric)

---

## References

- **Complete Requirements**: `strategis-campaign-setup-requirements.md`
- **Relay Endpoints Spec**: `strategis-relay-endpoints-spec.md`
- **Engineering Checklist**: `strategis-engineering-checklist.md`
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`

