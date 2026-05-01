---
date: 2026-04-22
title: "Media Buying — Facebook Restrictions Review — Outcomes"
type: outcomes
participants:
  - Eric Roach
  - Anastasia Uldanova
  - Andrew Cook
  - Ben
  - TJ Babbel
  - Brianne Hodenfield
  - Mike Angelov
context:
  team: Media Buying / Facebook
  company: Liftoff
source_transcript: ./transcript.md
tags:
  - meeting
  - outcomes
  - media-buying
  - facebook
  - compliance
  - account-integrity
---

# Executive Summary

This meeting was an emergency operating review on Meta account restrictions and buyer restrictions. The group did not settle on a single root cause, but it narrowed the active risk field: compensation-led health creative, jobs-adjacent framing, reused wild/Foreplay creative in sensitive categories, mixed page/account ownership, and API-assisted launch patterns that may look like circumvention. The immediate operating posture was not "stop everything," but "stop doing more of the riskiest behavior," preserve surviving account capacity, and gather enough evidence to appeal intelligently and change launch behavior before Nautilus degrades further.

## Decisions

- Decision: Treat the current Meta situation as an account-integrity / policy-escalation problem, not just isolated ad rejections.
- Decision: Do not continue expanding the same questionable behavior while root-cause analysis is incomplete.
- Decision: Prioritize preservation of surviving ad accounts and pages, including non-active accounts that may expire from non-use.
- Decision: Use consultant input plus internal analysis before making broad appeal decisions.
- Decision: Gather sharper evidence on campaign framing, page linkage, API behavior, and creative provenance before assuming one single cause.
- Decision: Start capturing a written checklist of open questions and next steps in Slack so action items are not lost.

## Actions (Tasks)

- [ ] Ask the Facebook consultant how Meta may be classifying paid clinical-trial ads as jobs / employment and what behavior changes or appeal framing are most credible — Owner: Eric — Due: 2026-04-23 — Priority: H
- [ ] Finish mining rejection and restriction emails for sequence, shared patterns, and account/page overlap, then circulate findings — Owner: Eric — Due: 2026-04-23 — Priority: H
- [ ] Share the Meta spam/fraud lawsuit article and summarize the implications for current buying behavior — Owner: Eric — Due: 2026-04-23 — Priority: M
- [ ] Check whether any surviving but unused ad accounts are nearing automatic closure, and propose low-risk "keepalive" campaigns if needed — Owner: Eric — Due: 2026-04-24 — Priority: H
- [ ] Confirm whether `Knowledge Warehouse AU` is the safest candidate for an account-level appeal and document the argument basis — Owner: Anastasia Uldanova — Due: 2026-04-23 — Priority: H
- [ ] Verify whether any timeline / end date exists anywhere in restriction status for Anastasia's user restriction — Owner: Anastasia Uldanova — Due: 2026-04-23 — Priority: H
- [ ] Pull the exact substance-abuse creative transcripts and identify whether compensation / income language appears in audio or captions — Owner: Andrew Cook — Due: 2026-04-23 — Priority: H
- [ ] Screenshot and document the current state of the `Money Matters` page-at-risk warning and post it to Slack — Owner: Andrew Cook — Due: 2026-04-23 — Priority: H
- [ ] Revisit the API/tool upload attribution field that appeared to change from a human email to an app-like identity, and confirm with Lean what changed — Owner: Andrew Cook — Due: 2026-04-23 — Priority: H
- [ ] Review whether rapid campaign copying / launch cadence via the API needs throttling to look more human or less anomalous — Owner: Lean — Due: 2026-04-24 — Priority: H
- [ ] Pause adding new campaigns in Nautilus until the risk model is clearer; focus on safer lanes / other BMs where appropriate — Owner: Ben — Due: 2026-04-22 — Priority: H
- [ ] Evaluate fresh redirect URLs for lower-value campaigns so complaint history is not inherited indefinitely — Owner: Ben — Due: 2026-04-24 — Priority: M
- [ ] Document the replacement-page usage on `Daily Tips` and the categories currently running there so page-level concentration risk is visible — Owner: TJ Babbel — Due: 2026-04-23 — Priority: H
- [ ] Post a shared Slack checklist of the unresolved issues, hypotheses, and follow-ups raised in this meeting — Owner: Team / Eric — Due: 2026-04-22 — Priority: H
- [ ] Brief Mike on categories to avoid immediately, with jobs as the clearest no-go zone — Owner: Ben — Due: 2026-04-22 — Priority: H

## Projects

- Project: Meta Restriction Root-Cause Analysis — Outcome: Ranked list of the most likely enforcement triggers with evidence and recommended behavior changes — Owner: Eric
- Project: Facebook Risk Containment Plan — Outcome: A written set of safe/unsafe launch rules, page/account hygiene rules, and escalation procedure — Owner: Eric
- Project: Page and Account Topology Cleanup — Outcome: Clear mapping of buyer -> account -> page -> campaign so shared-risk concentration is visible — Owner: Media Buying / Ops
- Project: API Launch Safety Layer — Outcome: Launch throttling and logging that reduces the appearance of anomalous or circumvention-like behavior — Owner: Lean / Engineering

## Principles

- Principle: Existing scale is less valuable than preserving the ability to keep buying tomorrow.
- Principle: When a platform starts escalating punishments, assume the warning signs matter even if the classifier is imperfect.
- Principle: In sensitive categories, reused creative and mixed ownership create hidden graph risk.
- Principle: Compensation-led framing in health offers is not the same as science-led framing with compensation as secondary.
- Principle: Do not let shared pages and mixed accounts hide causality.
- Principle: In a crackdown, preserve optionality first, then expand.

## Product PRDs

- PRD: Facebook Policy Risk Classifier — Link: `docs/prd/capital-allocation-operating-contract.md` — Status: idea
- PRD: Meeting Intelligence for Buyer/Policy Incidents — Link: `docs/prd/meeting-intelligence-spec.md` — Status: active
- PRD: Buyer / Account / Page Constraint Graph — Link: `docs/prd/capital-allocation-operating-contract.md` — Status: idea

## Risks and Unknowns

- Risk: The team is still operating on multiple plausible root-cause theories rather than one validated cause — Mitigation: rank hypotheses and attach evidence to each instead of arguing from intuition.
- Risk: Surviving pages and accounts may already be "hot" from shared usage patterns — Mitigation: map page/account reuse and stop assuming isolation where none exists.
- Risk: API-assisted launch behavior may look like circumvention when paired with already-risky content — Mitigation: inspect logs, throttle launch behavior, and separate tooling effects from creative effects.
- Risk: Health + compensation framing may be tripping job / scam / deceptive interpretations — Mitigation: test softer framing and reduce money-led messaging in sensitive categories.
- Risk: Reused wild/Foreplay creative may import graph risk from other actors — Mitigation: favor original or substantially transformed creative in sensitive lanes.
- Risk: The business may lose dormant account capacity through non-use while focusing on the current fire — Mitigation: review expiring accounts immediately and keep low-risk activity alive where justified.

## Notes Organized by Workflow

1. Trigger/Context
Meta enforcement escalated from ad-level rejections to account-level and buyer-level restrictions. The team believed there was enough pattern overlap to warrant a full operating review rather than treating each restriction as isolated bad luck.

2. Inputs
Inputs discussed included ad-rejection emails, account-status screens, page removals, API launch behavior, campaign categories, video/creative source, page reuse, and an external news signal that Meta was being sued over spam and fraudulent ads.

3. Process
Eric drove the meeting as a hypothesis-generation and risk-containment session. Anastasia pushed for not overfitting to rejected ads alone. Cook contributed details about page edits, API usage, and reused creative. Ben advocated for keeping the rule set small and actionable. TJ provided contrast in how his dental creative is framed and categorized.

4. Outputs
The meeting produced a provisional risk map: jobs is the clearest red zone; compensation-led health creative is likely another; reused external creative, mixed page/account topology, and rapid API launch behavior are all plausible amplifiers. It also produced a concrete set of follow-up tasks.

5. Feedback/Monitoring
The team planned to monitor account status pages, appeal outcomes, consultant guidance, email classification patterns, page risk indicators, and the behavior of safer categories and safer business-manager lanes.

## Source References

- See transcript: [transcript.md](/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md)
- Google Doc source: [Apr 22, 2026 transcript](https://docs.google.com/document/d/1sYKwGG0YTv78jeDC6lgoBAiYgJo0f2ZC41RQWR1263o/edit?tab=t.dkbog54r2lup)
