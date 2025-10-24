import fs from 'fs';
import path from 'path';

export function defaultSnapshotsBase(): string {
  // Project-local default under data/snapshots/facebook/reconciled
  return process.env.RECONCILED_SNAPSHOTS_BASE || path.join(process.cwd(), 'data', 'snapshots', 'facebook', 'reconciled');
}

export function defaultDaySnapshotsBase(): string {
  // Project-local default under data/snapshots/facebook/day
  return process.env.DAY_SNAPSHOTS_BASE || path.join(process.cwd(), 'data', 'snapshots', 'facebook', 'day');
}

export function listSnapshotDirs(baseDir?: string): string[] {
  const base = baseDir || defaultSnapshotsBase();
  if (!fs.existsSync(base)) return [];
  const entries = fs.readdirSync(base, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(base, e.name)).sort();
}

export function latestSnapshotDir(baseDir?: string): string | null {
  const dirs = listSnapshotDirs(baseDir);
  if (!dirs.length) return null;
  return dirs[dirs.length - 1];
}

export type SnapshotManifestRow = {
  snapshot_ts: string;
  source: string;
  schema_version: number;
  level: 'adset' | 'campaign';
  date: string; // YYYY-MM-DD
  num_rows: number;
  file_path: string;
  size_bytes?: number;
};

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeCsv(filePath: string, header: string[], rows: Record<string, any>[]): void {
  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines: string[] = [];
  lines.push(header.join(','));
  for (const r of rows) {
    lines.push(header.map((k) => escape(r[k])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'));
}

export function readManifest(snapshotDir: string): { rows: number; dates: Set<string> } | null {
  const p = path.join(snapshotDir, 'manifest.csv');
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return null;
  const header = lines[0].split(',').map((s) => s.trim());
  const dateIdx = header.indexOf('date');
  const rowsIdx = header.indexOf('num_rows');
  let total = 0;
  const dates = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (dateIdx >= 0 && cols[dateIdx]) dates.add(cols[dateIdx]);
    if (rowsIdx >= 0 && cols[rowsIdx]) total += Number(cols[rowsIdx]) || 0;
  }
  return { rows: total, dates };
}


