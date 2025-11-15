## Adnet Brain for Lead Management (MVP) — Spec and Comparison Primer

### Purpose
Concise brief for evaluating Adnet Brain as a policy engine to power lead scoring and routing (e.g., alongside/versus Arborist). Includes Brain DSL overview, runner/scheduling semantics, how it would integrate into a lead-management MVP, gaps vs a full lead system, and a comparison framework vs Arborist.

### What Adnet Brain is (in simple terms)
- A deterministic, human-authored policy engine (decision trees + expressions) that turns data inputs into decisions on a schedule with auditability.
- You author policies via Nodes/Subtrees/Algorithms, plus Pre/Post calculations and external dependencies; the runner executes them, logs traversal, and emits decisions.

## Brain Policy DSL (summary)
- **Nodes**
  - non_leaf: boolean expression routing the tree
  - leaf: numeric expression producing the decision value (e.g., bid, percentage change)
- **Subtrees**
  - Reusable decision fragments composed of nodes; embeddable in multiple algorithms
- **Algorithms (Decision Trees)**
  - Wire nodes/subtrees into a directed tree; attach PreCalc/PostCalc; versioned
- **PreCalc (input mutation before tree)**
  - `modify("param", value)`; precedence by alphanumeric `id`
- **PostCalc (output mutation after tree)**
  - `modify("param", value)`; `allow(["k1","k2"])` to whitelist outputs; precedence by `id`
- **External Dependencies**
  - Bound prior to evaluation (e.g., Matrix v3 cutoff as `cutoff = { tctrP, kctrP, factor }`), dot-access via `cutoff.*`
  - Tabular lookups via `lookup(param, "dep.col_match", "col_value", "?rowExpr")`
- **Stateful context (auto)**
  - `leaf_id` (current traversal leaf), `pre_leaf_id` (previous-hour leaf), `bid` (numeric leaf result), `display_message` (path/log)
- **Scheduling (per algorithm)**
  - `active`, `offPeak`, `intervalMinutes` (0 = ad‑hoc only), `dayParting { startHour, endHour, timezone }`
- **Expression Language (whitelist)**
  - Operators: + - * / && || ( ) < > <= >= == != and ternary `cond ? a : b`
  - Functions: `min`, `max`, `avg`, `abs`, `search`, `currentHour`, `currentDay`, `between`, `floor`, `ceil`, `round` (0.45 rule), `diffp`, `lookup`, `zeroify`, `trunc` (plus `modify`, `allow` in Pre/Post)

## Runner and Scheduling (stateful)
- **Stateful runner**
  - Persists per-entity state: `pre_leaf_id`/`leaf_id`, `lastRunAt`, cooldowns, idempotency keys, last applied intent
  - Loads inputs (ingested data + dependencies), evaluates policy, applies guards, emits and audits decisions
- **Runnable gate**
  - Day-part window with wrap-around support; `offPeak` inverts window; `intervalMinutes` cadence (0 → ad‑hoc only)
- **Triggers**
  - Long-running worker with internal timer and/or cron-triggered execution endpoint

## Reasons and Audit Outputs
- **Human string** in `reason`: key metrics, branch path, chosen action, guards state, policy version, `pre_leaf_id`
- **Structured trace** (API): node evaluations, values, schedule gates; inputs snapshot and dependency version

## Using Brain for Lead Scoring and Routing (Leedspedia-like)

### MVP objectives
- Accept normalized leads in real time; rank eligible vendors; deliver to top candidate with fallbacks; respect caps/cooldowns; emit auditable reasons.

### Proposed flow
1) Intake lead → normalize (hash/idempotency) → PII policy enforced
2) PreCalc features/derivations; bind dependencies (vendors, pricing, eligibility, caps)
3) Policy evaluates eligibility/score, outputs ranked vendors + reasons
4) Delivery adapter attempts vendor#1; on reject/timeout, move to vendor#2 …; update caps/state
5) Persist audit (inputs, path, vendor responses); emit webhook/CSV/JSON

### Minimal schemas (illustrative)
- **Intake (request)**
  - Required: `lead_id`, `vertical`, `geo`, `contact` (email/phone hashed if required), `consent`, `source`, `timestamp`
  - Optional signals: quality/fraud scores, historical engagement, device/IP
- **Dependencies (tables)**
  - `vendors`: id, name, verticals, geos, min/max price, SLA, schedule
  - `vendor_caps`: id, daily_cap, hourly_cap, cooldown_seconds
  - `eligibility_rules`: per-vertical/geo constraints; suppression lists
  - `pricing`: static/dynamic price ladders or formulas
- **Decision (response)**
  - `{ vendor_id, action: "route"|"reject", price, reason, leaf_id, pre_leaf_id, policy_version, audit_id }`

### What Brain covers vs what you build
- Covered by Brain (≈40–50% of MVP)
  - Policy logic (eligibility, scoring, ranking), scheduling, stateful guards, test harness, audit/explain
- Build around Brain
  - Intake API & normalization (PII, hashing, idempotency), vendor adapters/retries, dedupe/fraud checks, pricing/billing, reporting UI, SLAs

### Security notes
- PII encryption/redaction at rest and in logs; RBAC; retention/deletion windows; consent/DNC checks

## Comparison: Brain vs Arborist (framework)

### Dimensions to assess
- **Policy authoring**: nodes/subtrees, pre/post, external tables, versioning, test harness
- **Scheduling/runner**: active/off‑peak/day‑part, intervals, ad‑hoc, cooldowns, idempotency
- **State & audit**: traversal logs, input snapshots, who/when/why changes, RBAC/approvals
- **Lead domain fit**: vendor adapters, caps, pricing, dedupe/fraud, consent/PII, SLAs
- **Ops & scale**: throughput, latency, retries/backoff, observability, cost

### Pros/Cons (using Brain vs extending Arborist)
- **Use Brain**
  - Pros: mature policy management, fast iteration/testing, strong auditability, separation of concerns
  - Cons: integrate adapters/PII/SLAs yourself; potential overlap with Arborist; two systems to operate
- **Extend Arborist**
  - Pros: single system, native lead-domain adapters/SLAs, less integration overhead
  - Cons: may lack DSL/versioning/testing; adding scheduler/stateful runner/audit could be non-trivial; slower policy iteration
- **Hybrid**
  - Pros: Brain as control plane (decisions) and Arborist as data/delivery plane (leads, vendors)
  - Cons: integration complexity; must align schemas and idempotency across systems

### Decision criteria (suggested)
- Time-to-iterate on routing policy (days vs weeks)
- Required audit/compliance depth (explainability, approvals)
- Feature completeness for vendor delivery (adapters, pricing, SLAs)
- Team familiarity and maintenance footprint
- Cost and operational risk

## MVP Plan (actionable)
- Week 0: Confirm intake schema, dependency tables, and initial policy goals
- Week 1: Implement intake + normalization, Brain policy draft, vendor dependency registry, state store (caps/cooldowns)
- Week 2: Delivery adapter for 1–2 vendors, retries/fallback, audit exports, dry‑run shadow
- Week 3: Pilot (read‑only suggestions → controlled auto‑apply), dashboards, refine policy

## Artifacts needed from Arborist for comparison
- Policy/rule capabilities, scheduler/state, audit/logging, vendor adapter list, pricing/billing, fraud/dedupe features, consent/PII handling, reporting

## Example reason format
- `"score=0.82, eligible=3 vendors, path=geo_ok→price_band_2→rank_top, action=route vendor=ACME price=$42, guards:cap_OK cooldown_OK, policy=routing_v1@2025‑10‑28T07:00, pre_leaf=rank_top_prev"`


