import { randomUUID } from 'crypto';
import { getPgPool } from './pg';

export type OperatorCommandQueueStatus =
  | 'queued'
  | 'seen'
  | 'in_progress'
  | 'cleared'
  | 'promoted'
  | 'deferred';

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

function jsonb(value: Record<string, any> | undefined): string {
  return JSON.stringify(value || {});
}

export async function listOperatorCommandQueueStates(): Promise<any[]> {
  try {
    const result = await getPgPool().query(
      `
        SELECT *
        FROM operator_command_queue_state
        ORDER BY updated_at DESC
      `
    );
    return result.rows;
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

export async function updateOperatorCommandQueueState(input: {
  commandKey: string;
  ownerKey: string;
  ownerLabel?: string | null;
  status: OperatorCommandQueueStatus;
  noteMd?: string | null;
  metadata?: Record<string, any>;
}): Promise<any | null> {
  try {
    const result = await getPgPool().query(
      `
        INSERT INTO operator_command_queue_state (
          id, command_key, owner_key, owner_label, status, note_md,
          first_seen_at, last_seen_at, last_state_changed_at,
          seen_at, in_progress_at, cleared_at, promoted_at, deferred_at,
          metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          NOW(), NOW(), NOW(),
          CASE WHEN $5 = 'seen' THEN NOW() ELSE NULL END,
          CASE WHEN $5 = 'in_progress' THEN NOW() ELSE NULL END,
          CASE WHEN $5 = 'cleared' THEN NOW() ELSE NULL END,
          CASE WHEN $5 = 'promoted' THEN NOW() ELSE NULL END,
          CASE WHEN $5 = 'deferred' THEN NOW() ELSE NULL END,
          $7::jsonb
        )
        ON CONFLICT (command_key)
        DO UPDATE SET
          owner_key = EXCLUDED.owner_key,
          owner_label = EXCLUDED.owner_label,
          status = EXCLUDED.status,
          note_md = COALESCE(EXCLUDED.note_md, operator_command_queue_state.note_md),
          last_seen_at = NOW(),
          last_state_changed_at = NOW(),
          seen_at = CASE
            WHEN EXCLUDED.status = 'seen' THEN COALESCE(operator_command_queue_state.seen_at, NOW())
            ELSE operator_command_queue_state.seen_at
          END,
          in_progress_at = CASE
            WHEN EXCLUDED.status = 'in_progress' THEN COALESCE(operator_command_queue_state.in_progress_at, NOW())
            ELSE operator_command_queue_state.in_progress_at
          END,
          cleared_at = CASE
            WHEN EXCLUDED.status = 'cleared' THEN COALESCE(operator_command_queue_state.cleared_at, NOW())
            ELSE operator_command_queue_state.cleared_at
          END,
          promoted_at = CASE
            WHEN EXCLUDED.status = 'promoted' THEN COALESCE(operator_command_queue_state.promoted_at, NOW())
            ELSE operator_command_queue_state.promoted_at
          END,
          deferred_at = CASE
            WHEN EXCLUDED.status = 'deferred' THEN COALESCE(operator_command_queue_state.deferred_at, NOW())
            ELSE operator_command_queue_state.deferred_at
          END,
          metadata = COALESCE(operator_command_queue_state.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING *
      `,
      [
        randomUUID(),
        input.commandKey,
        input.ownerKey,
        input.ownerLabel || null,
        input.status,
        input.noteMd || null,
        jsonb(input.metadata),
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}
