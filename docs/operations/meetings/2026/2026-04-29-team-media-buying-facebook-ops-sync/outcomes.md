---
date: 2026-04-29
title: "Media Buying — Facebook Ops Sync — Outcomes"
type: outcomes
participants:
  - Eric Roach
  - Anastasia Uldanova
  - Phillip Bennett
  - Narbeh Ghazalian
  - Ben
  - Andrew Cook
  - Scott Anderson
  - TJ Babbel
  - Brianne Hodenfield
context:
  team: Media Buying / Facebook
  company: Liftoff
source_transcript: ./transcript.md
tags:
  - meeting
  - outcomes
  - media-buying
  - facebook
  - redirects
---

# Executive Summary

This meeting was an operational sync across account-restoration strategy, launch tooling, redirect rotation, and buyer throughput. The team did not resolve the restoration path for Anastasia's personal restriction, but it clarified several practical operating rules: clean up category-only rejections immediately, watch Cook's restriction expiry as a near-term signal, keep the business manager clean, improve redirect hygiene with rotation plus early burn detection, and preserve dormant ad-account capacity before it expires. At the same time, Eric surfaced a set of internal tools under development that directly target buyer bottlenecks: launch-from-scratch support, dead-ad cleanup, rejection/compliance diagnosis, and sentiment monitoring.

## Decisions

- Decision: Treat categorization-only rejections as easy hygiene work and clear them quickly instead of leaving them as open blemishes.
- Decision: Use Cook's restriction expiry on `2026-04-29` / `2026-04-30` as an important near-term signal for how identity/account restoration may behave.
- Decision: Keep the business manager as clean as possible; even if deletions do not fully erase history, leaving obvious blemishes in place is worse.
- Decision: Continue pursuing the Adnet business-manager expansion so Bri and Mike can scale there while Nautilus remains riskier.
- Decision: Prioritize a redirect-rotation system that combines scheduled turnover with immediate retirement of any redirect that shows deceptive-ad / spam signals.
- Decision: Preserve unused ad accounts before inactivity auto-closure, but only with low-risk activity.
- Decision: Continue prototyping buyer tooling that reduces setup time and improves compliance diagnosis before rolling it into Lean's front end.

## Actions (Tasks)

- [ ] Determine what changed for Cook after the `2026-04-29` restriction expiry window and report back to the group — Owner: Andrew Cook — Due: 2026-04-30 — Priority: H
- [ ] Decide whether and how to appeal / restore Anastasia's disabled ad account(s) as part of a path toward restoring her personal account — Owner: Eric / Narbeh Ghazalian — Due: 2026-04-30 — Priority: H
- [ ] Clear any open categorization-only rejections across the business manager so they stop sitting as unnecessary blemishes — Owner: Buyers — Due: 2026-04-30 — Priority: H
- [ ] Produce buyer-specific lists of ads that are active or paused but not producing so they can be removed or cleaned up — Owner: Eric — Due: 2026-04-30 — Priority: H
- [ ] Share or demo the new from-scratch launch workflow prototype, starting with Cook for feedback — Owner: Eric — Due: 2026-05-01 — Priority: H
- [ ] Package and share the rejection/compliance Q&A framework that explains why a given ad is likely to trigger Facebook policy issues — Owner: Eric — Due: 2026-05-01 — Priority: M
- [ ] Decide how to productionize sentiment monitoring for ad comments/reactions without using risky browser automation methods — Owner: Eric / Engineering — Due: 2026-05-02 — Priority: M
- [ ] Retrieve or reset Shutterstock credentials and check current plan / usage so the team has the right level of access — Owner: Eric — Due: 2026-04-30 — Priority: M
- [ ] Push forward new redirect URLs and the related Facebook pixel / revenue-fire work — Owner: Eric / Engineering — Due: 2026-05-01 — Priority: H
- [ ] Re-engage Taboola integration in Strategis so listicle testing and reporting reconnect properly — Owner: Engineering — Due: 2026-05-02 — Priority: H
- [ ] Turn Scott's redirect-rotation concept into a concrete mockup or implementation plan, including namespace logic and early-burn retirement — Owner: Scott Anderson — Due: 2026-05-01 — Priority: H
- [ ] Gather and share the list of ad accounts that will auto-close from inactivity, then propose a keepalive plan with safe campaigns — Owner: Eric — Due: 2026-04-30 — Priority: H
- [ ] Continue onboarding Bri and Mike inside Adnet while keeping Nautilus access cleanly separated — Owner: Ben — Due: 2026-05-02 — Priority: M

## Projects

- Project: Facebook Launch Tooling Reduction — Outcome: Buyers can launch from scratch with materially less setup work and fewer manual failure points — Owner: Eric / Lean / Engineering
- Project: Redirect Rotation System — Outcome: Redirects are cycled predictably and retired quickly when they show toxicity signals — Owner: Scott Anderson / Engineering
- Project: Facebook Compliance Diagnosis Layer — Outcome: Fast explanations for why ads are likely to trigger policy or account-integrity issues — Owner: Eric
- Project: Adnet Scale-Up — Outcome: Bri and Mike can deploy and spend safely under the Adnet BM with supporting pages, tracking, and reporting — Owner: Ben / Narbeh Ghazalian

## Principles

- Principle: In a crackdown, hygiene work that clears unnecessary blemishes is leverage, not busywork.
- Principle: Restore trust score where possible; do not assume old violations are irrelevant.
- Principle: Redirects should be treated as expiring operating assets, not permanent infrastructure.
- Principle: A buyer should not have to think through complex redirect rules manually if the system can encode them.
- Principle: Separate prototyping from production, but make successful prototypes migratable.
- Principle: Attribution bugs can make good assets look bad; verify setup before judging economics.
- Principle: Preserve scarce account capacity before you need it.

## Product PRDs

- PRD: Meeting Intelligence Spec — Link: [meeting-intelligence-spec.md](/Users/ericroach/code/liftoff/docs/prd/meeting-intelligence-spec.md) — Status: active
- PRD: Capital Allocation Operating Contract — Link: [capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md) — Status: active
- PRD: Prime Directive Workboard — Link: [prime-directive-workboard.md](/Users/ericroach/code/liftoff/docs/prd/prime-directive-workboard.md) — Status: active

## Risks and Unknowns

- Risk: The team may misread ad-account restoration mechanics and spend money restoring assets that do not solve the real bottleneck — Mitigation: tie every restore decision to the exact downstream benefit sought.
- Risk: Redirect rotation may become a human-memory problem if it is not encoded into Strategis or supporting tooling — Mitigation: push logic into dropdowns or auto-assignment instead of relying on recall.
- Risk: Dormant ad accounts may auto-close before a keepalive plan is executed — Mitigation: publish the list immediately and assign safe usage.
- Risk: Eric's local prototypes may remain trapped in a private workflow instead of becoming shared operational tools — Mitigation: prioritize short demos and migration paths into the common system.
- Risk: Buyers still have limited Facebook capacity while restrictions remain unresolved — Mitigation: keep NewsBreak and Adnet productive while restoration paths play out.

## Notes Organized by Workflow

1. Trigger/Context
The meeting opened on the unresolved Facebook restriction problem, especially Anastasia's personal restriction and the practical meaning of appeals, identity verification, and paid restoration.

2. Inputs
Inputs included support interactions, prior experience with page-ID checks, business-manager trust concerns, Cook's pending restriction expiry, local tooling experiments, System1 attribution fixes, redirect-risk analysis, and buyer category updates.

3. Process
The team moved from restoration debate into operational tooling, redirect governance, account preservation, and fast buyer round-robin updates. The call blended immediate firefighting with medium-term mechanism design.

4. Outputs
Outputs included a clearer restoration decision frame, a redirect-rotation design direction, a list of tooling prototypes to share, a requirement to clean categorization-only issues, and buyer-level category/status updates.

5. Feedback/Monitoring
The main signals to monitor are Cook's post-expiry status, redirect toxicity / deceptive-ad signals, account inactivity deadlines, Adnet ramp progress, and whether Eric's new tooling actually reduces buyer setup friction.

## Source References

- See transcript: [transcript.md](/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/transcript.md)
- Related restriction review: [2026-04-22 outcomes](/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/outcomes.md)
