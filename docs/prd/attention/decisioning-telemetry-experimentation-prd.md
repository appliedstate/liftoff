## Decisioning & Telemetry Experimentation PRD

- Owner: Data/Platform
- Stakeholders: Ops, Creative, Terminal, AI Agents
- Status: Draft
- Version: 1.0
- Date: 2025-10-21

### 1) Problem Statement
We need a thin, reliable factory to turn ideas into experiments with immediate, trustworthy readouts so we can delete waste and scale winners. Today, decisions are delayed by inconsistent telemetry, unclear gates, and scattered artifacts.

### 2) Goals
- Single decision surface with p95 telemetry latency ≤ 15 minutes for tracked KPIs.
- Automated gates that propose delete/scale decisions within 24h of stable read.
- Minimal operator overhead: create experiment → get dashboard, gates, and log by default.

### 3) Non‑Goals
- Complex feature store or net‑new warehouse.
- Heavy experimentation framework implementation; prefer simple, explicit metrics.

### 4) Architecture Overview
- Events: minimal, versioned schema for experiment events and metrics.
- Freshness: refresh_log and last_refresh_at surfaced per metric/view.
- Gates: rules engine encoding thresholds (e.g., vRPS uplift, density, safety guards).
- Surfaces: decision board with status, gates, recommended action, and links to evidence.

### 5) Data Model (initial)
- metadata.experiments (id, name, hypothesis, owner, created_at, status)
- metrics.experiment_kpis (experiment_id, ts, metric, value)
- metadata.refresh_log (job_name, started_at, finished_at, status, rows, error)

### 6) Interfaces
- REST
  - GET /api/experiments/:id — core details, KPIs, freshness, gate states
  - POST /api/experiments — create experiment (name, hypothesis, target KPIs)
  - GET /api/experiments/:id/decision — current recommendation + rationale

### 7) SLAs
- Telemetry p95 latency ≤ 15m; decision p95 ≤ 24h from first stable read.
- Availability 99.9% for read endpoints.

### 8) Security
- RLS with read roles; audit logs; rate limits.

### 9) Rollout
1) Create schemas/tables; 2) Implement GET/POST endpoints; 3) Add gates; 4) Dashboards; 5) Validate against 3 live experiments.

### 10) Success Metrics
- ≥80% of experiments get recommendations within 24h; <1% telemetry failures.


