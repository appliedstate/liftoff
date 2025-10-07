---
id: infra/aem-priority
version: 1.0.0
owner: growth
runtime_role: agent
dependencies:
  - infra/capi-setup
  - infra/lpid-utm-tracking
inputs:
  - domain_name
  - pixel_id
  - event_catalog:               # candidate web events for this domain
      - Purchase                 # required (value-optimized)
      - ViewContent              # optional
      - Search                   # optional (on-site search)
      - Lead                     # optional
      - CompleteRegistration     # optional
      - InitiateCheckout         # optional
      - AddPaymentInfo           # optional
      - Contact                  # optional / custom
outputs:
  - domain_verified: boolean
  - aem_priority_list:           # ordered top→bottom (max 8)
  - events_eligible_count
  - aem_config_version
kpis:
  purchase_priority_rank: "== 1"            # Purchase at the top
  configured_events_max: "<= 8"             # AEM limit per domain/pixel
  change_frequency: "<= 1 per 7 days"       # batch changes; avoid thrash
guards:
  - "Do not reorder AEM while running major tests or right before scale; batch once weekly."
  - "Purchase (value) must remain enabled and at priority rank 1."
  - "Changes may take time to propagate; expect temporary delivery variance."
  - "Map only truthful events; no proxy inflation."
---

# 21 — Aggregated Event Measurement (AEM) Priority — Web

**Goal:**  
Configure Meta **Aggregated Event Measurement** for your **domain + pixel** so that **Purchase (value)** is the top optimization event for iOS-restricted traffic and web delivery remains eligible for value optimization.

**Why this matters:**  
AEM limits which events count for optimization/measurement under iOS privacy rules. Mis-prioritizing (or omitting) **Purchase** can degrade optimization quality, attribution, and scaling tolerance.

---

## 1) What AEM is in this system

- **Scope:** Web events on your verified **domain** tied to a specific **pixel**.  
- **Limit:** Up to **8 events** can be configured (standard or custom), in a strict **priority order**.  
- **Effect:** When tracking is restricted, Meta uses your **highest-priority eligible event** for optimization and reporting.

**North star alignment:**  
For RSOC monetization, the **money moment** is the advertiser click → we send **`Purchase` with value** via **CAPI**. Therefore **Purchase** must be **priority #1**.

---

## 2) Recommended priority order (RSOC-first)

> **Only configure events you actually fire. Keep it lean.** Example ordering:

1. **Purchase** (value) — *top*  
2. **Lead** (if you truly collect qualified leads with value)  
3. **CompleteRegistration** (if present)  
4. **Search** (on-site search engagement)  
5. **ViewContent** (article view / money page load)  
6. **InitiateCheckout** (if e-comm flows exist)  
7. **AddPaymentInfo** (if e-comm flows exist)  
8. **Contact** (or 1 custom event you rely on)

> If you don’t run lead/e-comm flows, prune those and elevate **Search/ViewContent**. Never demote **Purchase** below rank 1.

---

## 3) Domain verification (must-do)

**Pick one method and complete for each monetized domain:**
- **Meta-tag** in `<head>` of root page, or  
- **DNS TXT** record, or  
- **HTML file upload** to site root.

**Acceptance:** Events Manager shows **Verified** next to your domain name.

---

## 4) Event mapping rules (how your signals qualify)

- **Purchase**: fired **server-side via CAPI** at advertiser click with `{currency: "USD", value: <usd>}` + rich `user_data`.  
- **Deduplication**: if a Pixel `Purchase` also fires, share the **same `event_id`**; Meta keeps the first it receives. Prefer **server-only** for this event in RSOC.  
- **Other events** (Search, ViewContent, Lead…): can be Pixel or CAPI; be consistent.

---

## 5) SOP — Configure AEM (agent-executable)

1. **Verify domain**
   - Navigate: Events Manager → **Brand Safety / Domains** → Add domain → complete verification.
   - Output: `domain_verified = true`.

2. **Select pixel & domain for AEM**
   - Events Manager → **Web Events** (Aggregated Event Measurement) → **Configure Web Events**.
   - Choose `pixel_id` + `domain_name`.

3. **Set priority order**
   - Add **Purchase** at **rank 1** (value enabled).
   - Add only events you actively send (max 8).
   - Save & publish changes → note `aem_config_version`.

4. **Validate eligibility**
   - Confirm **Purchase** appears as **Eligible** in ad-set optimization dropdown (Sales objective).
   - Fire a test **CAPI Purchase**; check Diagnostics for receipt and EMQ score.

5. **Document**
   - Write back `aem_priority_list` and `events_eligible_count` to the repo/run log.

---

## 6) Change management

- **Batch edits**: make AEM changes **at most once per week** to avoid repeated delivery variance.  
- **Before scaling**: lock AEM for the week—don’t reorder during a budget bump window.  
- **Rollback plan**: store the last good `aem_priority_list` and revert if performance dips post-change.

---

## 7) Health checks & alerts

**Daily (automated):**
- `events_eligible_count` unchanged from baseline.  
- **Purchase** remains at rank **1** and shows **Eligible**.  
- No diagnostics warnings for missing permissions or mismatched domains.

**Alerts (Slack/email):**
- **Priority drift** detected (Purchase not rank 1).  
- **Eligibility loss** for Purchase on target domain.  
- Repeated diagnostics errors (dedup failures, invalid parameters).

---

## 8) Common pitfalls & fixes

- **Multiple pixels on one domain** → ensure the correct pixel is selected in AEM; disable stray Purchase firing from other pixels.  
- **Custom events with similar names** → use standard event names where possible; document custom ones clearly.  
- **Proxy events at higher rank than Purchase** → demote them; keep Purchase #1.  
- **Frequent reorders** → batch weekly; repeated changes induce delivery noise.  
- **Unverified subdomains** → verify the parent domain; ensure events resolve to that domain context.

---

## 9) Testing matrix (before/after change)

| Test | Method | Pass criteria |
|---|---|---|
| Domain verification | Events Manager | Status = **Verified** |
| Purchase eligibility | Ad-set optimization pane | **Purchase** available & selectable |
| Event receipt | Test Events / Diagnostics | CAPI `Purchase` received with value; EMQ ≥ 5 |
| Controlled spend check | 48–72h after change | CPA drift ≤ +5%; no unexpected “Learning Limited” spikes |
| Session ROAS sanity | GA4/BigQuery | Stable vs prior 3–5 days (outside normal variance) |

---

## 10) Acceptance criteria (definition of done)

- `domain_verified = true`  
- `aem_priority_list[0] == "Purchase"` (value-enabled)  
- `events_eligible_count <= 8` and all listed events are **actually fired**  
- Ad sets for Sales objective can **optimize to Purchase (Value)**  
- No blocking diagnostics; EMQ median ≥ **5**

---

## 11) Cross-refs

- **CAPI payload & timing:** `/20-infra/20-capi-setup.md`  
- **LPID/UTM enforcement:** `/20-infra/22-lpid-utm-tracking.md`  
- **Budget-bump guardrails:** `/60-operations/62-budget-bump-protocol.md`