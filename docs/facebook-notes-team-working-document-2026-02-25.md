# Facebook Notes - Team Working Document (2026-02-25)

## Scope

- This document captures Facebook-related notes from 2026-02-25 as statements, questions, and decisions.
- This document is formatted for team execution and review.

## Statements

- Ben's Facebook access was reported as banned, including loss of buying access.
- A new Facebook Business Manager/account path was discussed as a potential contingency.
- Account-level risk appears to include ad account, page, and Business Manager exposure.
- Rejections have appeared across multiple categories and reasons.
- Reported recurring rejection themes include spam, human exploitation, and deceptive behavior.
- Job-related ads were identified as a high-risk category.
- Redirect-based flows were identified as a high-risk enforcement surface.
- Spanish campaign performance/compliance was reported as deteriorating.
- Ben-related assets and operational dependencies may require reassignment if access remains blocked. Be currently remains blocked as of 2-27, what progress has been made to have Phil assist?
- Team noted possible constraints around direct appeal effectiveness for the current ban state.
- Narbeh reached out to Matt Bernembaum of the Huntley account to see what assistance we can get - whether it be warmed up business managers, getting Facebook assistance on overturning Ben's ban, or general understanding of our Business Managers condition.
- Current model risk was discussed as potentially non-compliant under increasing enforcement.
- A revenue dependency on jobs-related campaigns was discussed and requires quantification. It appears that a notable percentage of our current gross margin is due to the jobs related categoies.  How do we wean off of this?

## Questions

1. What Business Managers are currently active, and who has admin and spend permissions in each?

We have the Adnet Business manager, the one we buy solar in, Interlincx and Naudilus.
2. Which ad accounts, pages, pixels, domains, apps, and payment methods are currently active vs restricted?
3. If campaigns are launched via API, are actions attributable to token owner while enforcement risk sits on ad account/page/business assets?  If we add the ability to launch campaigns via the Facebook API - then it would enable Ben to get back to launching campaigns - he would still struggle with seeing stats related to the actual ads.
4. What percentage of current spend and revenue is tied to jobs-related campaigns?
5. Which rejection reasons are most common in the last 7 and 30 days?
6. Are rejections primarily driven by redirect mechanics, ad-to-landing mismatch, or both?
7. Which active campaigns/ads should be paused immediately based on risk and performance?
8. What non-jobs categories can support near-term delivery with lower policy risk?
9. What is the exact operational impact of Ben's ban on campaigns, assets, and workflows?
10. Should a new Business Manager be stood up now, and under which compliance guardrails?
11. What escalation paths are available (internal, partner, or rep channels)?
12. What is the minimum viable compliant operating model for the next 30 days?

## Decisions (Current)

- Pause or avoid net-new jobs-related ads until policy root cause is clarified.
- Review and reduce high-risk ads, prioritizing those with low performance and policy exposure.
- Treat rejection volume and policy flags as actionable signals, not isolated events.
- Prioritize account longevity and policy compliance over short-term volume.
- Run an incident health check covering access, permissions, assets, campaign status, policy events, and billing continuity.
- Produce a team snapshot with four states: broken, safe, paused, and next actions.
- Assign owners and ETAs for recovery threads: containment, diagnostics, migration, and relaunch criteria.

## Required Data Pulls

- Business Settings export: people, partners, system users, roles.
- Asset map export: ad accounts, pages, pixels, domains, apps, payment methods.
- Campaign status export: active, paused, rejected, limited by account and category.
- Policy/Account Quality logs for last 30 days.
- Rejection reason summary by category (jobs vs non-jobs, English vs Spanish).
- Revenue and spend contribution by category and campaign type.

## Immediate Next Actions

1. Confirm current access status and capture evidence screenshots/errors.
2. Complete full asset and permission inventory.
3. Confirm pause scope for jobs-related campaigns.
4. Quantify risk and revenue exposure by category.
5. Publish owner-based action plan with ETAs.
