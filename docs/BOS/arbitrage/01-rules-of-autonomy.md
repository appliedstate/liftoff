---
title: Rules of Autonomy
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Rules of Autonomy (Sign‑to‑Work)

These rules define bounded authority for daily operations. By signing, each operator agrees to act within these rules without waiting for permission, and to pause/escalate when rules require it.

Canonical rules (ladder to BOS 1, 4–12)
- Make requirements less dumb: challenge assumptions with data; propose simpler tests first.
- Delete before optimizing: remove steps, campaigns, and reports that do not increase margin per $.
- Simplify, then optimize: fewer campaigns, clearer labels, deterministic rules.
- Accelerate cycle time: small daily changes over big weekly changes.
- Automate last: prove the rule manually for 1–2 weeks before automation.

Decision authority
- Launches within platform policy and budget caps: autonomous per buyer within assigned risk budget.
- Scale‑ups: +15–25%/day while dM/dS > 0 and CI(M) > 0.
- Kills: autonomous when 3‑day rolling margin < 0 AND 95% CI below 0.
- Pauses for safety/compliance: immediate autonomous pause; notify in the same hour.

Risk & spend guardrails (policy)
- Daily portfolio stop‑out: pause allocations if M_d < −DD_max.
- Diversification: ≤35% total at any single platform bucket; per‑buyer ≤15% daily risk (new ≤8%).
- Comp: variable ≤35% of net; buyer ≤20%; accrues, releases on cash collection.
- Cash cushion: maintain ≥ policy threshold vs required K (70/30 model) or auto‑throttle.

Data & DSM truth
- Strateg.is dashboards and curated API are the source of truth for ops decisions.
- Freshness SLAs: dashboards by 07:00; intra‑day alerts during trading hours.
- Evidence links must be attached to major actions (kills, escalations, unusual scale).

Kill/Keep/Scale rules (operational)
- Kill: 3‑day negative with 95% CI below 0 → pause and recycle budget.
- Keep: 3‑day positive with CI > 0 → hold.
- Scale: step‑ups 15–25%/day while CI > 0 and dM/dS > 0.

Reversible vs non‑reversible changes (approval gates)
- Reversible: budget moves, routine campaign toggles, publisher‑level blocks → act within guardrails.
- Non‑reversible: account structure overhauls, policy‑sensitive flows, new partner onboarding → pre‑approval required with brief and risk assessment.

Communication SLAs
- Sev1 (account safety, major policy/IVT): ack ≤30m; mitigation start ≤2h; updates ≤2h.
- Daily update by 10:00 local: spend, revenue, margin, flags, planned actions.

References
- Portfolio Reporting PRD — `../../prd/arbitrage-portfolio-reporting-prd.md`
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`
- Interlincx × Adnet SLA — `../../private/agreements/interlincx-adnet-sla-arbitrage-agreement.md`
- Facebook Metrics PRD — `../../prd/strategis-facebook-metrics-endpoint.md`

Sign‑to‑Work Acknowledgement
- I have read and agree to operate within these rules and guardrails. Name/Date: ________________________


