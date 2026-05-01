import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, runSql, sqlString } from './monitoringDb';

type IntentPacketOwnershipInput = {
  queueKey: string;
  primaryKeyword: string;
  packetName?: string | null;
  market?: string | null;
  ownerName?: string | null;
  queueStatus?: string;
  priority?: string;
  nextStep?: string | null;
  nextReviewAt?: string | null;
  blockerSummary?: string | null;
  metadata?: Record<string, any>;
};

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function jsonString(value: Record<string, any> | undefined): string {
  return JSON.stringify(value || {}).replace(/'/g, "''");
}

function queueStateRank(value: string): number {
  switch (value) {
    case 'stalled':
      return 0;
    case 'new':
      return 1;
    case 'assigned':
      return 2;
    case 'reviewing':
      return 3;
    case 'testing':
      return 4;
    case 'exploit':
      return 5;
    default:
      return 6;
  }
}

export async function upsertIntentPacketOwnership(input: IntentPacketOwnershipInput): Promise<void> {
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    await runSql(
      conn,
      `
        INSERT INTO intent_packet_exploration_queue (
          queue_key, primary_keyword, packet_name, market, owner_name, queue_status, priority,
          next_step, next_review_at, blocker_summary, metadata_json, updated_at
        ) VALUES (
          ${sqlString(input.queueKey)},
          ${sqlString(input.primaryKeyword)},
          ${sqlString(input.packetName || null)},
          ${sqlString(input.market || null)},
          ${sqlString(input.ownerName || null)},
          ${sqlString(input.queueStatus || 'assigned')},
          ${sqlString(input.priority || 'medium')},
          ${sqlString(input.nextStep || null)},
          ${sqlString(input.nextReviewAt || null)},
          ${sqlString(input.blockerSummary || null)},
          ${sqlString(jsonString(input.metadata))},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(queue_key) DO UPDATE SET
          primary_keyword = excluded.primary_keyword,
          packet_name = excluded.packet_name,
          market = excluded.market,
          owner_name = excluded.owner_name,
          queue_status = excluded.queue_status,
          priority = excluded.priority,
          next_step = excluded.next_step,
          next_review_at = excluded.next_review_at,
          blocker_summary = excluded.blocker_summary,
          metadata_json = excluded.metadata_json,
          updated_at = CURRENT_TIMESTAMP
      `
    );
  } finally {
    closeConnection(conn);
  }
}

export async function getIntentPacketOwnershipReport(options: { lookbackDays?: number; limit?: number } = {}): Promise<any> {
  const lookbackDays = options.lookbackDays || 14;
  const limit = options.limit || 12;
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const startDateTime = new Date(Date.now() - (lookbackDays - 1) * 86400000);
    startDateTime.setUTCHours(0, 0, 0, 0);
    const startDate = startDateTime.toISOString();

    const [summaryRows, queueRows] = await Promise.all([
      allRows<any>(
        conn,
        `
          WITH recent_packets AS (
            SELECT
              COALESCE(packet_id, packet_name, primary_keyword) AS queue_key,
              MAX(primary_keyword) AS primary_keyword,
              MAX(packet_name) AS packet_name,
              MAX(market) AS market,
              MAX(observed_at) AS last_observed_at,
              COUNT(*) AS observation_count,
              SUM(COALESCE(revenue, 0)) AS revenue,
              SUM(COALESCE(paid_spend, 0)) AS spend,
              COUNT(*) FILTER (WHERE approved) AS approved_count,
              COUNT(*) FILTER (WHERE review_flag) AS review_flag_count
            FROM intent_packet_observations
            WHERE observed_at >= ${sqlString(startDate)}
            GROUP BY 1
          )
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE q.queue_key IS NULL OR COALESCE(NULLIF(q.owner_name, ''), '') = '') AS ownerless,
            COUNT(*) FILTER (
              WHERE q.next_review_at IS NOT NULL
                AND q.next_review_at < CURRENT_TIMESTAMP
            ) AS review_due,
            COUNT(*) FILTER (
              WHERE rp.last_observed_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
            ) AS stale_learning,
            COUNT(*) FILTER (
              WHERE rp.approved_count > 0 AND (rp.revenue - rp.spend) > 0
            ) AS positive_signal_packets
          FROM recent_packets rp
          LEFT JOIN intent_packet_exploration_queue q
            ON q.queue_key = rp.queue_key
        `
      ),
      allRows<any>(
        conn,
        `
          WITH recent_packets AS (
            SELECT
              COALESCE(packet_id, packet_name, primary_keyword) AS queue_key,
              MAX(primary_keyword) AS primary_keyword,
              MAX(packet_name) AS packet_name,
              MAX(market) AS market,
              MAX(observed_at) AS last_observed_at,
              COUNT(*) AS observation_count,
              SUM(COALESCE(revenue, 0)) AS revenue,
              SUM(COALESCE(paid_spend, 0)) AS spend,
              COUNT(*) FILTER (WHERE approved) AS approved_count,
              COUNT(*) FILTER (WHERE rejected) AS rejected_count,
              COUNT(*) FILTER (WHERE review_flag) AS review_flag_count
            FROM intent_packet_observations
            WHERE observed_at >= ${sqlString(startDate)}
            GROUP BY 1
          )
          SELECT
            rp.*,
            q.owner_name,
            q.queue_status,
            q.priority,
            q.next_step,
            q.next_review_at,
            q.blocker_summary
          FROM recent_packets rp
          LEFT JOIN intent_packet_exploration_queue q
            ON q.queue_key = rp.queue_key
          ORDER BY
            CASE
              WHEN q.queue_key IS NULL OR COALESCE(NULLIF(q.owner_name, ''), '') = '' THEN 0
              ELSE 1
            END ASC,
            CASE
              WHEN q.next_review_at IS NOT NULL AND q.next_review_at < CURRENT_TIMESTAMP THEN 0
              ELSE 1
            END ASC,
            (rp.revenue - rp.spend) DESC,
            rp.observation_count DESC
          LIMIT ${limit}
        `
      ),
    ]);

    const summary = summaryRows[0] || {};
    const queue = queueRows.map((row) => ({
      queueKey: String(row.queue_key || ''),
      primaryKeyword: String(row.primary_keyword || ''),
      packetName: normalize(row.packet_name) || null,
      market: normalize(row.market) || null,
      ownerName: normalize(row.owner_name) || null,
      queueStatus: normalize(row.queue_status) || 'new',
      priority: normalize(row.priority) || 'medium',
      nextStep: normalize(row.next_step) || null,
      nextReviewAt: row.next_review_at ? new Date(row.next_review_at).toISOString() : null,
      blockerSummary: normalize(row.blocker_summary) || null,
      lastObservedAt: row.last_observed_at ? new Date(row.last_observed_at).toISOString() : null,
      observationCount: toNumber(row.observation_count),
      revenue: toNumber(row.revenue),
      spend: toNumber(row.spend),
      netMargin: toNumber(row.revenue) - toNumber(row.spend),
      approvedCount: toNumber(row.approved_count),
      rejectedCount: toNumber(row.rejected_count),
      reviewFlagCount: toNumber(row.review_flag_count),
    })).sort((a: any, b: any) => {
      return (
        queueStateRank(a.queueStatus) - queueStateRank(b.queueStatus) ||
        b.netMargin - a.netMargin ||
        b.observationCount - a.observationCount
      );
    });

    let operatorRead =
      'Intent-packet exploration is visible, but the key question is whether the strongest packet-level learning is actually being owned and reviewed on purpose.';
    if (toNumber(summary.ownerless) > 0) {
      operatorRead =
        `${toNumber(summary.ownerless)} recent packet clusters still have no explicit owner, so the packet-cracking loop is visible but not yet governed as a function.`;
    } else if (toNumber(summary.review_due) > 0) {
      operatorRead =
        `${toNumber(summary.review_due)} packet queue items are past review, so the next bottleneck is cadence discipline rather than raw packet discovery.`;
    }

    return {
      window: {
        lookbackDays,
        since: startDate.slice(0, 10),
        through: new Date().toISOString().slice(0, 10),
      },
      summary: {
        total: toNumber(summary.total),
        ownerless: toNumber(summary.ownerless),
        reviewDue: toNumber(summary.review_due),
        staleLearning: toNumber(summary.stale_learning),
        positiveSignalPackets: toNumber(summary.positive_signal_packets),
      },
      queueStatusCounts: queue.reduce((acc: Record<string, number>, item: any) => {
        acc[item.queueStatus] = (acc[item.queueStatus] || 0) + 1;
        return acc;
      }, {}),
      queue,
      operatorRead,
    };
  } finally {
    closeConnection(conn);
  }
}
