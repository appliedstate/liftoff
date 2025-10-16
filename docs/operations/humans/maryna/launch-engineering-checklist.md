# Launch Engineering Checklist — Maryna (DRI)

Intake
- Confirm Impact Filter + approved Blueprint; capture deadlines and budgets

Preflight QA (must pass before publish)
- Pixel/events wired; attribution window set; correct account/Business Manager
- Campaign/ad set naming conventions applied; RPC tagging in place
- Placements/locations/languages targeting per Blueprint
- Budgets, caps, bid strategy set; frequency caps if specified
- Tracking parameters (UTM) and conversion events verified

Structure (stable learning)
- Minimal ad‑set structure; target ≥50 conversions/week per ad set
- Avoid resets: batch creative swaps; stagger changes; no frequent edits

Build & Publish
- Import creative assets per spec; verify aspect ratios and sizes
- Double‑check policy compliance; submit for review; record expected go‑live

Change Log & Monitoring
- Open launch change‑log with timestamps and settings
- Set daily monitoring windows at 12:00 and 18:00 PST

Daily Ops (with Dan’s review)
- 12:00/18:00 PST: Apply Jim gates (EWMA, trend, volatility)
- Scale +20–40% when gates met; freeze <1.10; revert if <1.00 twice
- Log actions and rationale (gate pass/fail) in change‑log

Post‑Launch QA
- Verify spend pacing, CPM/CPC sanity, event fire rate, early RPC/ROAS
- Flag anomalies immediately; propose fix options to Dan

Handoff & Learnings
- Summarize outcomes; capture what worked/failed and why
- Queue next tests; link to Looms and creative iterations

References
- Factory: ../../systems/facebook-factory.md
- Creative checklist: ../catherine/creative-ops-checklist.md
