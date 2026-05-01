# Facebook Ad Inventory and Cleanup Spec

## Document Purpose
Engineer-ready spec for building a reliable Facebook ad inventory and cleanup system so buyers and ops can answer:
- how many campaigns/ad sets/ads a buyer is running
- which ad accounts they are running in
- how many ads are active, paused, disapproved, or otherwise stale
- how many ads have zero spend and zero revenue over 1d, 3d, 7d, and 30d
- which ads should be reviewed, paused, archived, or deleted

**Status**: READY FOR IMPLEMENTATION  
**Owner**: Liftoff Engineering + Marketing Ops  
**Version**: 1.0 (2026-04-27)

---

## 1) Problem Statement

The current monitoring system can answer campaign-level questions well, but it is not the right source of truth for ad inventory cleanup.

What exists today:
- `campaign_index` in DuckDB merges campaign and ad set level data from many sources.
- Facebook graph/export scripts can enumerate actual ads and statuses.
- The system can already fetch ad-level performance through the Facebook report path.

What is missing:
- a persisted daily ad inventory table keyed by `ad_id`
- a persisted daily ad performance table keyed by `ad_id`
- a standard definition of when an ad “exists on radar”
- a standard classification system for stale, dead, orphaned, and underperforming ads

Because of that gap, operations can see spend-qualified campaign activity, but cannot reliably answer:
- how many zero-spend ads exist
- how many never-delivered ads still exist
- how many active ads have no delivery
- how many paused ads are just old clutter

---

## 2) First-Principles Model

The system must separate these concepts:

- `Ad existence`: the ad is returned by Facebook inventory endpoints.
- `Ad delivery`: the ad received impressions/clicks/spend.
- `Ad monetization`: the ad generated downstream revenue.
- `Ad operability`: the ad is actionable by ops because we know its status, account, buyer, and performance window.

From first principles:
- an ad should count as existing even if it has zero spend and zero revenue
- spend or revenue should not be required for the ad to appear in our system
- inventory and performance should be stored separately and joined later
- cleanup decisions should be based on both `status` and `recent delivery`

This means:
- `/api/facebook/ads` is the source of truth for `what exists`
- `/api/facebook/report?level=ad` is the source of truth for `what delivered`

---

## 3) Existing System Baseline

### Already built

- Ad inventory enumeration:
  - [exportFacebookCampaignGraph.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/exportFacebookCampaignGraph.ts)
  - [fetchFacebookCampaignExport.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/fetchFacebookCampaignExport.ts)
- Ad-level status fields already available in the inventory layer:
  - `status`
  - `effective_status`
  - `campaign_id`
  - `adset_id`
  - `account_id`
  - creative metadata
- Ad-level reporting path already exists:
  - `GET /api/facebook/report?level=ad`
  - documented in [facebook-ad-performance-report-spec.md](/Users/ericroach/code/liftoff/docs/prd/facebook-ad-performance-report-spec.md)

### Important limitation of current monitoring DB

The current `campaign_index` system is not sufficient for ad cleanup because:
- it persists campaign/ad set level rows, not ad-level inventory rows
- a campaign can appear on radar without enumerating all ads beneath it
- spend-qualified graph views intentionally exclude many zero-spend entities

Reference:
- [data-architecture.md](/Users/ericroach/code/liftoff/docs/monitoring/data-architecture.md)

---

## 4) Goals and Non-Goals

### Goals

- Persist a complete daily Facebook ad inventory snapshot for the organization.
- Persist ad-level daily performance windows.
- Enable buyer/account/campaign/ad-level cleanup reporting.
- Enable zero-spend and zero-revenue analysis over rolling windows.
- Make it easy to answer questions like:
  - “How many ads is Ben running?”
  - “Which accounts are they in?”
  - “How many of those ads are active but idle?”
  - “How many have zero spend and zero revenue in the last 3 days?”

### Non-Goals

- Automatically delete ads in phase 1.
- Rebuild Strategis auth or Facebook reporting architecture from scratch.
- Replace `campaign_index` as the campaign-level merged system.
- Guarantee true Meta Business Manager IDs if the source APIs only expose ad accounts.

---

## 5) Definition of “Ad Exists”

An ad exists in Liftoff’s operational system if:
- it is returned by `/api/facebook/ads` for the organization, or
- it is returned by the campaign export endpoint and has a stable `ad_id`

An ad does **not** need:
- spend
- revenue
- impressions
- clicks

to qualify as existing.

This definition is the foundation for stale-ad cleanup.

---

## 6) Proposed Data Model

Use the existing DuckDB monitoring database and add two Facebook-specific tables.

### 6.1 `facebook_ad_inventory_daily`

One row per:
- `(snapshot_date, organization, ad_id)`

Purpose:
- the durable source of truth for whether an ad existed on a given day

Suggested schema:

```sql
CREATE TABLE facebook_ad_inventory_daily (
  snapshot_date DATE,
  organization TEXT,
  ad_account_id TEXT,
  business_manager_id TEXT,
  buyer TEXT,
  strategis_campaign_id TEXT,
  facebook_campaign_id TEXT,
  facebook_campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  status TEXT,
  effective_status TEXT,
  campaign_status TEXT,
  campaign_effective_status TEXT,
  adset_status TEXT,
  adset_effective_status TEXT,
  page_id TEXT,
  page_name TEXT,
  rsoc_site TEXT,
  category TEXT,
  creative_id TEXT,
  effective_object_story_id TEXT,
  route_url TEXT,
  headline TEXT,
  body TEXT,
  created_time TIMESTAMP,
  updated_time TIMESTAMP,
  last_seen_at TIMESTAMP,
  source_run_id TEXT,
  raw_json JSON
);
```

Notes:
- `business_manager_id` is optional. If Strategis/Facebook does not expose it, leave null and operate at `ad_account_id`.
- `raw_json` is useful for audit/debug without repeatedly widening the schema.

### 6.2 `facebook_ad_performance_daily`

One row per:
- `(date, organization, ad_id)`

Purpose:
- ad-level delivery and monetization facts

Suggested schema:

```sql
CREATE TABLE facebook_ad_performance_daily (
  date DATE,
  organization TEXT,
  ad_account_id TEXT,
  buyer TEXT,
  strategis_campaign_id TEXT,
  facebook_campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  impressions BIGINT,
  reach BIGINT,
  clicks BIGINT,
  spend_usd DOUBLE,
  ctr DOUBLE,
  cpc DOUBLE,
  cpm DOUBLE,
  conversions DOUBLE,
  sessions BIGINT,
  revenue_usd DOUBLE,
  rpc DOUBLE,
  rsoc_site TEXT,
  category TEXT,
  source_run_id TEXT,
  raw_json JSON
);
```

### 6.3 `facebook_ad_inventory_rollup`

Optional materialized table or view for fast ops reads.

One row per:
- latest known `ad_id`

Purpose:
- join latest inventory state with recent 1d/3d/7d/30d windows

Suggested fields:
- latest inventory columns
- `spend_1d`, `spend_3d`, `spend_7d`, `spend_30d`
- `revenue_1d`, `revenue_3d`, `revenue_7d`, `revenue_30d`
- `impressions_1d`, `impressions_3d`, `impressions_7d`, `impressions_30d`
- `clicks_1d`, `clicks_3d`, `clicks_7d`, `clicks_30d`
- cleanup classification

---

## 7) Ingestion Design

### Job A: Full Ad Inventory Snapshot

Purpose:
- capture all existing ads, regardless of spend

Source endpoints:
- primary: `/api/facebook/ads`
- optional enrichment: `/api/facebook/adsets`
- optional fallback/enrichment: campaign export endpoint used by [fetchFacebookCampaignExport.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/fetchFacebookCampaignExport.ts)

Required behavior:
- do not apply spend threshold
- do not filter to only running ads
- fetch all ads visible to the org token
- persist `status` and `effective_status`
- join buyer/site/category metadata where available
- upsert by `(snapshot_date, organization, ad_id)`

Recommended cadence:
- daily mandatory
- hourly optional for high-touch ops usage

### Job B: Ad-Level Performance Snapshot

Purpose:
- capture ad-level delivery and revenue facts

Source endpoint:
- `/api/facebook/report?level=ad`

Required behavior:
- store at least daily rows
- preserve account/campaign/adset/ad join keys
- bring in Strategis enrichment fields already available in the report path

Recommended cadence:
- daily mandatory
- hourly optional if same-day pacing matters operationally

### Job C: Daily Rollup Builder

Purpose:
- build the latest ops-ready cleanup view

Behavior:
- choose latest inventory row per `ad_id`
- aggregate performance windows for 1d, 3d, 7d, 30d
- assign cleanup classifications

---

## 8) Cleanup Classifications

Every latest ad row should be assigned one primary cleanup classification.

### `active_delivering`
- `effective_status = ACTIVE`
- and `impressions_3d > 0` or `spend_3d > 0`

### `active_idle`
- `effective_status = ACTIVE`
- and `impressions_3d = 0`
- and `spend_3d = 0`

This is the highest-priority cleanup bucket because the ad is live in principle but not actually delivering.

### `paused_recent`
- effective status not active
- but had spend or impressions within the last 7 days

### `paused_stale`
- effective status not active
- and `spend_30d = 0`
- and `revenue_30d = 0`

### `never_delivered`
- ad exists in inventory
- and lifetime observed spend across retention window is zero
- and lifetime observed impressions across retention window is zero

### `spent_no_revenue`
- `spend_3d > 0` or `spend_7d > 0`
- and matching revenue window equals zero

### `with_issues`
- `effective_status = WITH_ISSUES`

### `disapproved`
- `effective_status = DISAPPROVED`

### `orphaned_mapping`
- ad exists
- but buyer, site, or campaign mapping is missing

---

## 9) Required Ops Queries

The system must support these operational reads directly.

### 9.1 Buyer summary

Example questions:
- how many campaigns is Ben running?
- how many ad sets?
- how many ads?
- which ad accounts?

```sql
SELECT
  buyer,
  COUNT(DISTINCT facebook_campaign_id) AS campaigns,
  COUNT(DISTINCT adset_id) AS adsets,
  COUNT(DISTINCT ad_id) AS ads,
  COUNT(DISTINCT ad_account_id) AS ad_accounts
FROM facebook_ad_inventory_rollup
WHERE buyer = 'ben'
GROUP BY buyer;
```

### 9.2 Buyer account breakdown

```sql
SELECT
  buyer,
  ad_account_id,
  COUNT(DISTINCT facebook_campaign_id) AS campaigns,
  COUNT(DISTINCT ad_id) AS ads,
  SUM(spend_3d) AS spend_3d,
  SUM(revenue_3d) AS revenue_3d
FROM facebook_ad_inventory_rollup
WHERE buyer = 'ben'
GROUP BY buyer, ad_account_id
ORDER BY ads DESC;
```

### 9.3 Zero-spend, zero-revenue ads

```sql
SELECT
  buyer,
  COUNT(*) AS zero_spend_zero_revenue_ads
FROM facebook_ad_inventory_rollup
WHERE spend_3d = 0
  AND revenue_3d = 0
GROUP BY buyer
ORDER BY zero_spend_zero_revenue_ads DESC;
```

### 9.4 Active but idle ads

```sql
SELECT
  buyer,
  ad_account_id,
  COUNT(*) AS active_idle_ads
FROM facebook_ad_inventory_rollup
WHERE effective_status = 'ACTIVE'
  AND spend_3d = 0
  AND impressions_3d = 0
GROUP BY buyer, ad_account_id
ORDER BY active_idle_ads DESC;
```

### 9.5 Deletion candidates

```sql
SELECT
  buyer,
  ad_account_id,
  ad_id,
  ad_name,
  effective_status,
  cleanup_classification
FROM facebook_ad_inventory_rollup
WHERE cleanup_classification IN ('paused_stale', 'never_delivered', 'active_idle')
ORDER BY buyer, ad_account_id, ad_id;
```

---

## 10) API / CLI Surface

Phase 1 does not require UI first. A CLI + DB-backed report is sufficient.

### Recommended scripts

- `monitor:facebook-ad-inventory:snapshot`
  - fetch full ad inventory and store `facebook_ad_inventory_daily`
- `monitor:facebook-ad-performance:snapshot`
  - fetch ad-level daily report and store `facebook_ad_performance_daily`
- `monitor:facebook-ad-inventory:rollup`
  - build or refresh latest rollup table/view
- `monitor:facebook-ad-inventory:report`
  - emit buyer/account cleanup summaries

### Recommended report inputs

- `--organization`
- `--date`
- `--buyer`
- `--ad-account-id`
- `--window=1|3|7|30`
- `--classification=active_idle|paused_stale|never_delivered|spent_no_revenue`

---

## 11) Acceptance Criteria

### AC-1 Inventory completeness
- A daily run stores one row per visible Facebook ad for the org.
- Ads with zero spend still appear in inventory output.

### AC-2 Performance completeness
- A daily run stores ad-level performance rows keyed by `ad_id`.
- Spend and revenue windows can be aggregated for 1d, 3d, 7d, and 30d.

### AC-3 Joinability
- Latest inventory rows can be joined to recent performance rows by `ad_id`.
- Buyer/account/campaign/adset filters all work for the joined view.

### AC-4 Ops usefulness
- The system can answer, for any buyer:
  - campaign count
  - ad set count
  - ad count
  - ad account count
  - zero-spend/zero-revenue ad count over 3d
  - active-idle ad count over 3d

### AC-5 Classification correctness
- Ads are assigned exactly one primary cleanup classification in the rollup.
- `ACTIVE + zero spend + zero impressions over 3d` must land in `active_idle`.

---

## 12) Observability

Track:
- inventory rows fetched
- performance rows fetched
- inventory upsert rows written
- performance upsert rows written
- ads with missing buyer mapping
- ads with missing ad account
- ads with missing campaign mapping
- job runtime
- auth failure rate
- row-count drift day over day

Recommended alerts:
- inventory snapshot row count drops > 20% day-over-day
- performance snapshot row count drops > 20% day-over-day
- auth/login failure for 2 consecutive runs

---

## 13) Risks and Mitigations

### Risk: auth instability
- Current live export can fail at IX-ID login.
- Mitigation:
  - support bearer-token auth when available
  - persist last successful snapshot
  - emit explicit freshness metadata

### Risk: ad-level revenue sparsity or attribution mismatch
- Some ad-level revenue may lag or be partially attributed.
- Mitigation:
  - store both spend and revenue windows
  - allow `spent_no_revenue` to be diagnostic, not auto-delete

### Risk: business manager visibility
- Current data paths reliably expose `ad_account_id`, not necessarily Business Manager ID.
- Mitigation:
  - make `business_manager_id` nullable
  - treat `ad_account_id` as the primary operational container

### Risk: accidental deletion of reusable paused ads
- Buyers may intentionally keep paused variants.
- Mitigation:
  - phase 1 is report-only
  - deletion/export actions require explicit operator review

---

## 14) Rollout Plan

### Phase 0: Schema + one-day spike
- Create the two tables.
- Run one manual snapshot for one org.
- Verify zero-spend ads appear in inventory.

### Phase 1: Daily scheduled snapshots
- Schedule inventory snapshot daily.
- Schedule performance snapshot daily.
- Build latest rollup view.

### Phase 2: Buyer/account cleanup reports
- Add CLI summaries by buyer and account.
- Add deletion-candidate reports.

### Phase 3: UI / workflow integration
- Expose cleanup buckets in ops UI if needed.
- Add export to CSV.
- Add optional pause/archive actions later.

---

## 15) Engineering Recommendation

Do not try to solve this inside `campaign_index`.

That table is still valuable for merged campaign analytics, but stale-ad cleanup is a different problem:
- it needs ad-level existence
- it needs zero-spend entities
- it needs status-aware lifecycle management

The clean approach is:
- keep `campaign_index` for merged campaign reporting
- add `facebook_ad_inventory_daily`
- add `facebook_ad_performance_daily`
- build `facebook_ad_inventory_rollup`

That gives ops a truthful answer to both:
- “what exists?”
- and “what is actually doing anything?”

