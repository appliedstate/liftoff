# System1 RAMP Content Generator Integration Notes

## Purpose

Capture the currently verified findings about System1's RAMP content generator and Strategist's mirrored RAMP flow so Liftoff can build against the real backend contract instead of depending on a frontend app.

## Sources

- Live Strategist UI inspection on `2026-04-28`
- Live System1 RAMP Partner UI inspection on `2026-04-28`
- System1 guide: `RAMP Partner Content Generator Guide.pdf`
- System1 guide: `RSOC Online Partner Documentation`
- Deployed frontend chunk inspection for:
  - `strategis.vercel.app`
  - `partner.system1.com`

## Main Conclusion

Liftoff should not automate Lian's Vercel app and should not automate the System1 browser UI.

The correct production target is one of:

1. `Liftoff -> Strategist backend/service`
2. `Liftoff -> System1 backend/service`

The browser apps are useful only as reference implementations.

## What Strategist Confirms

Strategist has a frontend RAMP flow that mirrors System1's content generator.

Confirmed endpoints in the deployed Strategist frontend:

- `GET /api/ramp/articles`
- `GET /api/ramp/domains`
- `POST /api/ramp/generate`

Observed Strategist request shape:

```json
{
  "domain": "trivia-library.com",
  "prompts": [
    {
      "marketing_angle": "How to get a high school diploma online in your spare time",
      "topic": "high school diploma",
      "target_language": "en",
      "target_geo": "US"
    }
  ]
}
```

Observed Strategist response model from the RAMP table includes fields such as:

- `id`
- `domain`
- `topic`
- `marketing_angle`
- `target_language`
- `target_geo`
- `publication_link`
- `status`
- `created_at`
- `submitted_by_name`

Important behavior:

- `Copy into new article draft` is not a separate draft creation API.
- It reopens the same RAMP request modal with a prior request prefilled.

## What System1 Confirms

The System1 Content Generator page is a Next.js app with server-side actions, not a plain form submit.

Confirmed server-side references in the deployed System1 frontend:

- `sendSubmitPrompt`
- `sendSubmitPrompts`
- `sendGetSiteRequest`
- `sendValidateHeadline`
- `sendGetPartner`

Confirmed report fetch pattern:

- `reports/api-reports?report_type=content_generation_prompts&partner=...`

Confirmed single-generation request object built in the frontend:

```json
{
  "caller": "Ramp Partner",
  "partner_id": 0,
  "backend": "dataiku",
  "domain": "domain.com",
  "site_id": "site-id",
  "marketing_angle": "USP or angle",
  "topic": "topic",
  "headline": "optional final title",
  "target_language": "en",
  "target_geo": "US"
}
```

Confirmed bulk-generation path:

- CSV upload supported
- UTF-8 required
- frontend converts rows into prompt objects and submits them in a batch

## Product Constraints From System1 Guide

Confirmed from `RAMP Partner Content Generator Guide.pdf`:

- Supports only `standard article` formats
- Does not support `listicles`, `paginated content`, or pages with specific product-offer widgets
- Daily usage limit is `50 content generation requests per day`
- Domain dropdown is restricted to domains associated with the partner account
- `Topic` is required and should be a keyword-like topic, not a broad vertical
- `Marketing Angle` is required and acts as the USP/angle used alongside the topic
- `Article Title` is optional
- If `Article Title` is populated, it is used instead of `Marketing Angle` for content generation and is passed through as the final title
- `Article Title` must be in the target language
- `Article Title` has a `60 character` limit
- Certain terms and all currency symbols are blocked in the title field
- Failure reasons include:
  - `Insufficient scraped source articles (< 3)`
  - `Blocked input`

Observed compliance restrictions from the guide:

- Inputs related to `crypto`
- `violence`
- `adult content`
- `gambling`

may be blocked.

## RSOC Documentation That Matters Downstream

Confirmed from `RSOC Online Partner Documentation`:

- `forceKeyA` through `forceKeyF` should be supplied to influence RSOC terms
- `headline` is required for paid referral traffic
- `headline` should represent the buyside ad headline
- landing URLs should carry reporting and tracking parameters such as:
  - `segment`
  - `utm_source`
  - `s1paid`
  - `s1pcid`
  - `s1pagid`
  - `s1pplacement`
  - `s1padid`
  - `s1particle`

This matters because article generation is only one part of the launch chain. The final article URL must still be paired with RSOC keyword and tracking construction.

## Liftoff Architecture Implication

`marketing_angle` should not be treated as a freeform field owned by a buyer.

It should be derived from the intent packet.

Recommended source of truth:

- `primary intent keyword`
- `supporting keywords`
- `article topic`
- `marketing angle`
- `optional article title`
- `target geo`
- `target language`
- `rsoc target keywords`

Recommended internal contract:

```ts
type IntentPacketArticleRequest = {
  packetId: string
  primaryIntentKeyword: string
  supportingKeywords: string[]
  articleTopic: string
  marketingAngle: string
  articleTitle?: string
  rsocTargetKeywords: string[]
  geo: string
  language: string
  domain?: string
}
```

Mapping to System1-style payload:

```ts
{
  caller: "Liftoff",
  partner_id,
  backend: "dataiku",
  domain,
  site_id,
  marketing_angle: request.marketingAngle,
  topic: request.articleTopic,
  headline: request.articleTitle ?? "",
  target_language: request.language,
  target_geo: request.geo,
}
```

## Recommendation

Prefer a direct backend integration over UI imitation.

Order of preference:

1. Use a documented Strategist backend/service if one exists and is already production-supported.
2. Otherwise integrate directly with the System1 backend/service that powers the partner UI.
3. Do not build against Lian's Vercel frontend.
4. Do not build browser automation for the System1 page except as a temporary diagnostic tool.

## Open Questions

- What is the stable server-to-server contract for content generation?
- Is there a documented Strategist backend for RAMP generation, or only the Vercel app wrapper?
- Can Liftoff obtain direct access to the System1 backend that powers `sendSubmitPrompt` / `sendSubmitPrompts`?
- What is the durable request ID returned by the generation flow?
- How should Liftoff poll or receive completion status?
- What is the exact success response shape for the final live article URL?
- What domain and partner metadata should Liftoff store locally?

