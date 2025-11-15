# Strategis Facebook API Relay Endpoints — Specification

## Document Purpose
This document specifies the Facebook API relay endpoints that need to be built in Strategis to support Liftoff campaign creation.

**Status**: 🔴 REQUIRED — Hard requirement to route through Strategis  
**Owner**: Strategis Engineering (with Liftoff collaboration)  
**Version**: 1.0 (2025-01-XX)

---

## Overview

Liftoff requires the ability to create Facebook campaigns, ad sets, ads, and creatives through Strategis. Currently, Strategis only supports read/update operations. We need to build create endpoints that relay requests to Meta Ads API.

---

## Required Endpoints

### 1. Create Campaign

**Endpoint**: `POST /api/facebook/campaigns/create`

**Purpose**: Create a Facebook campaign via Strategis relay

**Request**:
```json
{
  "organization": "Interlincx",
  "adAccountId": "123456789",
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22",
  "objective": "CONVERSIONS",
  "status": "PAUSED",
  "special_ad_categories": ["NONE"],
  "buying_type": "AUCTION",
  "is_campaign_budget_optimized": true,
  "daily_budget": "50000000",
  "clientRequestKey": "idempotency-key-123"
}
```

**Response**:
```json
{
  "id": "120212345678901234",
  "name": "BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22"
}
```

**Error Response**:
```json
{
  "error": {
    "message": "Invalid ad account",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 1487295
  }
}
```

---

### 2. Create Ad Set

**Endpoint**: `POST /api/facebook/adsets/create`

**Purpose**: Create a Facebook ad set via Strategis relay

**Request**:
```json
{
  "organization": "Interlincx",
  "campaign_id": "120212345678901234",
  "name": "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1",
  "optimization_goal": "OFFSITE_CONVERSIONS",
  "billing_event": "IMPRESSIONS",
  "targeting": {
    "geo_locations": {
      "countries": ["US"]
    },
    "age_min": 21,
    "age_max": 65,
    "publisher_platforms": ["facebook", "instagram"],
    "facebook_positions": ["feed", "story", "instream_video", "reels"],
    "instagram_positions": ["feed", "story", "reels"]
  },
  "status": "PAUSED",
  "start_time": "2025-10-22T15:00:00Z",
  "promoted_object": {
    "pixel_id": "123456789012345",
    "custom_event_type": "PURCHASE"
  },
  "daily_budget": "5000000",
  "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
  "clientRequestKey": "idempotency-key-456"
}
```

**Response**:
```json
{
  "id": "120212345678901235",
  "name": "ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1"
}
```

---

### 3. Create Ad Creative

**Endpoint**: `POST /api/facebook/adcreatives/create`

**Purpose**: Create a Facebook ad creative via Strategis relay

**Request**:
```json
{
  "organization": "Interlincx",
  "object_story_spec": {
    "page_id": "112233445566",
    "video_data": {
      "video_id": "987654321000",
      "message": "Hook: stop scrolling. See if you're eligible today.",
      "title": "Official Savings Check",
      "call_to_action": {
        "type": "LEARN_MORE",
        "value": {
          "link": "https://brandx.com/offer?utm_source=fb&utm_campaign={campaign_id}"
        }
      }
    }
  },
  "clientRequestKey": "idempotency-key-789"
}
```

**Response**:
```json
{
  "id": "120212345678901236"
}
```

---

### 4. Create Ad

**Endpoint**: `POST /api/facebook/ads/create`

**Purpose**: Create a Facebook ad via Strategis relay

**Request**:
```json
{
  "organization": "Interlincx",
  "adset_id": "120212345678901235",
  "name": "VID | H123 | A | 4x5 | EN",
  "creative": {
    "creative_id": "120212345678901236"
  },
  "status": "PAUSED",
  "clientRequestKey": "idempotency-key-101112"
}
```

**Response**:
```json
{
  "id": "120212345678901237",
  "name": "VID | H123 | A | 4x5 | EN"
}
```

---

## Implementation Details

### Authentication

**Current Implementation** (from Strategis codebase):
- Strategis stores Facebook credentials per organization
- `organizationUsers.getOrgFacebookCredentials(organization)` returns auth tokens
- Tokens are cached for 11 hours
- Code location: `strategis-api/lib/services/facebook.js`

**Required for New Endpoints**:
- Use same authentication mechanism
- Retrieve credentials via `organizationUsers.getOrgFacebookCredentials(organization)`
- Pass `access_token` to Meta Graph API calls

### Idempotency

**Requirement**: Support `clientRequestKey` for idempotent requests

**Implementation**:
```javascript
// Check idempotency cache before making API call
if (clientRequestKey) {
  const cached = await checkIdempotencyCache(clientRequestKey);
  if (cached) {
    return send(req, res, cached);
  }
}

// After successful API call, store in cache
if (clientRequestKey && fbResponse) {
  await storeIdempotencyCache(clientRequestKey, fbResponse);
}
```

**Cache TTL**: 24 hours (or configurable)

### Error Handling

**Facebook API Errors**:
- Pass through Facebook error responses
- Include Facebook error code and message
- Return appropriate HTTP status codes (400, 401, 403, 500, etc.)

**Strategis Errors**:
- Missing organization credentials → 401 Unauthorized
- Invalid organization → 400 Bad Request
- Rate limiting → 429 Too Many Requests

### Rate Limiting

**Considerations**:
- Facebook API has rate limits
- Strategis should implement rate limiting per organization
- Return 429 with Retry-After header when rate limited

---

## Example Implementation

### File: `strategis-api/lib/api/facebook.js`

```javascript
function createCampaign(req, res, opts, cb) {
  body(req, res, async function (err, body) {
    if (err) return cb(err);
    
    const { 
      organization, 
      adAccountId, 
      clientRequestKey, 
      ...campaignData 
    } = body;
    
    // Validate required fields
    if (!organization || !adAccountId || !campaignData.name) {
      return send(req, res, {
        error: {
          message: "Missing required fields: organization, adAccountId, name",
          code: 400
        }
      }, 400);
    }
    
    // Check idempotency
    if (clientRequestKey) {
      const cached = await checkIdempotencyCache(clientRequestKey);
      if (cached) {
        return send(req, res, cached);
      }
    }
    
    // Get Facebook credentials
    organizationUsers.getOrgFacebookCredentials(organization, async (err, credentials) => {
      if (err) {
        return send(req, res, {
          error: {
            message: "Failed to retrieve Facebook credentials",
            code: 401
          }
        }, 401);
      }
      
      const { authToken } = credentials;
      
      // Call Meta Graph API
      const url = `${config.facebook.host}/act_${adAccountId}/campaigns`;
      const params = {
        access_token: authToken,
        ...campaignData
      };
      
      jsonist.post(url, params, async function (err, fbCampaign) {
        if (err) {
          // Pass through Facebook errors
          return send(req, res, {
            error: {
              message: err.message || "Facebook API error",
              type: err.type,
              code: err.code,
              error_subcode: err.error_subcode
            }
          }, err.statusCode || 500);
        }
        
        // Store in idempotency cache
        if (clientRequestKey) {
          await storeIdempotencyCache(clientRequestKey, fbCampaign);
        }
        
        send(req, res, fbCampaign);
      });
    });
  });
}

function createAdSet(req, res, opts, cb) {
  body(req, res, async function (err, body) {
    if (err) return cb(err);
    
    const { 
      organization, 
      campaign_id, 
      clientRequestKey, 
      ...adSetData 
    } = body;
    
    // Validate required fields
    if (!organization || !campaign_id || !adSetData.name) {
      return send(req, res, {
        error: {
          message: "Missing required fields: organization, campaign_id, name",
          code: 400
        }
      }, 400);
    }
    
    // Check idempotency
    if (clientRequestKey) {
      const cached = await checkIdempotencyCache(clientRequestKey);
      if (cached) {
        return send(req, res, cached);
      }
    }
    
    // Get Facebook credentials
    organizationUsers.getOrgFacebookCredentials(organization, async (err, credentials) => {
      if (err) {
        return send(req, res, {
          error: {
            message: "Failed to retrieve Facebook credentials",
            code: 401
          }
        }, 401);
      }
      
      const { authToken } = credentials;
      
      // Call Meta Graph API
      const url = `${config.facebook.host}/adcampaigns`;
      const params = {
        access_token: authToken,
        campaign_id,
        ...adSetData
      };
      
      jsonist.post(url, params, async function (err, fbAdSet) {
        if (err) {
          return send(req, res, {
            error: {
              message: err.message || "Facebook API error",
              type: err.type,
              code: err.code,
              error_subcode: err.error_subcode
            }
          }, err.statusCode || 500);
        }
        
        // Store in idempotency cache
        if (clientRequestKey) {
          await storeIdempotencyCache(clientRequestKey, fbAdSet);
        }
        
        send(req, res, fbAdSet);
      });
    });
  });
}

// Similar implementations for createAdCreative and createAd
```

---

## Testing Requirements

### Unit Tests
- Test authentication (valid/invalid organization)
- Test idempotency (duplicate requests)
- Test error handling (Facebook API errors)
- Test validation (missing required fields)

### Integration Tests
- Test with Facebook sandbox account
- Test full campaign creation flow
- Test error scenarios (invalid ad account, etc.)

### Manual Testing
- Test with real ad account (staging)
- Verify campaign creation in Facebook UI
- Verify idempotency works correctly

---

## Deployment Plan

### Phase 1: Core Endpoints (MVP)
1. ✅ Create Campaign endpoint
2. ✅ Create Ad Set endpoint
3. ✅ Create Ad endpoint
4. ✅ Basic error handling
5. ✅ Idempotency support

### Phase 2: Enhanced Features
1. ⏭️ Create Ad Creative endpoint
2. ⏭️ Batch creation endpoints
3. ⏭️ Rate limiting
4. ⏭️ Enhanced error messages
5. ⏭️ Monitoring and logging

---

## API Version

**Meta Ads API Version**: Use latest stable version (currently v24.0)

**Configurable**: Allow version override via environment variable or config

---

## Monitoring & Observability

**Metrics to Track**:
- Request rate per organization
- Success/failure rates
- Latency (p50, p95, p99)
- Facebook API error rates
- Idempotency cache hit rate

**Logging**:
- Log all requests (organization, endpoint, clientRequestKey)
- Log Facebook API responses (success/error)
- Log idempotency cache operations

---

## Security Considerations

1. **Authentication**: Verify organization has valid Facebook credentials
2. **Authorization**: Ensure organization has access to specified ad account
3. **Rate Limiting**: Prevent abuse per organization
4. **Input Validation**: Validate all request parameters
5. **Error Messages**: Don't expose sensitive information in errors

---

## Next Steps

1. **Review Specification**: Strategis engineering team review
2. **Estimate Timeline**: Development and testing timeline
3. **Assign Resources**: Developer assignment
4. **Create Tickets**: Break down into implementation tasks
5. **Schedule Kickoff**: Meeting with Liftoff team to align

---

## References

- **Architecture Decision**: `strategis-facebook-api-architecture-decision.md`
- **Implementation Guide**: `strategis-campaign-setup-implementation-guide.md` (needs update)
- **Meta Ads API Docs**: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/

