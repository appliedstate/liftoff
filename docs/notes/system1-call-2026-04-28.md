# System1 Call Brief — 2026-04-28 at 1:30 PM PT

## Goal

Use the call to convert `System1` from a UI-dependent workflow into a stable backend integration for article generation and downstream launch automation.

Primary focus:
- confirm the production server-to-server contract for `RAMP` content generation

Secondary focus:
- align on how `System1` keyword, slug, and geo intelligence should feed campaign selection and launch workflows

## 30-Second Framing

We already have the core Liftoff workflow taking shape: intent packets, article generation planning, campaign blueprints, and launch orchestration. The main thing we want from `System1` is a stable backend contract so we can integrate directly without browser automation or fragile frontend dependencies.

## What Liftoff Has Already Built

- A direct `System1 RAMP` client in the backend targeting `https://api.system1.com`
- Per-domain API key support and quota checks
- Article submission flow for intent packets
- Polling flow for article completion / terminal status
- Storage-ready metadata for prompt ID, status, publication link, and error state
- System1 data workflows beyond RAMP:
  - SERP copilot over `8M+` embedded rows
  - cluster and opportunity scoring from `System1` exports
  - state / keyword / slug analysis to support launch selection

## Main Talking Points

### 1. We want to integrate backend-to-backend, not through the browser

- We do not want to automate `partner.system1.com`
- We do not want to build against a frontend wrapper if a supported backend exists
- We want the narrowest stable production contract that `System1` is comfortable supporting

### 2. Validate the current RAMP API contract

What we believe today:
- auth is `x-api-key`
- quota is available
- content-generation list is available
- content-generation generate is available
- prompts move through statuses like `requested`, `processing`, `success`, `failed`

What we need confirmed:
- which endpoints are officially supported for partner integrations
- whether the current request and response shapes are stable
- whether prompt IDs are durable and safe to store as external references

### 3. Clarify domain and partner scoping

- Are API keys partner-scoped, domain-scoped, or both?
- Can one partner key operate across multiple approved domains?
- What is the source of truth for domain eligibility?
- Is there an endpoint we should use to fetch allowed domains / site metadata?

### 4. Clarify async execution semantics

- What is the authoritative lifecycle for a generation request?
- Is polling the expected integration pattern, or is there a better status mechanism?
- What is the expected completion SLA?
- What are the terminal failure modes we should distinguish in product logic?

### 5. Clarify success payload and downstream handoff

- What exact payload should we expect when generation succeeds?
- Is `publication_link` the final canonical article URL?
- Do we get `site_id`, article ID, or other durable identifiers back?
- Are there cases where content is generated successfully but not yet publish-ready?

### 6. Confirm product and policy constraints

- `50` content generation requests per day
- `standard article` formats only
- optional title with a `60` character limit
- blocked categories / terms and blocked-title behavior
- failure reasons such as insufficient scraped source coverage

The practical question:
- what constraints are guaranteed by API validation versus only described in partner docs?

## Specific Questions To Ask

1. What is the officially supported server-to-server API for content generation today?
2. Are `/v1/quota`, `/v1/content-generation/list`, and `/v1/content-generation/generate` the right endpoints for production partner use?
3. What request fields are required versus optional, and which fields are likely to change?
4. What is the durable identifier we should store for each request and article?
5. What is the recommended way to check completion status?
6. Can `System1` provide domain metadata or allowed-domain discovery via API?
7. How should we handle quota exhaustion and retries?
8. What are the canonical error codes or failure categories we should map in Liftoff?
9. Is there a documented backend we should prefer over any Strategist / frontend wrapper?
10. If we want to scale volume later, what approval or quota expansion path should we plan for?

## Broader System1 Discussion If Time Allows

- How `System1` wants partners to use keyword / slug / geo performance as launch inputs
- Best way to package `top keywords`, `top states`, and `winning slugs` into campaign decisions
- Whether there is a supported API surface for campaign-pack style retrieval beyond CSV / exports
- How `System1` thinks about tying article generation, RSOC terms, and tracking params together in one launch flow

## Desired Outcome From The Call

Best case:
- `System1` confirms the supported backend contract
- we leave with the correct endpoints, auth model, status model, and success payload
- we know exactly what metadata to persist locally

Acceptable fallback:
- `System1` cannot fully document the contract today, but gives us:
  - the supported integration owner
  - confirmation of which endpoints are safe to use
  - the minimum stable payload and status semantics

## If You Need A Tight Close

The shortest useful close is:

"We already have the Liftoff side mostly wired. The remaining blocker is confidence in the supported System1 backend contract: auth, request shape, status lifecycle, success payload, and domain scoping. If we leave with those five things clear, we can integrate directly and stop depending on UI flows."
