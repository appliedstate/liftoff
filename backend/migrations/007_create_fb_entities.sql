-- Migration: Create Facebook entity tables for launch indexing
-- Purpose: Persist campaigns, ad sets, and ads with first/last seen timestamps
-- Depends on: none

CREATE TABLE IF NOT EXISTS fb_campaigns (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  created_time TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL,
  first_spend_at TIMESTAMPTZ,
  first_session_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL,
  baseline BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_fb_campaigns_account ON fb_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_fb_campaigns_first_seen ON fb_campaigns(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_fb_campaigns_last_seen ON fb_campaigns(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_fb_campaigns_baseline ON fb_campaigns(baseline);

CREATE TABLE IF NOT EXISTS fb_adsets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES fb_campaigns(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  created_time TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL,
  first_spend_at TIMESTAMPTZ,
  first_session_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL,
  baseline BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_fb_adsets_campaign ON fb_adsets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_adsets_account ON fb_adsets(account_id);
CREATE INDEX IF NOT EXISTS idx_fb_adsets_first_seen ON fb_adsets(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_fb_adsets_last_seen ON fb_adsets(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_fb_adsets_baseline ON fb_adsets(baseline);

CREATE TABLE IF NOT EXISTS fb_ads (
  id TEXT PRIMARY KEY,
  adset_id TEXT REFERENCES fb_adsets(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES fb_campaigns(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  created_time TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL,
  first_spend_at TIMESTAMPTZ,
  first_session_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL,
  baseline BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_fb_ads_adset ON fb_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_campaign ON fb_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_account ON fb_ads(account_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_first_seen ON fb_ads(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_fb_ads_last_seen ON fb_ads(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_fb_ads_baseline ON fb_ads(baseline);




