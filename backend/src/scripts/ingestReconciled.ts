import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { ensureDir, latestSnapshotDir, defaultSnapshotsBase, writeCsv } from '../lib/snapshots';

type Args = {
  date?: string; // YYYY-MM-DD
  level?: 'adset' | 'campaign';
  out?: string; // base snapshots dir
  token?: string; // Strategis auth token if fetching from a URL
  url?: string; // Optional: if provided, fetch CSV from this endpoint
  key?: string; // storage key for local strategist adapter
  fromFile?: string; // Optional CSV file path to ingest
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (j: number = 1) => (i + j < argv.length ? argv[i + j] : undefined);
    if (a === '--date') out.date = String(next()) as string;
    if (a === '--level') out.level = (String(next()) as 'adset' | 'campaign');
    if (a === '--out') out.out = String(next());
    if (a === '--token') out.token = String(next());
    if (a === '--url') out.url = String(next());
    if (a === '--key') out.key = String(next());
    if (a === '--fromFile') out.fromFile = String(next());
  }
  return out;
}

type ReconciledRow = Record<string, any> & {
  date: string;
  level: 'adset' | 'campaign';
};

function nowUtcStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

async function main() {
  const args = parseArgs();
  const date = args.date || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const level = (args.level === 'campaign' ? 'campaign' : 'adset') as 'adset' | 'campaign';
  const baseOut = args.out || defaultSnapshotsBase();
  const snapshotTs = nowUtcStamp();
  const snapshotDir = path.join(baseOut, snapshotTs);

  // Prepare directories
  const partDir = path.join(snapshotDir, `level=${level}`, `date=${date}`);
  ensureDir(partDir);

  let csvText: string | null = null;
  if (args.fromFile) {
    csvText = fs.readFileSync(args.fromFile, 'utf8');
  } else if (args.url) {
    const headers: Record<string, string> = {};
    if (args.token) headers['Authorization'] = `Bearer ${args.token}`;
    const resp = await axios.get(args.url, { headers, responseType: 'text' });
    csvText = String(resp.data);
  } else {
    // Last resort: try local strategist adapter if running
    // This path expects the caller to post to /api/strategist/ingest beforehand
    const localPath = process.env.LOCAL_CSV_PATH;
    if (localPath && fs.existsSync(localPath)) {
      csvText = fs.readFileSync(localPath, 'utf8');
    }
  }

  if (!csvText) {
    console.error('No CSV provided. Use --fromFile or --url');
    process.exit(1);
  }

  // Write raw CSV part for traceability (optional)
  const rawCsvPath = path.join(partDir, 'raw.csv');
  fs.writeFileSync(rawCsvPath, csvText);

  // For now, store as-is CSV part-000.csv and a minimal manifest
  const dataCsvPath = path.join(partDir, 'part-000.csv');
  fs.writeFileSync(dataCsvPath, csvText);

  // Also materialize Parquet using DuckDB for efficient reads
  const dataParquetPath = path.join(partDir, 'part-000.parquet');
  try {
    const duckdb = await import('duckdb');
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    await new Promise<void>((resolve, reject) =>
      conn.run(
        `CREATE TABLE t AS SELECT * FROM read_csv_auto(? , IGNORE_ERRORS=true);`,
        [dataCsvPath],
        (err: any) => (err ? reject(err) : resolve()),
      ),
    );
    await new Promise<void>((resolve, reject) =>
      conn.run(
        `COPY t TO ? (FORMAT PARQUET, COMPRESSION ZSTD);`,
        [dataParquetPath],
        (err: any) => (err ? reject(err) : resolve()),
      ),
    );
    conn.close();
  } catch (e) {
    console.warn('Parquet write skipped (duckdb not available):', (e as Error)?.message || e);
  }

  const manifestRows = [
    {
      snapshot_ts: snapshotTs,
      source: 'strategis_reconciled',
      schema_version: 1,
      level,
      date,
      num_rows: csvText.split('\n').filter((l) => l.trim().length > 0).length - 1,
      file_path: dataCsvPath,
    },
  ];
  if (fs.existsSync(dataParquetPath)) {
    manifestRows.push({
      snapshot_ts: snapshotTs,
      source: 'strategis_reconciled',
      schema_version: 1,
      level,
      date,
      num_rows: manifestRows[0].num_rows,
      file_path: dataParquetPath,
    });
  }

  writeCsv(
    path.join(snapshotDir, 'manifest.csv'),
    ['snapshot_ts', 'source', 'schema_version', 'level', 'date', 'num_rows', 'file_path'],
    manifestRows,
  );

  console.log(JSON.stringify({ snapshot_dir: snapshotDir, level, date }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


