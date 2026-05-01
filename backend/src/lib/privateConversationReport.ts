import { getPgPool } from './pg';

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function daysBetween(earlier: string | null | undefined, later = new Date()): number | null {
  if (!earlier) return null;
  const parsed = new Date(earlier);
  if (Number.isNaN(parsed.getTime())) return null;
  return Number(((later.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1));
}

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

export async function getPrivateConversationReport(options: {
  operatorPersonId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<any> {
  const operatorPersonId = normalize(options.operatorPersonId) || 'eric';
  const status = normalize(options.status);
  const limit = options.limit || 20;

  try {
    const params: any[] = [operatorPersonId];
    const statusClause = status ? `AND pcs.status = $${params.push(status)}` : '';
    params.push(limit);

    const result = await getPgPool().query(
      `
        SELECT
          pcs.source_key,
          pcs.label,
          pcs.channel_ref,
          pcs.slack_channel_id,
          pcs.slack_channel_name,
          pcs.slack_thread_ts,
          pcs.watch_window,
          pcs.meeting_type,
          pcs.query,
          pcs.visibility_scope,
          pcs.operator_person_id,
          pcs.operator_name,
          pcs.counterpart_person_id,
          pcs.counterpart_name,
          pcs.objective,
          pcs.status,
          pcs.auto_ingest,
          pcs.last_ingested_at,
          pcs.metadata,
          ms.id AS last_meeting_id,
          ms.title AS last_meeting_title,
          ms.occurred_at AS last_meeting_occurred_at,
          ms.summary_md AS last_meeting_summary_md,
          ms.decision_summary_md AS last_meeting_decision_summary_md,
          ms.action_summary_md AS last_meeting_action_summary_md,
          COALESCE(action_rollup.open_action_count, 0) AS open_action_count,
          COALESCE(action_rollup.ownerless_action_count, 0) AS ownerless_action_count,
          COALESCE(action_rollup.blocked_action_count, 0) AS blocked_action_count,
          COALESCE(action_rollup.high_priority_action_count, 0) AS high_priority_action_count,
          COALESCE(question_rollup.open_question_count, 0) AS open_question_count
        FROM private_conversation_sources pcs
        LEFT JOIN meeting_sessions ms
          ON ms.id = pcs.last_meeting_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (
              WHERE mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
            ) AS open_action_count,
            COUNT(*) FILTER (
              WHERE mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
                AND COALESCE(NULLIF(mai.owner_name, ''), '') = ''
            ) AS ownerless_action_count,
            COUNT(*) FILTER (
              WHERE mai.status = 'blocked'
            ) AS blocked_action_count,
            COUNT(*) FILTER (
              WHERE mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
                AND mai.priority = 'high'
            ) AS high_priority_action_count
          FROM meeting_action_items mai
          WHERE mai.meeting_id = pcs.last_meeting_id
        ) AS action_rollup ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (
              WHERE moq.status NOT IN ('resolved', 'closed', 'cancelled')
            ) AS open_question_count
          FROM meeting_open_questions moq
          WHERE moq.meeting_id = pcs.last_meeting_id
        ) AS question_rollup ON TRUE
        WHERE COALESCE(pcs.operator_person_id, 'eric') = $1
        ${statusClause}
        ORDER BY COALESCE(ms.occurred_at, pcs.last_ingested_at, pcs.created_at) DESC
        LIMIT $${params.length}
      `,
      params
    );

    const conversations = result.rows.map((row) => {
      const staleDays = daysBetween(row.last_meeting_occurred_at || row.last_ingested_at || null);
      return {
        sourceKey: String(row.source_key),
        label: String(row.label),
        counterpartName: String(row.counterpart_name),
        counterpartPersonId: row.counterpart_person_id || null,
        objective: row.objective || null,
        status: String(row.status || 'active'),
        autoIngest: Boolean(row.auto_ingest),
        channelRef: String(row.channel_ref),
        slackThreadTs: row.slack_thread_ts || null,
        watchWindow: row.watch_window || null,
        query: row.query || null,
        lastIngestedAt: row.last_ingested_at || null,
        visibilityScope: String(row.visibility_scope || 'private_operator'),
        lastMeeting: row.last_meeting_id ? {
          id: String(row.last_meeting_id),
          title: String(row.last_meeting_title || ''),
          occurredAt: String(row.last_meeting_occurred_at),
          summaryMd: row.last_meeting_summary_md || null,
          decisionSummaryMd: row.last_meeting_decision_summary_md || null,
          actionSummaryMd: row.last_meeting_action_summary_md || null,
        } : null,
        openActionCount: toNumber(row.open_action_count),
        ownerlessActionCount: toNumber(row.ownerless_action_count),
        blockedActionCount: toNumber(row.blocked_action_count),
        highPriorityActionCount: toNumber(row.high_priority_action_count),
        openQuestionCount: toNumber(row.open_question_count),
        staleDays,
      };
    });

    const summary = {
      activeConversations: conversations.filter((item) => item.status === 'active').length,
      conversationsWithNoMeeting: conversations.filter((item) => !item.lastMeeting).length,
      conversationsWithOpenActions: conversations.filter((item) => item.openActionCount > 0).length,
      conversationsNeedingAttention: conversations.filter((item) =>
        item.ownerlessActionCount > 0 ||
        item.blockedActionCount > 0 ||
        item.openQuestionCount > 0 ||
        (item.staleDays != null && item.staleDays >= 3)
      ).length,
      staleConversations: conversations.filter((item) => item.staleDays != null && item.staleDays >= 3).length,
    };

    const operatorRead = conversations.length
      ? `Private founder lanes are active for ${summary.activeConversations} counterparts; ${summary.conversationsNeedingAttention} lanes currently need management attention because they are stale, blocked, ownerless, or still unresolved.`
      : 'No private founder conversation sources are registered yet.';

    return {
      operatorPersonId,
      summary,
      conversations,
      operatorRead,
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      return {
        operatorPersonId,
        summary: {
          activeConversations: 0,
          conversationsWithNoMeeting: 0,
          conversationsWithOpenActions: 0,
          conversationsNeedingAttention: 0,
          staleConversations: 0,
        },
        conversations: [],
        operatorRead: 'Private founder conversation schema is not available yet.',
      };
    }
    throw error;
  }
}
