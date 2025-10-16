---
title: Automation and Tests
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Automation and Tests

Scope of automation
- Terminal rules for kill/keep/scale, early‑pause heuristics, and budget step‑ups.
- Data pulls and reconciliations (platform → curated facts; S1 receipts; cashflow schedule).
- Alerts for drawdown, CI flips, variance spikes, cash cushion breaches, and comp cap flags.

Testing strategy
- Unit tests: heuristics (threshold math, decay, CI), publisher normalization, receipts schedule.
- Integration tests: platform report parsers ↔ curated tables; reconciliation math vs fixtures.
- End‑to‑end (shadow): dry‑run terminal actions with evidence logging; no‑write mode for 7‑day calibration.
- Contract tests: Strateg.is/curated API response shapes; MCP tools mirror API.

Validation in production
- Canary cells with bounded budgets; certification per unit (margin trend, CI sign, variance, decay, policy check).
- Action logging with correlation IDs; weekly sampling review for false positives/negatives.

CI/CD gates
- Block deploy when: data freshness <99% last 24h; API 5xx >1%; tests <95% pass; coverage below threshold for heuristics module.
- Require change notes with links to dashboards and rollback steps.

Safety & compliance tests
- Policy pre‑flight checks on creatives/landers; account safety settings verification.
- Auto‑throttle simulations for EBITDA proxy and drawdown.

Rollbacks & runbooks
- Predefined pause/unwind procedures per platform; restore previous budgets; evidence required.

Metrics for automation quality
- Time‑to‑pause from first bad signal; false‑positive reinstatement rate; terminal action success rate; operator review time.

References
- Feasibility Assessment — `../../../feasibility-assessment-publisher-guardrails.md`
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`


