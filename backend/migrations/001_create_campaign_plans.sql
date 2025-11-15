-- Migration: Create campaign_plans table
-- Created: 2025-01-XX
-- Purpose: Store campaign plan data from Attention Engine

CREATE TABLE IF NOT EXISTS campaign_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Campaign Metadata
  brand VARCHAR(255) NOT NULL,
  objective VARCHAR(100) NOT NULL,
  hook_set_id VARCHAR(255) NOT NULL,
  market VARCHAR(10) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  
  -- Account & Organization
  ad_account_id VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  
  -- Tracking Configuration
  domain VARCHAR(255) NOT NULL,
  destination VARCHAR(50) NOT NULL,
  strategis_template_id VARCHAR(255),
  
  -- Generated Names
  campaign_name TEXT NOT NULL,
  ad_set_names TEXT[] NOT NULL DEFAULT '{}',
  ad_names TEXT[][] NOT NULL DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_plans_request_id ON campaign_plans(request_id);
CREATE INDEX IF NOT EXISTS idx_campaign_plans_hook_set_id ON campaign_plans(hook_set_id);
CREATE INDEX IF NOT EXISTS idx_campaign_plans_status ON campaign_plans(status);
CREATE INDEX IF NOT EXISTS idx_campaign_plans_organization ON campaign_plans(organization);

