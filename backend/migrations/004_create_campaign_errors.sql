-- Migration: Create campaign_errors table
-- Created: 2025-01-XX
-- Purpose: Store error logs for debugging

CREATE TABLE IF NOT EXISTS campaign_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_plan_id UUID REFERENCES campaign_plans(id) ON DELETE SET NULL,
  campaign_mapping_id UUID REFERENCES campaign_mappings(id) ON DELETE SET NULL,
  request_id VARCHAR(255),
  
  step VARCHAR(100) NOT NULL,        -- Which step failed
  error_type VARCHAR(100),
  error_message TEXT NOT NULL,
  error_details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_errors_campaign_plan_id ON campaign_errors(campaign_plan_id);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_request_id ON campaign_errors(request_id);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_step ON campaign_errors(step);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_created_at ON campaign_errors(created_at);

