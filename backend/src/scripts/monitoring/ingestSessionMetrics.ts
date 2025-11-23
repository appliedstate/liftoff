import 'dotenv/config';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, runSql, sqlNumber, sqlString } from '../../lib/monitoringDb';
import { StrategisApi } from '../../lib/strategisApi';

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function valueToNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return valueToNumber(String(value));
}

function getNumber(row: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const val = valueToNumber(row[key]);
    if (val !== null && val !== undefined) return val;
  }
  return null;
}

function getString(row: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return null;
}

function normalizeId(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  return String(value);
}

function getHourFromRow(row: Record<string, any>): number | null {
  const direct = getNumber(row, ['hour', 'click_hour', 'hour_of_day', 'hour_of_click']);
  if (direct !== null && direct >= 0 && direct <= 23) return Math.floor(direct);
  const composite = getString(row, ['date_hour', 'dateHour']);
  if (composite) {
    const match = composite.match(/(\d{1,2})$/);
    if (match) {
      const h = Number(match[1]);
      if (Number.isFinite(h)) return Math.min(Math.max(h, 0), 23);
    }
  }
  const timestamp = getString(row, ['timestamp', 'click_time']);
  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return date.getUTCHours();
    }
  }
  return null;
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

async function fetchHourlyRows(date: string): Promise<any[]> {
  const api = new StrategisApi();
  return api.fetchS1Hourly(date);
}

async function main(): Promise<void> {
  const date = getFlag('date', todayUtc());
  const maxHour = Number(getFlag('max-hour', '23'));
  const maxClickHour = Number.isFinite(maxHour) ? Math.max(0, Math.min(maxHour, 23)) : 23;
  const mode = getFlag('mode', 'strategis').toLowerCase();
  if (mode !== 'strategis' && mode !== 'remote') {
    console.warn(`[ingestSessionMetrics] Unknown mode "${mode}", defaulting to strategis API`);
  }

  console.log(`[ingestSessionMetrics] Fetching Strategis hourly data for ${date} (<= hour ${maxClickHour}) ...`);
  const hourlyRows = await fetchHourlyRows(date);
  console.log(`[ingestSessionMetrics] Received ${hourlyRows.length} rows`);

  const aggregatesMap = new Map<string, SessionAggregate>();
  let totalSessions = 0;

  for (const row of hourlyRows) {
    const campaignId =
      normalizeId(row['strategisCampaignId']) ??
      normalizeId(row['strategiscampaignid']) ??
      normalizeId(row['campaign_id']) ??
      normalizeId(row['campaignId']);
    if (!campaignId) continue;

    const ch = getHourFromRow(row);
    if (ch === null || ch > maxClickHour) continue;

    const sessionsVal = getNumber(row, ['sessions', 'searches', 'visits', 'clicks']) ?? 0;
    const revenueVal =
      getNumber(row, ['estimated_revenue', 'revenue', 'revenue_usd', 'total_revenue']) ?? 0;
    const key = `${campaignId}|${ch}`;
    const agg = aggregatesMap.get(key) || {
      campaignId,
      clickHour: ch,
      sessions: 0,
      revenue: 0,
      rpc: 0,
    };
    agg.sessions += sessionsVal;
    agg.revenue += revenueVal;
    aggregatesMap.set(key, agg);
    totalSessions += sessionsVal;
  }

  const aggregates: SessionAggregate[] = [];
  for (const agg of aggregatesMap.values()) {
    agg.rpc = agg.sessions > 0 ? agg.revenue / agg.sessions : 0;
    aggregates.push(agg);
  }
  aggregates.sort((a, b) => (a.campaignId === b.campaignId ? a.clickHour - b.clickHour : a.campaignId.localeCompare(b.campaignId)));
  console.log(`[ingestSessionMetrics] Aggregated ${aggregates.length} (campaign, hour) rows`);

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
      sessionCount: Math.round(totalSessions),
      campaignCount,
      status: 'success',
    });
    console.log(`[ingestSessionMetrics] Stored aggregates for ${campaignIds.length} campaigns (sessions: ${totalSessions})`);
  } catch (err: any) {
    await recordRun(conn, {
      date,
      maxClickHour,
      sessionCount: Math.round(totalSessions),
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

