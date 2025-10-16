---
title: Rapid Iteration in Production
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Arbitrage — Rapid Iteration in Production

Principles
- Many small, safe, instrumented changes beat infrequent big‑bang changes.
- Certify each unit/iteration (not batches) with telemetry and CI(M) checks.
- Default to reversible moves; escalate non‑reversible and policy‑sensitive changes.

Canaries and step‑ups
- Launch canaries with bounded budgets (e.g., $50–$150/day) and hard kill gates.
- Scale winners in 15–25% daily step‑ups while \( dM/dS > 0 \) and \( CI(M) > 0 \).
- Freeze scaling on variance spikes or cash‑cushion breaches; recycle budget.

Certification per unit
- Each campaign/cell must show: margin trend, CI sign, variance, decay weight, and policy checks.
- Evidence links attached to Experiment Board row (dashboards, diagnostics, creatives/landers).

Automation (Terminal rules)
- Encode kill/keep/scale and early‑pause heuristics; start manual → promote to automation after 1–2 weeks stability.
- Log actions with correlation IDs; dry‑run mode for 7‑day calibration before write mode.

Rollback and runbooks
- Pre‑define pause/rollback procedures for campaigns, publishers, and budgets.
- Maintain quick‑reference runbooks for platform incidents and policy/IVT events.

Safety and policy
- Pre‑flight policy checks on creatives/landers and account safety settings.
- Immediate autonomous pause on safety/compliance risk; notify within the hour.

Metrics to watch during iteration
- Net margin/day and rate; \( \mathcal{S} = E[M]/\sigma_M \); % CI‑positive buckets; cash cushion vs \( K \).
- Launch throughput ≥7/buyer/week; ≥4 breakeven within 72h.

References
- Experiment Board — `./05-experiment-board.md`
- DSM — `./06-digital-self-management.md`
- Returns Model — `../../operations/arbitrage-portfolio-returns-model.md`


