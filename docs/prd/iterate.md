---
date: 2025-10-20
source: https://x.com/i/status/1973024775774917008
status: Draft
owner: Eric Roach
product: Iterate
---

# PRD — Iterate (feeds Attention Engine Factory)

## Working Notes
- Factory linkage: Inputs are sourced from the Facebook Discovery System; outputs feed the Creative Factory and Sandbox lane tests under the Attention Engine Factory.
- Reference: `../attention/10-attention-engine-factory.md`
- Product name: Iterate — enables fast creative versioning (single brand-swapped variant).
- Source list may originate from: (a) Facebook Ad Library page, or (b) the curated winners list produced by our Facebook Discovery Pipeline. For v1 we will prefer the Discovery Pipeline API as the primary input.

## 1. Problem Statement
Growth teams need a faster way to ideate, produce, and test high-performing Facebook ad creatives. Competitors’ currently-running ads signal what resonates in-market, but cloning them manually is slow and error-prone. We need an agent that ingests winning ads from our Facebook Discovery Pipeline API (or a selected list) and rebuilds them with our brand assets to accelerate concept testing while staying within policy.

## 2. Goals and Non-Goals
- Goals
  - Ingest winners via the Facebook Discovery Pipeline API (or a specified curated list).
  - Generate brand-swapped ad images using our product/brand assets with strong resemblance to high performers.
  - Store artifacts in-repo (versioned) and provide a reviewable output artifact.
  - Provide a one-click workflow with minimal operator inputs.
- Non-Goals
  - Fully automated campaign launch (ads manager trafficking is out of scope for v1).
  - Guarantees of policy compliance; we will surface checks and warnings, not legal guarantees.

## 3. Success Metrics
- Time-to-first draft creative: ≤ 5 minutes from input to image.
- Usable creative yield: ≥ 60% of generated images pass brand/policy review.
- Operator effort: ≤ 1–2 inputs (Discovery list id or ad ids, brand image). Optional prompt overrides allowed.

## 4. Users and Use Cases
- Users: Growth marketers, performance creatives.
- Primary use cases
  - Rapid ideation: Generate one brand-swapped image from a selected winning ad.
  - Competitive monitoring: Re-run on refreshed winners list from the Discovery Pipeline.
  - Brief creation: Export a keeper image for design polishing and testing.

## 5. Scope (v1)
- In Scope
  - Inputs: Facebook Discovery Pipeline API selection (e.g., list id or ad ids); 1 brand/product image; optional text prompt.
  - Storage: Store artifacts in-repo under a versioned run directory.
  - Generation: Call Gemini Nano “banana” model (per transcript reference) via Nano Banana pipeline to rebuild images with our brand.
  - Output: Write a simple reviewable artifact (Markdown/HTML) plus a JSON manifest of the run.
  - Ops: Log run metadata; keep reproducible source/outputs per run date.
- Out of Scope (v1)
  - Video ad recreation.
  - Automated A/B launch in Ads Manager.
  - Multi-language copy generation (may be a prompt option).

## 6. Functional Requirements
1) Workflow Orchestration
   - Provide an “Execute Workflow” entry point that accepts inputs and triggers all steps.
2) Ingest Winners from Discovery API
   - Fetch winning ad metadata/assets via the existing Facebook Discovery Pipeline API (no external scraping).
   - Persist raw creatives and metadata (headline, body, destination URL, impressions if available) in-repo.
3) Asset Preparation
   - Normalize images to model-friendly dimensions; de-duplicate exact matches; encode for API submission.
4) Brand Swap Generation
   - Prompt schema includes brand name, product name, tone, color palette hints.
   - Call Nano Banana/Gemini to generate a single brand-swapped image per selected source ad (v1).
   - Enforce safe/brand constraints (e.g., include brand logo/product where reasonable).
5) Output Assembly
   - Write a simple Markdown/HTML artifact showing the original creative and the generated image, plus metadata.
   - Save all images and `manifest.json` in-repo linking originals → generated.
6) Review and Export
   - Allow operator to mark keepers; export ZIP of selected artifacts + manifest.

## 7. Non-Functional Requirements
- Reliability: Handle transient API errors; retry with backoff.
- Latency: End-to-end target ≤ 5 minutes for a single selected ad.
- Cost: Expose per-run cost estimate from model usage.
- Compliance: Add visible disclaimer and policy checks (no false claims, restricted categories, trademark caution).

## 8. External Integrations
- Facebook Discovery Pipeline API (internal): Provide winners list and ad assets/metadata.
- Gemini via Nano Banana: Image generation API for brand-swapped assets.
- (Future) Google Drive/Slides API: Optional gallery/export surface for sharing iterations.

## 9. System Design (v1)
- Orchestrator: n8n workflow or Node/TS script runner with steps: ingest → prepare → generate → assemble → export.
- Storage Layout (in-repo)
  - `runs/facebook-discovery/{date}/{list_or_ad_id}/source/*`
  - `runs/facebook-discovery/{date}/{list_or_ad_id}/generated/*`
  - `runs/facebook-discovery/{date}/{list_or_ad_id}/manifest.json`
- Config: `config.json` per run (inputs, model params, counts).

## 10. Milestones
- M0: Skeleton workflow that ingests URL + brand image, writes stub gallery.
- M1: Scrape → store → generate images (single model) → manifest + gallery.
- M2: Add batch controls, retries, and basic policy checks.
- M3: Add review UI (keeper tags) and ZIP export.

### M1 — Ingest → Generate → Gallery (Detailed)

**Objective**: End-to-end single-model flow that ingests winning ads (via Discovery API or specified ad ids), generates one brand-swapped image per source, and outputs a reviewable gallery and `manifest.json` under a versioned `runs/` directory.

**Inputs**
- **Source**: Discovery winners list id OR explicit `adIds[]`.
- **Brand asset**: Single product/brand image (PNG/JPG, min 1024px on the long side).
- **Optional**: Prompt overrides (brand name, product name, tone, color hints), limit `maxAds`.

**Flow**
1. Ingest
   - Fetch source creatives + metadata from the Facebook Discovery Pipeline API.
   - Persist raw images and metadata to `source/`.
2. Prepare
   - Normalize image sizes (e.g., 1024×1024 or model-preferred aspect), deduplicate exact files.
3. Generate (single model)
   - Build prompt schema with brand/product/tone and palette hints.
   - Call Gemini via Nano Banana; produce one output per source image.
4. Assemble Outputs
   - Save generated images to `generated/`.
   - Write `manifest.json` mapping originals → generated with metadata and costs.
   - Render a simple side-by-side gallery (`index.md` or `gallery.html`).

**Storage Layout (per run)**
- `runs/facebook-discovery/{date}/{list_or_ad_id}/source/*`
- `runs/facebook-discovery/{date}/{list_or_ad_id}/generated/*`
- `runs/facebook-discovery/{date}/{list_or_ad_id}/manifest.json`
- `runs/facebook-discovery/{date}/{list_or_ad_id}/index.md` (or `gallery.html`)

**Data Contracts**
- `config.json`
  - Minimal example:
    - `runId: string` — timestamped id (e.g., `2025-10-21_674166542440211`)
    - `input: { source: 'discovery_api' | 'ad_ids', listId?: string, adIds?: string[], brandImage: string }`
    - `model: { provider: 'gemini-nano-banana', version?: string, seed?: number }`
    - `limits: { maxAds?: number }`
- `manifest.json` (per run)
  - Top-level:
    - `runId: string`
    - `summary: { numSources: number, numGenerated: number, costUsd: number, errors: { adId: string, message: string }[] }`
    - `items: Array<{
        adId: string,
        original: { imagePath: string, headline?: string, body?: string, destUrl?: string },
        generated: Array<{ imagePath: string, promptId?: string, seed?: number, costUsd?: number, status: 'ok' | 'error', errorMessage?: string }>
      }>`

**Acceptance Criteria**
- Given valid inputs (Discovery list id or `adIds[]`) and a brand image, running the workflow produces:
  - Raw source images and metadata under `source/`.
  - One generated image per source in `generated/`.
  - A valid `manifest.json` linking each original to its generated output(s) with costs and statuses.
  - A side-by-side gallery file (`index.md`/`gallery.html`) rendering original vs. generated with basic metadata.
- End-to-end latency for a single ad ≤ 5 minutes (happy path).
- Transient API errors are retried with backoff at least 2×; failures are recorded to `manifest.json`.
- Runs are idempotent by `runId`; re-running with the same `runId` does not overwrite without an explicit `--overwrite` flag (or equivalent control).

**Out of Scope for M1**
- Multi-model ensembles, advanced prompt exploration, video variants, and Ads Manager trafficking.
- Keeper tagging UI; ZIP export is planned for M3.

## 11. Risks & Mitigations
- Policy/Trademark risk: Add clearly visible disclaimer; avoid exact replicas; allow manual review step.
- Scrape instability: Implement retries and fallback parsing; cache last successful pull.
- Model artifacts (logo/text quality): Provide 2–3 prompt patterns; allow user-provided overlays for logo placement.

## 12. Open Questions
- Do we need copy rewriting alongside image swap in v1?
- Which exact Apify actor/version and rate limits?
- Authentication method for Drive (service account vs user OAuth)?
- Best input hand-off(s) from Discovery: full winners list id vs. ad id subset vs. small curated files.

## 13. Appendix — Transcript Excerpts (source intent)
> "Scrape all live ads for AG1 with Apify; store to Google Drive; encode and send to Gemini/Nano Banana; output brand-swapped variants for Thrive Mix; use gallery for ideation."



