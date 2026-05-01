## 05 — Setup (Meta)

> This is intentionally “template-first”. Fill the TBDs once the offer/LP is finalized.

### Identity

- **Meta ad account**: tech advance daily - 1 (1516449125656850) (if this is the correct health account; otherwise update)
- **Campaign name**: `<strategisId>_YYYYMMDD_AtHomeBloodTest_US_Facebook_Edge`
- **Strategis ID**: TBD (prefix id)
- **Buyer**: Edge
- **Knowledge warehouse / site**: TBD

### Objective + template

- **Template**: CBO Conversions (Default)
- **Objective**: Conversions (Purchase / Value if available)
- **Optimization event**: Purchase (Value) preferred; otherwise Purchase
- **Bid strategy**: Lowest cost (no cap initially)

### Structure (launch)

- **Campaigns**: 1 (one category per campaign)
- **Ad sets**: 3 (broad, broad+advantage placements, “mid-broad” interest stack if needed)
- **Ads per ad set**: 5 (the 5 video ads above), target ≤12, max 15
- **Placements**: Advantage+ placements on at least one ad set
- **Geo / age / devices**: US, 25+ (adjust once offer restrictions known)

### Creative organization (recommended)

- Put all 5 videos into the same “hook set” so results compare cleanly:
  - Ad 1: clarity
  - Ad 2: convenience
  - Ad 3: results explained
  - Ad 4: baseline tracking
  - Ad 5: simplicity

### Links + tracking

- **Primary URL**: TBD
- **UTM pattern**:
  - `utm_source=facebook&utm_medium=cpc&utm_campaign=<campaign_slug>&utm_content=<ad_name>&utm_term=<angle>&utm_lpid=<lpid>`
- **QA**:
  - link loads
  - pixel/CAPI fires (if applicable)
  - disclaimer visible on LP

### Launch plan

- **Status at creation**: paused
- **Go-live**: TBD
- **Freeze window**: 48–72h (no edits unless emergency)
- **Daily review**: `docs/edge/daily-review.md`

### Measurement focus (first 72h)

- **Fast signals** (creative loop):
  - CTR / thumbstop proxy (3s views / hold rate)
  - LP click → view → CTA click
- **Economic truth** (delayed):
  - Revenue vs spend (ROAS / Session ROAS / vRPS vs CPS)

