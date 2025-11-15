/* Estimate how many campaigns/ad sets/ads (or budget scale) needed to reach $500k/month
 * using the last two days (Nov 9 and Nov 10) as baseline. Pulls Strategis CSVs and aggregates.
 *
 * Targets:
 * - Monthly contribution target: $500,000
 * - Daily target ≈ $16,666.67
 *
 * Levels: campaign, adset, ad
 * Joins by campaign_id, ad_set_id, ad_id.
 * Contribution = revenue - spend
 */
const https = require('https');
const { URL } = require('url');

const DATES = ['2025-11-09', '2025-11-10'];
const DAILY_TARGET = 500000 / 30; // ≈ 16,666.67

const REVENUE_URL = 'https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev';
const SPEND_URL = 'https://staging-dot-strategis-273115.appspot.com/api/facebook/spend-report';

function httpGet(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const { statusCode } = res;
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms for ${url}`));
    });
    req.on('error', reject);
  });
}

function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length === 1 && fields[0] === '') continue;
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = fields[j] !== undefined ? fields[j] : '';
    }
    rows.push(row);
  }
  return { header, rows };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

async function fetchCsvRows(urlBase, params) {
  const url = new URL(urlBase);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const buf = await httpGet(url.toString(), 120000);
  return parseCsv(buf).rows;
}

function toNumber(x) {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  const s = String(x).replace(/[$,]/g, '').trim();
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function keyByLevel(level, r) {
  if (level === 'campaign') return r.campaign_id || r.campaign || '';
  if (level === 'adset') return (r.campaign_id || '') + '|' + (r.ad_set_id || r.adset_id || '');
  return (r.campaign_id || '') + '|' + (r.ad_set_id || r.adset_id || '') + '|' + (r.ad_id || '');
}

async function fetchDay(day) {
  const revRows = await fetchCsvRows(REVENUE_URL, {
    date: day, filterZero: '1', incremental: '1', limit: '-1', offset: '0', output: 'csv',
  });
  const spendRows = await fetchCsvRows(SPEND_URL, {
    date: day, filterZero: '0', incremental: '1', limit: '-1', offset: '0', output: 'csv',
  });
  return { day, revRows, spendRows };
}

function aggregateByLevel(level, dayData) {
  // Build maps of revenue and spend by key
  const revMap = new Map();
  for (const r of dayData.revRows) {
    const k = keyByLevel(level, r);
    const rev = toNumber(r.total_revenue);
    if (!revMap.has(k)) revMap.set(k, 0);
    revMap.set(k, revMap.get(k) + rev);
  }
  const spendMap = new Map();
  for (const r of dayData.spendRows) {
    const k = keyByLevel(level, r);
    const spend = toNumber(r.total_spend);
    if (!spendMap.has(k)) spendMap.set(k, 0);
    spendMap.set(k, spendMap.get(k) + spend);
  }
  // Join keys
  const keys = new Set([...revMap.keys(), ...spendMap.keys()]);
  const rows = [];
  let totalRevenue = 0;
  let totalSpend = 0;
  for (const k of keys) {
    const revenue = revMap.get(k) || 0;
    const spend = spendMap.get(k) || 0;
    const cm = revenue - spend;
    totalRevenue += revenue;
    totalSpend += spend;
    rows.push({ key: k, revenue, spend, cm });
  }
  return { rows, totals: { revenue: totalRevenue, spend: totalSpend, cm: totalRevenue - totalSpend } };
}

function mean(values) {
  if (!values.length) return 0;
  const s = values.reduce((a, b) => a + b, 0);
  return s / values.length;
}

function computeStatsAcrossDays(level, perDayAgg) {
  // Per entity per day CM; then average per entity across available days
  const perEntityDaily = new Map(); // key -> array of daily cm
  for (const dayAgg of perDayAgg) {
    for (const r of dayAgg.rows) {
      if (!perEntityDaily.has(r.key)) perEntityDaily.set(r.key, []);
      perEntityDaily.get(r.key).push(r.cm);
    }
  }
  const entityAvgDaily = [];
  for (const [key, arr] of perEntityDaily.entries()) {
    if (arr.length === 0) continue;
    entityAvgDaily.push({ key, avgDailyCm: mean(arr) });
  }
  const meanPerEntityPerDay = mean(entityAvgDaily.map((e) => e.avgDailyCm));
  const activeEntities = entityAvgDaily.length;
  const totalDailyAvg = mean(perDayAgg.map((a) => a.totals.cm)); // average of day totals
  return { meanPerEntityPerDay, activeEntities, totalDailyAvg, entityAvgDaily };
}

function formatUsd(n) {
  return `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

async function run() {
  const dayData = [];
  for (const d of DATES) {
    dayData.push(await fetchDay(d));
  }
  const levels = ['campaign', 'adset', 'ad'];
  const out = [];
  for (const level of levels) {
    const perDayAgg = dayData.map((dd) => aggregateByLevel(level, dd));
    const stats = computeStatsAcrossDays(level, perDayAgg);
    const requiredEntities = stats.meanPerEntityPerDay > 0 ? DAILY_TARGET / stats.meanPerEntityPerDay : Infinity;
    const scaleFactorCurrentPortfolio = stats.totalDailyAvg > 0 ? DAILY_TARGET / stats.totalDailyAvg : Infinity;
    out.push({
      level,
      activeEntities: stats.activeEntities,
      meanContributionPerEntityPerDay: stats.meanPerEntityPerDay,
      avgDailyPortfolioContribution: stats.totalDailyAvg,
      requiredEntitiesRounded: isFinite(requiredEntities) ? Math.ceil(requiredEntities) : null,
      scaleFactorIfOnlyBudgetScaling: isFinite(scaleFactorCurrentPortfolio) ? scaleFactorCurrentPortfolio : null,
    });
  }

  // Print results
  console.log(`Baseline dates: ${DATES.join(', ')}`);
  console.log(`Monthly target: ${formatUsd(500000)}  |  Daily target: ${formatUsd(DAILY_TARGET)}`);
  console.log('');
  console.log('| Level | Active Entities | Mean CM/Entity/Day | Avg Daily CM (Portfolio) | Required Entities (to hit daily target) | Scale Factor (budget only) |');
  console.log('| --- | ---:| ---:| ---:| ---:| ---:|');
  for (const r of out) {
    console.log(
      `| ${r.level} | ${r.activeEntities} | ${formatUsd(r.meanContributionPerEntityPerDay)} | ${formatUsd(r.avgDailyPortfolioContribution)} | ${r.requiredEntitiesRounded ?? '—'} | ${r.scaleFactorIfOnlyBudgetScaling ? r.scaleFactorIfOnlyBudgetScaling.toFixed(2) + 'x' : '—'} |`
    );
  }
}

run().catch((err) => {
  console.error('estimate_scale_to_500k failed:', err && err.message ? err.message : err);
  process.exit(1);
});



