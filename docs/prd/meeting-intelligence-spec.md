---
title: "Meeting Intelligence Spec"
owner: Eric Roach
status: draft
date: 2026-04-29
---

# Meeting Intelligence Spec

## Purpose

This spec defines the first implementation for turning meetings and Slack conversations into structured operating intelligence.

The goal is not transcription storage alone.

The goal is to continuously extract:

- ideas
- concerns
- decisions
- action items
- responsible parties
- unresolved questions
- participant voice signals

and feed them into the company-state model.

## Initial Input Sources

Version 1 must support:

1. Google Meet transcripts
2. Slack channel listening
3. Manual transcript markdown files

## Core Output Requirement

Every ingested meeting or important Slack thread should produce a structured synthesis that answers:

1. What happened?
2. What matters?
3. What should be done?
4. Who owns it?
5. What remains unresolved?

## First-Pass Data Model

### `meeting_sessions`

One row per meeting or synthesized conversation unit.

Required fields:

- `meeting_id`
- `title`
- `meeting_type`
- `source_type`
- `source_uri`
- `occurred_at`
- `ended_at`
- `raw_text_ref`
- `summary_md`
- `decision_summary_md`
- `action_summary_md`
- `confidence_score`
- `created_at`
- `updated_at`

### `meeting_participants`

Join table between meeting and people.

Required fields:

- `meeting_id`
- `person_id`
- `display_name`
- `role_at_time`
- `participant_type`
- `attendance_confidence`

### `transcript_segments`

Speaker-attributed chunks from a transcript.

Required fields:

- `segment_id`
- `meeting_id`
- `speaker_label`
- `person_id`
- `started_at_offset_seconds`
- `ended_at_offset_seconds`
- `text`
- `source_type`
- `confidence_score`

### `meeting_ideas`

Every material idea raised in the conversation.

Required fields:

- `idea_id`
- `meeting_id`
- `raised_by_person_id`
- `description`
- `problem_addressed`
- `expected_upside`
- `constraint_relieved`
- `status`
- `linked_entities_json`
- `source_segment_id`

Status examples:

- `candidate`
- `actionable`
- `play_candidate`
- `rejected`
- `resolved`

### `meeting_decisions`

Explicit or strongly implied decisions.

Required fields:

- `decision_id`
- `meeting_id`
- `decision_text`
- `decision_owner_person_id`
- `decision_type`
- `linked_entities_json`
- `source_segment_id`
- `confidence_score`

### `meeting_action_items`

Executable tasks created from the meeting.

Required fields:

- `action_item_id`
- `meeting_id`
- `description`
- `owner_person_id`
- `backup_owner_person_id`
- `status`
- `priority`
- `urgency`
- `due_at`
- `linked_entities_json`
- `source_segment_id`
- `created_at`
- `updated_at`

Status examples:

- `open`
- `in_progress`
- `blocked`
- `done`
- `cancelled`

### `meeting_open_questions`

Questions that remain unresolved after synthesis.

Required fields:

- `question_id`
- `meeting_id`
- `raised_by_person_id`
- `question_text`
- `owner_person_id`
- `status`
- `source_segment_id`

### `person_voice_signals`

Extracted signals about what someone consistently cares about.

Required fields:

- `signal_id`
- `person_id`
- `meeting_id`
- `signal_type`
- `signal_text`
- `theme`
- `confidence_score`
- `source_segment_id`
- `created_at`

Signal examples:

- `opportunity_signal`
- `execution_signal`
- `risk_signal`
- `metric_signal`
- `bottleneck_signal`
- `followthrough_signal`

## Synthesis Pipeline

### Step 1. Ingest

Capture raw text and metadata from:

- Google Meet transcript exports
- Slack channels / threads
- markdown files

### Step 2. Normalize

Normalize:

- timestamps
- speaker names
- participant identities
- meeting type
- source references

### Step 3. Extract

Extract:

- summary
- ideas
- concerns
- decisions
- action items
- open questions
- voice signals

### Step 4. Link

Link extracted objects to:

- people
- buyers
- platform accounts
- contracts
- systems
- workflows
- assets

### Step 5. Escalate

Flag:

- ownerless action items
- unresolved repeated concerns
- repeated execution failures
- repeated opportunity mentions with no experiment launched

## Participant Profiling

The system should gradually build profiles from repeated meetings.

Example profile dimensions:

- what topics a person repeatedly raises
- what risks they repeatedly care about
- what opportunities they repeatedly push
- whether they focus more on execution, strategy, scale, or risk
- which action items they are assigned
- whether those action items tend to get completed

## Specific Founding Partner Requirements

The first important durable profile is for `Narbeh Ghazalian` through the `Founding Partner Seat`.

The system must be able to detect recurring patterns like:

- not enough focus on new opportunity sniffing
- concern about weak follow-through
- concern about Facebook pixel maintenance
- concern about consultant coordination
- desire for dedicated intent-packet exploration
- concern that buyers are overly biased toward easy launches

These patterns should become structured recurring signals, not just prose in old transcripts.

## Slack Listening Rules

Slack listening should focus on:

- action requests
- escalations
- opportunities
- blockers
- strategy debates
- follow-through failures

The unit of synthesis may be:

- a thread
- a burst of related messages
- a daily synthesis by channel

depending on implementation practicality.

## Manual Markdown Transcript Convention

Preferred file structure:

```md
---
title: "Media Buying Call"
occurred_at: "2026-04-29T10:00:00-07:00"
source_type: "manual_markdown"
participants:
  - Eric Roach
  - Narbeh Ghazalian
  - Ben
meeting_type: "media_buying_call"
---
```

Then transcript content with speaker labels if possible.

## Minimum Successful V1

Version 1 is successful if it can:

1. ingest one Google Meet transcript
2. ingest one Slack thread or channel summary
3. ingest one manual markdown transcript
4. generate a useful summary
5. extract action items with owners
6. extract recurring concerns
7. log voice signals for Narbeh and other participants
8. persist those outputs into a queryable schema

## Immediate Implementation Priority

Build this before more advanced board orchestration.

Reason:

Without durable meeting intelligence, the board and allocator will keep losing critical human judgment and execution context.
