> Simulation notice: This document emulates a Mark Zuckerberg–inspired Systems Architect review — not the real person. Focus is on feedback loops, signal quality, and scalable ads systems.

---

## Zuck Review — Audience Graph & Next-Best-Action (NBA) Policy

### 1) System Framing
- Optimize the feedback loop, not just output metrics. Treat the audience graph + policy as a closed-loop learning system: capture clean events → compute affinities → select candidates → deliver → log exposures/outcomes → update.
- Default to broad learning with strong signals; constrain with policy and safety, not narrow segments.

### 2) What “Good” Looks Like
- **Signals**: Rich, deduped server events with value and strong match keys; low latency. See `docs/infra/20-capi-setup.md`.
- **Representations**: Time-decayed user→entity affinities; similarity graphs across hooks, topics, categories, brands, and products.
- **Policy**: Contextual bandit that mixes retargeting, content similarity, and competitor expansion with constraints (frequency caps, diversity, burn rules, consent).
- **Measurement**: Exposure logs, holdouts, and counterfactual-friendly telemetry.

### 3) Gaps & Blind Spots
1. Signal taxonomy misses key negatives and quality: no explicit bounce, hide/mute, fast-back, or fatigue. Add dwell bands and scroll depth bins for `article_view`.
2. Identity graph confidence not modeled: merges/splits, shared devices, and cross-browser require per-link confidence and recency-aware trust.
3. Cold start defaults unclear: backstop with cluster-level priors (from `hooks_master.csv`) and popularity/seasonality priors when user data is thin.
4. Content representation limited: hook clusters exist, but add embeddings for creative text, landing content, and keyword phrases to power “people also like.”
5. Decay schedule static: make half-life learnable by stage and entity type (short for hooks/creatives, longer for categories/brands).
6. Exploration is ad hoc: adopt contextual multi-armed bandits (Thompson/UCB) and log propensities for off-policy evaluation.
7. Measurement gaps: no consistent exposure/impression log with policy metadata; add arm, candidate set, and propensity to each exposure.
8. Frequency and fatigue: define cross-surface caps (per creative/brand/category) and cool-down windows; include novelty penalty in ranking.
9. Retargeting burn rules: ensure purchase/lead burns and post-conversion cooling; category adjacency rules to avoid irrelevant follow-ons.
10. Competitor expansion guardrails: cap share, use similarity thresholds, and exclude sensitive/regulated categories.
11. Event integrity: enforce Pixel↔CAPI dedup via shared `event_id`; measure event latency, EMQ, and dedup rate (see `infra/20-capi-setup.md`).
12. Privacy/consent: persist consent state with events; hash match keys; set data retention windows; avoid PII joins beyond contract.
13. Budget coupling: NBA should be aware of spend ceilings and marginal CPA/ROAS by arm to avoid cheap CTR that doesn’t convert.
14. Cross-channel coherence: unify caps and burn across paid (FB), onsite modules, and email; avoid contradictory messaging.

### 4) Event Schema (additions/clarifications)
- `ad_view(ad_id, creative_id, campaign_id, hook_id, category_id, ts)`
- `ad_click(ad_id, creative_id, ... , ts)`
- `article_view(lpid, topic_id, dwell_seconds, scroll_pct, ts)` with dwell bands
- `keyword_click(topic_id, keyword_phrase, ts)`
- `advertiser_click(merchant_id|offer_id, predicted_value_usd, ts)` → server `Purchase` via CAPI with shared `event_id`
- `lead|purchase(entity_id, value_usd, ts)`
- Negatives: `hide_ad`, `mute_brand`, `quick_bounce(<5s)`
- System: `exposure(surface, candidate_type, candidate_id, arm, propensity, ts, frequency_snapshot)`

### 5) Affinity Update Logic
Score update per event: `Δ = weight(event_type, stage) × recency_decay(Δt, half_life_by_entity) × quality_factor`
- Maintain `affinities(user_id, entity_type, entity_id, score, confidence, last_event_ts, provenance)`
- Store provenance (which events contributed) for auditability and debugging.

### 6) Candidate Families & Policy
- Families: **Retargeting** (product/service/brand), **Similar Content** (hook/topic/cluster), **Competitor Expansion** (brand/category graph).
- Ranking: `score = decayed_affinity × arm_value` → re-rank with diversity (MMR), novelty/fatigue penalty, and apply caps/burn/cool-down.
- Exploration: 5–15% controlled via Thompson Sampling or UCB; log propensities.
- Stage defaults:
  - High intent (keyword_click, lead): 70–85% retargeting; 10–20% competitor; 5–10% similar content.
  - Mid intent (engaged read): 40–60% similar; 30–50% retarget; ~10% competitor.
  - Low intent (view or shallow read): 60–80% similar; low retarget; small exploration.

### 7) Data Model (minimal viable)
- `identities(user_id, source_ids..., link_confidence, updated_at)` — identity graph with confidence.
- `events(user_id, event_type, entity_type, entity_id, metadata, ts, consent_state)`
- `entities(entity_id, entity_type, attributes)` — hooks, topics, categories, brands, products.
- `affinities(user_id, entity_type, entity_id, score, confidence, updated_at, provenance)`
- `similarities(a_entity, b_entity, sim, relation_type, method)` — hooks/topics/brands/categories.
- `exposures(user_id, surface, candidate_type, candidate_id, arm, propensity, ts)`
- `frequency_caps(user_id, key, window, count, updated_at)`
- `nba_recommendations(user_id, candidate_type, candidate_id, score, policy_meta, ts)`

### 8) Mapping to Current Assets & Code
- Hooks & clusters: `backend/runs/hooks_master.csv` → seed hook↔hook/topic similarities.
- Competitors & categories: `backend/runs/competitors_index.csv`, `backend/src/lib/categoryMap.ts` → brand/category graph.
- Hook extraction and forcekeys: `backend/src/lib/hook.ts`, `backend/src/lib/forcekeys.ts` → event enrichment and topic inference.
- CAPI: `docs/infra/20-capi-setup.md` → server `Purchase` at advertiser click with match keys and dedup.
- Storage/API: `backend/src/lib/supabase.ts` → tables above for events/affinities/similarities/exposures.

### 9) MVP Experiments (2–3 weeks)
Week 1
- Implement event schema; backfill a week of events. Nightly batch computes `affinities` with decay.
- Build similarity graph from hooks_master + simple text embeddings.

Week 2
- Policy service: return top‑K NBA per user with caps/cool-downs; ship Retargeting + Similar Content.
- Start 10% exploration with Thompson Sampling; log propensities in `exposures`.

Week 3
- Add Competitor Expansion with strict guardrails; small spend allocation; monitor incremental ROI.
- Add holdout cohort for counterfactual evaluation; start tuning half-life per entity type.

### 10) Telemetry & KPIs
- Delivery: event latency p50/p95, EMQ, dedup rate, signal completeness.
- Learning: exploration share, arm value posteriors, off-policy AUC.
- Outcomes: CTR, CVR, ROAS, time-to-conversion, negative feedback rate, cap hit rate.
- Incrementality: arm-level lift vs. holdout; competitor arm ROI.

### 11) Safety & Compliance
- Consent-first; hash `em/ph`; retention windows; regulated category exclusions.
- Burn after purchase/lead; suppression windows; household/device ambiguity handling.
- Platform alignment: broad-learning campaigns (ASC/CBO) fed by high-quality signals; avoid brittle micro-segmentation.

### 12) Concrete Next Steps
1) Extend tracking to include negatives, dwell bands, keyword_click; implement shared `event_id` for Pixel↔CAPI dedup.
2) Stand up `events`, `affinities`, `similarities`, `exposures` tables in Supabase; ship nightly affinity job.
3) Implement NBA service with three candidate families, caps, and Thompson Sampling; log propensities.
4) Build daily dashboards for KPIs; add alerting on signal integrity (latency, EMQ, dedup).
5) Run controlled tests: baseline retargeting vs. mixed policy; measure incrementality and adjust arm shares.

— Systems Architect (Zuckerberg‑inspired)


