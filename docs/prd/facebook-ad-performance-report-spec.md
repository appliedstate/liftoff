# Facebook Ad Performance Report — Product Spec

## Document Purpose
Engineer-ready spec for shipping a reliable ad-level Facebook performance report using existing data paths, with a phased plan for caching and creative enrichment.

**Status**: READY FOR IMPLEMENTATION  
**Owner**: Liftoff Engineering + Marketing Ops  
**Version**: 1.0 (2026-03-03)

---

## 1) Problem Statement

Teams need a single report surface for Facebook performance that supports:
- Live ad-level diagnostics (today's pacing, underperformers, budget actions)
- Fast historical analysis (trendlines, grouped rollups, BI usage)
- Creative-level insight (which ad copy/image/video is driving outcomes)

The platform already has three functioning data paths. The gap is not infrastructure; it is productization, parameter defaults, scheduler usage at ad level, and creative enrichment.

---

## 2) Goals and Non-Goals

### Goals
- Provide a standard ad performance report contract for product and ops.
- Use existing live insights path for immediate ad-level reporting.
- Ensure historical ad-level storage is scheduled and queryable.
- Add creative metadata enrichment to ad performance rows.
- Preserve existing buyer permission filtering and Strategis enrichment.

### Non-Goals
- Rebuild Facebook ingestion architecture.
- Introduce new storage systems beyond existing ClickHouse/LevelDB usage.
- Replace existing campaign structure metadata flow.

---

## 3) Existing System Baseline (Already Built)

### Path 1: Live FB Insights API (real-time, flexible granularity)
- **Endpoint**: `GET /api/facebook/report`
- **Flow**: `lib/api/facebook.js:getReport()` -> `lib/services/facebook.js:getReport()`
- **Capabilities already present**:
  - `level=campaign|adset|ad` (ad-level already supported)
  - Custom `fields` support
  - `breakdown` support (hourly/age/gender/country, etc.)
  - Iterates all ad accounts for an org
  - Strategis lookups appended (buyer/domain/category/rsocSite)
  - Buyer permission + ad-source filtering applied

### Path 2: ClickHouse Cached Insights (historical)
- **Store endpoint**: `GET /api/facebook/store-campaign-insight-report`
- **Read endpoint**: `GET /api/facebook/report?cached=true`
- **Table**: `facebookInsightReport`
- **Capabilities already present**:
  - Store function can ingest at multiple levels
  - Read path applies same enrichment + permission filtering behavior

### Path 3: Ad Metadata Snapshot (structure/config, not performance)
- **Store endpoint**: `GET /api/facebook/store-campaigns-data`
- **Read endpoint**: `GET /api/facebook/campaigns-data-report`
- **Flow**: `storeCampaignsData()` in `lib/models/reports/facebook.js`
- **Capabilities already present**:
  - Pulls all ads across accounts with bid/budget/campaign/adset metadata
  - Persists current-state structural data to LevelDB

### Confirmed Gap
- Creative details are not currently joined into performance output by default.
- Needed: creative metadata fields such as title/body/image/thumbnail (or equivalent payload fields), joined to ad-level performance rows.

---

## 4) Product Requirements

### PR-1: Live Ad Performance Report (MVP)
- Report must support ad-level via existing endpoint:
  - `GET /api/facebook/report?organization=<org>&dateStart=<YYYY-MM-DD>&dateEnd=<YYYY-MM-DD>&level=ad`
- Must include existing enrichment fields and permission filtering.
- Must return stable schema for downstream UI/export tooling.
- Must support optional breakdown parameters without breaking base schema.

### PR-2: Historical Ad-Level Cache (Performance/Scale)
- Scheduler/cron must execute store insights at `level=ad`.
- Stored rows must be queryable through existing cached read path.
- Freshness SLA target:
  - Nearline historical: available within 1-2 hours of scheduled run.
- Backfill capability required for specified date windows.

### PR-3: Creative Enrichment (Phase 2)
- Performance rows at `level=ad` must include creative metadata fields (when available).
- Join failures must be non-fatal; row still returned with null creative fields.
- Creative enrichment should be available on live and cached reads.

### PR-4: Operational Reliability
- Preserve current permission model and org-level account aggregation.
- Add instrumentation for:
  - ingestion runtime
  - rows fetched/stored
  - creative join hit rate
  - API/cache error rates

---

## 5) User Stories

- As a buyer, I can pull ad-level performance for a date range and quickly identify winners/losers.
- As an analyst, I can query historical ad-level data quickly without waiting on live FB calls.
- As a creative strategist, I can see performance side-by-side with creative metadata.
- As an admin, I can trust that users only see rows permitted by buyer/org access rules.

---

## 6) API Contract (Target Behavior)

### 6.1 Live report request
`GET /api/facebook/report?organization=Interlincx&dateStart=2026-03-01&dateEnd=2026-03-03&level=ad`

### 6.2 Cached report request
`GET /api/facebook/report?organization=Interlincx&dateStart=2026-03-01&dateEnd=2026-03-03&level=ad&cached=true`

### 6.3 Response shape (normalized)
```json
{
  "rows": [
    {
      "date": "2026-03-02",
      "account_id": "act_123",
      "campaign_id": "120...",
      "campaign_name": "Campaign A",
      "adset_id": "120...",
      "adset_name": "Adset A",
      "ad_id": "120...",
      "ad_name": "Ad A",
      "impressions": 12034,
      "reach": 10321,
      "clicks": 243,
      "spend": 456.78,
      "ctr": 2.02,
      "cpm": 37.96,
      "cpc": 1.88,
      "conversions": 17,
      "actions": [],
      "buyer": "buyer_1",
      "domain": "example.com",
      "category": "home_services",
      "rsocSite": "site_abc",
      "creative_id": "987...",
      "creative_title": "Creative headline",
      "creative_body": "Creative body copy",
      "creative_image_url": "https://...",
      "creative_thumbnail_url": "https://..."
    }
  ],
  "meta": {
    "source": "live|cached",
    "level": "ad",
    "organization": "Interlincx",
    "dateStart": "2026-03-01",
    "dateEnd": "2026-03-03"
  }
}
```

Notes:
- `creative_*` fields are nullable and populated in Phase 2.
- Existing response envelope can be retained if consumers rely on it; this shape is the target normalized contract for new consumers.

---

## 7) Data & Storage Requirements

### Live Path
- Source of truth for on-demand and near-real-time views.
- Uses FB Insights API directly at requested level.

### Cached Path (ClickHouse)
- Scheduler runs at least hourly for active orgs at `level=ad`.
- Retention recommendation:
  - Raw rows: 90 days minimum
  - Aggregated/rollups: optional, based on query latency targets
- Idempotency requirement for store jobs to avoid duplicate inserts for same org/date/level/account partition.

### Campaign Metadata Path (LevelDB)
- Continue storing structural bid/budget metadata.
- Optional future enhancement: join selected structural fields into report output for optimization context.

---

## 8) Functional Acceptance Criteria

### AC-1 (Live ad-level)
- Given valid org/date range and `level=ad`, endpoint returns ad rows across all org ad accounts.
- Strategis enrichment fields exist for rows with matching lookup data.
- Unauthorized buyer rows are filtered out.

### AC-2 (Cached ad-level)
- Scheduled store job writes ad-level rows for target date windows.
- Cached reads return materially equivalent metrics to live reads for the same window (within expected FB API timing variance).

### AC-3 (Creative enrichment)
- For rows where creative data is available, creative fields are populated.
- For rows without creative data, rows still return with creative fields set to null.

### AC-4 (Reliability)
- Error rate and latency metrics are emitted for live and cached reads.
- Job logs include per-org row counts and completion status.

---

## 9) Rollout Plan

### Phase 0: Contract Alignment (1-2 days)
- Freeze response field contract for ad-level report consumers.
- Confirm required default fields and optional fields list.

### Phase 1: Productize Existing Live Path (2-3 days)
- Set/report documented default query parameters for ad-level use.
- Add docs and examples for operational users.
- Validate buyer permission filtering with test users.

### Phase 2: Schedule Cached Ad-Level Storage (2-4 days)
- Update scheduler to call store insights with `level=ad`.
- Add backfill command/runbook for historical date ranges.
- Add data quality checks (row count drift and null-rate checks).

### Phase 3: Creative Enrichment (3-5 days)
- Add creative field retrieval/join in ad-level path.
- Extend cached storage schema/query to persist creative fields.
- Add null-safe behavior and join observability.

---

## 10) Observability & Alerting

- Metrics:
  - `facebook_report_live_latency_ms` (p50/p95)
  - `facebook_report_cached_latency_ms` (p50/p95)
  - `facebook_store_insights_rows_written`
  - `facebook_store_insights_job_failures`
  - `facebook_creative_join_hit_rate`
- Alerts:
  - store job failure > 2 consecutive runs
  - creative join hit rate drops > 30% day-over-day
  - cached row count drift > 20% vs trailing 7-day baseline

---

## 11) Risks and Mitigations

- FB API rate limiting during live high-volume queries  
  - Mitigation: favor cached path for large historical requests; add throttling and retries.
- Creative field inconsistency across ad types  
  - Mitigation: nullable schema + safe field mapping by creative type.
- Permission regressions due to new joins  
  - Mitigation: keep permission filtering after enrichment stage and add regression tests.

---

## 12) Open Questions

- Should creative enrichment be enabled by default or behind `includeCreative=true` initially?
- What exact retention window is required for raw ad-level cached rows?
- Which downstream UI/export consumers require strict backward compatibility on response envelope?

---

## 13) Engineering Task Breakdown

1. Confirm canonical ad-level response schema and document field dictionary.
2. Ensure scheduler invokes store insights with `level=ad`.
3. Add/verify backfill CLI or script for ad-level historical ingestion.
4. Add creative enrichment in live report path.
5. Extend cache write/read path for creative fields.
6. Add tests:
   - unit: schema mapping and null-safe creative joins
   - integration: live vs cached parity checks
   - auth: buyer filtering regression tests
7. Add dashboards/alerts for ingestion and report health.

---

## 14) Definition of Done

- Ad-level report works in live and cached modes with documented contract.
- Scheduler continuously stores ad-level insights in ClickHouse.
- Creative fields are available in report rows (nullable-safe).
- Permission filtering and Strategis enrichment are validated by automated tests.
- Runbook exists for backfill, incident response, and metric interpretation.

