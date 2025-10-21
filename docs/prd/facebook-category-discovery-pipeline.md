# Facebook Category Discovery Pipeline (working name)

Status: idea
Owner: Eric
Stakeholders: Ben, Marina, Dan
Related: docs/prd/strategis-facebook-metrics-endpoint.md

## Problem

We need a reliable pipeline to discover and prioritize new Facebook categories to test, replacing prior reliance on third-party sheets. Manual browsing is slow and error-prone; setup quality issues reduce confidence and velocity.

## Goals / Outcomes

- Weekly list of vetted categories with supporting links and rationale
- Observable signals to raise hit rate (active ≥ 7–10 days, multiple versions, cross-platform presence)
- Clear handoff from discovery → deployment → monitoring

## Non-Goals

- Full creative cloning automation (future)
- Performance attribution modeling (out of scope)

## Signals & Heuristics

- Active status = active; start_date within past 2–12 weeks; still running ≥ 7–10 days
- Multiple unique versions per ad/angle
- Cross-platform distribution (facebook, instagram, audience_network, messenger)
- Freshness cadence (recent new ads in the category)

## Data Source

- Meta Ad Library via SearchApi
  - Docs: https://www.searchapi.io/docs/meta-ad-library-api
  - Params: engine=meta_ad_library, active_status=active, start_date/end_date, platforms, country, content_languages

## User Stories

- As a media buyer, I want a weekly ranked list of categories with links so I can quickly trial new angles.
- As a PM, I want rationale and signals stored so we can audit why categories were chosen.

## Workflow

1) Gather candidates via API queries (country=ALL or specific; active only; date window)
2) Score by signals (versions count proxy, total_active_time, platform breadth)
3) Normalize per category (cluster by theme, e.g., dental implants)
4) Produce backlog with links to ad pages and landing pages
5) Handoff to deployment with QA checklist

## Artifacts

- Backlog Sheet (CSV/Sheet): category, example_link, rationale, signals, status
- SOP: discovery steps, QA checklist

## API Integration

- Environment: SEARCHAPI_API_KEY
- Endpoint: GET https://www.searchapi.io/api/v1/search?engine=meta_ad_library&active_status=active&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&platforms=facebook,instagram
- Pagination via next_page_token

## Risks

- API rate limits; mitigated via batching and caching
- Redirected landing pages prevent keyword extraction; mitigated via manual validation

## Open Questions

- Naming: alternative to “Scout” (see below)

## Naming Options

- Facebook Category Discovery Pipeline
- Facebook Category Finder
- Facebook Category Prospector
- Facebook Category Explorer
- Facebook Opportunity Miner


