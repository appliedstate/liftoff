---
id: operations/64-l2l-flywheel
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: "L2L Flywheel — Liftoff Campaign Flywheel (Idea → Launch → Optimize → Learn)"
purpose: Canonical end-to-end workflow that turns an idea/opportunity into a launched Facebook campaign and converts learnings into the next wave of creatives + launches, minimizing human-in-the-loop steps.
dependencies:
  - README.md
  - operations/60-launch-protocol.md
  - operations/operations:61-promotion-prune-scale
  - creative/40-creative-factory.md
  - creative/41-hook-ideation-agent.md
  - marketing/buyer-guide-naming-and-campaign-templates.md
  - prd/campaign-factory-flow-diagram.md
  - prd/strategis-campaign-setup-summary.md
  - infra/21-aem-priority.md
source_material:
  - Knowledge/Transcripts/videos/2026-01-16/Facebook Campaign Setup Pt 1 Loom.txt
  - Knowledge/Transcripts/videos/2026-01-16/Facebook Campaign Setup Pt 2.txt
  - Knowledge/Transcripts/videos/2026-01-16/Optimizing Our Tree Cutting Service Ads Strategy.txt
licensing: internal
---

## Flywheel name (canonical)
**Name**: **L2L Flywheel** (Launch-to-Learn)  
**Also known as**: The Scale Machine (macro system), Campaign Factory (implementation)

## One-line definition
**L2L Flywheel** is the repeatable loop that takes **Opportunity → Blueprint → Creatives + LPIDs → Strateg.is tracking → Facebook launch → Optimization → Learnings**, then feeds learnings back into the next creative and launch batch.

## What we’re optimizing for
- **North Star**: Session ROAS + vRPS compounding (see `docs/README.md`)
- **Safety gates**: AEM Purchase(value) priority, CAPI/EMQ, learning density (see `docs/operations/60-launch-protocol.md`, `docs/infra/21-aem-priority.md`)
- **Throughput**: more launches/week with fewer “buyer-only tribal steps”

---

## The end-to-end workflow (minimum human, maximum repeatability)

### 0) Inputs (what you need before starting)
- **Opportunity inputs**
  - **System1**: angle/category + top keywords/states (or existing “category sheet”)
  - **Facebook Ad Library**: competitor ads to clone/abstract (optional but high-leverage)
- **Destination inputs**
  - **Domain/site** you’re launching on (important because “template” + tracking conventions differ)
  - **LPID(s)** (landing/article identifiers) that match the angle and are “LPID ready”
- **Account inputs**
  - Meta ad account + page
  - Pixel/CAPI setup must be healthy (AEM + EMQ/latency)

### 1) Idea → Opportunity (what to test next)
**Owner**: System1 + Discovery services (+ human selection, today)
- Pick an angle/category with:
  - strong System1 RPC/RPS signals, or
  - strong FB Ad Library signals (long-running, many versions, multi-platform)

**Output**: an “Opportunity Card”
- `vertical`, `angle`, `keywords[] (ranked)`, `domain`, `market`, `notes`, `competitor_ad_refs[]`

### 2) Opportunity → Blueprint (structure, budgets, lanes)
**Owner**: Orchestrator (human today; automatable)
- Decide lane mix (ASC/LAL/Sandbox/etc.) and initial budgets.
- Define initial test size that can hit **≥ 50 events/ad set/week** (learning density gate).

**Output**: a “Blueprint”
- lane mix + budgets
- targeting plan (broad vs constrained)
- creative requirements (hooks × formats)
- LPID requirements
- go/no-go gates (AEM + signals)

Reference: `docs/prd/campaign-factory-flow-diagram.md`, `docs/operations/60-launch-protocol.md`

### 3) Blueprint → Creatives (hooks → variants → assets)
**Owner**: Creative Factory
- Generate hooks (ideation + clone mode) using:
  - LPID headline + RSOC keywords (ideation)
  - competitor samples (clone mode)
- Produce variants across formats (9:16 strongly preferred; 4:5 + 1:1 support placements).

**Output**: “Creative Batch (ready)”
- assets + captions + metadata
- machine-readable creative naming (see `docs/creative/40-creative-factory.md`)

### 4) Blueprint → LPIDs / Articles (the destination supply)
**Owner**: Article Factory (exists conceptually; missing canonical doc in repo)
- Ensure LPIDs exist and are “LPID ready” (sessions, vRPS, widget viewability).

**Output**: “LPID Set”
- active URLs to be used in FB ads
- (optional) list of which RSOC keywords should be emphasized in copy/scripts

### 5) Tracking setup in Strateg.is (keywords → tracking URL)
**Owner**: Strateg.is (human today; partly automatable)

This is the “Strateg.is campaign” (tracking) layer that generates a **tracking URL** based on:
- selected **template** (domain-dependent)
- ordered **keyword list** (ranked)

**Repeatable steps (from Loom transcripts)**
- Duplicate an existing Strateg.is tracking campaign when you need a **new URL** for the same category.
- Update:
  - campaign name (include date; see naming section below)
  - keywords list (ranked, copied from the keyword sheet)
- Save, then **Copy Tracking URL**
- Paste tracking URL into a shared sheet for the buyer/launcher

**Output**: “Tracking URL”
- one tracking URL per FB ad set / test unit (depending on your mapping)

### 6) Launch in Facebook (duplicate → swap only high-leverage knobs)
**Owner**: Launcher (human today; automatable only after create endpoints exist)

**Repeatable steps (from Loom transcripts)**
- Start from an existing campaign running on the **same domain** (duplication reduces errors).
- When duplicating:
  - **Disable carry-over social proof** (reactions/comments), so learning is clean.
  - Prefer **ABO budgets** for early category tests (move budget to ad set level).
  - Keep **Advantage+ placements** (auto) 99% of the time.
  - Use **Advantage+ audience** (broad, let algo expand).
  - Only adjust **age** if the offer truly requires it (e.g., solar ≥30; seniors tests at 40/50/55).
- At the **ad level**:
  - Delete all but one ad; edit one; then duplicate (FB bulk URL edit is unreliable).
  - Swap **destination URL** to the Strateg.is tracking URL.
  - Turn off **site links** (avoid extra failure modes).
  - Skip FB “AI options” at launch; keep units fixed.
  - Name ads so you can read the headline/text from the name (or adopt the strict grammar from Creative Factory).
  - Prefer adding a 9:16 version for mobile placements when possible.

**Output**: “Launched campaign”
- campaigns/ad sets/ads live
- freeze window starts (no edits)

Reference: `docs/operations/60-launch-protocol.md`

### 7) Freeze → Optimize → Promote/Prune → Scale
**Owner**: Terminal + Ops cadence
- Freeze for 48–72 hours (monitor only).
- D3+ intraday (small-step scaling under strict gates).
- Mon/Thu batches: promote winners, prune losers, rotate for fatigue.

References:
- `docs/operations/60-launch-protocol.md`
- `docs/operations/operations:61-promotion-prune-scale`

### 8) Learnings capture (turn execution into compounding)
**Owner**: Automation + human review
- Promote what worked:
  - hook patterns (concept-level)
  - LPID pairs that produce vRPS uplift
  - format/length/genre winners
- Record what didn’t:
  - policy failure reasons
  - fatigue patterns
  - targeting constraints that caused learning starvation

**Output**: “Learning Pack”
- update the next Opportunity/Blueprint generation
- feeds Creative Factory briefs (more of what worked)

---

## Naming (what must be unified)

### Current reality (from transcripts)
- Buyers rely on:
  - **Strateg.is campaign ID visible in Strateg.is**
  - **date** embedded in FB campaign name for quick assessment
  - inconsistent buyer-specific suffixes/initials
  - **ad name = headline** for fast scanning (human default)

### Existing template doc (in repo)
- `docs/marketing/buyer-guide-naming-and-campaign-templates.md` defines a pipe-delimited scheme.

### Proposed unified naming (recommended)
Use a stable, machine-readable format that satisfies both:
- **Prefix**: `SID:<strategis_campaign_id>`
- **Then** the pipe-delimited template

Example:
`SID:123456 | BrandX | CONVERSIONS | hookset_treecutting_2026_01_16 | US | FB | 2026-01-16`

This preserves human scan-ability, keeps the **Strateg.is ID** first (as buyers asked), and enables automation.

---

## What’s missing (to make this a complete + efficient flywheel)

### A) Blocking automation gaps (hard blockers)
- **Strateg.is relay “create” endpoints** for Meta entities are missing  
  - Today we can read/update budgets/status, but **cannot programmatically create** campaigns/ad sets/ads/creatives via Strateg.is relay (see `docs/prd/strategis-campaign-setup-summary.md`).
- **Asset upload path** (images/videos) for automated ad creative creation is missing/undefined.
- **Idempotency + rollback** contracts for “create” flows (so retries don’t create duplicates).

### B) Missing “source of truth” artifacts (so humans don’t re-learn tribal steps)
- **Template registry**: “which Strateg.is template to use for which domain/site” (transcript explicitly calls this confusing).
- **Keyword sheet contract**: required columns + ownership + when/where tracking URLs get written.
- **LPID/Article Factory canonical doc**: referenced across docs but missing in this repo path (`docs/content/30-article-factory.md`).

### C) Missing operational glue (to reduce human clicks)
- **Campaign Factory service** (orchestrates Opportunity → Blueprint → Tracking URL → Launch request).
- **Launcher automation**:
  - even if entity creation stays human for now, we can automate “preflight checks” + “launch checklist generation” + “naming + sheets”.
- **Closed-loop learning store**:
  - a structured place to store “Working Hook”, “Working LPID pair”, “policy failures”, “fatigue thresholds” per vertical.

---

## Fast path: minimal-human workflow you can run today (without new backend work)
1) Pick angle/category + keywords (System1 sheet or S1 pack)
2) Pick competitor ads in Ad Library (optional) and download references
3) Create hooks/scripts via Creative Factory rules
4) Ensure LPID(s) are ready and URLs are known
5) In Strateg.is: duplicate tracking campaign → update keywords → copy tracking URL → paste into sheet
6) In Facebook: duplicate similar-domain campaign → delete to one ad → swap URL + upload creative → duplicate ad variants → publish
7) Follow `60-launch-protocol` gates and `61-promotion-prune-scale` cadence

