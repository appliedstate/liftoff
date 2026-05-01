---
id: edge-workflow-automation-roadmap
version: 0.1.0
owner: growth-ops
title: Edge — Automation Roadmap (Agent-assisted campaign creation)
purpose: Define what an agent can automate now vs later for the 5-step workflow.
---

## Principle

Automate **paperwork first**, then **decision support**, then **execution**.

## Step-by-step automation

### 1) Category

- **Now (safe)**:
  - generate 3–10 CategorySlug candidates
  - pull historical metrics by category (if available)
  - produce a 1-page category brief draft
- **Later (risky)**:
  - auto-select category without human approval

### 2) Ad script

- **Now (safe)**:
  - generate scripts + 3 hook variants from a prompt template
  - enforce “no forbidden claims” rules by vertical
  - output a script + overlay text + CTA variants
- **Later (risky)**:
  - auto-ship scripts into production without review

### 3) Keywords

- **Now (safe)**:
  - extract keywords from LP/redirect URLs + widget phrases
  - cluster into Core/Adjacent/Negatives
  - create a “keyword pack” in `03_keywords.md`
- **Later (risky)**:
  - automatically broaden/narrow keyword sets based on spend without review

### 4) Video ad

- **Now (safe-ish)**:
  - convert `02_ad_script.md` + `04_video_ad.md` into generation prompts
  - trigger video generation tooling (Veo/Sora scripts) and save outputs
  - auto-name assets per conventions
- **Later (risky)**:
  - auto-upload creatives and start spending without review

### 5) Setup

- **Now (safe)**:
  - generate a “setup spec” checklist from the buyer guide templates
  - validate naming, required fields, and counts (ad caps)
- **Later (risky)**:
  - programmatic entity creation + budget changes (requires strong guardrails + idempotency)

## What we can do immediately in this repo

- Create a campaign packet in seconds:
  - `cd backend && npm run edge:packet -- --campaign-name="..." --vertical=internet`
- Run daily stats and recommendations:
  - `cd backend && npm run edge:campaign-daily -- --campaign-id=<id>`

