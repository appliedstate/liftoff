# Media Buying Follow-Through Audit — 2026-04-29

## Scope

This audit cross-checks the `2026-04-22` media buying meeting transcript against what I could verify from:

- the full Google Doc export of the `2026-04-22` meeting notes + transcript
- `#arbv2-hq` from `2026-04-23` through `2026-04-29`
- `#strategis-tech` from the same period
- prior synthesized notes already in the repo

Status labels used below:

- `Executed`: clear evidence the action happened
- `Partial`: movement happened, but not enough to call it closed
- `No evidence found`: I did not find confirming follow-through in the sources reviewed
- `Still open`: the underlying problem remains active even if some work happened

## Executive Read

The strongest confirmed follow-through since the April 22 meeting was:

- the team clearly moved into an interim `shell + clone` operating pattern while trying to reduce Facebook risk
- engineering pushed the conversation forward on `create-from-scratch`, proxy constraints, and auth/token handling
- Anastasia's restriction status was effectively confirmed as not time-bound

The biggest gaps are:

- no clear evidence that the `fresh URLs` action was broadly executed
- no clear evidence that the `knowledge warehouse AU` appeal happened
- no clear evidence that the requested Slack checklist / screenshot / consultant follow-up were completed
- the root Facebook-risk problem is not closed; it has mostly shifted from diagnosis into containment and tooling work

## Action Item Audit

### 1. Share mined findings on rejection patterns

- Owner from transcript: `Eric`
- Transcript ask: circle back after the meeting with findings from mined data / API review
- Evidence found:
  - On `2026-04-22`, Eric described active pattern-mining work during the meeting itself.
  - I did not find a distinct documented follow-up post with that analysis in the reviewed Slack window.
- Status: `Partial`
- Read: analysis work clearly existed, but I did not find a clean posted readout to the team.

### 2. Ask the consultant how Facebook interprets clinical-trial ads as jobs

- Owner from transcript: `Eric`
- Evidence found:
  - In the transcript, Eric said he wanted to reach out to the consultant.
  - I did not find a later consultant answer in the reviewed sources.
- Status: `No evidence found`
- Read: still appears open.

### 3. Verify whether Anastasia's restriction had an end date

- Owner from transcript: `Anastasia`
- Evidence found:
  - In the transcript itself, Anastasia later confirmed she had `no time restrictions`, which implies a harder / effectively permanent restriction state.
- Status: `Executed`
- Read: this question was resolved during the same meeting, even though it was initially listed as a next step.

### 4. Track down the video transcript and check for phrases like `get paid` or `make money`

- Owner from transcript: `Andrew Cook`
- Evidence found:
  - The meeting clearly identified this as a hypothesis.
  - I did not find a later Slack confirmation that Cook posted the transcript findings.
- Status: `No evidence found`
- Read: the risk theme persisted, but I did not find proof this specific task was completed.

### 5. Obtain fresh URLs for campaign use

- Owner from transcript: `Group`
- Evidence found:
  - `Fresh URLs` was called out multiple times in the meeting as an immediate action item.
  - I did not find clear confirmation in the reviewed Slack sources that the fresh-URL rollout actually happened.
- Status: `No evidence found`
- Read: this remains one of the clearest missing execution items.

### 6. Review expiring ad accounts and salvage options

- Owner from transcript: `Group`
- Evidence found:
  - This was called out as an immediate action item in the meeting.
  - I did not find a documented salvage review in the reviewed sources.
- Status: `No evidence found`
- Read: likely still open unless it happened off-channel.

### 7. Confirm whether Anastasia's restriction was permanent

- Owner from transcript: `Anastasia`
- Evidence found:
  - Same as item 3: later in the transcript she confirmed no time restrictions.
- Status: `Executed`
- Read: resolved in-meeting.

### 8. Post a Slack screenshot showing the `Money Matters` page risk status

- Owner from transcript: `Andrew Cook`
- Evidence found:
  - The page-risk issue is discussed in the transcript.
  - I did not find the requested screenshot in the reviewed follow-up materials.
- Status: `No evidence found`
- Read: no visible closeout on this ask.

### 9. Appeal the `knowledge warehouse AU` ad account restriction

- Owner from transcript: `Group`
- Evidence found:
  - The meeting discussed this as the safest appeal candidate.
  - I did not find confirmation that the appeal was filed or resolved.
- Status: `No evidence found`
- Read: still appears open and important.

### 10. Review whether the tool's upload-identification / email field changed

- Owner from transcript: `Andrew Cook`
- Evidence found:
  - The concern was that upload attribution may have shifted from a developer email to a generic `.app` identity.
  - I did not find a later documented answer on that exact point.
- Status: `No evidence found`
- Read: no verified closeout.

### 11. Talk with Liam about whether tool changes may have flagged unusual activity

- Owner from transcript: `Andrew Cook`
- Evidence found:
  - I did not find a documented follow-up with Liam in the reviewed sources.
- Status: `No evidence found`
- Read: still open from the evidence available.

### 12. Share the Facebook policy / enforcement article

- Owner from transcript: `Eric`
- Evidence found:
  - The article was discussed in the meeting.
  - I did not find a clearly attributable shared article follow-up in the reviewed sources.
- Status: `Partial`
- Read: the article influenced the meeting, but I could not verify a separate follow-through share.

### 13. Research correlation between job classifications and payment-focused messaging

- Owner from transcript: `Eric`
- Evidence found:
  - The transcript repeatedly returns to the `compensation for health or jobs` theme.
  - I did not find a later written conclusion that closes this question.
- Status: `Partial`
- Read: the hypothesis became the team's main working theory, but not a completed research output.

### 14. Create a checklist of remaining questions / next steps in Slack

- Owner from transcript: `Anastasia + Ben`
- Evidence found:
  - Eric explicitly asked for a checklist in-channel before the meeting ended.
  - I did not find a clean checklist artifact in the reviewed sources.
- Status: `No evidence found`
- Read: this is another clear execution miss unless it happened elsewhere.

## Broader Problem Audit

### 1. Facebook enforcement and buyer/account restrictions

- Problem from transcript:
  - Cook and Anastasia were restricted.
  - multiple ad accounts went down.
  - the team believed enforcement thresholds had tightened materially.
- What happened after:
  - The problem remained active in follow-up discussion.
  - Later discussion shifted from pure diagnosis into risk-containment and safer launch patterns.
- Status: `Still open`
- Read: this was not solved; the team moved into mitigation mode.

### 2. `Circumvention` risk tied to shared pages and clone behavior

- Problem from transcript:
  - The strongest stated penalty reason was `circumvention`.
  - The team suspected shared pages and clone-like reuse across accounts / BMs could be part of the fingerprint.
- Evidence of follow-through:
  - In `#arbv2-hq` on `2026-04-27`, Andrew raised concern that a clone-only launch pattern may be too obvious to Facebook.
  - Lian's workaround was to create `shell` campaigns that can be cloned because `CREATE` is harder than `COPY`.
  - Andrew planned to test campaigns in `new ad accounts` around `2026-04-29` / `2026-04-30`.
- Status: `Partial`
- Read: the team clearly acted on the risk by shifting tactics, but the underlying vulnerability remains open.

### 3. Pause the `Nautilus` business manager and move activity to a safer setup

- Problem / decision from transcript:
  - Ben said he wanted to pump the brakes on using `Nautilus` and move focus to a new business-manager setup.
- Evidence of follow-through:
  - Later discussion about `new ad accounts` and `shell campaigns` is directionally consistent with that decision.
  - I did not find a clean, explicit note saying the migration was fully completed.
- Status: `Partial`
- Read: likely in progress, not closed.

### 4. Replace clone-only operations with safer launch tooling

- Problem from transcript:
  - Tool limitations were forcing shell / clone patterns.
  - That pattern itself may be part of the account-risk surface.
- Evidence of follow-through:
  - In `#strategis-tech` on `2026-04-29`, Tahmid said Strategis can create and launch a Facebook campaign from scratch for a buyer.
  - Devin's technical readout said the missing piece is mainly orchestration, not core feasibility.
  - Devin also noted Tahmid's branch appears to cover much of that orchestration but is behind `master` and not yet merged.
- Status: `Partial`
- Read: this is the clearest real progress since the meeting, but it is not yet operationally done.

### 5. Reduce risk from API / tool-driven unusual activity

- Problem from transcript:
  - The team worried that API launches, rate limits, or unusual tool signatures might have amplified Facebook scrutiny.
- Evidence of follow-through:
  - Engineering later focused on `FB API v25`, auth stability, and proxy/orchestration rules.
  - Henok proposed a central token controller.
  - I did not find proof that the original account-safety concern was definitively resolved.
- Status: `Partial`
- Read: the engineering response is real, but the safety hypothesis is still unresolved.

### 6. Decide what to do about `compensation-for-health` and `get paid` messaging

- Problem from transcript:
  - The strongest thematic risk identified was compensation-oriented health messaging being interpreted as jobs, scams, or both.
- Evidence of follow-through:
  - The hypothesis stayed central to the discussion.
  - I did not find a documented copy-policy change, approved messaging framework, or clear do/don't list in the reviewed sources.
- Status: `Still open`
- Read: this is still one of the highest-value unresolved operating questions.

### 7. Clean up page / account hygiene with new URLs, safer pages, and safer account/page combinations

- Problem from transcript:
  - The meeting repeatedly returned to `new URL + new page + new ad account` as a safety concept.
- Evidence of follow-through:
  - I found discussion about `new ad accounts`.
  - I did not find verified execution on the `fresh URL` portion.
- Status: `Partial`
- Read: the concept moved forward, but the most concrete hygiene step, fresh URLs, is not clearly confirmed.

### 8. Build a tighter execution process instead of ad hoc follow-up

- Problem from transcript:
  - The call ended with an explicit request for a shared checklist because too many loose ends were floating around.
- Evidence of follow-through:
  - I did not find a clear checklist artifact in the reviewed materials.
- Status: `No evidence found`
- Read: the coordination problem itself appears unresolved.

## Highest-Signal Readout For Today's Call

If you want the shortest honest summary for the meeting:

- The April 22 meeting correctly identified the main risk cluster: `circumvention`, shared-page / clone behavior, and `get paid` health messaging.
- The team did make some real moves after that meeting:
  - shifted toward `shell + clone` as an interim path
  - started testing / planning `new ad account` paths
  - pushed engineering harder on `create-from-scratch`, orchestration, and auth
- But many of the concrete execution items from the meeting do not show confirmed follow-through in the reviewed sources:
  - `fresh URLs`
  - `knowledge warehouse AU` appeal
  - `Money Matters` risk screenshot
  - consultant answer
  - shared checklist

## Suggested Talking Points

1. Which of the April 22 action items were actually completed but just not documented in Slack?
2. Did we ever execute the `fresh URLs` step, or did that stall?
3. Was the `knowledge warehouse AU` appeal filed, and what happened?
4. Are we explicitly standardizing on `shell + clone` as the interim operating mode?
5. What is the owner / ETA for making `create-from-scratch` operational enough to reduce clone-pattern risk?
6. Do we have any actual approved messaging framework yet for clinical-trial / compensation language, or are we still operating off theory?
