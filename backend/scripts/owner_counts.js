// Compute per-owner counts of campaigns and adsets from Strategist day snapshots (Facebook)
// Usage: node backend/scripts/owner_counts.js [YYYY-MM-DD]
const path = require('path');
const duckdb = require('duckdb');

(async () => {
  const date = process.argv[2] || '2025-11-06';
  const base = path.resolve(__dirname, '../data/snapshots/facebook/day');
  const globCamp = path.join(base, `*/level=campaign/date=${date}`, '*.csv');
  const globAdset = path.join(base, `*/level=adset/date=${date}`, '*.csv');

  function escapeSqlLiteral(s) {
    return String(s).replace(/'/g, "''");
  }

  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const sql = `
WITH camp AS (
  SELECT COALESCE(lower(owner), 'unknown') AS owner,
         COUNT(DISTINCT campaign_id) AS campaigns
  FROM read_csv_auto('${escapeSqlLiteral(globCamp)}', IGNORE_ERRORS=TRUE)
  WHERE date = '${escapeSqlLiteral(date)}'
  GROUP BY 1
),
adset AS (
  SELECT COALESCE(lower(owner), 'unknown') AS owner,
         COUNT(DISTINCT adset_id) AS adsets
  FROM read_csv_auto('${escapeSqlLiteral(globAdset)}', IGNORE_ERRORS=TRUE)
  WHERE date = '${escapeSqlLiteral(date)}'
  GROUP BY 1
)
SELECT COALESCE(c.owner, a.owner) AS owner,
       COALESCE(c.campaigns, 0) AS campaigns,
       COALESCE(a.adsets, 0) AS adsets
FROM camp c
FULL OUTER JOIN adset a USING(owner)
ORDER BY 1;`;

  await new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) return reject(err);
      const out = rows.map((r) => ({
        owner: r.owner,
        campaigns: Number(r.campaigns) || 0,
        adsets: Number(r.adsets) || 0,
      }));
      console.log(JSON.stringify(out, null, 2));
      resolve();
    });
  }).catch((err) => {
    console.error('Query error:', err?.message || err);
    process.exit(1);
  }).finally(() => {
    try { conn.close(); } catch {}
  });
})();

