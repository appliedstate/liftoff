-- Purpose: Persist north-star metric snapshots for overnight operating-system sprints.

CREATE TABLE IF NOT EXISTS overnight_sprint_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_key TEXT NOT NULL,
  sprint_label TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  window_hours INTEGER,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overnight_sprint_metric_snapshots_sprint_key
  ON overnight_sprint_metric_snapshots(sprint_key);

CREATE INDEX IF NOT EXISTS idx_overnight_sprint_metric_snapshots_captured_at
  ON overnight_sprint_metric_snapshots(captured_at DESC);
