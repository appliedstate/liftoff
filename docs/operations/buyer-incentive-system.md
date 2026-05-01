---
id: operations/buyer-incentive-system
version: 1.0.0
owner: growth-ops
runtime_role: human
title: "Buyer Incentive System — Shared Edge, Higher Ceiling"
purpose: Turn buyer discoveries into company assets without killing the incentive to hunt for edge.
dependencies:
  - compensation-policy.md
  - templates/buyer-scorecard.md
  - templates/buyer-discovery-play.md
  - ../edge/workflows/campaign-workflow.md
  - ../creative/40-creative-factory.md
licensing: internal
---

# Buyer Incentive System

## Goal
Maximize total team output across 5 media buyers by rewarding:
- owned net margin
- net-new discoveries
- successful transfer of winning plays to the rest of the desk

This system assumes a simple rule: a buyer can own an edge for a short time, but proven wins must become company property.

## North Star
The primary payout metric for buyers is **portfolio net margin**.

Why this is the score that matters:
- it maps most directly to company P&L
- it matches the existing compensation guardrails
- it discourages fake wins driven by spend without profit

Leading indicators still matter for operations:
- **Session ROAS**: primary operating signal for scale decisions
- **vRPS**: primary creative/article quality signal
- **72h hit rate**: throughput quality signal for launch velocity

Use these rules:
- Pay on **net margin**
- Manage day-to-day on **Session ROAS** and **vRPS**
- Promote people on both **owned performance** and **reusable edge creation**

## Compensation Buckets
The management scorecard for buyer performance should use this weighting:
- **50% Individual output**: portfolio net margin from campaigns the buyer directly owns
- **25% Discovery**: validated net-new plays not already present in the playbook
- **25% Team lift**: margin created when other buyers successfully use the buyer's documented play

The payout mechanics underneath this scorecard are:
- core tiered portfolio share from `docs/operations/compensation-policy.md`
- fixed discovery bounties by play type
- scale dividends on attributable assisted margin

## Protected Alpha Window
A buyer who logs a net-new play gets a temporary exclusivity period before the play must be published.

| Play type | Examples | Protected window |
|---|---|---:|
| Fast optimization | budget rule, bid rule, keyword ordering, headline/copy tweak, audience exclusion | 14 days |
| Creative or article play | ad angle, creative pattern, LPID/article pattern, keyword cluster mapping | 30 days |
| Category or funnel play | new category, new landing path, new domain/article system, repeatable setup pattern | 30 days |

Rules:
- The play must be logged within **24 hours** of discovery using `docs/operations/templates/buyer-discovery-play.md`
- If it is not logged, it does not receive protected status
- After the window expires, the play must be published to the shared playbook and is fair game for the team

## Proof Thresholds
A buyer can log a **candidate** play immediately, but it only becomes a **validated discovery** when it crosses the proof threshold for its class.

### 1) Fast optimization play
Use for quick tactical changes such as copy, keyword ordering, bid logic, or budget logic.

Validation gate:
- at least **$150 spend**
- at least **500 sessions**
- and either:
  - **Session ROAS >= 1.15x**, or
  - **+10% vRPS uplift** vs the prior relevant baseline

### 2) Creative/article/keyword play
Use for new ad concepts, article patterns, LPID structures, keyword clusters, or message-match patterns.

Validation gate:
- at least **2,000 sessions in 7 days**
- and either:
  - **+20% vRPS uplift** vs account or category median, or
  - **Session ROAS >= 1.20x**

This intentionally matches the repo's existing `Working Hook` logic in `docs/creative/40-creative-factory.md`.

### 3) Category/funnel play
Use for bigger operating breakthroughs that open a new lane of profitable spend.

Validation gate:
- at least **$500 net margin**
- at least **1,500 sessions**
- **Session ROAS >= 1.20x**
- evidence that another buyer could reproduce the setup from the documentation alone

### 4) Team-lift validation
A play only earns scale-dividend credit when another buyer adopts it successfully.

Team-lift gate:
- at least **one other buyer** launches the play
- adopter produces at least **$500 incremental net margin** in the attribution window
- the adopting launch references the original play ID and `ASSISTED_BY:{BUYER_NAME}`

## Discovery Bounties
Validated discoveries earn a one-time bounty.

| Play type | Discovery bounty |
|---|---:|
| Fast optimization | $150 |
| Creative/article/keyword play | $300 |
| Category/funnel play | $500 |

Rules:
- no documentation, no bounty
- repeated resubmissions of an existing playbook item earn no bounty
- low-signal submissions that fail the proof threshold earn no bounty

## Scale Dividends
When a documented play is reused by the team, the original discoverer keeps participating in the upside for a limited window.

Use these defaults:
- **2% of attributable assisted net margin**
- **60-day attribution window** from playbook publication date
- **de minimis**: each adopting buyer must create at least **$500 net margin**
- **cap**: total scale-dividend payout remains subject to the existing buyer payout caps in `docs/operations/compensation-policy.md`

This is the mechanism that makes copying raise the ceiling instead of lowering motivation.

## Anti-Hoarding Rules
The system should punish behavior that protects turf at the expense of company output.

Rules:
- hidden wins found later lose discovery credit
- protected status only exists for logged plays
- managers can void a protected window if the buyer refuses to document a reproducible setup
- repeated low-quality play submissions reduce future discovery priority
- promotions should favor buyers who create reusable advantages, not just private wins

## Monthly Review Cadence
Use a fixed cadence so the system does not become subjective.

### Weekly
At the buyer review:
- inspect new candidate plays
- confirm which plays entered protected status
- review proof packages for validation
- assign adoption tests to at least one other buyer when the protected window ends

### Monthly
At monthly comp review:
- calculate portfolio net margin
- count validated discoveries
- calculate attributable assisted margin from adopted plays
- complete `docs/operations/templates/buyer-scorecard.md`
- pay core share + discovery bounties + scale dividends, subject to guardrails

## Playbook Process
Every validated discovery must become a reusable play.

Required fields are defined in `docs/operations/templates/buyer-discovery-play.md` and include:
- play type
- owner
- protected window start/end
- category and traffic context
- article or LPID pattern
- ad angle or creative pattern
- keyword or optimization rule
- proof package
- guardrails and failure modes
- adoption instructions

Recommended operating rule:
- draft the play when the test starts
- validate the proof package during weekly review
- publish the play when the protected window ends
- tag every adopting launch with the original play ID

## What Good Looks Like
A strong buyer under this system does three things:
- owns profitable campaigns
- discovers net-new edges
- turns private insight into team throughput

That is the behavior the company should reward most heavily.
