# Strateg.is Campaign Data Export API — PRD

## Document Purpose
This document specifies an API that the Strategsis engineering team can provide to export complete Facebook campaign setup data, including campaign names, settings, ad creatives, and assets. This enables the Attention Engine to maintain local copies of campaign configurations for analysis, compliance scanning, auditing, and portfolio growth monitoring.

**Status**: 📋 SPECIFICATION  
**Version**: 1.0 (2025-01-XX)  
**Owner**: Engineering (Platform)  
**Target Audience**: Strateg.is Engineering Team

---

## Overview

### Problem Statement
The Attention Engine needs programmatic access to complete Facebook campaign data (campaigns, ad sets, ads, creatives, and assets) for:
- **Compliance scanning**: Local analysis of ad text for flagged content, policy violations, or brand safety concerns
- **Audit trails**: Historical record of campaign configurations and changes
- **Portfolio monitoring**: Track campaign lifecycle events (launch, activation, pausing) to measure portfolio growth velocity and operational metrics
- **Analytics**: Cross-campaign analysis of creative performance, naming patterns, and settings
- **Debugging**: Troubleshooting campaign setup issues without requiring Facebook UI access

### Current State
- Strateg.is has read access to Facebook campaigns via `GET /api/facebook/campaigns`
- Strateg.is stores Facebook credentials per organization
- The Attention Engine backend has an ingestion script that pulls campaign performance data via `GET /api/facebook/report` (campaign-level metrics only)
- **Gap**: No comprehensive endpoint to fetch full campaign structure with creatives and assets, or to track campaign lifecycle state changes over time

### Proposed Solution
A new Strateg.is API endpoint (or set of endpoints) that exports complete campaign hierarchies with all associated metadata, creative content, and asset references.

---

## Use Cases

### Use Case 1: Ad Text Compliance Scanning
**Scenario**: Marketing team wants to scan all active ads for potentially flagged text (e.g., claims, financial disclaimers, prohibited terms).

**Flow**:
1. Attention Engine calls Strateg.is API to fetch all campaigns for an organization
2. API returns complete ad text (primary text, headline, description) for all ads
3. Attention Engine runs local compliance scanner over the text
4. Flags any ads that contain problematic language

**Requirements**:
- Must include all ad text fields (primary_text, headline, description, call_to_action)
- Must include ad status to filter active vs paused
- Must include campaign/ad set context for reporting

### Use Case 2: Campaign Configuration Audit
**Scenario**: Engineering team needs to audit campaign settings (budgets, targeting, optimization) across all campaigns.

**Flow**:
1. Attention Engine calls Strateg.is API to fetch campaign configurations
2. API returns complete targeting specs, budget settings, optimization goals
3. Attention Engine stores in local database for historical tracking
4. Attention Engine generates audit reports comparing settings across campaigns

**Requirements**:
- Must include all campaign/ad set settings (not just IDs and names)
- Must include timestamps for change tracking
- Must support filtering by date range, status, or account

### Use Case 3: Creative Asset Inventory
**Scenario**: Creative team needs to inventory all video/image assets used across campaigns.

**Flow**:
1. Attention Engine calls Strateg.is API to fetch creative data
2. API returns creative IDs, asset URLs, and metadata
3. Attention Engine downloads assets locally (or stores URLs)
4. Attention Engine builds asset manifest for creative library

**Requirements**:
- Must include creative asset URLs (images, videos, thumbnails)
- Must include creative metadata (format, dimensions, duration)
- Must support bulk export for multiple campaigns

### Use Case 4: Portfolio Growth & Velocity Monitoring
**Scenario**: Operations team needs to track portfolio growth metrics—how many campaigns launch per day/week, time-to-active, pause rates, and overall portfolio velocity.

**Flow (Future Phase)**:
1. Attention Engine polls Strateg.is API periodically (e.g., hourly) to fetch current campaign states
2. API returns campaign status and timestamps (created, updated, start, stop)
3. Attention Engine compares current state with previous state (stored locally) to detect changes
4. Attention Engine calculates velocity metrics:
   - New campaigns launched (status changed from not ACTIVE → ACTIVE)
   - Campaigns paused (status changed from ACTIVE → PAUSED)
   - Time-to-active (created_time → first ACTIVE observation)
   - Active campaign count trends
   - Portfolio growth rate (campaigns/week, ad sets/week, ads/week)

**Requirements (Future Phase; not V1)**:
- Must include status timestamps (`created_time`, `updated_time`, `start_time`, `stop_time`)
- Must include current status and/or `effective_status` for all entities (campaigns, ad sets, ads)
- Must support filtering by date range to track changes over time
- Optional: Status change history if Strateg.is adds polling-based tracking
- Should support incremental queries ("give me campaigns updated since timestamp X")

---

## API Specification

### Endpoint 1: Export Campaign Hierarchy

**Endpoint**: `GET /api/v1/facebook/campaigns/export`

**Purpose**: Export complete campaign structure (campaigns → ad sets → ads → creatives) for a given organization and optional filters.

**Authentication**: Same as existing Strateg.is endpoints (organization-based auth)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organization` | string | ✅ Yes | Organization name (e.g., "Interlincx") |
| `adAccountId` | string | ❌ No | Filter by specific ad account (act_*) |
| `campaignIds` | string[] | ❌ No | Filter by specific campaign IDs (comma-separated) |
| `status` | string | ❌ No | Filter by status: `ACTIVE`, `PAUSED`, `ARCHIVED`, `DELETED` (see note on `effective_status` and DELETED visibility) |
| `dateStart` | string | ❌ No | Filter campaigns created on or after (ISO 8601) |
| `dateEnd` | string | ❌ No | Filter campaigns created on or before (ISO 8601) |
| `updatedSince` | string | ❌ No | Filter campaigns updated on or after (ISO 8601) - useful for incremental syncs |
| `includeAssets` | boolean | ❌ No | Include asset URLs/metadata (default: `false` in V1) |
| `includePerformance` | boolean | ❌ No | Include performance metrics (default: `false` in V1; requires additional params below) |
| `performanceDateStart` | string | When `includePerformance=true` | Metrics start date (ISO 8601, maps to `date_start`) |
| `performanceDateEnd` | string | When `includePerformance=true` | Metrics end date (ISO 8601, maps to `date_end`) |
| `performanceTimeIncrement` | string | ❌ No | `"day"` (default), `"1"`, `"month"` (maps to `time_increment`) |
| `performanceAttribution` | string | ❌ No | `"7d_click"` (default), `"28d_click"`, etc. (maps to `attribution_setting`) |
| `format` | string | ❌ No | Response format: `json` (default) or `csv` |

**Response Schema** (JSON):

```typescript
interface CampaignExportResponse {
  organization: string;
  exportedAt: string; // ISO 8601 timestamp
  filters: {
    adAccountId?: string;
    campaignIds?: string[];
    status?: string;
    dateStart?: string;
    dateEnd?: string;
  };
  campaigns: CampaignExport[];
  summary: {
    totalCampaigns: number;
    totalAdSets: number;
    totalAds: number;
    totalCreatives: number;
    // Status breakdowns for velocity metrics
    statusBreakdown?: {
      campaigns: {
        ACTIVE: number;
        PAUSED: number;
        ARCHIVED: number;
        DELETED: number;
      };
      adSets: {
        ACTIVE: number;
        PAUSED: number;
        ARCHIVED: number;
        DELETED: number;
      };
      ads: {
        ACTIVE: number;
        PAUSED: number;
        ARCHIVED: number;
        DELETED: number;
      };
    };
  };
  /**
   * Timestamp that clients can use as the next `updatedSince` value for incremental syncs.
   * Strateg.is SHOULD set this to the max `updated_time` observed in this response.
   */
  lastSyncTimestamp?: string;
  // Optional paging info for cursor-based pagination
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string; // URL for next page
  };
  // Optional errors for partial failures
  errors?: Array<{
    entityType: "campaign" | "adset" | "ad" | "creative";
    entityId: string;
    message: string;
    facebookError?: any; // Raw Facebook error payload, if available
  }>;
}

interface CampaignExport {
  // Campaign-level fields
  id: string; // Facebook campaign ID
  name: string;
  status: string; // Raw Facebook `status`
  effective_status: string; // Facebook `effective_status` (actual delivery state)
  objective: string; // e.g., "CONVERSIONS", "LINK_CLICKS"
  special_ad_categories: string[]; // e.g., ["HOUSING", "CREDIT"]
  created_time: string; // ISO 8601
  updated_time: string; // ISO 8601
  start_time?: string; // ISO 8601 - when campaign is scheduled to start
  stop_time?: string; // ISO 8601 - when campaign is scheduled to stop
  
  // Budget settings
  budget: {
    type: "DAILY" | "LIFETIME";
    daily_budget?: number;   // Integer in minor currency units (e.g., cents)
    lifetime_budget?: number;
  };
  
  // Campaign-level settings
  buying_type: string; // e.g., "AUCTION"
  bid_strategy?: string; // e.g., "LOWEST_COST_WITHOUT_CAP"
  
  // Ad sets
  adSets: AdSetExport[];
}

interface AdSetExport {
  id: string; // Facebook ad set ID
  name: string;
  status: string; // Raw `status`
  effective_status: string; // Facebook `effective_status`
  created_time: string;
  updated_time: string;
  start_time?: string; // ISO 8601 - when ad set is scheduled to start
  end_time?: string; // ISO 8601 - when ad set is scheduled to end
  
  // Budget (for ABO ad sets)
  daily_budget?: number;
  lifetime_budget?: number;
  
  // Optimization
  optimization_goal: string; // e.g., "OFFSITE_CONVERSIONS"
  billing_event: string; // e.g., "IMPRESSIONS"
  bid_amount?: number; // Bid amount in minor units
  bid_strategy?: string;
  
  // Targeting
  targeting: {
    age_min?: number;
    age_max?: number;
    genders?: number[]; // 1=male, 2=female. Omit or use [1,2] for all genders
    geo_locations: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
      zipCodes?: string[];
    };
    publisher_platforms?: string[]; // ["facebook", "instagram", "messenger", "audience_network"]
    facebook_positions?: string[]; // ["feed", "story", "reels", "instream_video"]
    instagram_positions?: string[]; // ["feed", "story", "reels"]
    device_platforms?: string[]; // ["mobile", "desktop"]
    // ... other targeting fields as available
  };
  
  // Optimization configuration
  promotedObject?: {
    pixel_id?: string;
    custom_event_type?: string; // e.g., "PURCHASE"
    custom_conversion_id?: string;
  };
  
  // Ads
  ads: AdExport[];
}

interface AdExport {
  id: string; // Facebook ad ID
  name: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  
  // Creative reference
  creativeId: string;
  
  // Ad-level settings
  callToActionType?: string; // e.g., "LEARN_MORE", "SHOP_NOW"
  
  // Creative content (embedded for convenience)
  creative: CreativeExport;
  
  // Performance metrics (if includePerformance=true)
  performance?: {
    impressions?: number;
    clicks?: number;
    spend?: number; // Amount in minor currency units
    // ... other metrics as available
  };
}

interface CreativeExport {
  id: string; // Facebook creative ID
  name?: string;
  // Raw Facebook object_story_spec-aligned structure
  object_story_spec?: {
    // Link ad creative
    link_data?: {
      image_url?: string;
      image_hash?: string;
      link?: string;
      message?: string; // Primary text
      name?: string; // Headline
      description?: string;
      call_to_action?: {
        type: string;
        value?: {
          link?: string;
        };
      };
      // Carousel cards
      child_attachments?: Array<{
        link?: string;
        image_url?: string;
        image_hash?: string;
        name?: string; // Card headline
        description?: string; // Card description
      }>;
    };
    
    // Video ad creative
    video_data?: {
      video_id?: string;
      image_url?: string; // Thumbnail
      image_hash?: string;
      title?: string; // Headline
      message?: string; // Primary text
      description?: string;
      call_to_action?: {
        type: string;
        value?: {
          link?: string;
        };
      };
    };
  };
  
  // Asset metadata
  assets?: {
    images?: Array<{
      url: string;
      hash: string;
      width?: number;
      height?: number;
    }>;
    videos?: Array<{
      id: string;
      thumbnailUrl?: string;
      duration?: number; // seconds
      width?: number;
      height?: number;
    }>;
  };
  
  // Normalized text fields (for compliance scanning; derived from object_story_spec)
  textFields: {
    primaryText?: string; // Main ad copy
    headline?: string;
    description?: string;
    callToAction?: string;
    // Carousel-specific
    carouselTexts?: string[]; // Text from each carousel card
  };
}

```

**Example Request**:

```bash
GET /api/v1/facebook/campaigns/export?organization=Interlincx&status=ACTIVE&includeAssets=false
```

**Example Response**:

```json
{
  "organization": "Interlincx",
  "exportedAt": "2025-01-15T10:30:00Z",
  "filters": {
    "status": "ACTIVE"
  },
  "campaigns": [
    {
      "id": "120212345678901234",
      "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22",
      "status": "ACTIVE",
      "effective_status": "ACTIVE",
      "objective": "CONVERSIONS",
      "specialAdCategories": [],
      "created_time": "2025-10-22T08:00:00Z",
      "updated_time": "2025-10-22T08:00:00Z",
      "budget": {
        "type": "DAILY",
        "daily_budget": 5000000
      },
      "adSets": [
        {
          "id": "120212345678901235",
          "name": "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
          "status": "ACTIVE",
          "effective_status": "ACTIVE",
          "optimizationGoal": "OFFSITE_CONVERSIONS",
          "billingEvent": "IMPRESSIONS",
          "targeting": {
            "age_min": 21,
            "age_max": 65,
            "geo_locations": {
              "countries": ["US"]
            },
            "publisher_platforms": ["facebook", "instagram"],
            "facebook_positions": ["feed", "story", "reels"],
            "instagram_positions": ["feed", "story", "reels"]
          },
          "promotedObject": {
            "pixel_id": "123456789012345",
            "custom_event_type": "PURCHASE"
          },
          "ads": [
            {
              "id": "120212345678901236",
              "name": "VIDEO | hook_001 | variant_a | 916 | en",
              "status": "ACTIVE",
              "effective_status": "ACTIVE",
              "creativeId": "120212345678901237",
              "creative": {
                "id": "120212345678901237",
                "object_story_spec": {
                  "video_data": {
                    "video_id": "987654321098765",
                    "image_url": "https://scontent.xx.fbcdn.net/...",
                    "title": "Find Doctors Near You Today",
                    "message": "Compare top-rated doctors in your area. Book an appointment in minutes.",
                    "description": "Trusted by thousands of patients",
                    "call_to_action": {
                      "type": "LEARN_MORE",
                      "value": {
                        "link": "https://advertiser.com/doctors"
                      }
                    }
                  }
                },
                "textFields": {
                  "primaryText": "Compare top-rated doctors in your area. Book an appointment in minutes.",
                  "headline": "Find Doctors Near You Today",
                  "description": "Trusted by thousands of patients",
                  "callToAction": "LEARN_MORE"
                },
                "assets": {
                  "videos": [
                    {
                      "id": "987654321098765",
                      "thumbnailUrl": "https://scontent.xx.fbcdn.net/...",
                      "duration": 15,
                      "width": 1080,
                      "height": 1920
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  ],
  "summary": {
    "totalCampaigns": 1,
    "totalAdSets": 1,
    "totalAds": 1,
    "totalCreatives": 1
  }
}
```

---

### Endpoint 2: Export Single Campaign (Detailed)

**Endpoint**: `GET /api/v1/facebook/campaigns/:campaignId/export`

**Purpose**: Export detailed data for a single campaign (useful for deep-dive analysis or debugging).

**Query Parameters**: Same as Endpoint 1, but filters are ignored (campaign ID is specified in path).

**Response Schema**: Same as `CampaignExport` from Endpoint 1, but returns a single campaign object (not wrapped in array).

---

### Endpoint 3: Export Ad Text Only (Lightweight)

**Endpoint**: `GET /api/v1/facebook/campaigns/text-export`

**Purpose**: Lightweight endpoint that returns only ad text fields (for compliance scanning use case). Faster and smaller payload than full export.

**Query Parameters**: Same as Endpoint 1, but `includeAssets` and `includePerformance` are ignored (always false).

**Response Schema**:

```typescript
interface AdTextExportResponse {
  organization: string;
  exportedAt: string;
  filters: { /* same as Endpoint 1 */ };
  ads: Array<{
    campaignId: string;
    campaignName: string;
    adSetId: string;
    adSetName: string;
    adId: string;
    adName: string;
    status: string;
    textFields: {
      primaryText?: string;
      headline?: string;
      description?: string;
      callToAction?: string;
      carouselTexts?: string[];
    };
    creativeId: string;
    linkUrl?: string;
  }>;
  summary: {
    totalAds: number;
    totalTextFields: number; // Count of non-empty text fields
  };
}
```

---

### Endpoint 4: Export Creative Assets Manifest

**Endpoint**: `GET /api/v1/facebook/creatives/assets-manifest`

**Purpose**: Export a manifest of all creative assets (images, videos) with URLs and metadata. Useful for asset inventory and bulk download.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organization` | string | ✅ Yes | Organization name |
| `adAccountId` | string | ❌ No | Filter by ad account |
| `campaignIds` | string[] | ❌ No | Filter by campaign IDs |
| `format` | string | ❌ No | `json` (default) or `csv` |

**Response Schema**:

```typescript
interface AssetsManifestResponse {
  organization: string;
  exportedAt: string;
  assets: Array<{
    creativeId: string;
    adId?: string;
    campaignId?: string;
    assetType: "image" | "video" | "thumbnail";
    url: string;
    hash?: string;
    metadata?: {
      width?: number;
      height?: number;
      duration?: number; // for videos
      fileSize?: number; // bytes
      mimeType?: string;
    };
  }>;
  summary: {
    totalAssets: number;
    totalImages: number;
    totalVideos: number;
  };
}
```

#### CSV Export Format (when `format=csv`)

When `format=csv`, Strateg.is SHOULD return a **ZIP archive** containing multiple normalized CSV files rather than a single flattened table:

- `campaigns.csv` — One row per campaign (campaign-level fields)
- `adsets.csv` — One row per ad set (includes `campaign_id` foreign key)
- `ads.csv` — One row per ad (includes `adset_id` foreign key)
- `creatives.csv` — One row per creative (includes `id` and key creative fields)
- `assets.csv` — One row per asset (includes `creativeId` foreign key, `assetType`, `url`, metadata)

This layout avoids excessive duplication and makes it easier for downstream analytics systems to join tables as needed.

---

## Future Phase: Facebook Campaign Launch API (Create Operations)

### Goal

In a later phase, Strateg.is will expose **create** endpoints that allow the Attention Engine to **programmatically launch campaigns, ad sets, creatives, and ads** while still following Meta Marketing API best practices and keeping all Facebook credentials inside Strateg.is.

- **Attention Engine → Strateg.is (proxy) → Meta Marketing API**
- Payloads and responses should closely mirror the **export schema** defined above to support round‑tripping: export → modify → re‑launch.

### Proposed Create Endpoints (Strateg.is)

- `POST /api/v1/facebook/campaigns/create` → Proxies `POST /act_{ad_account_id}/campaigns`
- `POST /api/v1/facebook/adsets/create` → Proxies `POST /act_{ad_account_id}/adsets`
- `POST /api/v1/facebook/adcreatives/create` → Proxies `POST /act_{ad_account_id}/adcreatives`
- `POST /api/v1/facebook/ads/create` → Proxies `POST /act_{ad_account_id}/ads`

Each endpoint:
- Accepts an **organization** and **adAccountId**.
- Uses `organizationUsers.getOrgFacebookCredentials(organization)` to resolve an access token.
- Maps request payloads 1:1 onto the corresponding Meta Marketing API calls as described in the [Marketing API docs](https://developers.facebook.com/docs/marketing-api/) and [Ad Creative docs](https://developers.facebook.com/docs/marketing-api/creative).
- Returns the **raw Meta object** (`id`, `name`, etc.) plus any Strateg.is metadata (e.g., idempotency keys, internal request IDs).

### Request Schemas (High-Level)

#### `POST /api/facebook/campaigns/create`

```jsonc
{
  "organization": "Interlincx",
  "adAccountId": "act_123456789",
  "clientRequestKey": "campaign-uuid-123",   // idempotency
  "name": "BrandX | CONVERSIONS | hookset_... | US | FB | 2025-10-22",
  "objective": "CONVERSIONS",
  "status": "PAUSED",
  "special_ad_categories": [],
  "buying_type": "AUCTION",
  "daily_budget": 5000000,                  // Integer in minor currency units (e.g., cents) if CBO
  "lifetime_budget": 0
}
```

#### `POST /api/facebook/adsets/create`

```jsonc
{
  "organization": "Interlincx",
  "adAccountId": "act_123456789",
  "clientRequestKey": "adset-uuid-123",
  "campaign_id": "120212345678901234",
  "name": "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "optimization_goal": "OFFSITE_CONVERSIONS",
  "billing_event": "IMPRESSIONS",
  "status": "PAUSED",
  "daily_budget": 0,               // for CBO, budget may live on campaign
  "lifetime_budget": 0,
  "bid_amount": null,
  "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
  "targeting": {
    "geo_locations": { "countries": ["US"] },
    "age_min": 21,
    "age_max": 65,
    "publisher_platforms": ["facebook", "instagram"],
    "facebook_positions": ["feed", "story", "reels"],
    "instagram_positions": ["feed", "story", "reels"]
  },
  "promoted_object": {
    "pixel_id": "123456789012345",
    "custom_event_type": "PURCHASE"
  }
}
```

#### `POST /api/facebook/adcreatives/create`

Request should mirror the **Ad Creative** structures from [Ad Creative docs](https://developers.facebook.com/docs/marketing-api/creative), and be compatible with the `CreativeExport.objectStorySpec` shape already defined in this PRD.

Examples:

- **Link Ad Creative**: `object_story_spec.link_data.{message,name,description,link,image_hash}`
- **Video Ad Creative**: `object_story_spec.video_data.{title,message,description,video_id,image_url}`
- **Carousel Ad Creative**: `object_story_spec.link_data.child_attachments[]`

The Strateg.is API should:
- Accept a normalized JSON body that matches `CreativeExport` fields.
- Map directly to the Meta `adcreatives` endpoint payload.

#### `POST /api/facebook/ads/create`

```jsonc
{
  "organization": "Interlincx",
  "adAccountId": "act_123456789",
  "clientRequestKey": "ad-uuid-123",
  "adset_id": "120212345678901235",
  "name": "VIDEO | hook_001 | variant_a | 916 | en",
  "creative": { "creative_id": "120212345678901237" },
  "status": "PAUSED"
}
```

### Best Practices & Requirements

- **Idempotency**
  - All create endpoints must accept a `clientRequestKey`.
  - Strateg.is should cache successful responses keyed by `clientRequestKey` and return cached results when the same key is reused.
- **Explicit Field Mapping**
  - Only send fields that are **documented** in the Marketing API reference and explicitly modeled in this PRD.
  - Keep the export schemas aligned with the create schemas to avoid drift.
- **Error Handling**
  - Pass through Meta error payloads (message, type, code, error_subcode) to the Attention Engine.
  - Distinguish between validation errors (4xx) and transient errors (5xx / rate limiting) so the Attention Engine can decide whether to retry.
- **Rate Limits & Batching**
  - Implement minimal backoff / retry inside Strateg.is for rate-limit responses.
  - For bulk launches, consider batching at the Attention Engine layer and/or the Strateg.is layer to avoid hammering the Marketing API.
- **Auditability**
  - Log all create requests and responses with:
    - `organization`, `adAccountId`
    - `clientRequestKey`
    - Meta IDs returned (`campaign_id`, `adset_id`, `creative_id`, `ad_id`)
  - Optionally index these in Strateg.is so Attention Engine can later query “what did we launch and when?”.

This “launch API” phase is intentionally specified at a high level so Strateg.is and Attention Engine can align on object shapes now, while deferring actual implementation details (idempotency store, logging backend, etc.) to a later project.

---

## Implementation Notes for Strateg.is

### Data Sources
- **Campaign/Ad Set/Ad data**: Fetch from Meta Graph API using existing `organizationUsers.getOrgFacebookCredentials()` pattern
- **Creative data**: Fetch from Meta Graph API `/adcreatives` endpoint with `object_story_spec` field
- **Asset URLs**: Extract from creative `object_story_spec` (image URLs, video IDs → video URLs)

### Meta Graph API Fields Required

**Campaigns**:
```
fields=id,name,status,objective,special_ad_categories,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget,buying_type,bid_strategy
```

**Ad Sets**:
```
fields=id,name,status,created_time,updated_time,start_time,end_time,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,bid_strategy,targeting,promoted_object
```

**Ads**:
```
fields=id,name,status,created_time,updated_time,creative{id,name,object_story_spec},call_to_action_type
```

**Creatives** (detailed):
```
fields=id,name,object_story_spec,image_url,image_hash,video_id,thumbnail_url
```

### Performance Considerations
- **Pagination**: Use Meta Graph API pagination for large result sets
- **Batching**: Consider batching multiple campaign requests if needed
- **Caching**: Strateg.is may want to cache campaign data (with TTL) to reduce Facebook API calls
- **Rate Limits**: Respect Meta Graph API rate limits (600 calls per 600 seconds per app)
- **Insights Defaults** (when `includePerformance=true`): Use campaign-level Insights by default with `time_increment="day"` and `attribution_setting="7d_click"`, unless overridden by request parameters.

### Incremental Sync Strategy
- Use a **hybrid approach** for incremental syncs:
  - Apply `updatedSince` at the Facebook Graph API level (filter by `updated_time` where supported).
  - Optionally apply additional filtering inside Strateg.is if needed for consistency with existing reports.
- Populate `lastSyncTimestamp` in the response with the maximum `updated_time` observed so that the Attention Engine can pass it back as the next `updatedSince` value.

### Error Handling
- Return Facebook API errors as-is (with proper HTTP status codes)
- Include `error` field in response if partial failures occur:
```json
{
  "error": {
    "message": "Failed to fetch creative for ad 123456",
    "adId": "123456",
    "facebookError": { /* original Facebook error */ }
  }
}
```

---

## Attention Engine Integration Plan

### Phase 1: Basic Export & Monitoring (Week 1-2)
- Implement client for `GET /api/facebook/campaigns/export`
- Store campaign data in local database (extend `fb_campaigns`, `fb_adsets`, `fb_ads` tables)
- Build campaign state tracking system to detect status changes
- Implement periodic polling (hourly) to track portfolio changes
- Build simple compliance scanner for ad text

### Phase 2: Text Export Optimization (Week 3)
- Implement `GET /api/facebook/campaigns/text-export` client
- Build text scanning pipeline (regex patterns, keyword lists)
- Generate compliance reports

### Phase 3: Asset Management (Week 4)
- Implement `GET /api/facebook/creatives/assets-manifest` client
- Build asset downloader (optional: download assets locally)
- Integrate with existing assets manifest system

### Phase 4: Velocity Metrics Dashboard (Week 5-6)
- Build velocity metrics calculation engine:
  - New campaigns launched per day/week
  - Time-to-active (createdTime → firstActiveTime)
  - Pause rate (campaigns paused / total active)
  - Portfolio growth rate (campaigns/week, ad sets/week, ads/week)
- Create dashboard/reports for portfolio growth monitoring
- Set up alerts for significant status changes or anomalies

---

## Success Criteria

### Functional Requirements
- ✅ Can export all campaigns for an organization
- ✅ Can filter by account, status, date range, updatedSince (for incremental syncs)
- ✅ Includes complete ad text (primary text, headline, description)
- ✅ Includes creative asset URLs and metadata
- ✅ Includes campaign/ad set settings (targeting, budgets, optimization)
- ✅ Includes status timestamps (`created_time`, `updated_time`, `start_time`, `stop_time`) for basic lifecycle analysis
- 🚫 V1 does **not** include status history or `firstActiveTime`; these are deferred to a future velocity-tracking phase

### Performance Requirements
- ✅ Export completes in < 30 seconds for 100 campaigns
- ✅ Supports pagination for large result sets
- ✅ Handles rate limiting gracefully

### Quality Requirements
- ✅ Response format matches specification exactly
- ✅ Handles missing/null fields gracefully
- ✅ Returns clear error messages for invalid requests

---

## Open Questions for Strateg.is

1. **Caching**: Should Strateg.is cache campaign data? If so, what TTL?
2. **Incremental Updates**: The `updatedSince` parameter is proposed for incremental syncs. Can Strateg.is efficiently filter by `updated_time`?
3. **Status History**: Does Facebook API provide status change history, or should Strateg.is track this separately? If not available, can we at least get `firstActiveTime`?
4. **Webhooks**: Could Strateg.is push campaign updates to Attention Engine instead of polling? This would be ideal for real-time velocity metrics.
5. **Asset Download**: Should Strateg.is proxy asset downloads, or return URLs only?
6. **Permissions**: Are there any campaigns/accounts that should be excluded from export?
7. **Rate Limits**: For hourly polling, what's the expected API call volume? Should Attention Engine batch requests or use incremental syncs?

---

## References

- **Meta Ads API Documentation**: https://developers.facebook.com/docs/marketing-apis
- **Existing Strateg.is Endpoints**: `docs/prd/strategis-facebook-api-architecture-decision.md`
- **Attention Engine Campaign Data Model**: `docs/prd/strategis-campaign-data-storage.md`
- **Facebook Entity Tables**: `backend/migrations/007_create_fb_entities.sql`

