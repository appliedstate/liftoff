import { createHash, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { getBuyerScorecardAttributionAudit } from '../lib/buyerScorecardAttributionAudit';
import { getMeetingEntityLinkReport } from '../lib/meetingEntityLinks';
import { getPgPool } from '../lib/pg';
import { CAPACITY_CONSTRAINTS, PLATFORM_ACCOUNTS } from '../lib/platformCapacityRegistry';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from '../lib/monitoringDb';

type JsonValue = Record<string, any> | any[] | null;

export interface MeetingParticipantInput {
  id?: string;
  personId?: string | null;
  displayName: string;
  roleAtTime?: string | null;
  participantType?: string | null;
  attendanceConfidence?: number | null;
  metadata?: Record<string, any>;
}

export interface TranscriptSegmentInput {
  id?: string;
  speakerLabel?: string | null;
  personId?: string | null;
  personName?: string | null;
  startedAtOffsetSeconds?: number | null;
  endedAtOffsetSeconds?: number | null;
  text: string;
  sourceType?: string | null;
  confidenceScore?: number | null;
  metadata?: Record<string, any>;
}

export interface MeetingIdeaInput {
  id?: string;
  raisedByPersonId?: string | null;
  raisedByName?: string | null;
  description: string;
  problemAddressed?: string | null;
  expectedUpside?: string | null;
  constraintRelieved?: string | null;
  status?: string | null;
  linkedEntities?: JsonValue;
  sourceSegmentId?: string | null;
  metadata?: Record<string, any>;
}

export interface MeetingDecisionInput {
  id?: string;
  decisionText: string;
  decisionOwnerPersonId?: string | null;
  decisionOwnerName?: string | null;
  decisionType?: string | null;
  linkedEntities?: JsonValue;
  sourceSegmentId?: string | null;
  confidenceScore?: number | null;
  metadata?: Record<string, any>;
}

export interface MeetingActionItemInput {
  id?: string;
  description: string;
  ownerPersonId?: string | null;
  ownerName?: string | null;
  backupOwnerPersonId?: string | null;
  backupOwnerName?: string | null;
  status?: string | null;
  priority?: string | null;
  urgency?: string | null;
  dueAt?: string | null;
  sourceSegmentId?: string | null;
  sourceType?: string | null;
  linkedEntities?: JsonValue;
  completionNotes?: string | null;
  resolvedAt?: string | null;
  metadata?: Record<string, any>;
}

export interface MeetingOpenQuestionInput {
  id?: string;
  raisedByPersonId?: string | null;
  raisedByName?: string | null;
  questionText: string;
  ownerPersonId?: string | null;
  ownerName?: string | null;
  status?: string | null;
  sourceSegmentId?: string | null;
  metadata?: Record<string, any>;
}

export interface PersonVoiceSignalInput {
  id?: string;
  personId?: string | null;
  personName: string;
  signalType: string;
  signalText: string;
  theme?: string | null;
  confidenceScore?: number | null;
  sourceSegmentId?: string | null;
  metadata?: Record<string, any>;
}

export interface MeetingSessionInput {
  id?: string;
  title: string;
  meetingType?: string | null;
  sourceType: string;
  visibilityScope?: string | null;
  operatorPersonId?: string | null;
  operatorName?: string | null;
  visibilityGroupKey?: string | null;
  sourceUri?: string | null;
  rawTextRef?: string | null;
  rawText?: string | null;
  occurredAt: string;
  endedAt?: string | null;
  summaryMd?: string | null;
  decisionSummaryMd?: string | null;
  actionSummaryMd?: string | null;
  confidenceScore?: number | null;
  metadata?: Record<string, any>;
  participants?: MeetingParticipantInput[];
  transcriptSegments?: TranscriptSegmentInput[];
  ideas?: MeetingIdeaInput[];
  decisions?: MeetingDecisionInput[];
  actionItems?: MeetingActionItemInput[];
  openQuestions?: MeetingOpenQuestionInput[];
  voiceSignals?: PersonVoiceSignalInput[];
}

export interface BoardSessionParticipantInput {
  id?: string;
  participantType: string;
  seatName?: string | null;
  personId?: string | null;
  personName?: string | null;
  weightingNote?: string | null;
  metadata?: Record<string, any>;
}

export interface BoardDecisionSeatInput {
  id?: string;
  seatName: string;
  positionSummary?: string | null;
  primaryConcern?: string | null;
  primaryMetric?: string | null;
  recommendedAction?: string | null;
  disagreedWithFinalCall?: boolean;
  metadata?: Record<string, any>;
}

export interface BoardDecisionInput {
  id?: string;
  decisionTitle: string;
  decisionText: string;
  decisionType?: string | null;
  decisionScope?: string | null;
  operatorFinalCall?: string | null;
  selectedOption?: string | null;
  rejectedOptions?: any[];
  rationaleMd?: string | null;
  expectedUpside?: string | null;
  expectedDownside?: string | null;
  expectedConstraintRelieved?: string | null;
  expectedMetric?: Record<string, any>;
  decisionState?: string | null;
  decidedAt: string;
  reviewDueAt?: string | null;
  metadata?: Record<string, any>;
  seatInputs?: BoardDecisionSeatInput[];
  actionItems?: MeetingActionItemInput[];
}

export interface BoardSessionInput {
  id?: string;
  title: string;
  triggerType?: string | null;
  contextMd?: string | null;
  operatorPersonId?: string | null;
  operatorName?: string | null;
  primeDirectiveLink?: string | null;
  workstream?: string | null;
  status?: string | null;
  openedAt: string;
  decidedAt?: string | null;
  metadata?: Record<string, any>;
  participants?: BoardSessionParticipantInput[];
  decisions?: BoardDecisionInput[];
}

export interface BoardDecisionReviewInput {
  reviewWindowType?: string | null;
  actualOutcomeSummary?: string | null;
  actualMetric?: Record<string, any>;
  decisionQuality: string;
  varianceVsExpectation?: string | null;
  keepDoctrine?: string | null;
  changeDoctrine?: string | null;
  notesMd?: string | null;
  reviewedAt: string;
  metadata?: Record<string, any>;
}

export interface MeetingSynthesisApplyInput {
  summaryMd?: string | null;
  decisionSummaryMd?: string | null;
  actionSummaryMd?: string | null;
  confidenceScore?: number | null;
  ideas?: MeetingIdeaInput[];
  decisions?: MeetingDecisionInput[];
  actionItems?: MeetingActionItemInput[];
  openQuestions?: MeetingOpenQuestionInput[];
  voiceSignals?: PersonVoiceSignalInput[];
  metadata?: Record<string, any>;
}

export interface MeetingOperatorApprovalInput {
  operatorPersonId?: string | null;
  operatorName?: string | null;
  decision: 'approved' | 'rejected' | 'deferred';
  notesMd?: string | null;
  packetSnapshot?: Record<string, any>;
  approvedAt?: string;
  metadata?: Record<string, any>;
}

type ExecutionTransitionResult = {
  actionItemId: string;
  fromStatus: string | null;
  toStatus: string;
  ownerName: string | null;
};

export interface OwnerQueueFilters {
  limitOwners?: number;
}

export interface BuyerScorecardFilters {
  lookbackDays?: number;
  limit?: number;
}

export interface BuyerScorecardAttributionAuditFilters {
  lookbackDays?: number;
  limitAmbiguousCampaigns?: number;
}

export interface ScorecardSnapshotFilters extends BuyerScorecardFilters {
  capturedAt?: string;
}

function jsonb(value: JsonValue | undefined): string {
  return JSON.stringify(value ?? {});
}

function jsonbArray(value: JsonValue | undefined): string {
  return JSON.stringify(value ?? []);
}

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class MeetingIntelligenceService {
  async createMeetingSession(input: MeetingSessionInput): Promise<any> {
    return withTransaction(async (client) => {
      const meetingId = input.id || randomUUID();
      await client.query(
        `
          INSERT INTO meeting_sessions (
            id, title, meeting_type, source_type, visibility_scope, operator_person_id, operator_name, visibility_group_key, source_uri, raw_text_ref, raw_text,
            occurred_at, ended_at, summary_md, decision_summary_md, action_summary_md,
            confidence_score, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18::jsonb
          )
        `,
        [
          meetingId,
          input.title,
          input.meetingType || null,
          input.sourceType,
          input.visibilityScope || 'shared',
          input.operatorPersonId || null,
          input.operatorName || null,
          input.visibilityGroupKey || null,
          input.sourceUri || null,
          input.rawTextRef || null,
          input.rawText || null,
          input.occurredAt,
          input.endedAt || null,
          input.summaryMd || null,
          input.decisionSummaryMd || null,
          input.actionSummaryMd || null,
          input.confidenceScore ?? null,
          jsonb(input.metadata),
        ]
      );

      const segmentIdMap = new Map<string, string>();

      for (const participant of input.participants || []) {
        const participantId = participant.id || randomUUID();
        await client.query(
          `
            INSERT INTO meeting_participants (
              id, meeting_id, person_id, display_name, role_at_time, participant_type,
              attendance_confidence, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            participantId,
            meetingId,
            participant.personId || null,
            participant.displayName,
            participant.roleAtTime || null,
            participant.participantType || null,
            participant.attendanceConfidence ?? null,
            jsonb(participant.metadata),
          ]
        );
      }

      for (const segment of input.transcriptSegments || []) {
        const segmentId = segment.id || randomUUID();
        if (segment.id) segmentIdMap.set(segment.id, segmentId);
        await client.query(
          `
            INSERT INTO transcript_segments (
              id, meeting_id, speaker_label, person_id, person_name,
              started_at_offset_seconds, ended_at_offset_seconds, text,
              source_type, confidence_score, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
          `,
          [
            segmentId,
            meetingId,
            segment.speakerLabel || null,
            segment.personId || null,
            segment.personName || null,
            segment.startedAtOffsetSeconds ?? null,
            segment.endedAtOffsetSeconds ?? null,
            segment.text,
            segment.sourceType || input.sourceType,
            segment.confidenceScore ?? null,
            jsonb(segment.metadata),
          ]
        );
      }

      for (const idea of input.ideas || []) {
        await client.query(
          `
            INSERT INTO meeting_ideas (
              id, meeting_id, raised_by_person_id, raised_by_name, description,
              problem_addressed, expected_upside, constraint_relieved, status,
              linked_entities, source_segment_id, metadata
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10::jsonb, $11, $12::jsonb
            )
          `,
          [
            idea.id || randomUUID(),
            meetingId,
            idea.raisedByPersonId || null,
            idea.raisedByName || null,
            idea.description,
            idea.problemAddressed || null,
            idea.expectedUpside || null,
            idea.constraintRelieved || null,
            idea.status || 'candidate',
            jsonbArray(idea.linkedEntities),
            this.resolveSegmentId(idea.sourceSegmentId, segmentIdMap),
            jsonb(idea.metadata),
          ]
        );
      }

      for (const decision of input.decisions || []) {
        await client.query(
          `
            INSERT INTO meeting_decisions (
              id, meeting_id, decision_text, decision_owner_person_id, decision_owner_name,
              decision_type, linked_entities, source_segment_id, confidence_score, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb)
          `,
          [
            decision.id || randomUUID(),
            meetingId,
            decision.decisionText,
            decision.decisionOwnerPersonId || null,
            decision.decisionOwnerName || null,
            decision.decisionType || null,
            jsonbArray(decision.linkedEntities),
            this.resolveSegmentId(decision.sourceSegmentId, segmentIdMap),
            decision.confidenceScore ?? null,
            jsonb(decision.metadata),
          ]
        );
      }

      for (const actionItem of input.actionItems || []) {
        await this.insertActionItem(client, {
          ...actionItem,
          sourceType: actionItem.sourceType || 'meeting',
        }, meetingId, segmentIdMap);
      }

      for (const question of input.openQuestions || []) {
        await client.query(
          `
            INSERT INTO meeting_open_questions (
              id, meeting_id, raised_by_person_id, raised_by_name, question_text,
              owner_person_id, owner_name, status, source_segment_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          `,
          [
            question.id || randomUUID(),
            meetingId,
            question.raisedByPersonId || null,
            question.raisedByName || null,
            question.questionText,
            question.ownerPersonId || null,
            question.ownerName || null,
            question.status || 'open',
            this.resolveSegmentId(question.sourceSegmentId, segmentIdMap),
            jsonb(question.metadata),
          ]
        );
      }

      for (const signal of input.voiceSignals || []) {
        await client.query(
          `
            INSERT INTO person_voice_signals (
              id, person_id, person_name, meeting_id, signal_type,
              signal_text, theme, confidence_score, source_segment_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          `,
          [
            signal.id || randomUUID(),
            signal.personId || null,
            signal.personName,
            meetingId,
            signal.signalType,
            signal.signalText,
            signal.theme || null,
            signal.confidenceScore ?? null,
            this.resolveSegmentId(signal.sourceSegmentId, segmentIdMap),
            jsonb(signal.metadata),
          ]
        );
      }

      return this.getMeetingSession(meetingId);
    });
  }

  async listMeetingSessions(filters: {
    limit?: number;
    sourceType?: string;
    meetingType?: string;
    visibilityScope?: string;
  } = {}): Promise<any[]> {
    const params: any[] = [];
    const where: string[] = [];

    if (filters.sourceType) {
      params.push(filters.sourceType);
      where.push(`source_type = $${params.length}`);
    }
    if (filters.meetingType) {
      params.push(filters.meetingType);
      where.push(`meeting_type = $${params.length}`);
    }
    if (filters.visibilityScope && filters.visibilityScope !== 'all') {
      params.push(filters.visibilityScope);
      where.push(`COALESCE(visibility_scope, 'shared') = $${params.length}`);
    } else if (!filters.visibilityScope) {
      where.push(`COALESCE(visibility_scope, 'shared') = 'shared'`);
    }
    params.push(filters.limit || 50);

    const query = `
      SELECT *
      FROM meeting_sessions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY occurred_at DESC
      LIMIT $${params.length}
    `;
    const result = await getPgPool().query(query, params);
    return result.rows;
  }

  async getMeetingSession(id: string): Promise<any | null> {
    const pool = getPgPool();
    const sessionResult = await pool.query(`SELECT * FROM meeting_sessions WHERE id = $1`, [id]);
    if (!sessionResult.rows.length) return null;

    const [participants, transcriptSegments, ideas, decisions, actionItems, openQuestions, voiceSignals, approvals, executionEvents] = await Promise.all([
      pool.query(`SELECT * FROM meeting_participants WHERE meeting_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM transcript_segments WHERE meeting_id = $1 ORDER BY started_at_offset_seconds NULLS LAST, created_at ASC`, [id]),
      pool.query(`SELECT * FROM meeting_ideas WHERE meeting_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM meeting_decisions WHERE meeting_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM meeting_action_items WHERE meeting_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM meeting_open_questions WHERE meeting_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM person_voice_signals WHERE meeting_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM meeting_operator_approvals WHERE meeting_id = $1 ORDER BY approved_at DESC, created_at DESC`, [id]),
      pool.query(`SELECT * FROM meeting_execution_events WHERE meeting_id = $1 ORDER BY occurred_at DESC, created_at DESC`, [id]),
    ]);

    return {
      ...sessionResult.rows[0],
      participants: participants.rows,
      transcriptSegments: transcriptSegments.rows,
      ideas: ideas.rows,
      decisions: decisions.rows,
      actionItems: actionItems.rows,
      openQuestions: openQuestions.rows,
      voiceSignals: voiceSignals.rows,
      approvals: approvals.rows,
      executionEvents: executionEvents.rows,
    };
  }

  async updateActionItemStatus(
    id: string,
    patch: {
      status: string;
      ownerPersonId?: string | null;
      ownerName?: string | null;
      dueAt?: string | null;
      completionNotes?: string | null;
      resolvedAt?: string | null;
    }
  ): Promise<any | null> {
    return withTransaction(async (client) => {
      const existingResult = await client.query(`SELECT * FROM meeting_action_items WHERE id = $1`, [id]);
      const existing = existingResult.rows[0];
      if (!existing) return null;

      const result = await client.query(
        `
          UPDATE meeting_action_items
          SET status = $2,
              owner_person_id = COALESCE($3, owner_person_id),
              owner_name = COALESCE($4, owner_name),
              due_at = COALESCE($5, due_at),
              completion_notes = COALESCE($6, completion_notes),
              resolved_at = COALESCE($7, resolved_at),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          patch.status,
          patch.ownerPersonId ?? null,
          patch.ownerName ?? null,
          patch.dueAt ?? null,
          patch.completionNotes ?? null,
          patch.resolvedAt ?? null,
        ]
      );
      const updated = result.rows[0] || null;
      if (!updated) return null;

      if (existing.status !== updated.status) {
        await this.insertExecutionEvent(client, {
          meetingId: updated.meeting_id,
          actionItemId: updated.id,
          eventType: 'action_status_transition',
          fromStatus: existing.status || null,
          toStatus: updated.status,
          ownerPersonId: updated.owner_person_id || null,
          ownerName: updated.owner_name || null,
          notesMd: patch.completionNotes || null,
          metadata: {
            triggered_by: 'manual_status_update',
          },
          occurredAt: updated.updated_at || new Date().toISOString(),
        });

        await client.query(
          `
            UPDATE board_decision_actions
            SET status = $2,
                started_at = CASE
                  WHEN $2 IN ('assigned', 'in_progress') AND started_at IS NULL THEN NOW()
                  ELSE started_at
                END,
                completed_at = CASE
                  WHEN $2 = 'completed' THEN COALESCE(completed_at, NOW())
                  ELSE completed_at
                END,
                updated_at = NOW()
            WHERE action_item_id = $1
          `,
          [updated.id, this.boardDecisionActionStatusForActionStatus(updated.status)]
        );
      }

      return updated;
    });
  }

  async listOwnerExecutionQueues(filters: OwnerQueueFilters = {}): Promise<any[]> {
    const limitOwners = filters.limitOwners || 20;
    const result = await getPgPool().query(
      `
        SELECT mai.*
        FROM meeting_action_items mai
        LEFT JOIN meeting_sessions ms
          ON ms.id = mai.meeting_id
        WHERE mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
          AND COALESCE(ms.visibility_scope, 'shared') = 'shared'
        ORDER BY mai.updated_at DESC, mai.created_at DESC
      `
    );

    const ownerMap = new Map<string, any>();
    for (const row of result.rows) {
      const ownerKey = String(row.owner_name || row.owner_person_id || 'Unassigned').trim() || 'Unassigned';
      const ownerLabel = String(row.owner_name || row.owner_person_id || 'Unassigned').trim() || 'Unassigned';
      const queueItem = this.buildOwnerQueueItem(row);
      const current = ownerMap.get(ownerKey) || {
        ownerKey,
        ownerLabel,
        ownerPersonId: row.owner_person_id || null,
        counts: {
          totalOpen: 0,
          approved: 0,
          inProgress: 0,
          blocked: 0,
          needsOwner: 0,
          overdue: 0,
          atRisk: 0,
          inSla: 0,
        },
        metrics: {
          avgAgeHours: 0,
          oldestAgeHours: 0,
          avgHoursToDue: null as number | null,
        },
        queue: [] as any[],
      };

      current.queue.push(queueItem);
      current.counts.totalOpen += 1;
      if (queueItem.status === 'approved') current.counts.approved += 1;
      if (queueItem.status === 'in_progress') current.counts.inProgress += 1;
      if (queueItem.status === 'blocked') current.counts.blocked += 1;
      if (queueItem.status === 'needs_owner' || ownerLabel === 'Unassigned') current.counts.needsOwner += 1;
      if (queueItem.slaState === 'breached') current.counts.overdue += 1;
      if (queueItem.slaState === 'at_risk') current.counts.atRisk += 1;
      if (queueItem.slaState === 'in_sla') current.counts.inSla += 1;
      ownerMap.set(ownerKey, current);
    }

    const queues = Array.from(ownerMap.values()).map((owner) => {
      const ages = owner.queue.map((item: any) => item.ageHours);
      const hoursToDue = owner.queue
        .map((item: any) => item.hoursToDue)
        .filter((value: number | null) => typeof value === 'number');

      owner.metrics.avgAgeHours = ages.length ? Number((ages.reduce((sum: number, value: number) => sum + value, 0) / ages.length).toFixed(1)) : 0;
      owner.metrics.oldestAgeHours = ages.length ? Number(Math.max(...ages).toFixed(1)) : 0;
      owner.metrics.avgHoursToDue = hoursToDue.length
        ? Number((hoursToDue.reduce((sum: number, value: number) => sum + value, 0) / hoursToDue.length).toFixed(1))
        : null;
      owner.queue.sort((a: any, b: any) => {
        const rank = (state: string) => {
          if (state === 'breached') return 0;
          if (state === 'at_risk') return 1;
          return 2;
        };
        return rank(a.slaState) - rank(b.slaState) || b.ageHours - a.ageHours;
      });
      return owner;
    });

    queues.sort((a, b) => {
      const scoreA = a.counts.overdue * 100 + a.counts.atRisk * 10 + a.counts.totalOpen;
      const scoreB = b.counts.overdue * 100 + b.counts.atRisk * 10 + b.counts.totalOpen;
      return scoreB - scoreA;
    });

    return queues.slice(0, limitOwners);
  }

  async listOwnerExecutionAlerts(limit = 12): Promise<any[]> {
    const scorecards = await this.listBuyerExecutionScorecards({ lookbackDays: 7, limit: 50 });
    const alerts: any[] = [];

    for (const card of scorecards) {
      const reasons: string[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';

      if (card.execution.overdueActions > 0) {
        severity = 'critical';
        reasons.push(`${card.execution.overdueActions} overdue action items`);
      }
      if (card.execution.needsOwner > 0) {
        severity = severity === 'critical' ? 'critical' : 'high';
        reasons.push(`${card.execution.needsOwner} action items without owner`);
      }
      if (card.execution.atRiskActions > 0 && severity === 'low') {
        severity = 'medium';
        reasons.push(`${card.execution.atRiskActions} action items at risk of SLA breach`);
      }
      if (card.performance.netMargin < 0 && card.performance.spend > 0) {
        severity = severity === 'critical' ? 'critical' : 'high';
        reasons.push(`negative net margin over the last ${card.lookbackDays} days`);
      }

      if (!reasons.length) continue;

      alerts.push({
        ownerKey: card.ownerKey,
        ownerLabel: card.ownerLabel,
        severity,
        reasons,
        primaryMessage: `${card.ownerLabel} is carrying ${reasons.join(' and ')}.`,
        recommendedAction: this.recommendActionForAlert(card, severity),
        executionScore: card.execution.executionScore,
        queuePressure: card.execution.queuePressure,
        netMargin: card.performance.netMargin,
        lookbackDays: card.lookbackDays,
      });
    }

    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => {
      return (
        severityRank[a.severity] - severityRank[b.severity] ||
        b.queuePressure - a.queuePressure ||
        a.executionScore - b.executionScore
      );
    });

    return alerts.slice(0, limit);
  }

  async syncOwnerAlertNotifications(limit = 12): Promise<any> {
    return withTransaction(async (client) => {
      const alerts = await this.listOwnerExecutionAlerts(limit);
      let created = 0;
      const notifications: any[] = [];

      for (const alert of alerts) {
        const signature = this.buildOwnerAlertSignature(alert);
        const existing = await client.query(
          `
            SELECT *
            FROM owner_alert_notifications
            WHERE alert_signature = $1
              AND status IN ('queued', 'acknowledged')
              AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [signature]
        );
        if (existing.rows[0]) {
          notifications.push(existing.rows[0]);
          continue;
        }

        const inserted = await client.query(
          `
            INSERT INTO owner_alert_notifications (
              id, owner_key, owner_label, severity, alert_type, alert_signature,
              title, message, recommended_action, status, metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11::jsonb
            )
            RETURNING *
          `,
          [
            randomUUID(),
            alert.ownerKey,
            alert.ownerLabel,
            alert.severity,
            'owner_execution_alert',
            signature,
            `${alert.ownerLabel} ${alert.severity} execution alert`,
            alert.primaryMessage,
            alert.recommendedAction,
            'queued',
            jsonb({
              reasons: alert.reasons,
              executionScore: alert.executionScore,
              queuePressure: alert.queuePressure,
              netMargin: alert.netMargin,
              lookbackDays: alert.lookbackDays,
            }),
          ]
        );
        created += 1;
        notifications.push(inserted.rows[0]);
      }

      return {
        created,
        totalAlerts: alerts.length,
        notifications,
      };
    });
  }

  async listOwnerAlertNotifications(filters: { status?: string; limit?: number } = {}): Promise<any[]> {
    const params: any[] = [];
    const where: string[] = [];
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }
    params.push(filters.limit || 30);

    const result = await getPgPool().query(
      `
        SELECT *
        FROM owner_alert_notifications
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${params.length}
      `,
      params
    );
    return result.rows;
  }

  async updateOwnerAlertNotification(
    id: string,
    patch: { status: 'acknowledged' | 'dismissed'; acknowledgedAt?: string | null }
  ): Promise<any | null> {
    const result = await getPgPool().query(
      `
        UPDATE owner_alert_notifications
        SET status = $2,
            acknowledged_at = CASE
              WHEN $2 = 'acknowledged' THEN COALESCE($3::timestamptz, NOW())
              WHEN $2 = 'dismissed' THEN COALESCE($3::timestamptz, NOW())
              ELSE acknowledged_at
            END
        WHERE id = $1
        RETURNING *
      `,
      [id, patch.status, patch.acknowledgedAt || null]
    );
    return result.rows[0] || null;
  }

  async markOwnerAlertNotificationsDelivered(
    ids: string[],
    input: { deliveredAt?: string; channel?: string | null; messageTs?: string | null }
  ): Promise<number> {
    if (!ids.length) return 0;
    const deliveredAt = input.deliveredAt || new Date().toISOString();
    const result = await getPgPool().query(
      `
        UPDATE owner_alert_notifications
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE id = ANY($1::uuid[])
      `,
      [
        ids,
        jsonb({
          last_delivery: {
            delivered_at: deliveredAt,
            channel: input.channel || null,
            message_ts: input.messageTs || null,
          },
        }),
      ]
    );
    return result.rowCount || 0;
  }

  async listBuyerExecutionScorecards(filters: BuyerScorecardFilters = {}): Promise<any[]> {
    const lookbackDays = filters.lookbackDays || 7;
    const limit = filters.limit || 20;
    const queues = await this.listOwnerExecutionQueues({ limitOwners: 200 });
    const [performanceRows, dataQuality, attributionAudit, opportunityMixRows, launchActivityRows, throughputRows, entityLinkReport] = await Promise.all([
      this.queryCanonicalMonitoringBuyerPerformance(lookbackDays),
      this.queryMonitoringDataQuality(lookbackDays),
      this.listBuyerScorecardAttributionAudit({ lookbackDays, limitAmbiguousCampaigns: 12 }),
      this.queryBuyerOpportunityMix(),
      this.queryBuyerLaunchActivity(lookbackDays),
      this.queryBuyerThroughput(lookbackDays),
      getMeetingEntityLinkReport({ lookbackDays: Math.max(lookbackDays, 30), limitMeetings: 50 }),
    ]);
    const performanceByOwner = new Map<string, any>();
    const attributionByOwner = new Map<string, any>();
    const opportunityMixByOwner = new Map<string, any>();
    const launchActivityByOwner = new Map<string, any>();
    const throughputByOwner = new Map<string, any>();
    const linkedAccountsByOwner = new Map<string, Set<string>>();
    const accountRegistryByKey = new Map(PLATFORM_ACCOUNTS.map((account) => [account.accountKey, account]));
    const constraintsByAccountKey = new Map<string, any[]>();

    for (const row of performanceRows) {
      performanceByOwner.set(this.normalizeOwnerKey(row.ownerLabel), row);
    }
    for (const row of attributionAudit.owners || []) {
      attributionByOwner.set(this.normalizeOwnerKey(row.ownerLabel), row);
    }
    for (const row of opportunityMixRows) {
      opportunityMixByOwner.set(this.normalizeOwnerKey(row.ownerLabel), row);
    }
    for (const row of launchActivityRows) {
      launchActivityByOwner.set(this.normalizeOwnerKey(row.ownerLabel), row);
    }
    for (const row of throughputRows) {
      throughputByOwner.set(this.normalizeOwnerKey(row.ownerLabel), row);
    }
    for (const constraint of CAPACITY_CONSTRAINTS) {
      if (constraint.affectedEntityType !== 'platform_account' || constraint.status === 'resolved') continue;
      const current = constraintsByAccountKey.get(constraint.affectedEntityKey) || [];
      current.push(constraint);
      constraintsByAccountKey.set(constraint.affectedEntityKey, current);
    }
    for (const meeting of entityLinkReport?.meetings || []) {
      for (const buyer of meeting.buyerLinks || []) {
        const ownerKey = this.normalizeOwnerKey(buyer.buyerName);
        const current = linkedAccountsByOwner.get(ownerKey) || new Set<string>();
        for (const account of meeting.accountLinks || []) {
          current.add(account.accountKey);
        }
        linkedAccountsByOwner.set(ownerKey, current);
      }
    }

    const ownerKeys = new Set<string>([
      ...queues.map((queue) => this.normalizeOwnerKey(queue.ownerLabel)),
      ...performanceRows.map((row) => this.normalizeOwnerKey(row.ownerLabel)),
      ...(attributionAudit.owners || []).map((row: any) => this.normalizeOwnerKey(row.ownerLabel)),
      ...opportunityMixRows.map((row: any) => this.normalizeOwnerKey(row.ownerLabel)),
      ...launchActivityRows.map((row: any) => this.normalizeOwnerKey(row.ownerLabel)),
      ...throughputRows.map((row: any) => this.normalizeOwnerKey(row.ownerLabel)),
    ]);

    const cards = Array.from(ownerKeys).map((ownerKey) => {
      const queue = queues.find((item) => this.normalizeOwnerKey(item.ownerLabel) === ownerKey) || null;
      const perf = performanceByOwner.get(ownerKey) || {
        ownerKey,
        ownerLabel: ownerKey === 'unassigned' ? 'Unassigned' : ownerKey,
        spend: 0,
        revenue: 0,
        netMargin: 0,
        roas: null,
        activeCampaigns: 0,
        launchCount: 0,
      };
      const attribution = attributionByOwner.get(ownerKey) || {
        ownerKey,
        ownerLabel: queue?.ownerLabel || perf.ownerLabel,
        activeCampaigns: perf.activeCampaigns || 0,
        campaignsWithKnownMonitoringOwner: perf.activeCampaigns || 0,
        launchCount: perf.launchCount || 0,
        queueCount: 0,
        highConfidenceCampaigns: 0,
        attributionCoverage: 0,
        spendCoverage: 0,
        mixedOwnerCampaigns: 0,
        launchOwnerMismatchCampaigns: 0,
        queueOwnerMismatchCampaigns: 0,
        launchQueueDisagreementCampaigns: 0,
        missingLaunchOwnerCampaigns: 0,
        missingQueueOwnerCampaigns: 0,
        attributionConfidence: perf.activeCampaigns > 0 ? 'medium' : 'low',
        reasons: perf.activeCampaigns > 0 ? ['no attribution audit rows were attached for this buyer'] : ['no monitored campaigns attributed in the current window'],
      };
      const opportunityMix = opportunityMixByOwner.get(ownerKey) || {
        ownerKey,
        ownerLabel: queue?.ownerLabel || perf.ownerLabel,
        totalOwned: 0,
        pending: 0,
        approved: 0,
        launched: 0,
        rejected: 0,
        stalePending: 0,
        highConfidencePending: 0,
        draftBlueprints: 0,
        approvedBlueprints: 0,
        pendingPredictedDeltaCm: 0,
        avgConfidenceScore: null,
        topSources: [],
        topCategories: [],
        reasons: ['no owned opportunities are attached to this buyer yet'],
      };
      const launchActivity = launchActivityByOwner.get(ownerKey) || {
        ownerKey,
        ownerLabel: queue?.ownerLabel || perf.ownerLabel,
        recentLaunches: 0,
        launchDaysActive: 0,
        distinctLaunchCategories: 0,
        distinctLaunchSources: 0,
        topLaunchCategories: [],
        topLaunchSources: [],
      };
      const throughput = throughputByOwner.get(ownerKey) || {
        ownerKey,
        ownerLabel: queue?.ownerLabel || perf.ownerLabel,
        actionsTouchedRecently: 0,
        actionsClosedRecently: 0,
        actionsStartedRecently: 0,
        opportunitiesReviewedRecently: 0,
        opportunitiesApprovedRecently: 0,
        opportunitiesLaunchedRecently: 0,
        blueprintsCreatedRecently: 0,
        approvedBlueprintsCreatedRecently: 0,
        actionClosureRate: null,
        launchFollowThroughRate: null,
        throughputBand: 'yellow',
        reasons: ['not enough recent movement is grounded yet to classify throughput cleanly'],
      };
      const estimatedExploreLaunches = Math.min(
        Number(opportunityMix.launched || 0),
        Number(launchActivity.recentLaunches || 0)
      );
      const estimatedExploitLaunches = Math.max(
        0,
        Number(launchActivity.recentLaunches || 0) - estimatedExploreLaunches
      );
      const exploreShare =
        Number(launchActivity.recentLaunches || 0) > 0
          ? estimatedExploreLaunches / Number(launchActivity.recentLaunches || 0)
          : null;
      const exploitShare =
        Number(launchActivity.recentLaunches || 0) > 0
          ? estimatedExploitLaunches / Number(launchActivity.recentLaunches || 0)
          : null;
      const laneBias =
        exploreShare == null ? 'unclassified'
        : exploreShare >= 0.6 ? 'explore'
        : exploitShare != null && exploitShare >= 0.6 ? 'exploit'
        : 'balanced';
      const surfaceExposure = this.buildBuyerSurfaceExposure({
        ownerKey,
        ownerLabel: queue?.ownerLabel || perf.ownerLabel,
        performance: perf,
        launchActivity,
        linkedAccountKeys: Array.from(linkedAccountsByOwner.get(ownerKey) || []),
        accountRegistryByKey,
        constraintsByAccountKey,
      });

      const overdue = queue?.counts.overdue || 0;
      const atRisk = queue?.counts.atRisk || 0;
      const open = queue?.counts.totalOpen || 0;
      const approved = queue?.counts.approved || 0;
      const inProgress = queue?.counts.inProgress || 0;
      const needsOwner = queue?.counts.needsOwner || 0;
      const queuePressure = overdue * 100 + atRisk * 10 + open;
      const executionScore = Math.max(
        0,
        Math.min(
          100,
          100 - overdue * 25 - atRisk * 10 - needsOwner * 15 - Math.max(0, open - inProgress - approved) * 3
        )
      );
      const economicBand = this.computeEconomicBand(perf);
      const executionBand = executionScore >= 85 ? 'green' : executionScore >= 65 ? 'yellow' : 'red';
      const band = this.combineBands(economicBand, executionBand);
      const reasons = this.buildBuyerScorecardReasons({
        performance: perf,
        queue,
        dataQuality,
        attribution,
        opportunityMix,
        launchActivity,
        throughput,
        estimatedExploreLaunches,
        estimatedExploitLaunches,
        surfaceExposure,
      });

      return {
        ownerKey,
        ownerLabel: queue?.ownerLabel || perf.ownerLabel,
        lookbackDays,
        performance: {
          spend: perf.spend,
          revenue: perf.revenue,
          netMargin: perf.netMargin,
          roas: perf.roas,
          marginRate: perf.marginRate,
          sessions: perf.sessions,
          clicks: perf.clicks,
          conversions: perf.conversions,
          rpc: perf.rpc,
          revenuePerSession: perf.revenuePerSession,
          cpc: perf.cpc,
          conversionRate: perf.conversionRate,
          activeCampaigns: perf.activeCampaigns,
          launchCount: perf.launchCount,
        },
        mix: {
          topNetworks: perf.topNetworks,
          topSites: perf.topSites,
        },
        opportunityMix: {
          totalOwned: opportunityMix.totalOwned,
          pending: opportunityMix.pending,
          approved: opportunityMix.approved,
          launched: opportunityMix.launched,
          rejected: opportunityMix.rejected,
          stalePending: opportunityMix.stalePending,
          highConfidencePending: opportunityMix.highConfidencePending,
          draftBlueprints: opportunityMix.draftBlueprints,
          approvedBlueprints: opportunityMix.approvedBlueprints,
          pendingPredictedDeltaCm: opportunityMix.pendingPredictedDeltaCm,
          avgConfidenceScore: opportunityMix.avgConfidenceScore,
          topSources: opportunityMix.topSources,
          topCategories: opportunityMix.topCategories,
          reasons: opportunityMix.reasons,
        },
        activity: {
          recentLaunches: launchActivity.recentLaunches,
          launchDaysActive: launchActivity.launchDaysActive,
          distinctLaunchCategories: launchActivity.distinctLaunchCategories,
          distinctLaunchSources: launchActivity.distinctLaunchSources,
          topLaunchCategories: launchActivity.topLaunchCategories,
          topLaunchSources: launchActivity.topLaunchSources,
        },
        throughput,
        exploreExploit: {
          estimatedExploreLaunches,
          estimatedExploitLaunches,
          exploreShare,
          exploitShare,
          laneBias,
          reasons: this.buildExploreExploitReasons({
            opportunityMix,
            launchActivity,
            estimatedExploreLaunches,
            estimatedExploitLaunches,
          }),
        },
        surfaceExposure,
        trend: {
          daily: perf.dailyTrend,
        },
        execution: {
          totalOpenActions: open,
          approvedActions: approved,
          inProgressActions: inProgress,
          overdueActions: overdue,
          atRiskActions: atRisk,
          needsOwner,
          executionScore,
          queuePressure,
          avgAgeHours: queue?.metrics.avgAgeHours || 0,
          oldestAgeHours: queue?.metrics.oldestAgeHours || 0,
        },
        attribution: {
          confidence: attribution.attributionConfidence,
          attributionCoverage: attribution.attributionCoverage,
          spendCoverage: attribution.spendCoverage,
          highConfidenceCampaigns: attribution.highConfidenceCampaigns,
          campaignsWithKnownMonitoringOwner: attribution.campaignsWithKnownMonitoringOwner,
          mixedOwnerCampaigns: attribution.mixedOwnerCampaigns,
          launchOwnerMismatchCampaigns: attribution.launchOwnerMismatchCampaigns,
          queueOwnerMismatchCampaigns: attribution.queueOwnerMismatchCampaigns,
          launchQueueDisagreementCampaigns: attribution.launchQueueDisagreementCampaigns,
          missingLaunchOwnerCampaigns: attribution.missingLaunchOwnerCampaigns,
          missingQueueOwnerCampaigns: attribution.missingQueueOwnerCampaigns,
          reasons: attribution.reasons,
        },
        health: {
          economicBand,
          executionBand,
          dataConfidence: dataQuality.confidence,
          dataQuality,
          reasons,
        },
        operatorRead: this.buildBuyerScorecardOperatorRead({
          ownerLabel: queue?.ownerLabel || perf.ownerLabel,
          performance: perf,
          queue,
          opportunityMix,
          launchActivity,
          throughput,
          estimatedExploreLaunches,
          estimatedExploitLaunches,
          surfaceExposure,
          band,
          reasons,
        }),
        band,
      };
    });

    const bandRank: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    cards.sort((a, b) => {
      return (
        bandRank[a.band] - bandRank[b.band] ||
        b.execution.queuePressure - a.execution.queuePressure ||
        a.performance.netMargin - b.performance.netMargin
      );
    });

    return cards.slice(0, limit);
  }

  async snapshotBuyerExecutionScorecards(filters: ScorecardSnapshotFilters = {}): Promise<any> {
    return withTransaction(async (client) => {
      const cards = await this.listBuyerExecutionScorecards(filters);
      const capturedAt = filters.capturedAt || new Date().toISOString();
      for (const card of cards) {
        await client.query(
          `
            INSERT INTO buyer_execution_scorecard_snapshots (
              id, owner_key, owner_label, lookback_days, band,
              spend, revenue, net_margin, roas, active_campaigns, launch_count,
              total_open_actions, approved_actions, in_progress_actions, overdue_actions,
              at_risk_actions, needs_owner_actions, execution_score, queue_pressure,
              avg_age_hours, oldest_age_hours, metadata, captured_at
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15,
              $16, $17, $18, $19,
              $20, $21, $22::jsonb, $23
            )
          `,
          [
            randomUUID(),
            card.ownerKey,
            card.ownerLabel,
            card.lookbackDays,
            card.band,
            card.performance.spend,
            card.performance.revenue,
            card.performance.netMargin,
            card.performance.roas,
            card.performance.activeCampaigns,
            card.performance.launchCount,
            card.execution.totalOpenActions,
            card.execution.approvedActions,
            card.execution.inProgressActions,
            card.execution.overdueActions,
            card.execution.atRiskActions,
            card.execution.needsOwner,
            card.execution.executionScore,
            card.execution.queuePressure,
            card.execution.avgAgeHours,
            card.execution.oldestAgeHours,
            jsonb({
              source: 'meeting_intelligence',
              scorecard_version: 'canonical_v2',
              economic_band: card.health?.economicBand || null,
              execution_band: card.health?.executionBand || null,
              data_confidence: card.health?.dataConfidence || null,
              attribution_confidence: card.attribution?.confidence || null,
              attribution_coverage: card.attribution?.attributionCoverage || null,
              opportunity_mix_total_owned: card.opportunityMix?.totalOwned || 0,
              opportunity_mix_pending: card.opportunityMix?.pending || 0,
              opportunity_mix_stale_pending: card.opportunityMix?.stalePending || 0,
              opportunity_mix_pending_delta_cm: card.opportunityMix?.pendingPredictedDeltaCm || 0,
              recent_launches: card.activity?.recentLaunches || 0,
              actions_closed_recently: card.throughput?.actionsClosedRecently || 0,
              opportunities_reviewed_recently: card.throughput?.opportunitiesReviewedRecently || 0,
              opportunities_launched_recently: card.throughput?.opportunitiesLaunchedRecently || 0,
              throughput_band: card.throughput?.throughputBand || null,
              explore_launches_estimate: card.exploreExploit?.estimatedExploreLaunches || 0,
              exploit_launches_estimate: card.exploreExploit?.estimatedExploitLaunches || 0,
              lane_bias: card.exploreExploit?.laneBias || null,
              surface_risk_band: card.surfaceExposure?.riskBand || null,
              constrained_account_count: card.surfaceExposure?.linkedAccountKeys?.length || 0,
              active_surface_constraints: card.surfaceExposure?.activeConstraintCount || 0,
              unresolved_surface_exposure: card.surfaceExposure?.unresolvedSurfaceExposure || false,
              reasons: card.health?.reasons || [],
            }),
            capturedAt,
          ]
        );
      }

      return {
        capturedAt,
        count: cards.length,
      };
    });
  }

  async listBuyerExecutionScorecardHistory(filters: { ownerKey?: string; limit?: number } = {}): Promise<any[]> {
    const params: any[] = [];
    const where: string[] = [];
    if (filters.ownerKey) {
      params.push(filters.ownerKey);
      where.push(`owner_key = $${params.length}`);
    }
    params.push(filters.limit || 50);

    const result = await getPgPool().query(
      `
        SELECT *
        FROM buyer_execution_scorecard_snapshots
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY captured_at DESC
        LIMIT $${params.length}
      `,
      params
    );
    return result.rows;
  }

  async listBuyerScorecardAttributionAudit(filters: BuyerScorecardAttributionAuditFilters = {}): Promise<any> {
    return getBuyerScorecardAttributionAudit({
      lookbackDays: filters.lookbackDays,
      limitAmbiguousCampaigns: filters.limitAmbiguousCampaigns,
    });
  }

  async updateMeetingVisibility(
    id: string,
    patch: {
      visibilityScope: string;
      operatorPersonId?: string | null;
      operatorName?: string | null;
      visibilityGroupKey?: string | null;
    }
  ): Promise<any | null> {
    const result = await getPgPool().query(
      `
        UPDATE meeting_sessions
        SET visibility_scope = $2,
            operator_person_id = COALESCE($3, operator_person_id),
            operator_name = COALESCE($4, operator_name),
            visibility_group_key = COALESCE($5, visibility_group_key),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        patch.visibilityScope,
        patch.operatorPersonId ?? null,
        patch.operatorName ?? null,
        patch.visibilityGroupKey ?? null,
      ]
    );
    return result.rows[0] || null;
  }

  async applyMeetingSynthesis(id: string, input: MeetingSynthesisApplyInput): Promise<any | null> {
    return withTransaction(async (client) => {
      const meeting = await this.getMeetingSession(id);
      if (!meeting) return null;

      const generationSource = String(input.metadata?.generation_source || 'meeting_synthesis_v1');
      const participantLookup = this.buildParticipantLookup(meeting.participants || []);
      const segmentIds = (meeting.transcriptSegments || []).map((segment: any) => String(segment.id));

      await client.query(
        `
          UPDATE meeting_sessions
          SET summary_md = $2,
              decision_summary_md = $3,
              action_summary_md = $4,
              confidence_score = $5,
              metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          id,
          input.summaryMd || null,
          input.decisionSummaryMd || null,
          input.actionSummaryMd || null,
          input.confidenceScore ?? null,
          jsonb({
            meeting_synthesis: input.metadata || {},
          }),
        ]
      );

      await client.query(
        `DELETE FROM meeting_ideas WHERE meeting_id = $1 AND metadata->>'generation_source' = $2`,
        [id, generationSource]
      );
      await client.query(
        `DELETE FROM meeting_decisions WHERE meeting_id = $1 AND metadata->>'generation_source' = $2`,
        [id, generationSource]
      );
      await client.query(
        `DELETE FROM meeting_open_questions WHERE meeting_id = $1 AND metadata->>'generation_source' = $2`,
        [id, generationSource]
      );
      await client.query(
        `DELETE FROM person_voice_signals WHERE meeting_id = $1 AND metadata->>'generation_source' = $2`,
        [id, generationSource]
      );

      for (const idea of input.ideas || []) {
        const match = this.matchParticipant(idea.raisedByName || null, participantLookup);
        await client.query(
          `
            INSERT INTO meeting_ideas (
              id, meeting_id, raised_by_person_id, raised_by_name, description,
              problem_addressed, expected_upside, constraint_relieved, status,
              linked_entities, source_segment_id, metadata
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10::jsonb, $11, $12::jsonb
            )
          `,
          [
            idea.id || randomUUID(),
            id,
            match?.personId || idea.raisedByPersonId || null,
            match?.displayName || idea.raisedByName || null,
            idea.description,
            idea.problemAddressed || null,
            idea.expectedUpside || null,
            idea.constraintRelieved || null,
            idea.status || 'candidate',
            jsonbArray(idea.linkedEntities),
            this.resolveMeetingSegmentId(idea.sourceSegmentId, segmentIds),
            jsonb(idea.metadata),
          ]
        );
      }

      for (const decision of input.decisions || []) {
        const match = this.matchParticipant(decision.decisionOwnerName || null, participantLookup);
        await client.query(
          `
            INSERT INTO meeting_decisions (
              id, meeting_id, decision_text, decision_owner_person_id, decision_owner_name,
              decision_type, linked_entities, source_segment_id, confidence_score, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb)
          `,
          [
            decision.id || randomUUID(),
            id,
            decision.decisionText,
            match?.personId || decision.decisionOwnerPersonId || null,
            match?.displayName || decision.decisionOwnerName || null,
            decision.decisionType || null,
            jsonbArray(decision.linkedEntities),
            this.resolveMeetingSegmentId(decision.sourceSegmentId, segmentIds),
            decision.confidenceScore ?? null,
            jsonb(decision.metadata),
          ]
        );
      }

      await this.syncSynthesizedActionItems(client, id, input.actionItems || [], participantLookup, segmentIds, generationSource);

      for (const question of input.openQuestions || []) {
        const raisedByMatch = this.matchParticipant(question.raisedByName || null, participantLookup);
        const ownerMatch = this.matchParticipant(question.ownerName || null, participantLookup);
        await client.query(
          `
            INSERT INTO meeting_open_questions (
              id, meeting_id, raised_by_person_id, raised_by_name, question_text,
              owner_person_id, owner_name, status, source_segment_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          `,
          [
            question.id || randomUUID(),
            id,
            raisedByMatch?.personId || question.raisedByPersonId || null,
            raisedByMatch?.displayName || question.raisedByName || null,
            question.questionText,
            ownerMatch?.personId || question.ownerPersonId || null,
            ownerMatch?.displayName || question.ownerName || null,
            question.status || 'open',
            this.resolveMeetingSegmentId(question.sourceSegmentId, segmentIds),
            jsonb(question.metadata),
          ]
        );
      }

      for (const signal of input.voiceSignals || []) {
        const match = this.matchParticipant(signal.personName || null, participantLookup);
        await client.query(
          `
            INSERT INTO person_voice_signals (
              id, person_id, person_name, meeting_id, signal_type,
              signal_text, theme, confidence_score, source_segment_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          `,
          [
            signal.id || randomUUID(),
            match?.personId || signal.personId || null,
            match?.displayName || signal.personName,
            id,
            signal.signalType,
            signal.signalText,
            signal.theme || null,
            signal.confidenceScore ?? null,
            this.resolveMeetingSegmentId(signal.sourceSegmentId, segmentIds),
            jsonb(signal.metadata),
          ]
        );
      }

      return this.getMeetingSession(id);
    });
  }

  async createMeetingOperatorApproval(id: string, input: MeetingOperatorApprovalInput): Promise<any | null> {
    return withTransaction(async (client) => {
      const meeting = await this.getMeetingSession(id);
      if (!meeting) return null;

      const approvalId = randomUUID();
      const approvedAt = input.approvedAt || new Date().toISOString();
      const createdActionCount = Array.isArray(meeting.actionItems) ? meeting.actionItems.length : 0;
      const createdDecisionCount = Array.isArray(meeting.decisions) ? meeting.decisions.length : 0;

      await client.query(
        `
          INSERT INTO meeting_operator_approvals (
            id, meeting_id, operator_person_id, operator_name, decision, notes_md,
            packet_snapshot, created_action_count, created_decision_count, metadata, approved_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7::jsonb, $8, $9, $10::jsonb, $11
          )
        `,
        [
          approvalId,
          id,
          input.operatorPersonId || null,
          input.operatorName || null,
          input.decision,
          input.notesMd || null,
          jsonb(input.packetSnapshot),
          createdActionCount,
          createdDecisionCount,
          jsonb(input.metadata),
          approvedAt,
        ]
      );

      const executionTransitions = await this.applyOperatorApprovalTransitions(
        client,
        approvalId,
        meeting,
        input,
        approvedAt
      );

      await client.query(
        `
          UPDATE meeting_sessions
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          id,
          jsonb({
            latest_operator_approval: {
              approval_id: approvalId,
              decision: input.decision,
              operator_name: input.operatorName || null,
              approved_at: approvedAt,
              transitioned_action_count: executionTransitions.length,
            },
          }),
        ]
      );

      const result = await client.query(
        `SELECT * FROM meeting_operator_approvals WHERE id = $1`,
        [approvalId]
      );
      return {
        ...(result.rows[0] || null),
        executionTransitions,
      };
    });
  }

  async createBoardSession(input: BoardSessionInput): Promise<any> {
    return withTransaction(async (client) => {
      const boardSessionId = input.id || randomUUID();
      await client.query(
        `
          INSERT INTO board_sessions (
            id, title, trigger_type, context_md, operator_person_id, operator_name,
            prime_directive_link, workstream, status, opened_at, decided_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        `,
        [
          boardSessionId,
          input.title,
          input.triggerType || null,
          input.contextMd || null,
          input.operatorPersonId || null,
          input.operatorName || null,
          input.primeDirectiveLink || null,
          input.workstream || null,
          input.status || 'in_review',
          input.openedAt,
          input.decidedAt || null,
          jsonb(input.metadata),
        ]
      );

      for (const participant of input.participants || []) {
        await client.query(
          `
            INSERT INTO board_session_participants (
              id, board_session_id, participant_type, seat_name, person_id, person_name, weighting_note, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            participant.id || randomUUID(),
            boardSessionId,
            participant.participantType,
            participant.seatName || null,
            participant.personId || null,
            participant.personName || null,
            participant.weightingNote || null,
            jsonb(participant.metadata),
          ]
        );
      }

      for (const decision of input.decisions || []) {
        const boardDecisionId = decision.id || randomUUID();
        await client.query(
          `
            INSERT INTO board_decisions (
              id, board_session_id, decision_title, decision_text, decision_type, decision_scope,
              operator_final_call, selected_option, rejected_options, rationale_md, expected_upside,
              expected_downside, expected_constraint_relieved, expected_metric, decision_state,
              decided_at, review_due_at, metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9::jsonb, $10, $11,
              $12, $13, $14::jsonb, $15,
              $16, $17, $18::jsonb
            )
          `,
          [
            boardDecisionId,
            boardSessionId,
            decision.decisionTitle,
            decision.decisionText,
            decision.decisionType || null,
            decision.decisionScope || null,
            decision.operatorFinalCall || null,
            decision.selectedOption || null,
            jsonbArray(decision.rejectedOptions),
            decision.rationaleMd || null,
            decision.expectedUpside || null,
            decision.expectedDownside || null,
            decision.expectedConstraintRelieved || null,
            jsonb(decision.expectedMetric),
            decision.decisionState || 'decided',
            decision.decidedAt,
            decision.reviewDueAt || null,
            jsonb(decision.metadata),
          ]
        );

        for (const seatInput of decision.seatInputs || []) {
          await client.query(
            `
              INSERT INTO board_decision_seat_inputs (
                id, board_decision_id, seat_name, position_summary, primary_concern,
                primary_metric, recommended_action, disagreed_with_final_call, metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            `,
            [
              seatInput.id || randomUUID(),
              boardDecisionId,
              seatInput.seatName,
              seatInput.positionSummary || null,
              seatInput.primaryConcern || null,
              seatInput.primaryMetric || null,
              seatInput.recommendedAction || null,
              seatInput.disagreedWithFinalCall || false,
              jsonb(seatInput.metadata),
            ]
          );
        }

        for (const actionItem of decision.actionItems || []) {
          const createdAction = await this.insertActionItem(
            client,
            { ...actionItem, sourceType: actionItem.sourceType || 'board_decision' },
            null,
            new Map()
          );

          await client.query(
            `
              INSERT INTO board_decision_actions (
                id, board_decision_id, action_item_id, owner_person_id, owner_name, status,
                started_at, completed_at, metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            `,
            [
              randomUUID(),
              boardDecisionId,
              createdAction.id,
              actionItem.ownerPersonId || null,
              actionItem.ownerName || null,
              actionItem.status || 'assigned',
              null,
              actionItem.resolvedAt || null,
              jsonb(actionItem.metadata),
            ]
          );
        }
      }

      return this.getBoardSession(boardSessionId);
    });
  }

  async getBoardSession(id: string): Promise<any | null> {
    const pool = getPgPool();
    const sessionResult = await pool.query(`SELECT * FROM board_sessions WHERE id = $1`, [id]);
    if (!sessionResult.rows.length) return null;

    const [participants, decisions] = await Promise.all([
      pool.query(`SELECT * FROM board_session_participants WHERE board_session_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM board_decisions WHERE board_session_id = $1 ORDER BY decided_at ASC`, [id]),
    ]);

    const decisionIds = decisions.rows.map((row) => row.id);
    let seatInputs: any[] = [];
    let decisionActions: any[] = [];
    let reviews: any[] = [];

    if (decisionIds.length) {
      const params = [decisionIds];
      seatInputs = (await pool.query(`SELECT * FROM board_decision_seat_inputs WHERE board_decision_id = ANY($1::uuid[]) ORDER BY created_at ASC`, params)).rows;
      decisionActions = (await pool.query(`SELECT * FROM board_decision_actions WHERE board_decision_id = ANY($1::uuid[]) ORDER BY created_at ASC`, params)).rows;
      reviews = (await pool.query(`SELECT * FROM board_decision_reviews WHERE board_decision_id = ANY($1::uuid[]) ORDER BY reviewed_at DESC`, params)).rows;
    }

    return {
      ...sessionResult.rows[0],
      participants: participants.rows,
      decisions: decisions.rows.map((decision) => ({
        ...decision,
        seatInputs: seatInputs.filter((input) => input.board_decision_id === decision.id),
        actions: decisionActions.filter((action) => action.board_decision_id === decision.id),
        reviews: reviews.filter((review) => review.board_decision_id === decision.id),
      })),
    };
  }

  async listBoardDecisions(filters: {
    decisionState?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const params: any[] = [];
    const where: string[] = [];
    if (filters.decisionState) {
      params.push(filters.decisionState);
      where.push(`decision_state = $${params.length}`);
    }
    params.push(filters.limit || 50);

    const result = await getPgPool().query(
      `
        SELECT bd.*, bs.title AS board_session_title, bs.workstream
        FROM board_decisions bd
        JOIN board_sessions bs ON bs.id = bd.board_session_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY bd.decided_at DESC
        LIMIT $${params.length}
      `,
      params
    );
    return result.rows;
  }

  async createBoardDecisionReview(decisionId: string, input: BoardDecisionReviewInput): Promise<any> {
    return withTransaction(async (client) => {
      const reviewId = randomUUID();
      await client.query(
        `
          INSERT INTO board_decision_reviews (
            id, board_decision_id, review_window_type, actual_outcome_summary, actual_metric,
            decision_quality, variance_vs_expectation, keep_doctrine, change_doctrine,
            notes_md, reviewed_at, metadata
          ) VALUES (
            $1, $2, $3, $4, $5::jsonb,
            $6, $7, $8, $9,
            $10, $11, $12::jsonb
          )
        `,
        [
          reviewId,
          decisionId,
          input.reviewWindowType || null,
          input.actualOutcomeSummary || null,
          jsonb(input.actualMetric),
          input.decisionQuality,
          input.varianceVsExpectation || null,
          input.keepDoctrine || null,
          input.changeDoctrine || null,
          input.notesMd || null,
          input.reviewedAt,
          jsonb(input.metadata),
        ]
      );

      const nextState = this.mapReviewQualityToDecisionState(input.decisionQuality);
      await client.query(
        `UPDATE board_decisions SET decision_state = $2, updated_at = NOW() WHERE id = $1`,
        [decisionId, nextState]
      );

      const result = await client.query(`SELECT * FROM board_decision_reviews WHERE id = $1`, [reviewId]);
      return result.rows[0];
    });
  }

  private async insertActionItem(
    client: PoolClient,
    actionItem: MeetingActionItemInput,
    meetingId: string | null,
    segmentIdMap: Map<string, string>
  ): Promise<any> {
    const actionItemId = actionItem.id || randomUUID();
    const result = await client.query(
      `
        INSERT INTO meeting_action_items (
          id, meeting_id, description, owner_person_id, owner_name,
          backup_owner_person_id, backup_owner_name, status, priority, urgency,
          due_at, source_segment_id, source_type, linked_entities, completion_notes,
          resolved_at, metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14::jsonb, $15,
          $16, $17::jsonb
        ) RETURNING *
      `,
      [
        actionItemId,
        meetingId,
        actionItem.description,
        actionItem.ownerPersonId || null,
        actionItem.ownerName || null,
        actionItem.backupOwnerPersonId || null,
        actionItem.backupOwnerName || null,
        actionItem.status || 'open',
        actionItem.priority || 'medium',
        actionItem.urgency || null,
        actionItem.dueAt || null,
        this.resolveSegmentId(actionItem.sourceSegmentId, segmentIdMap),
        actionItem.sourceType || 'meeting',
        jsonbArray(actionItem.linkedEntities),
        actionItem.completionNotes || null,
        actionItem.resolvedAt || null,
        jsonb(actionItem.metadata),
      ]
    );
    return result.rows[0];
  }

  private resolveSegmentId(sourceSegmentId: string | null | undefined, map: Map<string, string>): string | null {
    if (!sourceSegmentId) return null;
    return map.get(sourceSegmentId) || sourceSegmentId;
  }

  private resolveMeetingSegmentId(sourceSegmentId: string | null | undefined, segmentIds: string[]): string | null {
    if (!sourceSegmentId) return null;
    if (segmentIds.includes(sourceSegmentId)) return sourceSegmentId;

    const asIndex = Number(sourceSegmentId);
    if (Number.isInteger(asIndex) && asIndex > 0 && asIndex <= segmentIds.length) {
      return segmentIds[asIndex - 1];
    }

    return null;
  }

  private buildParticipantLookup(participants: any[]): Map<string, { personId: string | null; displayName: string }> {
    const lookup = new Map<string, { personId: string | null; displayName: string }>();
    for (const participant of participants) {
      const displayName = String(participant.display_name || participant.displayName || '').trim();
      if (!displayName) continue;
      lookup.set(this.normalizeName(displayName), {
        personId: participant.person_id || participant.personId || null,
        displayName,
      });
    }
    return lookup;
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private matchParticipant(
    candidateName: string | null,
    lookup: Map<string, { personId: string | null; displayName: string }>
  ): { personId: string | null; displayName: string } | null {
    if (!candidateName) return null;
    const normalized = this.normalizeName(candidateName);
    if (!normalized) return null;

    const exact = lookup.get(normalized);
    if (exact) return exact;

    for (const [key, value] of lookup.entries()) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return value;
      }
    }
    return null;
  }

  private buildSynthesisActionKey(actionItem: MeetingActionItemInput): string {
    const description = String(actionItem.description || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const ownerName = String(actionItem.ownerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return `${description}::${ownerName}`;
  }

  private async syncSynthesizedActionItems(
    client: PoolClient,
    meetingId: string,
    actionItems: MeetingActionItemInput[],
    participantLookup: Map<string, { personId: string | null; displayName: string }>,
    segmentIds: string[],
    generationSource: string
  ): Promise<void> {
    const existingResult = await client.query(
      `
        SELECT *
        FROM meeting_action_items
        WHERE meeting_id = $1
          AND metadata->>'generation_source' = $2
      `,
      [meetingId, generationSource]
    );

    const existingByKey = new Map<string, any>();
    for (const row of existingResult.rows) {
      const key = String(row.metadata?.synthesis_key || '');
      if (key) existingByKey.set(key, row);
    }

    const seenKeys = new Set<string>();

    for (const actionItem of actionItems) {
      const synthesisKey = this.buildSynthesisActionKey(actionItem);
      if (!synthesisKey || seenKeys.has(synthesisKey)) continue;
      seenKeys.add(synthesisKey);

      const ownerMatch = this.matchParticipant(actionItem.ownerName || null, participantLookup);
      const backupMatch = this.matchParticipant(actionItem.backupOwnerName || null, participantLookup);
      const metadata = {
        ...(actionItem.metadata || {}),
        generation_source: generationSource,
        synthesis_key: synthesisKey,
      };
      const linkedEntities = jsonbArray(actionItem.linkedEntities);
      const sourceSegmentId = this.resolveMeetingSegmentId(actionItem.sourceSegmentId, segmentIds);
      const existing = existingByKey.get(synthesisKey);

      if (existing) {
        await client.query(
          `
            UPDATE meeting_action_items
            SET description = $2,
                priority = $3,
                urgency = $4,
                source_segment_id = $5,
                source_type = $6,
                linked_entities = $7::jsonb,
                metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb,
                owner_person_id = COALESCE(owner_person_id, $9),
                owner_name = COALESCE(owner_name, $10),
                backup_owner_person_id = COALESCE(backup_owner_person_id, $11),
                backup_owner_name = COALESCE(backup_owner_name, $12),
                due_at = COALESCE(due_at, $13),
                updated_at = NOW()
            WHERE id = $1
          `,
          [
            existing.id,
            actionItem.description,
            actionItem.priority || 'medium',
            actionItem.urgency || null,
            sourceSegmentId,
            actionItem.sourceType || 'meeting_synthesis',
            linkedEntities,
            jsonb(metadata),
            ownerMatch?.personId || actionItem.ownerPersonId || null,
            ownerMatch?.displayName || actionItem.ownerName || null,
            backupMatch?.personId || actionItem.backupOwnerPersonId || null,
            backupMatch?.displayName || actionItem.backupOwnerName || null,
            actionItem.dueAt || null,
          ]
        );
        continue;
      }

      await this.insertActionItem(
        client,
        {
          ...actionItem,
          ownerPersonId: ownerMatch?.personId || actionItem.ownerPersonId || null,
          ownerName: ownerMatch?.displayName || actionItem.ownerName || null,
          backupOwnerPersonId: backupMatch?.personId || actionItem.backupOwnerPersonId || null,
          backupOwnerName: backupMatch?.displayName || actionItem.backupOwnerName || null,
          sourceSegmentId,
          sourceType: actionItem.sourceType || 'meeting_synthesis',
          metadata,
        },
        meetingId,
        new Map()
      );
    }

    for (const row of existingResult.rows) {
      const key = String(row.metadata?.synthesis_key || '');
      if (!key || seenKeys.has(key)) continue;
      await client.query(
        `
          UPDATE meeting_action_items
          SET status = CASE
                WHEN status IN ('open', 'suggested') AND resolved_at IS NULL THEN 'superseded'
                ELSE status
              END,
              metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          row.id,
          jsonb({
            synthesis_stale: true,
            synthesis_stale_at: new Date().toISOString(),
          }),
        ]
      );
    }
  }

  private async applyOperatorApprovalTransitions(
    client: PoolClient,
    approvalId: string,
    meeting: any,
    approval: MeetingOperatorApprovalInput,
    occurredAt: string
  ): Promise<ExecutionTransitionResult[]> {
    const actionItems = Array.isArray(meeting.actionItems) ? meeting.actionItems : [];
    const transitions: ExecutionTransitionResult[] = [];
    const targetActionItems = actionItems.filter((row: any) => this.shouldTransitionActionForApproval(row, approval.decision));

    for (const actionItem of targetActionItems) {
      const fromStatus = actionItem.status || null;
      const toStatus = this.nextActionStatusForApproval(actionItem, approval.decision);
      if (!toStatus || fromStatus === toStatus) continue;

      await client.query(
        `
          UPDATE meeting_action_items
          SET status = $2,
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          actionItem.id,
          toStatus,
          jsonb({
            latest_operator_transition: {
              operator_approval_id: approvalId,
              decision: approval.decision,
              from_status: fromStatus,
              to_status: toStatus,
              occurred_at: occurredAt,
            },
          }),
        ]
      );

      await this.insertExecutionEvent(client, {
        meetingId: meeting.id,
        actionItemId: actionItem.id,
        operatorApprovalId: approvalId,
        eventType: this.eventTypeForApproval(approval.decision),
        fromStatus,
        toStatus,
        ownerPersonId: actionItem.owner_person_id || null,
        ownerName: actionItem.owner_name || null,
        notesMd: approval.notesMd || null,
        metadata: {
          triggered_by: 'operator_approval',
        },
        occurredAt,
      });

      await client.query(
        `
          UPDATE board_decision_actions
          SET status = $2,
              started_at = CASE
                WHEN $2 IN ('assigned', 'in_progress') AND started_at IS NULL THEN $3::timestamptz
                ELSE started_at
              END,
              completed_at = CASE
                WHEN $2 = 'completed' THEN COALESCE(completed_at, $3::timestamptz)
                ELSE completed_at
              END,
              updated_at = NOW()
          WHERE action_item_id = $1
        `,
        [
          actionItem.id,
          this.boardDecisionActionStatusForActionStatus(toStatus),
          occurredAt,
        ]
      );

      transitions.push({
        actionItemId: actionItem.id,
        fromStatus,
        toStatus,
        ownerName: actionItem.owner_name || null,
      });
    }

    await this.insertExecutionEvent(client, {
      meetingId: meeting.id,
      operatorApprovalId: approvalId,
      eventType: this.eventTypeForApproval(approval.decision),
      notesMd: approval.notesMd || null,
      metadata: {
        triggered_by: 'operator_approval',
        transitioned_action_count: transitions.length,
      },
      occurredAt,
    });

    return transitions;
  }

  private shouldTransitionActionForApproval(actionItem: any, decision: MeetingOperatorApprovalInput['decision']): boolean {
    const sourceType = String(actionItem.source_type || '');
    const generationSource = String(actionItem.metadata?.generation_source || '');
    const status = String(actionItem.status || '').toLowerCase();
    const isSynthesized = sourceType === 'meeting_synthesis' || generationSource === 'meeting_synthesis_v1';

    if (!isSynthesized) return false;
    if (['done', 'completed', 'resolved', 'cancelled'].includes(status)) return false;

    if (decision === 'approved') {
      return ['open', 'suggested', 'deferred', 'needs_owner'].includes(status) || !status;
    }
    if (decision === 'deferred') {
      return ['open', 'suggested', 'approved', 'needs_owner'].includes(status) || !status;
    }
    return ['open', 'suggested', 'approved', 'needs_owner', 'deferred'].includes(status) || !status;
  }

  private nextActionStatusForApproval(actionItem: any, decision: MeetingOperatorApprovalInput['decision']): string {
    const ownerName = String(actionItem.owner_name || '').trim();
    if (decision === 'approved') {
      return ownerName ? 'approved' : 'needs_owner';
    }
    if (decision === 'deferred') {
      return 'deferred';
    }
    return 'cancelled';
  }

  private eventTypeForApproval(decision: MeetingOperatorApprovalInput['decision']): string {
    switch (decision) {
      case 'approved':
        return 'operator_approved';
      case 'rejected':
        return 'operator_rejected';
      default:
        return 'operator_deferred';
    }
  }

  private boardDecisionActionStatusForActionStatus(status: string): string {
    switch (status) {
      case 'approved':
        return 'assigned';
      case 'in_progress':
        return 'in_progress';
      case 'done':
      case 'completed':
      case 'resolved':
        return 'completed';
      case 'cancelled':
        return 'stalled';
      case 'deferred':
        return 'assigned';
      default:
        return 'assigned';
    }
  }

  private recommendActionForAlert(card: any, severity: string): string {
    if (card.execution.needsOwner > 0) {
      return 'Assign owners immediately before any more work is approved for this lane.';
    }
    if (card.execution.overdueActions > 0) {
      return 'Review the owner queue now and either move the oldest actions into progress or de-scope them explicitly.';
    }
    if (card.performance.netMargin < 0) {
      return 'Check whether this owner should be protected from new allocation until execution and profitability stabilize.';
    }
    if (severity === 'medium') {
      return 'Intervene before the queue breaches: tighten scope, confirm owners, and reset due dates only with a reason.';
    }
    return 'Review the queue and confirm the next action is actually moving.';
  }

  private async queryCanonicalMonitoringBuyerPerformance(lookbackDays: number): Promise<any[]> {
    const conn = createMonitoringConnection();
    try {
      await initMonitoringSchema(conn);
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
      const startDateString = startDate.toISOString().slice(0, 10);
      const canonicalCampaignDaysCte = `
        WITH canonical_campaign_days AS (
          SELECT
            date,
            campaign_id,
            COALESCE(MAX(NULLIF(owner, '')), 'UNKNOWN') AS owner,
            COALESCE(MAX(NULLIF(media_source, '')), 'UNKNOWN') AS media_source,
            COALESCE(MAX(NULLIF(rsoc_site, '')), 'UNKNOWN') AS rsoc_site,
            MAX(COALESCE(spend_usd, 0)) AS spend_usd,
            MAX(COALESCE(revenue_usd, 0)) AS revenue_usd,
            MAX(COALESCE(sessions, 0)) AS sessions,
            MAX(COALESCE(clicks, 0)) AS clicks,
            MAX(COALESCE(conversions, 0)) AS conversions
          FROM campaign_index
          WHERE date >= ${sqlString(startDateString)}
            AND level = 'campaign'
          GROUP BY 1, 2
        )
      `;

      const rows = await allRows<any>(
        conn,
        `
          ${canonicalCampaignDaysCte},
          perf AS (
            SELECT
              owner,
              SUM(spend_usd) AS spend,
              SUM(revenue_usd) AS revenue,
              SUM(sessions) AS sessions,
              SUM(clicks) AS clicks,
              SUM(conversions) AS conversions,
              COUNT(DISTINCT campaign_id) AS active_campaigns
            FROM canonical_campaign_days
            GROUP BY 1
          ),
          launches AS (
            SELECT
              COALESCE(NULLIF(owner, ''), 'UNKNOWN') AS owner,
              COUNT(DISTINCT campaign_id) AS launch_count
            FROM campaign_launches
            WHERE first_seen_date >= ${sqlString(startDateString)}
            GROUP BY 1
          )
          SELECT
            perf.owner,
            perf.spend,
            perf.revenue,
            perf.sessions,
            perf.clicks,
            perf.conversions,
            perf.active_campaigns,
            COALESCE(launches.launch_count, 0) AS launch_count
          FROM perf
          LEFT JOIN launches ON launches.owner = perf.owner
        `
      );

      const [networkRows, siteRows, dailyRows] = await Promise.all([
        allRows<any>(
          conn,
          `
            ${canonicalCampaignDaysCte}
            SELECT
              owner,
              media_source,
              SUM(spend_usd) AS spend,
              SUM(revenue_usd) AS revenue,
              COUNT(DISTINCT campaign_id) AS active_campaigns
            FROM canonical_campaign_days
            GROUP BY 1, 2
          `
        ),
        allRows<any>(
          conn,
          `
            ${canonicalCampaignDaysCte}
            SELECT
              owner,
              rsoc_site,
              SUM(spend_usd) AS spend,
              SUM(revenue_usd) AS revenue,
              COUNT(DISTINCT campaign_id) AS active_campaigns
            FROM canonical_campaign_days
            GROUP BY 1, 2
          `
        ),
        allRows<any>(
          conn,
          `
            ${canonicalCampaignDaysCte}
            SELECT
              owner,
              date,
              SUM(spend_usd) AS spend,
              SUM(revenue_usd) AS revenue
            FROM canonical_campaign_days
            GROUP BY 1, 2
            ORDER BY owner, date
          `
        ),
      ]);

      const networksByOwner = new Map<string, any[]>();
      for (const row of networkRows) {
        const ownerKey = this.normalizeOwnerKey(String(row.owner || 'UNKNOWN'));
        const current = networksByOwner.get(ownerKey) || [];
        const spend = Number(row.spend || 0);
        const revenue = Number(row.revenue || 0);
        current.push({
          label: String(row.media_source || 'UNKNOWN'),
          spend,
          revenue,
          netMargin: revenue - spend,
          roas: spend > 0 ? revenue / spend : null,
          activeCampaigns: Number(row.active_campaigns || 0),
        });
        networksByOwner.set(ownerKey, current);
      }

      const sitesByOwner = new Map<string, any[]>();
      for (const row of siteRows) {
        const ownerKey = this.normalizeOwnerKey(String(row.owner || 'UNKNOWN'));
        const current = sitesByOwner.get(ownerKey) || [];
        const spend = Number(row.spend || 0);
        const revenue = Number(row.revenue || 0);
        current.push({
          label: String(row.rsoc_site || 'UNKNOWN'),
          spend,
          revenue,
          netMargin: revenue - spend,
          roas: spend > 0 ? revenue / spend : null,
          activeCampaigns: Number(row.active_campaigns || 0),
        });
        sitesByOwner.set(ownerKey, current);
      }

      const trendByOwner = new Map<string, any[]>();
      for (const row of dailyRows) {
        const ownerKey = this.normalizeOwnerKey(String(row.owner || 'UNKNOWN'));
        const current = trendByOwner.get(ownerKey) || [];
        const spend = Number(row.spend || 0);
        const revenue = Number(row.revenue || 0);
        current.push({
          date: String(row.date),
          spend,
          revenue,
          netMargin: revenue - spend,
        });
        trendByOwner.set(ownerKey, current);
      }

      return rows.map((row) => {
        const ownerLabel = String(row.owner || 'UNKNOWN');
        const spend = Number(row.spend || 0);
        const revenue = Number(row.revenue || 0);
        const sessions = Number(row.sessions || 0);
        const clicks = Number(row.clicks || 0);
        const conversions = Number(row.conversions || 0);
        const ownerKey = this.normalizeOwnerKey(ownerLabel);
        const topNetworks = (networksByOwner.get(ownerKey) || [])
          .sort((a, b) => b.netMargin - a.netMargin || b.revenue - a.revenue)
          .slice(0, 3);
        const topSites = (sitesByOwner.get(ownerKey) || [])
          .sort((a, b) => b.netMargin - a.netMargin || b.revenue - a.revenue)
          .slice(0, 3);
        return {
          ownerKey,
          ownerLabel,
          spend,
          revenue,
          netMargin: revenue - spend,
          roas: spend > 0 ? revenue / spend : null,
          marginRate: revenue > 0 ? (revenue - spend) / revenue : null,
          sessions,
          clicks,
          conversions,
          rpc: clicks > 0 ? revenue / clicks : null,
          revenuePerSession: sessions > 0 ? revenue / sessions : null,
          cpc: clicks > 0 ? spend / clicks : null,
          conversionRate: clicks > 0 ? conversions / clicks : null,
          activeCampaigns: Number(row.active_campaigns || 0),
          launchCount: Number(row.launch_count || 0),
          topNetworks,
          topSites,
          dailyTrend: trendByOwner.get(ownerKey) || [],
        };
      });
    } finally {
      closeConnection(conn);
    }
  }

  private async queryMonitoringDataQuality(lookbackDays: number): Promise<any> {
    const conn = createMonitoringConnection();
    try {
      await initMonitoringSchema(conn);
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
      const startDateString = startDate.toISOString().slice(0, 10);
      const rows = await allRows<any>(
        conn,
        `
          SELECT date, endpoint, status, row_count, error_message
          FROM endpoint_completeness
          WHERE date >= ${sqlString(startDateString)}
            AND status <> 'OK'
          ORDER BY date DESC, endpoint ASC
        `
      );

      const failingEndpoints = rows.map((row) => ({
        date: String(row.date),
        endpoint: String(row.endpoint),
        status: String(row.status),
        rowCount: Number(row.row_count || 0),
        errorMessage: row.error_message ? String(row.error_message) : null,
      }));
      const failureDays = new Set(failingEndpoints.map((row) => row.date)).size;
      const confidence =
        failingEndpoints.length === 0 ? 'high'
        : failureDays <= Math.max(1, Math.floor(lookbackDays / 3)) ? 'medium'
        : 'low';

      return {
        confidence,
        failingEndpointCount: failingEndpoints.length,
        failureDays,
        failingEndpoints: failingEndpoints.slice(0, 10),
      };
    } finally {
      closeConnection(conn);
    }
  }

  private async queryBuyerOpportunityMix(): Promise<any[]> {
    try {
      const result = await getPgPool().query(
        `
          SELECT
            COALESCE(NULLIF(q.owner_name, ''), 'Unassigned') AS owner_label,
            o.source,
            COALESCE(NULLIF(o.category, ''), 'uncategorized') AS category,
            o.status,
            o.confidence_score,
            o.predicted_delta_cm,
            o.created_at,
            COUNT(cb.id) FILTER (WHERE cb.status = 'draft') AS draft_blueprints,
            COUNT(cb.id) FILTER (WHERE cb.status = 'approved') AS approved_blueprints
          FROM opportunity_ownership_queue q
          JOIN opportunities o
            ON o.id = q.opportunity_id
          LEFT JOIN campaign_blueprints cb
            ON cb.opportunity_id = o.id
          GROUP BY
            q.owner_name,
            o.id,
            o.source,
            o.category,
            o.status,
            o.confidence_score,
            o.predicted_delta_cm,
            o.created_at
          ORDER BY q.owner_name ASC, o.created_at DESC
        `
      );

      const owners = new Map<string, any>();
      const now = Date.now();

      for (const row of result.rows) {
        const ownerLabel = String(row.owner_label || 'Unassigned');
        const ownerKey = this.normalizeOwnerKey(ownerLabel);
        const current = owners.get(ownerKey) || {
          ownerKey,
          ownerLabel,
          totalOwned: 0,
          pending: 0,
          approved: 0,
          launched: 0,
          rejected: 0,
          stalePending: 0,
          highConfidencePending: 0,
          draftBlueprints: 0,
          approvedBlueprints: 0,
          pendingPredictedDeltaCm: 0,
          confidenceSamples: [] as number[],
          sourceCounts: new Map<string, number>(),
          categoryCounts: new Map<string, number>(),
        };

        current.totalOwned += 1;
        const status = String(row.status || 'pending');
        const confidenceScore = row.confidence_score == null ? null : Number(row.confidence_score);
        const predictedDeltaCm = row.predicted_delta_cm == null ? 0 : Number(row.predicted_delta_cm);
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        const ageDays = createdAt ? (now - createdAt.getTime()) / 86400000 : 0;
        const source = String(row.source || 'unknown');
        const category = String(row.category || 'uncategorized');

        current.sourceCounts.set(source, (current.sourceCounts.get(source) || 0) + 1);
        current.categoryCounts.set(category, (current.categoryCounts.get(category) || 0) + 1);
        current.draftBlueprints += Number(row.draft_blueprints || 0);
        current.approvedBlueprints += Number(row.approved_blueprints || 0);
        if (confidenceScore != null) current.confidenceSamples.push(confidenceScore);

        if (status === 'pending') {
          current.pending += 1;
          current.pendingPredictedDeltaCm += predictedDeltaCm;
          if (ageDays >= 7) current.stalePending += 1;
          if (confidenceScore != null && confidenceScore >= 0.75) current.highConfidencePending += 1;
        } else if (status === 'approved') {
          current.approved += 1;
        } else if (status === 'launched') {
          current.launched += 1;
        } else if (status === 'rejected') {
          current.rejected += 1;
        }

        owners.set(ownerKey, current);
      }

      return Array.from(owners.values()).map((owner) => {
        const topSources = Array.from<[string, number]>(owner.sourceCounts.entries())
          .map(([label, count]) => ({
            label,
            count,
            share: owner.totalOwned > 0 ? count / owner.totalOwned : 0,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .slice(0, 3);
        const topCategories = Array.from<[string, number]>(owner.categoryCounts.entries())
          .map(([label, count]) => ({
            label,
            count,
            share: owner.totalOwned > 0 ? count / owner.totalOwned : 0,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .slice(0, 3);
        const avgConfidenceScore = owner.confidenceSamples.length
          ? owner.confidenceSamples.reduce((sum: number, value: number) => sum + value, 0) / owner.confidenceSamples.length
          : null;

        const reasons: string[] = [];
        if (owner.totalOwned === 0) reasons.push('no owned opportunities are attached to this buyer yet');
        if (owner.pending > 0) reasons.push(`${owner.pending} opportunities are still pending`);
        if (owner.stalePending > 0) reasons.push(`${owner.stalePending} pending opportunities are stale`);
        if (owner.highConfidencePending > 0) reasons.push(`${owner.highConfidencePending} high-confidence opportunities are still waiting upstream`);
        if (topSources[0] && topSources[0].share >= 0.7) reasons.push(`opportunity mix is highly concentrated in ${topSources[0].label}`);
        if (!reasons.length) reasons.push('owned opportunity mix is currently balanced enough to monitor without intervention');

        return {
          ownerKey: owner.ownerKey,
          ownerLabel: owner.ownerLabel,
          totalOwned: owner.totalOwned,
          pending: owner.pending,
          approved: owner.approved,
          launched: owner.launched,
          rejected: owner.rejected,
          stalePending: owner.stalePending,
          highConfidencePending: owner.highConfidencePending,
          draftBlueprints: owner.draftBlueprints,
          approvedBlueprints: owner.approvedBlueprints,
          pendingPredictedDeltaCm: Number(owner.pendingPredictedDeltaCm.toFixed(2)),
          avgConfidenceScore: avgConfidenceScore == null ? null : Number(avgConfidenceScore.toFixed(3)),
          topSources,
          topCategories,
          reasons,
        };
      });
    } catch (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
  }

  private async queryBuyerLaunchActivity(lookbackDays: number): Promise<any[]> {
    const conn = createMonitoringConnection();
    try {
      await initMonitoringSchema(conn);
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
      const startDateString = startDate.toISOString().slice(0, 10);

      const rows = await allRows<any>(
        conn,
        `
          SELECT
            COALESCE(NULLIF(owner, ''), 'UNKNOWN') AS owner,
            COUNT(DISTINCT campaign_id) AS recent_launches,
            COUNT(DISTINCT first_seen_date) AS launch_days_active,
            COUNT(DISTINCT COALESCE(NULLIF(category, ''), 'uncategorized')) AS distinct_launch_categories,
            COUNT(DISTINCT COALESCE(NULLIF(media_source, ''), 'unknown')) AS distinct_launch_sources
          FROM campaign_launches
          WHERE first_seen_date >= ${sqlString(startDateString)}
          GROUP BY 1
        `
      );

      const [categoryRows, sourceRows] = await Promise.all([
        allRows<any>(
          conn,
          `
            SELECT
              COALESCE(NULLIF(owner, ''), 'UNKNOWN') AS owner,
              COALESCE(NULLIF(category, ''), 'uncategorized') AS category,
              COUNT(DISTINCT campaign_id) AS launch_count
            FROM campaign_launches
            WHERE first_seen_date >= ${sqlString(startDateString)}
            GROUP BY 1, 2
          `
        ),
        allRows<any>(
          conn,
          `
            SELECT
              COALESCE(NULLIF(owner, ''), 'UNKNOWN') AS owner,
              COALESCE(NULLIF(media_source, ''), 'unknown') AS media_source,
              COUNT(DISTINCT campaign_id) AS launch_count
            FROM campaign_launches
            WHERE first_seen_date >= ${sqlString(startDateString)}
            GROUP BY 1, 2
          `
        ),
      ]);

      const categoriesByOwner = new Map<string, any[]>();
      for (const row of categoryRows) {
        const ownerKey = this.normalizeOwnerKey(String(row.owner || 'UNKNOWN'));
        const current = categoriesByOwner.get(ownerKey) || [];
        current.push({
          label: String(row.category || 'uncategorized'),
          count: Number(row.launch_count || 0),
        });
        categoriesByOwner.set(ownerKey, current);
      }

      const sourcesByOwner = new Map<string, any[]>();
      for (const row of sourceRows) {
        const ownerKey = this.normalizeOwnerKey(String(row.owner || 'UNKNOWN'));
        const current = sourcesByOwner.get(ownerKey) || [];
        current.push({
          label: String(row.media_source || 'unknown'),
          count: Number(row.launch_count || 0),
        });
        sourcesByOwner.set(ownerKey, current);
      }

      return rows.map((row) => {
        const ownerLabel = String(row.owner || 'UNKNOWN');
        const ownerKey = this.normalizeOwnerKey(ownerLabel);
        const recentLaunches = Number(row.recent_launches || 0);
        const topLaunchCategories = (categoriesByOwner.get(ownerKey) || [])
          .map((item) => ({
            ...item,
            share: recentLaunches > 0 ? item.count / recentLaunches : 0,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .slice(0, 3);
        const topLaunchSources = (sourcesByOwner.get(ownerKey) || [])
          .map((item) => ({
            ...item,
            share: recentLaunches > 0 ? item.count / recentLaunches : 0,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .slice(0, 3);

        return {
          ownerKey,
          ownerLabel,
          recentLaunches,
          launchDaysActive: Number(row.launch_days_active || 0),
          distinctLaunchCategories: Number(row.distinct_launch_categories || 0),
          distinctLaunchSources: Number(row.distinct_launch_sources || 0),
          topLaunchCategories,
          topLaunchSources,
        };
      });
    } finally {
      closeConnection(conn);
    }
  }

  private async queryBuyerThroughput(lookbackDays: number): Promise<any[]> {
    try {
      const result = await getPgPool().query(
        `
          WITH owner_action_activity AS (
            SELECT
              COALESCE(NULLIF(mai.owner_name, ''), 'Unassigned') AS owner_label,
              COUNT(*) FILTER (WHERE mai.updated_at >= NOW() - ($1::text || ' days')::interval) AS actions_touched_recently,
              COUNT(*) FILTER (
                WHERE mai.updated_at >= NOW() - ($1::text || ' days')::interval
                  AND LOWER(COALESCE(mai.status, '')) IN ('done', 'completed', 'resolved')
              ) AS actions_closed_recently,
              COUNT(*) FILTER (
                WHERE mai.updated_at >= NOW() - ($1::text || ' days')::interval
                  AND LOWER(COALESCE(mai.status, '')) = 'in_progress'
              ) AS actions_started_recently
            FROM meeting_action_items mai
            LEFT JOIN meeting_sessions ms
              ON ms.id = mai.meeting_id
            WHERE COALESCE(ms.visibility_scope, 'shared') = 'shared'
            GROUP BY 1
          ),
          owner_opportunity_activity AS (
            SELECT
              COALESCE(NULLIF(q.owner_name, ''), 'Unassigned') AS owner_label,
              COUNT(*) FILTER (WHERE q.updated_at >= NOW() - ($1::text || ' days')::interval) AS opportunities_reviewed_recently,
              COUNT(*) FILTER (
                WHERE o.updated_at >= NOW() - ($1::text || ' days')::interval
                  AND o.status = 'approved'
              ) AS opportunities_approved_recently,
              COUNT(*) FILTER (
                WHERE o.updated_at >= NOW() - ($1::text || ' days')::interval
                  AND o.status = 'launched'
              ) AS opportunities_launched_recently,
              COUNT(DISTINCT cb.id) FILTER (
                WHERE cb.created_at >= NOW() - ($1::text || ' days')::interval
              ) AS blueprints_created_recently,
              COUNT(DISTINCT cb.id) FILTER (
                WHERE cb.created_at >= NOW() - ($1::text || ' days')::interval
                  AND cb.status = 'approved'
              ) AS approved_blueprints_created_recently
            FROM opportunity_ownership_queue q
            JOIN opportunities o
              ON o.id = q.opportunity_id
            LEFT JOIN campaign_blueprints cb
              ON cb.opportunity_id = o.id
            GROUP BY 1
          )
          SELECT
            COALESCE(a.owner_label, o.owner_label) AS owner_label,
            COALESCE(a.actions_touched_recently, 0) AS actions_touched_recently,
            COALESCE(a.actions_closed_recently, 0) AS actions_closed_recently,
            COALESCE(a.actions_started_recently, 0) AS actions_started_recently,
            COALESCE(o.opportunities_reviewed_recently, 0) AS opportunities_reviewed_recently,
            COALESCE(o.opportunities_approved_recently, 0) AS opportunities_approved_recently,
            COALESCE(o.opportunities_launched_recently, 0) AS opportunities_launched_recently,
            COALESCE(o.blueprints_created_recently, 0) AS blueprints_created_recently,
            COALESCE(o.approved_blueprints_created_recently, 0) AS approved_blueprints_created_recently
          FROM owner_action_activity a
          FULL OUTER JOIN owner_opportunity_activity o
            ON o.owner_label = a.owner_label
          ORDER BY 1 ASC
        `,
        [String(lookbackDays)]
      );

      return result.rows.map((row) => {
        const actionsTouchedRecently = Number(row.actions_touched_recently || 0);
        const actionsClosedRecently = Number(row.actions_closed_recently || 0);
        const actionsStartedRecently = Number(row.actions_started_recently || 0);
        const opportunitiesReviewedRecently = Number(row.opportunities_reviewed_recently || 0);
        const opportunitiesApprovedRecently = Number(row.opportunities_approved_recently || 0);
        const opportunitiesLaunchedRecently = Number(row.opportunities_launched_recently || 0);
        const blueprintsCreatedRecently = Number(row.blueprints_created_recently || 0);
        const approvedBlueprintsCreatedRecently = Number(row.approved_blueprints_created_recently || 0);
        const actionClosureRate =
          actionsTouchedRecently > 0 ? actionsClosedRecently / actionsTouchedRecently : null;
        const launchFollowThroughRate =
          opportunitiesApprovedRecently > 0
            ? opportunitiesLaunchedRecently / opportunitiesApprovedRecently
            : opportunitiesLaunchedRecently > 0
              ? 1
              : null;

        let throughputBand: 'green' | 'yellow' | 'red' = 'yellow';
        if (actionsTouchedRecently === 0 && opportunitiesReviewedRecently === 0 && opportunitiesLaunchedRecently === 0) {
          throughputBand = 'red';
        } else if (
          actionsClosedRecently > 0 ||
          opportunitiesLaunchedRecently > 0 ||
          (actionClosureRate != null && actionClosureRate >= 0.35)
        ) {
          throughputBand = 'green';
        } else if (
          actionsStartedRecently > 0 ||
          opportunitiesApprovedRecently > 0 ||
          blueprintsCreatedRecently > 0
        ) {
          throughputBand = 'yellow';
        } else {
          throughputBand = 'red';
        }

        const reasons: string[] = [];
        if (actionsClosedRecently > 0) reasons.push(`${actionsClosedRecently} action items closed recently`);
        if (actionsStartedRecently > 0) reasons.push(`${actionsStartedRecently} action items moved into progress recently`);
        if (opportunitiesReviewedRecently > 0) reasons.push(`${opportunitiesReviewedRecently} owned opportunities were reviewed recently`);
        if (opportunitiesApprovedRecently > 0) reasons.push(`${opportunitiesApprovedRecently} opportunities were approved recently`);
        if (opportunitiesLaunchedRecently > 0) reasons.push(`${opportunitiesLaunchedRecently} opportunities converted into launches recently`);
        if (blueprintsCreatedRecently > 0) reasons.push(`${blueprintsCreatedRecently} blueprints were created recently`);
        if (actionsTouchedRecently > 0 && actionsClosedRecently === 0) reasons.push('work is moving, but little of it is visibly closing yet');
        if (!reasons.length) reasons.push('recent throughput is light, so follow-through is not yet strongly evidenced');

        return {
          ownerKey: this.normalizeOwnerKey(String(row.owner_label || 'Unassigned')),
          ownerLabel: String(row.owner_label || 'Unassigned'),
          actionsTouchedRecently,
          actionsClosedRecently,
          actionsStartedRecently,
          opportunitiesReviewedRecently,
          opportunitiesApprovedRecently,
          opportunitiesLaunchedRecently,
          blueprintsCreatedRecently,
          approvedBlueprintsCreatedRecently,
          actionClosureRate: actionClosureRate == null ? null : Number(actionClosureRate.toFixed(3)),
          launchFollowThroughRate: launchFollowThroughRate == null ? null : Number(launchFollowThroughRate.toFixed(3)),
          throughputBand,
          reasons,
        };
      });
    } catch (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
  }

  private normalizeOwnerKey(value: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'unknown') return 'unassigned';
    return normalized;
  }

  private computeEconomicBand(perf: any): 'green' | 'yellow' | 'red' {
    const spend = Number(perf?.spend || 0);
    const netMargin = Number(perf?.netMargin || 0);
    const roas = typeof perf?.roas === 'number' ? perf.roas : null;
    if (spend <= 0) return 'yellow';
    if (netMargin > 0 && (roas === null || roas >= 1)) return 'green';
    if (netMargin > 0 || (roas !== null && roas >= 1)) return 'yellow';
    return 'red';
  }

  private combineBands(...bands: Array<'green' | 'yellow' | 'red'>): 'green' | 'yellow' | 'red' {
    if (bands.includes('red')) return 'red';
    if (bands.includes('yellow')) return 'yellow';
    return 'green';
  }

  private buildBuyerScorecardReasons(input: {
    performance: any;
    queue: any | null;
    dataQuality: any;
    attribution: any;
    opportunityMix: any;
    launchActivity: any;
    throughput: any;
    estimatedExploreLaunches: number;
    estimatedExploitLaunches: number;
    surfaceExposure: any;
  }): string[] {
    const reasons: string[] = [];
    const {
      performance,
      queue,
      dataQuality,
      attribution,
      opportunityMix,
      launchActivity,
      throughput,
      estimatedExploreLaunches,
      estimatedExploitLaunches,
      surfaceExposure,
    } = input;
    if (Number(performance.netMargin || 0) < 0) reasons.push('negative net margin in the lookback window');
    if (typeof performance.roas === 'number' && performance.roas < 1) reasons.push('ROAS is below break-even');
    if ((queue?.counts?.overdue || 0) > 0) reasons.push(`${queue.counts.overdue} overdue action items`);
    if ((queue?.counts?.needsOwner || 0) > 0) reasons.push(`${queue.counts.needsOwner} items missing an owner`);
    if (dataQuality?.confidence === 'low') reasons.push('monitoring endpoint quality is degraded');
    if (attribution?.attributionConfidence === 'low') reasons.push('buyer attribution confidence is low');
    if ((attribution?.launchOwnerMismatchCampaigns || 0) > 0) reasons.push(`${attribution.launchOwnerMismatchCampaigns} campaigns disagree with launch ownership`);
    if ((attribution?.queueOwnerMismatchCampaigns || 0) > 0) reasons.push(`${attribution.queueOwnerMismatchCampaigns} campaigns disagree with queue ownership`);
    if ((opportunityMix?.stalePending || 0) > 0) reasons.push(`${opportunityMix.stalePending} owned opportunities are stale upstream`);
    if ((opportunityMix?.highConfidencePending || 0) > 0) reasons.push(`${opportunityMix.highConfidencePending} high-confidence opportunities are still waiting upstream`);
    if ((opportunityMix?.totalOwned || 0) === 0) reasons.push('no owned opportunity inventory is attached to this buyer yet');
    if ((launchActivity?.recentLaunches || 0) > 0 && estimatedExploreLaunches === 0) reasons.push('recent launch activity appears entirely exploit-side right now');
    if (estimatedExploitLaunches > estimatedExploreLaunches && (launchActivity?.recentLaunches || 0) > 0) reasons.push('exploit activity is outweighing explore activity in the current window');
    if ((surfaceExposure?.criticalConstraintCount || 0) > 0) reasons.push(`${surfaceExposure.criticalConstraintCount} critical surface constraints are attached to this buyer`);
    if ((surfaceExposure?.highConstraintCount || 0) > 0) reasons.push(`${surfaceExposure.highConstraintCount} high-severity surface constraints are attached to this buyer`);
    if (surfaceExposure?.unresolvedSurfaceExposure) reasons.push('platform exposure is visible but the exact constrained account surface is not fully resolved yet');
    if (throughput?.throughputBand === 'red') reasons.push('recent throughput and follow-through are weak');
    if ((throughput?.actionsClosedRecently || 0) === 0 && (throughput?.actionsTouchedRecently || 0) > 0) reasons.push('recent action movement is not yet producing visible closure');
    if ((throughput?.opportunitiesReviewedRecently || 0) === 0 && (opportunityMix?.pending || 0) > 0) reasons.push('pending owned opportunities are not being reviewed quickly enough');
    if (!reasons.length) reasons.push('economics and execution are currently inside acceptable bounds');
    return reasons;
  }

  private buildBuyerScorecardOperatorRead(input: {
    ownerLabel: string;
    performance: any;
    queue: any | null;
    opportunityMix: any;
    launchActivity: any;
    throughput: any;
    estimatedExploreLaunches: number;
    estimatedExploitLaunches: number;
    surfaceExposure: any;
    band: 'green' | 'yellow' | 'red';
    reasons: string[];
  }): string {
    const {
      ownerLabel,
      performance,
      opportunityMix,
      launchActivity,
      throughput,
      estimatedExploreLaunches,
      estimatedExploitLaunches,
      surfaceExposure,
      band,
      reasons,
    } = input;
    const topNetwork = performance.topNetworks?.[0]?.label || 'unknown network';
    const topSource = opportunityMix?.topSources?.[0]?.label || null;
    const recentLaunches = Number(launchActivity?.recentLaunches || 0);
    const dominantSurface = surfaceExposure?.dominantConstrainedAccount || null;
    if (band === 'red') {
      return `${ownerLabel} needs intervention: ${reasons[0]}, with ${topNetwork} carrying the heaviest monitored exposure, ${dominantSurface || 'surface risk still being resolved'} as the key constrained surface, ${recentLaunches} recent launches, ${throughput?.actionsClosedRecently || 0} recently closed actions, and an explore/exploit split of ${estimatedExploreLaunches}/${estimatedExploitLaunches}.`;
    }
    if (band === 'yellow') {
      return `${ownerLabel} is in a watch state: keep ${topNetwork} under review, ${dominantSurface ? `treat ${dominantSurface} as the current constrained surface, and ` : ''}use the owned opportunity mix${topSource ? ` anchored in ${topSource}` : ''}, the recent throughput read of ${throughput?.throughputBand || 'unknown'}, and the explore/exploit split of ${estimatedExploreLaunches}/${estimatedExploitLaunches} to decide whether more allocation would be real growth or just inherited ease.`;
    }
    return `${ownerLabel} is currently healthy enough to observe rather than interrupt, with ${topNetwork} as the strongest monitored network, ${opportunityMix?.totalOwned || 0} owned opportunities in the mix view, ${recentLaunches} recent launches showing current activity, ${throughput?.actionsClosedRecently || 0} recent closures, and ${surfaceExposure?.riskBand || 'low'} current surface pressure.`;
  }

  private buildExploreExploitReasons(input: {
    opportunityMix: any;
    launchActivity: any;
    estimatedExploreLaunches: number;
    estimatedExploitLaunches: number;
  }): string[] {
    const { opportunityMix, launchActivity, estimatedExploreLaunches, estimatedExploitLaunches } = input;
    const reasons: string[] = [];
    const recentLaunches = Number(launchActivity?.recentLaunches || 0);
    if ((opportunityMix?.pending || 0) > 0) reasons.push(`${opportunityMix.pending} opportunities are still being explored upstream`);
    if ((opportunityMix?.launched || 0) > 0) reasons.push(`${opportunityMix.launched} owned opportunities have already converted into launches`);
    if (recentLaunches > 0) reasons.push(`${recentLaunches} campaigns launched in the current activity window`);
    if (recentLaunches > 0 && estimatedExploreLaunches === 0) reasons.push('launch activity is currently exploit-only by observable signal');
    if (estimatedExploitLaunches > estimatedExploreLaunches) reasons.push('exploit activity is currently dominant');
    if (estimatedExploreLaunches > estimatedExploitLaunches) reasons.push('explore conversion is currently a meaningful share of launch activity');
    if (!reasons.length) reasons.push('not enough grounded launch activity exists yet to classify explore vs exploit cleanly');
    return reasons;
  }

  private buildBuyerSurfaceExposure(input: {
    ownerKey: string;
    ownerLabel: string;
    performance: any;
    launchActivity: any;
    linkedAccountKeys: string[];
    accountRegistryByKey: Map<string, any>;
    constraintsByAccountKey: Map<string, any[]>;
  }): any {
    const {
      performance,
      launchActivity,
      linkedAccountKeys,
      accountRegistryByKey,
      constraintsByAccountKey,
    } = input;
    const inferredPlatforms = this.inferBuyerPlatforms({ performance, launchActivity });
    const linkedAccounts = linkedAccountKeys
      .map((accountKey) => accountRegistryByKey.get(accountKey))
      .filter(Boolean);
    const activeConstraints = linkedAccountKeys.flatMap((accountKey) => constraintsByAccountKey.get(accountKey) || []);
    const criticalConstraintCount = activeConstraints.filter((constraint) => constraint.severity === 'critical').length;
    const highConstraintCount = activeConstraints.filter((constraint) => constraint.severity === 'high').length;
    const mediumConstraintCount = activeConstraints.filter((constraint) => constraint.severity === 'medium').length;
    const unresolvedSurfaceExposure = linkedAccounts.length === 0 && inferredPlatforms.length > 0;
    const dominantAccount = [...linkedAccounts].sort((a, b) => {
      const constraintDelta =
        (constraintsByAccountKey.get(b.accountKey) || []).length - (constraintsByAccountKey.get(a.accountKey) || []).length;
      if (constraintDelta !== 0) return constraintDelta;
      return this.surfaceSeverityRank(a.policyRiskLevel) - this.surfaceSeverityRank(b.policyRiskLevel);
    })[0] || null;
    let riskBand: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalConstraintCount > 0) riskBand = 'critical';
    else if (highConstraintCount > 0) riskBand = 'high';
    else if (
      mediumConstraintCount > 0 ||
      linkedAccounts.some((account) => ['high', 'critical'].includes(account.policyRiskLevel)) ||
      unresolvedSurfaceExposure
    ) {
      riskBand = 'medium';
    }

    const reasons: string[] = [];
    if (dominantAccount && activeConstraints.length > 0) {
      reasons.push(`${dominantAccount.accountLabel} carries ${activeConstraints.length} active account-level constraints`);
    } else if (dominantAccount) {
      reasons.push(`${dominantAccount.accountLabel} is the primary linked surface for this buyer`);
    }
    if (criticalConstraintCount > 0) reasons.push(`${criticalConstraintCount} critical constraints are live on linked account surfaces`);
    if (highConstraintCount > 0) reasons.push(`${highConstraintCount} high-severity constraints are live on linked account surfaces`);
    if (unresolvedSurfaceExposure) {
      reasons.push(`recent launch activity points to ${inferredPlatforms.join(', ')} exposure, but the exact account surface is unresolved`);
    }
    if (!reasons.length) reasons.push('no constrained account exposure is currently attached to this buyer');

    return {
      linkedAccountKeys,
      linkedAccountLabels: linkedAccounts.map((account) => account.accountLabel),
      inferredPlatforms,
      activeConstraintCount: activeConstraints.length,
      criticalConstraintCount,
      highConstraintCount,
      mediumConstraintCount,
      dominantConstrainedAccount: dominantAccount?.accountLabel || null,
      unresolvedSurfaceExposure,
      riskBand,
      reasons,
    };
  }

  private inferBuyerPlatforms(input: { performance: any; launchActivity: any }): string[] {
    const labels = [
      ...(input.performance?.topNetworks || []).map((item: any) => String(item.label || '')),
      ...(input.launchActivity?.topLaunchSources || []).map((item: any) => String(item.label || '')),
    ]
      .join(' ')
      .toLowerCase();
    const inferred = new Set<string>();
    if (/facebook|meta/.test(labels)) inferred.add('Meta');
    if (/newsbreak/.test(labels)) inferred.add('NewsBreak');
    if (/microsoft|msn/.test(labels)) inferred.add('Microsoft');
    if (/system1|rsoc/.test(labels)) inferred.add('System1');
    return Array.from(inferred);
  }

  private surfaceSeverityRank(value: string | null | undefined): number {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return rank[String(value || 'low')] ?? 3;
  }

  private buildOwnerAlertSignature(alert: any): string {
    return createHash('sha1')
      .update([
        alert.ownerKey,
        alert.severity,
        alert.primaryMessage,
        alert.recommendedAction,
        ...(alert.reasons || []),
      ].join('|'))
      .digest('hex');
  }

  private async insertExecutionEvent(
    client: PoolClient,
    input: {
      meetingId: string;
      actionItemId?: string | null;
      operatorApprovalId?: string | null;
      eventType: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      ownerPersonId?: string | null;
      ownerName?: string | null;
      notesMd?: string | null;
      metadata?: Record<string, any>;
      occurredAt: string;
    }
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO meeting_execution_events (
          id, meeting_id, action_item_id, operator_approval_id, event_type,
          from_status, to_status, owner_person_id, owner_name, notes_md, metadata, occurred_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11::jsonb, $12
        )
      `,
      [
        randomUUID(),
        input.meetingId,
        input.actionItemId || null,
        input.operatorApprovalId || null,
        input.eventType,
        input.fromStatus || null,
        input.toStatus || null,
        input.ownerPersonId || null,
        input.ownerName || null,
        input.notesMd || null,
        jsonb(input.metadata),
        input.occurredAt,
      ]
    );
  }

  private buildOwnerQueueItem(row: any): any {
    const sla = this.computeActionItemSla(row);
    return {
      id: row.id,
      meetingId: row.meeting_id,
      description: row.description,
      ownerName: row.owner_name || null,
      ownerPersonId: row.owner_person_id || null,
      status: row.status,
      priority: row.priority,
      urgency: row.urgency,
      dueAt: row.due_at,
      ageHours: sla.ageHours,
      slaHours: sla.slaHours,
      hoursRemaining: sla.hoursRemaining,
      hoursToDue: sla.hoursToDue,
      slaState: sla.slaState,
      queueLane: sla.queueLane,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceType: row.source_type,
    };
  }

  private computeActionItemSla(row: any): {
    ageHours: number;
    slaHours: number;
    hoursRemaining: number;
    hoursToDue: number | null;
    slaState: 'breached' | 'at_risk' | 'in_sla';
    queueLane: 'unassigned' | 'ready' | 'in_progress' | 'blocked' | 'deferred';
  } {
    const now = Date.now();
    const createdAtMs = row.updated_at ? Date.parse(row.updated_at) : Date.parse(row.created_at);
    const ageHours = Number(Math.max(0, (now - createdAtMs) / 36e5).toFixed(1));
    const status = String(row.status || '').toLowerCase();
    const priority = String(row.priority || '').toLowerCase();
    const urgency = String(row.urgency || '').toLowerCase();
    const hasOwner = Boolean(String(row.owner_name || row.owner_person_id || '').trim());

    let slaHours = 72;
    if (priority === 'critical' || urgency === 'today') slaHours = 4;
    else if (priority === 'high') slaHours = 24;
    else if (status === 'approved' || urgency === 'this_week') slaHours = 48;
    else if (status === 'blocked') slaHours = 24;
    else if (status === 'deferred' || urgency === 'backlog') slaHours = 168;

    const hoursRemaining = Number((slaHours - ageHours).toFixed(1));
    const hoursToDue = row.due_at ? Number(((Date.parse(row.due_at) - now) / 36e5).toFixed(1)) : null;
    const breached = hoursRemaining < 0 || (typeof hoursToDue === 'number' && hoursToDue < 0);
    const atRisk = !breached && (hoursRemaining <= Math.max(4, slaHours * 0.25) || (typeof hoursToDue === 'number' && hoursToDue <= 12));
    let queueLane: 'unassigned' | 'ready' | 'in_progress' | 'blocked' | 'deferred' = 'ready';
    if (!hasOwner || status === 'needs_owner') queueLane = 'unassigned';
    else if (status === 'in_progress') queueLane = 'in_progress';
    else if (status === 'blocked') queueLane = 'blocked';
    else if (status === 'deferred') queueLane = 'deferred';

    return {
      ageHours,
      slaHours,
      hoursRemaining,
      hoursToDue,
      slaState: breached ? 'breached' : atRisk ? 'at_risk' : 'in_sla',
      queueLane,
    };
  }

  private mapReviewQualityToDecisionState(decisionQuality: string): string {
    switch (decisionQuality) {
      case 'good':
        return 'closed_good';
      case 'bad':
        return 'closed_bad';
      case 'mixed':
        return 'closed_mixed';
      case 'not_executed':
        return 'stalled';
      default:
        return 'measured';
    }
  }
}
