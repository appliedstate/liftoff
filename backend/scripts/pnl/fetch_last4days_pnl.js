/* Fetch last four days (Fri–Mon) P&L from Strategis endpoints and print a Markdown table.
 *
 * Endpoints:
 * - Session revenue (per session): https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev
 *   Params: date=YYYY-MM-DD, filterZero=1, incremental=1, limit=-1, offset=0, output=json
 *   Expected field summed: total_revenue
 *
 * - Facebook spend (daily): https://staging-dot-strategis-273115.appspot.com/api/facebook/spend-report
 *   Params: date=YYYY-MM-DD, output=json (or csv), filterZero=0, incremental=1, limit=-1, offset=0
 *   Expected field summed: spend_usd (fallbacks: spend, amount_spent)
 */
const https = require('https');
const { URL } = require('url');

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

function tryParseJson(buffer) {
  try {
    const text = buffer.toString('utf8');
    const first = text.trim()[0];
    if (first === '{' || first === '[') {
      return JSON.parse(text);
    }
    return null;
  } catch {
    return null;
  }
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

async function fetchRows(urlBase, params) {
  const url = new URL(urlBase);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const buf = await httpGet(url.toString());
  const asJson = tryParseJson(buf);
  if (asJson) {
    // Common patterns: array, or object with data/rows
    if (Array.isArray(asJson)) return asJson;
    if (Array.isArray(asJson.data)) return asJson.data;
    if (Array.isArray(asJson.rows)) return asJson.rows;
    // If object with 'results' or similar
    if (Array.isArray(asJson.results)) return asJson.results;
    // Fallback: single object isn't usable for summing
    return [];
  }
  const { rows } = parseCsv(buf);
  return rows;
}

function toNumber(x) {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  const s = String(x).replace(/[$,]/g, '').trim();
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function sumField(rows, candidates) {
  if (!rows || rows.length === 0) return 0;
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  // Find a matching field name once
  const keys = Object.keys(rows[0] || {}).map((k) => k.toLowerCase());
  let chosen = null;
  for (const c of lowerCandidates) {
    if (keys.includes(c)) {
      chosen = c;
      break;
    }
  }
  if (!chosen) {
    // Try fuzzy contains
    for (const c of lowerCandidates) {
      const hit = keys.find((k) => k.includes(c));
      if (hit) {
        chosen = hit;
        break;
      }
    }
  }
  if (!chosen) return 0;
  let sum = 0;
  for (const r of rows) {
    const val = Object.entries(r).reduce((acc, [k, v]) => {
      return k.toLowerCase() === chosen ? v : acc;
    }, 0);
    sum += toNumber(val);
  }
  return sum;
}

function formatUsd(n) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatRoas(n) {
  if (!isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function yyyyMmDd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastNDatesExcludingToday(n) {
  const today = new Date();
  const out = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(yyyyMmDd(d));
  }
  return out;
}

async function run() {
  const dates = lastNDatesExcludingToday(4); // Fri, Sat, Sun, Mon when run on Tuesday
  const revenueUrl = 'https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev';
  const spendUrl = 'https://staging-dot-strategis-273115.appspot.com/api/facebook/spend-report';

  const rows = [];
  for (const date of dates) {
    // Revenue
    const revParams = {
      date,
      filterZero: '1',
      incremental: '1',
      limit: '-1',
      offset: '0',
      output: 'csv', // use CSV to access total_revenue column directly
    };
    const revRows = await fetchRows(revenueUrl, revParams);
    const revenue =
      sumField(revRows, ['total_revenue']) ||
      sumField(revRows, ['revenue_usd', 'revenue']);

    // Spend
    const spendParams = {
      date,
      output: 'csv', // use CSV to access total_spend column directly
      filterZero: '0',
      incremental: '1',
      limit: '-1',
      offset: '0',
    };
    const spendRows = await fetchRows(spendUrl, spendParams);
    const spend =
      sumField(spendRows, ['total_spend']) ||
      sumField(spendRows, ['spend_usd']) ||
      sumField(spendRows, ['amount_spent', 'spend']);

    const roas = spend > 0 ? revenue / spend : 0;
    const contribution = revenue - spend;
    rows.push({ date, revenue, spend, roas, contribution });
  }

  // Print Markdown table
  const header = ['Date', 'Revenue', 'Spend', 'ROAS', 'Contribution Margin'];
  console.log(`| ${header.join(' | ')} |`);
  console.log(`| ${header.map(() => '---').join(' | ')} |`);
  for (const r of rows) {
    console.log(
      `| ${r.date} | ${formatUsd(r.revenue)} | ${formatUsd(r.spend)} | ${formatRoas(r.roas)} | ${formatUsd(r.contribution)} |`
    );
  }
}

run().catch((err) => {
  console.error('Failed to fetch P&L:', err && err.message ? err.message : err);
  process.exit(1);
});


