---
title: Rules (Sign‑to‑Work)
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Liftoff — Rules (Sign‑to‑Work)

Authority bounds
- Ship small, reversible changes daily behind flags; canaries for data and functions.
- Stop feature work to fix red SLOs (freshness, latency, error rate).
- Use MCP only as a thin adapter over the API; no business logic in MCP.

Approval gates (non‑reversible/security‑sensitive)
- Public API changes, schema migrations with durability, security posture shifts.

Quality and governance
- CI gates: tests ≥95% pass, freshness ≥99%, API 5xx ≤0.5%.
- Secrets in platform vaults; RLS and least‑privilege roles.

Evidence & observability
- Every deploy includes change notes, dashboards, and rollback plan.
- Incidents: ack ≤30m; mitigation ≤2h; RCA within 2 business days.

Sign‑to‑Work Acknowledgement
- I agree to operate within these rules and guardrails. Name/Date: ________________________


