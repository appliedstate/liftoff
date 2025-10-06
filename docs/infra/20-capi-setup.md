---
id: infra/capi-setup
version: 1.0.0
owner: growth
runtime_role: agent
dependencies:
  - infra/aem-priority
  - infra/lpid-utm-tracking
  - content/article-factory
inputs:
  - pixel_id
  - graph_api_version            # e.g., v19.0 (keep in one place)
  - system_user_access_token     # stored in secrets manager
  - lpid                         # landing-page id in URL/querystring
  - advertiser_click_value_usd   # real or predicted USD value
  - user_match_keys              # em, ph (hashed), client_ip, client_user_agent, fbc, fbp, external_id
outputs:
  - events_processed
  - purchases_per_day
  - event_match_quality          # EMQ 0–10
  - event_latency_seconds        # median time from money moment → event receipt
  - dedup_rate                   # % of events dropped by event_id dedup
kpis:
  on_time_delivery_p50: "<= 300s"         # send within 5 minutes; absolute max 7 days backdate
  emq_target: ">= 5"
  learning_events_per_adset_per_week: ">= 50"
  session_roas_target: ">= 1.30x"
guards:
  - "Never send raw PII; hash em/ph using SHA-256 lowercase trimmed."
  - "Do not fire a placeholder Purchase that will be 'fixed' later; send once with final or predicted value."
  - "If both Pixel and CAPI fire, use the same event_id for proper dedup."
  - "Backdate event_time only when necessary; keep delays < 24h; hard max 7 days."
  - "Respect user consent/region policies; log consent state with the event if applicable."
---

# Conversions API (CAPI) Setup — Desired Output Workflow

**Objective:**  
Send a single **Purchase** event (with **USD value**) to Meta **server-to-server** at the RSOC *money moment* (advertiser click), with strong match keys and minimal latency. This “feeds” the bidder with value-dense signals so ASC/ABO can scale on profit, not proxies.

---

## 1) Architecture (money-flow)

**FB Ad Click → Article (LPID) → RSOC Advertiser Click (money moment) → CAPI Purchase (value) → Optimization & Attribution**

- **When:** on **advertiser click** inside the article (top/mid/end widget).
- **What:** one server-side `Purchase` event with `custom_data.value = advertiser_click_value_usd`.
- **Where:** POST to `https://graph.facebook.com/{graph_api_version}/{pixel_id}/events`.

**⚠️ Dedup rule:**  
If a browser Pixel also fires a `Purchase`, **use the same `event_id`** on both. Meta keeps the first and drops duplicates. Prefer *server-only* for this event to avoid value loss.

---

## 2) Data model (CAPI payload)

```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1730582400,                      // unix seconds (UTC). Backdate only if needed.
    "event_id": "rsoc-advclick-8e3f2a0b...",       // stable UUID; also used by any pixel event for dedup
    "action_source": "website",
    "event_source_url": "https://example.com/article?lpid=A-101&utm_source=fb&utm_medium=cpc",
    "user_data": {
      "em": ["<sha256_lower(email)>"],
      "ph": ["<sha256_lower(phone)>"],
      "client_ip_address": "203.0.113.24",
      "client_user_agent": "Mozilla/5.0 ...",
      "fbc": "fb.1.1699999999.ABCD...",
      "fbp": "fb.1.1699999999.1234567890",
      "external_id": "user_or_click_guid_123"
    },
    "custom_data": {
      "currency": "USD",
      "value": 1.47,
      "content_name": "rsoc: auto-insurance | young-driver-discounts"
    }
  }],
  "test_event_code": "<optional_for_sandbox>"
}