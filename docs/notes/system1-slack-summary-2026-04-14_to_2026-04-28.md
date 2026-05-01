# System1 Slack Summary — 2026-04-14 to 2026-04-28

Channel reviewed: `#s1-interlincx`

## What System1 Did

### April 14

- John Rock shared a `warm-up RPC curve` screenshot from a prior call.
- He listed the live topics that informed that curve:
  - Nissan Rogue SUVs
  - Bank Account Bonuses
  - Botox Deals
  - Govt Phone
  - Online Schools with Laptops
  - Liposuction Clinical Trials
  - Dental Implant Trials
  - Senior Apartments
  - Free Phones
  - Medicare Mobility Scooters
  - Gold IRA Kit
  - Neuropathy Trials
  - Medicare Meal Deliveries
- John separately flagged that there was a `data delay`.

### April 17

- Geoffrey Glinn added an `exploratory vertical` tab to the shared Google Sheet.
- He said the sheet included:
  - topics that might show life
  - article URLs
  - suggested keywords

### April 23 to April 24: Simpliworld investigation

- Geoffrey initially looked into a `Simpliworld` RPC drop and said the first read looked possibly `category-related`.
- He noted the top categories had poor RPCs on the prior day but seemed to have bounced back.
- He said they did not believe they had rolled out changes on their end that would explain the shift.
- He later checked broader partner behavior and said `home value` looked weak across partners, then compared that against `senior phones`.
- After Ben pushed on the fact that Simpliworld RPCs were nearly identical across categories, Geoffrey identified a concrete issue:
  - one of their `rev att settings` was not configured properly during the initial `segment` setup
- Geoffrey said they were getting an engineer to fix it `ASAP`.
- On April 24, Geoffrey confirmed it should be fixed on `segments 001 and 002`.

### April 27

- Geoffrey checked back in asking how `Simpliworld` was looking.
- Geoffrey also asked TJ for feedback on exploratory categories such as `Gas ranges` and `Shower Renovation`.
- After TJ said there were no major wins yet but a couple categories looked promising, Geoffrey asked whether they should keep sending more test categories.
- Geoffrey then said he would look at the tool and send `new categories` over in the content sheet.

## What We Learned

### Warm-up behavior is real

- Geoffrey said they typically see lower performance improve over roughly `2-4 weeks` with `consistent traffic`.
- John’s warm-up curve and live-topic list support the idea that site/segment ramp matters materially.

### Dashboard / data timing can create noise

- John explicitly flagged a `data delay` on April 14.
- Scott’s original concern on April 23 was partly about `same-day vs next-day` RPC movement, which means reporting latency or reprocessing can distort first reads.

### The Simpliworld issue was not just category mix

- At first the hypothesis was category-level weakness.
- Ben’s observation was more important:
  - `RPCs were nearly identical across categories`
  - even strong categories were stuck in the same low band
- That pushed the conversation from “maybe this is normal warm-up” to “something in setup may be wrong.”

### A real configuration issue was found

- Geoffrey found a `segment setup / rev att` configuration issue.
- That is the clearest concrete root cause surfaced in the two-week window.
- The conversation implies this issue was suppressing or flattening performance across categories on Simpliworld.

### Post-fix sentiment improved quickly

- By April 27, Scott’s response to Geoffrey was positive and implied the fix had helped.
- Ben’s follow-up joke about pressing the same button on all sites also suggests the team saw the improvement as meaningful, not just noise.

### Exploratory categories are still early

- No major wins yet from the exploratory list.
- `Emergency pest control` and `shower installation` were the two categories TJ called out as having some potential.
- The blocker on those was `CPA`, not total lack of signal.

### The testing cadence should continue

- TJ said to keep sending test categories and that he would work down the list launching them.
- That means the current operating posture is not “pause and wait,” but `continue feeding the funnel`.

## What We Still Need To Figure Out

### 1. Confirm the Simpliworld fix with real post-fix data

- We still need a clean read on whether `segments 001 and 002` actually moved to the expected RPC range after the fix.
- We should compare:
  - pre-fix vs post-fix RPC
  - by segment
  - by category
  - same-day vs finalized next-day values

### 2. Define exactly what the `rev att` issue was

- The thread names the issue but does not document it precisely.
- We should get:
  - what the setting was
  - why it was wrong
  - which segments or sites were exposed
  - how to prevent the same setup error in the future

### 3. Separate warm-up effects from configuration problems

- We now know both are real:
  - warm-up can depress performance for `2-4 weeks`
  - setup mistakes can also flatten performance
- We need a more explicit checklist for how to diagnose one vs the other.

### 4. Check for broader configuration risk on other sites

- If Simpliworld had an initial segment setup issue, we should confirm whether other recently launched sites could have the same problem.

### 5. Set explicit decision thresholds for exploratory categories

- TJ gave directional feedback, but the team still needs tighter criteria for:
  - what counts as “promising”
  - when to keep spending
  - when to kill a test
  - when CPA is close enough to justify more time

### 6. Keep the content sheet flowing, but make the handoff tighter

- Geoffrey said he would keep adding new categories to the sheet.
- We should make sure the sheet consistently includes:
  - category
  - article URL
  - keyword set
  - owner
  - launch status
  - latest RPC / CPA notes

## Tight Readout

- `System1` shared warm-up context, flagged a data-delay issue, and added an exploratory category sheet.
- The biggest substantive action was Geoffrey’s investigation into `Simpliworld`, which led to identifying and fixing a `segment / rev att` setup problem on `segments 001 and 002`.
- The strongest learning is that Simpliworld’s flat cross-category RPC behavior was not just normal warm-up; there was a real configuration issue.
- The current stance is to keep testing additional categories, with `emergency pest control` and `shower installation` looking like the most plausible exploratory candidates so far.
- The main open work is validating the post-fix lift, documenting the exact setup error, and tightening the operating rules for exploratory testing.
