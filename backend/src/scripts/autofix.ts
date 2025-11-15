import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { latestSnapshotDir, defaultDaySnapshotsBase, defaultSnapshotsBase } from '../lib/snapshots';

const execFileAsync = promisify(execFile);

async function queryDuckDb(sql: string, params: any[] = []): Promise<any[]> {
  const duckdb = await import('duckdb');
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  try {
    const rows: any[] = await new Promise((resolve, reject) => {
      conn.all(sql, params, (err: any, res: any[]) => (err ? reject(err) : resolve(res)));
    });
    return rows;
  } finally {
    conn.close();
  }
}

function cfg() {
  return {
    lookbackDays: Math.max(1, parseInt(process.env.STRATEGIST_AUTOFIX_LOOKBACK_DAYS || '3', 10) || 3),
    maxDates: Math.max(1, parseInt(process.env.STRATEGIST_AUTOFIX_MAX_DATES || '3', 10) || 3),
    slo: {
      maxNullRate: Math.min(1, Math.max(0, Number(process.env.SLO_MAX_NULL_RATE ?? '0.02'))),
      minRows: Math.max(0, parseInt(process.env.SLO_MIN_ROWS ?? '10', 10) || 10),
    },
  };
}

function isoYmd(d: Date): string { return d.toISOString().slice(0, 10); }

async function evaluateFreshnessCompleteness(level: 'adset'|'campaign', date: string, maxNullRate: number, minRows: number): Promise<{freshness_ok: boolean; completeness_ok: boolean;}> {
  const daySnap = latestSnapshotDir(defaultDaySnapshotsBase());
  if (!daySnap) return { freshness_ok: false, completeness_ok: false };
  const dayGlob = path.join(daySnap, `level=${level}`, `date=${date}`, `*.*`);
  const totals = await queryDuckDb(
    `WITH unioned AS (
      SELECT * FROM read_parquet(?)
      UNION ALL
      SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
    )
    SELECT COUNT(*) AS rows FROM unioned WHERE date = ?`, [dayGlob, dayGlob, date]).catch(() => [{ rows: 0 }]);
  const rowCount = Number(totals[0]?.rows || 0);
  const freshness_ok = rowCount >= minRows;
  const keys = level === 'adset' ? ['account_id','campaign_id','adset_id','spend_usd','clicks','impressions'] : ['account_id','campaign_id','spend_usd','clicks','impressions'];
  const nullSql = `WITH unioned AS (
    SELECT * FROM read_parquet(?)
    UNION ALL
    SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
  )
  SELECT ${keys.map((k) => `SUM(CASE WHEN ${k} IS NULL THEN 1 ELSE 0 END) AS ${k}_nulls`).join(', ')}, COUNT(*) AS rows FROM unioned WHERE date = ?`;
  const nulls = await queryDuckDb(nullSql, [dayGlob, dayGlob, date]).catch(() => [{ rows: 0 }]);
  const rows = Number(nulls[0]?.rows || 0) || 1;
  let completeness_ok = true;
  for (const k of keys) {
    const c = Number(nulls[0][`${k}_nulls`] || 0);
    if (c / rows > maxNullRate) { completeness_ok = false; break; }
  }
  return { freshness_ok, completeness_ok };
}

async function main() {
  const { lookbackDays, maxDates, slo } = cfg();
  const today = new Date();
  const candidates: string[] = [];
  for (let i = 1; i <= lookbackDays; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    candidates.push(isoYmd(d));
  }

  const toFix: string[] = [];
  for (const date of candidates) {
    const adsetSlo = await evaluateFreshnessCompleteness('adset', date, slo.maxNullRate, slo.minRows);
    const campSlo = await evaluateFreshnessCompleteness('campaign', date, slo.maxNullRate, slo.minRows);
    if (!adsetSlo.freshness_ok || !adsetSlo.completeness_ok || !campSlo.freshness_ok || !campSlo.completeness_ok) {
      toFix.push(date);
      if (toFix.length >= maxDates) break;
    }
  }

  if (!toFix.length) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, repaired: [], note: 'No dates to backfill' }));
    return;
  }

  const args = ['src/scripts/ingestDay.ts', `--start=${toFix[0]}`, `--end=${toFix[toFix.length - 1]}`, '--levels=adset,campaign'];
  const { stdout, stderr } = await execFileAsync('ts-node', args, { cwd: process.cwd(), timeout: 60 * 60_000 });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, repaired: toFix, stdout, stderr }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


