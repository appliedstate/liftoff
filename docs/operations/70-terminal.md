---
id: operations/70-terminal
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: Terminal — Current Capabilities, Gaps, and Requirements
purpose: Working reference of Terminal's current implementation vs. the capabilities required to execute our playbooks.
dependencies:
  - operations/60-launch-protocol.md
  - operations/61-intraday-optimization.md
  - operations/61-promotion-prune-scale.md
  - docs/creative/41-hook-ideation-agent.md
licensing: internal
---

# Terminal — Current vs. Required

## Source audit context
- Repository: `strategis-api`
- Commit SHA: `e416b614` (HEAD on master)
- Status: clean working tree
- Core files referenced: `global-terminal.js`, `run-campaign-terminal.js`, `eval-code.js`, `server.js`, `config.js`, `clickhouse-fields-schema-def.js`, `clickhouse-init.js`

## Current (confirmed with Devin)

### Data sources & contracts
- Existing sources (confirmed): S1 (hourly/reconciled), Taboola (hourly/daily), Facebook (hourly/daily), Zemanta (reconciled), Mediago (hourly/daily)
- Strateg.is hourly/reconciled connectors: NO (not found anywhere)
- Strateg.is tables under different names: NO (strategisEventsReport is generic event tracking)
- Idempotency: YES - ClickHouse `ReplacingMergeTree(insertTimestamp)` only, no additional dedup keys

### Storage schemas
- Source-of-truth DB: ClickHouse (`strategisReports` in prod, `strategisReportsDev/Test` in dev)
- Tables used in prod: s1ReconciledReport, s1IntradayReport, zemantaReconciledReport, taboolaDailyReport, facebookDailyReport, etc.
- Sample report shape (example):
```
{ "level": "date-hour-campaignId", "date": "2020-10-01", "hour": "00", "campaignId": "epa001", "impressions": 8 }
```
- Missing canonical tables required by our playbooks:
  - `hourly_campaign_report`
  - `strategis_reconciled_report`

### Modeling (nowcast readiness)
- Delay profiles (Δ≤12h): NO (not computed or stored)
- 168-bin baselines: NO (not computed or stored)
- Nowcast or bias KPI: NO (does not exist)
- Current variables: simple aggregations (s1Revenue/clicks/searches, trafficImpressions/clicks/conversions/spend, ctr/cpm/cpc/cpa/rpm/roas/margin), exposed with Last1Hour..Last1Day windows

### Decision engine (policy execution)
- CoffeeScript+static-eval only: YES (eval-code.js) - no vm2 anywhere
- Helper primitives exist: NO (none of confirm2h/cooldown/dailyCap/baselines/gates exist)
- Policy storage: Redis hash `global-terminal` with filter targeting (organization, adSource, trafficSource, buyer, strategisCampaignId)
- Missing: policy versioning, feature flags, audit trail beyond createdAt/updatedAt

### Execution (intents → actions)
- Intent queue separate from LevelDB: NO (only action storage, no queue mechanism)
- Cooldown/daily caps enforced: NO (not enforced)
- Support bump/trim/rotate operations: NO (only directUpdate/isActive toggle supported)
- Action storage: LevelDB under `global-terminal-actions` (ns/date/hour/id), executor loop with retries
- Supported networks: Taboola, Facebook, Mediago, Zemanta, Outbrain

### APIs & scheduling
- Available endpoints:
```
GET/POST  /api/global-terminal
GET       /api/global-terminal/:id
PUT       /api/global-terminal/:id
DELETE    /api/global-terminal/:id
GET       /api/global-terminal/actions
GET/POST  /api/global-terminal/run
```
- Auth: `authify` middleware with RBAC
- H+5 hourly or nightly jobs: NO (manual endpoints only `/api/schedule/campaign-terminals`, no Cloud Scheduler config)
- Nowcasts/intents/execute/freeze endpoints: NO (not in any service)

### Controls & safety
- Freeze/kill-switch: NO (does not exist)
- Audit/change_log storage: Partial (only createdAt/updatedAt on rules, no comprehensive action audit)
- Reversal rate/bias dashboards: NO (not tracked)
- Exists: dry‑run via `isDry` flag

### Observability
- Missing: dashboards/alerts for freshness, bias, reversal rate, guard violations
- Exists: debug logging

### Backtest/simulator
- Replay/simulator tool: NO (does not exist)

### Strateg.is integration status
- Terminal does NOT currently ingest Strateg.is data (no Strateg.is connectors or canonical tables found)

### Git hygiene
- Prod branch/SHA: master/e416b614 - clean working tree in strategis-api
- Blockers: YES - lincx-core has merge conflicts (but Terminal is in strategis-api, not affected)

## Summary of confirmed gaps
All Strateg.is integration, modeling (nowcast/baselines), advanced execution (intent queue/cooldowns/caps), scheduling automation, and observability features are missing and need to be built as delta scope per the phased plan.

## Required (to execute our playbooks)
- Data ingestion
  - Strateg.is hourly and reconciled connectors (API/CSV) with validation, timezone normalization, idempotent upserts
  - Canonical tables: `hourly_campaign_report`, `strategis_reconciled_report`
- Modeling
  - Per‑campaign delay profiles (Δ=0..12h); 168‑point hour‑of‑week baselines (clicks/RPC/CPM)
  - Intraday ROAS nowcast + bias tracking (target |bias| ≤ 5%)
- Policy execution
  - JS policy sandbox (vm2 or equivalent) with helpers: `confirm2h()`, `cooldown()`, `dailyCap()`, `baselines()`, `gates()`
  - Versioned policies, per‑vertical overrides, feature flags
- Execution controls
  - Intent queue (bump_budget, trim_budget, rotate_creatives) with statuses and idempotency keys
  - Cooldown registry and daily cap enforcement
  - Freeze/kill‑switch endpoints; audit/change_log
- Ops
  - Hourly H+5 scheduler; nightly refresh; backtest/simulator harness
  - Metrics and alerts: freshness, bias, reversal rate, guard violations

## Validation questions for Devin (answer with file paths + commit SHAs)
- Data sources
  - Where are Strateg.is hourly and reconciled connectors (if any)? Endpoints, schemas, SLAs, timezones, sample rows
  - How is idempotency and de‑duplication handled today?
- Storage
  - Source‑of‑truth DB(s) and table names for hourly and reconciled; partitioning/indexes/retention; join keys and tz handling
- Modeling
  - Do delay profiles and 168‑bin baselines exist? Where computed/stored? Nowcast function location and bias monitoring
- Decision engine
  - Is there a JS sandbox? Limits and allowed helpers. How are policies versioned and rolled out (per‑vertical overrides)?
- Execution
  - Intent queue schema, executor service, retries/idempotency; where cooldown registry and daily caps are enforced
  - Supported actions and payload shapes (bump/trim/rotate)
- Controls & ops
  - Freeze/kill‑switch endpoints and scope. Audit/change_log schema and where to view. Backtest/simulator existence and IO
- Scheduling & env
  - Hourly H+5 and nightly jobs (orchestrator/cron, tz). Secrets/RBAC. Environment matrix (prod/stage)
- Strateg.is mapping
  - Field mapping from Strateg.is to internal schema (spend, revenue, clicks, sessions, ROAS)
- Hygiene
  - Clean branch name and SHA containing these components (note any merge conflicts blocking pulls)

## Decision log / next steps
- **Strateg.is connectors absent**: CONFIRMED - add ingestion + canonical tables `hourly_campaign_report`, `strategis_reconciled_report`
- **No nowcast/baselines**: CONFIRMED - add nightly/hourly jobs for delay profiles (Δ≤12h), 168-bin baselines, nowcast computation, bias tracking
- **No JS sandbox/intent queue**: CONFIRMED - implement vm2 sandbox with helpers (confirm2h, cooldown, dailyCap, baselines, gates), intent queue, cooldown registry, daily cap enforcement, new operations (bump_budget, trim_budget, rotate_creatives)
- **Missing scheduling/observability**: CONFIRMED - add H+5 hourly job, nightly refresh job, endpoints (/nowcasts, /intents, /execute, /freeze), freeze/kill-switch, comprehensive audit/change_log, bias/reversal dashboards, backtest/simulator

**Immediate priority**: Strateg.is ingestion and canonical table creation to enable data flow for playbooks.
