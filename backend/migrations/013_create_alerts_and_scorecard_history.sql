-- Migration: Create owner alert notifications and buyer scorecard history
-- Created: 2026-04-29
-- Purpose: Persist owner alert notifications and time-series scorecard snapshots

CREATE TABLE IF NOT EXISTS owner_alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key TEXT NOT NULL,
  owner_label VARCHAR(255) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  alert_type VARCHAR(100) NOT NULL DEFAULT 'owner_execution_alert',
  alert_signature TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recommended_action TEXT,
  status VARCHAR(100) NOT NULL DEFAULT 'queued', -- queued | acknowledged | dismissed
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_owner_alert_notifications_owner_key ON owner_alert_notifications(owner_key);
CREATE INDEX IF NOT EXISTS idx_owner_alert_notifications_status ON owner_alert_notifications(status);
CREATE INDEX IF NOT EXISTS idx_owner_alert_notifications_created_at ON owner_alert_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_alert_notifications_signature ON owner_alert_notifications(alert_signature);

CREATE TABLE IF NOT EXISTS buyer_execution_scorecard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key TEXT NOT NULL,
  owner_label VARCHAR(255) NOT NULL,
  lookback_days INTEGER NOT NULL,
  band VARCHAR(50) NOT NULL,
  spend DOUBLE PRECISION NOT NULL DEFAULT 0,
  revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_margin DOUBLE PRECISION NOT NULL DEFAULT 0,
  roas DOUBLE PRECISION,
  active_campaigns INTEGER NOT NULL DEFAULT 0,
  launch_count INTEGER NOT NULL DEFAULT 0,
  total_open_actions INTEGER NOT NULL DEFAULT 0,
  approved_actions INTEGER NOT NULL DEFAULT 0,
  in_progress_actions INTEGER NOT NULL DEFAULT 0,
  overdue_actions INTEGER NOT NULL DEFAULT 0,
  at_risk_actions INTEGER NOT NULL DEFAULT 0,
  needs_owner_actions INTEGER NOT NULL DEFAULT 0,
  execution_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  queue_pressure DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_age_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
  oldest_age_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_execution_scorecard_snapshots_owner_key ON buyer_execution_scorecard_snapshots(owner_key);
CREATE INDEX IF NOT EXISTS idx_buyer_execution_scorecard_snapshots_captured_at ON buyer_execution_scorecard_snapshots(captured_at DESC);
