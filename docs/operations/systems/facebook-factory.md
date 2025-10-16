# Facebook Factory — Idea to Margin

Purpose
- Systematize Idea → Launch → Scale → Learn for Facebook.
- Produce predictable contribution margin; reduce cycle time; increase hit rate.

Outcomes
- This week: +$1,000/day attributable to Dan via coordination + individual contribution.
- By EOM: sustain +$1,000/day run-rate; Maryna/Catherine independently ship 4–6 launches (combined).
- Contribute to team goal: +$5,000/day.

Roles and Ownership
- Dan (Architect/QA/Throughput owner): approve blueprints, enforce guardrails, unblock, scorecard.
- Maryna (Launch Engineering DRI): structure, launch execution, change logs, adherence to Jim gates.
- Catherine (Creative Ops DRI): creative batch pipeline, spec compliance, rapid iterations.

Pipeline (Stages, SLAs, DoD)
- Stage 0 — Intake (Impact Filter)
  - SLA: ≤12h triage to ship/hold/kill.
  - DoD: Impact Filter linked to initiative; DRI assigned; decision logged.
- Stage 1 — Blueprint (Dan)
  - SLA: ≤12h. Artifacts: 1‑pager (audience, offer, budget ladder, KPI targets, measurement plan, QA).
  - DoD: Blueprint approved; Creative Batch Spec attached.
- Stage 2 — Creative/Assets (Catherine)
  - SLA: ≤24h. Produce 5–8 assets with naming/versioning; export presets; thumb‑stops first.
  - DoD: Spec checklist passed; handoff package delivered.
- Stage 3 — Launch (Maryna)
  - SLA: ≤24h once assets ready. Minimal ad‑set structure for stable learning.
  - DoD: Preflight QA (pixel/events, attribution, placements, budgets, caps, naming, RPC tagging) passed; monitoring windows set; change‑log opened.
- Stage 4 — Monitor + Adjust (Dan reviewer)
  - Daily 12:00/18:00 PST: Apply Jim gates: EWMA(hl=3d), trend confirm, volatility guardrails.
  - DoD: Actions logged with rationale (gate pass/fail). Scale +20–40% when gates met; freeze <1.10; revert if <1.00 twice.
- Stage 5 — Learnings (All)
  - DoD: What worked/failed/why captured; SOPs/playbooks updated; next tests queued.

Scorecard (weekly)
- Throughput: 4–6 launches/week (Maryna+Catherine combined)
- Cycle time: Intake→Launch ≤48h (P50), ≤72h (P90)
- Hit rate: ≥40% break‑even in 72h; ≥25% meet scale gates
- Scaling velocity: +20–40%/day when gates met
- Contribution: +$1,000/day attributable by EOM (Dan); ladders to +$5,000/day team
- Independence ratio: ≥80% tasks executed by Maryna/Catherine; Dan ≤30m/launch
- Quality: 0 critical QA misses; naming/tracking 100% compliant
- Learning cadence: 2 Looms/week; learnings logged same‑day

Cadence
- Mon Planning: approve blueprints; slot SLAs; assign DRIs
- Daily 12:00/18:00 PST: Jim actions + change‑log post
- Fri Review: scorecard vs targets; unblock; SOP updates

References
- Impact Filter template: ../../operations/templates/impact-filter.md
- Launch checklist (Maryna): ../humans/maryna/launch-engineering-checklist.md
- Creative checklist (Catherine): ../humans/catherine/creative-ops-checklist.md

Prompts
- aion "Blueprint the Facebook Factory: roles, SLAs, QA, scorecard"
- aion "Delegate launch pipeline so Maryna/Catherine run 80% by Friday"
- jim "Compute EWMA/trend/volatility gates and action list for today"
