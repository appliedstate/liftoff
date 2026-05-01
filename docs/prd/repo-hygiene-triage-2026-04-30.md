---
title: "Repo Hygiene Triage — Post Operator OS Checkpoint"
owner: Eric Roach
status: active
date: 2026-04-30
---

# Repo Hygiene Triage — Post Operator OS Checkpoint

This document classifies the remaining dirty worktree after the `codex/operator-os-checkpoint` branch was committed and pushed.

The goal is to prevent the repo from drifting into one giant undifferentiated backlog of local work, generated artifacts, and half-formed features.

## Current State

Checkpoint branch created and pushed:

- branch: `codex/operator-os-checkpoint`
- commit: `3a07dd8`

The operating-system checkpoint is safe.

What remains is a separate cleanup problem.

## Bucket 1 — Commit Next As Separate Feature Branches

These look like real product or system work and should not be ignored.

They should be split into deliberate branches instead of sitting loose in the worktree.

### Buyer Launch / Auth / Buyer Portal Surface

Examples:

- [apps/c1-dashboard/src/app/api/auth](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/app/api/auth)
- [apps/c1-dashboard/src/app/buyer-launch](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/app/buyer-launch)
- [apps/c1-dashboard/src/app/login](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/app/login)
- [apps/c1-dashboard/src/lib/backendProxy.ts](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/lib/backendProxy.ts)
- [apps/c1-dashboard/src/lib/buyerPortalAuth.ts](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/lib/buyerPortalAuth.ts)
- [apps/c1-dashboard/src/middleware.ts](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/middleware.ts)

Why this is a branch:

This is a coherent end-user surface, not a generated artifact.

Recommended branch:

- `codex/buyer-portal-surface`

### Ben / Buyer Setup / Catalog Surface

Examples:

- [apps/c1-dashboard/src/app/api/ben-launch-history](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/app/api/ben-launch-history)
- [apps/c1-dashboard/src/app/api/ben-launch-intelligence](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/app/api/ben-launch-intelligence)
- [apps/c1-dashboard/src/app/api/ben-setup](/Users/ericroach/code/liftoff/apps/c1-dashboard/src/app/api/ben-setup)
- [backend/src/lib/benArticleCatalog.ts](/Users/ericroach/code/liftoff/backend/src/lib/benArticleCatalog.ts)
- [backend/src/lib/benCampaignCatalog.ts](/Users/ericroach/code/liftoff/backend/src/lib/benCampaignCatalog.ts)
- [backend/src/lib/benShellSelectorCatalog.ts](/Users/ericroach/code/liftoff/backend/src/lib/benShellSelectorCatalog.ts)
- [backend/src/lib/buyerLaunchIntelligence.ts](/Users/ericroach/code/liftoff/backend/src/lib/buyerLaunchIntelligence.ts)

Why this is a branch:

This is a distinct buyer-ops workflow and should be reviewed as its own product slice.

Recommended branch:

- `codex/buyer-launch-intelligence`

### Meta Policy / Review Pressure / Risk Instrumentation

Examples:

- [backend/src/routes/metaPolicy.ts](/Users/ericroach/code/liftoff/backend/src/routes/metaPolicy.ts)
- [backend/src/routes/metaReviewPressure.ts](/Users/ericroach/code/liftoff/backend/src/routes/metaReviewPressure.ts)
- [backend/src/lib/metaPolicyHarness.ts](/Users/ericroach/code/liftoff/backend/src/lib/metaPolicyHarness.ts)
- [backend/src/lib/metaReactionSentiment.ts](/Users/ericroach/code/liftoff/backend/src/lib/metaReactionSentiment.ts)
- [backend/src/lib/metaReviewPressure.ts](/Users/ericroach/code/liftoff/backend/src/lib/metaReviewPressure.ts)
- [backend/src/lib/metaAdBoundaryScorer.ts](/Users/ericroach/code/liftoff/backend/src/lib/metaAdBoundaryScorer.ts)
- [backend/src/scripts/monitoring/analyzeLiveMetaRisk.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/analyzeLiveMetaRisk.ts)

Why this is a branch:

This is a coherent Facebook risk / policy instrumentation lane.

Recommended branch:

- `codex/meta-policy-risk`

### Intent Packet / Explore-Exploit Tooling Outside The OS Checkpoint

Examples:

- [backend/src/lib/intentPacket.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacket.ts)
- [backend/src/lib/intentPacketAxioms.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketAxioms.ts)
- [backend/src/lib/intentPacketDeploy.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketDeploy.ts)
- [backend/src/lib/intentPacketDiscovery.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketDiscovery.ts)
- [backend/src/lib/intentPacketLaunch.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketLaunch.ts)
- [backend/src/lib/intentPacketLearning.ts](/Users/ericroach/code/liftoff/backend/src/lib/intentPacketLearning.ts)
- related monitoring scripts under [backend/src/scripts/monitoring](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring)

Why this is a branch:

This is likely a real operating-system extension, but it is too large to remain mixed into general repo dirt.

Recommended branch:

- `codex/intent-packet-toolchain`

### Strategis / Campaign Factory / Monitoring Runtime Changes

Examples:

- [backend/src/lib/strategisApi.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategisApi.ts)
- [backend/src/lib/strategistClient.ts](/Users/ericroach/code/liftoff/backend/src/lib/strategistClient.ts)
- [backend/src/routes/campaignFactory.ts](/Users/ericroach/code/liftoff/backend/src/routes/campaignFactory.ts)
- [backend/src/routes/strategist.ts](/Users/ericroach/code/liftoff/backend/src/routes/strategist.ts)
- [backend/src/services/campaignFactory.ts](/Users/ericroach/code/liftoff/backend/src/services/campaignFactory.ts)
- [backend/src/services/strategisClient.ts](/Users/ericroach/code/liftoff/backend/src/services/strategisClient.ts)
- [backend/src/services/strategisFacebookClient.ts](/Users/ericroach/code/liftoff/backend/src/services/strategisFacebookClient.ts)

Why this is a branch:

These are core runtime mutations and should be reviewed with their own testing boundary.

Recommended branch:

- `codex/strategis-campaign-runtime`

## Bucket 2 — Good Candidates To Ignore

These appear local, generated, cache-like, or personal-working-state oriented.

They should not stay as repeated untracked noise.

### High-confidence ignore candidates

- [backend/.local](/Users/ericroach/code/liftoff/backend/.local)
- [scripts/__pycache__](/Users/ericroach/code/liftoff/scripts/__pycache__)
- [Knowledge](/Users/ericroach/code/liftoff/Knowledge)
- root export artifacts matching `meta_rejections_*`
- local sqlite/demo artifacts such as [scripts/capital_allocation_demo.sqlite](/Users/ericroach/code/liftoff/scripts/capital_allocation_demo.sqlite)

### Needs explicit decision before ignore

- [data/operator_batch_state.json](/Users/ericroach/code/liftoff/data/operator_batch_state.json)

Why this one is special:

It is currently useful machine state for the operator system and had to be force-added because `data/` is ignored.

Decision needed:

1. keep tracking this specific file with an exception rule, or
2. move tracked machine state out of `data/`, or
3. stop tracking it and regenerate it locally

## Bucket 3 — Archive / Remove From Repo Root

These should not sit loose at repo root long-term.

### Strong archive/remove candidates

- [meta_rejected_ads_rulebook_2026-01-01_to_2026-04-20.md](/Users/ericroach/code/liftoff/meta_rejected_ads_rulebook_2026-01-01_to_2026-04-20.md)
- root `meta_rejections_*` csv/jsonl/sqlite/xlsx files
- [system1-query-ui.html](/Users/ericroach/code/liftoff/system1-query-ui.html)

Recommended handling:

Move them into one of:

- `docs/analysis/`
- `artifacts/`
- `tmp/`

depending on whether they are durable reference, derived artifact, or disposable scratch.

## Bucket 4 — Needs Owner Decision Before Any Cleanup

These are too large or too ambiguous to auto-ignore or auto-commit safely.

### Large ambiguous surfaces

- [.claude](/Users/ericroach/code/liftoff/.claude) (`55,987` files)
- [server](/Users/ericroach/code/liftoff/server) (`767` files)
- [cloudflare](/Users/ericroach/code/liftoff/cloudflare)
- [backend/docs](/Users/ericroach/code/liftoff/backend/docs)
- [docs/analysis](/Users/ericroach/code/liftoff/docs/analysis)
- [docs/edge](/Users/ericroach/code/liftoff/docs/edge)

Why these need a decision:

They are too substantial to treat as accidental noise, but too disconnected from the operating-system checkpoint to include by default.

The immediate question is:

1. are these real product surfaces,
2. support materials that belong elsewhere, or
3. local caches / external bundles that should never live in this repo?

## Recommended Cleanup Order

### Step 1

Make a dedicated hygiene branch and commit only ignore-policy changes plus root-artifact relocation.

Recommended branch:

- `codex/repo-hygiene-pass-01`

### Step 2

Resolve tracked machine state policy for [operator_batch_state.json](/Users/ericroach/code/liftoff/data/operator_batch_state.json).

This is the only operator-system file whose storage policy is still structurally awkward.

### Step 3

Split the remaining real work into feature branches in this order:

1. buyer portal / auth
2. meta policy / review pressure
3. strategis / campaign runtime
4. intent packet toolchain

### Step 4

Do an owner decision pass on:

- `.claude`
- `server`
- `cloudflare`
- `backend/docs`

## Bottom Line

The operating-system checkpoint is safe and already pushed.

What remains is not “one more commit.”

It is a repo hygiene problem with four different classes of work:

1. real features that need branches
2. generated/local files that need ignores
3. root artifacts that need relocation
4. ambiguous large surfaces that need an explicit ownership decision
