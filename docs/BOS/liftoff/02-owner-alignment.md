---
title: Owner Alignment
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Owner Alignment

Owners: Eric Roach (ER), Narbeh Ghazalian (NG)

Durable destination
- Build a capability‑compounding product and data platform that reduces cycle time, raises quality, and provides a single, secure reporting/API surface for humans and AI agents.

Invariants (do not change without explicit owner agreement)
- Security and data governance first: RLS, least privilege, versioned APIs; no secrets in source.
- MCP tools remain thin adapters over the official API; no business logic in MCP.
- SLOs (freshness, latency, error rate) are inviolate; fixes preempt new features when red.

Decision rights
- Public API changes, schema migrations, and security posture: joint owner decision with written plan.
- Build‑versus‑buy for core platform components: owner decision with explicit ROI rationale.
- Prioritization of automation that materially reduces arbitrage ops toil: owners approve quarterly investment slate.

Operating cadence
- Daily: ship small safe changes; monitor SLOs and error budgets.
- Weekly: KPI review (DORA, freshness, API); select next automation targets driven by arbitrage needs.
- Quarterly: re‑validate KPI set and portfolio of bets vs thousand‑year goal.

Disagreements: tie‑break mechanism
- Prefer reversible experiments behind flags for ≤2 weeks and select by KPI movement (cycle time, error budget, adoption).
- Non‑reversible/security‑sensitive → explicit written decision by both; default is no‑change.

Sign‑off
- Eric Roach: __________________  Date: __________
- Narbeh Ghazalian: ____________  Date: __________


