-- Migration: Create campaign_mappings table
-- Created: 2025-01-XX
-- Purpose: Store ID mappings between Liftoff, Strategis, and Facebook

CREATE TABLE IF NOT EXISTS campaign_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_plan_id UUID NOT NULL REFERENCES campaign_plans(id) ON DELETE CASCADE,
  request_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Strategis IDs
  strategis_template_id VARCHAR(255),
  strategis_campaign_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  
  -- Facebook IDs
  facebook_campaign_id VARCHAR(255),
  facebook_ad_set_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  facebook_creative_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  facebook_ad_ids VARCHAR(255)[] NOT NULL DEFAULT '{}',
  
  -- Tracking URLs
  tracking_urls TEXT[] NOT NULL DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_mappings_campaign_plan_id ON campaign_mappings(campaign_plan_id);
CREATE INDEX IF NOT EXISTS idx_campaign_mappings_request_id ON campaign_mappings(request_id);
CREATE INDEX IF NOT EXISTS idx_campaign_mappings_facebook_campaign_id ON campaign_mappings(facebook_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_mappings_status ON campaign_mappings(status);

