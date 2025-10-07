---
id: creative/40-creative-factory
version: 1.1.0
owner: growth-ops
runtime_role: agent
title: Creative Factory — Supply for Compounding Scale
purpose: Operational blueprint to produce, name, QA, and deploy creatives that feed ASC/LAL lanes at compounding velocity. Tight contracts so Terminal can promote/prune without wobble.
dependencies:
  - strategy/11-machine-strategy.md
  - operations/61-promotion-prune-scale.md
  - operations/62-budget-bump-protocol.md
  - operations/63-dashboards-and-alerts.md
  - operations/55-entity-roadmap-and-orchestrator.md
  - content/30-article-factory.md
  - taxonomy/01-schema.md
  - infra/capi-setup.md
kpis:
  creative_hit_rate_7d: "≥ 15% of Sandbox ads promoted"
  adset_ads_cap: "≤ 15 (≤12 target)"
  format_mix: "≥40% 9:16, ≥30% 4:5, ≥20% 1:1"
  lpid_throughput: "2–3 new LPIDs/vertical/week aligned with creatives"
  uplift_gate: "per‑session vRPS ≥ +20% vs acct median with ≥2k sessions"
licensing: internal
---

# 40 — Creative Factory

We run a **manufacturing line**: mine hooks from RSOC intent, produce multi-format ads, enforce naming/metadata, and feed **ASC / LAL** lanes on a fixed cadence. Terminal promotes winners and prunes laggards using objective economics (vRPS, Session ROAS).

---

## 1) Core Definitions

- **Hook** — the big idea; measured at the **concept** level across variants.
- **Working Hook** — concept achieving **vRPS uplift ≥ +20%** vs account median on **≥2,000 sessions (7d)**.
- **Working Unit (Ad)** — specific creative that meets lane CPA ≤ median +25% and not fatigued (freq < 3 or CTR WoW drop < 20%).
- **LPID** — article/landing identifier; each ad must map to **exactly one** LPID.
- **Lanes** — ASC (scaler), LAL 1% (stability), LAL 2–5% (horizontal), Contextual (intent), Sandbox (test), Warm (harvest).

---

## 2) Naming & Metadata (machine-readable)

### 2.1 Ad Name Grammar (must follow)
```
<VERT>-<LPID>-<HOOK>-<FMT>-<LEN>-<GEN>-v<NN>
```
- **VERT**: vertical slug from taxonomy (`auto|finance|health|home-services|travel|internet|saas|other`)
- **LPID**: canonical lpid (kebab-case)
- **HOOK**: short snake_case (e.g., `compare_quotes_fast`, `doctor_nearby_now`)
- **FMT**: `916|45|11` (9:16, 4:5, 1:1)
- **LEN**: seconds bucket `06s|15s|30s|60s`
- **GEN**: `ugc|editorial|motion|carousel|static`
- **vNN**: version counter

**Examples**
```
finance-auto-insurance-compare_quotes_fast-916-15s-ugc-v03
health-primary-care-doctors-find_today-45-30s-editorial-v01
```

### 2.2 UTM Builder (append to all links)
```
utm_source=facebook&utm_medium=cpc&utm_campaign=<campaign_slug>&utm_content=<ad_name>&utm_lpid=<lpid>
```

### 2.3 Asset Filenames
```
<ad_name>__asset.<ext>     # video: mp4; image: jpg/png
<ad_name>__captions.srt
<ad_name>__thumb.jpg
```

**Metadata JSON (stored with asset)**
```json
{
  "ad_name": "finance-auto-insurance-compare_quotes_fast-916-15s-ugc-v03",
  "vertical": "finance",
  "lpid": "auto-insurance",
  "hook": "compare_quotes_fast",
  "format": "9:16",
  "length_sec": 15,
  "genre": "ugc",
  "disclosures": ["results vary", "see terms"],
  "shoot_date": "2025-10-05",
  "actors": ["voiceover"],
  "music_license": "royalty-free-library-123"
}
```

---

## 3) Asset Specs (by format)

| Format | Safe Areas | Duration | File | Notes |
|---|---|---:|---|---|
| **9:16** | 250px top/bottom text-safe | 6–45s | MP4 H.264, ≤ 30MB, ≥ 1080×1920 | **Primary** in Reels/Stories; add burned-in captions |
| **4:5** | 180px top/bottom | 6–60s | MP4 H.264, ≤ 30MB, ≥ 1080×1350 | Feed workhorse; thumb at 1080×1080 alt |
| **1:1** | 160px top/bottom | 6–60s | MP4/JPG, ≤ 30MB, ≥ 1080×1080 | Use for remnant feed & tests |
| **Carousel** | N/A | 3–10 cards | JPG 1080×1080 | First card = big promise + LPID tag |

**Universal**
- **Captions required** (.srt and burned-in)
- **Hooks in first 2 seconds**
- **Brand-safe**: no deceptive UI, clear disclaimers, AEM Purchase(value) #1 downstream

---

## 4) Production Pipeline (D1 → D3)

### D1 — Mining & Briefs
- **Intent mining**: top RSOC queries → themes (e.g., “compare quotes”, “near me”, “top rated”).
- **Brief**: 1–2 sentences + **CTA** + **RSOC angle** + **LPID**.
- **Script**: 60–90 words (for 15–30s); include **compliance lines**.

### D2 — Make
- **Shoot/Assemble**: UGC/editorial/motion.
- **Variants**: minimum **3 per hook** across formats (916, 45, 11).
- **Captions** + thumbs + metadata JSON.

### D3 — QA & Ship
- **QA checklist** (see §8)
- Upload to library; enforce **naming grammar**
- Assign to **Sandbox** ad sets; cap ad count ≤ **12**

**Throughput targets (per healthy vertical)**
- **8–12 new ads/week per LPID**
- **2–3 new LPIDs/week** from Article Factory

---

## 5) Promotion, Prune, Rotate (integrates with Terminal)

- **Promote** (to ASC + LAL 1%): top **10–20%** by score if
  - sessions ≥ **2,000** (7d) **and**
  - per‑session vRPS uplift ≥ **+20%** vs account median
- **Prune**: bottom **50–60%** in Sandbox; or **spend ≥ $150 & 0 purchases**
- **Rotate** for fatigue: if **freq ≥ 3** and **CTR WoW ≤ −20%**, swap **3–5**

> Detailed rules and payload shapes in `/operations/61-promotion-prune-scale.md`.

---

## 6) Testing Design (Sandbox)

- **Budget**: sized to hit **≥ 50 events/ad set/week** across active ads.
- **Ads per set**: **8–12** (avoid fragmentation).
- **Evaluation window**: **48–72h** post-launch; **no edits**.
- **Primary metric**: **per-session vRPS** and **Session ROAS** (7d view); purchases as sanity.
- **Graduation**: top quantile (≥80th in Surge, ≥90th normal).

---

## 7) Hook Library (patterns that win)

- **Outcome-first**: “Lock a lower rate in 60s.”
- **Authority**: “Licensed agents explain why premiums jumped.”
- **Contrarian**: “Don’t shop 100 quotes, do this first.”
- **Proof snippet**: “See average savings by ZIP.”
- **Risk reframe**: “The $12 mistake most drivers make.”
- **Local**: “Doctors near you taking new patients.”
- **Tension**: “You’re probably overpaying because….”
- **PAS** (Problem–Agitate–Solve) for finance/health.

**UGC script skeleton (15s)**
```
HOOK (2s): The $12 mistake…
SETUP (4s): Most drivers renew blindly.
INSIGHT (5s): Compare hidden discounts by ZIP.
CTA (4s): Tap “Compare →” and see your rate.
```

---

## 8) QA Checklist (blockers)

- [ ] **Naming grammar** correct; metadata JSON present
- [ ] **LPID** mapped; UTM appended
- [ ] **Captions** burned-in + .srt attached
- [ ] **Disclosures** included (per vertical policy)
- [ ] **Format** (916/45/11) at required res/size
- [ ] **Hook visible within 2s**
- [ ] **No prohibited claims** (cure, guaranteed, risk-free, etc.)
- [ ] **Frequency risk** assessed (does not duplicate top live unit)

---

## 9) Compliance & Policy

- **Health**: no diagnosis/cure claims; use “may help”, “results vary”.
- **Finance**: no guaranteed savings; cite ranges or “on average” with source.
- **SaaS**: avoid deceptive UI (fake modals, impersonations).
- **All**: AEM **Purchase(value)** ranked #1; privacy disclosures per LPID.

---

## 10) Dashboards (creative tiles)

- **Creative Leaderboard (7d)**: vRPS, sessions, spend, purchases, CPA, CTR, freq
- **Hit Rate**: % Sandbox promoted
- **Fatigue Monitor**: freq vs CTR WoW per lane
- **Format Mix**: 916/45/11 shares
- **LPID Alignment**: creatives per LPID vs target

---

## 11) Data Contracts (warehouse views)

`ops.ad_vrps_view_7d` (used by Terminal)
```
ad_id, ad_name, adset_id, campaign_id, lane, lpid,
sessions, spend, purchases,
per_session_vrps, account_median_vrps,
vrps_uplift, vrps_slope_3d, cpa_24h, cpa_7d, ctr_wow, freq_24h
```

**Join rules**
- `ad_name` parses to `{vertical, lpid, hook, format, length, genre, version}`
- Hard fail if any field missing.

---

## 12) Operating Cadence

- **Mon/Thu Promotion Batches** — promote top **10–20%**, prune bottom **50–60%**.
- **Weekly Orchestrator** — set **production quotas** by category spend band (see `/operations/55-entity-roadmap-and-orchestrator.md`).
- **Intraday** — Terminal may rotate **3–5** units for fatigue; **no** mass promotions intraday.

---

## 13) Acceptance Criteria (Factory “Green”)

- Creative **Hit Rate ≥ 15%** sustained
- **Format mix** meets targets
- **Learning density ≥ 50** events/ad set/week on scaled lanes
- **No ad set > 15** ads; target ≤ 12
- **Session ROAS (7d) ≥ 1.30×** while weekly spend increases

---

## 14) Quick Templates

**Brief**
```
Vertical: finance
LPID: auto-insurance
Hook: compare_quotes_fast
Promise: “Find discounts you’re missing”
Proof: “ZIP-based rate factors”
CTA: “Compare →”
Disclosures: “Rates vary. See terms.”
```

**Shot list (UGC 15s)**
- Opener: selfie, bold text
- Overlay: ZIP savings map
- B‑roll: scrolling RSOC widget
- CTA button close

**Caption (example)**
```
You might be missing hidden discounts.
Compare in 60s →
```

---

## 15) Cross-References

- Scaling triggers & guards: `/strategy/11-machine-strategy.md`
- Promotion/Prune automation: `/operations/61-promotion-prune-scale.md`
- Budget bumps & rollbacks: `/operations/62-budget-bump-protocol.md`
- Dashboards & alerts: `/operations/63-dashboards-and-alerts.md`
- Orchestrator (entities/quotas): `/operations/55-entity-roadmap-and-orchestrator.md`
- LPID production: `/content/30-article-factory.md`
- Taxonomy schema: `/taxonomy/01-schema.md`
