# Media Buying — 2025-11-12

## Attendees
- Eric Roach
- Narbeh Ghazalian
- Phillip Bennett
- Scott Anderson
- Dan McDonough
- Andrew Cook
- Ben Holley
- Anastasia Uldanova
- Maryna (maryna@adnet.com)

## Objectives
- Align on response to Facebook page suspensions and mitigate revenue impact
- Define near-term ad/text policy safeguards to reduce risk of automated flags
- Review performance and scaling constraints on Taboola and Media Go
- Clarify System One data status and next actions

## KPI Snapshot
- Not discussed numerically. Revenue impact acknowledged due to two highest-spending FB pages being suspended; expectation of quick recovery once ads are migrated to additional pages.

## Highlights & Insights
- Facebook suspended two high-spend pages: “Hidden Bonus” and “Knowledge Warehouse.”
  - Presumed triggers: dollar amounts and phrases like “get paid,” potentially tripping automated “employment fraud/scam” classifiers.
  - Recommendation: remove all dollar amounts and “paid” from ad text and headlines; not required for performance.
  - Historically, most prior rejections were miscategorization rather than content.
- Appeals strategy:
  - Do not appeal (per guidance relayed from “Kev”) to avoid drawing attention; risk of broader scrutiny.
  - Owner-view shows suspension; diagnostics/account center didn’t surface a clear appeal path.
- Page strategy:
  - Run many small pages concurrently (≥12) instead of letting a single page get large.
  - Acknowledge operational overhead in creating/linking new pages; consider simplifying the process.
- Redirect risk and mitigations:
  - Consider a safe, general “sinkhole page” as redirect target (vs. homepage) to lower risk.
  - No circumvention warnings observed; competitors often cloak, but team prefers safer redirect posture.
- System One data:
  - Received lead-gen data instead of “arb” dataset; larger, correct batch expected later this week.
- Other channels:
  - Taboola: experimenting with bidding; mixed results (e.g., Medicare/dental), scaling limited by volatile RPC (e.g., >$1 to $0.65).
  - Media Go: still not the healthiest publishers, but budget distribution improved; engineering working on automated publisher blocking.

## Decisions
- Do not appeal FB page suspensions at this time.
- Delete the two suspended pages and associated ads; relaunch on new/additional pages.
- Strip dollar amounts and the word “paid” from ad text/headlines going forward.
- Operate with ≥12 active pages to distribute risk and limit per-page scale.
- Schedule discussion with Facebook marketing pro to gather account-level guidance.
- Continue Taboola bidding experiments; proceed with Media Go publisher blocking work.

## Action Items
- [Dan McDonough] Set up call with Facebook marketing pro. (ASAP)
- [Dan McDonough] Delete suspended pages and any ads suspected as culprits. (ASAP)
- [Dan McDonough] Set up new redirects and create additional FB pages to distribute spend. (ASAP)
- [Dan McDonough] Research suspension/appeal policies and confirm best-practice stance after the FB call. (This week)
- [Dan McDonough] Review what top buyers include on pages; decide on disclosure requirements. (This week)
- [Dan McDonough] Create FB page templates for “We Saw It” and “Spotted by Us” variants. (This week)
- [Ben Holley] For rejected ads: delete/appeal/update so they don’t count against the account. (Ongoing)
- [Ben Holley] Follow up with System One to ensure new, correct “arb” dataset delivery and confirm integration timing. (This week)
- [Engineering — Scott/Anastasia] Continue/ship automated publisher blocking for Media Go; monitor publisher quality. (In progress)
- [Andrew Cook] Continue Taboola bidding tests; report on scaling levers and RPC stability. (Ongoing)
- [Narbeh Ghazalian] Monitor revenue recovery as ads migrate to new pages. (Daily)

## Risks / Blockers
- Revenue dip until migration completes and spend stabilizes across new pages.
- Potential “circumvention” risk if signals correlate across pages (none observed; continue to monitor).
- Operational overhead to stand up and manage many pages.
- Media Go publisher quality could cap performance until blocking automation matures.

## Experiments
- Remove dollar amounts and “paid” from creatives; measure impact on CTR/CVR and rejection rates.
- Test a general-purpose “sinkhole” redirect page vs. homepage for risk reduction.
- Taboola bidding strategies (document hypothesis, targets, and guardrails per campaign).

## Notes & Observations
- Suspensions were only visible when viewing as page owner; not clearly surfaced in diagnostics/account center.
- Prior rejections often tied to categorization confusion; if addressed, they should not count against the account.

## Appendix / Links
- (Add links to dashboards/tickets once created)


