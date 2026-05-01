# Meta Policy Ingestion Plan

## Current State

We do **not** have a complete crawled/indexed Meta policy corpus in the system today.

What exists:

- a rejection corpus with local outcomes
- a rule-based scorer influenced by the corpus
- some official-source citations in docs
- no full official policy snapshot store
- no normalized policy chunk index
- no automated freshness sync

## What “complete” should mean

For this project, a complete Meta policy knowledge base should cover:

1. ad content standards
2. restricted and prohibited categories
3. Special Ad Category rules
4. review and restriction mechanics
5. Page and Business asset governance
6. account restriction / connected asset / evasion behavior
7. destination and deception patterns
8. operational trust rules that affect Pages, ad accounts, businesses, and users

## Why naive crawling is not enough

Meta’s public policy surface is not a clean static-doc site.

Practical issues:

- many help/business URLs redirect to login
- repeated automated access gets temporary blocks
- some key pages are visible in snippets but not fully fetchable
- change logs and help pages are spread across multiple surfaces

So the right ingestion approach is **curated + versioned**, not “spider everything once.”

## Recommended architecture

### Phase A: Canonical Source Registry

Use [meta-policy-source-manifest.json](/Users/ericroach/code/liftoff/docs/analysis/facebook-ad-rejections/meta-policy-source-manifest.json) as the allowlist of official sources.

Each source should track:

- `url`
- `category`
- `priority`
- `public_access`
- `last_verified_at`
- `capture_method`
- `hash`

### Phase B: Snapshot Store

For every source, keep a normalized snapshot:

- raw HTML or captured text if fetchable
- snippet summary if only partially accessible
- manual notes when login-blocked
- capture date
- source hash

Recommended store:

- `data/meta_policy_sources/manifest.json`
- `data/meta_policy_sources/snapshots/<source-id>/<date>.json`

### Phase C: Policy Chunk Index

Split snapshots into atomic chunks such as:

- policy statement
- review/enforcement statement
- Page/account/business statement
- targeting/delivery limitation

Each chunk should contain:

- `source_id`
- `title`
- `url`
- `captured_at`
- `chunk_type`
- `text`
- `official=true`
- `superseded_by`

Then embed for retrieval.

### Phase D: Retrieval Before Scoring

At review time:

1. retrieve the most relevant official policy chunks
2. retrieve the most similar historical rejects
3. keep those distinct in the response

The response should clearly separate:

- `official_policy_support`
- `historical_reject_support`
- `model_inference`

### Phase E: Feedback Loop

Use post-launch and post-review data to train:

- threshold calibration
- false-positive reduction
- rewrite ranking

Not raw policy interpretation alone.

## Fine-tuning recommendation

Do **not** fine-tune first on raw policy text.

Better order:

1. build canonical source registry
2. build snapshot/chunk retrieval
3. label outcomes with:
   - approved
   - rejected
   - escalated / restriction-adjacent
   - performed well / poorly
4. then fine-tune on **structured policy-review examples**, not just policy documents

Why:

- raw policy text is better handled by retrieval
- fine-tuning is better for judgment style, explanation format, and rewrite behavior
- retrieval keeps you current when Meta changes docs

## Immediate next implementation steps

1. promote the source manifest into runtime data
2. add a `source_type` field to every finding in the API response
3. add `source_urls[]` for official findings
4. add a small ingestion script that snapshots the allowlisted public pages
5. add a policy-retrieval block to `/api/meta-policy/run`
6. add manual capture workflow for login-blocked but critical pages

## Standard for user-facing claims

The system should never say `Meta policy forbids this` unless:

- the support is official
- the supporting source URL is attached
- the policy statement is still current

Otherwise use:

- `historically high reject risk`
- `inferred combo risk`
- `review-sensitive pattern`
