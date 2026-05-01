---
title: "Board Decision Telemetry Spec"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Board Decision Telemetry Spec

## Purpose

This spec defines how Liftoff tracks board decisions over time so the company can measure:

- board decision velocity
- follow-through quality
- time from decision to action
- time from action to measurable outcome
- whether decisions were good, bad, mixed, premature, or unresolved

The goal is to make the board auditable and improve its quality over time.

## Why This Matters

The board should not be treated as a storytelling layer.

It should be treated as a decision mechanism whose outputs can be reviewed against reality.

If we do not log the board’s decisions, then we lose:

- decision memory
- attribution
- accountability
- learning
- calibration

## Core Questions This System Must Answer

1. How many consequential board decisions were made this week or month?
2. How fast do decisions move from discussion to operator call?
3. How fast do they move from operator call to first action?
4. How fast do they move from first action to measurable outcome?
5. Which board seats were most involved?
6. Which decisions were later judged good, bad, mixed, or still unresolved?
7. Which kinds of decisions tend to work best?
8. Where does the board create drag instead of leverage?

## Decision Lifecycle

Every board decision should move through a lifecycle.

### States

- `proposed`
- `in_review`
- `decided`
- `assigned`
- `in_progress`
- `partially_executed`
- `executed`
- `measured`
- `closed_good`
- `closed_bad`
- `closed_mixed`
- `closed_reversed`
- `stalled`

## Required Data Model

### `board_sessions`

One row per board session or board-reviewed decision cycle.

Required fields:

- `board_session_id`
- `title`
- `trigger_type`
- `context_md`
- `opened_at`
- `decided_at`
- `operator_person_id`
- `prime_directive_link`
- `workstream`
- `status`
- `created_at`
- `updated_at`

### `board_session_participants`

Board seats and humans participating in a session.

Required fields:

- `board_session_id`
- `participant_type`
- `seat_name`
- `person_id`
- `weighting_note`

Examples of `participant_type`:

- `digital_board_seat`
- `human_operator`
- `human_guest`

### `board_decisions`

One row per explicit board decision.

Required fields:

- `board_decision_id`
- `board_session_id`
- `decision_title`
- `decision_text`
- `decision_type`
- `decision_scope`
- `operator_final_call`
- `selected_option`
- `rejected_options_json`
- `rationale_md`
- `expected_upside`
- `expected_downside`
- `expected_constraint_relieved`
- `expected_metric_json`
- `decision_state`
- `decided_at`
- `review_due_at`
- `created_at`
- `updated_at`

### `board_decision_seat_inputs`

Each seat’s lens on the decision.

Required fields:

- `board_decision_id`
- `seat_name`
- `position_summary`
- `primary_concern`
- `primary_metric`
- `recommended_action`
- `disagreed_with_final_call`
- `created_at`

### `board_decision_actions`

The actions that flow from a board decision.

Required fields:

- `board_decision_action_id`
- `board_decision_id`
- `action_item_id`
- `owner_person_id`
- `status`
- `started_at`
- `completed_at`

### `board_decision_reviews`

The ex post review of decision quality.

Required fields:

- `board_decision_review_id`
- `board_decision_id`
- `reviewed_at`
- `review_window_type`
- `actual_outcome_summary`
- `actual_metric_json`
- `decision_quality`
- `variance_vs_expectation`
- `keep_doctrine`
- `change_doctrine`
- `notes_md`

Allowed values for `decision_quality`:

- `good`
- `bad`
- `mixed`
- `too_early_to_tell`
- `not_executed`
- `measurement_failed`

## Telemetry Metrics

### Decision Velocity

1. `time_to_decision`
   - `decided_at - opened_at`

2. `time_to_assignment`
   - first action assignment time after decision

3. `time_to_first_action`
   - first action actually started

4. `time_to_execution`
   - decision to action completion

5. `time_to_outcome_read`
   - decision to first measurable review

### Execution Quality

1. `% decisions with owner within 24h`
2. `% decisions with first action within 72h`
3. `% decisions fully executed`
4. `% decisions stalled`
5. `% decisions measured`

### Decision Quality

1. `% good`
2. `% bad`
3. `% mixed`
4. `% reversed`
5. `% not executed`

### Seat-Level Analytics

1. participation frequency by seat
2. disagreement rate by seat
3. correlation between seat-supported decisions and good outcomes
4. common concern types raised by each seat

## Minimal Decision Record Contract

Every consequential board decision must capture:

1. the question
2. the final operator call
3. the rationale
4. the expected upside
5. the key risk
6. the metric that will judge success
7. the review date
8. the owner of the next action

If any of these are missing, the decision record is incomplete.

## Operator Decision Memo Contract

Whenever a board decision is surfaced to the operator for approval, the memo should include:

1. `Why this belongs in the system`
2. `Why this now`
3. `Primary bottleneck relieved`
4. `Expected measurable upside`
5. `Cost of delay`
6. `Approval ask`

The memo should end with a direct approval line.

Preferred final line:

`If you agree, all you need to do is approve.`

## Review Cadence

### Weekly

Review:

- new decisions
- owner assignment latency
- stalled decisions
- overdue reviews

### Monthly

Review:

- decision velocity trends
- decision quality distribution
- repeat failure modes
- which workstreams consume the most board attention

### Quarterly

Review:

- whether the board composition is still useful
- whether some seats are redundant
- whether board involvement is improving company outcomes

## Outcome Rating Guidance

### `good`

Use when:

- decision executed
- core expected constraint was relieved
- meaningful upside materialized

### `bad`

Use when:

- decision executed
- expected benefit failed materially
- downside was larger than expected

### `mixed`

Use when:

- some intended effects happened
- but material downsides or misses also occurred

### `not_executed`

Use when:

- decision was made
- but follow-through never happened strongly enough to judge the decision itself

This is important because many “bad decisions” are actually unexecuted decisions.

## Suggested Initial Dashboard

Create a board decision dashboard with:

- decisions this week
- median time to assignment
- median time to first action
- decision quality mix
- top stalled decisions
- seats with highest disagreement rate
- workstreams consuming most board attention

## Existing Repo Anchors

This spec should connect to:

- [board-review-next-build-2026-04-29.md](/Users/ericroach/code/liftoff/docs/prd/board-review-next-build-2026-04-29.md)
- [meeting-intelligence-spec.md](/Users/ericroach/code/liftoff/docs/prd/meeting-intelligence-spec.md)
- [capital-allocation-operating-contract.md](/Users/ericroach/code/liftoff/docs/prd/capital-allocation-operating-contract.md)
- [docs/notes/media-buying-follow-through-audit-2026-04-29.md](/Users/ericroach/code/liftoff/docs/notes/media-buying-follow-through-audit-2026-04-29.md)
- [docs/prd/attention/decisioning-telemetry-experimentation-prd.md](/Users/ericroach/code/liftoff/docs/prd/attention/decisioning-telemetry-experimentation-prd.md)

## Immediate Build Recommendation

The first implementation can be simple.

V1 should support:

1. create a board session
2. log a board decision
3. link action items
4. track timestamps
5. review the outcome later

That is enough to start measuring decision velocity and decision quality.
