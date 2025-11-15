-- Migration: Create campaign_blueprints table
-- Created: 2025-01-XX
-- Purpose: Store campaign blueprints generated from opportunities

CREATE TABLE IF NOT EXISTS campaign_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  
  -- Blueprint metadata
  vertical VARCHAR(100),
  angle VARCHAR(255),
  campaign_name VARCHAR(500),
  
  -- Structure
  lane_mix JSONB, -- {asc: %, lal: %, interest: %}
  budget_plan JSONB, -- Budget allocation per lane
  targeting JSONB, -- Geo, audiences, etc.
  
  -- Creative requirements
  creative_requirements JSONB, -- Hooks, formats, LPIDs needed
  kpi_targets JSONB, -- ROAS ≥1.30, EMQ ≥5, etc.
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'launched'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  launched_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_opportunity_id ON campaign_blueprints(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_status ON campaign_blueprints(status);
CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_vertical ON campaign_blueprints(vertical);

