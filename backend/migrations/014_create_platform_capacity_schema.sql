-- Migration: Create platform account / contract / capacity constraint schema
-- Created: 2026-04-30
-- Purpose: Formalize external execution capacity, legal/commercial agreements, and active scaling constraints.

CREATE TABLE IF NOT EXISTS platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  provider TEXT NOT NULL,
  partner_name TEXT,
  account_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  policy_risk_level TEXT,
  daily_capacity_estimate NUMERIC,
  owner_team TEXT,
  source_ref TEXT,
  notes_md TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operating_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key TEXT NOT NULL UNIQUE,
  agreement_type TEXT NOT NULL,
  contract_label TEXT NOT NULL,
  primary_counterparty TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  payment_flow_role TEXT,
  execution_scope TEXT,
  source_ref TEXT,
  notes_md TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capacity_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_key TEXT NOT NULL UNIQUE,
  constraint_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  summary TEXT NOT NULL,
  affected_entity_type TEXT NOT NULL,
  affected_entity_key TEXT NOT NULL,
  operator_owner TEXT,
  source_ref TEXT,
  notes_md TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP,
  review_due_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform_status
  ON platform_accounts(platform, status);

CREATE INDEX IF NOT EXISTS idx_operating_contracts_status
  ON operating_contracts(status);

CREATE INDEX IF NOT EXISTS idx_capacity_constraints_status_severity
  ON capacity_constraints(status, severity);

CREATE INDEX IF NOT EXISTS idx_capacity_constraints_entity
  ON capacity_constraints(affected_entity_type, affected_entity_key);
