---
id: operations/60-launch-protocol
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: Launch Protocol — Campaign Lifecycle Gates & Transitions
purpose: Strict phases, gates, and transitions for launching and scaling campaigns, modeled after Falcon 9 mission stages.
dependencies:
  - operations/55-entity-roadmap-and-orchestrator.md
  - operations/61-promotion-prune-scale.md
  - operations/61-intraday-optimization.md
  - creative/40-creative-factory.md
  - content/30-article-factory.md
  - infra/capi-setup.md
kpis:
  launch_success_rate: "≥ 85% campaigns reach D7 without emergency brake"
  learning_density: "≥ 50 events/ad set/week by D3"
  promotion_rate: "≥ 15% of Sandbox ads promoted by D7"
  signal_health: "EMQ p50 ≥ 5, latency p50 ≤ 300s throughout"
licensing: internal
---

# 60 — Launch Protocol

Each campaign follows a strict lifecycle modeled after rocket launch phases. Gates prevent premature scaling; transitions are data-driven.

---

## 1) Mission Phases

### T−7d: Design & Planning
**Owner:** Weekly Orchestrator  
**Actions:**
- Review Session ROAS (7d), Learning Density, Creative Hit Rate
- Set production quotas per vertical based on Category Fitness Score
- Define lane mix (ASC, LAL 1%, LAL 2–5%, Contextual, Sandbox)
- Allocate exploration budget (13–20%)

**Gates:**
- Account Session ROAS ≥ 1.25× (minimum viable)
- Signal health green (EMQ/latency)
- Creative pipeline has ≥ 8 ads/LPID ready

**Outputs:**
- Entity roadmap (campaigns/ad sets/ads counts)
- Production quotas (hooks, LPIDs, formats)

---

### T−3d: Integration & Assembly
**Owner:** Creative Factory + Article Factory  
**Actions:**
- Generate hooks via Hook Ideation Agent
- Produce 3+ variants per concept (916/45/11)
- Prepare LPIDs with RSOC widgets
- QA: naming grammar, captions, metadata JSON
- Map ads 1:1 to LPIDs with UTMs

**Gates:**
- Format mix targets: 916 ≥ 40%, 45 ≥ 30%, 11 ≥ 20%
- LPID ready: ≥3k sessions, vRPS ≥ median, widget viewability ≥ 70%
- Compliance cleared per vertical

**Outputs:**
- Library-ready creatives with naming seeds
- LPID URLs with widget keywords

---

### T−1d: Pre-flight Checks
**Owner:** Infra/Ops  
**Actions:**
- Verify AEM Purchase(value) ranked #1
- Check CAPI match keys (email/phone/IP/UA/fbc/fbp)
- Validate event deduplication
- Confirm taxonomy mapping
- Test signal flow end-to-end

**Gates (blockers):**
- EMQ p50 ≥ 5 for last 24h
- Latency p50 ≤ 300s for last 24h
- No schema drift alerts
- All UTMs properly formatted

**Outputs:**
- Signal health dashboard green
- Go/no-go decision

---

### T−0: Launch
**Owner:** Launcher (human/CI)  
**Actions:**
- Create entities per lane roadmap
- Upload creatives respecting ad caps (≤15, target ≤12)
- Set initial budgets sized for ≥50 events/ad set/week
- Enable Advantage+ (ASC) for main scaler
- No dynamic creative at launch

**Gates:**
- All ads mapped to active LPIDs
- Budget allocation matches lane strategy
- Format mix within tolerance

**Outputs:**
- Live campaigns/ad sets/ads
- Cooldown registry initialized

---

### T+0 to T+48–72h: Launch Freeze
**Owner:** Terminal (monitoring only)  
**Actions:**
- **NO EDITS** — platform learning phase
- Monitor delivery, early funnel signals
- Log but don't act on variance

**Monitoring:**
- Impressions ramping
- CTR vs baseline
- Early conversion signals
- Frequency < 2.0

**Emergency brake only if:**
- Signal health fails (EMQ < 3 or latency > 500s)
- Spend pace > 200% of plan
- Policy violation

---

### D3: Max-Q (Maximum Dynamic Pressure)
**Owner:** Intraday Optimizer (cautious mode)  
**Actions:**
- Begin nowcasting with limited history
- Watch for CPM shocks (> +15% vs baseline)
- Monitor CTR WoW (even if limited data)
- Check frequency acceleration

**Gates for any action:**
- Cooldown ≥ 4h between changes
- Max +10% budget bump (if ROAS ≥ 1.35× sustained 2h)
- Max −15% trim (if ROAS ≤ 1.20× sustained 2h)

**Outputs:**
- First intraday adjustments (if gates met)
- Baseline establishment for hour-of-week

---

### D3–7: Stage Separation
**Owner:** Promotion/Prune (Mon/Thu batches)  
**Actions:**
- Evaluate Sandbox performance
- Promote top 10–20% to ASC + LAL 1%
- Prune bottom 50–60%
- Maintain ad caps

**Promotion gates:**
- Sessions ≥ 2,000 (7d)
- Per-session vRPS ≥ +20% vs account median
- No frequency fatigue (< 3.0)

**Prune triggers:**
- Spend ≥ $150 with 0 purchases
- vRPS < 50% of account median
- CTR < 50% of vertical baseline

**Outputs:**
- Working Hooks graduated
- Sandbox refreshed
- Ad caps maintained

---

### D7+: Orbit Operations
**Owner:** Intraday Optimizer + Terminal  
**Actions:**
- Full intraday optimization
- Budget bumps +10% (2h confirmation)
- Risk-down −15% when needed
- Creative rotation for fatigue

**Ongoing gates:**
- Daily budget increase cap: +30%
- Late-day restrictions: no new scale after 20:00
- Frequency < 3.0 or rotate

**Maintenance:**
- Weekly promotion/prune cycles
- LPID refresh (2–3/week/vertical)
- Baseline updates nightly

---

### D30+: Decay & Refresh
**Owner:** Orchestrator + Creative Factory  
**Actions:**
- Identify fatigued units (CTR WoW ≤ −20% sustained)
- Retire underperformers
- Inject fresh hooks/LPIDs
- Update delay profiles and baselines

**Refresh triggers:**
- Creative Hit Rate < 10% for 7 days
- Session ROAS decline ≥ −10% WoW
- Frequency > 4.0 account-wide

**Outputs:**
- Refreshed creative pipeline
- Updated baselines
- Retirement log

---

## 2) Emergency Procedures

### Signal Failure
**Trigger:** EMQ p50 < 5 or latency p50 > 300s for 2h  
**Action:** Freeze all scaling; diagnose; fix before resume

### Learning Starvation
**Trigger:** < 50 events/ad set/week by D3  
**Action:** Consolidate ad sets; increase budgets; reduce ad count

### Spend Explosion
**Trigger:** Daily spend > 150% of plan  
**Action:** Reduce budgets by 30%; investigate CPM/competition

### Policy Violation
**Trigger:** Ad rejected or account warning  
**Action:** Immediate pause; review all creatives; compliance audit

---

## 3) Gates Summary Table

| Phase | Key Gate | Threshold | Action if Failed |
|-------|----------|-----------|------------------|
| T−7d | Session ROAS | ≥ 1.25× | Delay launch |
| T−3d | Format mix | 916≥40%, 45≥30% | Rebalance production |
| T−1d | EMQ | p50 ≥ 5 | Fix signals |
| T−0 | Ad caps | ≤ 15/set | Reduce ads |
| T+48h | (Freeze) | No edits | Monitor only |
| D3 | Learning | ≥50 events/week | Consolidate |
| D7 | Hit rate | ≥15% promoted | Review creative quality |
| D30 | Fatigue | Freq < 4.0 | Force refresh |

---

## 4) Transition Criteria

**Design → Integration:** Quotas set, lanes defined  
**Integration → Pre-flight:** Creatives ready, LPIDs live  
**Pre-flight → Launch:** All gates green  
**Launch → Freeze:** Entities live  
**Freeze → Max-Q:** 48–72h elapsed  
**Max-Q → Stage Sep:** D3 reached, data sufficient  
**Stage Sep → Orbit:** First promotion cycle complete  
**Orbit → Decay:** D30 or fatigue signals

---

## 5) Acceptance Criteria

- **Launch Success Rate:** ≥ 85% reach D7 without emergency brake
- **Learning Density:** ≥ 50 events/ad set/week by D3
- **Promotion Rate:** ≥ 15% Sandbox ads promoted by D7
- **Signal Health:** Maintained throughout (EMQ ≥ 5, latency ≤ 300s)
- **No Whipsaw:** ≤ 10% of D3–7 changes reversed within 24h

---

## 6) Cross-References

- Production planning: `/operations/55-entity-roadmap-and-orchestrator.md`
- Creative pipeline: `/creative/40-creative-factory.md`
- Promotion rules: `/operations/61-promotion-prune-scale.md`
- Intraday control: `/operations/61-intraday-optimization.md`
- Signal setup: `/infra/capi-setup.md`
