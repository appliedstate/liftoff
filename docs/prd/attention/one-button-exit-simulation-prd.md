## One‑Button Exit — Simulation & Policy PRD

- Owner: Ops
- Stakeholders: Eng, Data, Finance
- Status: Draft
- Version: 1.0
- Date: 2025-10-21

### 1) Problem Statement
Exit operations are slow and error‑prone. We need a reliable one‑button exit with weekly simulations to guarantee p95 exit latency ≤ 24h.

### 2) Goals
- Implement a single orchestrated action that performs exit safely.
- Weekly simulated exit with full audit, proving p95 ≤ 24h end‑to‑end.

### 3) Scope
- Include: permissions, data export, financial close hooks, campaign shutdown, comms.
- Exclude: legal renegotiations; product wind‑down beyond SOP.

### 4) Workflow
1) Pre‑checks (guardrails met, alerts green) → 2) Freeze writes → 3) Export data & state → 4) Revoke credentials → 5) Notify stakeholders → 6) Verify exit checklist → 7) Unfreeze if simulation.

### 5) Interfaces
- Terminal action: exit.execute(simulate: boolean)
- Dashboard: exit readiness & last simulation report.

### 6) SLAs & Observability
- p95 simulation runtime ≤ 2h; real exit p95 ≤ 24h; full audit log with correlation IDs.

### 7) Success Metrics
- 100% weekly simulations completed; zero critical deviations.


