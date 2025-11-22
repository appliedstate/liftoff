import 'dotenv/config';
import axios from 'axios';
import https from 'https';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, runSql, sqlNumber, sqlString } from '../../lib/monitoringDb';
import { createStrategistClient } from '../../lib/strategistClient';

type SessionAggregate = {
  campaignId: string;
  clickHour: number;
  sessions: number;
  revenue: number;
  rpc: number;
};

type CampaignMeta = {
  campaign_id: string;
  owner?: string | null;
  lane?: string | null;
  category?: string | null;
  media_source?: string | null;
};

function getFlag(name: string, def?: string): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def ?? '';
  return arg.slice(key.length);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function parseCsv(input: string): { header: string[]; rows: Record<string, string>[] } {
  const text = input.trim();
  if (!text) return { header: [], rows: [] };
  const lines = text.split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return { header, rows };
}

function toNumber(val: string | undefined): number | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function loadCampaignMeta(
  conn: ReturnType<typeof createMonitoringConnection>,
  campaignIds: string[]
): Promise<Map<string, CampaignMeta>> {
  const metadata = new Map<string, CampaignMeta>();
  const uniqueIds = Array.from(new Set(campaignIds));
  if (!uniqueIds.length) return metadata;

  for (const group of chunk(uniqueIds, 200)) {
    const sql = `
      SELECT campaign_id, owner, lane, category, media_source
      FROM campaign_index
      WHERE campaign_id IN (${group.map((id) => sqlString(id)).join(',')})
      ORDER BY campaign_id, date DESC, updated_at DESC
    `;
    const rows = await allRows<CampaignMeta>(conn, sql);
    for (const row of rows) {
      if (!metadata.has(row.campaign_id)) {
        metadata.set(row.campaign_id, row);
      }
    }
  }
  return metadata;
}

async function insertAggregates(
  conn: ReturnType<typeof createMonitoringConnection>,
  date: string,
  aggregates: SessionAggregate[],
  meta: Map<string, CampaignMeta>
): Promise<void> {
  for (const agg of aggregates) {
    const m = meta.get(agg.campaignId);
    const deleteSql = `
      DELETE FROM session_hourly_metrics
      WHERE date = ${sqlString(date)}
        AND campaign_id = ${sqlString(agg.campaignId)}
        AND click_hour = ${agg.clickHour};
    `;
    await runSql(conn, deleteSql);
    const insertSql = `
      INSERT INTO session_hourly_metrics (
        date,
        campaign_id,
        click_hour,
        sessions,
        revenue,
        rpc,
        traffic_source,
        owner,
        lane,
        category,
        media_source,
        ingested_at
      ) VALUES (
        ${sqlString(date)},
        ${sqlString(agg.campaignId)},
        ${agg.clickHour},
        ${agg.sessions},
        ${sqlNumber(agg.revenue)},
        ${sqlNumber(agg.rpc)},
        ${sqlString(m?.media_source || null)},
        ${sqlString(m?.owner || null)},
        ${sqlString(m?.lane || null)},
        ${sqlString(m?.category || null)},
        ${sqlString(m?.media_source || null)},
        CURRENT_TIMESTAMP
      );
    `;
    await runSql(conn, insertSql);
  }
}

async function recordRun(
  conn: ReturnType<typeof createMonitoringConnection>,
  info: { date: string; maxClickHour: number; sessionCount: number; campaignCount: number; status: 'success' | 'failed'; message?: string }
): Promise<void> {
  const sql = `
    INSERT INTO session_ingest_runs (date, max_click_hour, session_count, campaign_count, status, message, finished_at)
    VALUES (
      ${sqlString(info.date)},
      ${info.maxClickHour},
      ${info.sessionCount},
      ${info.campaignCount},
      ${sqlString(info.status)},
      ${sqlString(info.message || null)},
      CURRENT_TIMESTAMP
    )
  `;
  await runSql(conn, sql);
}

async function fetchSessionCsv(date: string, limitParam: string, mode: string): Promise<string> {
  const query = {
    date,
    filterZero: '1',
    incremental: '1',
    limit: limitParam || '-1',
    offset: '0',
    output: 'csv',
  };
  if (mode === 'remote') {
    const client = createStrategistClient();
    const data = await client.get('/api/system1/session-revenue', query, 'text');
    if (typeof data !== 'string') {
      throw new Error('Strategist session-revenue API did not return CSV text');
    }
    return data;
  }

  const baseUrl = 'https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev';
  const params = new URLSearchParams(query);
  const agent = new https.Agent({ rejectUnauthorized: false });
  const response = await axios.get(`${baseUrl}?${params.toString()}`, {
    responseType: 'text',
    timeout: 120000,
    httpsAgent: agent,
  });
  return String(response.data || '');
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const maxHour = Number(getFlag('max-hour', '23'));
  const maxClickHour = Number.isFinite(maxHour) ? Math.max(0, Math.min(maxHour, 23)) : 23;
  const limitParam = getFlag('limit', '-1');
  const mode = getFlag('mode', 'direct').toLowerCase();

  console.log(`[ingestSessionMetrics] Fetching session CSV for ${date} (<= hour ${maxClickHour}) via ${mode} mode...`);
  const csv = await fetchSessionCsv(date, limitParam, mode);
  const parsed = parseCsv(csv);
  console.log(`[ingestSessionMetrics] Received ${parsed.rows.length} rows`);

  const aggregatesMap = new Map<string, SessionAggregate>();
  let totalSessions = 0;

  for (const row of parsed.rows) {
    const campaignId = row['campaign_id']?.trim();
    if (!campaignId) continue;
    const ch = toNumber(row['click_hour']);
    if (ch === null || ch > maxClickHour) continue;
    const revenue =
      toNumber(row['total_revenue']) ??
      toNumber(row['revenue']) ??
      toNumber(row['revenue_usd']) ??
      0;
    const key = `${campaignId}|${ch}`;
    const agg = aggregatesMap.get(key) || {
      campaignId,
      clickHour: ch,
      sessions: 0,
      revenue: 0,
      rpc: 0,
    };
    agg.sessions += 1;
    agg.revenue += revenue || 0;
    aggregatesMap.set(key, agg);
    totalSessions += 1;
  }

  const aggregates: SessionAggregate[] = [];
  for (const agg of aggregatesMap.values()) {
    agg.rpc = agg.sessions > 0 ? agg.revenue / agg.sessions : 0;
    aggregates.push(agg);
  }
  aggregates.sort((a, b) => (a.campaignId === b.campaignId ? a.clickHour - b.clickHour : a.campaignId.localeCompare(b.campaignId)));
  console.log(`[ingestSessionMetrics] Aggregated ${aggregates.length} (campaign, hour) rows across ${aggregatesMap.size} keys`);

  const campaignIds = Array.from(new Set(aggregates.map((a) => a.campaignId)));
  const campaignCount = campaignIds.length;
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const meta = await loadCampaignMeta(conn, campaignIds);
    await insertAggregates(conn, date, aggregates, meta);
    await recordRun(conn, {
      date,
      maxClickHour,
      sessionCount: totalSessions,
      campaignCount,
      status: 'success',
    });
    console.log(`[ingestSessionMetrics] Stored aggregates for ${campaignIds.length} campaigns (sessions: ${totalSessions})`);
  } catch (err: any) {
    await recordRun(conn, {
      date,
      maxClickHour,
      sessionCount: totalSessions,
      campaignCount,
      status: 'failed',
      message: err?.message || String(err),
    });
    throw err;
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('[ingestSessionMetrics] Fatal error:', err);
  process.exit(1);
});

