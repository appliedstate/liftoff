# Media Buying Call Notes — 2026-04-29

## Sources Synthesized

- Last meeting brief:
  - `docs/notes/system1-call-2026-04-28.md`
- Team Slack channel from the URL provided:
  - `#arbv2-hq` (`C03SCRX2350`)
- Engineering Slack channel:
  - `#strategis-tech` (`C01361VE6E6`)
- Prior two-week System1 Slack summary already in repo:
  - `docs/notes/system1-slack-summary-2026-04-14_to_2026-04-28.md`

Note:
- The first Slack URL maps to `#arbv2-hq`, not `#s1-interlincx`.
- Coverage is weighted toward the week of `2026-04-23` through `2026-04-29`, with older items only included where they change the current discussion.

## Update

### 1. Buying / performance update

- The biggest operating issue surfaced over the last week was `Simpliworld`.
- Ben flagged on `2026-04-23` that RPCs were flattening across categories in the low `.70s`, including categories that should have been materially stronger.
- That matched the broader concern from the System1-side thread that this did not look like normal category variance alone.
- System1 later identified a concrete `segment / rev att` setup issue and said it was fixed on `segments 001 and 002` on `2026-04-24`.
- By `2026-04-27`, sentiment had improved and the conversation implied the fix helped.

- The exploratory-category motion is still active rather than paused.
- System1 added an exploratory vertical sheet earlier in the window and the stance from both sides remained: keep feeding tests rather than waiting for perfect certainty.
- The two exploratory areas called out with at least some signal were `emergency pest control` and `shower installation`, though the remaining issue was still `CPA`, not total lack of signal.

- On `2026-04-27`, Scott also called out a positive trend signal for `home price calculator` / `sell my house`, which looks worth keeping on the active watch list.

### 2. Team / workflow update from `#arbv2-hq`

- The team is actively thinking about how to avoid looking overly dependent on clone-based Facebook launch behavior.
- Andrew raised the concern on `2026-04-27` that if the only operating pattern is cloning existing structures, Facebook can likely infer that pattern.
- Lian’s near-term answer was a workaround: create `shell` campaigns that can act as templates for cloning, because `CREATE` is harder than `COPY`.
- Andrew’s immediate plan was to wait until `2026-04-29` / `2026-04-30` to test putting campaigns into new ad accounts and cloning from there.

- There was also a practical ad-review / redirect concern on `2026-04-23`, where Anastasia asked whether the `Yahoo` redirect should be removed temporarily during human review.
- That did not appear resolved in-channel, so it is still more of an open operational question than a closed decision.

### 3. Engineering / tech update from `#strategis-tech`

- The clearest engineering theme over the last two weeks was Facebook launch tooling moving from a clone-heavy workaround toward a more explicit create / orchestration path.

- On `2026-04-15` to `2026-04-16`, the team dealt with Facebook Marketing API versioning:
  - the team confirmed they were on `v23`
  - an upgrade task to `v25.0` was opened
  - Henok requested a sample campaign / ad to test field-update issues
  - Scott later confirmed the UI was updated to `v25`

- On `2026-04-29`, engineering discussion got much more concrete:
  - Tahmid said there is a guard on endpoints reachable through `/api/lincx-proxy`
  - he also said the current auth setup should allow read / write access to the `Adnet BM`
  - he said he already has the `Strategis` side working for creating and launching a Facebook campaign from scratch for a specific buyer and can write up a plan to hand to Codex

- In parallel, Henok proposed a `central token controller` approach so the app can authenticate to Strategis directly instead of relying on manually copied browser tokens:
  - store Strategis credentials in the app
  - fetch a token from the login endpoint
  - cache it
  - refresh automatically before expiry

- Devin’s deeper analysis is the most important technical readout from this week:
  - there are two proxy surfaces with different rules
  - `lincx-proxy` already allows enough for some write operations like creative upload and copies
  - it does **not** currently whitelist creating brand-new campaigns / adsets / ads through the proxy
  - there is already a direct Facebook service layer on master for some writes
  - the missing piece is mainly the orchestration layer
  - Tahmid’s `4180-staging-add-ad-tool-ads-endpoint` branch appears to be that orchestration layer, but it is behind master and not yet merged
  - the minimum viable path is likely: rebase / merge that branch, then add retry, validation, idempotency, and rollback protections

### 4. System1 backend integration update from the last meeting

- From the `2026-04-28` call brief, Liftoff’s side is mostly built.
- The main blocker is no longer basic implementation effort; it is confidence in the supported `System1` backend contract.
- The open contract questions are still:
  - auth model
  - request / response shape
  - async status lifecycle
  - success payload and durable identifiers
  - domain / partner scoping

## What We Still Need To Accomplish

### 1. Confirm the Simpliworld fix with real post-fix data

- We still need a clean read on whether the `rev att` / segment fix actually restored expected performance.
- The right comparison is:
  - pre-fix vs post-fix
  - by segment
  - by category
  - same-day vs finalized next-day values

### 2. Turn exploratory category testing into a decision process

- We have directional signal, but not a crisp operating rule yet.
- We still need explicit thresholds for:
  - when a test is promising enough to keep funding
  - when CPA is close enough to keep learning
  - when to kill a category
  - which category list gets priority this week

### 3. Decide the near-term Facebook launch path

- The practical short-term question is whether the team is comfortable using `shell campaigns + clone` as the interim workflow while deeper create tooling is finalized.
- If not, we need a stronger timeline and owner for create-from-scratch support.

### 4. Close the engineering gap between “possible” and “operational”

- The current engineering conversation suggests the path exists, but it is not yet hardened enough to rely on broadly.
- The specific work still appears to be:
  - merge / rebase the orchestration branch
  - add retries
  - add validation / read-back checks
  - add idempotency
  - prevent partial / orphaned object creation

### 5. Finalize the Strategis auth approach

- If the team wants backend-driven automation, the token path needs to be stable and non-manual.
- The proposed central token controller is the most concrete answer so far, but it still needs owner / approval / implementation timing.

### 6. Get explicit System1 integration answers

- We should leave the call with a direct answer on the supported backend path, not just a general sense that it should work.
- The narrowest version of that is still:
  - supported endpoints
  - official auth pattern
  - status lifecycle
  - success payload
  - domain scoping

## Suggested Topics / Questions For Today

1. Did the `Simpliworld` fix fully resolve the flat-RPC issue, and what does post-fix data show by segment?
2. Which exploratory categories do we want to actively keep funding this week, and what are the kill / keep thresholds?
3. For Facebook launch operations, are we accepting `shell + clone` as the interim workflow, or do we need a stricter push for create-from-scratch support now?
4. What is the real owner and ETA for:
   - the orchestration branch
   - the token controller
   - broader launch automation hardening
5. What exact System1 backend contract can we rely on in production today?

## Tight Talk Track

- Performance-wise, the main issue from the last week was `Simpliworld`, and there is now a real explanation plus a claimed fix; the next step is validating lift with hard data.
- On the buying side, exploratory testing is still active, with `home price calculator` and a few exploratory categories looking worth continued attention.
- On the engineering side, the major shift is that the conversation is no longer “can we do this at all?” but “which launch path do we standardize on, and what has to be hardened before it is operational?”
- The two biggest open execution gaps are:
  - stable Facebook launch automation beyond clone-only patterns
  - confirmed System1 backend contract details
