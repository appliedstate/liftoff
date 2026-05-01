---
id: edge-workflow-campaign
version: 0.1.0
owner: growth-ops
title: Edge — Repeatable Campaign Workflow (Category → Script → Keywords → Video → Setup)
purpose: A single, repeatable workflow for launching campaigns with high throughput and clean automation hooks.
---

## Overview

This workflow produces a **Campaign Packet** (5 artifacts) that can be executed manually today and automated step-by-step by an agent later.

### RSOC arbitrage reality (critical context)

For our RSOC flow, **we are not the end advertiser**.

Typical pathway:

**Meta video ad → Article/LPID (with RSOC widget) → Google/RSOC advertiser**

That means:
- The **ad must not make claims the article can’t support**.
- The **article must stay within AdSense/RSOC-safe policy** (no deceptive or disallowed claims).
- Since we don’t control which advertiser wins an auction downstream, our creative should be **informational and non-promissory** (avoid guarantees, “this will fix you”, etc.).

### The 5 artifacts

1) **Category**
2) **Ad script**
3) **Keywords**
4) **Video ad**
5) **Setup**

## Inputs (minimum viable)

- **Strategis campaign ID** (e.g. `sige41p0612`)
- **Campaign name** (full)
- **Network**: Facebook
- **Ad account**: name + ID (Nautilus)
- **Knowledge warehouse / site key** (e.g. `tech advance daily - 1`)
- **Market**: country/state if needed (e.g. US)

## Output location (Campaign Packet)

Create a folder (example):
- `docs/edge/campaigns/<date>__<vertical>__facebook__<strategisId>/`

Inside it, keep these 5 files:
- `01_category.md`
- `02_ad_script.md`
- `03_keywords.md`
- `04_video_ad.md`
- `05_setup.md`

> Templates live in `docs/edge/templates/campaign-packet/`.

## Workflow (repeatable)

### 1) Category + Article/LPID (generate destination first) (20–60 min)

**Goal**: choose a CategorySlug and create/select the **destination article (LPID)** that becomes the source-of-truth for what we can safely claim.

- **Decide**
  - **Vertical**: e.g. `internet`
  - **CategorySlug**: kebab-case, no dates (see `docs/marketing/buyer-guide-naming-and-campaign-templates.md`)
  - **LPID / Article**: generate in the S1 Article Generator (or select an LPID from Article Factory)
  - **Content Generator fields (required)**:
    - Domain
    - Topic (**must equal the PRIMARY RSOC widget phrase** you want users to click)
    - Marketing Angle
    - Target Geo
    - Target Language
  - **Submission outputs (required)**:
    - Submission ID
    - Final article link
  - **Promise**: 1 sentence the **article truly supports**
  - **Pathway**: Meta → Article/LPID → RSOC widget → advertiser
  - **Constraints**: compliance/policy, geo, age, device

- **Write**
  - Fill `01_category.md` including:
    - article URL/headline
    - “claim inventory” (allowed vs forbidden)
    - RSOC widget keyword seed list (initial)

**Automation hook (later)**:
- Agent proposes CategorySlug + drafts an article outline + creates a first-pass claim inventory.

### 2) Ad script (20–40 min)

**Goal**: create 1 “master script” + 3 hook variants (first 2 seconds) that match the **article promise** and pass a policy filter.

- **Framework reference**
  - Use `docs/edge/workflows/ad-copy-framework.md` (persona, hook formula, scoring rubric).

- **Decide**
  - Primary hook
  - 2–3 alternates (authority, contrarian, local proof, etc.)
  - CTA
  - Required disclosures

- **Write**
  - Fill `02_ad_script.md` **and include a claim map**:
    - every “claim” in the ad points to a supporting line/section in the article
    - no medical/financial guarantees, no diagnosis, no “you have X”

**Automation hook (later)**:
- Agent generates scripts from a hook library, enforces vertical policy, and auto-builds a claim→article mapping.

### 3) Keywords (15–30 min)

**Goal**: define keyword sets that align with the **article + RSOC widget**, and pass a policy filter.

- **Decide**
  - **Core**: 10–30 keywords (high intent)
  - **Adjacent**: 20–50 keywords (expansion)
  - **Negatives**: obvious junk / mismatches

- **Write**
  - Fill `03_keywords.md` including:
    - policy denylist patterns
    - mapping: keyword cluster → which ad angle → which article section/widget intent

**Automation hook (later)**:
- Agent mines keywords from URLs/RSOC widgets, campaign redirect URLs, and historical winners.

## Policy filter (required for RSOC/AdSense safety)

Apply this filter to **ads + keywords + article** before launch:

- **No unsupported claims**: if the article can’t substantiate it, remove it from the ad.
- **No diagnosis/personal attributes** (especially health): avoid “you have”, “your condition”, “this detects/diagnoses”.
- **No guaranteed outcomes**: avoid “will”, “guaranteed”, “instant”, “cure”, “fixed”.
- **No deceptive urgency/scare**: avoid fear-based medical certainty.
- **No prohibited keyword intent**: add negatives for disallowed topics (e.g., “free”, “instant results”, extreme medical claims).

### 4) Video ad (30–90 min)

**Goal**: produce a video brief that can be executed by humans today and by generation tooling later (Veo/Sora).

- **Decide**
  - Format mix target: 9:16 / 4:5 / 1:1 (per Creative Factory)
  - Length: 15s / 30s
  - Visual structure: hook → proof → CTA
  - Shot list / overlays / captions

- **Write**
  - Fill `04_video_ad.md`

**Automation hook (later)**:
- Agent transforms the script + shot list into a generation prompt and triggers `backend` video scripts.

### 5) Setup (20–45 min)

**Goal**: build the campaign in Ads Manager with clean naming + minimal variance.

- **Decide**
  - Template: CBO Conversions / Lead Gen / ABO test (see buyer guide)
  - Budget tier + bid strategy
  - Ad set structure (2–6 to start)
  - Ad count cap (≤ 12 target)

- **Write**
  - Fill `05_setup.md`
  - Run the daily reporting workflow once live: `docs/edge/daily-review.md`

**Automation hook (later)**:
- Agent generates a “setup spec” JSON and (eventually) calls a creation API / Terminal decision workflow to create entities.

## Post-launch: marketing feedback loop (required)

This is how we “get better every time” without guessing.

### When to update the packet

- **D0–D3**: creative signal read (hooks/angles)
- **D3–D7**: economics read (what can actually scale)
- **Weekly**: consolidate learnings into new templates

### What to log (minimum)

- **Winners**: which of the 5 angles won on economics
- **Losers**: which failed (and why: CTR vs CVR vs economics)
- **Keyword alignment**: which phrases/intent clusters matched winners
- **Asset deltas**: what changed between winners vs losers (hook line, overlay, pacing, proof, CTA)
- **Net-new plays**: if a buyer found a reusable edge, log it with `docs/operations/templates/buyer-discovery-play.md`

### Optimization point (the loop’s “tightest lever”)

To compound fastest, optimize in this order:

1) **Hook/angle fit** (fastest feedback; improves CPM/CTR and qualified clicks)
2) **Message match** (ad promise ↔ landing promise; fixes CTR→CVR gaps)
3) **Economics** (vRPS / Session ROAS or ROAS; governs scale decisions)

## Quality gates (non-negotiable)

- **Naming**: conforms to the buyer guide; Strategis ID remains discoverable.
- **Single source of truth**: campaign packet folder is up to date.
- **Launch freeze**: no edits for 48–72h unless emergency (see `docs/operations/60-launch-protocol.md`).
- **Shared-edge rule**: validated discoveries must follow `docs/operations/buyer-incentive-system.md` for proof, alpha window, and publication.
- **Daily review**: use the Edge report and take one action/day.

