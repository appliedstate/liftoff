# Session & Campaign Index Pipeline

## Overview

We now maintain an automated DuckDB-backed index that links Strategist campaign metadata with Strategis session revenue so we can monitor RPC by campaign, media source, owner, and click hour without manual joins.

- **Campaign metadata ingestion** (`monitor:ingest-campaigns`)
  - Reads Strategist day/reconciled snapshots directly from `data/snapshots/facebook/<source>/`.
  - Normalizes campaign-level rows (owner, lane, category, media source, spend, revenue, sessions, etc.).
  - Upserts into `data/monitoring.duckdb` → `campaign_index`.
- **Session aggregation** (`monitor:ingest-sessions`)
  - Pulls the Strategis session CSV API for a date, optionally capped at a max click hour.
  - Aggregates sessions/revenue per (campaign_id, click_hour) and joins against `campaign_index` metadata.
  - Stores into `session_hourly_metrics`, logging each ingest run.

Both scripts write run metadata (`campaign_index_runs`, `session_ingest_runs`) for auditing.

## Commands

```bash
# Campaign metadata (default: snapshot mode)
npm run monitor:ingest-campaigns -- --date=2025-11-22 --source=day --level=campaign

# Session RPC aggregation (default: today, 23h)
npm run monitor:ingest-sessions -- --date=2025-11-22 --max-hour=12
```

Flags:

| Script | Flag | Description |
| --- | --- | --- |
| ingest-campaigns | `--date=YYYY-MM-DD` | Snapshot date to read |
|  | `--source=day|reconciled` | Snapshot group (default day) |
|  | `--level=campaign|adset` | Snapshot level (default campaign) |
|  | `--mode=snapshot|remote` | `snapshot` reads local files, `remote` hits Strategist API |
| ingest-sessions | `--date=YYYY-MM-DD` | Session date to fetch |
|  | `--max-hour=H` | Upper bound on click_hour (0-23) |
|  | `--limit=N` | Strategis API limit (default -1) |
|  | `--mode=direct|remote` | `direct` hits Strategis staging endpoint, `remote` proxies via Strategist API |

`MONITORING_DB_PATH` can override the default `data/monitoring.duckdb` location.

### Remote API mode

When the repo runs on infrastructure that has access to the Strategist API, set the following environment variables so the ingestion scripts can authenticate automatically:

| Variable | Description |
| --- | --- |
| `IX_ID_EMAIL` | IX ID login email (e.g., `roach@interlincx.com`) |
| `IX_ID_PASSWORD` | IX ID password (store securely) |
| `STRATEGIST_API_BASE_URL` | Strategist API origin (default `https://strategist.lincx.la`) |
| `IX_ID_BASE_URL` | IX ID auth origin (default `https://ix-id.lincx.la`) |

Then run:

```bash
npm run monitor:ingest-campaigns -- --date=$(date -u +%F) --mode=remote
npm run monitor:ingest-sessions -- --date=$(date -u +%F) --mode=remote --max-hour=$(date -u +%H)
```

Tokens are cached in-memory per process and refreshed automatically when expired.

## Cron on Hetzner

Example cadence (UTC) to keep the index fresh every hour:

```
# Campaign metadata at :15 past the hour
15 * * * * cd /opt/liftoff/backend && /usr/bin/env npm run monitor:ingest-campaigns -- --date=$(date -u +\%F) >> /var/log/monitor-campaigns.log 2>&1

# Session RPC snapshot at :20 (restrict to clicks logged so far)
20 * * * * cd /opt/liftoff/backend && /usr/bin/env npm run monitor:ingest-sessions -- --date=$(date -u +\%F) --max-hour=$(date -u +\%H) >> /var/log/monitor-sessions.log 2>&1
```

The second job should lag the first by a few minutes to ensure the latest Strategist snapshot is ingested before we attribute sessions.

## Tables

| Table | Purpose |
| --- | --- |
| `campaign_index` | One row per campaign/date/source with owner/lane/category/media_source + spend/revenue/sessions |
| `campaign_index_runs` | Audit log for metadata ingests |
| `session_hourly_metrics` | Aggregated sessions/revenue/RPC per campaign_id + click_hour |
| `session_ingest_runs` | Audit log for session ingests |

This DB can be queried directly via DuckDB CLI or through future API endpoints for dashboards/alerts.

