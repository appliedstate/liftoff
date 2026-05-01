-- Migration: Create founder-private conversation intake and visibility controls
-- Created: 2026-04-30
-- Purpose: Support founder-private Slack conversation ingestion with private-by-default visibility

ALTER TABLE meeting_sessions
  ADD COLUMN IF NOT EXISTS visibility_scope VARCHAR(100) NOT NULL DEFAULT 'shared';

ALTER TABLE meeting_sessions
  ADD COLUMN IF NOT EXISTS operator_person_id TEXT;

ALTER TABLE meeting_sessions
  ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255);

ALTER TABLE meeting_sessions
  ADD COLUMN IF NOT EXISTS visibility_group_key TEXT;

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_visibility_scope
  ON meeting_sessions(visibility_scope);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_visibility_group_key
  ON meeting_sessions(visibility_group_key);

CREATE TABLE IF NOT EXISTS private_conversation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key VARCHAR(255) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  channel_ref TEXT NOT NULL,
  slack_channel_id TEXT,
  slack_channel_name VARCHAR(255),
  slack_thread_ts TEXT,
  watch_window VARCHAR(50) NOT NULL DEFAULT '2d',
  meeting_type VARCHAR(100) NOT NULL DEFAULT 'slack_private_conversation',
  query TEXT,
  visibility_scope VARCHAR(100) NOT NULL DEFAULT 'private_operator',
  operator_person_id TEXT,
  operator_name VARCHAR(255),
  counterpart_person_id TEXT,
  counterpart_name VARCHAR(255) NOT NULL,
  objective TEXT,
  status VARCHAR(100) NOT NULL DEFAULT 'active',
  auto_ingest BOOLEAN NOT NULL DEFAULT TRUE,
  last_ingested_at TIMESTAMPTZ,
  last_meeting_id UUID REFERENCES meeting_sessions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_conversation_sources_status
  ON private_conversation_sources(status);

CREATE INDEX IF NOT EXISTS idx_private_conversation_sources_auto_ingest
  ON private_conversation_sources(auto_ingest);

CREATE INDEX IF NOT EXISTS idx_private_conversation_sources_visibility_scope
  ON private_conversation_sources(visibility_scope);
