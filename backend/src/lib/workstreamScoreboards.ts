import { getPgPool } from './pg';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from './monitoringDb';

function startDateStringForLookback(lookbackDays: number): string {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
  return startDate.toISOString().slice(0, 10);
}

function dateTimeStringForLookback(lookbackDays: number): string {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
  startDate.setUTCHours(0, 0, 0, 0);
  return startDate.toISOString();
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function safeRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

async function queryOpportunityWorkstream(lookbackDays: number, limit: number): Promise<any> {
  const pool = getPgPool();
  try {
    const [summaryResult, blueprintResult, sourceRows, categoryRows, topPendingRows] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE status = 'launched') AS launched,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE status = 'pending' AND COALESCE(confidence_score, 0) >= 0.7) AS high_confidence_pending,
            COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days') AS stale_pending,
            COALESCE(SUM(predicted_delta_cm) FILTER (WHERE status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunities
        `
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE status = 'draft') AS draft,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE status = 'launched') AS launched
          FROM campaign_blueprints
        `
      ),
      pool.query(
        `
          SELECT
            COALESCE(source, 'unknown') AS source,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'launched') AS launched,
            COALESCE(SUM(predicted_delta_cm) FILTER (WHERE status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunities
          GROUP BY 1
          ORDER BY pending_predicted_delta_cm DESC NULLS LAST, pending DESC, total DESC
        `
      ),
      pool.query(
        `
          SELECT
            COALESCE(category, 'uncategorized') AS category,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'launched') AS launched,
            COALESCE(SUM(predicted_delta_cm) FILTER (WHERE status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunities
          GROUP BY 1
          ORDER BY pending_predicted_delta_cm DESC NULLS LAST, pending DESC, total DESC
        `
      ),
      pool.query(
        `
          SELECT
            o.id,
            o.source,
            o.angle,
            o.category,
            o.confidence_score,
            o.predicted_delta_cm,
            o.recommended_budget,
            o.status,
            o.created_at,
            COUNT(cb.id) AS blueprint_count
          FROM opportunities o
          LEFT JOIN campaign_blueprints cb
            ON cb.opportunity_id = o.id
          WHERE o.status = 'pending'
          GROUP BY o.id
          ORDER BY o.predicted_delta_cm DESC NULLS LAST, o.confidence_score DESC NULLS LAST, o.created_at ASC
          LIMIT $1
        `,
        [limit]
      ),
    ]);

    const summary = summaryResult.rows[0] || {};
    const total = toNumber(summary.total);
    const blueprintSummary = blueprintResult.rows[0] || {};
    const stalePending = toNumber(summary.stale_pending);
    const pending = toNumber(summary.pending);
    const launched = toNumber(summary.launched);
    const topPending = topPendingRows.rows.map((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const ageDays = createdAt ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000)) : 0;
      return {
        id: String(row.id),
        source: String(row.source || 'unknown'),
        angle: String(row.angle || ''),
        category: row.category ? String(row.category) : null,
        confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
        predictedDeltaCm: row.predicted_delta_cm == null ? null : Number(row.predicted_delta_cm),
        recommendedBudget: row.recommended_budget == null ? null : Number(row.recommended_budget),
        status: String(row.status || 'pending'),
        blueprintCount: toNumber(row.blueprint_count),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        ageDays,
      };
    });

    let operatorRead = 'Opportunity discovery has inventory, but it still lacks explicit accountable ownership.';
    if (pending === 0) {
      operatorRead = 'No pending opportunities are visible in the queue, which means the upstream supply line is empty or not being captured.';
    } else if (stalePending > 0) {
      operatorRead = `The opportunity queue is carrying ${stalePending} stale pending items, so discovery may be happening without downstream conversion into launch work.`;
    } else if (launched === 0) {
      operatorRead = 'Opportunities are being stored, but the queue is not yet proving conversion into launched work.';
    }

    return {
      schemaAvailable: true,
      lookbackDays,
      summary: {
        total,
        pending,
        approved: toNumber(summary.approved),
        launched,
        rejected: toNumber(summary.rejected),
        highConfidencePending: toNumber(summary.high_confidence_pending),
        stalePending,
        pendingPredictedDeltaCm: Number(summary.pending_predicted_delta_cm || 0),
        blueprintDraft: toNumber(blueprintSummary.draft),
        blueprintApproved: toNumber(blueprintSummary.approved),
        blueprintLaunched: toNumber(blueprintSummary.launched),
      },
      sources: sourceRows.rows.map((row) => ({
        source: String(row.source || 'unknown'),
        total: toNumber(row.total),
        pending: toNumber(row.pending),
        launched: toNumber(row.launched),
        pendingPredictedDeltaCm: Number(row.pending_predicted_delta_cm || 0),
      })),
      categories: categoryRows.rows.map((row) => ({
        category: String(row.category || 'uncategorized'),
        total: toNumber(row.total),
        pending: toNumber(row.pending),
        launched: toNumber(row.launched),
        pendingPredictedDeltaCm: Number(row.pending_predicted_delta_cm || 0),
      })),
      topPending,
      gaps: [
        'opportunity ownership is still not first-class in the current schema',
        'exploration cadence is still inferred rather than explicitly governed',
      ],
      operatorRead,
    };
  } catch (error: any) {
    if (!isMissingRelationError(error)) throw error;
    return {
      schemaAvailable: false,
      lookbackDays,
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        launched: 0,
        rejected: 0,
        highConfidencePending: 0,
        stalePending: 0,
        pendingPredictedDeltaCm: 0,
        blueprintDraft: 0,
        blueprintApproved: 0,
        blueprintLaunched: 0,
      },
      sources: [],
      categories: [],
      topPending: [],
      gaps: [
        'opportunity tables are not available in the current database',
      ],
      operatorRead: 'The opportunity workstream schema is not available in this environment yet, so the system cannot score discovery throughput from live rows.',
    };
  }
}

async function queryIntentPacketWorkstream(lookbackDays: number, limit: number): Promise<any> {
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const startDateTime = dateTimeStringForLookback(lookbackDays);
    const [summaryRows, sourceRows, keywordRows, namespaceRows] = await Promise.all([
      allRows<any>(
        conn,
        `
          SELECT
            COUNT(*) AS observation_count,
            COUNT(DISTINCT COALESCE(packet_id, packet_name, primary_keyword)) AS unique_packets,
            COUNT(DISTINCT primary_keyword) AS unique_keywords,
            COUNT(*) FILTER (WHERE approved) AS approved_count,
            COUNT(*) FILTER (WHERE rejected) AS rejected_count,
            COUNT(*) FILTER (WHERE review_flag) AS review_flag_count,
            SUM(COALESCE(revenue, 0)) AS revenue,
            SUM(COALESCE(paid_spend, 0)) AS spend
          FROM intent_packet_observations
          WHERE observed_at >= ${sqlString(startDateTime)}
        `
      ),
      allRows<any>(
        conn,
        `
          SELECT
            COALESCE(source, 'unknown') AS source,
            COUNT(*) AS observation_count,
            COUNT(*) FILTER (WHERE approved) AS approved_count,
            SUM(COALESCE(revenue, 0)) AS revenue,
            SUM(COALESCE(paid_spend, 0)) AS spend
          FROM intent_packet_observations
          WHERE observed_at >= ${sqlString(startDateTime)}
          GROUP BY 1
          ORDER BY revenue DESC NULLS LAST, observation_count DESC
        `
      ),
      allRows<any>(
        conn,
        `
          SELECT
            primary_keyword,
            COUNT(*) AS observation_count,
            COUNT(*) FILTER (WHERE approved) AS approved_count,
            SUM(COALESCE(revenue, 0)) AS revenue,
            SUM(COALESCE(paid_spend, 0)) AS spend
          FROM intent_packet_observations
          WHERE observed_at >= ${sqlString(startDateTime)}
          GROUP BY 1
          ORDER BY revenue DESC NULLS LAST, observation_count DESC
          LIMIT ${limit}
        `
      ),
      allRows<any>(
        conn,
        `
          SELECT
            ax.namespace AS namespace,
            COUNT(*) AS axiom_count
          FROM intent_packet_observation_axioms ax
          JOIN intent_packet_observations obs
            ON obs.observation_id = ax.observation_id
          WHERE obs.observed_at >= ${sqlString(startDateTime)}
          GROUP BY 1
          ORDER BY axiom_count DESC, namespace ASC
          LIMIT ${limit}
        `
      ),
    ]);

    const summary = summaryRows[0] || {};
    const observationCount = toNumber(summary.observation_count);
    const approvedCount = toNumber(summary.approved_count);
    const reviewFlagCount = toNumber(summary.review_flag_count);
    const revenue = Number(summary.revenue || 0);
    const spend = Number(summary.spend || 0);
    const netMargin = revenue - spend;
    const approvalRate = safeRate(approvedCount, observationCount);
    const reviewFlagRate = safeRate(reviewFlagCount, observationCount);

    let operatorRead = 'Intent-packet learning is producing observations, but explicit accountable exploration ownership still does not exist.';
    if (observationCount === 0) {
      operatorRead = 'No intent-packet observations are visible in the current window, so the system cannot prove that exploration learning is actively running.';
    } else if ((reviewFlagRate || 0) >= 0.3) {
      operatorRead = 'Intent-packet learning is active, but review pressure is high enough that the exploration loop still looks noisy.';
    } else if (netMargin > 0 && approvedCount > 0) {
      operatorRead = 'Intent-packet learning is producing economically positive signal, which means the next constraint is explicit ownership and exploitation cadence.';
    }

    return {
      schemaAvailable: true,
      lookbackDays,
      summary: {
        observationCount,
        uniquePackets: toNumber(summary.unique_packets),
        uniqueKeywords: toNumber(summary.unique_keywords),
        approvedCount,
        rejectedCount: toNumber(summary.rejected_count),
        reviewFlagCount,
        revenue,
        spend,
        netMargin,
        approvalRate,
        reviewFlagRate,
      },
      sources: sourceRows.map((row) => {
        const rowRevenue = Number(row.revenue || 0);
        const rowSpend = Number(row.spend || 0);
        return {
          source: String(row.source || 'unknown'),
          observationCount: toNumber(row.observation_count),
          approvedCount: toNumber(row.approved_count),
          revenue: rowRevenue,
          spend: rowSpend,
          netMargin: rowRevenue - rowSpend,
          approvalRate: safeRate(toNumber(row.approved_count), toNumber(row.observation_count)),
        };
      }),
      topKeywords: keywordRows.map((row) => {
        const rowRevenue = Number(row.revenue || 0);
        const rowSpend = Number(row.spend || 0);
        return {
          keyword: String(row.primary_keyword || ''),
          observationCount: toNumber(row.observation_count),
          approvedCount: toNumber(row.approved_count),
          revenue: rowRevenue,
          spend: rowSpend,
          netMargin: rowRevenue - rowSpend,
          approvalRate: safeRate(toNumber(row.approved_count), toNumber(row.observation_count)),
        };
      }),
      topNamespaces: namespaceRows.map((row) => ({
        namespace: String(row.namespace || ''),
        axiomCount: toNumber(row.axiom_count),
      })),
      gaps: [
        'no dedicated operating role for cracking net-new intent packets is encoded yet',
        'the scoreboard shows learning signal, but not accountable exploitation ownership',
      ],
      operatorRead,
    };
  } finally {
    closeConnection(conn);
  }
}

export async function getOpportunityIntentWorkstreamScoreboard(opts: { lookbackDays?: number; limit?: number } = {}): Promise<any> {
  const lookbackDays = opts.lookbackDays || 14;
  const limit = opts.limit || 5;
  const startDate = startDateStringForLookback(lookbackDays);
  const [opportunity, intentPacket] = await Promise.all([
    queryOpportunityWorkstream(lookbackDays, limit),
    queryIntentPacketWorkstream(lookbackDays, limit),
  ]);

  let operatorRead = 'The exploration layer is now visible, but ownership is still the main missing control variable.';
  if ((opportunity.summary?.pending || 0) === 0 && (intentPacket.summary?.observationCount || 0) === 0) {
    operatorRead = 'Both opportunity supply and intent-packet learning look under-instrumented in the current window, so the upstream demand-creation loop is still too dark.';
  } else if ((opportunity.summary?.stalePending || 0) > 0) {
    operatorRead = 'Opportunity supply is visible, but it is stalling before conversion, which points to a follow-through or ownership gap more than a discovery gap.';
  } else if ((intentPacket.summary?.reviewFlagRate || 0) >= 0.3) {
    operatorRead = 'Intent-packet exploration is alive but noisy, so the next risk is spending buyer attention on packets that are not yet clean enough to scale.';
  }

  return {
    window: {
      lookbackDays,
      startDate,
      through: new Date().toISOString().slice(0, 10),
    },
    opportunity,
    intentPacket,
    operatorRead,
  };
}
