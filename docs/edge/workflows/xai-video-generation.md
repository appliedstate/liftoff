---
id: edge-workflow-xai-video-generation
version: 0.1.0
owner: growth-ops
title: Edge — xAI Video Generation (API → local asset)
purpose: Generate campaign-ready short-form videos via xAI and persist locally for reuse in Edge campaign workflows.
---

## What this is

xAI video generation is **deferred**:
- You **start** a job and receive a `request_id`
- You **poll** until a final video `url` is available
- We **download** the MP4 and store it locally for campaign use

Reference: `https://docs.x.ai/docs/guides/video-generations`

## Where files land (local canonical)

All outputs are stored under:
- `backend/generated/xai/<requestId>/`

Inside each job folder:
- `request.json` — inputs used to start the job
- `status.json` — latest status payload
- `job.json` — normalized record (status, file paths, result url)
- `video.mp4` — downloaded video (when ready)

## Guardrails (policy + RSOC reality)

For RSOC, our creative should be **informational and non-promissory**.

- **Headline compliance**: headlines/overlays that are passed downstream (e.g., Google) must stay compliant and avoid restricted claims.
- Avoid:
  - diagnosis/personal attributes (“you have…”, “your condition…”)
  - guarantees (“will”, “instant”, “cure”, “guaranteed”)
  - fear/scare certainty
- Prefer:
  - “see options”, “learn more”, “see what’s included”
  - “baseline”, “checklist”, “what people check first” (informational framing)

## How to translate an Edge packet into a prompt (manual for now)

Source files (per campaign packet):
- `02_ad_script.md` — core hook, lines, CTA, disclosure
- `04_video_ads.md` (or `04_video_ad.md`) — shot list + overlays + proof requirement

Recommended prompt schema (copy/paste and fill):

```
Create a brand-safe, realistic 8–10 second short-form video ad.

Style: UGC selfie + simple screen overlay. Mobile-native.
Structure: Hook (0-2s), context (2-4s), proof (4-7s), CTA (7-10s).

On-screen overlays (short, compliant):
- Hook overlay: "<hook overlay>"
- Headline overlay: "<article headline (shortened if needed)>"
- Proof overlay: show 3–4 button-like keywords for 1–2 seconds:
  1) "<keyword 1>"
  2) "<keyword 2>"
  3) "<keyword 3>"
  4) "<keyword 4>"
- CTA overlay: "<CTA overlay>"

Disclosures:
- Optional tiny footer: "For informational purposes" (only if required).

Avoid medical or personal-attribute claims. No guarantees.
```

## How to generate via the backend API (recommended)

### 1) Set env

In `backend/.env` (or your environment):
- `XAI_API_KEY=<your key>`

Optional defaults:
- `XAI_VIDEO_MODEL=grok-imagine-video`
- `XAI_VIDEO_OUTPUT_DIR=generated/xai`

### 2) Start a job

```bash
curl -X POST "http://localhost:3001/api/xai/videos" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cat playing with a ball",
    "model": "grok-imagine-video",
    "duration": 8,
    "aspect_ratio": "9:16",
    "resolution": "720p",
    "autoDownload": true
  }'
```

The response includes `requestId` and the key endpoints.

### 3) Poll status

```bash
curl "http://localhost:3001/api/xai/videos/<requestId>"
```

### 4) View the MP4 (after download)

```bash
open "http://localhost:3001/api/xai/videos/<requestId>/file"
```

## CLI helper (fast local)

From `backend/`:

```bash
npm run xai:generate -- "A cat playing with a ball"
```

This calls the API, polls status, and prints the local path when `video.mp4` is ready.

## Failure modes (common)

- **Missing key**: `Missing XAI_API_KEY`
- **Job never completes**: polling times out (increase `XAI_VIDEO_MAX_WAIT_MS`)
- **Completed but download fails**: try `POST /api/xai/videos/<requestId>/download` and re-check status

