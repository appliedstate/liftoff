---
title: Business Operating System (BOS)
owners: ["Eric Roach", "Narbeh Ghazalian"]
status: approved
approved_by: Eric Roach
last_reviewed: 2025-10-16
---
# Business Operating System (BOS)

This document captures a practical, systematized way of running a company inspired by the operating patterns described in the base notes. It is designed to be included in a project or company README and used as an onboarding and execution guide.

## 0) Purpose and Scope
- Align owners and teams on a thousand‑year direction, then operate via measurable experiments that optimize progress and cost‑efficiency.
- Replace slow managerial gates with clearly bounded autonomy and automated approvals so individuals can act with instant authority within their zones.

- Context specifics: [Liftoff](BOS/liftoff/00-purpose-and-scope.md) | [Arbitrage](BOS/arbitrage/00-purpose-and-scope.md)

## 1) Rules of Autonomy (Sign-to-Work)
- Publish and maintain a concise rule set that defines zones of authority and when to wait for approval.
- Require every employee/partner to agree to the letter and spirit of these rules as a condition of working in the company.
- Continuously improve rules; re-sign upon updates.

Engineering rules (canonical example):
- Make requirements less dumb.
- Delete a part or process if possible.
- Simplify, then optimize.
- Accelerate cycle time.
- Automate last.

Productivity rules (canonical example):
- Avoid large meetings; leave if not contributing.
- Communicate directly; ignore chain of command when needed to solve problems faster.
- Be clear, not clever.
- Reduce frequent meetings; use async updates.
- Use common sense.

- Context specifics: [Liftoff](BOS/liftoff/01-rules-of-autonomy.md) | [Arbitrage](BOS/arbitrage/01-rules-of-autonomy.md)

## 2) Owner Alignment
- Explicitly align owners on a single, durable vision and destination. Without alignment, do not proceed to scale.
- Reconfirm alignment when major changes occur (financing, market shocks, strategy shifts).

- Context specifics: [Liftoff](BOS/liftoff/02-owner-alignment.md) | [Arbitrage](BOS/arbitrage/02-owner-alignment.md)

## 3) Thousand‑Year Goal
- Establish a long‑horizon goal (directional North Star) that is resilient to leadership and strategy changes.
- Examples: decarbonization at scale; multiplanetary resilience; human‑AI co‑evolution readiness.

- Context specifics: [Liftoff](BOS/liftoff/03-thousand-year-goal.md) | [Arbitrage](BOS/arbitrage/03-thousand-year-goal.md)

## 4) KPIs as Experiments
- Define a small set of Key Performance/Progress Indicators (KPIs) that represent falsifiable experiments toward the thousand‑year goal.
- Each KPI is a hypothesis; expect to iterate.
- Examples (domain-specific): range, throughput time, first‑pass quality, cost per unit, adoption rate.

- Context specifics: [Liftoff](BOS/liftoff/04-kpis-as-experiments.md) | [Arbitrage](BOS/arbitrage/04-kpis-as-experiments.md)

## 5) The Experiment Board
- Maintain an Experiment Board with one row per KPI:
  - KPI name and definition
  - Real‑time value and trend
  - Cost to run associated experiments (per hour/day/month)
  - Financial efficiency = progress gained per unit cost
- Use the board to celebrate efficient experiments and question/stop low‑efficiency ones.

- Context specifics: [Liftoff](BOS/liftoff/05-experiment-board.md) | [Arbitrage](BOS/arbitrage/05-experiment-board.md)

## 6) Digital Self‑Management (DSM)
- Instrument KPIs and experiment costs for autonomous, real‑time visibility by everyone.
- Ensure executives and teams see the same numbers; no privileged dashboards.
- Start with manual data collection if necessary, but automate continuously.

- Context specifics: [Liftoff](BOS/liftoff/06-digital-self-management.md) | [Arbitrage](BOS/arbitrage/06-digital-self-management.md)

## 7) Team Formation and Flow
- Teams self‑form around KPI rows to propose and run experiments.
- Individuals can switch teams freely to maximize company‑level value.
- Optimize for cross‑functional collaboration and rapid feedback cycles.

- Context specifics: [Liftoff](BOS/liftoff/07-team-formation-and-flow.md) | [Arbitrage](BOS/arbitrage/07-team-formation-and-flow.md)

## 8) Rapid Iteration in Production
- Prefer many small, safe, instrumented changes in parallel over infrequent big‑bang releases.
- Certify each unit/iteration (not by batch) with automated tests and telemetry.
- Maintain a single production flow that continuously absorbs validated improvements (ramp from 1 → 2 → 100 → 4,000+).

- Context specifics: [Liftoff](BOS/liftoff/08-rapid-iteration-in-production.md) | [Arbitrage](BOS/arbitrage/08-rapid-iteration-in-production.md)

## 9) Automation and Tests
- Invest heavily in automated testing and data collection; assume a large share of the org focuses on automation.
- Prioritize test coverage that protects safety, quality, and unit economics.

- Context specifics: [Liftoff](BOS/liftoff/09-automation-and-tests.md) | [Arbitrage](BOS/arbitrage/09-automation-and-tests.md)

## 10) Financial Policy
- Optimize for reinvestment into R&D and capability compounding where mission‑aligned.
- Measure financial efficiency at the experiment level; terminate poor performers decisively.

- Context specifics: [Liftoff](BOS/liftoff/10-financial-policy.md) | [Arbitrage](BOS/arbitrage/10-financial-policy.md)

## 11) Cultural Norms
- Everyone is a worker; status is derived from contribution to KPIs and cost‑efficiency.
- It is a duty to challenge dumb requirements (politely, with data); aim to be less wrong over time.
- Default to direct communication; minimize ceremony that does not increase KPI progress per dollar.

- Context specifics: [Liftoff](BOS/liftoff/11-cultural-norms.md) | [Arbitrage](BOS/arbitrage/11-cultural-norms.md)

## 12) Operating Rhythm
- Weekly: what got done? what moved which KPI, by how much, at what cost?
- Continuous: update Experiment Board; redeploy talent to the highest financial efficiency rows.
- Quarterly: re‑validate owner alignment, thousand‑year goal relevance, and the KPI set.

- Context specifics: [Liftoff](BOS/liftoff/12-operating-rhythm.md) | [Arbitrage](BOS/arbitrage/12-operating-rhythm.md)

## 13) Onboarding in Four Hours
- Present rules, thousand‑year goal, KPI framework, and DSM access.
- Require rule sign‑off; start with a small experiment on day one.

- Context specifics: [Liftoff](BOS/liftoff/13-onboarding-in-four-hours.md) | [Arbitrage](BOS/arbitrage/13-onboarding-in-four-hours.md)

## 14) Implementation Blueprint
- Create/own a single `rules.md` describing autonomy boundaries and canonical engineering/productivity rules.
- Stand up a lightweight DSM stack: data collection → compute metrics → shared dashboards.
- Define initial KPIs (≤5), seed the Experiment Board, and publish switching norms.
- Establish CI/CD with staged canaries and per‑unit telemetry.
- Review weekly with a single question: which experiments increased KPI per $ fastest?

- Context specifics: [Liftoff](BOS/liftoff/14-implementation-blueprint.md) | [Arbitrage](BOS/arbitrage/14-implementation-blueprint.md)

---

Appendix A: Terms
- Thousand‑Year Goal: a long‑horizon directional aim, not a fixed plan.
- DSM: Digital Self‑Management; shared, automated metrics enabling flat execution.
- Financial Efficiency: KPI delta per unit time/cost.

Appendix B: Starter Templates
- rules.md — [Liftoff](BOS/liftoff/rules.md) | [Arbitrage](BOS/arbitrage/rules.md)
- experiment-board.md — [Liftoff](BOS/liftoff/experiment-board.md) | [Arbitrage](BOS/arbitrage/experiment-board.md) (table with KPI, value, cost, efficiency, owner, next step)
- onboarding.md — [Liftoff](BOS/liftoff/onboarding.md) | [Arbitrage](BOS/arbitrage/onboarding.md) (4‑hour flow and access links)

