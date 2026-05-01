## 05 — Setup (Meta → Article/LPID)

### Identity

- **Buyer**: Edge
- **Meta ad account**: tech advance daily - 1 (1516449125656850) (update if different)
- **Campaign name template**: `<strategisId>_20260128_AtHomeBloodTest_US_Facebook_Edge`
- **Strategis ID**: TBD (prefix id)
- **Destination**: article (LPID) from `01_category.md`

### Objective + template

- **Template**: CBO Conversions (default)
- **Objective**: Conversions
- **Optimization event**: Landing Page Views for day 0–2 (optional) → Purchase/Value once signal is correct (depends on your stack)
- **Bid strategy**: Lowest cost (no cap)

### Structure (launch)

- **Campaigns**: 1
- **Ad sets**: 2–3
  - Ad set A: Broad + Advantage+ placements
  - Ad set B: Broad (separate) to compare delivery
  - (Optional) Ad set C: “Mid-broad” stack if needed (keep simple)
- **Ads per ad set**: 5 (Videos 1–5)
- **Ad cap**: target ≤12, max 15

### Tracking + naming

- **UTM pattern**:
  - `utm_source=facebook&utm_medium=cpc&utm_campaign=<campaign_slug>&utm_content=<ad_name>&utm_term=<angle>&utm_lpid=<lpid>`
- **On-ad disclosure**: “Not medical advice”
- **Claim map**: complete (see `02_ad_scripts.md`)

### Launch freeze + daily loop

- **Freeze window**: 48–72h (no edits unless emergency)
- **Daily stats**:
  - ingest + report (see `docs/edge/daily-review.md`)
  - log winners/losers into this packet after D3 and D7

