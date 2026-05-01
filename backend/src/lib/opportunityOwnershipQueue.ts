import { randomUUID } from 'crypto';
import { getPgPool } from './pg';

type OpportunityOwnershipInput = {
  opportunityId: string;
  ownerPersonId?: string | null;
  ownerName?: string | null;
  queueStatus?: string;
  priority?: string;
  nextStep?: string | null;
  nextStepDueAt?: string | null;
  blockerSummary?: string | null;
  lastReviewedAt?: string | null;
  metadata?: Record<string, any>;
};

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function jsonb(value: Record<string, any> | undefined): string {
  return JSON.stringify(value || {});
}

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

function queueStateRank(value: string): number {
  switch (value) {
    case 'stalled':
      return 0;
    case 'new':
      return 1;
    case 'assigned':
      return 2;
    case 'researching':
      return 3;
    case 'blueprinting':
      return 4;
    case 'launch_ready':
      return 5;
    case 'launched':
      return 6;
    default:
      return 7;
  }
}

export async function upsertOpportunityOwnership(input: OpportunityOwnershipInput): Promise<any> {
  const pool = getPgPool();
  const result = await pool.query(
    `
      INSERT INTO opportunity_ownership_queue (
        id, opportunity_id, owner_person_id, owner_name, queue_status, priority,
        next_step, next_step_due_at, blocker_summary, last_reviewed_at, metadata, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11::jsonb, NOW()
      )
      ON CONFLICT (opportunity_id)
      DO UPDATE SET
        owner_person_id = EXCLUDED.owner_person_id,
        owner_name = EXCLUDED.owner_name,
        queue_status = EXCLUDED.queue_status,
        priority = EXCLUDED.priority,
        next_step = EXCLUDED.next_step,
        next_step_due_at = EXCLUDED.next_step_due_at,
        blocker_summary = EXCLUDED.blocker_summary,
        last_reviewed_at = EXCLUDED.last_reviewed_at,
        metadata = COALESCE(opportunity_ownership_queue.metadata, '{}'::jsonb) || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [
      randomUUID(),
      input.opportunityId,
      input.ownerPersonId || null,
      input.ownerName || null,
      input.queueStatus || 'assigned',
      input.priority || 'medium',
      input.nextStep || null,
      input.nextStepDueAt || null,
      input.blockerSummary || null,
      input.lastReviewedAt || null,
      jsonb(input.metadata),
    ]
  );
  return result.rows[0] || null;
}

export async function getOpportunityOwnershipReport(options: { limit?: number } = {}): Promise<any> {
  const limit = options.limit || 12;
  const pool = getPgPool();

  try {
    const [summaryResult, queueResult] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE o.status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE q.opportunity_id IS NULL OR COALESCE(NULLIF(q.owner_name, ''), '') = '') AS ownerless,
            COUNT(*) FILTER (
              WHERE o.status = 'pending'
                AND (q.queue_status IS NULL OR q.queue_status IN ('new', 'stalled'))
            ) AS ungoverned,
            COUNT(*) FILTER (
              WHERE q.next_step_due_at IS NOT NULL
                AND q.next_step_due_at < NOW()
                AND o.status NOT IN ('launched', 'rejected')
            ) AS overdue_next_steps,
            COUNT(*) FILTER (
              WHERE o.status = 'pending'
                AND o.created_at < NOW() - INTERVAL '7 days'
            ) AS stale_pending,
            COUNT(DISTINCT cb.id) FILTER (WHERE cb.status = 'draft') AS draft_blueprints,
            COUNT(DISTINCT cb.id) FILTER (WHERE cb.status = 'approved') AS approved_blueprints
          FROM opportunities o
          LEFT JOIN opportunity_ownership_queue q
            ON q.opportunity_id = o.id
          LEFT JOIN campaign_blueprints cb
            ON cb.opportunity_id = o.id
        `
      ),
      pool.query(
        `
          SELECT
            o.id,
            o.source,
            o.angle,
            o.category,
            o.status,
            o.confidence_score,
            o.predicted_delta_cm,
            o.recommended_budget,
            o.created_at,
            q.owner_name,
            q.queue_status,
            q.priority,
            q.next_step,
            q.next_step_due_at,
            q.blocker_summary,
            q.last_reviewed_at,
            COUNT(cb.id) AS blueprint_count,
            COUNT(cb.id) FILTER (WHERE cb.status = 'approved') AS approved_blueprint_count
          FROM opportunities o
          LEFT JOIN opportunity_ownership_queue q
            ON q.opportunity_id = o.id
          LEFT JOIN campaign_blueprints cb
            ON cb.opportunity_id = o.id
          GROUP BY o.id, q.opportunity_id, q.owner_name, q.queue_status, q.priority, q.next_step, q.next_step_due_at, q.blocker_summary, q.last_reviewed_at
          ORDER BY
            CASE
              WHEN q.opportunity_id IS NULL OR COALESCE(NULLIF(q.owner_name, ''), '') = '' THEN 0
              ELSE 1
            END ASC,
            CASE
              WHEN q.next_step_due_at IS NOT NULL AND q.next_step_due_at < NOW() THEN 0
              ELSE 1
            END ASC,
            COALESCE(o.predicted_delta_cm, 0) DESC,
            COALESCE(o.confidence_score, 0) DESC,
            o.created_at ASC
          LIMIT $1
        `,
        [limit]
      ),
    ]);

    const summary = summaryResult.rows[0] || {};
    const queue = queueResult.rows.map((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const ageDays = createdAt ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000)) : 0;
      return {
        opportunityId: String(row.id),
        source: String(row.source || 'unknown'),
        angle: String(row.angle || ''),
        category: row.category ? String(row.category) : null,
        status: String(row.status || 'pending'),
        confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
        predictedDeltaCm: row.predicted_delta_cm == null ? null : Number(row.predicted_delta_cm),
        recommendedBudget: row.recommended_budget == null ? null : Number(row.recommended_budget),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        ageDays,
        ownerName: normalize(row.owner_name) || null,
        queueStatus: normalize(row.queue_status) || 'new',
        priority: normalize(row.priority) || 'medium',
        nextStep: normalize(row.next_step) || null,
        nextStepDueAt: row.next_step_due_at ? new Date(row.next_step_due_at).toISOString() : null,
        blockerSummary: normalize(row.blocker_summary) || null,
        lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : null,
        blueprintCount: toNumber(row.blueprint_count),
        approvedBlueprintCount: toNumber(row.approved_blueprint_count),
      };
    });

    const queueStatusCounts = queue.reduce((acc: Record<string, number>, item: any) => {
      const key = item.queueStatus || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    let operatorRead =
      'Opportunities are visible, but the main question is whether they are being carried through an owned queue fast enough to become blueprints and launches.';
    if (toNumber(summary.ownerless) > 0) {
      operatorRead =
        `${toNumber(summary.ownerless)} opportunities still have no explicit owner, so the immediate failure mode is not discovery but ownership leakage.`;
    } else if (toNumber(summary.stale_pending) > 0) {
      operatorRead =
        `${toNumber(summary.stale_pending)} pending opportunities are aging without conversion, so the current bottleneck is queue discipline between discovery and blueprinting.`;
    }

    return {
      summary: {
        total: toNumber(summary.total),
        pending: toNumber(summary.pending),
        ownerless: toNumber(summary.ownerless),
        ungoverned: toNumber(summary.ungoverned),
        overdueNextSteps: toNumber(summary.overdue_next_steps),
        stalePending: toNumber(summary.stale_pending),
        draftBlueprints: toNumber(summary.draft_blueprints),
        approvedBlueprints: toNumber(summary.approved_blueprints),
      },
      queueStatusCounts,
      queue: queue.sort((a: any, b: any) => {
        return (
          queueStateRank(a.queueStatus) - queueStateRank(b.queueStatus) ||
          (b.predictedDeltaCm || 0) - (a.predictedDeltaCm || 0) ||
          (b.confidenceScore || 0) - (a.confidenceScore || 0)
        );
      }),
      operatorRead,
    };
  } catch (error: any) {
    if (!isMissingRelationError(error)) throw error;
    return {
      summary: {
        total: 0,
        pending: 0,
        ownerless: 0,
        ungoverned: 0,
        overdueNextSteps: 0,
        stalePending: 0,
        draftBlueprints: 0,
        approvedBlueprints: 0,
      },
      queueStatusCounts: {},
      queue: [],
      operatorRead:
        'The opportunity schema or ownership queue is not available in this environment yet, so upstream opportunity ownership cannot be scored here.',
    };
  }
}
