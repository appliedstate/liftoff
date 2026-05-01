-- Migration: Create meeting intelligence and board decision telemetry tables
-- Created: 2026-04-29
-- Purpose: Persist meetings, action ownership, participant voice signals, and board decision telemetry

CREATE TABLE IF NOT EXISTS meeting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  meeting_type VARCHAR(100),
  source_type VARCHAR(100) NOT NULL, -- google_meet | slack | manual_markdown | other
  source_uri TEXT,
  raw_text_ref TEXT,
  raw_text TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  summary_md TEXT,
  decision_summary_md TEXT,
  action_summary_md TEXT,
  confidence_score DECIMAL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  person_id TEXT,
  display_name VARCHAR(255) NOT NULL,
  role_at_time VARCHAR(255),
  participant_type VARCHAR(100), -- buyer | founder | operator | engineer | guest
  attendance_confidence DECIMAL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  speaker_label VARCHAR(255),
  person_id TEXT,
  person_name VARCHAR(255),
  started_at_offset_seconds INTEGER,
  ended_at_offset_seconds INTEGER,
  text TEXT NOT NULL,
  source_type VARCHAR(100),
  confidence_score DECIMAL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  raised_by_person_id TEXT,
  raised_by_name VARCHAR(255),
  description TEXT NOT NULL,
  problem_addressed TEXT,
  expected_upside TEXT,
  constraint_relieved TEXT,
  status VARCHAR(100) NOT NULL DEFAULT 'candidate',
  linked_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_segment_id UUID REFERENCES transcript_segments(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  decision_text TEXT NOT NULL,
  decision_owner_person_id TEXT,
  decision_owner_name VARCHAR(255),
  decision_type VARCHAR(100),
  linked_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_segment_id UUID REFERENCES transcript_segments(id) ON DELETE SET NULL,
  confidence_score DECIMAL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_person_id TEXT,
  owner_name VARCHAR(255),
  backup_owner_person_id TEXT,
  backup_owner_name VARCHAR(255),
  status VARCHAR(100) NOT NULL DEFAULT 'open',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  urgency VARCHAR(50),
  due_at TIMESTAMPTZ,
  source_segment_id UUID REFERENCES transcript_segments(id) ON DELETE SET NULL,
  source_type VARCHAR(100) NOT NULL DEFAULT 'meeting',
  linked_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_notes TEXT,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_open_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  raised_by_person_id TEXT,
  raised_by_name VARCHAR(255),
  question_text TEXT NOT NULL,
  owner_person_id TEXT,
  owner_name VARCHAR(255),
  status VARCHAR(100) NOT NULL DEFAULT 'open',
  source_segment_id UUID REFERENCES transcript_segments(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS person_voice_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id TEXT,
  person_name VARCHAR(255) NOT NULL,
  meeting_id UUID REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  signal_type VARCHAR(100) NOT NULL,
  signal_text TEXT NOT NULL,
  theme VARCHAR(255),
  confidence_score DECIMAL,
  source_segment_id UUID REFERENCES transcript_segments(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  trigger_type VARCHAR(100),
  context_md TEXT,
  operator_person_id TEXT,
  operator_name VARCHAR(255),
  prime_directive_link TEXT,
  workstream VARCHAR(255),
  status VARCHAR(100) NOT NULL DEFAULT 'in_review',
  opened_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_session_id UUID NOT NULL REFERENCES board_sessions(id) ON DELETE CASCADE,
  participant_type VARCHAR(100) NOT NULL, -- digital_board_seat | human_operator | human_guest
  seat_name VARCHAR(255),
  person_id TEXT,
  person_name VARCHAR(255),
  weighting_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_session_id UUID NOT NULL REFERENCES board_sessions(id) ON DELETE CASCADE,
  decision_title VARCHAR(500) NOT NULL,
  decision_text TEXT NOT NULL,
  decision_type VARCHAR(100),
  decision_scope VARCHAR(255),
  operator_final_call TEXT,
  selected_option TEXT,
  rejected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale_md TEXT,
  expected_upside TEXT,
  expected_downside TEXT,
  expected_constraint_relieved TEXT,
  expected_metric JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_state VARCHAR(100) NOT NULL DEFAULT 'decided',
  decided_at TIMESTAMPTZ NOT NULL,
  review_due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_decision_seat_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_decision_id UUID NOT NULL REFERENCES board_decisions(id) ON DELETE CASCADE,
  seat_name VARCHAR(255) NOT NULL,
  position_summary TEXT,
  primary_concern TEXT,
  primary_metric TEXT,
  recommended_action TEXT,
  disagreed_with_final_call BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_decision_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_decision_id UUID NOT NULL REFERENCES board_decisions(id) ON DELETE CASCADE,
  action_item_id UUID NOT NULL REFERENCES meeting_action_items(id) ON DELETE CASCADE,
  owner_person_id TEXT,
  owner_name VARCHAR(255),
  status VARCHAR(100) NOT NULL DEFAULT 'assigned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_decision_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_decision_id UUID NOT NULL REFERENCES board_decisions(id) ON DELETE CASCADE,
  review_window_type VARCHAR(100),
  actual_outcome_summary TEXT,
  actual_metric JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_quality VARCHAR(100) NOT NULL,
  variance_vs_expectation TEXT,
  keep_doctrine TEXT,
  change_doctrine TEXT,
  notes_md TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_occurred_at ON meeting_sessions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_source_type ON meeting_sessions(source_type);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_meeting_type ON meeting_sessions(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_person_id ON meeting_participants(person_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting_id ON transcript_segments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_ideas_meeting_id ON meeting_ideas(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting_id ON meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_owner_person_id ON meeting_action_items(owner_person_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(status);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_due_at ON meeting_action_items(due_at);
CREATE INDEX IF NOT EXISTS idx_meeting_open_questions_meeting_id ON meeting_open_questions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_person_voice_signals_person_id ON person_voice_signals(person_id);
CREATE INDEX IF NOT EXISTS idx_person_voice_signals_meeting_id ON person_voice_signals(meeting_id);
CREATE INDEX IF NOT EXISTS idx_person_voice_signals_signal_type ON person_voice_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_board_sessions_opened_at ON board_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_sessions_workstream ON board_sessions(workstream);
CREATE INDEX IF NOT EXISTS idx_board_decisions_board_session_id ON board_decisions(board_session_id);
CREATE INDEX IF NOT EXISTS idx_board_decisions_state ON board_decisions(decision_state);
CREATE INDEX IF NOT EXISTS idx_board_decisions_review_due_at ON board_decisions(review_due_at);
CREATE INDEX IF NOT EXISTS idx_board_decision_actions_decision_id ON board_decision_actions(board_decision_id);
CREATE INDEX IF NOT EXISTS idx_board_decision_actions_action_item_id ON board_decision_actions(action_item_id);
CREATE INDEX IF NOT EXISTS idx_board_decision_reviews_decision_id ON board_decision_reviews(board_decision_id);
