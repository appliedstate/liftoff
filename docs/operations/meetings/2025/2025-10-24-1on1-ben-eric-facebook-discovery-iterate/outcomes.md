---
date: 2025-10-24
title: "1:1 — Eric & Ben — Facebook Discovery + Iterate — Outcomes"
type: outcomes
participants:
  - Eric Roach
  - Ben
context:
  team: Arbitrage / Facebook
  company: Liftoff
source_transcript: ./transcript.md
tags:
  - meeting
  - outcomes
  - 1on1
  - facebook
  - iterate
---

# Executive Summary

Aligned on a tighter Facebook Discovery Pipeline that ranks categories by persistence signals and feeds Iterate, and on Iterate guardrails that favor candid, mobile-native aesthetics. Agreed to formalize a Facebook CoPilot daily session that surfaces outliers via ROAS bands and suggests next actions. Next steps are to add provenance in Iterate outputs, support vertical 9:16 video with captions/VO options, implement discovery scoring/backlog export, and draft the CoPilot PRD and wireframe.

## Decisions

- Use persistence signals for discovery: active ≥ 7–10 days, multiple unique versions, recent activity.
- Discovery produces a weekly ranked backlog (10+ categories) with links, rationale, and status.
- Iterate must show provenance: display originating assets and prompts for every generated output.
- Iterate creative guardrails: avoid over-polished/stock look; prefer candid, everyday, mobile-native ("shot on phone") feel.
- Video defaults: provide an 8s variant with 2 scenes (attention-grabbing close-up then post-treatment), with vertical 9:16 support, captions on by default, and optional voiceover variants.
- CoPilot session: dashboard-driven daily ritual using ROAS bands (≥160 outstanding; 140–160 good; 120–140 fair; break-even next; losses inspected by absolute $). Sort by volume (spend/conversions) for 80/20 review; quick actions for budget up/down; drill-in when negative.
- Keep human-in-the-loop for multi-clip video assembly (Catherine) while upstream automation accelerates selection and prep.

## Actions (Tasks)

- [ ] Add "originating assets" and prompt panel to Iterate galleries — Owner: Eric — Due: TBD — Priority: H
- [ ] Add vertical 9:16 export, captions toggle, and voiceover option to Iterate video lane — Owner: Eric — Due: TBD — Priority: M
- [ ] Write creative style guardrails checklist; bake into Iterate prompts — Owner: Ben (spec), Eric (impl) — Due: TBD — Priority: H
- [ ] Implement discovery scoring + backlog exporter (weekly 10+ categories) — Owner: Dan — Due: TBD — Priority: H
- [ ] Draft PRD + wireframe for Facebook CoPilot session (dashboard + actions) — Owner: Eric — Due: TBD — Priority: H
- [ ] Pilot: assemble a 15s, 4–5 clip video for one category using Iterate outputs — Owner: Catherine — Due: TBD — Priority: M

## Projects

- Project: Facebook Category Discovery Pipeline — Outcome: Weekly list of 10+ vetted categories with supporting links and rationale — Owner: Dan
- Project: Iterate (Creative iteration engine) — Outcome: Weekly batch of validated ad variants and learnings — Owner: Eric
- Project: Facebook CoPilot — Outcome: Daily decision ritual with surfaced outliers and suggested actions — Owner: Eric

## Principles

- Principle: Contribution over management; reduce coordination tax
- Principle: Quality first; enforce accurate setup to prevent rework

## Product PRDs

- PRD: Facebook Category Discovery Pipeline — Link: docs/prd/facebook-category-discovery-pipeline.md — Status: draft
- PRD: Iterate — Link: docs/prd/iterate.md — Status: draft
- PRD: Facebook CoPilot — Link: docs/prd/facebook-copilot.md — Status: draft
- PRD: Reconciled Facebook Reports API — Link: docs/prd/reconciled-facebook-reports-api.md — Status: reference
- PRD: Terminal Facebook Bidder — Link: docs/prd/terminal-facebook-bidder-prd.md — Status: reference

## Risks and Unknowns

- Risk: <description> — Mitigation: <plan>
- Risk: <description> — Mitigation: <plan>

## Topics

### Facebook Discovery Pipeline

- Signals: active ≥ 7–10 days; multiple unique versions; recent new ads; platform breadth.
- Inputs: Meta Ad Library/API, manual review, alternate sources; extract landing URLs and Pixel IDs when possible.
- Output: Ranked backlog with links, rationale, signals, and status; 10+ per week cadence.
- Immediate next: implement scoring, exporter, and sheet/gallery output.

### Iterate

- Inputs: Source ads, transcripts, hooks, visual motifs; winners from Discovery.
- Process: Rip → Reskin → Run; show provenance; batch generation; validation by style guardrails.
- Video lane: default 8s, 2 scenes; provide 9:16 vertical; captions default on; optional voiceover; avoid literal "iPhone" in prompts but emulate phone-shot look.
- Output: Shortlist of 3–5 variants per category; gallery with source→output mapping and prompts.

## Notes Organized by Workflow

1. Trigger/Context
2. Inputs
3. Process
4. Outputs
5. Feedback/Monitoring

## Source References

- See transcript: `./transcript.md`


