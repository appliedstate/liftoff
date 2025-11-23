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
  ];

  for (const stmt of statements) {
    await runSql(conn, stmt);
  }
}

