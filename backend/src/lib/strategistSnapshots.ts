import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';
import { defaultDaySnapshotsBase, defaultSnapshotsBase, listSnapshotDirs, readManifest } from './snapshots';

export type StrategistSource = 'day' | 'reconciled';

type FetchOptions = {
  date: string;
  source?: StrategistSource;
  level?: 'campaign' | 'adset';
  limit?: number;
};

export async function fetchStrategistSnapshotRows(
  opts: FetchOptions
): Promise<{ rows: any[]; snapshotDir: string; source: StrategistSource; level: 'campaign' | 'adset' }> {
  if (!opts.date || !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    throw new Error('opts.date must be provided as YYYY-MM-DD');
  }
  const source: StrategistSource = opts.source || 'day';
  const level: 'campaign' | 'adset' = opts.level || 'campaign';
  const limit = Math.max(1, Math.min(opts.limit ?? 50000, 200000));

  const baseDir = source === 'reconciled' ? defaultSnapshotsBase() : defaultDaySnapshotsBase();
  const snapshotDir = findSnapshotForDate(baseDir, opts.date);
  if (!snapshotDir) {
    throw new Error(`No ${source} snapshot found containing date ${opts.date}`);
  }

  const dateDir = path.join(snapshotDir, `level=${level}`, `date=${opts.date}`);
  if (!fs.existsSync(dateDir)) {
    throw new Error(`Snapshot directory missing: ${dateDir}`);
  }

  const hasParquet = hasFilesWithExt(dateDir, '.parquet');
  const hasCsv = hasFilesWithExt(dateDir, '.csv');
  if (!hasParquet && !hasCsv) {
    throw new Error(`No data files found under ${dateDir}`);
  }

  const selects: string[] = [];
  if (hasParquet) {
    const pattern = path.join(dateDir, '*.parquet').replace(/'/g, "''");
    selects.push(`SELECT * FROM read_parquet('${pattern}')`);
  }
  if (hasCsv) {
    const pattern = path.join(dateDir, '*.csv').replace(/'/g, "''");
    selects.push(`SELECT * FROM read_csv_auto('${pattern}', IGNORE_ERRORS=true)`);
  }
  const unionSql = selects.join(' UNION ALL ');

  const sql = `
    SELECT * FROM (
      ${unionSql}
    )
    LIMIT ${limit}
  `;

  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  try {
    const rows: any[] = await new Promise((resolve, reject) => {
      conn.all(sql, (err: Error | null, res: any[]) => (err ? reject(err) : resolve(res)));
    });
    return { rows, snapshotDir, source, level };
  } finally {
    conn.close(() => db.close(() => {}));
  }
}

function hasFilesWithExt(dir: string, ext: string): boolean {
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir);
  return files.some((f) => f.toLowerCase().endsWith(ext.toLowerCase()));
}

function findSnapshotForDate(baseDir: string, date: string): string | null {
  const dirs = listSnapshotDirs(baseDir);
  for (let i = dirs.length - 1; i >= 0; i--) {
    const dir = dirs[i];
    const manifest = readManifest(dir);
    if (manifest && manifest.dates.has(date)) {
      return dir;
    }
  }
  return null;
}

