#!/usr/bin/env node
/**
 * Pull Strategis session-level revenue data for a recent date range and
 * compute revenue-per-click (RPC) deltas by Facebook campaign.
 *
 * Usage:
 *   node scripts/session_rpc_by_campaign.js --days=2
 *   node scripts/session_rpc_by_campaign.js --start=2025-11-19 --end=2025-11-20
 *   node scripts/session_rpc_by_campaign.js --start=2025-11-21 --max-click-hour=12 --max-click-hour-dates=2025-11-21
 *
 * Flags:
 *   --days=n         Number of trailing full days (default 2, max 7)
 *   --start=YYYY-MM-DD
 *   --end=YYYY-MM-DD (optional; defaults to start)
 *   --limit=n        API limit (default -1 for all rows)
 *   --max-click-hour=h  Only include sessions with click_hour <= h (0-23)
 *   --max-click-hour-dates=YYYY-MM-DD[,YYYY-MM-DD...]  Restrict the click-hour filter to specific dates
 */

const https = require('https');
const { URL } = require('url');

const SESSION_REV_URL = 'https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev';

// Allow hitting the staging endpoint that uses a self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 2, limit: -1, maxClickHour: null, maxClickHourDates: null };
  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      opts.days = Math.min(7, Math.max(1, Number(arg.split('=')[1]) || 2));
    } else if (arg.startsWith('--start=')) {
      opts.start = arg.split('=')[1];
    } else if (arg.startsWith('--end=')) {
      opts.end = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      opts.limit = Number(arg.split('=')[1]) || -1;
    } else if (arg.startsWith('--max-click-hour=')) {
      const v = Number(arg.split('=')[1]);
      if (!Number.isFinite(v) || v < 0 || v > 23) {
        throw new Error('--max-click-hour must be between 0 and 23');
      }
      opts.maxClickHour = v;
    } else if (arg.startsWith('--max-click-hour-dates=')) {
      const dates = arg.split('=')[1];
      const parts = dates
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
      if (parts.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
        throw new Error('--max-click-hour-dates must be comma-separated YYYY-MM-DD values');
      }
      opts.maxClickHourDates = new Set(parts);
    }
  }
  if (opts.start && !/^\d{4}-\d{2}-\d{2}$/.test(opts.start)) {
    throw new Error('start must be YYYY-MM-DD');
  }
  if (opts.end && !/^\d{4}-\d{2}-\d{2}$/.test(opts.end)) {
    throw new Error('end must be YYYY-MM-DD');
  }
  if (opts.start && !opts.end) opts.end = opts.start;
  return opts;
}

function yyyyMmDd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function lastNDatesExcludingToday(n) {
  const today = new Date();
  const dates = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(yyyyMmDd(d));
  }
  return dates;
}

function enumerateDateRange(start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid start/end date');
  }
  if (endDate < startDate) {
    throw new Error('end must be >= start');
  }
  const dates = [];
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function httpGet(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout ${timeoutMs}ms for ${url}`)));
    req.on('error', reject);
  });
}

function parseCsv(buffer) {
  const text = buffer
    .toString('utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  const lines = text.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
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
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const clean = String(val).replace(/[$,]/g, '').trim();
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

async function fetchSessionRows(date, limit = -1) {
  const url = new URL(SESSION_REV_URL);
  url.searchParams.set('date', date);
  url.searchParams.set('filterZero', '1');
  url.searchParams.set('incremental', '1');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', '0');
  url.searchParams.set('output', 'csv');
  const buffer = await httpGet(url.toString());
  const { rows } = parseCsv(buffer);
  return rows;
}

function aggregateCampaigns(rows) {
  const campaigns = new Map();
  let sessions = 0;
  let revenue = 0;

  for (const row of rows) {
    const campaignId = row.campaign_id || 'unknown_campaign';
    const category = (row.category || '').trim();
    const adSetId = row.ad_set_id || row.adset_id || '';
    const keyword = (row.keyword || '').trim();
    const totalRevenue =
      toNumber(row.total_revenue) ||
      toNumber(row.revenue) ||
      toNumber(row.revenue_usd) ||
      0;
    sessions += 1;
    revenue += totalRevenue;

    if (!campaigns.has(campaignId)) {
      campaigns.set(campaignId, {
        campaign_id: campaignId,
        sessions: 0,
        revenue: 0,
        categories: new Map(),
        ad_sets: new Set(),
        keywords: new Map(),
      });
    }
    const entry = campaigns.get(campaignId);
    entry.sessions += 1;
    entry.revenue += totalRevenue;
    if (category) {
      entry.categories.set(category, (entry.categories.get(category) || 0) + 1);
    }
    if (adSetId) entry.ad_sets.add(adSetId);
    if (keyword) entry.keywords.set(keyword, (entry.keywords.get(keyword) || 0) + 1);
  }

  const toPlain = (map) => {
    const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return arr.length ? arr[0][0] : null;
  };

  const result = [];
  for (const entry of campaigns.values()) {
    result.push({
      campaign_id: entry.campaign_id,
      sessions: entry.sessions,
      revenue: entry.revenue,
      rpc: entry.sessions > 0 ? entry.revenue / entry.sessions : 0,
      top_category: toPlain(entry.categories),
      ad_set_count: entry.ad_sets.size,
      top_keyword: toPlain(entry.keywords),
    });
  }

  return {
    sessions,
    revenue,
    rpc: sessions > 0 ? revenue / sessions : 0,
    campaigns: result,
  };
}

function formatUsd(n) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNum(n, digits = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function printDailySummary(dates, daily) {
  console.log('\n### Session-Level Revenue Summary (All Campaigns)\n');
  console.log('| Date | Sessions | Revenue | RPC |');
  console.log('| --- | ---: | ---: | ---: |');
  for (const date of dates) {
    const data = daily[date];
    if (!data) {
      console.log(`| ${date} | — | — | — |`);
      continue;
    }
    console.log(
      `| ${date} | ${data.sessions.toLocaleString()} | ${formatUsd(data.revenue)} | ${formatUsd(
        data.rpc
      )} |`
    );
  }
}

function printCampaignDeltas(dates, daily) {
  if (dates.length < 2) return;
  const prevDate = dates[dates.length - 2];
  const currDate = dates[dates.length - 1];
  const prev = daily[prevDate]?.campaigns || [];
  const curr = daily[currDate]?.campaigns || [];
  const prevById = new Map(prev.map((c) => [c.campaign_id, c]));
  const currById = new Map(curr.map((c) => [c.campaign_id, c]));
  const campaigns = new Map([...prevById.keys(), ...currById.keys()].map((id) => [id, true]));
  const rows = [];

  for (const id of campaigns.keys()) {
    const p = prevById.get(id);
    const c = currById.get(id);
    const topCategory = (c && c.top_category) || (p && p.top_category) || '';
    rows.push({
      campaign_id: id,
      topCategory,
      prevSessions: p?.sessions || 0,
      prevRpc: p?.rpc || 0,
      currSessions: c?.sessions || 0,
      currRpc: c?.rpc || 0,
      deltaRpc: (c?.rpc || 0) - (p?.rpc || 0),
      deltaSessions: (c?.sessions || 0) - (p?.sessions || 0),
      currRevenue: c?.revenue || 0,
    });
  }

  rows.sort((a, b) => Math.abs(b.deltaRpc) - Math.abs(a.deltaRpc));
  const topRows = rows.slice(0, 15);

  console.log(`\n### Top Campaign RPC Shifts (${prevDate} → ${currDate})\n`);
  console.log('| Campaign ID | Category | Sessions (Prev) | RPC (Prev) | Sessions (Curr) | RPC (Curr) | Δ RPC | Δ Sessions |');
  console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of topRows) {
    console.log(
      `| ${row.campaign_id} | ${row.topCategory || '—'} | ${row.prevSessions.toLocaleString()} | ${formatUsd(
        row.prevRpc
      )} | ${row.currSessions.toLocaleString()} | ${formatUsd(row.currRpc)} | ${formatUsd(
        row.deltaRpc
      )} | ${row.deltaSessions.toLocaleString()} |`
    );
  }
}

async function main() {
  try {
    const opts = parseArgs();
    const dates = opts.start
      ? enumerateDateRange(opts.start, opts.end)
      : lastNDatesExcludingToday(opts.days);
    const daily = {};
    for (const date of dates) {
      process.stderr.write(`Fetching ${date}...\n`);
      const rows = await fetchSessionRows(date, opts.limit);
      const shouldFilter =
        opts.maxClickHour !== null &&
        (!opts.maxClickHourDates || opts.maxClickHourDates.has(date));
      const filtered =
        shouldFilter
          ? rows.filter((row) => {
              const chRaw = row.click_hour ?? row.clickHour ?? '';
              const ch = Number(chRaw);
              return Number.isFinite(ch) && ch <= opts.maxClickHour;
            })
          : rows;
      daily[date] = aggregateCampaigns(filtered);
    }
    printDailySummary(dates, daily);
    printCampaignDeltas(dates, daily);
    console.log('\nDone.\n');
  } catch (err) {
    console.error('session_rpc_by_campaign failed:', err.message || err);
    process.exit(1);
  }
}

main();


