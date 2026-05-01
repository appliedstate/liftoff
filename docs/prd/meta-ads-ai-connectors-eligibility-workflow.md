---
date: 2026-04-30
status: Draft
owner: Eric Roach
product: Meta Ads AI Connectors
related:
  - /Users/ericroach/code/liftoff/docs/prd/facebook-copilot.md
  - /Users/ericroach/code/liftoff/docs/prd/prime-directive-workboard.md
  - /Users/ericroach/code/liftoff/backend/src/lib/platformCapacityRegistry.ts
---

# Meta Ads AI Connectors — Eligibility, Account Checks, and Resume Workflow

## Purpose

Capture what is currently known about Meta Ads AI Connectors, what has been checked live, what remains unresolved for `Nautilus Business Manager` and `Adnet Business Manager`, and the exact workflow to resume this investigation without losing context.

---

## Executive Read

As of `2026-04-30`, Meta has publicly confirmed that `Meta ads AI connectors` are in `open beta`, but Meta has **not** published a clear public eligibility matrix that tells an advertiser exactly why they are or are not eligible.

That means there are currently two separate questions:

1. `Public-policy question`
   - What does Meta say the requirements are?
2. `Live-account question`
   - Does a specific business manager or ad account actually expose the connector workflow in-product?

Right now the public answer is incomplete, and the live UI answer is only partially observable.

---

## What Meta Has Publicly Confirmed

- Meta says advertisers can connect a `Meta ad account` directly to an AI agent through `Meta ads AI connectors`.
- Meta describes the rollout as `open beta` to `eligible advertisers`.
- Public reporting says launch support includes `MCP-compatible` tools such as `ChatGPT` and `Claude`.
- Public reporting also says the advertiser’s plan inside the AI tool may matter.

### Sources

- [Meta Q1 2026 earnings call transcript](https://s21.q4cdn.com/399680738/files/doc_financials/2026/q1/META-Q1-2026-Earnings-Call-Transcript.pdf)
- [Meta Q1 2026 investor event page](https://investor.atmeta.com/investor-events/event-details/2026/Q1-2026-Earnings-Call/default.aspx)
- [Digiday — Meta opens its ad ecosystem to third-party AI tools](https://digiday.com/marketing/meta-opens-its-ad-ecosystem-to-third-party-ai-tools/)

---

## What Meta Has **Not** Publicly Confirmed

Meta has not publicly published a connector-specific gating matrix for:

- country / market eligibility
- spend thresholds
- business verification thresholds
- account age thresholds
- policy history thresholds
- whether restricted or high-risk advertisers are excluded
- whether specific ad categories are excluded
- whether there is a dedicated in-product `eligible / not eligible` status page
- exact write scopes per role or per AI tool

This is the main reason the investigation cannot end with public docs alone.

---

## Best Current Eligibility Checklist

These are the strongest currently-supported criteria, mixing public Meta statements and reasonable operational inference:

### Likely required

- A live `Meta ad account`
- Inclusion in Meta’s pool of `eligible advertisers`
- A `supported AI tool / AI agent`
- Valid Meta business integration authorization
- A user with adequate ad-account permissions
- Continued compliance with Meta commercial terms and ad policies

### Role-based inference

Based on Meta ad-account roles:

- `Ad account admin` or `advertiser` likely needed for write actions
- `Ad account analyst` likely only sufficient for read/reporting actions

### Sources

- [Why business integrations request access](https://www.facebook.com/help/615546898822465/)
- [Manage business integrations](https://www.facebook.com/help/405094243235242/)
- [Meta ad account role help](https://www.facebook.com/help/messenger-app/195296697183682/)
- [Meta Business Tools Terms](https://www.facebook.com/legal/terms/businesstools/preview)
- [Meta Commercial Terms](https://www.facebook.com/legal/commercial_terms)

---

## Can We Bring Our Own MCP / AI Tool?

### Best current answer

`Not safely assume yes.`

The current evidence supports:

- Meta is supporting `specific external AI tools / agents`
- public reporting points to `MCP-compatible` tools like `ChatGPT` and `Claude`
- Meta is **not** publicly saying that any arbitrary custom MCP server or homegrown agent can directly authenticate as a first-class connector

### Working interpretation

There are three different things that should not be confused:

1. `Official Meta connector path`
   - likely supported AI tools only
2. `Official Meta tooling path`
   - e.g. Meta Ads CLI or official APIs
3. `Bring-your-own orchestration`
   - our own agent can still sit on top of an official connector or official Meta tooling

So the practical answer is:

- We can likely bring our **own orchestration layer**
- We should **not** assume we can bring our own arbitrary connector identity into Meta unless Meta explicitly supports it

### Strategic implication

The correct architecture is probably:

- sanctioned Meta connector or official Meta tooling at the bottom
- our own operator logic, prompt packs, review gates, and scorecards on top

---

## What Was Checked Live On 2026-04-30

### Current live Meta Business Suite surface

The live session was inside:

- `business_id=527620768219507`
- page surface: `Knowledge Warehouse: Tech Advance Daily`

Observed:

- Searching Business Suite for `AI connectors` surfaced generic help/integration entries such as:
  - `Add Connector`
  - `Choose Integration`
  - `About Manus Connectors`
  - `Business AI` help items
- Searching for `ChatGPT` did **not** surface a dedicated Meta Ads AI Connector entry
- No visible `eligible` badge or dedicated connector eligibility panel was found

### Facebook permissions/settings layer

Checked:

- Facebook settings at `facebook.com/settings?tab=business_tools`
- permission/integration-oriented surfaces
- search for `business integrations`
- search for `apps and websites`

Observed:

- No obvious installed `ChatGPT`, `Claude`, or `Meta ads AI connectors` integration was surfaced
- No clear `eligible / not eligible` determination was visible

### Conclusion from live check

For the currently checked business/page surface:

- there is **some connector/help plumbing visible**
- there is **not enough UI evidence to declare the account eligible**
- there is also **not enough UI evidence to declare it ineligible**

So the current live result is:

`status = not-yet-proven`

---

## Business Managers In Scope

Canonical account labels from the system registry:

- `Nautilus Business Manager`
  - `accountKey`: `meta_bm_nautilus`
  - current state in registry: `restricted`
- `Adnet Business Manager`
  - `accountKey`: `meta_bm_adnet`
  - current state in registry: `expanding`

Source:

- [platformCapacityRegistry.ts](/Users/ericroach/code/liftoff/backend/src/lib/platformCapacityRegistry.ts)

---

## What Is Resolved vs Unresolved

### Resolved

- Meta has publicly launched the connector concept
- Meta has not publicly published a full eligibility matrix
- There is no evidence yet that arbitrary BYO MCP connectors are directly supported
- The currently checked Business Suite surface does not show a clear connector eligibility signal

### Unresolved

- Whether `Nautilus Business Manager` is eligible
- Whether `Adnet Business Manager` is eligible
- Whether eligibility appears at:
  - business-manager level
  - ad-account level
  - user/role level
  - AI-tool-plan level
- Whether the external AI-tool auth flow is required before Meta reveals anything more specific

---

## AdNet-Specific Gap

We still need to explicitly check `Adnet Business Manager`.

That was **not conclusively completed** in the live session captured here because:

- the visible active Business Suite context was the `Knowledge Warehouse` surface
- no confirmed `Adnet Business Manager` selector state was captured during this pass

So the AdNet question remains:

`unknown_pending_live_check`

---

## Resume Workflow

When this is picked back up, do **not** restart from scratch. Follow this sequence:

### Step 1 — Reconfirm public state

- Reopen this note
- Recheck whether Meta has published:
  - a connector help page
  - an eligibility article
  - a supported tools list
  - a permission scope page

Stop if Meta has finally published an explicit eligibility matrix, because that changes the workflow.

### Step 2 — Check Nautilus live

- Open Business Suite / Ads Manager for `Nautilus Business Manager`
- Search for:
  - `AI connectors`
  - `ChatGPT`
  - `Claude`
  - `business integrations`
  - `apps and websites`
- Look for:
  - connector-specific setup UI
  - support/help entries tied to ads AI connectors
  - any banner, prompt, or auth flow
  - connected-app entries after external tool auth

Record outcome as one of:

- `eligible_evidence_found`
- `not_visible`
- `blocked_by_permissions`
- `unclear`

### Step 3 — Check AdNet live

Repeat the exact same process for `Adnet Business Manager`.

This matters because AdNet is the cleaner Meta surface and may be a better candidate for any sanctioned connector pilot.

### Step 4 — Check external AI tool auth flow

Use a supported AI tool account and test whether the tool offers:

- a Meta / Facebook Ads connection path
- account selection after auth
- a clear permission scope screen
- any rejection message that indicates ineligibility

This may be the only place Meta exposes real eligibility state today.

### Step 5 — Record result in system language

For each surface, record:

- `business_manager`
- `ad_account`
- `tool`
- `user_role`
- `visibility_status`
- `auth_result`
- `write_capability`
- `notes`

### Step 6 — Decide pilot posture

If access is found:

- start with `read-only or analytics-first`
- do not begin with live campaign mutation
- keep a human approval gate on:
  - launch
  - budget changes
  - creative changes
  - anything in sensitive health / compensation-led categories

---

## Recommended Pilot Posture If Access Appears

Start here first:

1. account diagnostics
2. scorecard review
3. reporting / anomaly explanation
4. campaign inventory / cleanup support

Do **not** start here:

1. autonomous launches
2. autonomous budget edits
3. high-risk policy-adjacent creative generation
4. account-structure changes without explicit operator review

---

## Current Answer To Operator Questions

### Are there specific instructions on how to determine eligibility?

No public Meta instruction set was found that explicitly explains how to determine eligibility for Meta Ads AI Connectors.

### Is `Adnet Business Manager` confirmed eligible?

No. That remains unresolved and still requires a dedicated live check.

### Can we bring our own MCP / AI tool?

Not enough evidence to assume that arbitrary custom MCP connectors are supported directly by Meta. The safest current assumption is:

- use a supported AI tool or official Meta tooling path
- bring our own orchestration layer on top of that

---

## Next Best Action

The next most useful move is:

`run a live Adnet Business Manager check plus a supported AI-tool auth attempt and record the result in this note`

