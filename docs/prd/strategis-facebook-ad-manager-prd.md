## Strategis Facebook Ad Manager – PRD

### Document Info
- Owner: Engineering (Platform) · Collaborators: Growth, Attention Factory
- Version: 0.1 (2025-10-22)
- Status: Draft
- References: [Campaign reference (v24.0)](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/)

### 1) Overview
Build a Strategis “Ad Manager” service to create and manage Facebook campaign structures for the Attention Engine. The service exposes Strategis APIs that orchestrate the Meta Marketing API to create Campaigns, Ad Sets, Creatives, and Ads using our naming conventions and validation rules.

### 2) Goals & Non-Goals
- Goals
  - Programmatically create end-to-end campaign hierarchies (campaign → ad sets → creatives → ads).
  - Enforce Attention Engine naming conventions and objective validation.
  - Provide idempotent, observable, and secure APIs for internal clients (Attention Factory).
- Non-Goals
  - Building a UI for manual ad creation (out of scope).
  - Cross-channel (Google/TikTok) orchestration (future work).

### 3) Success Metrics
- Time-to-launch: < 5 minutes from request to all objects created (P50) with Meta API availability.
- Reliability: > 99% success on first attempt; automatic retry handles transient 429/5xx.
 - Consistency: 100% adherence to naming convention and objective validation.
- Observability: 100% of operations traced with object IDs and request/response payloads.

### 4) Glossary
- Attention Engine: Internal system generating hooks/creatives and media plans.
- Strategis: Internal platform exposing APIs to orchestrate ad platforms.
- Meta/FB Marketing API: External API for ads objects (campaigns, ad sets, creatives, ads).

### 5) Scope
- In Scope
  - Campaign creation with Special Ad Categories, objective, and optional CBO.
  - Ad Set creation with targeting, optimization goal, schedules, and bid/budget.
  - Creative creation (link/video) via `object_story_spec`.
  - Ad creation linking ad sets and creatives.
  - CRUD-lite (rename, status, budgets) for core objects.
  - Sync endpoints to fetch current state (IDs, names, statuses).
- Out of Scope
  - Audience building/LLA seeding (assume audiences exist and are referenced).
  - Asset upload (assume asset IDs provided or handled by a separate asset service).

### 6) Constraints & Compliance
- Meta API Requirements
  - Special Ad Categories are required for new/edited campaigns: `special_ad_categories` must be provided (e.g., `["NONE"]` or categories like `HOUSING`, `EMPLOYMENT`, `CREDIT`).
  - Objective dictates downstream validation (e.g., conversions require `pixel_id` and `custom_event_type`).
  - Limit: ≤ 200 ad sets per campaign.
  - Reference: [Campaign reference (v24.0)](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/).

### 7) System Overview
- Data flow
  1. Attention Factory calls Strategis endpoint with plan + naming + objects to create.
  2. Strategis validates input, constructs Meta API payloads, and calls Meta APIs.
  3. Strategis persists mappings (client keys ↔ Meta IDs) and returns created IDs.
- Components
  - Strategis Ad Manager Service (new): REST APIs, validation, Meta API client, storage.
  - Attention Factory (existing): caller providing hook sets, creatives, audiences.
  - Meta Marketing API (external): destination for object creation.

### 8) Naming Conventions
- Campaign `name`: `{Brand} | {Objective} | {HookSet} | {Market} | FB | {YYYY-MM-DD}`
- Ad Set `name`: `{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType=CBO|ABO} | v{N}`
- Ad `name`: `{CreativeType=IMG|VID} | {HookId} | {Variant} | {Format=1x1|4x5|9x16} | {Lang}`

### 9) Object Model & IDs
- Campaign → Ad Set(s) → Ad(s)
- Creative(s) are created separately and linked by `creative_id` when creating Ads.
- Persist in Strategis: `clientRequestKey`, `hookSetId`, generated names, and Meta IDs.

### 10) Strategis API Surface (proposed)

#### 10.1 Create full structure
- POST `/api/ads/facebook/structures/create`
  - Purpose: create campaign + ad sets + creatives + ads in one request.
  - Request (example)
```json
{
  "adAccountId": "act_1234567890",
  "brand": "BrandX",
  "market": "US",
  "objective": "CONVERSIONS",
  "specialAdCategories": ["NONE"],
  "useCbo": true,
  "campaignBudget": { "type": "DAILY", "amountMicros": 50000000 },
  "hookSetId": "hookset_juvederm_2025_10_21",
  "naming": {
    "campaign": "{Brand} | {Objective} | {HookSet} | {Market} | FB | {Date}",
    "adset": "{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{N}",
    "ad": "{CreativeType} | {HookId} | {Variant} | {Format} | {Lang}"
  },
  "adSets": [
    {
      "audienceKey": "ll_2p_purchasers_180",
      "placementKey": "advplus_all_auto",
      "optimizationEvent": "PURCHASE",
      "billingEvent": "IMPRESSIONS",
      "schedule": { "startTime": "2025-10-22T15:00:00Z" },
      "budget": null,
      "bid": { "strategy": "LOWEST_COST_WITHOUT_CAP" },
      "targeting": {
        "geoLocations": { "countries": ["US"] },
        "ageMin": 21,
        "ageMax": 65,
        "publisherPlatforms": ["facebook","instagram"],
        "instagramPositions": ["feed","story","reels"],
        "facebookPositions": ["feed","story","instream_video","reels"]
      },
      "promotedObject": { "pixelId": "123456789012345", "customEventType": "PURCHASE" }
    }
  ],
  "creatives": [
    {
      "type": "VIDEO",
      "pageId": "112233445566",
      "asset": { "videoId": "987654321000" },
      "primaryText": "Hook: stop scrolling. See if you're eligible today.",
      "headline": "Official Savings Check",
      "description": "Quick, free eligibility check.",
      "callToAction": { "type": "LEARN_MORE", "url": "https://brandx.com/offer?utm_source=fb&utm_campaign={CampaignId}" },
      "linkUrlParams": { "hook_id": "H123", "variant": "A" }
    }
  ],
  "ads": [
    { "adSetIndex": 0, "creativeIndex": 0, "hookId": "H123", "variant": "A", "lang": "EN" }
  ],
  "dryRun": false,
  "clientRequestKey": "idempotency_2025-10-22T15:00_hookset_juvederm"
}
```
  - Response (example)
```json
{
  "campaignId": "120000000000001",
  "adSetIds": ["238600000000001"],
  "creativeIds": ["120000000000101"],
  "adIds": ["120000000000201"],
  "naming": {
    "campaign": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22",
    "adSets": ["ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"],
    "ads": ["VID | H123 | A | 4x5 | EN"]
  }
}
```

#### 10.2 Incremental endpoints
- POST `/api/ads/facebook/campaigns`
  - Body: `name`, `objective`, `specialAdCategories`, `buyingType` (AUCTION), `status` (PAUSED/ACTIVE), optional CBO fields (`isCbo`, `dailyBudgetMicros` or `lifetimeBudgetMicros`).
- POST `/api/ads/facebook/adsets`
  - Body: `campaignId`, `name`, `optimizationGoal`, `billingEvent`, `targeting`, `startTime`, optional `endTime`, `budget` (for ABO), `promotedObject` when optimizing for conversions.
- POST `/api/ads/facebook/creatives`
  - Body: `objectStorySpec` supporting `link_data`/`video_data` with CTA/link.
- POST `/api/ads/facebook/ads`
  - Body: `name`, `adsetId`, `creativeId`, `status`.
- PATCH `/api/ads/facebook/campaigns/:id` (rename, pause/resume, budgets)
- PATCH `/api/ads/facebook/adsets/:id` (budget/bid/schedule)
- PATCH `/api/ads/facebook/ads/:id` (status)
- GET sync endpoints for each object type to pull latest state and map IDs.

### 11) Meta API Mapping (payload examples)
- Campaign (CBO enabled)
```json
{
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22",
  "objective": "CONVERSIONS",
  "special_ad_categories": ["NONE"],
  "status": "PAUSED",
  "buying_type": "AUCTION",
  "is_campaign_budget_optimized": true,
  "daily_budget": "50000000"
}
```

- Ad Set (optimize for purchase conversions)
```json
{
  "name": "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "campaign_id": "120000000000001",
  "billing_event": "IMPRESSIONS",
  "optimization_goal": "OFFSITE_CONVERSIONS",
  "promoted_object": { "pixel_id": "123456789012345", "custom_event_type": "PURCHASE" },
  "targeting": {
    "geo_locations": { "countries": ["US"] },
    "age_min": 21,
    "age_max": 65,
    "publisher_platforms": ["facebook","instagram"],
    "facebook_positions": ["feed","story","instream_video","reels"],
    "instagram_positions": ["feed","story","reels"]
  },
  "status": "PAUSED",
  "start_time": "2025-10-22T15:00:00Z"
}
```

- Creative (video)
```json
{
  "object_story_spec": {
    "page_id": "112233445566",
    "video_data": {
      "video_id": "987654321000",
      "message": "Hook: stop scrolling. See if you're eligible today.",
      "title": "Official Savings Check",
      "call_to_action": {
        "type": "LEARN_MORE",
        "value": { "link": "https://brandx.com/offer?utm_source=fb&utm_campaign={campaign_id}" }
      }
    }
  }
}
```

- Ad
```json
{
  "name": "VID | H123 | A | 4x5 | EN",
  "adset_id": "238600000000001",
  "creative": { "creative_id": "120000000000101" },
  "status": "PAUSED"
}
```

### 12) Validation Rules
- Always require `specialAdCategories`; default to `["NONE"]` when not applicable.
- Enforce campaign objective → ad set `optimization_goal` compatibility.
  - CONVERSIONS/SALES: require `promoted_object.pixel_id` + `custom_event_type`; set `optimization_goal = OFFSITE_CONVERSIONS` (or equivalent per objective policy).
  - LEAD_GENERATION: ensure page permissions and on-ad lead form flow if used.
  - VIDEO_VIEWS: `optimization_goal = THRUPLAY`.
- Limit ad sets per campaign to ≤ 200.

### 13) Idempotency
- Strategy
  - Accept `clientRequestKey` on structure-creation and per-object endpoints.
  - Deduplicate at the DB layer; reuse existing Meta IDs on retry.
  - Deterministic name generation to avoid duplicates.

### 14) Error Handling & Retries
- Retries: exponential backoff on 429/5xx from Meta; do not retry on 4xx validation failures.
- Partial failures: return aggregated result with per-object errors and created IDs.
- Validation errors: fail fast with clear messages citing the offending field and object index.

### 15) Observability
- Persist request/response payloads, Meta IDs, status, and errors by `clientRequestKey` and `hookSetId`.
- Emit structured logs and metrics: call latencies, success rates, retries, object counts.
- Tracing: one trace per structure-creation request with spans per Meta call.

### 16) Security & Permissions
- Use system user or long-lived token with `ads_management` scope.
- Store tokens securely; do not log access tokens.
- Access control on Strategis endpoints via service-to-service auth (e.g., mTLS or signed tokens).

### 17) Rollout Plan
- Phase 1: Sandbox ad account with dry-run=true; validate payloads and naming.
- Phase 2: Limited prod accounts with CBO campaigns and 1–3 ad sets.
- Phase 3: Full adoption; enable sync backfills and automation hooks.

### 18) Open Questions
- Should we support ABO at launch or mandate CBO only?
- Asset upload pipeline ownership (separate service vs. inline)?
- Audience resolution strategy (supply IDs vs. Strategis lookup)?

### 19) Appendix – Minimal Required Inputs
- `adAccountId (act_*)`, `objective`, `specialAdCategories`, `status`.
- For conversions: `pixelId`, `customEventType`.
- For creatives: `pageId`, `asset` (video/image IDs), CTA/link.
- Targeting: geos, platforms, placements, age ranges, audience references.

### 20) External References
- Meta Campaigns: [Campaign reference (v24.0)](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/)


