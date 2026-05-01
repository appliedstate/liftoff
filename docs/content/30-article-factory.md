---
id: content/30-article-factory
version: 0.1.0
owner: growth-ops
runtime_role: agent
title: Article Factory (LPIDs) — Destination Supply for the L2L Flywheel
purpose: Define what an LPID is, how we select/produce LPIDs, and the minimum data contract the rest of the system needs (Creative Factory, Strateg.is tracking, Launch Protocol).
dependencies:
  - README.md
  - operations/60-launch-protocol.md
  - creative/40-creative-factory.md
  - creative/41-hook-ideation-agent.md
  - infra/21-aem-priority.md
licensing: internal
---

## Definitions
- **LPID**: Landing/Page ID. A stable identifier for a destination page/article + its RSOC widget configuration.
- **LPID-ready**: An LPID that is safe to scale traffic to and has enough signal to be used in launch/optimization decisions.

## Why this exists
Creatives don’t stand alone in Liftoff. Ads must map 1:1 to a destination that:
- converts attention into **RSOC advertiser value** (CAPI Purchase(value))
- exposes a **keyword widget** that aligns with the hook/copy

## LPID “ready” gates (current)
Use these as the minimum acceptance gates referenced across ops docs:
- **Sessions**: ≥ 3,000 (historical)
- **Economics**: vRPS ≥ account median (or vertical median)
- **Widget viewability**: ≥ 70%
- **Tracking correctness**: UTMs present; CAPI Purchase(value) flowing; AEM Purchase(value) priority #1

(These gates are referenced in `docs/operations/60-launch-protocol.md` and `docs/README.md`.)

## Required data contract (what other systems need)
For any LPID, the system should be able to retrieve:
- **lpid** (string)
- **url** (string)
- **headline** (string)
- **rsoc_keywords[]** (ranked)
- **widget_viewability** (number)
- **sessions** (number)
- **vRPS** (number, or uplift vs median)
- **vertical** (taxonomy slug)

## Workflow (human today, automatable later)
1) **Select LPIDs by angle/vertical**
2) **Verify gates**
3) **Provide LPID context** to Hook Ideation Agent (headline + keywords)
4) **Bind** each creative to exactly one LPID
5) **Keep a small active set** per vertical and refresh when fatigue/decay triggers fire

## What’s missing (explicit)
- A canonical “LPID registry” endpoint/service in this repo (where to query LPIDs + metrics).
- A standardized way to map **angle → candidate LPIDs**.
- A single authoritative place for “LPID readiness” metrics (sessions/vRPS/viewability).

