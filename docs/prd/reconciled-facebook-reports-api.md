# Reconciled Facebook Reports API

This document defines the OpenAPI 3.1 specification for the reconciled daily report used by Terminal to manage Meta campaign/ad set budgets and bid caps.

```yaml
openapi: 3.1.0
info:
  title: Reconciled Facebook Reports API
  version: 1.0.0
  description: |
    Returns reconciled, per-entity daily performance needed by Terminal to manage Meta campaign/ad set budgets and bid caps.
    Monetary values are normalized to USD. Dates align to account timezone.
  x-sla:
    readiness_local_time: "07:00"
    idempotent: true
servers:
  - url: https://strateg.is/api
    description: Primary
  - url: https://staging.strateg.is/api
    description: Staging
security:
  - bearerAuth: []
tags:
  - name: reports
    description: Reporting endpoints
paths:
  /v1/facebook/reports/reconciled:
    get:
      tags: [reports]
      summary: Get reconciled daily performance
      description: Returns reconciled per-entity (ad set or campaign) performance for a given date.
      operationId: getReconciledFacebookReport
      parameters:
        - name: date
          in: query
          description: Target date in account timezone (default is yesterday in each account’s timezone).
          required: false
          schema:
            type: string
            format: date
        - name: level
          in: query
          description: Reporting level. When campaign, adset_id/adset_name are null.
          required: false
          schema:
            type: string
            enum: [adset, campaign]
            default: adset
        - name: account_ids
          in: query
          description: Filter by Meta ad account IDs. Comma-separated or repeated.
          required: false
          style: form
          explode: false
          schema:
            type: array
            items: { type: string }
        - name: owner
          in: query
          description: Filter by owner label (e.g., ben, tj, dan, mike, anastasia).
          required: false
          schema:
            type: string
        - name: lane
          in: query
          description: Filter by lane label.
          required: false
          schema:
            type: string
            enum: [ASC, LAL_1, LAL_2_5, Contextual, Sandbox, Warm]
        - name: category
          in: query
          description: Filter by business/category tag.
          required: false
          schema:
            type: string
        - name: timezone
          in: query
          description: IANA timezone name; if omitted, each row uses its account timezone for date alignment.
          required: false
          schema:
            type: string
        - name: limit
          in: query
          description: Page size.
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 5000
            default: 1000
        - name: cursor
          in: query
          description: Pagination cursor returned by previous request.
          required: false
          schema:
            type: string
      responses:
        "200":
          description: Reconciled report rows
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ReconciledReportResponse"
              examples:
                sample:
                  value:
                    meta:
                      date: "2025-10-21"
                      level: "adset"
                      timezone: "America/Chicago"
                      currency: "USD"
                      generated_at: "2025-10-22T07:02:11Z"
                      source: "strategis_reconciled"
                      next_cursor: null
                    data:
                      - date: "2025-10-21"
                        level: "adset"
                        account_id: "act_123456789"
                        campaign_id: "120000000000001"
                        adset_id: "238600000000001"
                        campaign_name: "DentalImplantTrials_FB_HB_BH"
                        adset_name: "ASC_Scalers_A_B_C"
                        owner: "ben"
                        lane: "ASC"
                        category: "DentalImplantClinicalTrials"
                        objective: "SALES"
                        optimization_goal: "PURCHASE"
                        currency: "USD"
                        spend_usd: 710.35
                        revenue_usd: 994.0
                        net_margin_usd: 283.65
                        margin_rate: 0.3991
                        roas: 1.3999
                        impressions: 142000
                        clicks: 1850
                        sessions: 820
                        conversions: 38
                        is_reconciled: true
                        reconciled_through_date: "2025-10-21"
                        data_freshness_ts: "2025-10-22T07:02:11Z"
                        supports_bid_cap: true
                        supports_budget_change: true
                        delivery_status: "ACTIVE"
                        learning_phase: "STABLE"
                        attribution_window_days: 7
                        source: "strategis_reconciled"
                        ingestion_run_id: "run_2025-10-22T07:00Z_abc123"
            text/csv:
              schema:
                type: string
                description: CSV with header matching ReconciledReportRow fields.
              examples:
                header_only:
                  value: >-
                    date,level,account_id,campaign_id,adset_id,campaign_name,adset_name,owner,lane,category,objective,optimization_goal,currency,spend_usd,revenue_usd,net_margin_usd,margin_rate,roas,impressions,clicks,sessions,conversions,is_reconciled,reconciled_through_date,data_freshness_ts,supports_bid_cap,supports_budget_change,delivery_status,learning_phase,attribution_window_days,source,ingestion_run_id
        "400":
          description: Bad request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
        "429":
          description: Too many requests
          headers:
            Retry-After:
              description: Seconds to wait before retrying.
              schema: { type: integer }
        "503":
          description: Service unavailable
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    ReconciledReportResponse:
      type: object
      required: [meta, data]
      properties:
        meta:
          $ref: "#/components/schemas/ReconciledReportMeta"
        data:
          type: array
          items:
            $ref: "#/components/schemas/ReconciledReportRow"
    ReconciledReportMeta:
      type: object
      required: [date, level, currency, generated_at, source]
      properties:
        date:
          type: string
          format: date
          description: The requested date or effective date context.
        level:
          type: string
          enum: [adset, campaign]
        timezone:
          type: string
          description: IANA timezone for the meta context; rows may reflect account tz if unspecified.
        currency:
          type: string
          enum: [USD]
        generated_at:
          type: string
          format: date-time
        source:
          type: string
          enum: [strategis_reconciled]
        next_cursor:
          type: [string, "null"]
    ReconciledReportRow:
      type: object
      required:
        - date
        - level
        - account_id
        - campaign_id
        - campaign_name
        - owner
        - lane
        - currency
        - spend_usd
        - revenue_usd
        - net_margin_usd
        - margin_rate
        - roas
        - impressions
        - clicks
        - sessions
        - conversions
        - is_reconciled
        - reconciled_through_date
        - data_freshness_ts
        - supports_budget_change
      properties:
        date: { type: string, format: date }
        level:
          type: string
          enum: [adset, campaign]
        account_id: { type: string, description: "Meta ad account id (e.g., act_123...)" }
        campaign_id: { type: string }
        adset_id: { type: [string, "null"] }
        campaign_name: { type: string }
        adset_name: { type: [string, "null"] }
        owner: { type: string }
        lane:
          type: string
          enum: [ASC, LAL_1, LAL_2_5, Contextual, Sandbox, Warm]
        category: { type: string }
        objective: { type: string }
        optimization_goal: { type: string }
        currency:
          type: string
          enum: [USD]
        spend_usd: { type: number }
        revenue_usd: { type: number }
        net_margin_usd: { type: number }
        margin_rate: { type: number }
        roas: { type: number }
        impressions: { type: integer }
        clicks: { type: integer }
        sessions: { type: integer }
        conversions: { type: integer }
        is_reconciled: { type: boolean }
        reconciled_through_date: { type: string, format: date }
        data_freshness_ts: { type: string, format: date-time }
        supports_bid_cap: { type: boolean, default: false }
        supports_budget_change: { type: boolean, default: true }
        delivery_status:
          type: string
          enum: [ACTIVE, PAUSED, LEARNING, LEARNING_LIMITED, NOT_DELIVERING, SCHEDULED]
        learning_phase:
          type: string
          enum: [LEARNING, STABLE, LEARNING_LIMITED, NOT_LEARNING]
        attribution_window_days: { type: integer }
        source:
          type: string
          enum: [strategis_reconciled]
        ingestion_run_id: { type: string }
    Error:
      type: object
      properties:
        code: { type: string }
        message: { type: string }
      required: [code, message]
```

Notes:
- JSON and CSV are both supported response formats.
- Uniqueness per row: `(date, level, account_id, campaign_id[, adset_id])`.
- SLA: data ready by 07:00 local; `is_reconciled=true` implies final for that date.
