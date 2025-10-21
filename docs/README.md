---
id: README
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: The Scale Machine — README
purpose: One-page mental model + operating manual for our AI-driven performance system that turns Facebook signals into RSOC revenue at compounding velocity.
dependencies:
  - strategy/11-machine-strategy.md
  - operations/60-launch-protocol.md
  - operations/61-promotion-prune-scale.md
  - operations/61-intraday-optimization.md
  - operations/62-budget-bump-protocol.md
  - operations/63-dashboards-and-alerts.md
  - operations/55-entity-roadmap-and-orchestrator.md
  - infra/capi-setup.md
  - content/30-article-factory.md
  - creative/40-creative-factory.md
  - attention/10-attention-engine-factory.md
  - taxonomy/01-schema.md
licensing: internal
---

# The Scale Machine

We’re not arbitraging traffic. We’re building a **signal flywheel**: Facebook creates attention → our pages convert attention into **RSOC advertiser value** → value goes back to Facebook via **CAPI Purchase(value)** → the algo finds more of the right people **cheaper**. This README is the **overarching map** of how the pieces fit and the **rules** that guide the machine.

---

## 0) North Star & Outcome

**North Star (maximize):**
\[
\textbf{Session ROAS} = \frac{\text{vRPS}}{\text{CPS}} = \frac{\text{CAPI Purchase(value)} / \text{sessions}}{\text{Spend} / \text{sessions}}
\]

**Target at scale:**  
- Daily spend to **$1M** with **Session ROAS ≥ 1.30×**  
- **< 5% CAC increase** vs baseline  
- **Exploration** budget = **13–20%** (so the flywheel never starves)

**Constraints:** AEM Purchase(value) ranked #1; iOS14+ compliance; Advantage+ first.

---

## 1) System Architecture (mental model)
- **Attention Engine Factory** orchestrates Discovery → Iterate → Test → Decide.
- **Facebook Discovery System** sources winners/categories; feeds **Iterate** and Creative factory backlogs.
- **Iterate** generates brand-swapped variants; outputs galleries/manifests for Sandbox tests.
- **Creative Factory** feeds **ASC / LAL** lanes with winners (Mon/Thu promotion).
- **Article Factory (LPIDs)** hosts RSOC widgets; layouts tuned for **vRPS**.
- **Strateg.is** is reporting/decision surface; APIs power gates and dashboards.
- **Terminal** is the automation brain: budgets, pauses, bid caps, cooldowns.
- **Launcher** (human/CI) handles **entity creation & sharding** when we need parallel scale.

---

## 2) Control Loops (what guides the machine)

We run two loops that align exploration with profitable scale.

### A) Weekly Orchestrator (capacity & compounding)
- **Where:** `/operations/55-entity-roadmap-and-orchestrator.md`  
- **Decides:** how many **campaigns/ad sets/ads**, how many **hooks/LPIDs**, whether to **shard ASC**.  
- **Trigger:** Session ROAS (7d), Learning Density (≥50 events/ad set/week), Velocity (vRPS slope, Event Velocity), Creative Hit Rate.

### B) Intraday Optimizer (safety & acceleration)
- **Where:** `/operations/61-intraday-optimization.md`  
- **Reality:** revenue is delayed (up to **12h**).  
- **Solution:** **nowcast** day-end ROAS using per-campaign **accrual curves** + hour-of-week baselines; bump or trim **within day** under guards.

**Signals hierarchy (strict precedence):**
1. **Signal Health** (EMQ p50 ≥ 5; latency p50 ≤ 300s; dedup ok)  
2. **Learning Density** (≥ 50 events/ad set/week)  
3. **Economics** (Session ROAS level & slope)  
4. **Velocity** (vRPS momentum, Event Velocity, Creative Hit Rate)  
5. **Delivery** (frequency, CPM shocks)

If a higher tier is red, **no scaling action** from lower tiers.

---

## 3) Lanes & Entity Mix (how we structure scale)

| Lane | Role | Optimization | Typical Live Ads | Unique Value |
|---|---|---|---:|---|
| **ASC — Broad** | Main scaler | Purchase (Value) | 20–40 | Explores cheapest pockets once signals are dense |
| **ABO — LAL 1%** | Stability | Purchase (Value) | 10–15 | Smooths CPA, feeds consistent conversions |
| **ABO — LAL 2–5%** | Horizontal reach | Purchase (Value) | 10–15 | New pockets; only graduates from LAL1/ASC |
| **Contextual** | Intent mirroring | Purchase (Value) | 8–12 | Higher vRPS cohorts mapping RSOC queries |
| **Sandbox** | Exploration | Purchase (Value) | 20–40 | Test bed; 10–20% promote weekly |
| **Warm** | Harvester | Purchase (Value) | Lean | Profit add-on; strict frequency control |

**Hygiene:** ≤ **15** ads/ad set (≤ **12** target). No dynamic creative at launch.

---

## 4) Exponential Triggers (how we compound)

- **Surge Mode**: if ROAS7d ≥ **1.35×**, vRPS momentum ≥ **+5%/day**, Event Velocity ≥ **1.25×**, signals green → **+25%** ASC, **+20%** LAL1, promote **top 20%** creatives, prune **bottom 60%**.  
- **Surge Cloning**: hit platform bump limits? Launcher duplicates ASC into **S2/S3** shards; Terminal scales each with +20–30% under cooldown.  
- **Vertical Ratchets**: each vertical gets its own rung ladder; when vertical momentum is positive, raise that vertical’s lanes.

---

## 5) Creative & Content Supply (never starve the algo)

- **Creative Factory:** `/creative/40-creative-factory.md`  
  - Throughput: **8–12** new ads/week **per LPID**; winners promoted **Mon/Thu**.  
  - Promotion rule: per-session **vRPS ≥ +20%** vs account median with **≥ 2k sessions**.

- **Article Factory (LPIDs):** `/content/30-article-factory.md`  
  - “LPID ready” = **≥3k sessions**, **vRPS ≥ median**, widget viewability ≥ **70%**.  
  - Publish **2–3** new LPIDs/week per healthy vertical.

**Format mix (launch target):** 9:16 ≥ 40%, 4:5 ≥ 30%, 1:1 ≥ 20%.

---

## 6) Signals & CAPI (truth, clean and fast)

- **CAPI** objective: **Purchase (Value)** only.  
- **Value:** send **per RSOC advertiser click value**; late arrivals allowed (≤ **12h**): deduplicate via `event_id`, credit to **click hour** in nowcast.  
- **Match keys:** email/phone/IP/UA/fbc/fbp when lawful → raises **EMQ** → cheaper CPM.  
- **Health gates:** **EMQ p50 ≥ 5**, **latency p50 ≤ 300s**; fix before scale.

**Reference:** `/infra/capi-setup.md`, `/20-infra/23-event-dedup-and-match-keys.md`.

---

## 7) Dashboards (what we watch)

- **Gates**: Session ROAS (7d), events/ad set/week, EMQ p50, latency p50, frequency.  
- **Velocity**: vRPS momentum (3-day slope), Event Velocity (conv/hr vs baseline), Creative Hit Rate, LPID throughput.  
- **Economics**: vRPS by LPID, CPS, Session ROAS, vRPM, S1 RPC.  
- **Execution**: Terminal actions log & cooldown registry.

**Reference:** `/operations/63-dashboards-and-alerts.md` (includes alert thresholds & tiles).

---

## 8) Decision SOPs (the three playbooks)

1) **Launch Protocol** — `/operations/60-launch-protocol.md`  
   - Freeze 48–72h, fixed units, clean signals.  
2) **Promotion • Prune • Scale (Mon/Thu)** — `/operations/61-promotion-prune-scale.md`  
   - Promote **top 10–20%** (Surge = 20%), prune **bottom 50–60%**, respect ad caps.  
3) **Intraday Optimization (hourly)** — `/operations/61-intraday-optimization.md`  
   - Nowcast ROAS with delay curves (≤ 12h); bump +10% or trim −15% with 2h confirmation; cap +30% total/day.

**Budget Bumps & Rollbacks:** `/operations/62-budget-bump-protocol.md`

---

## 9) Taxonomy & Orchestration (make it computable)

- **Taxonomy:** `/taxonomy/01-schema.md`  
  - Canonical **verticals** (auto, finance, health, home-services, travel, internet, saas, other)  
  - Clean **categories**; mapping in `/taxonomy/vertical-map.csv`; synonyms resolved

- **Entity Roadmap:** `/operations/55-entity-roadmap-and-orchestrator.md`  
  - Spend bands → **how many** campaigns/ad sets/ads/LPIDs/hooks you must have  
  - **Category Fitness Score** drives weekly production quotas & shard requests

---

## 10) Guardrails (physics, not opinions)

- **Edits per entity:** ≤ **1** per **24h** (weekly SOPs), **intraday cooldown 4h** (and ≤ +30% total/day)  
- **Ads per ad set:** ≤ **15** (target ≤ **12**)  
- **Exploration share:** **13–20%** of account spend  
- **Frequency:** prospecting **< 3.0** (if CTR WoW −20%, rotate 3–5 creatives)  
- **Contextual:** keep only stacks with **vRPS ≥ +10%** vs account median  
- **Emergency brake:** Session ROAS (24h) ≤ **1.20×** and drop ≥ **−15%** vs 7d → **−30%** prospecting budgets; diagnose

---

## 11) Campaign Lifecycle (mission stages)

Like a Falcon 9 launch, each campaign follows strict phases with gates and transitions:

- **T−7d: Design** → Weekly Orchestrator sets quotas, lanes, vertical mix
- **T−3d: Integration** → Creative/Article Factory produce hooks, LPIDs, assets  
- **T−1d: Pre-flight** → CAPI health, AEM #1, taxonomy, naming grammar
- **T−0: Launch** → Entity creation, ad caps ≤15, format mix, sized for ≥50 events/week
- **T+48–72h: Freeze** → No edits during learning; watch early signals
- **D3: Max-Q** → Highest stress; Intraday cautious; CPM/CTR/freq monitoring
- **D3–7: Stage Sep** → Mon/Thu promote top 10–20%, prune bottom 50–60%
- **D7+: Orbit** → ASC/LAL1 scaled; intraday +10%/−15% bumps; creative rotation
- **D30+: Decay** → Refresh hooks/LPIDs; update baselines; retire fatigued units

**Reference:** `/operations/60-launch-protocol.md` (detailed gates & transitions)

---

## 12) Minimal Pseudocode (Terminal's brain)

```python
if emq_p50 < 5 or latency_p50 > 300: freeze_all_scaling()

if weekly_batch_window and gates_green():
    promote(top_creatives(quantile=0.8 if surge else 0.9))
    prune(bottom_creatives(quantile=0.4 if surge else 0.5))
    if surge: bump_budget(ASC, +0.25); bump_budget(LAL1, +0.20)

# Intraday (hourly)
roas_now = nowcast_roas(≤12h delay)
vel = event_velocity_ratio()
if roas_now >= 1.35 and vel >= 1.15 and freq < 3 and confirm_2h():
    bump_budget(campaign, +0.10, cooldown=4h, cap_daily=+0.30)
elif (roas_now <= 1.20 or vel <= 0.80) and confirm_2h():
    trim_budget(campaign, -0.15, cooldown=4h)
if freq >= 3 and ctr_wow <= -0.20: rotate_creatives(3,5)