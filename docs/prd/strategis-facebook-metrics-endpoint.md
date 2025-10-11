# PRD: Strateg.is Facebook Metrics & Scaling Automation

## Overview
Build automated reporting endpoint for Facebook campaign performance metrics, launch tracking, and intelligent scaling recommendations to support $5K/day margin objective.

## Problem Statement
Currently, buyers manually pull reports from strateg.is and make scaling decisions based on intuition. This limits:
- Scaling velocity (decisions take hours instead of minutes)
- Consistency (ROAS rules not uniformly applied)
- Visibility (no automated alerts for opportunities/threats)
- Optimization (no historical trend analysis)

## Solution
Strateg.is endpoint that provides:
1. **Real-time metrics dashboard** with daily/weekly performance
2. **Launch tracking** with hit rates and time-to-decision analytics
3. **Automated scaling alerts** based on ROAS rules
4. **Budget optimization recommendations** with suggested moves

## Target Users
- **Buyers** (Ben, TJ, Dan, Mike): Daily performance monitoring, scaling decisions
- **AI Manager**: Weekly check-ins, performance analysis
- **Terminal**: Automated campaign management and alerts

## Requirements

### Functional Requirements

#### 1. Metrics Dashboard API
**Endpoint**: `GET /api/facebook/metrics/dashboard`

**Parameters**:
- `date_range`: "yesterday" | "7d" | "30d" | "custom"
- `owner`: "all" | "ben" | "tj" | "dan" | "mike" | "anastasia"
- `campaign_filter`: "all" | "active" | "scaling" | "losers"

**Response**:
```json
{
  "summary": {
    "total_spend": 8236.00,
    "total_revenue": 10253.00,
    "total_margin": 2017.00,
    "margin_rate": 0.245,
    "active_campaigns": 45,
    "positive_margin_campaigns": 32
  },
  "by_owner": [
    {
      "owner": "ben",
      "spend": 4267.00,
      "margin": 1137.00,
      "top_campaigns": ["simt3jv06u3", "sifwtl0648"],
      "scaling_opportunities": 3
    }
  ],
  "top_performers": [
    {
      "campaign_id": "simt3jv06u3",
      "name": "DentalImplantTrials_FB_HB_BH",
      "owner": "ben",
      "spend": 710.35,
      "margin": 278.40,
      "roas": 139.2,
      "recommendation": "scale_40_percent"
    }
  ]
}
```

#### 2. Launch Analytics API
**Endpoint**: `GET /api/facebook/metrics/launches`

**Parameters**:
- `weeks`: 1 | 4 | 12
- `owner`: "all" | specific

**Response**:
```json
{
  "period": "2025-W41",
  "total_launched": 23,
  "break_even_rate": 0.43,
  "avg_time_to_decision": "3.2 days",
  "by_owner": [
    {
      "owner": "tj",
      "launched": 8,
      "successful": 4,
      "avg_roas_72h": 118.5
    }
  ],
  "category_performance": {
    "DentalImplantClinicalTrials": {
      "launched": 18,
      "success_rate": 0.50,
      "avg_first_margin": 85.30
    }
  }
}
```

#### 3. Scaling Alerts API
**Endpoint**: `GET /api/facebook/alerts/scaling`

**Response**: Array of actionable alerts
```json
[
  {
    "type": "scale_up",
    "priority": "high",
    "campaign_id": "simt3jv06u3",
    "owner": "ben",
    "current_roas": 139,
    "recommendation": "increase_budget_40_percent",
    "potential_margin_gain": 111.36,
    "reason": "ROAS >130% for 3+ days"
  },
  {
    "type": "cut_loss",
    "priority": "medium",
    "campaign_id": "si4y3i5060p",
    "owner": "mike",
    "current_roas": 45,
    "recommendation": "pause_campaign",
    "reason": "ROAS <80% for 5 days, negative margin"
  }
]
```

#### 4. Budget Optimization API
**Endpoint**: `POST /api/facebook/optimize/budget`

**Request**:
```json
{
  "total_budget": 12000,
  "optimization_goal": "max_margin",
  "constraints": {
    "min_roas": 80,
    "max_daily_spend_per_campaign": 1000
  }
}
```

**Response**:
```json
{
  "recommendations": [
    {
      "campaign_id": "simt3jv06u3",
      "current_budget": 710,
      "recommended_budget": 994,
      "expected_margin_gain": 111,
      "confidence": 0.85
    },
    {
      "campaign_id": "si8xed06p3",
      "current_budget": 91,
      "recommended_budget": 0,
      "reason": "reallocate_to_winners"
    }
  ],
  "expected_total_margin": 5200,
  "expected_total_spend": 18000
}
```

### Technical Requirements

#### Data Sources
- **Primary**: Strateg.is reconciled reports (daily CSV exports)
- **Secondary**: Facebook Ads API (for real-time spend/budget data)
- **Fallback**: Local database cache with 24hr TTL

#### Performance
- **Latency**: <2 seconds for dashboard queries
- **Availability**: 99.9% uptime
- **Data freshness**: <1 hour lag
- **Concurrent users**: Support 10+ simultaneous buyers

#### Security
- **Authentication**: JWT tokens with role-based access
- **Data privacy**: No PII storage, aggregated metrics only
- **Audit logging**: All budget changes and recommendations logged

## Implementation Plan

### Phase 1: Core Metrics Pipeline (Week 1)
1. CSV ingestion and parsing
2. Basic dashboard API
3. Daily summary calculations
4. Owner-level aggregations

### Phase 2: Launch Analytics (Week 2)
1. Campaign launch tracking
2. Success rate calculations
3. Time-to-decision metrics
4. Category performance analysis

### Phase 3: Intelligent Alerts (Week 3)
1. ROAS-based scaling rules
2. Automated alert generation
3. Priority scoring
4. Alert delivery (email/webhook)

### Phase 4: Budget Optimization (Week 4)
1. Optimization algorithm development
2. Budget allocation recommendations
3. Confidence scoring
4. A/B testing framework

## Success Metrics
- **Adoption**: 100% buyers using daily dashboard
- **Efficiency**: 50% faster scaling decisions
- **Impact**: $500+/day margin improvement from automated recommendations
- **Accuracy**: 80%+ recommendation accuracy (measured vs actual outcomes)

## Dependencies
- Strateg.is API access for automated data pulls
- Facebook Ads API integration for real-time data
- Terminal integration for alert delivery
- Human control system for buyer feedback loop

## Risk Mitigation
- **Data quality**: Manual CSV upload fallback if API fails
- **Alert fatigue**: Configurable alert thresholds per buyer
- **False positives**: Human override capability with feedback loop
- **Platform changes**: Versioned API contracts with change detection

