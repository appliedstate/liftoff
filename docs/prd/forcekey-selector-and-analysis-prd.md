# Forcekey Selector And Analysis PRD

## Purpose
Build a buyer-facing forcekey selector inside the Liftoff campaign workbench so buyers can choose high-performing forcekeys quickly, with network-wide context and a clear trailing data window.

This should reduce the current manual behavior where buyers inspect old campaigns or remember winning keyword phrases from memory.

The selector should work for:
- `Ben`
- `Andrew Cook`
- future buyers with the same launch workbench pattern

This document assumes:
- campaign setup happens in the Liftoff buyer workbench
- forcekey slots remain `forcekeyA-forcekeyL`
- the performance window defaults to `trailing 14 complete days`
- the source of truth should come from the same System1/Strategis keyword-performance layer used by the existing forcekey review logic in:
  - `/Users/ericroach/code/liftoff/backend/src/lib/forcekeyReview.ts`

## Product Goal
When a buyer is setting up a new campaign, they should be able to:

1. choose a category
2. optionally choose an intent packet
3. see the strongest forcekeys for that slice over the trailing 14 complete days
4. understand why each forcekey is strong
5. select the ones they want
6. auto-fill the selected forcekeys into `forcekeyA-forcekeyL`

The selector should not force buyers to type all forcekeys manually unless they want to.

## Core User Need
Buyers want to know:
- what forcekeys are performing best in this category right now
- how those forcekeys compare to the broader network
- whether a forcekey has enough sample size to trust
- whether a templated keyword like `{city}` or `{state}` is strong enough to use
- whether a keyword belongs in the stack for this campaign

## Key Product Principles

### 1. The time window must be explicit
The user should always see the exact time window being used.

Default:
- `Trailing 14 complete days`

Example display:
- `Trailing 14 complete days: April 15, 2026 - April 28, 2026`

The selector should never imply that the ranking is timeless or all-time.

### 2. The selector is for choosing forcekeys, not just reading analytics
This is not a reporting page. It is a `choose + apply` workflow.

The buyer should be able to:
- inspect analysis
- click `Add`
- drag/reorder selected forcekeys
- fill the campaign stack quickly

### 3. Rankings must be confidence-aware
Do not sort purely by raw `RPS`.

Thin sample size should not outrank stronger, more reliable forcekeys.

The score should be based on:
- searches
- clicks
- revenue
- `RPC`
- `RPS`
- confidence weighting / shrinkage

### 4. Templated forcekeys stay parameterized in the selector
Do not collapse:
- `Apply for online school that gives you $ and laptops in {city}`

into:
- `Apply for online school that gives you $ and laptops in houston`

The topline selector should preserve the forcekey concept.

Geo expansion analysis should appear in the drilldown, not replace the forcekey itself.

### 5. Category first, intent packet second
The first release should organize by:
- `category`

The system should support a later refinement by:
- `intent packet`

Intent packets should be additive, not required on day one.

## User Experience

## Placement In The Workbench
Add a new section in the campaign setup screen:

- `Forcekey selector`

This should sit above or beside the manual `forcekeyA-forcekeyL` inputs.

The recommended layout is:
- selector panel on the left
- selected stack on the right

## Top Controls
The selector should have:

- `Category`
- `Intent packet` optional
- `Date window`
- `Buyer view` optional
- `Network comparison mode`

Recommended controls:
- `Category`: locked to the currently selected campaign preset by default
- `Intent packet`: optional filter if available
- `Date window`: default to trailing 14 complete days
- `Compare against`: `Category`, `Network`, later `Intent packet`

## Main List
Each forcekey row should show:
- forcekey phrase
- type badge:
  - `exact`
  - `templated`
- searches
- clicks
- revenue
- `RPC`
- `RPS`
- confidence badge
- comparison badges
- action buttons

Suggested row actions:
- `Analyze`
- `Add`

Suggested badges:
- `High volume`
- `Best RPS`
- `Best RPC`
- `Geo strong`
- `Rising`
- `Low confidence`

## Analysis Drawer / Modal
Clicking `Analyze` should open a drawer or modal with:

- forcekey phrase
- exact trailing window
- category baseline comparison
- network baseline comparison
- searches, clicks, revenue, `RPC`, `RPS`
- confidence notes
- matched keyword variants
- if templated:
  - best geo values
  - weak geo values
  - whether geo clustering looks promising

The purpose is:
- help the buyer understand the forcekey
- not force them to leave the launch flow

## Selected Stack
The selected stack panel should:
- show `forcekeyA-forcekeyL`
- allow drag reorder
- allow remove
- allow manual edits
- allow autofill into empty slots

Suggested controls:
- `Add to next open slot`
- `Replace selected slot`
- `Clear stack`
- `Autofill recommended top 6`
- `Autofill recommended top 12`

## Recommended Ranking Logic
The first version should reuse the same underlying forcekey-review philosophy already implemented in:
- `/Users/ericroach/code/liftoff/backend/src/lib/forcekeyReview.ts`

Specifically:
- confidence-aware ranking
- search minimums
- click minimums
- shrinkage for low-volume keywords
- explicit support for templated geo forcekeys

Do not rank only by:
- raw revenue
- raw `RPS`
- raw `RPC`

Recommended topline selector score:
- `confidence_weighted_forcekey_score`

Candidate shape:
- `score = shrunkRps`

Where `shrunkRps` is based on:
- conservative CTR
- shrunk RPC

That keeps the selector aligned with the current reorder engine.

## Data Model

### Core Forcekey Aggregate
Each selectable forcekey should resolve to an aggregate object shaped like:

```ts
type ForcekeySelectorOption = {
  forcekey: string
  normalizedForcekey: string
  type: "exact" | "templated"
  category: string
  intentPacketId?: string | null
  dateWindow: {
    start: string
    end: string
    label: string
  }
  metrics: {
    searches: number
    clicks: number
    revenue: number
    rpc: number
    rps: number
    ctr: number
  }
  score: {
    rankingScore: number
    conservativeCtr: number
    shrunkRpc: number
    shrunkRps: number
    confidence: "high" | "medium" | "low" | "insufficient_data"
  }
  comparison: {
    categoryRank: number
    categoryCount: number
    categoryRpsLiftPct: number
    networkRpsLiftPct: number
    networkRpcLiftPct: number
  }
  geo?: {
    token: "state" | "city" | "region"
    topValues: Array<{
      value: string
      searches: number
      clicks: number
      revenue: number
      rps: number
      rpc: number
      upliftPct: number
      band: "premium" | "baseline" | "weak"
    }>
    geoOpportunity: boolean
    rationale: string
  } | null
  observedKeywordVariants: string[]
}
```

### Selected Stack State
The UI should maintain:

```ts
type SelectedForcekeyStack = {
  slots: Array<{
    slot: "forcekeyA" | "forcekeyB" | "forcekeyC" | "forcekeyD" | "forcekeyE" | "forcekeyF" | "forcekeyG" | "forcekeyH" | "forcekeyI" | "forcekeyJ" | "forcekeyK" | "forcekeyL"
    value: string
    source: "manual" | "selector" | "autofill"
    selectedFrom?: {
      forcekey: string
      dateWindowStart: string
      dateWindowEnd: string
      rankingScore: number
    }
  }>
}
```

## API Contract

## Endpoint
Add a dedicated backend read endpoint:

- `GET /api/strategist/forcekey-selector`

This should be separate from the existing campaign-specific review endpoint because this feature is:
- `network/category discovery`
not just
- `campaign reorder review`

## Query Params
Suggested query contract:

```txt
buyer=Cook
category=Automotive > Crossovers > Nissan Rogue
intentPacketId=<optional>
startDate=2026-04-15
endDate=2026-04-28
compareTo=network
limit=50
```

## Response Shape

```ts
type ForcekeySelectorResponse = {
  generatedAt: string
  buyer: string | null
  category: string
  intentPacketId?: string | null
  dateWindow: {
    start: string
    end: string
    label: string
    type: "trailing_complete_days"
  }
  baselines: {
    category: {
      searches: number
      clicks: number
      revenue: number
      rpc: number
      rps: number
    }
    network: {
      searches: number
      clicks: number
      revenue: number
      rpc: number
      rps: number
    }
  }
  options: ForcekeySelectorOption[]
  notes: string[]
}
```

## Source Data
Initial source data should come from:
- cached/raw S1 keyword rows already used by forcekey review
- Strategis campaign/category associations
- optional buyer filter

Relevant existing files:
- `/Users/ericroach/code/liftoff/backend/src/lib/forcekeyReview.ts`
- `/Users/ericroach/code/liftoff/backend/src/routes/strategist.ts`
- `/Users/ericroach/code/liftoff/backend/src/lib/intentPacket.ts`

## Time Window Rules

### Default
Default to:
- trailing 14 complete days

If today is `2026-04-29`, default window is:
- `2026-04-15` through `2026-04-28`

Do not include the current partial day by default.

### User Visibility
The exact window must appear in:
- the top control area
- the analysis modal
- the final selected forcekey metadata if copied/exported

## Category And Intent Packet Behavior

### First Release
Category-level selector:
- required

Intent packet:
- optional if available
- if not available, omit the filter cleanly

### Later Release
Allow:
- category-only ranking
- category + intent packet ranking
- category + buyer ranking
- category + buyer + intent packet ranking

The important thing is to keep the first release simple enough to ship.

## Comparison Views
The system should support at least these comparisons:

### Category View
How does this forcekey perform within the current category?

### Network View
How does this forcekey compare to the overall network baseline?

### Future: Intent Packet View
How does this forcekey perform within the current packet?

The list should not require separate pages for each comparison. These should be toggles or badges in one selector.

## Confidence Rules
Forcekeys should surface a confidence badge using thresholds similar to the current review engine.

Suggested initial rules:
- `high`: strong volume and strong uplift
- `medium`: adequate volume and meaningful uplift
- `low`: usable but thin
- `insufficient_data`: too little signal for recommendation

The selector should still allow a buyer to choose a low-confidence forcekey manually, but it should not present it as a top recommendation.

## Templated Forcekeys
Templated forcekeys need special handling:
- `{city}`
- `{state}`
- `{region}`

Rules:
- keep the selector phrase parameterized
- roll up all matched live variants into one topline forcekey concept
- expose geo expansion details in the analysis drawer

Per the current operational note:
- normalize `{region}` alongside `{state}` for analysis
- preserve the literal configured token when writing back to campaign settings

Reference:
- `/Users/ericroach/code/liftoff/docs/ben-campaign-factory-call-notes.md`

## UI States

### Empty State
If no category forcekey data is available:
- explain that no 14-day data is available for that category
- allow manual forcekey entry

### Low Data State
If the category has data but low confidence:
- show the list
- mark the items low-confidence
- recommend manual caution

### Loading State
Show:
- category name
- requested time window
- loading skeletons

### Error State
Show:
- failed to load forcekey analysis
- keep manual forcekey entry available

## Buyer Workflow

### Standard Flow
1. Buyer picks campaign preset
2. Buyer picks article
3. Buyer opens forcekey selector
4. System shows trailing 14-day ranked forcekeys for the category
5. Buyer inspects 2-3 candidate rows
6. Buyer adds selected forcekeys into `A-L`
7. Buyer adjusts order
8. Buyer launches shell

### Fast Path
Allow:
- `Autofill top 6`
- `Autofill top 12`

This is useful for rapid launch situations.

## Out Of Scope For First Release
- automatic live forcekey rewriting on already-running campaigns
- dynamic daily reorders applied without buyer review
- city-level campaign generation from the selector
- Facebook-side forcekey selection logic
- generative keyword ideation unrelated to observed network performance

## Engineering Plan

### Phase 1
Backend read endpoint:
- category-level forcekey aggregation
- trailing 14 complete days
- confidence-weighted ranking
- network and category comparison

### Phase 2
Workbench UI:
- forcekey selector panel
- analysis drawer
- add-to-stack behavior
- drag reorder

### Phase 3
Intent packet support:
- filter by packet
- packet-relative comparisons

### Phase 4
Geo drilldown:
- templated forcekey geo insights
- optional geo-campaign recommendation badges

## Recommendation
Build this as a first-class `Forcekey selector` in the buyer launch workbench.

Do not leave forcekeys as only manual text inputs.

The correct user experience is:
- structured selection
- transparent 14-day analysis
- confidence-aware ranking
- direct insertion into the campaign stack

That is the fastest path to better launch speed without losing the judgment buyers still need.
