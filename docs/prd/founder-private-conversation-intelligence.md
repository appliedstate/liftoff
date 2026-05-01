---
title: "Founder Private Conversation Intelligence"
owner: Eric Roach
status: draft
date: 2026-04-30
---

# Purpose

Capture founder-private Slack conversations with individual team members as structured operating intelligence without leaking them into shared meeting telemetry by default.

This exists so Eric can track:

- what the operating system is asking from each person
- what each person says they need
- what is blocked
- what follow-through is still open
- what should remain private vs what should later be promoted into the shared system

# Privacy Rule

Default rule:

- founder-private lanes ingest as `visibility_scope = private_operator`

Meaning:

- they should show up in Eric's private management surface
- they should **not** automatically flow into shared meeting lists, owner queues, execution-gap reports, entity-link reports, or allocator-grounding surfaces

Promotion rule:

- if Eric decides a specific private conversation or outcome should become public/shared, that meeting can be promoted by changing `visibility_scope` to `shared`

# Data Model

## Meeting Session Visibility

`meeting_sessions` now carries:

- `visibility_scope`
- `operator_person_id`
- `operator_name`
- `visibility_group_key`

## Founder-Private Source Registry

`private_conversation_sources` stores the durable registry for each private lane:

- `source_key`
- `label`
- `channel_ref`
- `slack_thread_ts`
- `watch_window`
- `meeting_type`
- `query`
- `visibility_scope`
- `operator_person_id`
- `operator_name`
- `counterpart_person_id`
- `counterpart_name`
- `objective`
- `status`
- `auto_ingest`
- `last_ingested_at`
- `last_meeting_id`

# API Workflow

## 1. Register A Private Lane

Use:

- `POST /api/meeting-intelligence/private-conversations/sources`

Required:

- `sourceKey`
- `channelRef`
- `counterpartName`

Recommended:

- `label`
- `objective`
- `watchWindow`
- `operatorPersonId`
- `operatorName`
- `autoIngest`

Example payload:

```json
{
  "sourceKey": "andrew-facebook-recovery",
  "label": "Andrew - Facebook Recovery",
  "channelRef": "https://lincx.slack.com/archives/C12345678",
  "counterpartName": "Andrew Cook",
  "objective": "Track Facebook account restriction recovery and unblock launch capacity",
  "watchWindow": "3d",
  "operatorPersonId": "eric",
  "operatorName": "Eric Roach",
  "autoIngest": true
}
```

## Seed Lanes Captured So Far

### Andrew Cook

- `sourceKey`: `andrew-facebook-recovery`
- `label`: `Andrew - Facebook Recovery`
- `channelRef`: `https://lincx.slack.com/archives/DMD4E81A6`
- `counterpartName`: `Andrew Cook`
- `objective`: `Track Facebook account restriction recovery and unblock launch capacity`
- `recommendedWatchWindow`: `3d`
- `status`: `pending_live_registration`

This is the first canonical founder-private lane and should be the first live registration once the DB-backed environment is ready.

## 2. Ingest The Lane

Use:

- `POST /api/meeting-intelligence/private-conversations/sources/:sourceKey/ingest`

What it does:

- pulls Slack messages from the registered channel or thread
- creates a `meeting_session`
- stamps it `private_operator`
- links it back to the source registry

## 3. Review The Private Report

Use:

- `GET /api/meeting-intelligence/private-conversations/report?operatorPersonId=eric`

The report is designed to answer:

- which private lanes are active
- which lanes are stale
- which lanes carry open follow-through
- which lanes are blocked or ownerless
- what the last movement was for each person

## 4. Promote A Meeting If Needed

Use:

- `PATCH /api/meeting-intelligence/meetings/:id/visibility`

Example:

```json
{
  "visibilityScope": "shared",
  "operatorPersonId": "eric",
  "operatorName": "Eric Roach"
}
```

Use this only when Eric explicitly decides the meeting should enter shared operating telemetry.

# Operator Surface

The operator review dashboard now includes:

- `Founder Private Lanes`

That section shows:

- active lane count
- stale / attention-needed counts
- whether a lane has ever been ingested
- latest movement
- open actions / ownerless actions / blocked actions / open questions
- latest captured summary

# Current Boundary

This implementation is deliberately narrow:

- it governs ingest, privacy, registration, and review
- it does **not** yet auto-decide what should become public
- it does **not** yet merge private-lane signals into shared allocator logic

That is intentional.

The boundary keeps private management private unless Eric promotes it.

# Resume Checklist

If we pick this up later, resume in this order:

1. Confirm migration `016_create_private_conversation_sources.sql` is applied.
2. Register the first live founder-private lanes:
   - Andrew
   - Bree
   - Ben
   - Lian
3. Ingest each lane once manually.
4. Review the `Founder Private Lanes` dashboard section.
5. Decide whether automation cadence should be widened or narrowed per person.
6. Decide whether any private outcomes should be promoted into shared telemetry.

# Immediate Next Use Case

Andrew's Facebook restriction lane is the canonical first test:

- register Andrew's Slack lane
- ingest it
- confirm the latest recovery status is visible privately
- confirm it does not pollute shared execution or allocator surfaces
