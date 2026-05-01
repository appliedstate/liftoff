import { randomUUID } from 'crypto';
import { getPgPool } from './pg';

export interface PrivateConversationSourceInput {
  sourceKey: string;
  label: string;
  channelRef: string;
  slackThreadTs?: string | null;
  watchWindow?: string | null;
  meetingType?: string | null;
  query?: string | null;
  visibilityScope?: string | null;
  operatorPersonId?: string | null;
  operatorName?: string | null;
  counterpartPersonId?: string | null;
  counterpartName: string;
  objective?: string | null;
  status?: string | null;
  autoIngest?: boolean | null;
  metadata?: Record<string, any>;
}

function jsonb(value: Record<string, any> | undefined): string {
  return JSON.stringify(value || {});
}

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

export async function upsertPrivateConversationSource(input: PrivateConversationSourceInput): Promise<any> {
  const result = await getPgPool().query(
    `
      INSERT INTO private_conversation_sources (
        id, source_key, label, channel_ref, slack_thread_ts, watch_window,
        meeting_type, query, visibility_scope, operator_person_id, operator_name,
        counterpart_person_id, counterpart_name, objective, status, auto_ingest, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17::jsonb
      )
      ON CONFLICT (source_key)
      DO UPDATE SET
        label = EXCLUDED.label,
        channel_ref = EXCLUDED.channel_ref,
        slack_thread_ts = EXCLUDED.slack_thread_ts,
        watch_window = EXCLUDED.watch_window,
        meeting_type = EXCLUDED.meeting_type,
        query = EXCLUDED.query,
        visibility_scope = EXCLUDED.visibility_scope,
        operator_person_id = EXCLUDED.operator_person_id,
        operator_name = EXCLUDED.operator_name,
        counterpart_person_id = EXCLUDED.counterpart_person_id,
        counterpart_name = EXCLUDED.counterpart_name,
        objective = EXCLUDED.objective,
        status = EXCLUDED.status,
        auto_ingest = EXCLUDED.auto_ingest,
        metadata = COALESCE(private_conversation_sources.metadata, '{}'::jsonb) || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [
      randomUUID(),
      input.sourceKey,
      input.label,
      input.channelRef,
      input.slackThreadTs || null,
      input.watchWindow || '2d',
      input.meetingType || 'slack_private_conversation',
      input.query || null,
      input.visibilityScope || 'private_operator',
      input.operatorPersonId || null,
      input.operatorName || null,
      input.counterpartPersonId || null,
      input.counterpartName,
      input.objective || null,
      input.status || 'active',
      input.autoIngest ?? true,
      jsonb(input.metadata),
    ]
  );
  return result.rows[0] || null;
}

export async function listPrivateConversationSources(filters: {
  status?: string;
  autoIngestOnly?: boolean;
} = {}): Promise<any[]> {
  try {
    const params: any[] = [];
    const where: string[] = [];
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }
    if (filters.autoIngestOnly) {
      where.push(`auto_ingest = TRUE`);
    }
    const result = await getPgPool().query(
      `
        SELECT *
        FROM private_conversation_sources
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY counterpart_name ASC, created_at ASC
      `,
      params
    );
    return result.rows;
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

export async function getPrivateConversationSource(sourceKey: string): Promise<any | null> {
  try {
    const result = await getPgPool().query(
      `
        SELECT *
        FROM private_conversation_sources
        WHERE source_key = $1
        LIMIT 1
      `,
      [sourceKey]
    );
    return result.rows[0] || null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

export async function markPrivateConversationSourceIngested(sourceKey: string, input: {
  meetingId?: string | null;
  slackChannelId?: string | null;
  slackChannelName?: string | null;
  occurredAt?: string | null;
}): Promise<void> {
  try {
    await getPgPool().query(
      `
        UPDATE private_conversation_sources
        SET slack_channel_id = COALESCE($2, slack_channel_id),
            slack_channel_name = COALESCE($3, slack_channel_name),
            last_ingested_at = COALESCE($4::timestamptz, NOW()),
            last_meeting_id = COALESCE($5::uuid, last_meeting_id),
            updated_at = NOW()
        WHERE source_key = $1
      `,
      [
        sourceKey,
        input.slackChannelId || null,
        input.slackChannelName || null,
        input.occurredAt || null,
        input.meetingId || null,
      ]
    );
  } catch (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}
