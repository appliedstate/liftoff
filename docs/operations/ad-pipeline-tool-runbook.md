# Ad Pipeline Tool Runbook

## Purpose
This runbook captures the currently verified operating flow for Lian's ad pipeline tool at `https://strategis.vercel.app`, based on:

- the live app UI
- Slack training in `#ad-pipeline-tool`
- transcript review of `Update_13.mp4`

It is meant to bridge asset creation through pre-deploy review so the flow can later be mirrored or automated inside Liftoff.

## Primary Sources

### Slack Channel
- Channel: `#ad-pipeline-tool`
- URL: `https://lincx.slack.com/archives/C0AK8GCHXG8`

### Key Messages
- `2026-04-02 1:44 PM PT` from Lian
  - message: `Product update Push-To-Meta`
  - video: `Update_13.mp4`
  - duration: `22:09`
  - status: transcript reviewed
- `2026-04-02 1:55 PM PT` from Lian
  - message: `Push to Meta v1 cliff notes`
  - key points visible in Slack search:
    - eligible image and video assets
    - modes: `Manual` and `YOLO`
    - supports:
      - creating new Strategis + Meta campaigns
      - adding ads into an existing campaign/ad set
- `2026-04-08 7:26 PM PT` from Lian
  - message: `Product update: Captions`
  - excerpt confirmed in Slack:
    - stitch without voice while preserving video sound
    - manual caption adjustment
    - reuse captions across multiple videos
    - save captions with template
- `2026-03-20 11:45 AM PT` from Lian
  - asset library expanded to Example, Voice, Music, Image, Video, Lipsync
- `2026-03-20 5:00 PM PT` from Lian
  - asset library deduplication
- `2026-03-12 2:51 PM PT` from Lian
  - asset library v1

## Verified Live UI

### Top-Level Tabs
- `Campaigns`
- `Campaign Comp`
- `Campaign Perf`
- `Keywords`
- `State RPCs`
- `S1 Data`
- `S1 Ins`
- `Categories`
- `Articles`
- `RAMP`
- `Opportunities`
- mode switch:
  - `Ad Pipeline`
  - `System`

### Pipeline Cards
Verified live in the app:
- `Example`
- `Voice`
- `Music`
- `Image`
- `Video 1`
- `Video 2`
- `Video 3`
- `Stitch`
- `Captions`

### Common Controls
Verified live:
- `Run All`
- `Clear Pipeline`
- `Duplicate Pipeline`
- `Vary Prompts`
- `Generate Prompts`
- `Save Template`
- `Load Template`
- `Delete Pipeline`

## Creative Production Model

From Lian's Slack guidance, the tool is designed around a card pipeline, not a single form.

### Minimal Avatar-Style Flow
Slack excerpts confirm this typical order:
1. Generate voiceover in the `Voice` card.
2. Optionally add background audio in `Music`.
3. Generate or upload the avatar image in `Image`.
4. Generate the actual clip in a `Video` card.
5. Combine in `Stitch`.
6. Finalize overlays in `Captions`.

### Asset Reuse Model
The asset library is a core part of the workflow:
- generations and uploads are stored
- assets are shared across cards
- duplicate uploads are deduped
- prior assets can be reloaded into new pipeline runs

### Internal Libraries
Verified live in the UI:
- `Asset Library` on multiple cards
- `Internal Ad Library` on image/video cards

This means the pipeline supports three creative sources:
- newly generated assets
- manually uploaded assets
- previously stored internal assets

## Push-to-Meta Modes

Lian's training describes two push modes:

### Manual
Use this when:
- testing a new structure
- learning the workflow
- inserting into a complex shell
- needing to inspect naming, IDs, status, and inherited fields

### YOLO
Use this when:
- structure is already well understood
- the source campaign/ad set shell is simple
- speed matters more than field-by-field review

Lian's recommendation from the transcript:
- use `Manual` for the first `30-50` ads
- use `YOLO` later once the shell pattern is understood

## Push-to-Meta Wizard

### Verified Step Order
Observed live in the app:
1. `Upload`
2. `Campaign`
3. `Ad Set`
4. `Ad`
5. `Done`

### Step 1: Upload
Observed behavior:
- starting Push to Meta uploads the selected stitched/example asset into temporary storage first
- browser network activity showed temporary upload behavior before the wizard advanced
- verified runtime sequence:
  - `/api/ad-pipeline/meta-push/presign`
  - direct upload to Cloudflare R2 on `strategist-assets.b2b306d34d4bca1047532b640ea14bf7.r2.cloudflarestorage.com`
  - transition into campaign hydration after upload completes

### Step 2: Campaign
Verified live in the wizard:
- searchable Strategis campaign selector
- campaign row includes:
  - human campaign name
  - Strategis ID

Campaign selected during inspection:
- `siy45t10633_0216_ServiceTest_FB_HB_BH`
- Strategis ID: `siy45t10633`

Transcript-backed behavior:
- in copy-campaign flow, Strategis campaign duplication happens first
- rename suggestion updates:
  - Strategis ID prefix
  - date
  - copy suffix cleanup
- Meta campaign defaults to paused
- budget is inherited from source
- verified runtime loader:
  - `/api/ad-pipeline/meta-push/campaigns`

### Step 3: Ad Set
Verified live without submitting:
- section: `Source Ad Set`
- helper text:
  - first ad set is preselected so the user can continue immediately
- ad set choices expose:
  - status
  - bid
  - budget
  - bid strategy
- checkbox:
  - `Copy ad set`
- section: `Source Ad`
- helper text:
  - first ranked ad is preselected after ad set load
- source ads are listed with:
  - headline/name
  - status
  - Meta ad ID

Observed live values on the inspected shell:
- Ad set options:
  - `All | Auto - Copy PAUSED Bid: — Budget: $40 Bid strategy: LOWEST_COST_WITHOUT_CAP`
  - `All | Auto PAUSED Bid: — Budget: $40 Bid strategy: LOWEST_COST_WITHOUT_CAP`
- Source ads:
  - `Hasta $1700 por semana. ACTIVE ID: 120237403445670424`
  - `Consulta la disponibilidad a continuación. PAUSED ID: 120237403314680424`
  - `Consulta la disponibilidad a continuación. - Copy PAUSED ID: 120237403346230424`

Important interpretation:
- this screen is a shell/template selector
- it is choosing:
  - which ad set settings to inherit
  - which source ad to clone or replace
- verified runtime loader behavior:
  - after campaign selection, the app issues repeated requests to `/api/ad-pipeline/meta-push`
  - those calls hydrate:
    - source ad sets for the selected campaign
    - ranked source ads within the chosen ad set

### Step 4: Ad
Transcript-backed fields, even though live inspection stopped before this screen:
- create a new creative from the chosen image/video
- ad status defaults to paused
- CTA is inherited
- headline and primary text are editable
- up to five entries are supported
- URL updates to the new Strategis ID if a new Strategis campaign was created
- tracking template is inherited

### Step 5: Done
Transcript-backed result:
- summary screen shows the created:
  - Strategis campaign
  - Meta campaign
  - ad set
  - ad

## Operating Rules Inferred From Training

### What the Tool Is Doing
From first principles, the tool is not building Meta entities from scratch in a vacuum. It is using existing campaign structure as a shell and selectively replacing:
- creative asset
- ad copy
- names and dates
- destination / Strategis ID binding

That means the key operating unit is:
- `source shell + new creative payload`

not:
- `blank form -> raw campaign creation`

### Why This Matters
It reduces deployment risk because the tool inherits:
- budget logic
- CTA
- tracking
- shell settings
- active/ad set structure choices

This is why the flow starts with:
- select source campaign
- then source ad set
- then source ad

## What We Can Reliably Say Today

### Confirmed
- The app is operational.
- The Push-to-Meta flow is real and usable.
- The live wizard matches Lian's Slack training.
- The tool supports both creative production and deploy handoff.
- Asset generation is organized through the card pipeline.
- Deployment is organized around shell inheritance, not only new-entity creation.

## Runtime Endpoint Contract

The strongest confirmed runtime endpoints from the live app are:
- `/api/ad-pipeline/prompts`
- `/api/ad-pipeline/usage-summary?period=...`
- `/api/ad-pipeline/meta-push/presign`
- `/api/ad-pipeline/meta-push/campaigns`
- `/api/ad-pipeline/meta-push`
- `/api/system/strategis-auth-token`
- `/api/version`

Additional endpoint strings discovered in the shipped JS bundle:
- `/api/ad-pipeline/meta-push/pages`
- `/api/ad-pipeline/generate-lipsync`
- `/api/ad-pipeline/lipsync-status`
- `/api/ad-pipeline/transcribe`
- `/api/ad-pipeline/phrase-breaks`
- `/api/ad-pipeline/expand-prompt`

What this means:
- the Push-to-Meta flow is not a thin wrapper over raw public Strategis endpoints
- it uses a Vercel-side orchestration layer under `/api/ad-pipeline/meta-push*`
- the creative-generation and deploy flows share the same app-level backend surface

### Not Yet Fully Verified
- exact API route names behind each wizard step
- full live `Ad` step field layout from the browser
- final `Done` summary payload from the browser
- exact runtime boundary between:
  - preview/selection
  - actual create/write

## Current Blocker
The unrelated Apple Pay modal was avoided and no payment action was taken. Later in the inspection, Safari's accessibility bridge became unstable before one last console dump, so the final request-body extraction is still incomplete.

That means:
- no final submit/create action was taken in the pipeline
- no financial modal was touched
- the endpoint sequence is confirmed, but the exact `/api/ad-pipeline/meta-push` request bodies still need one more clean browser pass

## Practical Runbook

### To Produce a New Video Ad
1. Start with an example asset or prompt in `Example`.
2. Generate or upload voice in `Voice`.
3. Add optional background track in `Music`.
4. Generate or upload visual base in `Image`.
5. Generate clips in one or more `Video` cards.
6. Combine in `Stitch`.
7. Finalize in `Captions`.
8. Use `Push to Meta` from the finished creative card.

### To Push Manually
1. Open `Push to Meta`.
2. Wait for upload to finish.
3. Select Strategis campaign shell.
4. Select source ad set shell.
5. Decide whether to copy the ad set.
6. Select source ad shell.
7. Edit ad text/CTA/URL on the `Ad` step.
8. Confirm the created Strategis + Meta objects on `Done`.

### Recommended Use
- `Manual` for new shells, new buyers, or anything unclear
- `YOLO` only after the target shell pattern is stable

## Follow-Up Work

### Highest-Value Next Step
Resume browser inspection and capture:
- request bodies and response shapes for `/api/ad-pipeline/meta-push`
- exact `Ad` step field model
- exact create boundary before final submit

### After That
Map the tool into Liftoff concepts:
- `intent packet` -> creative payload
- `Edge` buyer -> Strategis deploy owner
- source shell -> source Strategis campaign / ad set / ad
- generated creative -> uploaded asset for Push-to-Meta

### Longer-Term Automation Target
To emulate Lian's tool safely, Liftoff needs:
- shell selection
- inherited field resolution
- creative upload handoff
- editable ad copy payload
- Strategis ID-aware destination rewriting
- explicit paused-first deployment
