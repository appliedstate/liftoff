-- Purpose: Persist operator-facing command queue state transitions so the unified queue can show progress over time.

CREATE TABLE IF NOT EXISTS operator_command_queue_state (
  id UUID PRIMARY KEY,
  command_key TEXT NOT NULL UNIQUE,
  owner_key TEXT NOT NULL,
  owner_label TEXT,
  status VARCHAR(64) NOT NULL DEFAULT 'queued', -- queued | seen | in_progress | cleared | promoted | deferred
  note_md TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at TIMESTAMPTZ,
  in_progress_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  deferred_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_command_queue_state_owner_key
  ON operator_command_queue_state(owner_key);

CREATE INDEX IF NOT EXISTS idx_operator_command_queue_state_status
  ON operator_command_queue_state(status);
