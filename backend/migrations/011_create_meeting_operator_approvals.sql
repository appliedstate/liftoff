-- Migration: Create operator approval persistence for meeting intelligence
-- Created: 2026-04-29
-- Purpose: Persist operator approval calls, notes, and packet snapshots for synthesized meetings

CREATE TABLE IF NOT EXISTS meeting_operator_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  operator_person_id TEXT,
  operator_name VARCHAR(255),
  decision VARCHAR(100) NOT NULL, -- approved | rejected | deferred
  notes_md TEXT,
  packet_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_action_count INTEGER NOT NULL DEFAULT 0,
  created_decision_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_operator_approvals_meeting_id ON meeting_operator_approvals(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_operator_approvals_decision ON meeting_operator_approvals(decision);
CREATE INDEX IF NOT EXISTS idx_meeting_operator_approvals_approved_at ON meeting_operator_approvals(approved_at DESC);
