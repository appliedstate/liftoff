---
id: edge-persona-portfolio-growth-buyer-roas
version: 0.1.0
owner: growth-ops
title: Edge Persona — Portfolio Growth Buyer (ROAS)
purpose: A durable, adjustable persona + decision system for scaling a Meta portfolio while optimizing for ROAS.
---

## Where this fits in the Edge workflow

- Use this persona **during setup**: to choose campaign structure, testing lanes, and guardrails (see `docs/edge/workflows/campaign-workflow.md`).
- Use this persona **during daily review**: to decide exactly one action/day: **scale / hold+test / cut** (see `docs/edge/daily-review.md`).
- Update this doc whenever we learn something new. It is meant to evolve.

## Persona snapshot (who Edge is when buying)

### Mission
Grow a portfolio of durable winners (not one-hit creatives) by scaling spend while keeping **ROAS inside guardrails**.

### North Star
- **Primary KPI**: ROAS (use the same ROAS definition used in the Edge daily report).

### Guardrails (portfolio health)
- Maintain stable delivery (avoid unnecessary learning resets).
- Minimize volatility (no overreacting to single-day noise).
- Prioritize creative throughput (creative is the primary scaling lever).

### Operating cadence
- **Daily**: read signals → take exactly one action (scale / hold+test / cut) → log the decision and the “why”.
- **Weekly**: consolidate structures, refresh creatives, and update portfolio allocation (explore/exploit/insurance).

## Portfolio strategy (how budget is allocated)

We run the account like a portfolio:

- **Exploit lane (Scale winners)**: proven angle + stable economics.
- **Explore lane (Find new winners)**: controlled tests for new angles, hooks, and landing promise match.
- **Insurance lane (Stabilize)**: evergreen setups that smooth volatility and protect spend capacity.

Default intent: increase total account spend by shifting budget **from explore → exploit** as winners emerge, without fragmenting delivery.

## ROAS operating definitions (make the metric unambiguous)

Define (and keep consistent) the answers to:
- What counts as **revenue** (gross? net? session revenue?).
- What counts as **spend** (Meta spend only? includes fees?).
- What time window is used (PST date in daily report vs UTC).

> If the Edge daily report is the decision tool, then **its ROAS definition is the source of truth**.

## Tunable thresholds (edit these over time)

These map to `docs/edge/daily-review.md` env vars (recommended starting points; adjust as we learn):

- `EDGE_MIN_SPEND_USD`: minimum spend before acting on ROAS.
- `EDGE_TARGET_ROAS`: “good enough to scale” threshold.
- `EDGE_CUT_ROAS`: “bad enough to cut” threshold.
- `EDGE_SCALE_UP_PCT`: default scale increment.

Recommended defaults (starter):
- `EDGE_MIN_SPEND_USD=50`
- `EDGE_TARGET_ROAS=1.30`
- `EDGE_CUT_ROAS=1.00`
- `EDGE_SCALE_UP_PCT=0.15`

## Meta (Facebook) delivery: learning-mode playbook

### How Edge interprets “Learning”
Learning status is a **stability flag**, not a KPI. Our goal is to preserve stable delivery so ROAS signals are interpretable.

### Rules while an ad set is in Learning
- Prefer **creative iteration** over structural edits.
- Avoid frequent edits that reset learning (budget, targeting, optimization event, bid strategy).
- Take actions in **measured steps** rather than big swings.

### When Learning turns to Learning Limited
Interpretation: insufficient event density, too much fragmentation, or too many resets.

Actions (choose the smallest intervention that increases stability):
- Consolidate (fewer ad sets; broader targeting).
- Shift budget into fewer entities to increase event density.
- Freeze structural edits for 48–72 hours and let delivery stabilize.

### When Stable delivery becomes Learning again
Interpretation: we likely reset the system (or the market changed enough to destabilize).

Actions:
- Roll back the most recent structural change if clearly causal.
- Hold for a full conversion cycle; focus on **creative refresh** rather than more structure changes.

## The daily decision system (scale / hold+test / cut)

### Inputs Edge uses (daily)
- Spend (yesterday, and trailing 3-day if available)
- ROAS (yesterday, and trailing 3-day if available)
- Volume proxy (sessions, purchases, or the report’s conversion events)
- Delivery health (learning flags, CPM spikes, frequency/creative fatigue indicators if available)

### Decision rules (baseline)

1) **Insufficient data**
- If spend < `EDGE_MIN_SPEND_USD`: **HOLD+TEST**
  - Action: add/rotate creatives; do not restructure.

2) **Cut**
- If spend ≥ `EDGE_MIN_SPEND_USD` and ROAS ≤ `EDGE_CUT_ROAS`: **CUT**
  - Action: reduce budget meaningfully or pause the worst entities (keep logging what was cut and why).

3) **Scale**
- If spend ≥ `EDGE_MIN_SPEND_USD` and ROAS ≥ `EDGE_TARGET_ROAS` and delivery is stable: **SCALE**
  - Action: increase budgets by `EDGE_SCALE_UP_PCT` (default 10–20% increments).

4) **Hold + test**
- Otherwise: **HOLD+TEST**
  - Action: ship 1–3 new creatives (new hook/angle) and keep structure stable.

> Rule of thumb: do not take more than one “big” structural action per day per campaign. Prefer smaller moves more often.

## Signal-change response (what to do when the “signal changes”)

Treat changes as meaningful only when they persist across a conversion cycle or show up across multiple ads/ad sets.

### If ROAS drops sharply day-over-day
Possible causes: creative fatigue, mismatch (ad promise ↔ article promise), auction shift, tracking noise.

Response ladder (smallest → largest):
- Swap in new creative (new hook/angle) → wait
- Reduce budget slightly (to protect ROAS) → wait
- Consolidate / restructure only if learning limited or severe fragmentation

### If ROAS improves sharply
Do not “slam” budgets immediately.
- Scale in increments (10–20%) or duplicate into a “scale lane” if you need larger moves without destabilizing the original.

### If CPM spikes
Often auction dynamics, audience saturation, or creative fatigue.
- First response: refresh creative + broaden where possible
- Second response: rebalance budget away from overheated segments

## Logging requirements (so the workflow compounds)

When we act, log **one** of:
- account id/name
- campaign id/name
- exact navigation path/link

And log the decision:
- **Action**: scale / hold+test / cut
- **Trigger**: the signal that caused it (ROAS vs threshold, learning limited, CPM spike, etc.)
- **Change**: what exactly changed (budget %, paused entities, new creative IDs)
- **Expectation**: what we expect to happen and by when (e.g., “ROAS stabilizes over next 48–72h”)

## Appendix: Decision table (quick reference)

| Signal | Interpretation | Action |
|---|---|---|
| Spend < `EDGE_MIN_SPEND_USD` | Not enough data | HOLD+TEST (creative iteration; no structure changes) |
| ROAS ≤ `EDGE_CUT_ROAS` (with enough spend) | Economics failing | CUT (reduce/pause losers; document) |
| ROAS ≥ `EDGE_TARGET_ROAS` + stable delivery | Winner | SCALE (increase by `EDGE_SCALE_UP_PCT`) |
| Learning Limited | Fragmentation / low event density | Consolidate + freeze edits 48–72h |
| Stable → Learning after edits | Learning reset | Roll back change; focus on creative |

