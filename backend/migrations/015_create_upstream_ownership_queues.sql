-- Migration: Create upstream ownership queues
-- Created: 2026-04-30
-- Purpose: Add canonical ownership and cadence control for opportunities and intent-packet exploration

CREATE TABLE IF NOT EXISTS opportunity_ownership_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  owner_person_id UUID,
  owner_name VARCHAR(255),
  queue_status VARCHAR(50) NOT NULL DEFAULT 'new',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  next_step TEXT,
  next_step_due_at TIMESTAMPTZ,
  blocker_summary TEXT,
  last_reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_ownership_queue_status
  ON opportunity_ownership_queue(queue_status);

CREATE INDEX IF NOT EXISTS idx_opportunity_ownership_queue_owner
  ON opportunity_ownership_queue(owner_name);

CREATE INDEX IF NOT EXISTS idx_opportunity_ownership_queue_due_at
  ON opportunity_ownership_queue(next_step_due_at);
