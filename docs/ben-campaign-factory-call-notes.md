# Ben Call Notes - Campaign Factory

## Key Context
- Current spend is around **$4K/day**; goal is getting Facebook to **$5K/day**, but that is the hardest part right now.
- There are a very large number of campaigns running (example: **61 diabetes campaigns**), making performance hard to understand.
- Current workflow is too fragmented; team needs a **central hub/dashboard** to track what is working vs. not working.

## Main Problems Identified
- Too many campaigns and too much noise to diagnose quickly.
- Naming conventions are inconsistent (especially Phil's), making data hard to interpret in Strateg.is.
- Facebook-day level reporting is not always easy to pull.
- Unclear whether underperformance is mainly:
  - **Category issue**
  - **Ad/creative issue**
  - **Keyword (KW) issue**
  - **Targeting/language issue** (for example, Spanish traffic behavior)

## Performance Snapshot / Concerns
- In the last ~7 days, around 25 campaigns launched/live:
  - Only a small number profitable (about 3)
  - Several green, but many red
- Overall sentiment: hard to make a case the current approach is working at scale.
- Example concern: RPC on one campaign is low (**~$1.30 vs expected ~$2.00**):
  - `si161mg06wp_0121_DiabetesTrials_US_WeSoughtIt`

## Creative Strategy Notes
- "Low-hanging fruit" is limited right now; most gains will come from consistent execution.
- Creative tool economics discussed: low-cost video generation, but only about 1 in 10 videos are strong.
- Fastest path to winning creatives:
  - Recreate/adapt already proven videos (ours or competitors')
  - Reverse-engineer winning videos into prompts
  - Reuse reference characters/styles where possible
  - Analyze YouTube videos for repurposable angles

## Operational / Setup Notes
- Run on both sites when relevant.
- Duplicate campaign, swap URL, and set up in Strateg.is consistently.
- Do more 1:1 tactical setup support (down to dropdown-level settings).
- For diagnostics, run controlled duplicates:
  - Same targeting + same KWs
  - Different ads only
  - Compare outcomes to isolate ad quality impact

## Forcekey Geo Placeholder Convention
- As of `2026-04-28`, Ben sometimes uses `{region}` in forcekeys and treats it as interchangeable with `{state}`.
- For Liftoff analysis and rollups, Ben's `{region}` usage should be interpreted as a `state-level geo placeholder`, not as a separate geo concept.
- Preserve the literal configured token in campaign settings and exports, but normalize `{region}` alongside `{state}` when counting geo-param campaigns, aggregating forcekey performance, or generating geo-tier recommendations.

## Hypotheses to Validate
- Known good categories (for example, diabetes and clinical trials) may be underperforming due to execution mismatch, not category ceiling.
- Some campaigns may have too few KWs (for example, only 4), allowing weaker traffic mix to dominate.
- Language/demo mix (for example, Spanish, younger demo) may be affecting click quality and value.

## Recommended Immediate Plan
1. Build a **central reporting view** (single source of truth) for campaign health.
2. Standardize campaign naming (Strateg.is and Facebook naming alignment).
3. Set RPC guardrails by category and automate alerts/reporting for outliers.
4. Triage campaigns:
   - Pause/cut obvious losers
   - Identify campaigns near target economics (for example, can reach ~$200 budget at 30% margin)
5. Run **5 controlled duplicate tests** to isolate ad vs. KW vs. targeting issues.
6. For each campaign older than 7 days, review day-over-day trend and decide: scale, fix, or kill.

## Open Questions from Call
- What is the path forward if we pause campaign X first?
- Which categories are truly worth continuing vs. cutting now?
- What exact RPC thresholds should trigger:
  - KW changes
  - Ad refresh
  - Pause decision

## Optional Next Step
- Convert this into a one-page operating doc with:
  - Weekly review template
  - Exact pause/scale thresholds
  - Campaign Factory setup checklist for Phil/Ben
