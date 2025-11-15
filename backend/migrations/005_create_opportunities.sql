-- Migration: Create opportunities table
-- Created: 2025-01-XX
-- Purpose: Store scored opportunities from System1 and Facebook discovery

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'system1' | 'facebook_pipeline'
  angle VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  
  -- Revenue metrics
  revenue_potential DECIMAL,
  rpc_floor DECIMAL,
  confidence_score DECIMAL,
  
  -- Data
  keywords JSONB,
  states JSONB,
  top_keywords JSONB, -- Array of {keyword, revenue, rpc}
  top_slugs JSONB,    -- Array of {slug, revenue, clicks}
  
  -- ΔCM estimates
  predicted_delta_cm DECIMAL,
  recommended_budget DECIMAL,
  
  -- Blueprint requirements
  recommended_lane_mix JSONB, -- {asc: %, lal: %, interest: %}
  
  -- Risk flags
  overlap_risk VARCHAR(20), -- 'low' | 'medium' | 'high'
  geo_conflicts TEXT[],
  audience_conflicts TEXT[],
  
  -- Test plan
  freeze_window_hours INTEGER,
  success_threshold_cpa DECIMAL,
  kill_threshold_cpa DECIMAL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'launched' | 'rejected'
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_angle ON opportunities(angle);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_confidence ON opportunities(confidence_score);
CREATE INDEX IF NOT EXISTS idx_opportunities_predicted_delta_cm ON opportunities(predicted_delta_cm DESC);

