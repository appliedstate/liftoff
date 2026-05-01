import { getPgPool } from './pg';

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function safeRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

function inferBand(metrics: {
  total: number;
  pending: number;
  launched: number;
  rejected: number;
  stalePending: number;
  blueprintCoverage: number | null;
  launchRate: number | null;
  stalePendingRate: number | null;
}): 'green' | 'yellow' | 'red' {
  if (
    metrics.total >= 3 &&
    ((metrics.launchRate || 0) >= 0.2) &&
    ((metrics.stalePendingRate || 0) <= 0.35)
  ) {
    return 'green';
  }

  if (
    metrics.total >= 3 &&
    (
      (metrics.launched === 0 && (metrics.stalePendingRate || 0) >= 0.5) ||
      ((metrics.rejected / Math.max(metrics.total, 1)) >= 0.5)
    )
  ) {
    return 'red';
  }

  if (metrics.pending > 0 || metrics.launched > 0 || metrics.rejected > 0) {
    return 'yellow';
  }

  return 'red';
}

function inferReasons(metrics: {
  total: number;
  pending: number;
  launched: number;
  rejected: number;
  stalePending: number;
  blueprintCoverage: number | null;
  launchRate: number | null;
  stalePendingRate: number | null;
  pendingPredictedDeltaCm: number;
}): string[] {
  const reasons: string[] = [];
  if ((metrics.launchRate || 0) >= 0.2 && metrics.launched > 0) {
    reasons.push('showing real launch conversion');
  }
  if ((metrics.blueprintCoverage || 0) >= 0.5) {
    reasons.push('blueprint coverage is healthy');
  }
  if ((metrics.stalePendingRate || 0) >= 0.5) {
    reasons.push('too much supply is aging without closure');
  }
  if (metrics.pending > 0 && metrics.pendingPredictedDeltaCm > 0 && metrics.launched === 0) {
    reasons.push('upside exists, but it is not proving conversion yet');
  }
  if (metrics.rejected > metrics.launched && metrics.total >= 3) {
    reasons.push('rejections are outrunning validated launches');
  }
  if (!reasons.length) {
    reasons.push('signal volume is still thin');
  }
  return reasons.slice(0, 3);
}

function mapBreakdownRow(row: any, labelKey: 'ownerLabel' | 'source' | 'category') {
  const total = toNumber(row.total);
  const pending = toNumber(row.pending);
  const launched = toNumber(row.launched);
  const rejected = toNumber(row.rejected);
  const stalePending = toNumber(row.stale_pending);
  const blueprintCoverage = safeRate(toNumber(row.blueprint_backed), total);
  const launchRate = safeRate(launched, total);
  const stalePendingRate = safeRate(stalePending, pending);
  const pendingPredictedDeltaCm = Number(row.pending_predicted_delta_cm || 0);

  const metrics = {
    total,
    pending,
    launched,
    rejected,
    stalePending,
    blueprintCoverage,
    launchRate,
    stalePendingRate,
    pendingPredictedDeltaCm,
  };

  return {
    [labelKey]: normalize(row.label) || 'unknown',
    total,
    pending,
    launched,
    rejected,
    stalePending,
    avgConfidenceScore: row.avg_confidence_score == null ? null : Number(row.avg_confidence_score),
    pendingPredictedDeltaCm,
    blueprintCoverage,
    launchRate,
    stalePendingRate,
    qualityBand: inferBand(metrics),
    reasons: inferReasons(metrics),
  };
}

export async function getOpportunitySupplyQualityLoopReport(options: { limit?: number } = {}): Promise<any> {
  const limit = options.limit || 8;
  const pool = getPgPool();

  try {
    const [summaryResult, ownerRows, sourceRows, categoryRows] = await Promise.all([
      pool.query(
        `
          WITH opportunity_rollup AS (
            SELECT
              o.id,
              o.status,
              o.confidence_score,
              o.predicted_delta_cm,
              o.created_at,
              COUNT(cb.id) AS blueprint_count,
              COUNT(cb.id) FILTER (WHERE cb.status IN ('approved', 'launched')) AS approved_blueprint_count
            FROM opportunities o
            LEFT JOIN campaign_blueprints cb
              ON cb.opportunity_id = o.id
            GROUP BY o.id
          )
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'launched') AS launched,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days') AS stale_pending,
            COUNT(*) FILTER (WHERE blueprint_count > 0) AS blueprint_backed,
            COUNT(*) FILTER (WHERE approved_blueprint_count > 0) AS approved_blueprint_backed,
            AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL) AS avg_confidence_score,
            COALESCE(SUM(predicted_delta_cm) FILTER (WHERE status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunity_rollup
        `
      ),
      pool.query(
        `
          SELECT
            COALESCE(NULLIF(q.owner_name, ''), 'Unassigned') AS label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE o.status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE o.status = 'launched') AS launched,
            COUNT(*) FILTER (WHERE o.status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE o.status = 'pending' AND o.created_at < NOW() - INTERVAL '7 days') AS stale_pending,
            COUNT(*) FILTER (WHERE cb.blueprint_count > 0) AS blueprint_backed,
            AVG(o.confidence_score) FILTER (WHERE o.confidence_score IS NOT NULL) AS avg_confidence_score,
            COALESCE(SUM(o.predicted_delta_cm) FILTER (WHERE o.status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunities o
          LEFT JOIN opportunity_ownership_queue q
            ON q.opportunity_id = o.id
          LEFT JOIN (
            SELECT opportunity_id, COUNT(*) AS blueprint_count
            FROM campaign_blueprints
            GROUP BY 1
          ) cb
            ON cb.opportunity_id = o.id
          GROUP BY 1
          ORDER BY pending_predicted_delta_cm DESC NULLS LAST, total DESC
          LIMIT $1
        `,
        [limit]
      ),
      pool.query(
        `
          SELECT
            COALESCE(NULLIF(o.source, ''), 'unknown') AS label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE o.status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE o.status = 'launched') AS launched,
            COUNT(*) FILTER (WHERE o.status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE o.status = 'pending' AND o.created_at < NOW() - INTERVAL '7 days') AS stale_pending,
            COUNT(*) FILTER (WHERE cb.blueprint_count > 0) AS blueprint_backed,
            AVG(o.confidence_score) FILTER (WHERE o.confidence_score IS NOT NULL) AS avg_confidence_score,
            COALESCE(SUM(o.predicted_delta_cm) FILTER (WHERE o.status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunities o
          LEFT JOIN (
            SELECT opportunity_id, COUNT(*) AS blueprint_count
            FROM campaign_blueprints
            GROUP BY 1
          ) cb
            ON cb.opportunity_id = o.id
          GROUP BY 1
          ORDER BY pending_predicted_delta_cm DESC NULLS LAST, total DESC
          LIMIT $1
        `,
        [limit]
      ),
      pool.query(
        `
          SELECT
            COALESCE(NULLIF(o.category, ''), 'uncategorized') AS label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE o.status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE o.status = 'launched') AS launched,
            COUNT(*) FILTER (WHERE o.status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE o.status = 'pending' AND o.created_at < NOW() - INTERVAL '7 days') AS stale_pending,
            COUNT(*) FILTER (WHERE cb.blueprint_count > 0) AS blueprint_backed,
            AVG(o.confidence_score) FILTER (WHERE o.confidence_score IS NOT NULL) AS avg_confidence_score,
            COALESCE(SUM(o.predicted_delta_cm) FILTER (WHERE o.status = 'pending'), 0) AS pending_predicted_delta_cm
          FROM opportunities o
          LEFT JOIN (
            SELECT opportunity_id, COUNT(*) AS blueprint_count
            FROM campaign_blueprints
            GROUP BY 1
          ) cb
            ON cb.opportunity_id = o.id
          GROUP BY 1
          ORDER BY pending_predicted_delta_cm DESC NULLS LAST, total DESC
          LIMIT $1
        `,
        [limit]
      ),
    ]);

    const summaryRow = summaryResult.rows[0] || {};
    const total = toNumber(summaryRow.total);
    const pending = toNumber(summaryRow.pending);
    const launched = toNumber(summaryRow.launched);
    const rejected = toNumber(summaryRow.rejected);
    const stalePending = toNumber(summaryRow.stale_pending);
    const blueprintBacked = toNumber(summaryRow.blueprint_backed);
    const approvedBlueprintBacked = toNumber(summaryRow.approved_blueprint_backed);
    const pendingPredictedDeltaCm = Number(summaryRow.pending_predicted_delta_cm || 0);
    const launchRate = safeRate(launched, total);
    const stalePendingRate = safeRate(stalePending, pending);
    const blueprintCoverage = safeRate(blueprintBacked, total);
    const closedLoopRate = safeRate(launched + rejected, total);

    const owners = ownerRows.rows.map((row) => mapBreakdownRow(row, 'ownerLabel'));
    const sources = sourceRows.rows.map((row) => mapBreakdownRow(row, 'source'));
    const categories = categoryRows.rows.map((row) => mapBreakdownRow(row, 'category'));

    const systemicIssues: string[] = [];
    if ((stalePendingRate || 0) >= 0.45) {
      systemicIssues.push('too much predicted upside is trapped in stale pending inventory');
    }
    if ((launchRate || 0) <= 0.1 && pending > 0) {
      systemicIssues.push('opportunity supply is entering the system faster than it is proving launch conversion');
    }
    if ((blueprintCoverage || 0) <= 0.35 && total > 0) {
      systemicIssues.push('too little of the opportunity pool is reaching blueprint-backed status');
    }
    if (!systemicIssues.length) {
      systemicIssues.push('the current supply loop is producing usable signal, but it still needs more history before quality claims become durable');
    }

    let operatorRead =
      'Opportunity supply quality is now visible as a loop: the question is no longer just how much supply exists, but whether it is becoming blueprint-backed and launch-proven fast enough.';
    if (systemicIssues[0]) {
      operatorRead =
        `${systemicIssues[0].charAt(0).toUpperCase()}${systemicIssues[0].slice(1)}, so the next job is improving conversion quality rather than just increasing idea volume.`;
    }

    return {
      summary: {
        total,
        pending,
        launched,
        rejected,
        stalePending,
        blueprintBacked,
        approvedBlueprintBacked,
        avgConfidenceScore: summaryRow.avg_confidence_score == null ? null : Number(summaryRow.avg_confidence_score),
        pendingPredictedDeltaCm,
        launchRate,
        stalePendingRate,
        blueprintCoverage,
        closedLoopRate,
      },
      owners,
      sources,
      categories,
      systemicIssues,
      operatorRead,
    };
  } catch (error: any) {
    if (!isMissingRelationError(error)) throw error;
    return {
      summary: {
        total: 0,
        pending: 0,
        launched: 0,
        rejected: 0,
        stalePending: 0,
        blueprintBacked: 0,
        approvedBlueprintBacked: 0,
        avgConfidenceScore: null,
        pendingPredictedDeltaCm: 0,
        launchRate: null,
        stalePendingRate: null,
        blueprintCoverage: null,
        closedLoopRate: null,
      },
      owners: [],
      sources: [],
      categories: [],
      systemicIssues: ['opportunity supply quality cannot be scored because the upstream schema is not available in this environment'],
      operatorRead:
        'The opportunity schema is not available in this environment yet, so the system cannot score upstream supply quality from live rows.',
    };
  }
}
