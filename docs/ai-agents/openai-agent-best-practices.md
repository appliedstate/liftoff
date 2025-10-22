# OpenAI Agent Best Practices — Liftoff Summary & Checklists

Source: [A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)

This document distills the guide into actionable checklists for Liftoff OS agents and the Attention Engine. Use alongside personas in this folder and the Attention Engine factory spec.

---

## Core components

- **Model**: Use the most capable model to baseline, then right-size for cost/latency.
- **Tools**: Small, well-documented functions with clear IO contracts and risk rating.
- **Instructions**: Clear routines mapped to SOPs with explicit actions and edge cases.

### Build checklist
- Define the agent’s objective, inputs, outputs, and termination condition.
- Select baseline model; add evals; then downshift where acceptable.
- Register tools with descriptions, params, and risk levels (low/med/high).
- Write instructions from existing SOPs; include decision branches and missing-info handling.
- Log all tool calls and decisions to telemetry with timestamps and correlation IDs.

---

## Orchestration patterns

- **Single-agent** for simple workflows.
- **Manager/worker** when many tools or substeps exist.
- **Decentralized handoff** for specialized agents (triage → specialist → back if needed).

### Orchestration checklist
- Choose pattern; document handoffs and ownership.
- Limit retries; define failure thresholds and escalation.
- Persist context across steps; store final output and decision trace.

---

## Guardrails

- Combine LLM and deterministic safeguards.
- Types: relevance, safety/jailbreak checks, PII filter, moderation, tool safeguards, deterministic filters (blocklists/regex), output validation.

### Guardrail checklist
- Add pre-input relevance and safety checks for user inputs.
- Rate-limit and cap message/tool depth; enforce max cost per run.
- Assign tool risk levels; require human approval for high-risk actions.
- Validate outputs against schema and brand style; redact PII in logs.
- Capture violations; create playbooks for recurring edge cases.

---

## Human-in-the-loop

- Trigger on: exceeded failure thresholds or high-risk actions.
- Provide a clear, minimal handoff packet: objective, attempts, current state, next best action.

### HITL checklist
- Define thresholds (max retries, max tools, max cost/time).
- Define high-risk actions requiring approval (payments, data writes, deletions).
- Implement pause/approve/deny controls in Terminal.

---

## Implementation notes for Liftoff OS

- **Attention Engine**: Treat each experiment as an agent-run with telemetry; enforce SLAs and guardrails (decision latency, cost caps, p95 limits).
- **Terminal**: Surface tool risk ratings, approvals, and run traces; support replay.
- **HCS**: Map agent instructions to SOPs; personas reference this doc and the PDF.
- **Logging**: Write structured logs for inputs, outputs, tool calls, and guardrail trips.

References:
- PDF: `./openai-practical-guide-to-building-agents.pdf`
- Attention Engine: `../attention/10-attention-engine-factory.md`

