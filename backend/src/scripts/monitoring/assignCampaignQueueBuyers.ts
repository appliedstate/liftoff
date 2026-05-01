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

type QueueRow = {
  queue_id: string;
  source_row: number;
  category: string | null;
  requested_buyer: string | null;
  assigned_buyer: string | null;
  assignment_state: string | null;
};

type BuyerLoad = {
  buyer: string;
  active_count: number;
};

type AssignMode = 'assign-open' | 'reassign-open';

function getFlag(name: string, def = ''): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def;
  return arg.slice(key.length);
}

function parseBuyerList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseAssignMode(raw: string): AssignMode {
  const mode = raw.trim().toLowerCase();
  if (mode === 'reassign-open') return 'reassign-open';
  return 'assign-open';
}

async function main(): Promise<void> {
  const buyersRaw = getFlag('buyers');
  if (!buyersRaw) {
    throw new Error('Missing required flag --buyers=Ben,Cook,TJ,Phil');
  }
  const buyers = parseBuyerList(buyersRaw);
  if (buyers.length === 0) {
    throw new Error('No buyers parsed from --buyers');
  }

  const sourceFile = getFlag('source-file');
  const limit = Math.max(1, Number(getFlag('limit', '1000')) || 1000);
  const mode = parseAssignMode(getFlag('mode', 'assign-open'));

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);

    const loadRows = await allRows<BuyerLoad>(
      conn,
      `SELECT
        assigned_buyer AS buyer,
        COUNT(*) AS active_count
      FROM campaign_assignment_queue
      WHERE assigned_buyer IS NOT NULL
        AND assignment_state IN ('assigned', 'unassigned')
      GROUP BY assigned_buyer`
    );
    const loadByBuyer = new Map<string, number>();
    for (const buyer of buyers) loadByBuyer.set(buyer, 0);
    for (const row of loadRows) {
      if (!row.buyer) continue;
      const normalized = buyers.find((b) => b.toLowerCase() === row.buyer.toLowerCase());
      if (!normalized) continue;
      loadByBuyer.set(normalized, Number(row.active_count || 0));
    }

    const sourceFilterSql = sourceFile ? `AND source_file = ${sqlString(sourceFile)}` : '';
    const modeFilterSql =
      mode === 'reassign-open'
        ? `AND assignment_state IN ('assigned', 'unassigned')`
        : `AND assignment_state = 'unassigned'`;
    const queueRows = await allRows<QueueRow>(
      conn,
      `SELECT
        queue_id,
        source_row,
        category,
        requested_buyer,
        assigned_buyer,
        assignment_state
      FROM campaign_assignment_queue
      WHERE 1=1
        ${modeFilterSql}
        AND (requested_buyer IS NULL OR lower(requested_buyer) = 'open')
        AND launch_campaign_id IS NULL
        ${sourceFilterSql}
      ORDER BY request_date NULLS LAST, source_row
      LIMIT ${limit}`
    );

    if (queueRows.length === 0) {
      console.log(`[queue:assign] No Open campaigns found for mode=${mode}.`);
      return;
    }

    let assignedCount = 0;
    for (const row of queueRows) {
      const selectedBuyer = buyers
        .slice()
        .sort((a, b) => {
          const loadA = loadByBuyer.get(a) || 0;
          const loadB = loadByBuyer.get(b) || 0;
          if (loadA !== loadB) return loadA - loadB;
          return a.localeCompare(b);
        })[0];

      await runSql(
        conn,
        `UPDATE campaign_assignment_queue
         SET assigned_buyer = ${sqlString(selectedBuyer)},
             assignment_state = 'assigned',
             updated_at = CURRENT_TIMESTAMP
         WHERE queue_id = ${sqlString(row.queue_id)}`
      );
      loadByBuyer.set(selectedBuyer, (loadByBuyer.get(selectedBuyer) || 0) + 1);
      assignedCount += 1;
      console.log(
        `[queue:assign] row=${row.source_row} category="${row.category || 'N/A'}" ${row.assigned_buyer || 'UNASSIGNED'} -> ${selectedBuyer}`
      );
    }

    console.log(`[queue:assign] Processed ${assignedCount} campaigns across ${buyers.length} buyers (mode=${mode}).`);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('[queue:assign] Fatal error:', err?.message || err);
  process.exit(1);
});

