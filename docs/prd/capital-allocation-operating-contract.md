---
title: "Capital Allocation Operating Contract"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Capital Allocation Operating Contract

## Purpose

This document is the durable contract for building Liftoff's capital allocation and operating intelligence system for the Google RSOC arbitrage business.

It exists so the requirements, invariants, entity model, business constraints, and build sequence do not disappear into chat context.

This is a living contract. It should be updated as decisions become explicit, systems change, or reality proves an assumption wrong.

## Core Objective

Build a production-grade decision engine that allocates capital, buyer attention, tooling effort, and operating focus toward the highest-confidence sources of durable net profit growth in the RSOC business.

The engine must optimize for:

1. Net profit growth
2. Sustained monthly net profit above a configurable floor, default `$100,000`
3. Finite-horizon compounding, default `90 turns`
4. Reusable edge, not just isolated campaign wins
5. Reduction of buyer bottlenecks that currently suppress profitable scaling

## Prime Directive

Maximize durable net profit growth per unit of constrained company capacity, while never allowing projected monthly net profit to fall below the configured floor.

### Operator Translation

Allocate capital, buyer attention, system effort, and operating focus to the set of actions that produces the highest expected durable net profit, subject to profit-floor, capacity, and risk constraints.

### Why This Is The Prime Directive

The business is not constrained by capital alone.

The system must optimize against the real scarce resources:

- buyer attention
- platform account capacity
- workflow throughput
- engineering bandwidth
- working capital
- policy / platform risk budget

Any proposed feature, allocation, workflow, or intervention should be judged by whether it improves durable net profit relative to those constraints without breaching the monthly floor.

## Objective Hierarchy

When objectives conflict, the system must resolve them in this order.

1. Protect the configured monthly net profit floor.
2. Maximize durable net profit growth.
3. Maximize reusable edge across buyers, accounts, and systems.
4. Relieve the tightest bottleneck suppressing profitable scaling.
5. Minimize fragility to platform, account, policy, and tooling shocks.

## Delegated Approval Mode

The operator may authorize bounded autonomous build batches.

When delegated approval mode is active:

1. the system may continue building without pausing for every individual recommendation
2. every change must still satisfy the prime directive and first-principles validation doctrine
3. the system must stop at the defined checkpoint and present a review packet
4. the system must stop early if a change crosses an explicit guardrail

The detailed protocol lives in:

- [operator-delegated-approval-protocol.md](/Users/ericroach/code/liftoff/docs/prd/operator-delegated-approval-protocol.md)
- [operator-batch-approval-ledger.md](/Users/ericroach/code/liftoff/docs/operations/operator-batch-approval-ledger.md)

## First-Principles Validation Doctrine

Existing code, docs, dashboards, workflows, and tribal practices are not automatically accepted as truth.

They are inputs to be evaluated.

### Governing Rule

Nothing is accepted into the operating system because it already exists.

It is accepted only if it survives first-principles validation against:

1. the prime directive
2. the real business constraints
3. measurable system physics
4. observed operating reality

### Repo Reality Stance

The repo should be treated as a mixture of:

- useful implementation
- partial business memory
- partial hypothesis set
- outdated local optimizations
- unknown artifacts awaiting validation

### Required Validation Questions

Before building on an existing component, ask:

1. What real-world variable or mechanism does this correspond to?
2. Which constraint does it relieve?
3. Which part of the prime directive does it improve?
4. What evidence shows it works in actual operating reality?
5. What important variables does it omit?
6. What bad behavior could it incentivize if accepted uncritically?

### Required Classification

Each existing component that matters should be classified as one of:

- `canonical_primitive`
- `useful_but_incomplete`
- `local_optimization`
- `legacy_or_misleading`
- `unknown_until_validated`

Only `canonical_primitive` and `useful_but_incomplete` components should normally be extended directly.

### Examples Of What This Means

- A reporting view is not valuable because it exists. It is valuable only if it improves a real decision.
- An opportunity queue is not complete because it stores opportunities. It is complete only if it improves the flow from opportunity discovery to profitable launch.
- A buyer workflow is not correct because buyers currently do it that way. It is correct only if it is aligned with the prime directive and real constraints.

## Business Reality This System Must Reflect

The system must model the actual business, not an abstract trading portfolio.

### Human Roles

- Media buyers
- Product
- Owner operators
- Engineers
- Admin / operations

### Contractual / External Dependencies

- System1 agreement for Google RSOC monetization
- Facebook Business Manager access through:
  - Nautilus
  - Adnet
- NewsBreak buying access
- Other traffic sources as present in Strategis / monitoring

### Core Internal Systems

- Strategis / Strateg.is reporting engine
- System1 RAMP content workflow
- Liftoff backend services
- Monitoring database and reporting scripts
- Servers, software services, and internal tooling
- Slack channels, meeting transcripts, and operating notes as sources of business state

### Current Pain Point

Buyers currently carry too much of the workflow themselves, including:

- generating the idea
- generating the article through System1 RAMP
- deriving RSOC keyword sets
- launching campaigns
- managing profitable scale
- translating ad/account/tooling issues into fixes manually

This system must identify and reduce those bottlenecks.

## Non-Negotiable Invariants

These rules are binding unless this document is explicitly amended.

1. Every turn evaluates full deployable capital, not just incremental leftovers.
2. No allocation plan is valid unless projected monthly net profit stays at or above the configured floor.
3. Capital allocation is not enough by itself. The system must also model buyer attention, platform capacity, tooling maturity, and workflow bottlenecks.
4. Top proven winners should receive concentrated allocation. Capital must not be spread evenly.
5. A fixed portion of resources must be ring-fenced for reusable system improvements.
6. A defense reserve must always exist for outages, policy shocks, or performance collapses.
7. The engine must reason in finite-horizon terms and report turns remaining and projected horizon outcome.
8. The engine must preserve an audit trail for every important decision.
9. The engine must continuously absorb both structured signals and unstructured operating context.
10. The unit of learning is not only the campaign. It is also the move, the workflow intervention, and the reusable play.

## Canonical System Model

The system must maintain a continuously updated company-state graph.

### Primary Entity Types

#### 1. Person

A human actor in the business.

Required fields:

- `person_id`
- `name`
- `role_type`
- `active`
- `manager`
- `comp_plan_id`
- `capacity_model`
- `slack_identity`

Examples:

- buyer
- engineer
- product operator
- admin
- owner operator

#### 2. Team Role

Represents a functional responsibility rather than a person.

Examples:

- media buying
- launch engineering
- analytics
- article operations
- infra
- finance / admin

#### 3. Platform Account

Represents external execution capacity and risk surface.

Required examples:

- Facebook BM via Nautilus
- Facebook BM via Adnet
- NewsBreak account(s)
- System1 / S1 organization
- Any additional network account surfaced in Strategis

Required fields:

- `platform_account_id`
- `platform`
- `provider`
- `partner_name`
- `status`
- `policy_risk_score`
- `daily_capacity_estimate`
- `owner_team`
- `notes`

#### 4. Contract

Represents formal commercial or operating agreements.

Must include:

- System1 RSOC contract / agreement
- rev share assumptions if needed
- restrictions imposed by partner terms
- payout / collection timing assumptions

Required fields:

- `contract_id`
- `counterparty`
- `contract_type`
- `effective_date`
- `constraints_json`
- `cashflow_terms_json`
- `risk_flags`

#### 5. System

Represents internal or external software systems that enable work.

Examples:

- Strategis
- System1 RAMP
- monitoring DB
- Slack
- transcript store
- servers
- software subscriptions
- internal scripts and dashboards

Required fields:

- `system_id`
- `name`
- `category`
- `owner`
- `criticality`
- `cost_model`
- `availability_status`

#### 6. Traffic Asset

The capital deployment unit for traffic.

Definition:

`source + campaign + article template + keyword / widget setup + account context`

At minimum the system must support:

- source
- campaign
- article template
- cluster
- platform account
- buyer owner
- RSOC site
- S1 Google account

#### 7. Workflow

Represents the path from idea to profit.

Base workflow:

1. Idea generation
2. Article generation
3. RSOC keyword generation
4. Campaign setup
5. Launch
6. Early optimization
7. Scaling
8. Play extraction / reuse

Each workflow stage must be attributable to systems, people, and time costs.

#### 8. Play / Move

A reusable profit-moving intervention.

Examples:

- new article angle
- better RSOC keyword pack
- better widget ordering
- better launch checklist
- BM routing rule
- engineer-built automation
- reporting view that shortens decision latency

This entity is required because the business needs to discover what moves profitability, not just which campaign made money.

#### 9. Constraint

Represents the true scaling limit.

Examples:

- buyer attention
- BM capacity
- policy risk
- article throughput
- System1 request limits
- engineering bandwidth
- software / server reliability
- delayed payout / working capital

## Known Grounded Facts From Current Repo Reality

The contract is grounded to the current codebase and docs.

### Strategis / Monitoring Reality

Current monitoring already merges multiple sources into `campaign_index`, including:

- S1 daily / reconciled reports
- Facebook reports and metadata
- NewsBreak
- Outbrain
- MediaGo
- SmartNews
- other supported traffic sources

References:

- [backend/src/lib/strategisApi.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategisApi.ts)
- [docs/monitoring/data-architecture.md](/Users/ericroach/code/liftoff/docs/monitoring/data-architecture.md)
- [docs/monitoring/complete-system-documentation.md](/Users/ericroach/code/liftoff/docs/monitoring/complete-system-documentation.md)

### Existing Buyer Attribution

Strategis / monitoring already tracks buyer-linked campaign performance and launch activity.

Known example buyers in repo docs:

- Anastasia
- Cook
- Dan
- Phillip
- TJ
- Ben
- Mike
- Brie

The system should derive the actual current canonical buyer list from Strategis rather than hardcoding this list.

### Existing Compensation Rules

Buyer comp policy already exists and must be integrated into the operating model rather than rebuilt from scratch.

Reference:

- [docs/operations/compensation-policy.md](/Users/ericroach/code/liftoff/docs/operations/compensation-policy.md)

Key implications:

- payout tied to net margin
- assisted-margin logic exists
- guardrails on total variable comp exist
- auto-throttle concepts already exist

## Required Outputs

The finished system must produce the following views and decisions.

### 1. Company State Model

A current, queryable model of:

- people
- accounts
- contracts
- systems
- workflows
- assets
- plays
- risks
- constraints

### 2. Buyer Scorecards

Per buyer, per day and per month:

- spend
- revenue
- net margin
- net margin per dollar
- launch count
- 72h hit rate
- active profitable campaigns
- play reuse contribution
- assisted margin
- comp accrual
- effective payout rate
- attention load
- bottleneck flags

### 3. Allocation Engine

Must allocate across:

- traffic spend
- exploration spend
- improvement investment
- defense reserve
- buyer attention / launch bandwidth
- engineering / product effort when a workflow bottleneck has higher ROI than more traffic spend

### 4. Workflow Bottleneck Report

Must identify where profitable scaling is blocked:

- idea generation
- article throughput
- RSOC keyword generation
- launch setup
- account access
- policy risk
- reporting latency
- engineering backlog

### 5. Move Registry

Every meaningful intervention should be logged and measured.

Required fields:

- `move_id`
- `move_type`
- `created_by`
- `applied_by`
- `target_scope`
- `start_turn`
- `expected_margin_lift`
- `expected_speed_lift`
- `expected_variance_reduction`
- `measured_effect`
- `proof_status`
- `reuse_count`

### 6. Decision Audit Trail

Every capital and operating decision must answer:

- what was allocated
- why it was allocated
- what assumptions justified it
- which constraint it was trying to relieve
- what confidence score was used
- what happened vs. prediction

## Data Sources The System Must Ingest

### Structured Sources

- Strategis campaign performance
- S1 revenue and session data
- platform spend data
- launch metadata
- buyer ownership
- account mappings
- RSOC site mappings
- software / server cost data
- compensation plans
- contract terms

### Unstructured Sources

- Slack messages
- meeting transcripts
- media buying call transcripts
- call notes
- postmortems
- playbooks
- launch notes
- manual transcript markdown files

### Rule For Unstructured Ingestion

Raw text is not the source of truth.

The system must extract structured facts from text, each with:

- source reference
- timestamp
- linked entities
- claim type
- confidence
- review status
- expiry / staleness window

Examples:

- `buyer_bottleneck`
- `policy_alert`
- `new_play_candidate`
- `launch_blocker`
- `account_risk`
- `system_issue`
- `strategy_decision`
- `founder_concern`
- `execution_gap`
- `opportunity_gap`
- `intent_packet_gap`
- `owner_followthrough_risk`

## Human Voice And Preference Modeling

The system must maintain structured voice profiles for important humans in the operating system.

This includes, at minimum:

- founders / partners
- active buyers
- operators
- important recurring meeting participants from the buy side

### Purpose

The goal is not sentiment analysis for its own sake.

The goal is to understand:

- what each important human consistently cares about
- which constraints they repeatedly point to
- which risks they emphasize
- which opportunities they repeatedly push for
- where there is alignment vs disagreement across the room

### Required Capabilities

1. Store media buying call transcripts as first-class operating inputs.
2. Attribute transcript statements to participants whenever feasible.
3. Build participant profiles from repeated topics, concerns, and actions.
4. Detect recurring voices such as:
   - opportunity sniffing
   - execution discipline
   - new intent packet exploration
   - tooling / tracking hygiene
   - buyer bias toward easy launches
5. Link voiced concerns to later actions and outcomes.
6. Distinguish between:
   - stated concern
   - assigned owner
   - implemented action
   - realized outcome

### Initial Approved Transcript Sources

The first version should ingest from:

1. Google Meet transcripts
2. Slack channel listening
3. Manual transcript `.md` files written into the repo or a designated ingest location

These are the initial system-of-record sources for meeting intelligence.

## Meeting Intelligence Requirements

Meetings are not just historical records.

They are operating inputs that must be synthesized into decisions, tasks, and updated company state.

### Every Important Meeting Must Produce

1. a concise synthesis
2. a list of ideas raised
3. a list of concerns raised
4. a list of explicit decisions made
5. a list of unresolved questions
6. a list of action items
7. a responsible party for each action item
8. an expected due date or urgency level for each action item
9. linked participants
10. linked systems, accounts, workflows, buyers, or assets discussed

### Meeting Synthesis Output Contract

Each synthesized meeting record should contain:

- `meeting_id`
- `title`
- `meeting_type`
- `source_type`
- `occurred_at`
- `participants`
- `summary`
- `key_ideas`
- `key_constraints`
- `decisions`
- `action_items`
- `responsible_parties`
- `open_questions`
- `mentioned_entities`
- `confidence_notes`

### Action Item Requirements

An action item is not complete unless it has:

- an owner
- a clear verb
- a target object
- a status
- a priority
- a created timestamp
- a source meeting reference

Preferred fields:

- `action_item_id`
- `meeting_id`
- `description`
- `owner_person_id`
- `backup_owner_person_id`
- `status`
- `priority`
- `due_at`
- `source_quote_ref`
- `linked_entities`
- `completion_notes`
- `resolved_at`

### Responsible Party Rules

1. Every material action item should have exactly one primary responsible party.
2. Optional collaborators may exist, but ownership must remain singular.
3. If a meeting produces a concern without an owner, the synthesis should flag it as an escalation gap.
4. If a decision implies action but no action item is created, the system should flag the meeting as operationally incomplete.

### Idea Capture Rules

Ideas from meetings should not be buried inside summaries.

They should be extracted into structured records with:

- who raised the idea
- what problem it addresses
- expected upside
- expected constraint relieved
- whether it became:
  - an action item
  - a play candidate
  - a rejected idea
  - an unresolved hypothesis

### Meeting-Derived Escalation Signals

The system should detect and flag:

- recurring unresolved action items
- repeated concerns with no owner
- repeated concerns with the same owner but no completion
- opportunities repeatedly named but not tested
- execution items repeatedly discussed but not implemented
- disagreement between founders / buyers / operators on what matters

### Manual Transcript Ingestion Rule

Manual transcripts written to markdown are acceptable first-class inputs.

The preferred approach is:

1. store one meeting per markdown file
2. include metadata at the top when possible
3. preserve speaker labels when available
4. run the same synthesis pipeline used for Google Meet transcripts

Suggested metadata:

```md
---
title: "Media Buying Call"
occurred_at: "2026-04-29T10:00:00-07:00"
source_type: "manual_markdown"
participants:
  - Eric Roach
  - Narbeh Ghazalian
  - Ben
---
```

### Founding Partner Voice Requirements

The system must support a durable profile for the Founding Partner Seat, currently occupied by `Narbeh Ghazalian`.

Known concerns already surfaced and requiring explicit modeling:

1. Not enough active focus on sniffing out opportunity.
2. Weak execution follow-through on items that should already be implemented.
3. Facebook pixel updates may not be receiving the necessary ownership and urgency.
4. The Facebook consultant should be contacted and tracked as an explicit operating action when needed.
5. Someone should be dedicated to exploring new opportunities to scale.
6. Someone should be dedicated to cracking new intent packets.
7. Buyers may be biased toward only pursuing what feels easy to launch and easy to profit from.

These must be stored as structured claims and revisited over time.

### Suggested Initial Profile Schema

Each important participant should eventually have a profile with fields like:

- `person_id`
- `role`
- `meeting_participation_rate`
- `recurring_topics`
- `recurring_constraints_named`
- `recurring_opportunities_named`
- `execution_concerns`
- `risk_bias`
- `opportunity_bias`
- `favorite_metrics`
- `frequently_assigned_actions`
- `followthrough_score`
- `influence_score`

### Required Transcript-Derived Fact Types

- `person_topic_signal`
- `person_priority_signal`
- `person_risk_signal`
- `person_opportunity_signal`
- `person_execution_signal`
- `person_followthrough_request`
- `meeting_consensus_signal`
- `meeting_disagreement_signal`

### Decision Use

Voice profiles should influence:

- board sessions
- bottleneck identification
- action assignment
- escalation detection
- interpretation of meeting outcomes

They should not override performance data, but they should shape what the system investigates and where it looks for latent constraints or missed upside.

## What Must Be Measured

### Asset-Level

- spend
- impressions
- clicks
- sessions
- revenue
- net profit
- net profit per dollar
- margin
- ROI / ROAS
- creative fatigue
- scalability ceiling
- RSOC keyword set
- article template
- platform account
- buyer owner

### Cluster-Level

- shared data / creative synergy
- cross-asset correlation
- cluster margin
- cluster expansion capacity
- cluster policy risk

### Buyer-Level

- margin
- launches
- winning rate
- workflow throughput
- time spent per stage if available
- play creation rate
- play reuse rate
- comp impact
- attention saturation

### System-Level

- server / software cost
- reporting latency
- automation coverage
- uptime / failure incidents
- tool adoption

### Contract / Account-Level

- payout delay
- revenue realization timing
- account risk
- policy flags
- partner-imposed operating limits

## Allocation Logic Requirements

The allocator must choose among more than campaigns.

### It Must Be Able To Decide

1. Put more spend into winner assets
2. Fund exploration
3. Fund system improvements
4. Hold defense reserve
5. Redirect effort toward a workflow fix instead of more spend
6. Reassign launch capacity across buyers
7. Prioritize BM / account capacity expansion when account constraints are the bottleneck
8. Prioritize article / keyword automation when buyer attention is the bottleneck

### Decision Principle

If the next dollar of engineering, product, admin, or workflow effort produces more durable margin than the next dollar of traffic spend, the system must surface that explicitly.

## Continuous Calibration Rules

The system must continuously ask:

1. Which buyers create the highest realized net margin?
2. Which buyers create reusable plays?
3. Which workflow stages slow profitable scaling?
4. Which platform accounts are the true growth constraint?
5. Which system changes permanently improve multiple buyers?
6. Which play types actually move profitability?
7. Where is the business confusing activity with profit?

Calibration is not optional. Assumptions must be revised when data falsifies them.

## Build Sequence

The build should proceed in stages so working value arrives early.

### Phase 1. Canonical Company-State Schema

Create durable tables / models for:

- `people`
- `team_roles`
- `platform_accounts`
- `contracts`
- `systems`
- `traffic_assets`
- `workflows`
- `workflow_events`
- `plays`
- `moves`
- `constraints`
- `operating_facts`
- `buyer_scorecard_daily`
- `buyer_scorecard_monthly`

### Phase 2. Grounding To Existing Data

Map current monitoring and Strategis data into the new model:

- buyer identities
- campaign ownership
- media sources
- RSOC sites
- S1 account mappings
- account and partner context

### Phase 3. Workflow Instrumentation

Track:

- idea creation
- article generation requests
- RSOC keyword generation events
- launch setup events
- launch completion
- first profitable milestone
- scale milestone

### Phase 4. Unstructured Context Ingestion

Ingest Slack / transcript material into structured facts:

- bottlenecks
- risks
- decisions
- play candidates
- system failures
- participant profiles
- founder voice signals
- recurring opportunity / execution concerns

### Phase 5. Comp-Aware Buyer Allocation

Integrate:

- comp plans
- payout caps
- assisted-margin rules
- net retained margin

### Phase 6. Full Multi-Resource Allocator

Extend the current capital allocator into a broader operating allocator that reasons about:

- spend
- buyer bandwidth
- engineering work
- product workflow work
- account defense and expansion

## Definition Of Done

This project is not done until the system can answer all of the following from current data.

1. Who are the active buyers and what are their current returns?
2. Which buyers should receive more capital right now?
3. Which buyers are limited by workflow friction rather than lack of spend?
4. Which specific workflow stage is suppressing profitable scaling?
5. Which BM / account / contract constraint is currently binding?
6. Which systems or tooling fixes have the highest expected ROI?
7. Which plays measurably lifted profit, and which did not?
8. What is the projected monthly net profit if current allocations continue?
9. Does the plan preserve the configured monthly net profit floor?
10. What changed in the operating context from Slack / meetings that should alter decisions?

## Immediate Build Priorities

The first practical implementation targets should be:

1. Canonical buyer table populated from Strategis
2. Buyer scorecard tables with daily and monthly net margin
3. Platform account and contract tables for Nautilus, Adnet, System1, NewsBreak
4. Workflow-event schema for idea -> article -> keyword -> launch
5. Operating-fact ingestion schema for Slack / transcript extraction
6. Participant voice-profile schema for founders, buyers, and recurring operators
7. Move registry and proof tracking
8. Extend `CapitalAllocationEngine` to consume buyer and account constraints

## Open Questions That Require Explicit Decisions

These are open until answered and logged.

### Buyer / Org

- What is the canonical current buyer roster from Strategis?
- Which non-buyer humans should enter the first schema version, and at what granularity?
- Do we want individual-level capacity estimation immediately, or first at buyer-role level?

### Accounts / Contracts

- What are the precise operational differences between Nautilus BM and Adnet BM?
- Are there explicit spend caps, policy differences, or approval differences between them?
- What exact System1 contract terms should be modeled first: rev share, payment lag, request limits, compliance restrictions, or all of them?

### Workflow

- What is the current real-world launch flow, step by step, for a buyer?
- Which steps are done in Strategis, which in System1, which in Facebook, which in NewsBreak, and which in Slack/manual notes?
- Which stages consume the most buyer time today?

### Data

- Where do Slack exports and meeting transcripts live today?
- Do we already have structured launch notes or playbooks tied to buyers and campaigns?
- Where should server / software costs come from in the first version?

### Compensation / Allocation

- Should the first allocation model optimize for buyer-level capital assignment, buyer-plus-account assignment, or full workflow/resource assignment?
- How aggressive should comp-aware allocation be if one buyer is highly profitable but dependent on heavy engineering support?

## Change Control

The following changes require explicit updates to this contract:

- new profit floor logic
- new allocation objective
- new account / platform classes
- changes to comp policy integration
- changes to the canonical workflow
- changes to contract modeling assumptions

## Working Rule For Chat Sessions

When requirements, constraints, or business facts are introduced in chat and are important enough to influence architecture or allocation decisions, they should be added to this document or to a linked implementation note before the chat moves on.

## Mandatory Companion Artifacts

This contract should be operated together with:

- [digital-board-constitution.md](/Users/ericroach/code/liftoff/docs/prd/digital-board-constitution.md)
- [meeting-intelligence-spec.md](/Users/ericroach/code/liftoff/docs/prd/meeting-intelligence-spec.md)
- [meeting-intelligence-architecture-decision.md](/Users/ericroach/code/liftoff/docs/prd/meeting-intelligence-architecture-decision.md)
- [prime-directive-workboard.md](/Users/ericroach/code/liftoff/docs/prd/prime-directive-workboard.md)
- [board-decision-telemetry-spec.md](/Users/ericroach/code/liftoff/docs/prd/board-decision-telemetry-spec.md)

These are not optional companion notes.

They collectively define:

- the governing decision lenses
- the implementation boundary for meeting intelligence
- the current highest-leverage workstreams
- the anti-drift rules that keep the build tied to the prime directive
- the telemetry system for evaluating whether board decisions were timely and good

## Operator Approval Standard

When the system presents a recommendation, decision memo, build priority, or board conclusion to the operator, it must be framed so the operator can make a fast, high-quality approval call.

Every operator-facing recommendation must answer these questions explicitly:

1. Why does this need to be part of the system?
2. Why now, instead of other candidate work?
3. What bottleneck, limiting factor, or constraint does it relieve?
4. What happens if we delay it?
5. What measurable improvement should it create?

### Required Output Shape

Every consequential operator-facing recommendation should end with:

- a concise justification
- the primary bottleneck relieved
- the key expected effect on the prime directive
- a final sentence that makes the approval action explicit

### Required Final Sentence

The final sentence should make clear that the operator only needs to approve the recommendation.

Preferred pattern:

`If you agree, all you need to do is approve.`

Or:

`If this matches your judgment, all you need to do is approve.`

### Reason For This Rule

The operator should not have to reconstruct:

- why the recommendation matters
- why it is urgent
- why it wins over alternatives

The system must do that work before asking for approval.
