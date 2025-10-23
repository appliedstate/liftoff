## PRD — Hook Similarity and Pooled Learning for Terminal

### Document Info
- Owner: Attention Factory · Collaborators: Platform, Growth Ops
- Version: 0.1 (2025-10-23)
- Status: Draft (scoped; data pipeline not yet enabled)
- References:
  - prd/terminal-facebook-bidder-prd.md
  - prd/reconciled-facebook-reports-api.md
  - docs/creative/41-hook-ideation-agent.md

### 1) Overview
Terminal currently learns and acts primarily at the entity level (ad set/campaign) with lane priors. This PRD introduces a hook-centric layer so that similar hooks (creative ideas) share signal. The goal is to improve decision quality and speed by pooling performance across ads that communicate the same idea or closely related variants (copy/video/image).

Key idea: Identify hooks and their similarity, maintain pooled performance priors, and use these priors to influence creative rotation and budget step sizing with confidence.

### 2) Goals & Non‑Goals
- Goals
  - Identify `hook_id` per ad and compute similarity clusters of hooks.
  - Maintain daily pooled metrics at hook and hook-cluster levels (CTR/CVR/ROAS, fatigue/decay).
  - Use pooled priors in Terminal to (a) rotate creatives using Thompson/UCB and (b) scale budgets with confidence-weighted steps.
  - Explainability: surface “why” with hook/cluster priors in co‑pilot.
- Non‑Goals
  - Real-time content understanding (batch daily/weekly is fine).
  - Cross-channel generalization (scope: Meta; extensible later).

### 3) Definitions
- Hook: The core idea that gets user attention. Represented by `hook_id`, derived from ad copy and/or video content.
- Creative: Specific asset instance (`creative_id`), associated to one `hook_id`.
- Hook Cluster: Group of related hooks (via embedding similarity/cluster).
- Lane: Strategy bucket (ASC, LAL_1, etc.)—used to scope exploration and guardrails.

### 4) Data Model Changes
- Add to reconciled rows (read-only until pipeline is ready):
  - `creative_id: string`
  - `hook_id: string`
  - `hook_cluster_id: string` (optional; derived)
- Feature store tables (daily, Parquet, partitioned by date):
  - `entity_features_daily`: per ad set/campaign (rolling 7/28D; ROAS mean/var, CTR, CVR, utilization, last_change_ts)
  - `creative_features_daily`: per creative_id (7/28D windows; fatigue/decay)
  - `hook_features_daily`: per hook_id
  - `hook_cluster_features_daily`: per hook_cluster_id

### 5) Similarity + Embeddings (Batch)
- Inputs: ad headline, primary text; video transcript (ASR); image/video frames.
- Text embedding: sentence transformer (local or hosted). Media: CLIP-like embedding for frames; audio embedding for transcript.
- Fusion: late-fusion concatenation or learned projection (phase 2).
- Clustering: k-means/HDBSCAN per week; stable cluster IDs persisted in `hook_cluster_id` mapping.
- Cadence: embeddings daily; clustering weekly; backfill on demand.

### 6) Pooled Metrics & Priors
- Metrics computed per day per hook and cluster: CTR, CVR, ROAS, spend, impressions, conversions, decay/half-life signals.
- Priors: empirical Bayes shrinkage toward cluster/lane means; noisy hooks rely more on priors.
- Artifacts: Parquet under `data/warehouse/attention/hooks/level=hook|cluster/date=YYYY-MM-DD/*.parquet`.

### 7) Terminal Integration
- Creative rotation policy (per entity):
  - Bandit over hooks within the entity: Thompson/UCB using pooled priors; exploration budget cap per lane.
  - Fatigue-aware: down-weight hooks with decaying performance.
- Budget step sizing:
  - Confidence from entity AND hook/cluster priors (lower variance → larger steps, bounded by lane caps).
  - Confidence floor: hold when low sample or high uncertainty.
- Explainability:
  - Co‑pilot includes: “Boost +20%: hook cluster X ROAS 1.35 (σ 0.10), entity 1.28 (σ 0.18).”

### 8) APIs & Contracts (Internal)
- Read:
  - GET `/api/terminal/reconciled` (existing) — with `creative_id`, `hook_id`, `lane` when present.
  - GET `/api/terminal/state` — policy/cooldowns; later include hook priors snapshot summary.
  - GET `/api/terminal/policy-config` — lane thresholds/steps.
- Suggest:
  - POST `/api/terminal/suggest` — use hook priors to adjust rotation and step sizes; annotate reasons with hook/cluster metrics.
- Learn:
  - POST `/api/terminal/learn` — updates entity policy; phase 2 updates pooled hook priors from aggregated tables.

### 9) Batch Jobs & Scheduling
- Daily (05:00 local): reconciled snapshot → suggest → learn entity state.
- Daily (post-ingest): hook/creative aggregation from reconciled rows; write feature tables.
- Weekly: embedding refresh + clustering; remap `hook_cluster_id` and backfill.

### 10) Observability
- Metrics: coverage (% of ads with hook_id), cluster stability (ARI), prior variance, rotation win rate, reversal rate, time‑to‑suggest.
- Artifacts: manifest row counts and schema versions; stats on file sizes and partition counts.
- Dashboards: co‑pilot summary block with top/bottom hooks and clusters per lane.

### 11) Success Metrics
- +X% net margin vs baseline in lanes using pooled priors within 4 weeks.
- ≥ 80% of active creatives annotated with `hook_id`.
- Rotation reversal rate ≤ 5% within 24h.
- Time‑to‑suggest unchanged (≤ 05:10 local) with pooled lookups.

### 12) Phased Rollout
- Phase 0 (spec only): add fields to schemas; no operational changes.
- Phase 1: text-only hook_id tagging; daily hook_features; use priors only for confidence scaling (read-only influence).
- Phase 2: full embeddings + clusters; bandit-based rotation using pooled priors; co‑pilot explainability.
- Phase 3: cross-lane pooling and creative fatigue modeling; experiment registry A/B by lane.

### 13) Risks & Mitigations
- Misclassification of hooks → noisy priors → bad decisions. Mitigate with review tooling and conservative confidence floors.
- Cluster drift over time → instability. Mitigate with weekly cadence and cluster ID mapping with minimal churn.
- Latency/IO: keep pooled tables compacted; push queries via DuckDB/Polars with partition pruning.

### 14) Acceptance Criteria (Phase 1)
1) Recon rows carry `hook_id` for ≥ 60% of active ads; daily `hook_features_daily` produced.
2) Suggest endpoints consume hook priors for confidence scaling and annotate reasons accordingly.
3) Co‑pilot shows top hooks and clusters per lane with pooled metrics.
4) No regression in time‑to‑suggest; reversal rate ≤ baseline.


