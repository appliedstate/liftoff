import path from 'path';
import duckdb from 'duckdb';
import { ensureDir } from './snapshots';

const DEFAULT_DB_PATH = process.env.MONITORING_DB_PATH || path.join(process.cwd(), 'data', 'monitoring.duckdb');

export function getMonitoringDbPath(): string {
  return DEFAULT_DB_PATH;
}

export function createMonitoringConnection(): any {
  const dbPath = getMonitoringDbPath();
  ensureDir(path.dirname(dbPath));
  const db = new duckdb.Database(dbPath);
  return db.connect();
}

export function runSql(conn: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

export function allRows<T = any>(conn: any, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    (conn as any).all(sql, (err: Error | null, rows: T[]) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function closeConnection(conn: any): void {
  conn.close(() => {
    // no-op
  });
}

export function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'NULL';
  return String(value);
}

export async function initMonitoringSchema(conn: any): Promise<void> {
  const statements = [
    `
    CREATE TABLE IF NOT EXISTS campaign_index (
      campaign_id TEXT NOT NULL,
      level TEXT NOT NULL,
      date DATE NOT NULL,
      snapshot_source TEXT NOT NULL,
      account_id TEXT,
      campaign_name TEXT,
      adset_id TEXT,
      adset_name TEXT,
      facebook_campaign_id TEXT,
      owner TEXT,
      lane TEXT,
      category TEXT,
      media_source TEXT,
      rsoc_site TEXT,
      s1_google_account TEXT,
      spend_usd DOUBLE,
      revenue_usd DOUBLE,
      sessions DOUBLE,
      clicks DOUBLE,
      conversions DOUBLE,
      roas DOUBLE,
      raw_payload JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    // Add missing columns if they don't exist (for existing databases)
    `
    ALTER TABLE campaign_index ADD COLUMN IF NOT EXISTS rsoc_site TEXT
    `,
    `
    ALTER TABLE campaign_index ADD COLUMN IF NOT EXISTS s1_google_account TEXT
    `,
    `
    ALTER TABLE campaign_index ADD COLUMN IF NOT EXISTS facebook_campaign_id TEXT
    `,
    `
    CREATE TABLE IF NOT EXISTS campaign_index_runs (
      date DATE NOT NULL,
      snapshot_source TEXT NOT NULL,
      level TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP,
      status TEXT NOT NULL,
      message TEXT
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS session_hourly_metrics (
      date DATE NOT NULL,
      campaign_id TEXT NOT NULL,
      click_hour INTEGER NOT NULL,
      sessions INTEGER NOT NULL,
      revenue DOUBLE NOT NULL,
      rpc DOUBLE NOT NULL,
      traffic_source TEXT,
      owner TEXT,
      lane TEXT,
      category TEXT,
      media_source TEXT,
      ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS session_ingest_runs (
      date DATE NOT NULL,
      max_click_hour INTEGER,
      session_count INTEGER NOT NULL,
      campaign_count INTEGER NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP,
      status TEXT NOT NULL,
      message TEXT
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS endpoint_completeness (
      date DATE NOT NULL,
      endpoint TEXT NOT NULL,
      platform TEXT,
      status TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      expected_min_rows INTEGER,
      has_revenue BOOLEAN,
      has_spend BOOLEAN,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP,
      PRIMARY KEY (date, endpoint)
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS campaign_launches (
      campaign_id TEXT NOT NULL,
      first_seen_date DATE NOT NULL,
      owner TEXT,
      lane TEXT,
      category TEXT,
      media_source TEXT,
      campaign_name TEXT,
      account_id TEXT,
      detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (campaign_id)
    )
    `,
    // Snapshot tables for time-aligned hourly RPC reporting
    `
    CREATE TABLE IF NOT EXISTS hourly_snapshot_metrics (
      snapshot_pst TIMESTAMP NOT NULL,
      day_pst DATE NOT NULL,
      hour_pst INTEGER NOT NULL,
      media_source TEXT,
      rsoc_site TEXT,
      owner TEXT,
      lane TEXT,
      category TEXT,
      level TEXT,
      campaign_id TEXT,
      campaign_name TEXT,
      adset_id TEXT,
      adset_name TEXT,
      sessions DOUBLE,
      revenue DOUBLE,
      clicks DOUBLE,
      conversions DOUBLE,
      rpc DOUBLE,
      PRIMARY KEY (
        snapshot_pst,
        day_pst,
        hour_pst,
        media_source,
        rsoc_site,
        owner,
        category,
        level,
        campaign_id,
        adset_id
      )
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS hourly_snapshot_runs (
      snapshot_pst TIMESTAMP PRIMARY KEY,
      row_count INTEGER,
      from_day_pst DATE,
      to_day_pst DATE,
      status TEXT,
      message TEXT
    )
    `,
    // Placeholder for future keyword-level hourly snapshots. Same grain as hourly_snapshot_metrics plus keyword.
    `
    CREATE TABLE IF NOT EXISTS hourly_snapshot_keywords (
      snapshot_pst TIMESTAMP NOT NULL,
      day_pst DATE NOT NULL,
      hour_pst INTEGER NOT NULL,
      media_source TEXT,
      rsoc_site TEXT,
      owner TEXT,
      lane TEXT,
      category TEXT,
      keyword TEXT,
      sessions DOUBLE,
      revenue DOUBLE,
      clicks DOUBLE,
      conversions DOUBLE,
      rpc DOUBLE
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS campaign_assignment_queue (
      queue_id TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      source_row INTEGER NOT NULL,
      status TEXT,
      requested_buyer TEXT,
      assigned_buyer TEXT,
      assignment_state TEXT NOT NULL DEFAULT 'unassigned',
      request_date DATE,
      category TEXT,
      notes TEXT,
      target_market TEXT,
      device_target TEXT,
      headline TEXT,
      rsoc_site TEXT,
      article_url TEXT,
      campaign_url TEXT,
      launch_campaign_id TEXT,
      launch_date DATE,
      launch_owner TEXT,
      launch_media_source TEXT,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      raw_payload JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_assignment_source_row
    ON campaign_assignment_queue(source_file, source_row)
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS assigned_buyer TEXT
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS assignment_state TEXT
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS launch_campaign_id TEXT
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS launch_date DATE
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS launch_owner TEXT
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS launch_media_source TEXT
    `,
    `
    ALTER TABLE campaign_assignment_queue ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP
    `,
    `
    CREATE TABLE IF NOT EXISTS intent_packet_observations (
      observation_id TEXT PRIMARY KEY,
      observed_at TIMESTAMP NOT NULL,
      source TEXT NOT NULL,
      market TEXT,
      packet_id TEXT,
      packet_name TEXT,
      campaign_id TEXT,
      primary_keyword TEXT NOT NULL,
      supporting_keywords_json JSON,
      searches DOUBLE,
      monetized_clicks DOUBLE,
      revenue DOUBLE,
      paid_impressions DOUBLE,
      paid_clicks DOUBLE,
      paid_spend DOUBLE,
      approved BOOLEAN,
      rejected BOOLEAN,
      review_flag BOOLEAN,
      metadata_json JSON
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS intent_packet_observation_axioms (
      observation_id TEXT NOT NULL,
      namespace TEXT NOT NULL,
      axiom_key TEXT NOT NULL,
      axiom_label TEXT NOT NULL
    )
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_intent_packet_observations_source_date
    ON intent_packet_observations(source, observed_at)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_intent_packet_observations_primary_keyword
    ON intent_packet_observations(primary_keyword)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_intent_packet_axioms_observation
    ON intent_packet_observation_axioms(observation_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_intent_packet_axioms_namespace_key
    ON intent_packet_observation_axioms(namespace, axiom_key)
    `,
    `
    CREATE TABLE IF NOT EXISTS intent_packet_exploration_queue (
      queue_key TEXT PRIMARY KEY,
      primary_keyword TEXT NOT NULL,
      packet_name TEXT,
      market TEXT,
      owner_name TEXT,
      queue_status TEXT NOT NULL DEFAULT 'new',
      priority TEXT NOT NULL DEFAULT 'medium',
      next_step TEXT,
      next_review_at TIMESTAMP,
      blocker_summary TEXT,
      metadata_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_intent_packet_exploration_queue_owner
    ON intent_packet_exploration_queue(owner_name)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_intent_packet_exploration_queue_status
    ON intent_packet_exploration_queue(queue_status)
    `,
  ];

  for (const stmt of statements) {
    await runSql(conn, stmt);
  }
}
