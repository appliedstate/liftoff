#!/usr/bin/env ts-node

import 'dotenv/config';
import {
  allRows,
  closeConnection,
  createMonitoringConnection,
  initMonitoringSchema,
  runSql,
  sqlString,
} from '../../lib/monitoringDb';

type CandidateMatch = {
  queue_id: string;
  source_row: number;
  category: string | null;
  assigned_buyer: string | null;
  request_date: string | null;
  campaign_id: string | null;
  first_seen_date: string | null;
  owner: string | null;
  media_source: string | null;
  row_rank: number;
};

function getFlag(name: string, def = ''): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def;
  return arg.slice(key.length);
}

async function main(): Promise<void> {
  const sourceFile = getFlag('source-file');
  const sourceFilterSql = sourceFile ? `AND q.source_file = ${sqlString(sourceFile)}` : '';

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);

    const candidates = await allRows<CandidateMatch>(
      conn,
      `WITH ranked AS (
        SELECT
          q.queue_id,
          q.source_row,
          q.category,
          q.assigned_buyer,
          q.request_date,
          cl.campaign_id,
          cl.first_seen_date,
          cl.owner,
          cl.media_source,
          ROW_NUMBER() OVER (
            PARTITION BY q.queue_id
            ORDER BY cl.first_seen_date ASC, cl.campaign_id ASC
          ) AS row_rank
        FROM campaign_assignment_queue q
        JOIN campaign_launches cl
          ON lower(COALESCE(q.category, '')) = lower(COALESCE(cl.category, ''))
         AND lower(COALESCE(q.assigned_buyer, '')) = lower(COALESCE(cl.owner, ''))
         AND (
           q.request_date IS NULL
           OR cl.first_seen_date >= q.request_date
         )
        WHERE q.assignment_state IN ('assigned', 'unassigned')
          AND q.launch_campaign_id IS NULL
          AND q.assigned_buyer IS NOT NULL
          ${sourceFilterSql}
      )
      SELECT
        queue_id,
        source_row,
        category,
        assigned_buyer,
        request_date,
        campaign_id,
        first_seen_date,
        owner,
        media_source,
        row_rank
      FROM ranked
      WHERE row_rank = 1`
    );

    if (candidates.length === 0) {
      console.log('[queue:reconcile] No new launch matches found.');
      return;
    }

    let updated = 0;
    for (const row of candidates) {
      await runSql(
        conn,
        `UPDATE campaign_assignment_queue
         SET launch_campaign_id = ${sqlString(row.campaign_id)},
             launch_date = ${sqlString(row.first_seen_date)},
             launch_owner = ${sqlString(row.owner)},
             launch_media_source = ${sqlString(row.media_source)},
             assignment_state = 'launched',
             updated_at = CURRENT_TIMESTAMP
         WHERE queue_id = ${sqlString(row.queue_id)}
           AND launch_campaign_id IS NULL`
      );
      updated += 1;
      console.log(
        `[queue:reconcile] row=${row.source_row} category="${row.category || 'N/A'}" linked campaign=${row.campaign_id || 'N/A'}`
      );
    }

    console.log(`[queue:reconcile] Reconciled ${updated} queue rows to launched campaigns.`);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('[queue:reconcile] Fatal error:', err?.message || err);
  process.exit(1);
});

