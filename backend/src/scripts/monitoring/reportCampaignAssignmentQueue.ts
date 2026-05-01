#!/usr/bin/env ts-node

import 'dotenv/config';
import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from '../../lib/monitoringDb';

type SummaryRow = {
  buyer: string | null;
  state: string | null;
  count: number;
};

type DetailRow = {
  source_row: number;
  status: string | null;
  category: string | null;
  requested_buyer: string | null;
  assigned_buyer: string | null;
  assignment_state: string | null;
  request_date: string | null;
  launch_date: string | null;
  launch_media_source: string | null;
  launch_campaign_id: string | null;
};

function getFlag(name: string, def = ''): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def;
  return arg.slice(key.length);
}

async function main(): Promise<void> {
  const sourceFile = getFlag('source-file');
  const limit = Math.max(1, Number(getFlag('limit', '200')) || 200);
  const sourceFilterSql = sourceFile ? `WHERE source_file = ${sqlString(sourceFile)}` : '';
  const andSourceFilterSql = sourceFile ? `AND source_file = ${sqlString(sourceFile)}` : '';

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);

    const totals = await allRows<{ total: number }>(
      conn,
      `SELECT COUNT(*) AS total
       FROM campaign_assignment_queue
       ${sourceFilterSql}`
    );
    const total = Number(totals[0]?.total || 0);
    if (total === 0) {
      console.log('[queue:report] No queue rows found.');
      return;
    }

    console.log('\n# Campaign Assignment Queue\n');
    console.log(`Total queue rows: ${total}\n`);

    const summary = await allRows<SummaryRow>(
      conn,
      `SELECT
        COALESCE(assigned_buyer, 'UNASSIGNED') AS buyer,
        COALESCE(assignment_state, 'unknown') AS state,
        COUNT(*) AS count
      FROM campaign_assignment_queue
      WHERE 1=1
        ${andSourceFilterSql}
      GROUP BY assigned_buyer, assignment_state
      ORDER BY buyer, state`
    );

    console.log('## By Buyer / State\n');
    console.log('| Buyer | State | Count |');
    console.log('|-------|-------|-------|');
    for (const row of summary) {
      console.log(`| ${row.buyer || 'UNASSIGNED'} | ${row.state || 'unknown'} | ${Number(row.count || 0)} |`);
    }

    const details = await allRows<DetailRow>(
      conn,
      `SELECT
        source_row,
        status,
        category,
        requested_buyer,
        assigned_buyer,
        assignment_state,
        request_date,
        launch_date,
        launch_media_source,
        launch_campaign_id
      FROM campaign_assignment_queue
      WHERE 1=1
        ${andSourceFilterSql}
      ORDER BY
        CASE assignment_state
          WHEN 'unassigned' THEN 0
          WHEN 'assigned' THEN 1
          WHEN 'launched' THEN 2
          ELSE 3
        END,
        request_date NULLS LAST,
        source_row
      LIMIT ${limit}`
    );

    console.log('\n## Queue Details\n');
    console.log('| Row | Category | Requested | Assigned | State | Request Date | Launch Date | Network | Campaign ID |');
    console.log('|-----|----------|-----------|----------|-------|--------------|-------------|---------|-------------|');
    for (const row of details) {
      console.log(
        `| ${row.source_row} | ${row.category || 'N/A'} | ${row.requested_buyer || 'N/A'} | ${row.assigned_buyer || 'N/A'} | ${row.assignment_state || 'N/A'} | ${row.request_date || 'N/A'} | ${row.launch_date || 'N/A'} | ${row.launch_media_source || 'N/A'} | ${row.launch_campaign_id || 'N/A'} |`
      );
    }

    if (total > limit) {
      console.log(`\n... and ${total - limit} more rows.`);
    }
    console.log('');
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('[queue:report] Fatal error:', err?.message || err);
  process.exit(1);
});

