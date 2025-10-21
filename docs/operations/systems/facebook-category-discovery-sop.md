# SOP: Facebook Category Discovery

Purpose: Produce a weekly vetted list of categories with links and rationale.

## Signals

- Active ads with ≥ 7–10 days running
- Multiple unique versions (indicates investment)
- Platform breadth (facebook, instagram, audience_network, messenger)
- Recent new ads in same category in last 2–12 weeks

## Tools

- API: SearchApi Meta Ad Library — https://www.searchapi.io/docs/meta-ad-library-api
- Params: engine=meta_ad_library, active_status=active, platforms, date window

## Steps

1. Query the API for active ads in target countries/languages and date window
2. Filter to ads with multiple versions and longer active durations
3. Cluster by category/theme; select 3 exemplar ads per category
4. Capture links (ad, page, landing) and rationale
5. Output/update the backlog sheet; propose top 10 weekly
6. Handoff to deployment with QA checklist (geo, domain, naming, budgets)

## Backlog Fields

- category, example_link, advertiser_page, landing_url, signals, rationale, status

## QA Checklist (deployment)

- Geo targeting matches plan
- Correct domain/UTM
- Naming conventions
- Budgets/bids sane
- Final human QA pass


