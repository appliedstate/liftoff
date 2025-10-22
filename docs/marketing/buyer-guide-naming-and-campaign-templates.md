## Attention Engine Buyer Guide: Naming Conventions and Campaign Templates

### Audience
Media buyers and strategists. This guide defines cross-platform naming conventions and Facebook-first launch templates (structure, counts, budgets, bids) that Strategis will automate. Use this to review and propose corrections.

### Goals
- Provide consistent, machine-readable naming for all media objects.
- Standardize initial structures (campaigns/ad sets/ads) and budget/bid defaults.
- Enable automation in Strategis while preserving buyer control via templates.

### Cross-Platform Naming Conventions
Applies to Facebook at launch; extendable to other platforms (Google, TikTok, etc.). Use "|" as delimiter and avoid commas.

- Campaign name
  - `{Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {YYYY-MM-DD}`
  - Example: `BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22`

- Ad Set (or equivalent) name
  - `{AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType=CBO|ABO} | v{N}`
  - Example: `ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1`

- Ad (creative variant) name
  - `{CreativeType=IMG|VID} | {HookId} | {Variant} | {Format=1x1|4x5|9x16} | {Lang}`
  - Example: `VID | H123 | A | 4x5 | EN`

Notes
- `{HookSet}` is the internal Attention Engine run identifier (e.g., `hookset_{theme}_{date}`) for traceability.
- `{PlacementKey}` is a shorthand mapping (e.g., `advplus_all_auto`), resolved per platform.
- `v{N}` increments when material changes are made (targeting or optimization change).

### Facebook Templates (Launch Defaults)
These templates are starting points. Buyers may edit per account.

#### Template A: CBO Conversions (Default)
- Campaign
  - Objective: `CONVERSIONS`
  - Buying: `AUCTION`
  - Special Ad Categories: `NONE` (or set as required)
  - Status: `PAUSED` at creation
  - CBO: enabled
  - Budget: Daily `50,000,000` micros ($50/day) [adjust per account]
- Ad Sets (2–6 to start, ≤ 200 max per campaign)
  - Optimization Goal: `OFFSITE_CONVERSIONS`
  - Billing Event: `IMPRESSIONS`
  - Promoted Object: `pixel_id`, `custom_event_type=PURCHASE`
  - Targeting: platform placements auto; age/geos per market
  - Start Time: next hour UTC
  - Bid Strategy: `LOWEST_COST_WITHOUT_CAP` (no cap initially)
- Ads (2–6 per ad set)
  - Status: `PAUSED`
  - Creative: video preferred; link to offer page with UTM params

#### Template B: CBO Lead Gen
- Objective: `LEAD_GENERATION`
- Ad Set Optimization Goal: `LEAD_GENERATION` or `LINK_CLICKS` to form flow
- Requires page permission and lead forms as applicable

#### Template C: ABO Testing (When needed)
- Campaign: CBO disabled
- Ad Set: individual daily budgets (start $20–$100/day)
- Use when isolating budgets for audience tests

### Structure & Counts Guidance
- Campaigns: organize by single objective and hook set per market.
- Ad Sets per campaign: start 2–6; expand based on spend/performance; hard cap 200.
- Ads per ad set: 2–6 active variants; archive underperformers; keep ≤ 10 total.

### Budget & Bid Defaults
- CBO Daily Budget Tiers: $50, $100, $250, $500 (convert to micros for API).
- ABO Daily Budgets: set per ad set at same tiers.
- Bid Strategy Defaults
  - Conversions: `LOWEST_COST_WITHOUT_CAP` first; add bid caps only if CPA volatility or pacing mandates.
  - Lead Gen/Traffic/Video Views: lowest cost.
- Bid Caps
  - Use `LOWEST_COST_WITH_BID_CAP` only when necessary; start cap ~1.2–1.5× target CPA and tune.

### Platform-Specific Notes (Facebook)
- Special Ad Categories required on creation/edit. Use `["NONE"]` otherwise.
- Conversions objective requires `pixel_id` and `custom_event_type` at ad set.
- Respect ≤ 200 ad sets per campaign limitation.

### Operational Practices
- Naming: must follow the templates verbatim (delimiters, order, casing).
- Versioning: bump `v{N}` when targeting/optimization materially changes.
- Status at Creation: default `PAUSED`; buyers review, then enable.
- Idempotency: if a request is retried, names and IDs should remain consistent.

### What Buyers Provide to Strategis
- Ad account ID (`act_*`), market, objective, special ad categories.
- Audience keys (or direct IDs), placement preferences.
- Pixel ID and conversion event if conversions objective.
- Creative assets (IDs), page ID, CTA and URL(s).
- Template selection (A/B/C) and budget tier.

### Review Checklist for Buyers
- Campaign name adheres to `{Brand} | {Objective} | {HookSet} | {Market} | FB | {Date}`.
- Ad set names and counts align with selected template and audience plan.
- Budgets (CBO/ABO) at expected tier; bid strategy as intended.
- Conversions setups have correct `pixel_id` and event.
- Ads have correct variants and UTMs.

### Change Log & Feedback
- Please annotate corrections inline and propose additional templates (e.g., Advantage+ Shopping, Video Views). Submit via PR to `docs/marketing/buyer-guide-naming-and-campaign-templates.md`.


