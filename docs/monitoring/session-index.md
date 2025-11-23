# Session & Campaign Index Pipeline

## Overview

We now maintain an automated DuckDB-backed index that links Strategist campaign metadata with Strategis session revenue so we can monitor RPC by campaign, media source, owner, and click hour without manual joins.

- **Campaign metadata ingestion** (`monitor:ingest-campaigns`)
  - In default `remote` mode pulls Facebook + S1 datasets directly from `https://strategis.lincx.in` (Facebook report/campaigns/adsets, S1 daily/rpc averages, Strategis metrics, pixel data).
  - `snapshot` mode still supports reading historical Strategist exports from `data/snapshots/facebook/<source>/`.
  - Normalizes campaign-level rows (owner, lane, category, media source, spend, revenue, sessions, etc.).
  - Upserts into `data/monitoring.duckdb` → `campaign_index`.
- **Session aggregation** (`monitor:ingest-sessions`)
  - Calls `GET /api/s1/report/hourly-v3` on Strategis to fetch hourly S1 sessions/revenue (ClickHouse backend).
  - Aggregates sessions/revenue per (strategis_campaign_id, click_hour) and joins against `campaign_index` metadata.
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
|  | `--source=day|reconciled` | Snapshot group metadata (default day) |
|  | `--level=campaign|adset` | Snapshot level (default campaign) |
|  | `--mode=snapshot|remote` | `remote` hits Strategis API, `snapshot` reads local files |
| ingest-sessions | `--date=YYYY-MM-DD` | Session date to fetch |
|  | `--max-hour=H` | Upper bound on click_hour (0-23) |
|  | `--mode=strategis` | Present for backwards-compatibility; always uses Strategis hourly report |

`MONITORING_DB_PATH` can override the default `data/monitoring.duckdb` location.

### Strategis API configuration

Both scripts rely on a single authenticated client that logs into Authentic (IX ID) and issues signed requests to `https://strategis.lincx.in`. Make sure these env vars are set before running the jobs (export in your shell profile or add to the systemd unit):

| Variable | Description | Default |
| --- | --- | --- |
| `IX_ID_EMAIL` | IX ID login email | _required_ |
| `IX_ID_PASSWORD` | IX ID password | _required_ |
| `IX_ID_BASE_URL` or `STRATEGIS_AUTH_BASE_URL` | Authentic host | `https://ix-id.lincx.la` |
| `STRATEGIS_API_BASE_URL` | Strategis API origin | `https://strategis.lincx.in` |
| `STRATEGIS_ALLOW_SELF_SIGNED` | Set `1` to bypass self-signed certs (Hetzner) | `0` |
| `STRATEGIS_ORGANIZATION` | Organization query param | `Interlincx` |
| `STRATEGIS_AD_SOURCE` | `adSource` query param | `rsoc` |
| `STRATEGIS_NETWORK_ID` | Network ID for S1 endpoints | `112` |
| `STRATEGIS_TIMEZONE` | Timezone for S1/strategis queries | `UTC` |
| `STRATEGIS_RPC_DAYS` | Lookback window for RPC averages | `3` |

Example manual run (UTC):

```bash
npm run monitor:ingest-campaigns -- --date=$(date -u +%F) --mode=remote
npm run monitor:ingest-sessions -- --date=$(date -u +%F) --max-hour=$(date -u +%H)
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

