## Buyer Flow Simplification PRD — Delete Before Optimizing

- Owner: Growth Ops
- Stakeholders: Product, Engineering, Data
- Status: Draft
- Version: 1.0
- Date: 2025-10-21

### 1) Problem Statement
Buyer flow is accretive and slow. We commit to remove three steps immediately and measure throughput and conversion deltas, keeping only proven value.

### 2) Goals
- Remove ≥3 steps now; preserve only steps with proven lift.
- Increase completed sessions per 1k visits by ≥10% with no vRPS drop.

### 3) Non‑Goals
- Comprehensive redesign; optimize after deletion.

### 4) Approach
- Map current steps; rank by friction and evidence.
- Delete highest friction, lowest evidence steps.
- Instrument before/after KPIs: completion%, time‑to‑complete, vRPS, bounce.

### 5) Experiments
- E1: Remove account creation pre‑gate → measure completion and vRPS.
- E2: Collapse two confirmation screens into one.
- E3: Auto‑advance on form validation success.

### 6) SLAs
- Ship deletions within 72h; decision p95 ≤ 24h after stable read.

### 7) Success Metrics
- ≥10% lift in completed sessions/1k visits; no significant vRPS decline (±2%).


