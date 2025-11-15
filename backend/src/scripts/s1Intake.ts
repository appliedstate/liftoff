import fs from 'fs';
import path from 'path';
import duckdb from 'duckdb';

type Flags = {
  source: string;
  week: string; // YYYY-WW
  exportMode?: 'docs' | 'none';
  rpc_floor: number;
  revenue_floor: number;
  locales?: string; // CSV list
  spanish_threshold?: string;
  mapping?: string; // mapping csv path
  data_root: string;
  reports_root: string;
};

function parseFlags(): Flags {
  const raw = process.argv.slice(2);
  const args: Record<string, string> = {};
  for (let i = 0; i < raw.length; i++) {
    const token = raw[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      const k = token.slice(2, eq);
      const v = token.slice(eq + 1);
      args[k] = v;
    } else {
      const k = token.replace(/^--/, '');
      const next = raw[i + 1];
      if (next && !next.startsWith('--')) {
        args[k] = next;
        i++;
      } else {
        args[k] = 'true';
      }
    }
  }
  const flags: Flags = {
    source: String(args.source || ''),
    week: String(args.week || ''),
    exportMode: (args.export || 'none') as any,
    rpc_floor: parseFloat(String(args.rpc_floor ?? '2.0')),
    revenue_floor: parseFloat(String(args.revenue_floor ?? '1000')),
    locales: args.locales ? String(args.locales) : undefined,
    spanish_threshold: args.spanish_threshold ? String(args.spanish_threshold) : undefined,
    mapping: args.mapping ? String(args.mapping) : undefined,
    data_root: path.resolve(String(args.data_root || path.resolve(__dirname, '../../data'))),
    reports_root: path.resolve(String(args.reports_root || path.resolve(__dirname, '../../reports'))),
  };
  if (!flags.source || !flags.week) {
    console.error('Usage: ts-node src/scripts/s1Intake.ts --source <path_or_url> --week <YYYY-WW> [--export docs] [--rpc_floor 2.0 --revenue_floor 1000 --mapping ./configs/s1_category_mapping.csv --data_root ./data --reports_root ./reports]');
    process.exit(1);
  }
  return flags;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function run(): Promise<void> {
  const flags = parseFlags();
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  const run = (sql: string) => new Promise<void>((resolve, reject) => (conn as any).run(sql, (err: Error | null) => err ? reject(err) : resolve()));
  const all = (sql: string) => new Promise<any[]>((resolve, reject) => (conn as any).all(sql, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows)));

  const escaped = flags.source.replace(/'/g, "''");
  await run(`CREATE TABLE src AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true);`);

  // Optional mapping
  if (flags.mapping && fs.existsSync(flags.mapping)) {
    const mapEsc = flags.mapping.replace(/'/g, "''");
    await run(`CREATE TABLE mapping AS SELECT * FROM read_csv_auto('${mapEsc}', header=true, all_varchar=true, ignore_errors=true);`);
  } else {
    await run(`CREATE TABLE mapping (raw_category VARCHAR, raw_angle VARCHAR, raw_article VARCHAR, normalized_category VARCHAR, category_index VARCHAR);`);
  }

  // Normalize
  await run(`
    CREATE VIEW base AS
    SELECT
      '${flags.week}' AS week,
      's1' AS source,
      TRIM(COALESCE("TOPIC_VERTICAL", '')) AS raw_category,
      TRIM(COALESCE("MOST_GRANULAR_TOPIC", '')) AS raw_angle_raw,
      TRIM(COALESCE("CONTENT_SLUG", '')) AS raw_article,
      TRIM(COALESCE("SERP_KEYWORD", '')) AS keyword,
      UPPER(NULLIF(TRIM(COALESCE("REGION_CODE", '')), 'None')) AS state,
      TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE) AS clicks,
      TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) AS revenue_usd,
      TRY_CAST(REPLACE(COALESCE("SELLSIDE_SEARCHES", ''), ',', '') AS DOUBLE) AS searches,
      'US' AS locale,
      NOW() AS ingested_at
    FROM src
    WHERE TRIM(COALESCE("SERP_KEYWORD", '')) <> ''
  `);

  await run(`
    CREATE VIEW with_angle AS
    SELECT *,
      CASE
        WHEN LOWER(keyword) LIKE '%loan%' OR LOWER(keyword) LIKE '%cash%' OR LOWER(keyword) LIKE '%payday%' THEN 'Loans'
        WHEN LOWER(keyword) LIKE '%insurance%' OR LOWER(keyword) LIKE '%quote%' OR LOWER(keyword) LIKE '%full coverage%' THEN 'Insurance Quotes'
        WHEN LOWER(keyword) LIKE '%depression%' AND LOWER(keyword) LIKE '%anxiety%' THEN 'Depression + Anxiety'
        WHEN LOWER(keyword) LIKE '%depression%' THEN 'Depression'
        WHEN LOWER(keyword) LIKE '%anxiety%' THEN 'Anxiety'
        WHEN LOWER(keyword) LIKE '%substance%' OR LOWER(keyword) LIKE '%drug%' THEN 'Substance Abuse'
        WHEN LOWER(keyword) LIKE '%diabetes%' THEN 'Diabetes'
        WHEN LOWER(keyword) LIKE '%back pain%' OR LOWER(keyword) LIKE '%lower back%' THEN 'Back Pain'
        WHEN LOWER(keyword) LIKE '%erectile%' OR LOWER(keyword) LIKE 'ed %' OR LOWER(keyword) LIKE '% ed' THEN 'ED'
        WHEN LOWER(keyword) LIKE '%dental implant%' THEN 'Dental Implants'
        WHEN LOWER(keyword) LIKE '%coolsculpt%' OR LOWER(keyword) LIKE '%belly fat%' OR LOWER(keyword) LIKE '%weight%' THEN 'Weight Loss / Body Contour'
        WHEN LOWER(keyword) LIKE '%adhd%' OR LOWER(keyword) LIKE '%adderall%' OR LOWER(keyword) LIKE '%prescription%' THEN 'ADHD / Online Rx'
        WHEN LOWER(keyword) LIKE '%casino%' OR LOWER(keyword) LIKE '%real money%' THEN 'Casino / Real Money'
        WHEN LOWER(keyword) LIKE '%medicare%' OR LOWER(keyword) LIKE '%flex card%' OR LOWER(keyword) LIKE '%giveback%' THEN 'Medicare Benefits'
        WHEN LOWER(keyword) LIKE '%checking bonus%' OR LOWER(keyword) LIKE '%open account%' THEN 'Bank Bonuses'
        WHEN LOWER(keyword) LIKE '%free phone%' OR LOWER(keyword) LIKE '%government cell%' THEN 'ACP / Free Phone'
        ELSE 'Other'
      END AS raw_angle
    FROM base
  `);

  await run(`
    CREATE VIEW normalized_src AS
    SELECT
      w.week,
      w.source,
      COALESCE(m.normalized_category, w.raw_category) AS normalized_category,
      COALESCE(m.category_index, w.raw_angle) AS category_index,
      w.raw_category,
      w.raw_angle AS raw_angle,
      w.raw_article AS article_slug,
      w.state,
      CAST(w.clicks AS BIGINT) AS clicks,
      CAST(w.revenue_usd AS DOUBLE) AS revenue_usd,
      CAST(w.searches AS DOUBLE) AS searches,
      CASE WHEN w.clicks > 0 THEN w.revenue_usd / w.clicks ELSE NULL END AS rpc,
      w.locale,
      w.ingested_at
    FROM with_angle w
    LEFT JOIN mapping m
      ON (LOWER(COALESCE(m.raw_article, '')) = LOWER(COALESCE(w.raw_article, '')))
        OR (LOWER(COALESCE(m.raw_category, '')) = LOWER(COALESCE(w.raw_category, '')) AND LOWER(COALESCE(m.raw_angle, '')) = LOWER(COALESCE(w.raw_angle, '')))
  `);

  // Persist parquet (partition by week)
  const parquetDir = path.join(flags.data_root, 's1', 'normalized', `week=${flags.week}`);
  ensureDir(parquetDir);
  const parquetFile = path.join(parquetDir, 'part-00001.parquet');
  await run(`COPY (SELECT * FROM normalized_src) TO '${parquetFile.replace(/'/g, "''")}' (FORMAT 'parquet');`);

  // Metrics
  await run(`
    CREATE VIEW per_category AS
    SELECT category_index,
           SUM(clicks) AS clicks,
           SUM(revenue_usd) AS revenue_usd,
           SUM(searches) AS searches,
           CASE WHEN SUM(clicks) > 0 THEN SUM(revenue_usd) / SUM(clicks) ELSE NULL END AS rpc
    FROM normalized_src
    GROUP BY 1
  `);

  await run(`
    CREATE VIEW per_category_state AS
    SELECT category_index, state,
           SUM(clicks) AS clicks,
           SUM(revenue_usd) AS revenue_usd,
           SUM(searches) AS searches,
           CASE WHEN SUM(clicks) > 0 THEN SUM(revenue_usd) / SUM(clicks) ELSE NULL END AS rpc,
           CASE WHEN SUM(searches) > 0 THEN SUM(revenue_usd) / SUM(searches) ELSE NULL END AS rps
    FROM normalized_src
    GROUP BY 1,2
  `);

  const reportsDir = path.join(flags.reports_root, 's1', flags.week);
  ensureDir(reportsDir);

  // Selection
  await run(`
    CREATE VIEW shortlisted AS
    SELECT category_index, clicks, revenue_usd, searches, rpc,
      CASE
        WHEN rpc >= ${flags.rpc_floor} THEN 'rpc_floor'
        WHEN revenue_usd >= ${flags.revenue_floor} THEN 'revenue_floor'
        ELSE 'other'
      END AS rationale
    FROM per_category
    WHERE (rpc >= ${flags.rpc_floor}) OR (revenue_usd >= ${flags.revenue_floor})
    ORDER BY revenue_usd DESC
  `);

  const writeCsv = async (rows: any[], outPath: string) => {
    if (!rows || rows.length === 0) { fs.writeFileSync(outPath, ''); return; }
    const keys = Object.keys(rows[0]);
    const lines = [keys.join(',')].concat(rows.map(r => keys.map(k => r[k] ?? '').join(',')));
    fs.writeFileSync(outPath, lines.join('\n'));
  };

  const shortlist = await all(`SELECT * FROM shortlisted`);
  await writeCsv(shortlist, path.join(reportsDir, 'category_shortlist.csv'));

  // Per-category state tables for shortlisted
  for (const row of shortlist) {
    const cat = String(row.category_index).replace(/'/g, "''");
    const rows = await all(`
      SELECT state, clicks, revenue_usd, searches, rpc, rps
      FROM per_category_state
      WHERE category_index = '${cat}' AND clicks >= 50
      ORDER BY rpc DESC, searches DESC
    `);
    const safeName = String(row.category_index).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$|/g, '');
    await writeCsv(rows, path.join(reportsDir, `rpc_by_state_${safeName}.csv`));
  }

  // Markdown emissions (overview + per-category targets)
  if (flags.exportMode === 'docs') {
    const docsRoot = path.resolve(__dirname, '../../docs/operating-cadence/factory', flags.week);
    ensureDir(docsRoot);
    const targetsDir = path.join(docsRoot, 'targets');
    ensureDir(targetsDir);
    const ticketsDir = path.join(docsRoot, 'tickets');
    ensureDir(ticketsDir);

    // shortlist.md
    const md = ['# S1 Category Short-List', '', `Week: ${flags.week}`, '', '| Category | Clicks | Revenue | RPC | Rationale |', '|---|---:|---:|---:|---|'];
    for (const r of shortlist) md.push(`| ${r.category_index} | ${Math.round(Number(r.clicks) || 0)} | ${(+r.revenue_usd).toFixed(2)} | ${(Number(r.rpc) || 0).toFixed(2)} | ${r.rationale} |`);
    fs.writeFileSync(path.join(docsRoot, 'shortlist.md'), md.join('\n'));

    // per-category target stubs
    for (const r of shortlist) {
      const cat = String(r.category_index);
      const safe = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const stateCsv = path.relative(docsRoot, path.join(reportsDir, `rpc_by_state_${safe}.csv`));
      const ticket = [
        `# Build: ${cat}`,
        '',
        `Week: ${flags.week}`,
        '',
        `- Metrics: clicks=${Math.round(Number(r.clicks) || 0)}, revenue=${(+r.revenue_usd).toFixed(2)}, rpc=${(Number(r.rpc) || 0).toFixed(2)}`,
        `- State targets CSV: ${stateCsv}`,
        '',
        '## Creative Notes',
        '- [ ] Angle hooks',
        '- [ ] Primary text / headline / CTA',
        '',
        '## Build Checklist',
        '- [ ] Campaign',
        '- [ ] Ad sets per state group',
        '- [ ] Ads (variants)',
      ].join('\n');
      fs.writeFileSync(path.join(targetsDir, `${safe}.md`), `# Targets: ${cat}\n\nSee: ${stateCsv}\n`);
      fs.writeFileSync(path.join(ticketsDir, `${safe}-build.md`), ticket);
    }
  }

  // Manifest
  const manifest = {
    input: flags.source,
    week: flags.week,
    thresholds: { rpc_floor: flags.rpc_floor, revenue_floor: flags.revenue_floor },
    parquet: parquetFile,
    reports_dir: reportsDir,
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(reportsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  conn.close(() => db.close(() => process.exit(0)));
}

run().catch((e) => { console.error(e); process.exit(1); });


