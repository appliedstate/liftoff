---
id: operations/65-l2l-human-companion
version: 1.0.0
owner: growth-ops
runtime_role: human
title: "L2L Human Companion — Per-Campaign Launch Checklist (timeboxed)"
purpose: A single checklist a human can run to launch a Facebook campaign with minimal wasted motion. Each step includes principles (why), defaults, and a strict timebox.
dependencies:
  - operations/64-l2l-flywheel.md
  - operations/60-launch-protocol.md
  - operations/operations:61-promotion-prune-scale
  - creative/40-creative-factory.md
  - content/30-article-factory.md
  - prd/strategis-campaign-setup-summary.md
source_material:
  - Knowledge/Transcripts/videos/2026-01-16/Facebook Campaign Setup Pt 1 Loom.txt
  - Knowledge/Transcripts/videos/2026-01-16/Facebook Campaign Setup Pt 2.txt
  - Knowledge/Transcripts/videos/2026-01-16/Optimizing Our Tree Cutting Service Ads Strategy.txt
licensing: internal
---

## How to use this doc
- Run it **top to bottom** for each launch.
- Respect the **timeboxes**. If you time out, use the fallback and move on.
- Create a single “Launch Pack” (links + IDs) so you never have to re-trace steps.

---

## Launch Pack (fill this in as you go)
- **Launch date**:
- **Buyer/owner**:
- **Vertical / Angle**:
- **CategorySlug (canonical)**:
- **Domain / Site**:
- **Meta ad account**:
- **Meta page**:
- **LPID(s)**:
- **Top keywords (ranked)**:
- **Competitor ad library links (optional)**:
- **Strateg.is tracking campaign ID(s)**:
- **Strateg.is tracking URL(s)**:
- **Facebook campaign/ad set/ad IDs (after publish)**:

---

## Step 0 — Find the source campaign list (Ben’s sheet)
**Goal**: pick an in-scope campaign/opportunity quickly without hunting.

**Timebox**: **10 minutes**

**What you’re looking for**
- A sheet that lists categories/campaigns to launch with:
  - angle/category, keywords, domain/site, priority, status, and (ideally) example ad links.

**Fast search strategy (pick one)**
- **Drive search**: search for `category backlog`, `facebook backlog`, `campaign backlog`, `discovery pipeline`, `Ben`, `Dan`, `Marina`, `Liftoff`, `Ad Library`.
- **Slack search**: search for `backlog sheet`, `Ben sheet`, `category sheet`, `tracking url sheet`.
- **Ask the nearest human** (lowest latency): “What’s the canonical Ben campaign backlog sheet link?”

**Fallback if you can’t find it in 10 min**
- Use the *next best* source for today:
  - A System1 export / opportunity CSV already in the repo (`backend/src/scripts/system1/...`)
  - A category from FB Ad Library you can validate in 5 minutes (see Step 1B)

**Once found, lock it in**
- Paste the canonical URL here so future-you never hunts again:
  - **Ben sheet URL**: `<PASTE LINK>`
  - **Where it lives (Drive folder / Slack channel)**:

---

## Step 1 — Choose what to launch (opportunity selection)

### 1A) If launching from System1
**Timebox**: **5 minutes**
- Pick 1 angle where:
  - keyword RPC is strong, and
  - you already have (or can quickly produce) matching LPIDs/creatives.

**Principle**
- Don’t pick a category you can’t launch cleanly today. **Speed + quality > novelty**.

### 1B) If launching from Facebook Ad Library (quick manual mode)
**Timebox**: **10 minutes**
- Search the category term (e.g., “tree cutting service”).
- Filter to **active ads**; set a cutoff date so you see ads that have been running.
- Save 2–5 promising ads and grab:
  - ad library URL
  - landing URL (resolved)

**Principle**
- Persistence beats cleverness: prefer ads running **7–10+ days**, multiple versions, multi-platform.

**Output**
- A single “Opportunity Card” (you can paste into Launch Pack fields).

### Category naming (make it computable, not tribal)
**Timebox**: **2 minutes**
- Set **CategorySlug** = a short, stable, kebab-case identifier for the category/angle.
  - Example: `tree-cutting-service`, `erectile-dysfunction`, `solar`, `medicare`
- Use this slug in:
  - your HookSet name,
  - the Strateg.is campaign name,
  - the Facebook campaign name,
  - and any tracking sheet rows.

**Principle**
- If buyers invent category names ad-hoc, reporting and automation break. A stable `CategorySlug` is the smallest fix.

---

## Step 2 — Preconditions (don’t launch into broken measurement)
**Timebox**: **5 minutes**

**Checklist**
- [ ] Domain verified in Meta
- [ ] **AEM**: Purchase(value) is **priority #1** (`docs/infra/21-aem-priority.md`)
- [ ] Signal health is acceptable (EMQ/latency gates per `docs/operations/60-launch-protocol.md`)

**Principle**
- If signal health is red, launching creates noise and wastes learning budget. Fix first.

**Fallback**
- If you can’t verify quickly, launch a **smaller** test or delay launch to next window.

---

## Step 3 — LPIDs / destination readiness
**Timebox**: **10 minutes**

**Checklist (LPID-ready)**
- [ ] LPID exists and URL is known
- [ ] LPID meets readiness gates (sessions/vRPS/viewability) — see `docs/content/30-article-factory.md`
- [ ] LPID matches the angle and has widget keywords relevant to the hook

**Principle**
- Ads must map **1:1** to a destination. If the destination is wrong, you will “blame creative” incorrectly.

**Fallback**
- If LPID readiness is uncertain: use an already-proven LPID for this vertical and launch creatives as the variable.

---

## Step 4 — Creatives ready (minimum viable set)
**Timebox**: **15 minutes**

**Minimum viable set**
- [ ] At least **3–6 ads** ready to run
- [ ] Prefer **9:16** available (mobile first); 4:5/1:1 as support
- [ ] Captions and basic compliance lines ready

**Principles**
- Launch with **fixed units**. Avoid extra FB “AI options” at launch.
- Keep ad set counts and ad counts sane: avoid fragmentation (caps matter).

Reference: `docs/creative/40-creative-factory.md`

---

## Step 5 — Strateg.is tracking (keywords → tracking URL)
**Timebox**: **12 minutes**

**Checklist**
- [ ] Open Strateg.is tracking campaign that matches the **same domain/site**
- [ ] Duplicate tracking campaign if you need a new URL for the same category
- [ ] Update campaign naming (include **date**; include **Strateg.is ID**)
- [ ] Paste **ranked keywords** (from Ben’s sheet / System1 pack)
- [ ] Save, then **Copy Tracking URL**
- [ ] Paste tracking URL into Launch Pack

**Principle**
- Treat Strateg.is as the source of truth for keyword tracking. **Ordered keywords matter.**

**Common gotcha**
- Templates differ by site/domain; if the template looks wrong, stop and confirm rather than “guessing.”

---

## Step 6 — Facebook launch (duplicate → edit one → dupe)
**Timebox**: **20 minutes**

### 6A) Duplicate a “closest match” campaign
- Pick a campaign already running on the **same domain** (reduces mistakes).
- Uncheck carry-over social proof (reactions/comments) if available (clean learning).

**Principle**
- Duplication is the fastest way to preserve correct settings and avoid sloppy configs.

### 6B) Campaign/ad set defaults (use unless you have a reason)
- **Budgeting**
  - Default: **ABO** for early category tests (budget at ad set level)
  - Starting point: ~$30/ad set (adjust to hit learning density)
- **Audience**
  - Default: broad + **Advantage+ audience**
  - Only constrain age if the offer truly requires it (e.g., solar ≥30; seniors test 40/50/55)
- **Placements**
  - Default: **Advantage+ placements** (auto) in most cases

- **Special Ad Categories (Meta)**
  - Default: **do not declare** unless the offer legally requires it (housing/employment/credit).
  - If you declare, expect targeting constraints (often forces broad/18+ behavior).

- **Bid strategy**
  - Default: **highest volume / lowest cost without cap** at launch.
  - Only use **bid caps** when you have clear pacing/CPA volatility reasons (and you know your cap).

### 6C) Ad creation workflow (lowest friction)
- Delete all but **one** ad.
- Edit the one ad:
  - [ ] Destination URL = **Strateg.is tracking URL**
  - [ ] Turn off site links
  - [ ] Upload image/video
  - [ ] Primary text + headline (keep it simple)
  - [ ] Skip/disable FB AI creative options at launch
  - [ ] **Ad name = headline** (default; makes scanning/debugging fast)
  - [ ] (Optional) If using strict naming, ensure the headline is still discoverable from the name
- Duplicate that ad into the remaining variants.

**Principle**
- FB bulk edits are unreliable; **edit one clean unit, then duplicate**.

**Publish**
- [ ] Publish and capture FB IDs into Launch Pack.

---

## Step 7 — Post-launch: freeze + monitor (no “tweaking”)
**Timebox**: **5 minutes now + scheduled checks**

**Checklist**
- [ ] Set a reminder: **no edits for 48–72h**
- [ ] Monitor only: delivery, CTR, frequency, obvious policy issues

Reference: `docs/operations/60-launch-protocol.md`

---

## Step 8 — Optimization cadence (Mon/Thu batch + intraday gates)
**Timebox**: **2 minutes to schedule**
- Schedule:
  - Mon/Thu Promotion/Prune run
  - D3+ intraday checks (only if gates are green)

Reference: `docs/operations/operations:61-promotion-prune-scale`

---

## What to document each launch (so we learn once)
**Timebox**: **3 minutes**
- [ ] Opportunity links (System1 angle or Ad Library URLs)
- [ ] Chosen keywords (ranked)
- [ ] LPID URL(s)
- [ ] Tracking URL(s)
- [ ] Creative names/IDs
- [ ] Any deviations from defaults + why

