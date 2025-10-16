## AI Oversight Data Access and Scheduling PRD

- Owner: Data/Platform
- Stakeholders: Ops, AI Agents, Infra, Security
- Status: Draft
- Version: 1.0
- Date: 2025-10-16

### 1) Problem Statement
AI oversight requires reliable, timely access to curated reporting data. Today, data exists in a reporting engine but lacks a unified consumption interface for agents and apps, clear refresh cadences, schemas tailored for oversight questions, and operational SLAs.

### 2) Goals
- Provide a stable, versioned, read-only interface to reporting data for both human apps and AI agents.
- Materialize curated, query-efficient tables/views aligned to oversight use cases (facts/dimensions, daily/weekly aggregates).
- Establish deterministic refresh cadences with end-to-end observability, backfills, and freshness signals.
- Separate concerns: authoritative API for consumption; thin AI tools adapter (MCP) for agent access.

### 3) Non‑Goals
- Building a new data warehouse from scratch.
- Replacing upstream reporting engine logic; we only curate/serve for oversight.
- Complex transformation orchestration outside the defined scope (simple SQL and scheduled jobs only).

### 4) Assumptions
- Postgres/Supabase is available for serving curated tables and materialized views.
- Agents run in environments where MCP tools can call HTTP APIs.
- Hosting supports scheduled execution (e.g., Vercel Cron, GitHub Actions) if external ETL is required.

### 5) Architecture Overview
- API‑first; MCP as adapter
  - System of record for consumers is a versioned, read‑only HTTP API (and optional direct SQL via read-only role).
  - MCP server exposes the same data as tools for AI agents by calling the API under the hood. MCP contains no business logic.

- Data layers
  1. Staging: append‑only raw extracts from reporting engine.
  2. Curated: fact and dimension tables, plus materialized views for aggregates needed by oversight.
  3. Serving: API endpoints mapping 1:1 to curated views with explicit windows and pagination.

- Scheduling
  - Inside‑DB refreshes (materialized views): pg_cron.
  - External pulls (if the reporting engine must be polled): hosting scheduler (Vercel Cron or GitHub Actions) invokes a secure API route that performs the pull and writes to staging.

- Observability and governance
  - metadata.refresh_log records job runs, durations, row counts, success/failure.
  - API exposes freshness fields (last_refresh_at) and allows consumers to verify SLA adherence.
  - Security via RLS and read‑only roles for API and MCP principals.

### 6) Data Model (initial)
- Dimensions (examples):
  - dim_date (date_key, day, week, month, quarter, year)
  - dim_partner (partner_id, name, region, status)
  - dim_campaign (campaign_id, partner_id, objective, created_at)

- Facts (examples):
  - fact_events (occurred_at, partner_id, campaign_id, event_type, amount)
  - fact_spend (occurred_at, partner_id, campaign_id, spend_amount, clicks, impressions)

- Aggregates / Materialized Views (examples):
  - reporting.daily_metrics (day, partner_id, spend, revenue, margin, events, impressions, clicks)
  - reporting.weekly_partner_performance (week, partner_id, spend, revenue, margin)

### 7) Interfaces
- REST API (versioned)
  - GET /api/reporting/v1/daily-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD&partner_id=…&page=…
  - GET /api/reporting/v1/weekly-partner-performance?week=YYYY-Www&partner_id=…
  - GET /api/reporting/v1/metadata/refresh
    - Returns latest refresh entries and last_refresh_at per view.

- API behaviors
  - Read‑only; requires auth via service principal or user session with read role.
  - Pagination and bounding windows enforced; explicit defaults (e.g., max 92 days).
  - OpenAPI schema committed in repo for clients and MCP generation.

- MCP Tools (examples)
  - get_daily_metrics({ from, to, partnerId }): returns the same shape as the API; thin wrapper only.
  - get_freshness(): exposes API metadata/refresh info to agents.

### 8) Scheduling and Operations
- Inside‑DB refresh (Supabase/Postgres using pg_cron)
  - Enable pg_cron and schedule refreshes for materialized views at the chosen cadence (e.g., every 15 minutes).

- External ETL (if polling the reporting engine)
  - Option A: Vercel Cron → secure API route /api/admin/etl/pull-reporting → writes to staging tables.
  - Option B: GitHub Actions (cron) → hits the same secure route with token.

- Backfills
  - On‑demand admin endpoint accepts a date range for re‑ingest and refreshes affected views.
  - Guardrails: limit backfill range, require elevated credentials, and enqueue via idempotent job key.

### 9) SLAs
- Freshness: T+15 min for daily metrics; T+60 min for weekly rollups.
- Availability: 99.9% for API read endpoints.
- Data correctness: within ±0.1% vs reporting engine for numeric aggregates (excluding known source rounding).

### 10) Security & Access Control
- RLS on all curated tables; read‑only role for API and MCP agents.
- Secrets stored in platform secrets manager; no secrets in source.
- Rate limits on API endpoints; audit logs for admin ETL routes.

### 11) Observability
- metadata.refresh_log schema: (job_name, started_at, finished_at, status, rows_affected, error_message)
- API metrics: request count, latency, error rate; logs sampled with correlation IDs.
- Dashboards: freshness per view, last successful run, and lag vs SLA.

### 12) Success Metrics
- 100% of AI agent queries served via MCP → API → curated views (no direct engine calls).
- Freshness SLA met ≥ 99% of intervals over 30 days.
- <0.5% agent/tool failures attributable to data interface.

### 13) Rollout Plan
1. Create curated schemas and initial materialized views.
2. Implement API v1 endpoints with pagination and freshness metadata.
3. Add pg_cron jobs for view refresh; add Vercel Cron/GitHub Action if external ETL needed.
4. Build MCP tools as thin wrappers over API v1.
5. Add dashboards and alerts; validate SLAs and parity with reporting engine.
6. Migrate consumers to API v1; deprecate any direct DB reads by agents.

### 14) Open Questions
- Does the reporting engine support push/webhooks to reduce external polling?
- Are weekly aggregates aligned to ISO weeks or business-defined weeks?
- Do we need per-partner row‑level access in API responses (RLS passthrough)?

### 15) Appendix: SQL Sketches
Example materialized view and cron schedule:

```sql
create extension if not exists pg_cron;

create materialized view if not exists reporting.daily_metrics as
select
  date_trunc('day', e.occurred_at) as day,
  e.partner_id,
  sum(case when e.event_type = 'revenue' then e.amount else 0 end) as revenue,
  sum(case when e.event_type = 'spend' then e.amount else 0 end) as spend,
  count(*) filter (where e.event_type = 'event') as events
from staging.fact_events e
group by 1, 2;

create or replace function reporting.refresh_materialized()
returns void language plpgsql as $$
begin
  refresh materialized view concurrently reporting.daily_metrics;
end;$$;

select cron.schedule(
  job_name => 'refresh_reporting_daily_metrics',
  schedule => '*/15 * * * *',
  command  => $$call reporting.refresh_materialized();$$
);
```


