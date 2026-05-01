---
title: "Ad Duplication Experiment: Copy Policy for Media Buyers"
owner: Eric Roach
operator: Andrew Cook
status: draft
date: 2026-03-19
---

# Ad Duplication Experiment

## Problem Statement

We don't have a data-driven answer to: **should media buyers duplicate winning ads across campaigns, ad sets, or accounts?** Anecdotally some buyers clone campaigns from other buyers but with different ad creative. We need to stop guessing and run a controlled test.

## The Meta Adverse Effect Hypothesis

The core question this experiment answers is whether Meta's algorithm **punishes you** for duplicating ads. Here's what we know and what we need to prove or disprove:

### What Meta's Algorithm Does (Known Behavior)

1. **Auction de-duplication:** When multiple ad sets from the same account are eligible for the same auction, Meta only lets ONE enter. It picks the ad set with the highest "total value" (predicted action rate x bid x relevance). The others sit out that auction entirely.

2. **Learning signal dilution:** Each ad set needs ~50 conversion events/week to exit the learning phase. Duplicating the same ad across campaigns or ad sets means each one gets roughly 1/4 of the events. Instead of one strong ad set with full signal, you get four weak ones that may never exit learning — and stay semi-optimized permanently.

3. **CPM inflation:** Industry data suggests audience overlap above 20-30% inflates CPMs by up to 30%, because you're effectively bidding against yourself even though Meta prevents literal same-auction competition.

4. **Delayed performance decay:** Early results often look fine (the duplicate inherits some momentum), which tricks buyers into thinking it works. By the time performance visibly drops, substantial budget has been wasted and — critically — the **original winner may have been damaged**.

### The Hypothesis We're Testing

> **Duplicating an exact ad into additional campaigns/ad sets causes a net negative effect on the ORIGINAL ad's performance** — not just poor performance on the duplicate, but active harm to the thing that was already working.

This is the "adverse effect" — the duplication doesn't just fail to help, it **poisons the well**. The mechanism:
- The original ad set loses auction opportunities (Meta sidelines it in favor of the duplicate in some auctions)
- The original ad set's learning signal gets diluted (fewer conversions than before the duplicate existed)
- Account-level frequency rises, fatiguing the audience faster
- The original's delivery score / estimated action rate may degrade

**We either prove this is real and measurable, or we disprove it and confirm duplication is safe.**

## Definition: "Exact Same Ad"

Two ads are considered **duplicates** when ALL of the following are identical:

- Creative asset (same video file or image file, byte-for-byte or same ad_archive_id)
- Primary text (body copy)
- Headline
- Description
- Call-to-action button
- Landing page URL (including UTM parameters, minus unique tracking IDs)
- Any overlays, captions, or post-processing

If even one element differs (e.g., different headline on the same video), it is a **variant**, not a duplicate. Variants are out of scope for this experiment.

## Three Possible Outcomes

By the end of the experiment, exactly one of these must be proven:

### Outcome 1: "Always Copy" (Adverse Effect Disproved)
Duplicating ads has no negative impact on existing campaigns. Buyers should freely clone winners with no restrictions.

**Evidence required:**
- Original ad's ROAS, CPM, and delivery are unchanged after duplicates go live
- Duplicated ads perform at or above the original's baseline
- No measurable frequency cannibalization
- No auction overlap above 20%
- Consistent across all 3 rounds of testing

### Outcome 2: "Never Copy" (Adverse Effect Confirmed)
Duplicating ads actively hurts the original campaign's performance. Each ad should live in exactly one placement.

**Evidence required:**
- Original ad's ROAS drops measurably after duplicates launch (>10% decline)
- Original ad's CPM rises (>15% increase)
- Original ad's delivery/spend pacing slows
- Duplicated ads themselves also underperform the pre-duplication baseline
- Pattern repeats across all 3 rounds

### Outcome 3: "Copy Sometimes" (Conditional Adverse Effect)
Duplication hurts in some scenarios but not others. The experiment must produce a specific, written policy:

- **What** can be copied (which ad types / formats / verticals are safe)
- **Where** (same account different campaign? different account? ASC vs. manual?)
- **When** (performance thresholds, minimum age of ad, spend level)
- **How many** duplicates max before adverse effects appear
- **What guardrails** (frequency caps, audience exclusions, budget floors)

## Roles

| Role | Person | Responsibility |
|------|--------|----------------|
| Operator | Andrew Cook | Selects ads, builds test/control groups, launches campaigns, logs daily data, pauses if guardrails are breached |
| Observer | Eric Roach | Reviews checkpoints, validates data quality, co-authors final analysis and policy decision |

## Test Design

### What We Measure on the ORIGINAL (This Is the Key)

The primary question is not "how do the duplicates perform" — it's **"what happens to the original campaign after duplicates go live."** We measure:

1. **Original ad ROAS** — before vs. after duplication (the most important metric)
2. **Original ad CPM** — does it get more expensive?
3. **Original ad delivery/spend** — does it slow down?
4. **Original ad frequency** — does it rise faster?
5. **Original ad conversion rate** — does learning degrade?

Secondary: we also measure the duplicates' performance to understand the net portfolio effect.

### Setup (Per Round)

| Element | Control Group | Test Group |
|---------|--------------|------------|
| Ad selection | Top 5 performing ads (by session ROAS, 7d) | Same 5 ads |
| Control treatment | Ads left untouched in their current placement | Same — original stays untouched |
| Test treatment | N/A | 3 exact duplicates created in new campaigns/ad sets |
| Budget | No change to existing budgets | Duplicates get NEW budget (don't split the original's budget) |
| Audience | No change | Same targeting as original (allowing Meta overlap) |
| Duration | 14 days | 14 days |
| Account | Same ad account | Same ad account |

**Critical:** The original ad's budget stays the same. The duplicates get additional budget. This way, if the original's performance drops, we know it's the adverse effect — not budget dilution.

### Variables

**Independent variable:** Presence of exact duplicates in the same account (0 vs. 3 duplicates)

**Primary dependent variable:** Change in the ORIGINAL ad's session ROAS after duplicates go live

**Secondary dependent variables:**
- Original ad: CPM, CTR, CPC, frequency, delivery score, spend pacing
- Duplicate ads: ROAS, CPM, CTR, delivery
- Account-level: total frequency, auction overlap rate (via Meta delivery insights)
- Net portfolio: combined ROAS of original + duplicates vs. original alone

**Controlled variables (hold constant):**
- Creative assets (byte-identical)
- Ad copy (identical)
- Landing pages (identical)
- Original ad's bid strategy and budget (unchanged)
- Pixel / CAPI configuration
- Time of launch for duplicates

## Multi-Round Protocol: How Many Times We Run This

One round isn't enough to establish a pattern. We run **3 rounds minimum** with different ads each time.

### Why 3 Rounds

- Round 1 establishes the initial signal
- Round 2 confirms or contradicts Round 1 with different ads/verticals
- Round 3 is the tiebreaker if Rounds 1 and 2 conflict, or the confirmation if they agree
- 3 rounds across different verticals and time periods eliminates the possibility that results were driven by seasonality, a single ad's quirks, or random variance

### Round Structure

| Round | Ads | Vertical | Timing |
|-------|-----|----------|--------|
| Round 1 | 1 top performers | Primary vertical | Weeks 1-2 |
| Round 2 | 1 different top performers | Second vertical (or same vertical, different ads) | Weeks 3-4 |
| Round 3 | 1 different top performers | Mix / weakest-signal vertical from R1-R2 | Weeks 5-6 |

### Declaring a Result

| Scenario | Rounds Agree? | Result |
|----------|---------------|--------|
| All 3 rounds show no adverse effect | 3/3 agree | Outcome 1: Always Copy |
| All 3 rounds show adverse effect | 3/3 agree | Outcome 2: Never Copy |
| 2/3 rounds show adverse effect | Majority | Outcome 2: Never Copy (with caveats noted) |
| Mixed results across rounds | No clear majority | Outcome 3: Copy Sometimes — analyze what differed between rounds |
| 2/3 rounds show no effect, 1 shows harm | Majority positive | Outcome 1 likely, but investigate the outlier round for conditional rules |

### Per-Round Execution Steps

1. **Select 5 ads** by 7-day session ROAS, live for 7+ days, active delivery
2. **Document 7-day baseline** for each ad (ROAS, CPM, CTR, frequency, daily spend, delivery score)
3. **Launch duplicates** — 3 exact copies per ad in new campaigns with fresh budget
4. **Hands off for 72h** — no optimizations to originals OR duplicates
5. **Daily logging** — Andrew logs metrics for both originals and duplicates
6. **D7 checkpoint** — Eric + Andrew review; check for adverse effect signal on originals
7. **D14 data pull** — final metrics
8. **Kill duplicates** — pause all test duplicates
9. **D14-D21 recovery check** — monitor whether originals recover after duplicates are killed (this confirms causality)
10. **Round analysis** — compare original's pre/during/post-duplication performance

### Data Collection Template

**Original Ad Tracking (PRIMARY — fill this first every day):**

| Day | Ad ID | Campaign | Pre-Dup Baseline ROAS | Current ROAS | ROAS Delta % | CPM | CPM Delta % | Spend | Spend Delta % | Frequency | Sessions | Delivery Score | Notes |
|-----|-------|----------|-----------------------|--------------|--------------|-----|-------------|-------|---------------|-----------|----------|----------------|-------|

**Duplicate Ad Tracking (SECONDARY):**

| Day | Ad ID | Source Ad ID | Campaign | CPM | CTR | CPC | Sessions | vRPS | ROAS | Frequency | Learning Phase Status | Notes |
|-----|-------|-------------|----------|-----|-----|-----|----------|------|------|-----------|-----------------------|-------|

**Account-Level Tracking (WEEKLY):**

| Week | Total Account Frequency | Auction Overlap % (via Meta tool) | Total Spend | Total Sessions | Blended ROAS | Notes |
|------|------------------------|-----------------------------------|-------------|----------------|--------------|-------|

## Decision Framework

After all 3 rounds, apply these rules:

```
FOR EACH ROUND:
  adverse_effect = (
    original_ROAS_during_test < original_ROAS_baseline * 0.90
    OR original_CPM_during_test > original_CPM_baseline * 1.15
    OR original_spend_pacing_during_test < original_spend_pacing_baseline * 0.85
  )

  recovery_confirmed = (
    original_ROAS_post_kill recovers to within 5% of baseline within 7 days
  )

  adverse_effect_confirmed = adverse_effect AND recovery_confirmed

ACROSS ALL 3 ROUNDS:
  IF 0/3 rounds show adverse_effect_confirmed
  THEN → Outcome 1 (Always Copy — adverse effect disproved)

  IF 3/3 rounds show adverse_effect_confirmed
  THEN → Outcome 2 (Never Copy — adverse effect confirmed)

  IF 1/3 or 2/3 rounds show adverse_effect_confirmed
  THEN → Outcome 3 (Copy Sometimes — analyze what conditions differed)
```

**The recovery check is critical.** If the original's performance drops during duplication AND recovers after duplicates are killed, that's causal evidence of adverse effect — not just coincidence or market fluctuation.

## Output: What Gets Delivered

After all 3 rounds:

1. **Raw data spreadsheet** — daily metrics per ad per group, all 3 rounds
2. **Per-round summary** — adverse effect detected yes/no, magnitude, recovery confirmed yes/no
3. **Cross-round analysis** — pattern across rounds, vertical differences, statistical significance
4. **One-page policy decision** — the outcome (1, 2, or 3) and the rule going forward
5. If Outcome 3: **detailed duplication policy** with exact conditions, thresholds, and guardrails

## Timeline

| Milestone | Date | Owner |
|-----------|------|-------|
| Experiment design review | Week of 2026-03-23 | Eric + Andrew |
| **Round 1** | | |
| Ad selection & baseline documentation | 2026-03-25 | Andrew |
| R1 test launch (duplicates go live) | 2026-03-26 | Andrew |
| R1 D7 checkpoint | 2026-04-02 | Eric + Andrew |
| R1 D14 data pull + kill duplicates | 2026-04-09 | Andrew |
| R1 recovery check (D14-D21) | 2026-04-16 | Andrew |
| **Round 2** | | |
| R2 ad selection + baseline | 2026-04-16 | Andrew |
| R2 test launch | 2026-04-17 | Andrew |
| R2 D7 checkpoint | 2026-04-24 | Eric + Andrew |
| R2 D14 + kill + recovery week | 2026-05-08 | Andrew |
| **Round 3** | | |
| R3 ad selection + baseline | 2026-05-08 | Andrew |
| R3 test launch | 2026-05-09 | Andrew |
| R3 D14 + kill + recovery week | 2026-05-30 | Andrew |
| **Final** | | |
| Cross-round analysis & policy written | 2026-06-03 | Eric + Andrew |

**Total experiment duration: ~10 weeks** (3 rounds x 14 days + 7-day recovery gaps + analysis)

## Risks

- **Meta auction de-duplication masking:** Meta's algorithm already prevents same-account ads from competing in the same auction. This may mask the adverse effect or make it appear smaller than it is in a less sophisticated system. This is fine — we're testing real-world impact, not theoretical impact.
- **Delayed decay:** Performance degradation from duplication may take longer than 14 days to appear. Mitigation: the recovery check after killing duplicates helps detect slow-onset effects.
- **Seasonality:** Running 3 rounds over 10 weeks means market conditions change. Mitigation: always compare original's performance to its own baseline, not absolute numbers.
- **Budget confound:** Adding duplicate budget increases total account spend, which could independently affect auction dynamics. Mitigation: keep duplicate budgets modest relative to account total (target <15% of total daily account spend).

## References

- [Meta: Understand Auction Overlap](https://www.facebook.com/business/help/537699989762051) — official docs on how Meta handles overlapping ad sets
- [Duplicating Winning Meta Ad Sets: When It Works, When It Fails](https://marketingconsultancy.medium.com/duplicating-winning-meta-ad-sets-when-it-works-when-it-fails-and-how-to-decide-why-this-works-762906e525e2)
- [Guide to Duplicating Facebook Ads: Strategy, Scaling & Pitfalls](https://agrowth.io/blogs/facebook-ads/duplicating-facebook-ads)
- [Facebook Campaign Duplication Challenges](https://www.adstellar.ai/blog/facebook-campaign-duplication-challenges)
- [When to Duplicate Facebook Ads for Better Results](https://bir.ch/blog/duplicate-facebook-ad)
- [Why You Shouldn't Duplicate Your Facebook Campaigns](https://www.jasonburlin.com/why-you-shouldn-t-duplicate-your-facebook-campaigns)
- [Ad Set Cannibalization: When Your Campaigns Compete Against Each Other](https://leadenforce.com/blog/ad-set-cannibalization-when-your-facebook-campaigns-compete-against-each-other)
