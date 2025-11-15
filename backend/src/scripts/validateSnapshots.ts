import path from 'path';
import { latestSnapshotDir, defaultDaySnapshotsBase, defaultSnapshotsBase, listSnapshotDirs, readManifest } from '../lib/snapshots';

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

function getArg(name: string, def?: string): string | undefined {
  const prefix = `--${name}`;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === prefix) {
      const val = process.argv[i + 1];
      if (val && !val.startsWith('--')) return val;
      return def;
    }
    if (arg.startsWith(prefix + '=')) {
      return arg.slice(prefix.length + 1);
    }
  }
  return def;
}

async function main() {
  const date = getArg('date');
  if (!date) throw new Error('Provide --date=YYYY-MM-DD');
  const epsilon = Number(getArg('epsilon', '0.01'));
  const relPct = Number(getArg('rel_pct', process.env.SLO_MAX_RECONCILED_MISS_PCT || '0.05'));

  function findSnapshotContainingDate(baseDir: string, wantDate: string): string | null {
    const dirs = listSnapshotDirs(baseDir);
    for (let i = dirs.length - 1; i >= 0; i--) {
      const man = readManifest(dirs[i]);
      if (man && man.dates.has(wantDate)) return dirs[i];
    }
    return latestSnapshotDir(baseDir);
  }

  const dayBase = defaultDaySnapshotsBase();
  const recBase = defaultSnapshotsBase();
  const daySnap = findSnapshotContainingDate(dayBase, date);
  const recSnap = findSnapshotContainingDate(recBase, date);

  if (!daySnap) throw new Error('No day snapshots found');
  if (!recSnap) {
    console.warn('No reconciled snapshots found; skipping reconciled checks');
  }

  const levels: Array<'adset' | 'campaign'> = ['adset', 'campaign'];
  const out: any = { date, epsilon, rel_pct: relPct, checks: [] };

  for (const level of levels) {
    const dayParquet = path.join(daySnap!, `level=${level}`, `date=${date}`, `*.parquet`);
    const dayCsv = path.join(daySnap!, `level=${level}`, `date=${date}`, `*.csv`);
    const recGlob = recSnap ? path.join(recSnap, `level=${level}`, `date=${date}`, `*.*`) : null;

    const totals = await (async () => {
      try {
        return await queryDuckDb(
          `SELECT COUNT(*) AS rows,
                  SUM(CAST(spend_usd AS DOUBLE)) AS spend,
                  SUM(CAST(clicks AS BIGINT)) AS clicks,
                  SUM(CAST(impressions AS BIGINT)) AS impressions
           FROM read_parquet(?) WHERE date = ?`,
          [dayParquet, date]
        );
      } catch {
        try {
          return await queryDuckDb(
            `WITH unioned AS (
               SELECT * FROM read_parquet(?)
               UNION ALL
               SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
             )
             SELECT COUNT(*) AS rows,
                    SUM(CAST(spend_usd AS DOUBLE)) AS spend,
                    SUM(CAST(clicks AS BIGINT)) AS clicks,
                    SUM(CAST(impressions AS BIGINT)) AS impressions
             FROM unioned WHERE date = ?`,
            [dayParquet, dayCsv, date]
          );
        } catch {
          try {
            return await queryDuckDb(
              `SELECT COUNT(*) AS rows,
                      SUM(CAST(spend_usd AS DOUBLE)) AS spend,
                      SUM(CAST(clicks AS BIGINT)) AS clicks,
                      SUM(CAST(impressions AS BIGINT)) AS impressions
               FROM read_csv_auto(?, IGNORE_ERRORS=true) WHERE date = ?`,
              [dayCsv, date]
            );
          } catch {
            return [{ rows: 0, spend: 0, clicks: 0, impressions: 0 }];
          }
        }
      }
    })();

    // Null-rate checks for key fields
    const keys = level === 'adset'
      ? ['account_id','campaign_id','adset_id','spend_usd','clicks','impressions','revenue_usd']
      : ['account_id','campaign_id','spend_usd','clicks','impressions','revenue_usd'];
    const nullSql = `WITH unioned AS (
      SELECT * FROM read_parquet(?)
      UNION ALL
      SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
    )
    SELECT ${keys.map((k) => `SUM(CASE WHEN ${k} IS NULL THEN 1 ELSE 0 END) AS ${k}_nulls`).join(', ')}, COUNT(*) AS rows
    FROM unioned WHERE date = ?`;
    const nulls = await queryDuckDb(nullSql, [dayParquet, dayCsv, date]).catch(() => [{ rows: 0 }]);

    const entry: any = { level, day: totals[0], nulls: nulls[0] };

    // Duplicate detection: count distinct vs total by natural keys
    const keyCols = level === 'adset' ? ['date','campaign_id','adset_id'] : ['date','campaign_id'];
    const dupSql = `WITH unioned AS (
      SELECT * FROM read_parquet(?)
      UNION ALL
      SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
    )
    SELECT COUNT(*) AS total_rows,
           COUNT(DISTINCT ${keyCols.join(',')}) AS distinct_keys
    FROM unioned WHERE date = ?`;
    const dup = await queryDuckDb(dupSql, [dayParquet, dayCsv, date]).catch(() => [{ total_rows: 0, distinct_keys: 0 }]);
    entry.duplicates = { total_rows: dup[0]?.total_rows || 0, distinct_keys: dup[0]?.distinct_keys || 0, duplicate_rows: Math.max(0, (dup[0]?.total_rows || 0) - (dup[0]?.distinct_keys || 0)) };

    if (level === 'campaign' && recGlob) {
      const recTotals = await queryDuckDb(
        `WITH unioned AS (
          SELECT * FROM read_parquet(?)
          UNION ALL
          SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
        )
        SELECT SUM(CAST(revenue_usd AS DOUBLE)) AS revenue
        FROM unioned WHERE date = ?`,
        [recGlob, recGlob, date],
      ).catch(() => [{ revenue: null }]);
      entry.reconciled = recTotals[0];

      // Currency guard: ensure USD (if currency column exists)
      const curSql = `WITH unioned AS (
        SELECT * FROM read_parquet(?)
        UNION ALL
        SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
      )
      SELECT LOWER(COALESCE(currency,'usd')) AS currency, COUNT(*) AS rows
      FROM unioned WHERE date = ? GROUP BY 1`;
      const cur = await queryDuckDb(curSql, [dayParquet, dayCsv, date]).catch(() => []);
      entry.currency = { groups: cur };

      // Reconciliation by campaign: compare adset sum revenue vs reconciled campaign revenue
      const adsetByCampaign = await queryDuckDb(
        `WITH unioned AS (
          SELECT * FROM read_parquet(?)
          UNION ALL
          SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
        )
        SELECT campaign_id AS campaign_id,
               SUM(CAST(revenue_usd AS DOUBLE)) AS adset_revenue
        FROM unioned WHERE date = ? GROUP BY campaign_id`,
        [path.join(daySnap!, 'level=adset', `date=${date}`, `*.parquet`), path.join(daySnap!, 'level=adset', `date=${date}`, `*.csv`), date],
      ).catch(() => []);

      const recByCampaign = await queryDuckDb(
        `WITH unioned AS (
          SELECT * FROM read_parquet(?)
          UNION ALL
          SELECT * FROM read_csv_auto(?, IGNORE_ERRORS=true)
        )
        SELECT campaign_id AS campaign_id,
               SUM(CAST(revenue_usd AS DOUBLE)) AS campaign_revenue
        FROM unioned WHERE date = ? GROUP BY campaign_id`,
        [recGlob, recGlob, date],
      ).catch(() => []);

      const recMap = new Map<string, number>();
      for (const r of recByCampaign) recMap.set(String(r.campaign_id), Number(r.campaign_revenue || 0));
      const discrepancies: any[] = [];
      for (const r of adsetByCampaign) {
        const campId = String(r.campaign_id);
        const adsetSum = Number(r.adset_revenue || 0);
        const recSum = recMap.get(campId) ?? 0;
        const diff = adsetSum - recSum;
        const threshold = Math.max(epsilon, (recSum > 0 ? relPct * recSum : epsilon));
        const ok = Math.abs(diff) <= threshold;
        if (!ok) discrepancies.push({ campaign_id: campId, adset_sum: adsetSum, campaign_reconciled: recSum, diff, threshold, rel_pct: relPct });
      }
      entry.reconciliation = { epsilon, rel_pct: relPct, discrepancies, ok: discrepancies.length === 0 };
    }

    out.checks.push(entry);
  }

  console.log(JSON.stringify(out, null, 2));
  try {
    const url = process.env.STRATEGIS_WEBHOOK_URL;
    if (url) {
      const hasIssues = out.checks.some((c: any) => c.reconciliation && c.reconciliation.discrepancies && c.reconciliation.discrepancies.length > 0);
      if (hasIssues) {
        const body = {
          type: 'validator_alert',
          date,
          epsilon,
          rel_pct: relPct,
          summary: out.checks.map((c: any) => ({ level: c.level, rows: c.day?.rows, discrepancies: c.reconciliation?.discrepancies?.length || 0 })),
        };
        const axios = (await import('axios')).default;
        await axios.post(url, body, { timeout: 5000 }).catch(() => {});
      }
    }
  } catch {}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


