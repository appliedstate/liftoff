---
id: creative/42-ai-ad-cloner
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: AI Ad Cloner — Competitive Pattern Transfer
purpose: Scrape competitor ads and generate brand-safe variants; feed concepts into Hook Ideation Agent.
dependencies:
  - creative/41-hook-ideation-agent.md
licensing: internal
---

# 42 — AI Ad Cloner

Generates brand-safe variants from competitor ads (layout, lighting, composition) and hands off winning concepts to the Hook Ideation Agent for scripting and variant generation.

## Integration: Hook Ideation Agent
- Hand-off endpoint: 
- Payload:

- Output targets:
  -  (new concepts from cloned patterns)
  -  (one-liners + widget tie-ins)
  -  (916/45/11 scripts)

Compliance gates: no brand marks/logos; novelty via embedding similarity < 0.80 to competitor lines and < 0.85 to concept-level.

---

# PRD — Facebook Ad Thief (AI Ad Cloner)

> **UX Copy (for Agent UI)**
>
> **Hello! Curious about what you're watching? We’re here to help.**  
> Not sure what to ask? Choose something:
> - Summarise the video  
> - Recommend related content  
> - How do ads get cloned?  
> - What is “Nano Banana”?

---

## 1) System Overview

### Problem solved
Producing high-performing ad creatives is expensive and slow. Competitors’ live ads already encode working visual patterns and copy structures. This system automates “competitive pattern transfer”: it ingests a **Facebook Ad Library** URL and a **user product image**, analyzes the competitors’ creatives, and generates **brand-swapped variants** that preserve the winning layout, tone, and concept—fast enough for iterative testing.

### Core functionality
1. **Scrape** competitor ads (images + metadata) from a Facebook Ad Library URL via **Apify** Actor.  
2. **Loop** through each ad; download and archive the source creative.  
3. **Meta-prompt** with **Gemini 2.5 Pro** to synthesize a **task-specific generation prompt** using both the competitor ad image and the user’s product image.  
4. **Generate** the cloned creative via **Gemini 2.5 Image Preview** (a.k.a. “Nano Banana”).  
5. **Validate & save** outputs to **Google Drive** for review and deployment.

### Key users
- Performance marketers and growth teams
- Agencies running multi-client creative ops
- Small brands needing rapid creative iteration

### High-level architecture
```
User ➜ n8n Form Trigger
    ➜ Apify Actor: Facebook Ad Library Scraper
    ➜ Loop (per ad):
        ➜ HTTP GET (download ad image)
        ➜ Google Drive (archive source)
        ➜ Convert ➜ Base64
        ➜ Set Meta-Prompt
        ➜ Gemini 2.5 Pro (prompt synthesis)
        ➜ Gemini 2.5 Image Preview / “Nano Banana” (image generation)
        ➜ Safety/Prohibited check
        ➜ Extract image (Base64)
        ➜ File (Base64 ➜ binary)
        ➜ Google Drive (save output)
    ➜ Summary/Log
```

---

## 2) Workflow Steps (Inputs • Process • Outputs • Dependencies)

> Node names below match typical **n8n** nodes. Keep naming consistent for readability and debugging.

### Step 0 — Configuration & Secrets (pre-req)
- **Inputs**:  
  - `APIFY_TOKEN` (OAuth or token)  
  - `GEMINI_API_KEY`  
  - Google Drive credentials (OAuth)  
  - Folder IDs: `GDRIVE_SOURCE_FOLDER_ID`, `GDRIVE_OUTPUT_FOLDER_ID`
- **Process**: Store as n8n **Credentials** and **Environment Variables**; reference via n8n expressions.
- **Outputs**: Credential handles accessible to nodes.
- **Dependencies**: n8n Credentials; Google Drive; Apify; Gemini.

---

### Step 1 — Automation Trigger & Input Collection
- **Inputs**:  
  - `competitorAdLibraryUrl` *(string)*  
  - `productImage` *(file upload)*
- **Process**: **Form Trigger** node collects inputs.  
  Convert `productImage` to Base64 with **Move Binary Data** (Binary ➜ JSON; Encoding: Base64).  
- **Outputs**:  
  - `inputs.url` *(string)*  
  - `inputs.product.base64` *(string, data URI not required; keep raw Base64 + mime)*
- **Dependencies**: n8n **Form Trigger**, **Move Binary Data**.

**Tip (n8n expression for mime tagging if needed):**
```json
{
  "productImage": {
    "mime": "image/png",
    "data": "{{$json.productBase64}}"
  }
}
```

---

### Step 2 — Scrape Competitor Ads (Apify Actor)
- **Inputs**: `inputs.url`
- **Process**: **Apify** node ➜ Action: **Run actor and get dataset**  
  - Actor: *Facebook Ad Library Scraper* (name may vary in the Apify store)  
  - Actor input JSON (minimal example):
    ```json
    {
      "adLibraryUrl": "={{$json.inputs.url}}",
      "maxItems": 1000,
      "includeCreatives": true
    }
    ```
- **Outputs**: `ads[]` array with at least:  
  - `originalImageUrl`  
  - `adId` (or equivalent)  
  - Optional: caption/copy, page name, spend signals (if available)
- **Dependencies**: **Apify** account (OAuth/Token), n8n **Apify** node.

> **Note**: The user-provided cost reference “1,000 ads for ~$0.75” is illustrative. Check current Apify pricing/limits.

---

### Step 3 — Iterate Over Ads
- **Inputs**: `ads[]`
- **Process**: Use **Split In Batches** for deterministic sequential processing (or see **Parallelization** below). Each item carries `ad.adId`, `ad.originalImageUrl`, etc.
- **Outputs**: Per-ad context item.
- **Dependencies**: n8n **Split In Batches** (or **Item Lists** + **Execute Workflow** for fan-out).

---

### Step 4 — Download & Prepare Competitor Image
- **Inputs**: `ad.originalImageUrl`
- **Process**:  
  1) **HTTP Request** (GET) ➜ obtain binary.  
  2) **Google Drive** (Upload) ➜ save source into `GDRIVE_SOURCE_FOLDER_ID` (for provenance).  
  3) **Move Binary Data** ➜ convert binary to Base64 JSON field `competitor.base64`.  
  4) **Merge** (if needed) to keep `ad` fields alongside the new Base64.
- **Outputs**:  
  - `competitor.base64`  
  - `competitor.mime` (derive from headers if available)  
  - `competitor.sourceDriveFileId`
- **Dependencies**: n8n **HTTP Request**, **Google Drive**, **Move Binary Data**, **Merge**.

---

### Step 5 — Meta-Prompt Synthesis (Gemini 2.5 Pro)
- **Inputs**:  
  - `inputs.product.base64` (+ mime)  
  - `competitor.base64` (+ mime)
- **Process**:  
  1) **Set** node builds a **meta-prompt** instructing Gemini to analyze both images and **author a task-specific generation prompt**.  
  **Meta-prompt template (example):**
  ```
  You are creating an ad-generation prompt. Analyze the competitor ad (layout, lighting, background, text placement, focal object)
  and the user product image (shape, material, scale). Produce a single, explicit prompt that tells an image model to insert
  the user product into the competitor’s composition while preserving composition, lighting, color grade, visual hierarchy,
  and typography spacing. Include guidance for shadows/reflections, background cleanup, rim light, and brand-safe placement.
  Do not include any brand names or logos from the competitor. Avoid infringing text or trademarks.
  ```
  2) **HTTP Request** ➜ **Gemini 2.5 Pro** (generateContent).  
     - Endpoint (example):  
       `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={{$env.GEMINI_API_KEY}}`
     - Body (pattern):
       ```json
       {
         "contents": [{
           "role": "user",
           "parts": [
             {"text": "={{$json.metaPrompt}}"},
             {"inline_data": {"mime_type": "={{$json.product.mime}}","data": "={{$json.inputs.product.base64}}"}},
             {"inline_data": {"mime_type": "={{$json.competitor.mime}}","data": "={{$json.competitor.base64}}"}}
           ]
         }]
       }
       ```
- **Outputs**:  
  - `synthesizedPrompt` *(text: the tailored, image-aware generation prompt)*
- **Dependencies**: n8n **Set**, **HTTP Request**; **Gemini API**.

---

### Step 6 — Image Generation (Gemini 2.5 Image Preview / “Nano Banana”)
- **Inputs**:  
  - `synthesizedPrompt`  
  - `inputs.product.base64` (+ mime)  
  - `competitor.base64` (+ mime)
- **Process**:  
  **HTTP Request** ➜ **Gemini 2.5 Image Preview** model (a.k.a. “Nano Banana”).  
  - Endpoint (example):  
    `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-image-preview:generateContent?key={{$env.GEMINI_API_KEY}}`
  - Body (pattern):
    ```json
    {
      "contents": [{
        "role": "user",
        "parts": [
          {"text": "={{$json.synthesizedPrompt}}"},
          {"inline_data": {"mime_type": "={{$json.product.mime}}","data": "={{$json.inputs.product.base64}}"}},
          {"inline_data": {"mime_type": "={{$json.competitor.mime}}","data": "={{$json.competitor.base64}}"}}
        ]
      }]
    }
    ```
  - **Safety/Prohibited check**: Inspect `promptFeedback.blockReason` or `candidates[0].safetyRatings`. If blocked or high-risk, **Skip Item** and log.
  - **Extract Base64**: **Function** node to pull `inlineData.data` (or similar) from first candidate image part:
    ```js
    const c = $json.candidates?.[0];
    const parts = c?.content?.parts || [];
    const img = parts.find(p => p.inlineData?.data);
    return [{ json: { outputBase64: img?.inlineData?.data || null } }];
    ```
- **Outputs**: `outputBase64` (+ assumed mime, e.g., `image/png`)
- **Dependencies**: n8n **HTTP Request**, **If** (conditional), **Function**.

---

### Step 7 — Persist Final Creative
- **Inputs**: `outputBase64`
- **Process**:  
  1) **Move Binary Data** (JSON ➜ Binary) with Base64 decode.  
  2) **Google Drive** (Upload) ➜ `GDRIVE_OUTPUT_FOLDER_ID`  
     - Filename pattern: `cloned_ad__{{$json.ad.adId || $json.index}}__{{$now}}.png`
- **Outputs**:  
  - Google Drive file (final creative)  
  - `outputDriveFileId`
- **Dependencies**: n8n **Move Binary Data**, **Google Drive**.

---

### Step 8 — Summary, Logging, & Hand-Off (optional)
- **Inputs**: Per-ad results
- **Process**: **Aggregate** results; write a **CSV/JSON log** to Drive; optionally post a Slack/Email summary with counts of successes, skips, and errors.
- **Outputs**:  
  - Run report (counts, file links)  
  - Optional Slack/Gmail notification
- **Dependencies**: n8n **Merge**, **Spreadsheet File**, **Slack/Gmail** nodes.

---

## 3) Final Deliverable & Success Metrics

### Deliverable
- A **Google Drive folder** of generated ad creatives (PNG/JPEG), each reflecting the competitor’s layout/lighting while showcasing the brand’s product.  
- A **run report** (CSV/JSON) with: ad IDs, source file links, output file links, safety flags, errors.

### Success metrics
- **Throughput**: Ads processed/hour; % successful generations.  
- **Quality** (review rubric): composition match, lighting match, artifact rate, text cleanliness, brand placement.  
- **Test lift**: CTR/CVR deltas vs. baseline creatives in controlled A/B tests.  
- **Reliability**: Error rate, blocked-content rate, re-try success rate.

---

## 4) Implementation Requirements

- **n8n** instance (cloud or self-hosted).  
- **Apify** account & Facebook Ad Library scraper Actor.  
- **Google Gemini** API key (access to **2.5 Pro** and **2.5 Image Preview**).  
- **Google Drive** integration (source/output folders created in advance).  
- **n8n workflow template** (if provided by the source community); otherwise build per steps above.  
- **Governance**: Written internal guidelines on IP, brand safety, and platform ToS.

---

## 5) Design Rationale & FAQs

### Why meta-prompting (two-stage) instead of a single prompt?
- **Decomposition improves fidelity**: separating *analysis & planning* (Gemini 2.5 Pro) from *image synthesis* (Image Preview) yields prompts tailored to each ad’s composition (framing, light direction, hierarchy), substantially reducing artifacts and mismatched scale.  
- **Reusability**: meta-prompt can encode house style (e.g., “no competitor logos,” “match LUT/color grade,” “add subtle rim light”).  
- **Control**: easier to enforce constraints and inject review heuristics.

### How are images prepared for Gemini?
- Convert binaries to **Base64** via **Move Binary Data**.  
- Pass as `inline_data` with correct `mime_type` (`image/png` or `image/jpeg`).  
- Keep payload sizes reasonable; avoid > ~10MB per image. If needed, downscale before encoding.

### What Apify action is used?
- **Run actor and get dataset** for the Facebook Ad Library scraper Actor. Provide the **Ad Library URL** and include creatives if supported. The Actor returns a dataset with creative URLs and metadata.

### Where are outputs stored?
- **Google Drive**, in two folders:
  - `Source Ads/` (archived competitor images)  
  - `Cloned Ads/` (generated outputs)  
- Optional: a `Reports/` folder for run logs and CSVs.

### How are ads processed in parallel?
- Default: **sequential** via **Split In Batches** (simple & deterministic).  
- **Parallel (recommended for scale)**:  
  - Switch n8n to **Queue Mode** and run **multiple workers**.  
  - Use **Execute Workflow** (don’t wait) to **fan-out** per ad; each worker pulls jobs concurrently.  
  - Rate-limit **Gemini** and **Apify** nodes (n8n **Rate Limiter** or custom delays) to respect API quotas.  
  - Merge results via a parent workflow or a Drive/DB sink.

### How is the final ad validated?
- **Automated checks**:
  - Gemini 2.5 Pro **post-check**: “Does output place the product plausibly? Any artifacts or trademark infringement?” Return a quality score + flags.  
  - **Safety** review of model response (`promptFeedback`, `safetyRatings`).  
  - **Image heuristics**: optional SSIM/LPIPS vs. competitor layout mask; OCR to detect forbidden text.  
- **Human review queue** (recommended): Slack/Inbox with thumbnails + approve/reject buttons.

---

## 6) Data Contracts (fields)

### Input contract
```json
{
  "competitorAdLibraryUrl": "string (required)",
  "productImage": {
    "mime": "image/png|image/jpeg",
    "base64": "BASE64_STRING"
  }
}
```

### Apify output (simplified)
```json
{
  "ads": [{
    "adId": "string",
    "originalImageUrl": "https://...",
    "pageName": "string",
    "caption": "string"
  }]
}
```

### Generation request (Gemini 2.5 Pro)
(see Step 5 body)

### Generation request (Gemini 2.5 Image Preview)
(see Step 6 body)

### Final record
```json
{
  "adId": "string",
  "sourceDriveFileId": "string",
  "outputDriveFileId": "string",
  "blocked": false,
  "qualityScore": 0.0,
  "notes": "string"
}
```

---

## 7) Errors, Limits, and Retries

- **Apify**: Handle HTTP 429/5xx with exponential back-off; paginate datasets.  
- **Gemini**: Respect token/image limits; on **blocked** content, **skip** and log; retry transient 5xx.  
- **Drive**: Retry upload on 5xx; ensure unique filenames.  
- **n8n**: Enable **continue on fail** where safe; write per-item error payloads to `Reports/`.

---

## 8) Legal, Ethics, and Platform Policies

- **Do not copy protected trademarks/logos or unique copyrighted artwork**. The meta-prompt must explicitly forbid reproducing competitor brand marks or distinctive text.  
- **Respect Facebook and Apify terms**; use public Ad Library data as permitted.  
- Treat outputs as **inspired-by** compositions for testing, not 1:1 replicas. Maintain brand-safe, non-confusing presentation.

---

## 9) Implementation Checklist

- [ ] n8n project created; credentials set (Apify, Gemini, Drive)  
- [ ] Folders created in Drive: `/Source Ads`, `/Cloned Ads`, `/Reports`  
- [ ] Form Trigger with URL + product image  
- [ ] Apify Actor node (run + get dataset)  
- [ ] Loop (sequential or fan-out)  
- [ ] Download ad image ➜ archive ➜ Base64  
- [ ] Meta-prompt (Set) ➜ Gemini 2.5 Pro  
- [ ] Image generation ➜ Gemini 2.5 Image Preview  
- [ ] Safety check ➜ extract Base64  
- [ ] Base64 ➜ binary ➜ Drive upload  
- [ ] Summary report + optional Slack/Gmail notice  
- [ ] A/B testing hand-off to ads manager

---

## 10) Example n8n Snippets

**Move Binary Data (Binary ➜ JSON)**
- Mode: *Binary to JSON*  
- Property: `data`  
- Encoding: *Base64*  
- Result key: `competitor.base64` (or `inputs.product.base64`)

**If (Prohibited)**
```js
// Evaluate Gemini response object in $json
const blocked = $json.promptFeedback?.blockReason || false;
return blocked ? [{json: {skip: true}}] : [{json: {skip: false}}];
```

**Filename expression**
```
cloned_ad__{{$json.ad?.adId || $json.index}}__{{$now}}.png
```

---

## 11) Roadmap (Optional)

- **Caption cloning**: Use LLM to convert competitor copy into brand-safe variants; enforce lexicon.  
- **Template masks**: Auto-detect text boxes and rebuild with first-party fonts to reduce artifacting.  
- **Ranking**: Heuristic + LLM ranker to select the top N outputs per ad for testing.  
- **MLOps**: Persist artifacts and review outcomes to fine-tune prompt templates per category.

---

## 12) Appendix

- **Model names**:  
  - Planning: `gemini-2.5-pro`  
  - Generation: `gemini-2.5-image-preview` (informally “Nano Banana”)
- **Parallelization options**:  
  - n8n **Queue Mode** + multiple workers  
  - **Execute Workflow** fan-out per ad (don’t wait)  
  - Rate-limit nodes; chunk `ads[]` into batches (e.g., 10–25 items)

---

### TL;DR Build-Like-This
1) Form gets **Ad Library URL** + **product image**.  
2) **Apify** scrapes creatives.  
3) For each: download ➜ archive ➜ **Gemini 2.5 Pro** makes a tailored prompt ➜ **Gemini 2.5 Image Preview** generates output ➜ safety check ➜ save to **Drive**.  
4) Review, test, iterate.
