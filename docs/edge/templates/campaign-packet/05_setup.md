## 05 — Setup

Use this as a "dupe-and-patch" checklist. Most fields should be inherited from a known-good campaign, then patched with new Strategis/factory values.

---

## 1) Inputs and source of truth

### Required inputs before touching Ads Manager

- **Source campaign ID to duplicate**: <existing winner / stable baseline>
- **Strategis campaign ID**: <new id from Strategis duplicate>
- **Buyer initials suffix**: <BH / PH / ...>
- **Factory row**: <sheet row id>
- **Category + CategorySlug**: <human + machine>
- **RSOC site/domain**: <e.g. secretprice.com>
- **Article URL**: <full URL>
- **Headline seed**: <from Strategis `headline`>
- **Keyword set**: <forcekeyA-H>

### Field mapping (for automation later)

- **From Strategis**: buyer, rsocSite, article slug/url, headline, forcekeyA-H, campaign category, redirect domain
- **From factory sheet**: category, market/language/device, notes, article URL, optional source campaign to dupe
- **Inherited from duplicated FB campaign**: page/IG identity, pixel binding, placements style, account-level defaults, many enhancement toggles
- **Manual verify each launch**: objective, conversion location, conversion event, budget/schedule, URL params, special ad category

---

## 2) Facebook campaign-level setup (observed baseline from Ben)

Mark each field as `INHERIT` or `PATCH`.

- **Campaign name**: `PATCH`
  - Pattern currently observed: `<strategisId>_<MMDD>_<CategoryToken>_FB_SBU_<Initials>`
  - Naming token glossary:
    - `FB` = Facebook
    - `SBU` = SpottedByUs site/domain family
    - `<Initials>` = buyer initials (example: `BH` for Ben Holley)
- **Buying type**: `INHERIT` = Auction
- **Campaign objective**: `VERIFY` (observed = Leads)
- **Budget strategy**: `VERIFY` (observed = Ad set budget, not campaign budget/CBO)
- **A/B test**: `INHERIT` (observed Off)
- **Special Ad Categories**: `VERIFY` (observed none selected)

---

## 3) Ad set-level setup (observed baseline from Ben)

- **Conversion location**: `VERIFY`
  - Observed option selected in screenshot: Website and instant forms
- **Performance goal**: `VERIFY`
  - Observed wording references maximizing number of conversions/leads
- **Dataset (pixel)**: `INHERIT + VERIFY`
  - Observed: Nautilus RSOC S1 Pixel
- **Conversion event**: `VERIFY`
  - Observed: Lead
- **Attribution model**: `INHERIT + VERIFY`
  - Observed: Standard
- **Dynamic creative**: `INHERIT` (observed Off)
- **Budget and schedule**: `PATCH`
  - Daily budget per ad set
  - Start date/time for this launch
  - End date (usually none unless explicitly required)
- **Audience**: `INHERIT + VERIFY`
- **Placements**: `INHERIT + VERIFY`
- **Ad transparency**: `INHERIT`

---

## 4) Ad-level setup (using one ad as current framework)

- **Ad identity (Page / IG / Threads)**: `INHERIT + VERIFY`
- **Creative source**: `INHERIT`
  - Observed: Manual upload
- **Format**: `INHERIT`
  - Observed: Single image or video
- **Destination type**: `VERIFY`
  - Observed: Website
- **Website URL**: `PATCH`
  - Use final route based on Strategis redirect output
- **Display link**: `AUTO/VERIFY`
- **Browser add-ons**: `INHERIT`
  - Observed: None
- **Primary text**: `PATCH`
- **Headline**: `PATCH` (from Strategis headline seed, then final FB copy)
- **Description**: `PATCH/optional`
- **CTA**: `VERIFY`
  - Observed: Learn more
- **Creative enhancements**: `INHERIT + VERIFY`
  - Observed: site links off; multiple Advantage+ enhancements on
- **Languages**: `VERIFY`
  - Observed: Off
- **Tracking section**: `PATCH + VERIFY`
  - Website events on
  - Confirm pixel id
  - URL parameters populated

---

## 5) Tracking + URL parameters (must confirm every launch)

- **Final destination URL works**
  - no redirect loops
  - article loads on mobile
- **Tracking params**
  - Campaign/adset/ad macros present
  - Strategis link and FB link resolve to expected article/domain
- **Pixel fires for expected event path**
  - at minimum pageview and lead funnel event behavior is sane

---

## 6) Human SOP (dupe-and-patch)

1. Duplicate the approved baseline campaign in Strategis and obtain new Strategis ID.
2. In Strategis, patch buyer/site/article/headline/forcekeys and save.
3. Open duplicated campaign in Ads Manager.
4. Patch campaign name and confirm objective + budget strategy.
5. Patch ad set budget/schedule and confirm conversion location/event + pixel.
6. Patch ad destination URL, ad text/headline/creative where needed.
7. Confirm URL params in Tracking.
8. QA preview for all placements in use.
9. Keep campaign/ad sets/ads paused until QA sign-off.
10. Record launch notes and IDs back into campaign packet + queue tracker.

---

## 7) Launch plan

- **Status at creation**: paused
- **Go-live**: <timestamp>
- **Freeze window**: 48–72h (no edits unless tracking/emergency)
- **Daily review**: `docs/edge/daily-review.md`

---

## 8) Notes

- One ad was used to infer this framework. Validate any settings that might vary by objective/account before hard automation.
- <anything unusual about this setup>

