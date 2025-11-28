# Quality Evaluator Testing Guide

## What We've Improved

1. **Stricter Evaluation**: More conservative scoring, especially for YMYL content
2. **AI Detection**: Detects low-value/scaled AI content (aligned with Google's policy)
3. **RSOC Widget Extraction**: Extracts individual keywords from RSOC widgets
4. **Widget Placement Analysis**: Tracks widget position, content before widget, interruption detection
5. **Better YMYL Classification**: Respects `ymyLHint` parameter

## Testing Steps

### 1. Deploy to Server

```bash
# On server
cd /opt/liftoff
git pull origin main
cd backend
npm run build
pkill -f "node dist/index.js" && sleep 2 && npm start
```

### 2. Test with Same URL (Before/After Comparison)

```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "2025 dental implant innovations",
    "url": "https://wesoughtit.com/health/health/2025-dental-implant-innovations-and-trials-en-us/?segment=rsoc.il.wesoughtit.002&s1pcid=sinq1co06h6&fbid=675659217696800&fbland=ViewContent&fbserp=Search&fbclick=Lead&s1paid=864773812063232&s1pplacement=fb--&s1pagid=undefined&s1padid=cmidy7jg908vm0fs66kvj07eg&s1particle=health/2025-dental-implant-innovations-and-trials-en-us&headline=Dental%20Implants%20Near%20Me&utm_source=facebook&forceKeyA=%241500+for+Dental+Implant+Participation&forceKeyB=%241500+for+Dental+Implant+Participations&forceKeyC=%241500+for+Dental+Implants+Trial+Participation+Near+Me&forceKeyD=No+Fee+Dental+Implants&forceKeyE=Get+%241500+for+Dental+Implants+Participation+%5Bsearch+Now%5D&forceKeyF=%241500+for+Dental+Implants+Participation+Now&forceKeyG=%241500+for+Dental+Implant+Participation+Near+Me&impression_track_url=https%3A%2F%2Fr.strateg.is%2Fevent%3Ftype%3Ds1Impression%26subid%3Dsinq1co06h6%26source%3D-%26sessionId%3Dcmidy7jg908vm0fs66kvj07eg&search_track_url=https%3A%2F%2Fr.strateg.is%2Fevent%3Ftype%3Ds1Click%26kw%3DOMKEYWORD%26subid%3Dsinq1co06h6%26source%3D-%26sessionId%3Dcmidy7jg908vm0fs66kvj07eg&click_track_url=https%3A%2F%2Fr.strateg.is%2Fevent%3Ftype%3Dconversion%26kw%3DOMKEYWORD%26subid%3Dsinq1co06h6%26source%3D-%26sessionId%3Dcmidy7jg908vm0fs66kvj07eg",
    "ymyLHint": true,
    "saveForTraining": true
  }' | jq .
```

### 3. What to Check in Results

#### A. Classification
- ✅ `ymyL: true` (should respect your hint)
- ✅ `purpose` and `contentType` are accurate

#### B. RSOC Widget Extraction
Look for in `widgetSummary`:
- ✅ `RSOC widget keywords (X): keyword1, keyword2, ...`
- ✅ Should extract actual keywords from the widget

#### C. Widget Placement
Look for in `widgetSummary`:
- ✅ `First widget: above_fold` or `below_fold`
- ✅ `X words before widget`
- ✅ `INTERRUPTS content` or `does not interrupt content`

#### D. AI Detection
Look for `aiContentDetection` field:
- ✅ `aiLikelihood`: Should show percentage
- ✅ `isScaledContentAbuse`: `true` if low-value AI detected
- ✅ `signals`: Which patterns detected
- ✅ `evidence`: Specific examples

#### E. Scores (Should be Stricter)
Compare to previous evaluation:
- ✅ `needs_met`: Should be lower (was `HighlyMet`, should be `ModeratelyMet` or lower)
- ✅ `page_quality`: Should be lower (was `High`, should be `Low` or lower)
- ✅ `eeat`: Should be lower (was `Moderate`, should be `Weak` or lower)
- ✅ `deception`: Should flag issues (was `None`, should be `High risk` for YMYL without credentials)

### 4. Test Different Scenarios

#### Test 1: Good Content (Should Score Higher)
```bash
# Use a well-written article with author credentials
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "...",
    "url": "https://example.com/good-article",
    "ymyLHint": false
  }'
```

#### Test 2: Thin Content (Should Score Lower)
```bash
# Use a short, thin article
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "...",
    "url": "https://example.com/thin-article",
    "ymyLHint": true
  }'
```

#### Test 3: AI-Generated Content (Should Detect)
```bash
# Use obviously AI-generated content
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "...",
    "url": "https://example.com/ai-article",
    "ymyLHint": false
  }'
```

### 5. Verify Database Logging

Check if evaluations are being saved:

```bash
# On server
psql "$PGVECTOR_URL" -c "SELECT query, url, classification->>'ymyL' as ymyl, dimensions->0->>'score' as first_score, created_at FROM quality_evaluations ORDER BY created_at DESC LIMIT 5;"
```

### 6. Compare Results

Create a comparison table:

| Metric | Before | After | Expected |
|--------|--------|-------|----------|
| YMYL Classification | `false` ❌ | `true` ✅ | Should respect hint |
| Needs Met | `HighlyMet` | `ModeratelyMet` or lower | Stricter |
| Page Quality | `High` | `Low` or lower | Stricter |
| E-E-A-T | `Moderate` | `Weak` or lower | Stricter |
| Deception | `None` | `High risk` | Should flag YMYL without credentials |
| RSOC Keywords | Not extracted | Extracted ✅ | New feature |
| Widget Placement | Not analyzed | Analyzed ✅ | New feature |
| AI Detection | Not detected | Detected ✅ | New feature |

## Expected Improvements

1. **More Accurate Scores**: Should align better with Google's actual penalties
2. **RSOC Keywords**: Should extract actual widget keywords
3. **Widget Placement**: Should detect if widgets interrupt content
4. **AI Detection**: Should flag low-value AI content (15%+ with low-value patterns)
5. **YMYL Handling**: Should properly classify and apply stricter standards

## Troubleshooting

### If RSOC keywords not extracted:
- Check browser console for errors
- Verify widget selectors match your site's structure
- May need to add custom selectors for your RSOC implementation

### If scores still too lenient:
- Check if `ymyLHint` is being respected
- Verify guideline chunks are being retrieved (check `guidelineSections` in response)
- May need to increase `QUALITY_EVAL_CHUNKS_PER_DIMENSION` env var

### If AI detection not working:
- Check `aiContentDetection` field in response
- Verify content length (needs >100 chars)
- May need to adjust thresholds in `aiContentDetector.ts`

