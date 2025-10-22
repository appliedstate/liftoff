## PRD — Terminal Facebook Bidder

### Document Info
- Owner: Growth Ops · Collaborators: Engineering (Platform), Attention Factory
- Version: 0.1 (2025-10-22)
- Status: Draft
- References:
  - operations/operations:launch-protocol
  - operations/operations:terminal-automation
  - prd/strategis-facebook-metrics-endpoint.md
  - operations/70-terminal.md
  - prd/arbitrage-portfolio-reporting-prd.md

### 1) Overview
Terminal is our automation engine that manages Facebook campaign budgets and ad set bid caps using deterministic rules driven by Strateg.is reporting. We will:
- Auto-launch campaign structures per the Launch Protocol and freeze for 48–72 hours.
- Perform daily optimization (budgets and bid caps) based on reconciled P&L by line item.
- Graduate to intraday optimization using a nowcast that accounts for the revenue delay gap.

This PRD specifies inputs, rules, guards, scheduling, endpoints, observability, and acceptance criteria so the bidder can run locally or as a cron/scheduled service.

### 2) Goals & Non‑Goals
- Goals
  - Automate daily budget and bid‑cap adjustments for Facebook campaigns/ad sets based on reconciled performance.
  - Maintain strict safety guards (cooldowns, caps, freeze) to protect learning and downside risk.
  - Provide auditable change logs and a dry‑run mode.
  - Prepare for intraday (hourly) optimization via nowcasting.
- Non‑Goals
  - UI for manual editing (covered by existing tools).
  - Cross‑channel orchestration (future work).

### 3) Assumptions & Constraints
- CAPI signal health must be green (EMQ p50 ≥ 5; latency p50 ≤ 300s; dedup OK) before any scaling actions.
- Revenue is reconciled daily by morning; intraday revenue has material delay (up to ~12h), requiring a nowcast for within‑day actions.
- Platform constraints: Meta min budget/bid limits, one significant change per 24h recommended for stability, entity caps.
- Timezone: actions scheduled in account timezone; report ingestion normalized.

### 4) Starting Budgets & Auto‑Launch
- Launch uses lane allocations (example for $6,000/day): ASC 33% (~$2,000), LAL 1% 17% (~$1,000), LAL 2–5% 17% (~$1,000), Contextual 17% (~$1,000), Sandbox 13–15% (~$750–900), Warm 3–7% (~$200–400).
- Freeze window: 48–72h post‑launch — no structural edits; Terminal runs in dryRun.
- Ads per ad set: 10–15 at launch; ASC live ads: 20–40 across ≥6 distinct hooks.

Implementation hook: Launch is executed by Strategis Ad Manager APIs; Terminal should receive the created entity IDs and initialize cooldown registries and labels.

### 5) Daily Optimization (Phase 1)
Runs once per day after reconciled reports are available.

5.1 Inputs
- Strateg.is reconciled daily report (per campaign/ad set): spend, revenue, net_margin, margin_rate, ROAS.
- Facebook state snapshot: budgets, bid caps, delivery/learning status.
- Policy configuration: per‑lane parameters, risk caps, allowed steps, feature flags.

5.2 Aggregations & Eligibility
- Compute yesterday’s net margin and ROAS per campaign/ad set.
- Eligible for changes only if: outside launch freeze, cooldowns satisfied, entity not in Learning Limited remediation, and signal health green.

5.3 Budget Rules (deterministic)
- Winners (example thresholds; configurable):
  - ROAS ≥ 1.30× and EMQ ≥ 5: increase budget by +20% to +40% (lane‑specific cap).
  - ROAS 1.00–1.29×: modest +10% to +20% if portfolio risk budget available.
- Neutral/Hold: 0.80–0.99× ROAS or ambiguous data → hold or −10% trim.
- Losers: ROAS < 0.80× → −20% to −50% or pause (lane‑specific rules).
- Cooldowns: max one budget change per entity per 24h; ASC steps +20–30%; ≤ 2 bumps/week.

5.4 Bid‑Cap Rules (where supported)
- Objective allows bid cap: set/adjust in small steps (e.g., ±10%) only when delivery and EMQ are stable and ROAS bias is not negative.
- If CPA worsens > +10% over 6h (on next intraday phase) with stable sessions, auto‑rollback last bid change.

5.5 Portfolio & Safety Guards
- Never pause all prospecting lanes simultaneously; keep ≥1 prospecting lane active.
- Per‑account and per‑lane daily spend caps; respect max_daily_spend_per_campaign.
- Daily risk budget: enforce portfolio‑level spend/margin constraints.

5.6 Execution Order
1) Validate data freshness and signal health.
2) Score entities by policy (winners, neutral, losers) with confidence.
3) Generate intent list (bump_budget, trim_budget, set_bid_cap, pause/resume).
4) Apply in batches with idempotency keys; log all changes.

### 6) Intraday Optimization (Phase 2)
Purpose: Act within day despite revenue delay via a nowcast of day‑end ROAS.

- Modeling
  - Per‑campaign delay profiles (Δ=0..12h) and hour‑of‑week baselines for clicks/RPC/CPM.
  - Nowcast with bias tracking (target |bias| ≤ 5%).
- Cadence
  - Hourly H+5 runs; guard cooldown ≥ 4h between changes on same entity.
  - Max +10% bump or −15% trim per action during intraday.
- Gates
  - Only act if nowcasted ROAS crosses thresholds with confidence and safety guards pass.
  - Learning density gate: pace ≥ 50 events/ad set/week for scaler lanes.

### 7) Data Sources & Pipeline
- Primary: Strateg.is reconciled reports (CSV/API) for prior‑day truth and daily P&L.
- Secondary: Facebook Marketing API for real‑time budgets/bids/status.
- Freshness: daily by 07:00; intraday snapshots for Phase 2.
- Storage: canonical tables for hourly_campaign_report and strategis_reconciled_report; idempotent upserts.

### 8) APIs & Contracts
- Read
  - Strateg.is Metrics APIs for dashboard/summary (see Metrics & Scaling Automation PRD).
- Write (Meta orchestration via Strategis Ad Manager)
  - PATCH campaign budgets; PATCH ad set budgets and bid amounts; pause/resume.
  - Idempotency keys and audit logging required for every change.

Proposed Terminal Service Endpoints (internal):
- GET `/api/terminal/policies` — fetch active policy config and flags.
- POST `/api/terminal/simulate` — dry‑run evaluation; returns intents with reasons.
- POST `/api/terminal/execute` — apply intents; returns change_log and safety_violations.
- GET `/api/terminal/actions` — list historical actions with statuses.

### 9) Scheduling & Deployment
- Mode: containerized service with cron (daily 07:15 local) + optional hourly job for Phase 2.
- Feature flags: `supportsBidCaps`, `supportsAdLevelPause`, `dryRun`.
- Environments: staging (dryRun enforced), production.

### 10) Observability & Audit
- Change log event for every action: before/after, policy reason, confidence, idempotency key, Meta object IDs.
- Metrics: data freshness, reversal rate, guard violations, action success rate, portfolio margin impact.
- Alerts: failures, guard violations, bias drift in nowcast.

### 11) Success Metrics
- ≥ 99% successful writes with automatic retry/backoff on 429/5xx.
- 0 guardrail breaches; ≤ 5% reversal rate within 24h.
- +$500/day net margin delta attributed to daily automation within 30 days.

### 12) Acceptance Criteria
1) Daily run applies budget/bid changes to eligible entities with cooldowns and logs.
2) Dry‑run produces consistent intent lists vs execute mode on same inputs.
3) End‑to‑end traceability: each change links to policy evaluation and source data snapshot.
4) Intraday phase ships simulator + limited rollout with nowcast bias ≤ 5% for two weeks.

### 13) Open Questions
- Finalize lane‑specific thresholds and step sizes by vertical.
- Confirm which objectives/ad sets will use bid caps vs cost caps.
- Portfolio‑level risk budget parameters and escalation rules.
- Timezone strategy for multi‑account portfolios.


