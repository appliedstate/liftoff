---
date: 2025-10-24
status: Draft
owner: Eric Roach
product: Facebook CoPilot
related:
  - docs/prd/reconciled-facebook-reports-api.md
  - docs/prd/terminal-facebook-bidder-prd.md
  - docs/prd/iterate.md
  - docs/prd/facebook-category-discovery-pipeline.md
---

# PRD — Facebook CoPilot (Daily Decision Ritual)

## 1. Problem Statement
Media buyers need a fast, opinionated daily session to review performance, spot outliers, and take the next action. Existing dashboards are noisy and slow; high-impact items get buried.

## 2. Goals / Outcomes
- Provide a guided “morning coffee” session that surfaces the 80/20 of impact in < 5 minutes.
- Standardize review via ROAS bands and absolute-loss thresholds; reduce decision fatigue.
- One-click links to the right level of detail (campaign/ad set/ad, creative) and suggested actions.

## 3. Non-Goals
- Automated trafficking or bidding changes (see Terminal Facebook Bidder PRD).
- Intraday predictive modeling; this is a reconciled performance pass.

## 4. Users and Use Cases
- Users: Media buyers (e.g., Ben), PMs.
- Use cases:
  - Daily review: sort by volume (spend/conversions), scan ROAS bands, apply budget up/down decisions.
  - Loss triage: inspect items with absolute losses over thresholds and drill into causes.

## 5. Data Sources
- Reconciled performance: `docs/prd/reconciled-facebook-reports-api.md`.
- Campaign/adset/ad metadata from Ads Manager (links only; no write operations in v1).

## 6. Session Flow (Happy Path)
1) Overview: Top-line ROAS, spend, conversions; quick deltas vs prior period.
2) 80/20 List: Sort by conversions (or spend) descending; show top 20 items.
3) ROAS Bands highlighting:
   - Outstanding: ≥ 160%
   - Good: 140–160%
   - Fair: 120–140%
   - Break-even: ~100–120%
   - Losses: < 100% — inspect by absolute loss dollars
4) Quick Actions:
   - Budget up: propose gentle increases for small budgets; conservative steps for large budgets.
   - Budget down/pause for clear losers; open drill-down.
5) Drill-Down: When negative, jump to campaign-level detail and creative/ad composition.

## 7. Functional Requirements
1) Surface top-N by conversions/spend with ROAS bands and absolute loss.
2) Configurable thresholds (bands, loss dollars).
3) Suggested actions per item based on band + budget size.
4) Deep links to Ads Manager entities and internal dashboards.
5) Session transcript/log: what was reviewed and actions taken (for audit).

## 8. UI Outline
- Header: KPIs + deltas.
- Table: Item, spend, conversions, CPA, RPC, ROAS, loss $, band, suggested action, link.
- Filters: Account, date, entity level.
- Footer: Session summary and export.

## 9. Risks & Mitigations
- Noisy data or lag in reconciliation → show data freshness and allow manual refresh.
- Over-reliance on bands → allow per-account overrides and notes.

## 10. Open Questions
- Preferred default sort (conversions vs spend) per account?
- Additional bands or sub-bands needed?

## 11. Current Implementation (as of 2025-10-24)

- Backend service: `backend/src/routes/strategist.ts`
  - `POST /api/strategist/ingest`: accepts CSV text or URL; normalizes to reconciled-like rows; stores per key/user.
  - `GET /api/strategist/reconciled`: serves reconciled-shaped JSON/CSV with filters (`date`, `level`, `owner`, `lane`, `category`, `account_ids`, `limit`, `timezone`). Demo mode returns sample rows with `roas`, `spend_usd`, `revenue_usd`, `conversions`, etc.
  - `POST /api/strategist/chat`: thin LLM wrapper with a system prompt for a trading co-pilot.
  - `POST /api/strategist/exec`: allowlisted command runner (dry-run by default) for safe ops.
- Data contract aligns with `docs/prd/reconciled-facebook-reports-api.md` (adset/campaign level, ROAS, margin, support flags).
- No dedicated frontend yet (table/dashboard WIP elsewhere); endpoints are consumable for CoPilot session flow.

Implications for CoPilot v1:
- We can power the 80/20 list and ROAS bands directly from `GET /api/strategist/reconciled`.
- Session export/log can be persisted client-side initially; server-side audit can be added later.

## 12. Gaps / Next Steps

- Frontend session UI: build the dashboard table with bands, absolute-loss column, suggested actions, deep links.
- Config: per-account defaults for primary sort and absolute-loss thresholds; store and load.
- Actions: define no-op “apply” handlers (budget up/down suggestions) and link-out to Ads Manager; future: integrate with Terminal bidder for writes.
- Session log: capture reviewed items and decisions; allow export.
- Data freshness: show reconciled date and last-updated timestamp.
- Perf: pagination/virtualization for large sets.


