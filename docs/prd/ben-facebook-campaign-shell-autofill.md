# Ben Facebook Campaign Shell Autofill

## Purpose
Define a constrained campaign-shell flow for Ben where Liftoff auto-populates the Strategis shell and as much of the Facebook shell as current data allows, leaving Ben to upload creatives and only answer the few fields that materially vary.

This document is grounded in the live Ben campaign export analyzed on `2026-04-28` from `76` Facebook campaigns in Strategist.

## What Is Stable Enough To Lock

Global defaults:
- `buyer = ben`
- `networkName = facebook`
- `country = US - United States of America`
- `organization = Interlincx`

Global default with override:
- `language = EN - English`
  - Observed on `73 / 76` campaigns
  - `ES - Spanish` appears, so language should be a constrained toggle, not a free-form text field

## What Ben Should Not Be Asked Every Time

Do not ask Ben to manually type:
- buyer
- network
- country
- organization
- free-form naming format

These should come from locked defaults or generated naming templates.

## What Should Be Chosen From Profiles

Ben's campaigns cluster more by `category + site bundle + ad account bundle` than by one universal shell.

Category-scoped profile fields:
- `rsocSite`
- `subdirectory`
- `fbAdAccount`
- `networkAccountId`
- `templateId`
- `redirectDomain`
- `headline`

Examples from the live sample:
- `Dental Implants` primarily uses `health` with `secretprice.com` or `wesoughtit.com`
- `Diabetes` primarily uses `health` with `wesoughtit.com`
- `Nissan Rogue` primarily uses `automotive`
- `High School Diploma` primarily uses `education`
- `Paving` and `Home Repair` primarily use `careers`

Implication:
- Ben should pick a `category shell profile`, not fill in these fields individually.
- A profile can still allow limited overrides, but the default path should be one-click selection.

## What Ben Still Needs To Supply

Strategis-facing content inputs:
- `article`
- `headline`
- `forcekeyA-forcekeyL`

Facebook-facing launch inputs:
- creative assets
- Facebook page
- objective
- budget
- targeting profile

These are the high-variance fields and should remain user-controlled or selected from a small preset list.

## Facebook Data Gap

The current Strategis campaign export is enough to reconstruct most tracking-shell fields, but it does **not** contain the full Facebook creation contract by itself.

Still missing from current Ben export:
- `facebookCampaignName`
- `facebookObjective`
- `facebookPage`
- `dailyBudget`
- `optimizationGoal`
- `billingEvent`
- `bidStrategy`
- `targeting`
- `placementProfile`
- `promotedObject.pixelId`
- `promotedObject.customEventType`

Implication:
- Liftoff can build a strong Strategis shell today.
- Full Facebook shell automation requires:
  - a Facebook settings export path, and
  - a local selector catalog curated from Ben's common setups.

## Facebook Selector Findings

From the live Facebook-side pull analyzed on `2026-04-28`, Ben's setup is much more repetitive than the UI implies.

Locked Facebook defaults:
- `optimization_goal = OFFSITE_CONVERSIONS`
- `billing_event = IMPRESSIONS`
- `promoted_object.custom_event_type = LEAD`

Reusable selector families:
- `adAccountId`
- `pixelId`
- `pageId`
- `age range`
- `geo signature`
- `placement family`
- `advantage audience`
- `bid strategy / bid cap usage`

Important finding:
- the most reusable Facebook launch primitive is an **ad set selector family**, not the campaign row itself
- the selector family is a combination of targeting + promoted object + bidding shape
- this means the Ben setup UI should present a short list of selector presets, not dozens of individual knobs

Generated artifact:
- `/Users/ericroach/code/liftoff/backend/.local/strategis/ben-shell-selector-catalog/ben-live/catalog.json`
- `/Users/ericroach/code/liftoff/backend/.local/strategis/ben-shell-selector-catalog/ben-live/catalog.md`

## Recommended Product Shape

### Step 1: Pick Category Preset
Ben chooses from a constrained preset such as:
- `Diabetes`
- `High School Diploma`
- `Nissan Rogue`
- `Dental Implants`

The preset resolves:
- Strategis shell defaults
- Facebook ad account
- Facebook page id
- pixel id
- a default ad set selector family
- naming family hint

### Step 2: Fill High-Variance Inputs
Ben only enters:
- article
- headline
- forcekeys
- creative upload

### Step 3: Optional Overrides
Allow advanced override for:
- language
- site/profile bundle
- redirect domain
- Facebook page
- ad account
- selector variant
- bid cap / budget

These should be secondary controls, not the default setup path.

## Wizard Contract

The intended launch wizard should operate on this split:

Locked:
- buyer
- network
- country
- organization
- optimization goal
- billing event
- promoted event

Preset-driven:
- site
- subdirectory
- template
- redirect domain
- ad account
- page id
- pixel id
- age band
- geo signature
- placement family
- advantage audience
- bid strategy family

Manual:
- article
- headline
- forcekeys
- creatives
- budget amount

That is the minimum viable shape that actually reduces Ben's cognitive load instead of just hiding the same complexity in a different form.

## Naming Constraint

Ben does not use one perfectly uniform naming convention, but the dominant families are consistent enough to template.

Most common naming families in the live sample:
- `<date>|FB|SBU|BH`
- `<date>|KW|FB|BH`
- `<date>|SBU|FB|BH`
- `<date>|Simp|FB|BH`

Implication:
- The UI should generate names from a small set of allowed naming families.
- Ben should choose a naming family or profile, not type names manually.

## Current Repo Support

Generated shell analysis:
- `/Users/ericroach/code/liftoff/backend/.local/strategis/campaign-shell-profiles/ben-2026-04-25_2026-04-27/report.md`
- `/Users/ericroach/code/liftoff/backend/.local/strategis/campaign-shell-profiles/ben-2026-04-25_2026-04-27/report.json`

Reusable analyzer:
- `/Users/ericroach/code/liftoff/backend/src/lib/campaignShellProfiles.ts`
- `/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/reportCampaignShellProfiles.ts`

Generated Facebook settings analysis:
- `/Users/ericroach/code/liftoff/backend/.local/strategis/facebook-settings-profiles/ben-live/report.md`
- `/Users/ericroach/code/liftoff/backend/.local/strategis/facebook-settings-profiles/ben-live/report.json`

Combined selector catalog:
- `/Users/ericroach/code/liftoff/backend/src/lib/benShellSelectorCatalog.ts`
- `/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/buildBenShellSelectorCatalog.ts`

## Next Build Step

Build a `Ben shell preset wizard` in Liftoff:
- input: live Strategis shell report + live Facebook selector report
- output: preset records keyed by category/setup family
- usage: campaign setup UI presents only approved presets plus a few overrides
- user flow: `choose preset -> enter article/headline/forcekeys -> upload creatives -> launch`

That is the cleanest path to “Ben only uploads creatives” while still letting us keep the setup grounded in his real historical launch patterns.
