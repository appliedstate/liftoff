# Identity & Audience Graph (PII‑free) — PRD

Status: draft
Owner: Eric
Stakeholders: Ads Eng, Signals, Compliance, Ops
Related: docs/finance/public/intent-engine-bidder-plan.md, docs/prd/facebook-category-discovery-pipeline.md

## Overview
- Goal: build and activate topic-based audiences across platforms without PII by using existing Strategis Zone capabilities and System1 pixel firing.
- Method: standardize intent parameters at the Zone level, fire multi-platform pixels on landing and conversion, build pixel/website audiences in each destination (Taboola, Outbrain, MediaGo, NewsBreak, Meta, TikTok, etc.), and expand via Similar/Lookalike where available.

## Zone configuration (single source of truth for intent)
- Set `dataAttributesDefault` per Zone to stamp every event/pageview with consistent intent metadata.
```json
{
  "dataAttributesDefault": {
    "intent_category": "business_accounting",
    "hook_id": "acct_sw_1"
  }
}
```
- Server merges these into options (propagated to client renderers and the Zone iframe). Mustache variables become available as `{{intent_category}}`, `{{hook_id}}`, `{{campaignId}}`, `{{zoneId}}`.

## Pixel templates (iframe examples)
- Meta Pixel (PageView with intent params)
```html
<script>
  fbq('init', 'YOUR_META_PIXEL_ID');
  fbq('trackCustom', 'PageView', {
    intent_category: '{{intent_category}}',
    hook_id: '{{hook_id}}',
    campaign_id: '{{campaignId}}',
    zone_id: '{{zoneId}}'
  });
</script>
```
- Taboola Pixel (event with intent params)
```html
<script type="text/javascript">
  window._tfa = window._tfa || [];
  _tfa.push({notify: 'event', name: 'page_view', id: YOUR_TABOOLA_PIXEL_ID, params: {
    intent_category: '{{intent_category}}',
    hook_id: '{{hook_id}}'
  }});
}</script>
```
- Outbrain Pixel (custom event)
```html
<script>
  window.obApi = window.obApi || function(){(obApi.q = obApi.q || []).push(arguments)};
  obApi('track', 'PageView', { intent_category: '{{intent_category}}', hook_id: '{{hook_id}}' });
</script>
```

## Audience build steps per platform (no PII path)
- Taboola
  - Install Taboola Pixel sitewide (consent-gated). Fire page events with `intent_category`/`hook_id`.
  - Create My Audiences: rule on URL contains `intent_category=…` or pixel param equals value; window 30–60d; exclude converters.
  - Expansion: create Similar/Lookalike from the pixel audience (if enabled); add contextual site/category targeting.
- Outbrain
  - Install Outbrain pixel, fire PageView with intent params.
  - Create retargeting audience from pixel rules; exclude converters; expansion via Similar/Interest overlays.
- MediaGo / NewsBreak
  - Use their site pixel/retargeting audience tools; seed via pageview events on your landings with intent params.
  - Expansion via topic/category and site lists; Similar where available.
- Meta / TikTok (for cross-platform retention)
  - Website audiences: build on Pixel/CAPI params (e.g., `intent_category == business_accounting`).
  - Expansion via Lookalike/Similar from the website audience.

## URL parameters and macros (for consistency and joinability)
- Add intent parameters to ad links (all sources): `?intent_category=business_accounting&hook_id=acct_sw_1`.
- For Taboola campaigns, append macros to landing URLs to aid attribution to Strategis: `?utm_source=taboola&utm_campaign={campaign_id}&utm_content={campaign_item_id}&clk={click_id}&pub={site_id}&seg={{intent_category}}`.

## QA checklist
- Pixels
  - Pixels load only after consent (region-aware CMP); PageView/custom events include `intent_category` and `hook_id`.
  - Verify in platform debuggers (Meta Pixel Helper, Taboola Pixel helper, etc.).
- Events & Params
  - Confirm uniform param casing/names across platforms.
  - Ensure conversion events fire with exclusions configured in audiences.
- Audiences
  - Create audiences in each platform; confirm rules; check membership growth to minimum thresholds.
  - Validate exclusions (recent converters) to reduce fatigue.
- Attribution
  - Confirm Taboola macros populate (`click_id`, `site_id`); join back to Strategis session logs.
- Privacy
  - CMP blocks non-essential pixels until consent; GPC honored; no PII stored client-side.

## Rollout plan
- Week 0–1: Configure Zones with `dataAttributesDefault`; deploy pixels sitewide (consent-gated); add URL params.
- Week 2: Create platform audiences; verify population; set exclusions.
- Week 3: Launch retargeting in Taboola/Outbrain; monitor size, CPA, ROAS; set frequency caps.
- Week 4–6: Create Similar/Lookalike audiences; layer contextual/site lists; iterate creatives by topic.

## Compliance and safeguards
- No PII path: do not upload emails/phones; only pixel-based audiences.
- Respect platform minimum audience sizes; no 1:1 targeting; no fingerprinting.
- Safari ITP/ad blockers reduce coverage—accept reduced scale; consider server-side events (Meta/TikTok) with `external_id` as a hashed `fpuid` (non-PII) where allowed.


