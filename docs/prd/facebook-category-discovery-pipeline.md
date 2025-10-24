# Facebook Category Discovery Pipeline (feeds Attention Engine Factory)

Status: idea
Owner: Eric
Stakeholders: Ben, Marina, Dan
Related: docs/prd/strategis-facebook-metrics-endpoint.md, docs/prd/iterate.md, docs/attention/10-attention-engine-factory.md

## Problem

We need a reliable pipeline to discover and prioritize new Facebook categories to test, replacing prior reliance on third-party sheets. Manual browsing is slow and error-prone; setup quality issues reduce confidence and velocity.

## Goals / Outcomes

- Weekly list of vetted categories with supporting links and rationale
- Observable signals to raise hit rate (active ≥ 7–10 days, multiple versions, cross-platform presence)
- Clear handoff from discovery → deployment → monitoring
 - Provenance and traceability for any downstream usage (Iterate): every backlog item must include links and metadata needed to reconstruct source context

## Non-Goals

- Full creative cloning automation (future)
- Performance attribution modeling (out of scope)

## Signals & Heuristics

- Active status = active; start_date within past 2–12 weeks; still running ≥ 7–10 days
- Multiple unique versions per ad/angle
- Cross-platform distribution (facebook, instagram, audience_network, messenger)
- Shared Facebook Pixel IDs across different pages/ads (competitor fingerprint)
- Freshness cadence (recent new ads in the category)
 - Versions density (unique versions per ad/angle) as a persistence proxy

## Data Source

- Meta Ad Library via SearchApi
  - Docs: https://www.searchapi.io/docs/meta-ad-library-api
  - Params: engine=meta_ad_library, active_status=active, start_date/end_date, platforms, country, content_languages

## User Stories

- As a media buyer, I want a weekly ranked list of categories with links so I can quickly trial new angles.
- As a PM, I want rationale and signals stored so we can audit why categories were chosen.

## Workflow (Factory integration)

1) Gather candidates via API queries (country=ALL or specific; active only; date window)
2) Score by signals (versions count proxy, total_active_time, platform breadth)
3) Normalize per category (cluster by theme, e.g., dental implants)
4) Produce backlog with links to ad pages and landing pages → extract Facebook Pixel IDs from landing page HTML (static parse; no JS execution) and include in outputs → feed Iterate inputs
   - Attach provenance bundle for each item: ad library URL, landing URL (resolved), observed platforms, first_seen/last_seen, versions_count
5) Handoff to Creative Factory & Launcher with QA checklist; Strateg.is logs for monitoring

## Artifacts

- Backlog Sheet (CSV/Sheet): category, example_link, rationale, signals, status
- SOP: discovery steps, QA checklist
 - Provenance bundle per item stored alongside CSV (JSON) to enable trust and review in Iterate

## API Integration

- Environment: SEARCHAPI_API_KEY
- Endpoint: GET https://www.searchapi.io/api/v1/search?engine=meta_ad_library&active_status=active&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&platforms=facebook,instagram
- Pagination via next_page_token
 - Capture: first_seen, last_seen, versions_count (if available), platforms, page_name, page_id

## Risks

- API rate limits; mitigated via batching and caching
- Redirected landing pages prevent keyword extraction; mitigated via manual validation

## Open Questions

- Naming: alternative to “Scout” (see below)
 - Should we include lightweight screenshot thumbnails of ad cards for reviewer speed?
 - Best country default set for international exploration (CA/UK/AU)?

## Naming Options

- Facebook Category Discovery Pipeline
- Facebook Category Finder
- Facebook Category Prospector
- Facebook Category Explorer
- Facebook Opportunity Miner


> Identity & Audience Graph plan has moved to: `docs/prd/identity-and-audience-graph-prd.md`.


