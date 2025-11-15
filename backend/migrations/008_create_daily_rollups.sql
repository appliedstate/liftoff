-- Migration: Create daily rollup tables for insights and sessions
-- Purpose: Persist daily spend/impressions (FB) and sessions by entity to derive first_spend_at / first_session_at
-- Depends on: 007_create_fb_entities.sql

CREATE TABLE IF NOT EXISTS fb_insights_daily (
  date DATE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('campaign','adset','ad')),
  entity_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  spend_usd NUMERIC,
  impressions BIGINT,
  clicks BIGINT,
  PRIMARY KEY (date, level, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_fb_insights_daily_account ON fb_insights_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_fb_insights_daily_level ON fb_insights_daily(level);

CREATE TABLE IF NOT EXISTS sessions_entity_daily (
  date DATE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('campaign','adset','ad')),
  entity_id TEXT NOT NULL,
  sessions BIGINT,
  PRIMARY KEY (date, level, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_entity_daily_level ON sessions_entity_daily(level);




