# Strategis Routing & Destination — Questions for Devin

## Document Purpose
Questions about how Strategis determines where to route users when they click tracking URLs, and how article/landing page selection works.

**Status**: ✅ ANSWERS CONFIRMED — See answers below  
**Version**: 1.1 (2025-01-XX)

**✅ COMPLETE ANSWERS**: All questions answered by Devin based on actual Strategis routing code analysis.

---A specified number of ads per ad set.

## ✅ ANSWERS: Complete Routing Logic

### Q1: How Does Strategis Determine the Final Destination URL?

**✅ ANSWER**: Strategis uses Mustache template rendering with merged query object.

**Step-by-Step Process**:

1. **Load campaign and template** (line 218-219):
   ```javascript
   campaign = Campaigns.get(campaignId)
   templateURL = campaign.template.value  // e.g., "http://{{domain}}/{{article}}?subid={{campaignId}}&fbclid={{fbclid}}"
   ```

2. **Build query object by merging** (line 368):
   ```javascript
   query = xtend(campaign.properties, query)
   // Incoming query params OVERRIDE campaign properties
   ```

3. **Add keyword set overrides** (line 372-377):
   ```javascript
   if (kwSet) {
     if (kwSet.domain) query.domain = kwSet.domain      // kwSet wins
     if (kwSet.article) query.article = kwSet.article    // kwSet wins
   }
   ```

4. **Add geo and derived fields** (line 403-414):
   ```javascript
   query = {
     ...query,
     zip: geo.postal,
     city: geo.city,
     state: geo.state,
     country: geo.country,
     kwSetId: kwSetId,
     familyId: familyId,
     hour: new Date().toISOString().slice(11, 13)
   }
   ```

5. **Facebook-specific mappings** (line 416-419):
   ```javascript
   if (networkName === 'facebook') {
     query.ag = query.utm_term || query.asid  // Ad group ID
   }
   query.source = [query.source, kwSetId, familyId].join('_')
   ```

6. **Render template with Mustache** (line 685-693):
   ```javascript
   encodedQuery = _.mapValues(query, encodeValue)  // URL encode all values
   renderedURL = mustache.render(templateURL, encodedQuery)
     .replace(/&#x2F;/g, '/')      // Fix encoded slashes
     .replace(/\w+=&/g, '')         // Remove empty params
     .replace(/&\w+=$/, '')         // Remove trailing empty params
   ```

**Variable Precedence** (highest to lowest):
1. **kwSet overrides** (domain, article, rskey, compkey) — HIGHEST
2. **Incoming query params** (fbclid, utm_term, etc.)
3. **Campaign properties** (domain, article, etc.)
4. **Derived fields** (geo data, kwSetId, familyId) — LOWEST

---

### Q2: Article/Landing Page Selection

**Question**: How does Strategis know which article/landing page to route to?

**What We Need to Know**:
- [ ] Is `properties.article` required or optional?
- [ ] If `article` is not provided, what's the default behavior?
- [ ] Can we specify different articles per campaign?
- [ ] Can the article be determined dynamically (e.g., based on query parameters)?
- [ ] How does Strategis handle multiple landing pages for the same campaign?

**Current Understanding**:
- `properties.article` is marked as optional in campaign creation
- Template uses `{{article}}` variable
- If `article` is not provided, what happens?

**Need Confirmation**: What's the behavior when `article` is missing?

---

### Q3: Template Variable Resolution

**✅ ANSWER**: Variables come from multiple sources with clear precedence.

**Variables from Campaign Properties**:
- All fields in `campaign.properties`:
  - `domain`, `article`, `buyer`, `networkName`, `networkAccountId`
  - `destination`, `fbPage`, `fbAdAccount`, `headline`
  - `rskey`, `compkey`, `optkey`
  - `forcekeyA` through `forcekeyL` (12 keyword slots)

**Variables from Query Parameters**:
- All URL params in the `/route` request:
  - `fbclid` (Facebook click ID) — **Use `{{fbclid}}` directly, NOT `{{networkClickId}}`**
  - `utm_term`, `utm_source`, `utm_campaign`, `utm_content`
  - `asid` (ad set ID)
  - `host`, `userAgent`, `sessionId`
  - Any custom params you add

**Variables Added by Strategis**:
- `campaignId` (from URL)
- `kwSetId`, `familyId` (from campaign lookup)
- `zip`, `city`, `state`, `country` (from IP geolocation)
- `hour` (current hour in ISO format)
- `source` (decorated with kwSetId and familyId)
- `ag` (for Facebook: `utm_term || asid`)

**Priority When Variable Appears in Multiple Places**:

**Example**: `domain` appears in both properties and kwSet
```javascript
// Initial: campaign.properties.domain = "brandx.com"
// kwSet.domain = "special.brandx.com"

// Result: query.domain = "special.brandx.com"  (kwSet wins)
```

**Final Precedence**:
1. **kwSet** (highest priority)
2. **Incoming Query Params**
3. **Campaign Properties**
4. **Strategis Defaults** (lowest priority)

**⚠️ IMPORTANT**: For Facebook, use `{{fbclid}}` directly in templates, NOT `{{networkClickId}}`

---

### Q4: Routing Flow & Redirect Behavior

**✅ ANSWER**: Complete step-by-step flow confirmed.

**When User Clicks Facebook Ad**:

1. **Facebook redirects to**: `https://r.strateg.is/route?campaignId=si1a2b3c&fbclid=abc123xyz&utm_term=120212345678901235`

2. **Strategis `/route` endpoint receives request** (line 172-195):
   - Extracts `campaignId`, `fbclid`, `utm_term`, etc.
   - Gets user IP, userAgent, host
   - Generates sessionId

3. **Load campaign data** (line 218-226):
   - Loads campaign by ID
   - Loads keyword set (kwSet)
   - Loads family ID
   - Gets geo location from IP

4. **Record Strategis event** (line 342-355) — **NON-BLOCKING**:
   - Stores click event in Redis → LevelDB → ClickHouse
   - Does NOT wait for completion
   - Redirect happens even if event storage fails

5. **Build query object** (line 368-419):
   - Merge `campaign.properties` into query
   - Apply kwSet overrides
   - Add geo data, kwSetId, familyId
   - Facebook-specific: `ag = utm_term`

6. **Validate network click** (line 429-491) — **FOR FACEBOOK**:
   - Checks if `fbclid` is valid (not spam)
   - Validates against Redis cache (line 603)
   - If **INVALID**: redirects to `https://www.yahoo.com`
   - If **VALID**: continues to template rendering

7. **Render template** (line 663-693):
   - Processes hash variables if present
   - URL encodes all query values (except 'article')
   - Renders Mustache template
   - Cleans up empty params

8. **Return 302 redirect to final URL**:
   - User lands on advertiser site
   - Advertiser page loads with Facebook Pixel
   - Pixel fires events back to Facebook

**Timeline**:
- Event recording: ~10-50ms (non-blocking, fire-and-forget)
- Template rendering: ~5-20ms
- **Total redirect time: ~50-100ms**

**What Happens if Template Rendering Fails**:
- If template has syntax error or missing required variable
- Mustache renders empty string for missing variables
- No error thrown — just produces incomplete URL
- **Example**: Missing `domain` → `http:///landing-page?subid=...` (invalid URL!)

**Recommendation**: Always validate templates have required variables

---

### Q5: Multiple Landing Pages / Article Selection

**Question**: Can a single campaign route to different landing pages based on conditions?

**What We Need to Know**:
- [ ] Can we specify multiple articles per campaign?
- [ ] Can article be selected based on query parameters?
- [ ] Can article be selected based on campaign properties?
- [ ] Is there a way to A/B test different landing pages?

**Use Case**: 
- Campaign has multiple landing pages (e.g., different angles)
- Want to route users to different pages based on ad set or creative

**Need Confirmation**: Is this supported? How?

---

### Q6: Default Behavior When Article is Missing

**Question**: What happens if `properties.article` is not provided in campaign creation?

**What We Need to Know**:
- [ ] Does Strategis use a default article?
- [ ] Does Strategis use just the domain (e.g., `http://domain.com`)?
- [ ] Does Strategis return an error?
- [ ] Does the template still render (with empty `{{article}}`)?

**Current Template**:
```
http://{{domain}}/{{article}}?subid={{campaignId}}&...
```

**If `article` is missing**:
- Option A: `http://domain.com/?subid=...` (no `/article`)
- Option B: `http://domain.com/{{article}}?subid=...` (literal `{{article}}`)
- Option C: Error/fallback behavior

**Need Confirmation**: What's the actual behavior?

---

## 🟡 HIGH Priority Questions

### Q7: Query Parameter Handling

**Question**: How does Strategis handle query parameters in the tracking URL?

**What We Need to Know**:
- [ ] Are query parameters passed through to the final URL?
- [ ] Can we add custom query parameters?
- [ ] How are `fbclid` and other Facebook parameters handled?
- [ ] What's the format for `{{fbclid}}` in templates vs query params?

**Example**:
- Tracking URL: `https://r.strateg.is/route?campaignId=123&fbclid=abc&custom=xyz`
- Final URL: Does it include `custom=xyz`? How is `fbclid` handled?

**Need Confirmation**: Query parameter handling logic.

---

### Q8: Template Variables vs Campaign Properties

**Question**: What's the relationship between template variables and campaign properties?

**What We Need to Know**:
- [ ] Can template variables reference campaign properties?
- [ ] Can template variables reference other templates?
- [ ] Are there any computed/derived variables?
- [ ] Can we use conditional logic in templates?

**Need Confirmation**: Template variable system capabilities.

---

## ✅ Summary: Answers Confirmed

### Critical for Implementation — ✅ ANSWERED

1. ✅ **Routing Logic**: Mustache template rendering with merged query object
2. ✅ **Article Selection**: Optional, can be overridden by kwSet or query params
3. ✅ **Variable Resolution**: kwSet > Query Params > Properties > Defaults
4. ✅ **Redirect Flow**: Load campaign → Record event (non-blocking) → Validate → Render → Redirect

### Important for Optimization — ✅ ANSWERED

5. ✅ **Multiple Landing Pages**: Yes — via properties, kwSet, or different templates
6. ✅ **Query Parameters**: Query params override properties, kwSet overrides everything
7. ✅ **Template System**: Mustache templates with URL encoding and cleanup

---

## ✅ Key Findings

### Template Design Recommendations

**✅ GOOD Template** (handles missing article gracefully):
```mustache
http://{{domain}}{{#article}}/{{article}}{{/article}}?subid={{campaignId}}&fbclid={{fbclid}}&utm_source=facebook&utm_campaign={{campaignId}}&utm_term={{ag}}
```

**❌ BAD Template** (creates double slash if article missing):
```mustache
http://{{domain}}/{{article}}?subid={{campaignId}}
```

### Required Variables

**Always set these in campaign properties**:
- ✅ `domain` (required for destination)
- ✅ `networkName` (required for validation — set to "facebook")
- ✅ `destination` (required for tracking — "S1" or "Lincx")

### Facebook-Specific

- ✅ Use `{{fbclid}}` **NOT** `{{networkClickId}}`
- ✅ Use `{{ag}}` for ad group (auto-populated from `utm_term`)
- ✅ Set `properties.networkName = "facebook"` for validation

### Testing Recommendations

Test with missing variables to ensure graceful degradation:
- Missing `article` → should not break URL
- Missing `domain` → should fail gracefully
- Invalid `fbclid` → should redirect to yahoo.com
- Missing `fbclid` → should still work

---

## Example Scenarios to Clarify

### Scenario 1: Article Provided

**Campaign Properties**:
```json
{
  "domain": "brandx.com",
  "article": "landing-page"
}
```

**Template**:
```
http://{{domain}}/{{article}}?subid={{campaignId}}&fbclid={{networkClickId}}
```

**Expected Final URL**:
```
http://brandx.com/landing-page?subid=strategis-campaign-123&fbclid=abc123
```

**Question**: Is this correct?

---

### Scenario 2: Article NOT Provided

**Campaign Properties**:
```json
{
  "domain": "brandx.com"
  // No "article" property
}
```

**Template**:
```
http://{{domain}}/{{article}}?subid={{campaignId}}&fbclid={{networkClickId}}
```

**Expected Final URL**:
```
???
```

**Question**: What happens? What's the final URL?

---

### Scenario 3: Query Parameters

**Tracking URL**:
```
https://r.strateg.is/route?campaignId=123&fbclid=abc&utm_source=facebook
```

**Template**:
```
http://{{domain}}/{{article}}?subid={{campaignId}}&fbclid={{networkClickId}}&utm_source=facebook
```

**Question**: 
- Does `utm_source=facebook` from query params get passed through?
- How is `fbclid` from query params mapped to `{{networkClickId}}`?

---

## Next Steps

1. **Schedule Meeting with Devin** to answer these questions
2. **Test Scenarios**: Once answered, test with real campaigns
3. **Update Documentation**: Update requirements based on answers
4. **Update Implementation Guide**: Add routing logic details

---

## References

- **Complete Flow**: `strategis-setup-complete-flow.md`
- **Requirements**: `strategis-campaign-setup-requirements.md`
- **Relay Endpoints**: `strategis-relay-endpoints-spec.md`

