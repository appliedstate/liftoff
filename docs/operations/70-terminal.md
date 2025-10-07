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

## Current (as reported)
- Data sources: S1, Taboola, Facebook, Zemanta, MediaGo (no Strateg.is connectors).
- Storage: ClickHouse tables (e.g., s1ReconciledReport, s1IntradayReport).
- Modeling: Variables derived from reports; no delay profiles, 168-bin baselines, or nowcast.
- Decision engine: CoffeeScript rule execution (no vm2 JS sandbox). Rules in Redis (filters by buyer/adSource/trafficSource).
- Execution: Actions stored in LevelDB; retry via tasks-loop. Supports directUpdate only.
- APIs: /api/global-terminal, /run, /actions. No freeze/kill-switch, nowcast, or backtest endpoints.
- Idempotency/cooldowns: Not explicitly visible; no intent queue, cooldown registry, or daily cap enforcement.

## Required (to execute our playbooks)
- Data ingestion
  - Strateg.is hourly and reconciled connectors (API/CSV) with validation, timezone normalization, idempotent upserts.
  - Canonical tables: hourly_campaign_report, strategis_reconciled_report.
- Modeling
  - Per-campaign delay profiles (Δ=0..12h); 168-point hour‑of‑week baselines (clicks/RPC/CPM).
  - Intraday ROAS nowcast + bias tracking (target |bias| ≤ 5%).
- Policy execution
  - JS policy sandbox (vm2 or equivalent) with helpers: confirm2h(), cooldown(), dailyCap(), baselines(), gates().
  - Versioned policies, per-vertical overrides, feature flags.
- Execution controls
  - Intent queue (bump_budget, trim_budget, rotate_creatives) with statuses and idempotency keys.
  - Cooldown registry and daily cap enforcement.
  - Freeze/kill-switch endpoints; audit/change_log.
- Ops
  - Hourly H+5 scheduler; nightly refresh; backtest/simulator harness.
  - Metrics and alerts: freshness, bias, reversal rate, guard violations.

## Validation questions for Devin (answer with file paths + commit SHAs)
- Data sources
  - Where are Strateg.is hourly and reconciled connectors (if any)? Endpoints, schemas, SLAs, timezones, sample rows.
  - How is idempotency and de-duplication handled today?
- Storage
  - Source-of-truth DB(s) and table names for hourly and reconciled; partitioning/indexes/retention; join keys and tz handling.
- Modeling
  - Do delay profiles and 168-bin baselines exist? Where computed/stored? Nowcast function location and bias monitoring.
- Decision engine
  - Is there a JS sandbox? Limits and allowed helpers. How are policies versioned and rolled out (per-vertical overrides)?
- Execution
  - Intent queue schema, executor service, retries/idempotency; where cooldown registry and daily caps are enforced.
  - Supported actions and payload shapes (bump/trim/rotate).
- Controls & ops
  - Freeze/kill-switch endpoints and scope. Audit/change_log schema and where to view. Backtest/simulator existence and IO.
- Scheduling & env
  - Hourly H+5 and nightly jobs (orchestrator/cron, tz). Secrets/RBAC. Environment matrix (prod/stage).
- Strateg.is mapping
  - Field mapping from Strateg.is to internal schema (spend, revenue, clicks, sessions, ROAS).
- Hygiene
  - Clean branch name and SHA containing these components (note any merge conflicts blocking pulls).

## Decision log / next steps
- If Strateg.is connectors absent: add ingestion + canonical tables.
- If no nowcast/baselines: add nightly/ hourly jobs and storage.
- If no JS sandbox/intent queue: add minimal implementations with audit and caps.
- Add freeze/kill-switch + bias/reversal dashboards if missing.
