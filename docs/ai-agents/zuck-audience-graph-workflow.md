> Simulation notice: Systems Architect (Zuckerberg‑inspired) — execution outline for the Audience Graph & Next‑Best‑Action system.

---

## Execution Outline — Audience Graph & Next‑Best‑Action (NBA)

### 0) Objective
- Build a time‑decayed audience graph and a policy service that determines what to show a user on future visits across surfaces, mixing retargeting, similar content, and competitor expansion with safety and measurement.

### 1) Roles & Ownership
- **Signals & Tracking**: Growth Eng
- **Data Model & Storage (Supabase)**: Platform Eng
- **Batch Compute (Affinities/Similarity)**: Data Eng
- **Policy Service (NBA API)**: Backend Eng
- **Telemetry & Dashboards**: Data Eng + Ops
- **Compliance & Guardrails**: Ops + Legal

### 2) Prerequisites
- FB Pixel & CAPI credentials; `pixel_id`, `graph_api_version`, system user token.
- Supabase project URL + service key configured in `backend/src/lib/supabase.ts`.
- Access to `backend/runs/hooks_master.csv`, `backend/runs/competitors_index.csv`.
- Identity graph or user ID stitching available via existing infra.

### 3) Workstreams & Steps

#### A) Signals & Tracking (Week 1)
1. Extend event schema and emit:
   - `ad_view`, `ad_click`, `article_view(dwell_seconds, scroll_pct)`, `keyword_click`, `advertiser_click(predicted_value_usd)`, `lead|purchase`, negatives: `hide_ad`, `mute_brand`, `quick_bounce`.
2. Implement CAPI `Purchase` on `advertiser_click` with shared `event_id` for Pixel↔CAPI dedup (see `docs/infra/20-capi-setup.md`).
3. Log consent state and hashed match keys (em/ph) where applicable.
4. Emit `exposure(surface, candidate_type, candidate_id, arm, propensity, ts)` for every surfaced recommendation.

Deliverables
- Events landing with required fields; EMQ, dedup rate, and latency tracked.

Acceptance Criteria
- p50 event latency ≤ 5 minutes; EMQ ≥ 5; dedup functioning with shared `event_id`.

#### B) Data Model in Supabase (Week 1)
Create minimal tables:
- `identities(user_id, source_ids jsonb, link_confidence float, updated_at)`
- `events(user_id, event_type, entity_type, entity_id, metadata jsonb, ts timestamptz, consent_state text)`
- `entities(entity_id, entity_type, attributes jsonb)`
- `affinities(user_id, entity_type, entity_id, score float, confidence float, updated_at, provenance jsonb)`
- `similarities(a_entity, b_entity, sim float, relation_type text, method text)`
- `exposures(user_id, surface, candidate_type, candidate_id, arm text, propensity float, ts timestamptz)`
- `frequency_caps(user_id, cap_key text, window interval, count int, updated_at)`
- `nba_recommendations(user_id, candidate_type, candidate_id, score float, policy_meta jsonb, ts)`

Deliverables
- Tables created; basic indices on `(user_id, ts)` and `(candidate_id)` as appropriate.

Acceptance Criteria
- Insert/read throughput supports daily volume; retention windows configurable.

#### C) Batch Compute — Affinities (Week 1 → nightly)
1. Nightly job computes time‑decayed user→entity affinities from `events`.
2. Use half‑life per entity type (shorter for hooks/creatives, longer for categories/brands).
3. Store provenance (event counts/weights) for auditability.

Deliverables
- `affinities` table populated daily; job config checked into repo.

Acceptance Criteria
- Runtime < 30 min for current scale; idempotent by date partition.

#### D) Similarity Graph (Week 1)
1. Seed `similarities` from `hooks_master.csv` clusters.
2. Add simple text embeddings (creative text, keywords) for hook/topic similarity.
3. Build brand/category graph from `competitors_index.csv` and `backend/src/lib/categoryMap.ts`.

Deliverables
- `similarities` table filled with hook↔hook, topic↔topic, brand↔brand/category edges.

Acceptance Criteria
- Similarity scores in [0,1]; basic thresholds validated by spot check.

#### E) Policy Service — NBA API (Week 2)
1. Implement candidate generators:
   - Retargeting (product/service/brand based on recent high‑intent events).
   - Similar Content (hook/topic/cluster using `similarities`).
   - Competitor Expansion (brand/category neighbors with guardrails).
2. Implement ranking:
   - Base score: `decayed_affinity × arm_value`.
   - Re‑rank with diversity (MMR), novelty/fatigue penalty.
   - Apply frequency caps, burn rules, and cool‑downs.
3. Exploration:
   - Thompson Sampling or UCB; target 5–15% exploration; log propensity.
4. Expose API:

```json
POST /api/nba/recommendations
{
  "user_id": "u_123",
  "surface": "site/home",
  "k": 5,
  "context": { "locale": "en-US" }
}
// Response
{
  "items": [
    { "candidate_type": "retarget_product", "candidate_id": "p_42", "arm": "retarget", "score": 0.87, "propensity": 0.12 },
    { "candidate_type": "similar_hook", "candidate_id": "hook_991", "arm": "similar", "score": 0.61, "propensity": 0.12 }
  ],
  "policy_meta": { "arm_values": { "retarget": 1.0, "similar": 0.8, "competitor": 0.4 } }
}
```

Deliverables
- Service deployed; SLA and error handling in place.

Acceptance Criteria
- p95 latency ≤ 200 ms for k ≤ 10; correct caps/burn rules enforced; propensities logged to `exposures`.

#### F) Frequency & Fatigue Controls (Week 2)
1. Define per‑creative, per‑brand, and per‑category frequency caps.
2. Implement novelty penalty and cool‑down windows.
3. Burn rules post lead/purchase with category adjacency guardrails.

Deliverables
- Configurable caps and penalties; persisted counters in `frequency_caps`.

Acceptance Criteria
- Cap hit rate tracked; reductions in negative feedback over baseline.

#### G) Telemetry & Dashboards (Week 2–3)
1. Signal integrity: event latency, EMQ, dedup, completeness.
2. Policy health: exploration share, arm value posteriors, off‑policy AUC.
3. Outcomes: CTR, CVR, ROAS, time‑to‑conversion, negatives, cap hits.
4. Incrementality: arm‑level lift vs holdout; competitor arm ROI.

Deliverables
- Daily dashboards with alerts on regressions.

Acceptance Criteria
- Alerting wired for threshold breaches; weekly review cadence set.

### 4) Timeline (3 Weeks)
- **Week 1**: Signals & Tracking; Supabase tables; nightly affinities; seed similarities.
- **Week 2**: NBA API with retargeting + similar content; caps/fatigue; exposure logging; start 10% exploration.
- **Week 3**: Add competitor expansion arm with guardrails; holdout/measurement; tune half‑life per entity type.

### 5) Runbooks & Schedules
- Nightly Affinity Job: `0 2 * * *` — recompute `affinities` and persist provenance.
- Similarity Refresh: `0 3 * * 1` — weekly rebuild with new hooks and embeddings.
- Policy Metrics Snapshot: `*/15 * * * *` — arm values and exploration share.

### 6) Guardrails & Compliance
- Consent‑first data use; SHA‑256 for `em/ph`; retention limits.
- Pixel↔CAPI dedup with shared `event_id`.
- Exclude regulated/sensitive categories from competitor expansion; budget guardrails per arm.
- Cross‑surface coherence: unify caps/burn across paid, onsite, and email.

### 7) Definition of Done
- Clean signals (latency, EMQ, dedup) meeting targets.
- Supabase schema live; nightly affinities and weekly similarities running.
- NBA API serving top‑K with caps, exploration, and exposure logging.
- Dashboards operational; experiment framework and holdouts defined.
- Documented runbooks and rollback procedures.

### 8) References
- Review: `docs/ai-agents/zuck-audience-graph-review.md`
- Signals: `docs/infra/20-capi-setup.md`
- Data/code: `backend/src/lib/categoryMap.ts`, `backend/src/lib/hook.ts`, `backend/src/lib/forcekeys.ts`, `backend/src/lib/supabase.ts`
- Datasets: `backend/runs/hooks_master.csv`, `backend/runs/competitors_index.csv`


