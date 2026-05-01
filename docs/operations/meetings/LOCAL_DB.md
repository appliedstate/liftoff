# Local Meeting DB

The local SQLite bootstrap exists so canonical meeting markdown can become queryable operating state before the full Postgres-backed meeting-intelligence stack is live everywhere.

## Purpose

Use this for:

- seeding local analysis from real meetings
- validating meeting structure before import into the main system
- preserving ground-truth operating history in a queryable format

## Bootstrap Command

```bash
python3 /Users/ericroach/code/liftoff/scripts/bootstrap_local_meeting_db.py
```

## Operator Report

```bash
python3 /Users/ericroach/code/liftoff/scripts/report_local_meeting_db.py
```

This renders a first-pass operator report from the local SQLite DB:

- recent meetings
- open action load
- owner queues
- recurring themes
- an operator-facing summary of the current execution bottleneck

## Daily Digest

The meeting-intelligence automation now rebuilds the local SQLite DB and includes the local operator report in the Slack digest.

Relevant environment variables:

- `MEETING_INTEL_SLACK_CHANNEL`
- `MEETING_INTEL_LOCAL_REPORT_DAYS`
- `MEETING_INTEL_ALERT_LIMIT`
- `MEETING_INTEL_SCORECARD_LIMIT`

Manual run:

```bash
cd /Users/ericroach/code/liftoff/backend
npm run meetings:automation
```

## Default Output

```text
/Users/ericroach/code/liftoff/data/meeting_intelligence_local.sqlite
```

## Seed Source

The script reads canonical meeting folders under:

```text
/Users/ericroach/code/liftoff/docs/operations/meetings
```

It expects the standard structure:

- `transcript.md`
- `outcomes.md`

## Current Scope

The local DB stores:

- meeting sessions
- participants
- transcript segments
- decisions
- action items
- projects
- principles
- risks
- product PRDs

This keeps the local bootstrap grounded in the same source material as the wider meeting-intelligence system, while staying simple enough to run without Postgres.
