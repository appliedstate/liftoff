-- Migration: Create meeting execution event log
-- Created: 2026-04-29
-- Purpose: Persist operator-approval-driven execution transitions for meeting action items

CREATE TABLE IF NOT EXISTS meeting_execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE CASCADE,
  operator_approval_id UUID REFERENCES meeting_operator_approvals(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, -- operator_approved | operator_deferred | operator_rejected | action_status_transition
  from_status VARCHAR(100),
  to_status VARCHAR(100),
  owner_person_id TEXT,
  owner_name VARCHAR(255),
  notes_md TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_execution_events_meeting_id ON meeting_execution_events(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_execution_events_action_item_id ON meeting_execution_events(action_item_id);
CREATE INDEX IF NOT EXISTS idx_meeting_execution_events_operator_approval_id ON meeting_execution_events(operator_approval_id);
CREATE INDEX IF NOT EXISTS idx_meeting_execution_events_occurred_at ON meeting_execution_events(occurred_at DESC);
