-- Migration: Create campaign_requests table
-- Created: 2025-01-XX
-- Purpose: Track requests for idempotency

CREATE TABLE IF NOT EXISTS campaign_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  client_request_key VARCHAR(255) UNIQUE,
  
  campaign_plan_id UUID REFERENCES campaign_plans(id) ON DELETE SET NULL,
  campaign_mapping_id UUID REFERENCES campaign_mappings(id) ON DELETE SET NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  step VARCHAR(100),                  -- Current step in creation process
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_requests_client_request_key ON campaign_requests(client_request_key);
CREATE INDEX IF NOT EXISTS idx_campaign_requests_status ON campaign_requests(status);
CREATE INDEX IF NOT EXISTS idx_campaign_requests_request_id ON campaign_requests(request_id);

