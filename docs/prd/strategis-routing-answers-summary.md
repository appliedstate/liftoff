# Strategis Routing — Answers Summary

## Document Purpose
Quick reference summary of confirmed answers about Strategis routing behavior.

**Status**: ✅ ANSWERS CONFIRMED  
**Version**: 1.0 (2025-01-XX)

---

## ✅ Key Answers

### 1. Final Destination URL Determination

**Answer**: Mustache template rendering with merged query object.

**Process**:
1. Load campaign and template
2. Merge campaign.properties into query
3. Apply kwSet overrides (highest priority)
4. Add geo data and derived fields
5. Facebook-specific mappings (`ag = utm_term`)
6. Render Mustache template
7. Clean up empty params
8. Return final URL

**Variable Precedence** (highest to lowest):
1. kwSet overrides
2. Incoming query params
3. Campaign properties
4. Strategis defaults

---

### 2. Article/Landing Page Selection

**Q: Is `properties.article` required?**
- ✅ **OPTIONAL** — No validation requires it

**Q: What if `article` is missing?**
- Renders as empty string → `http://domain.com/?subid=...`

**Q: Can we route to different articles?**
- ✅ **YES** — Three ways:
  1. Set `properties.article` per campaign
  2. kwSet can override per click
  3. Use different templates

**Recommendation**: Use Mustache sections:
```mustache
http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&fbclid={{fbclid}}
```

---

### 3. Template Variable Resolution

**Variables from Campaign Properties**:
- `domain`, `article`, `buyer`, `networkName`, `destination`, etc.

**Variables from Query Parameters**:
- `fbclid` — **Use `{{fbclid}}` directly, NOT `{{networkClickId}}`**
- `utm_term`, `utm_source`, `utm_campaign`, `asid`, etc.

**Variables Added by Strategis**:
- `campaignId`, `kwSetId`, `familyId`
- `zip`, `city`, `state`, `country` (from IP geolocation)
- `hour` (current hour)
- `source` (decorated with kwSetId and familyId)
- `ag` (for Facebook: `utm_term || asid`)

**Precedence**: kwSet > Query Params > Properties > Defaults

---

### 4. Complete Routing Flow

**When User Clicks**:
1. Strategis receives request
2. Loads campaign data
3. Records event (non-blocking, ~10-50ms)
4. Builds query object (merges properties, applies kwSet, adds geo)
5. Validates Facebook click (if invalid → redirects to yahoo.com)
6. Renders template (~5-20ms)
7. Returns 302 redirect

**Total Time**: ~50-100ms

**Event Recording**: Non-blocking, fire-and-forget

---

## ✅ Corrected Template Format

### Recommended Template for Facebook

```mustache
http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&subid2={{source}}_{{kwSetId}}_{{familyId}}&fbclid={{fbclid}}&utm_source=facebook&utm_medium=cpc&utm_campaign={{campaignId}}&utm_term={{ag}}
```

**Key Points**:
- ✅ Use `{{fbclid}}` **NOT** `{{networkClickId}}`
- ✅ Use Mustache section `{{#article}}/{{article}}{{/article}}` for optional article
- ✅ `{{ag}}` auto-populated from `utm_term` (ad set ID)

---

## ✅ Example Scenarios

### Scenario 1: Article Provided

**Campaign Properties**:
```json
{
  "domain": "brandx.com",
  "article": "landing-page"
}
```

**Result**: `http://brandx.com/landing-page?subid=si1a2b3c&fbclid=abc123xyz`

---

### Scenario 2: Article NOT Provided

**Campaign Properties**:
```json
{
  "domain": "brandx.com"
  // No "article"
}
```

**Result**: `http://brandx.com/?subid=si1a2b3c&fbclid=abc123xyz`

**Note**: With Mustache section template, this becomes: `http://brandx.com?subid=...` (no double slash)

---

### Scenario 3: kwSet Override

**Campaign Properties**: `article: "default-page"`  
**kwSet**: `article: "keyword-page"`

**Result**: `http://brandx.com/keyword-page?subid=...` (kwSet wins)

---

### Scenario 4: Invalid fbclid (Spam)

**Request**: `?campaignId=si1a2b3c&fbclid=SPAM_CLICK_ID`

**Result**: Redirects to `https://www.yahoo.com` (spam protection)

---

## ✅ Implementation Recommendations

### Template Design

**✅ GOOD**:
```mustache
http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&fbclid={{fbclid}}&utm_source=facebook&utm_campaign={{campaignId}}&utm_term={{ag}}
```

**❌ BAD**:
```mustache
http://{{domain}}/{{article}}?subid={{campaignId}}
```
(Creates double slash if article missing)

---

### Required Campaign Properties

**Always Set**:
- ✅ `domain` (required)
- ✅ `networkName: "facebook"` (required for validation)
- ✅ `destination: "S1"` or `"Lincx"` (required)

**Optional but Recommended**:
- `article` (landing page path)
- `fbPage` (Facebook page)
- `fbAdAccount` (Facebook ad account)

---

### Facebook-Specific

- ✅ Use `{{fbclid}}` in templates (NOT `{{networkClickId}}`)
- ✅ `{{ag}}` auto-populated from `utm_term` (ad set ID)
- ✅ Set `networkName: "facebook"` for validation
- ✅ Invalid `fbclid` redirects to yahoo.com (spam protection)

---

## References

- **Complete Answers**: `strategis-routing-questions.md` (updated with answers)
- **Setup Flow**: `strategis-setup-complete-flow.md` (updated template format)
- **Requirements**: `strategis-campaign-setup-requirements.md`

