#!/usr/bin/env ts-node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import {
  allRows,
  closeConnection,
  createMonitoringConnection,
  initMonitoringSchema,
  runSql,
  sqlNumber,
  sqlString,
} from '../../lib/monitoringDb';

type ExistingQueueRow = {
  source_row: number;
  assigned_buyer: string | null;
  assignment_state: string | null;
  launch_campaign_id: string | null;
  launch_date: string | null;
  launch_owner: string | null;
  launch_media_source: string | null;
};

type ParsedTemplateRow = {
  sourceRow: number;
  status: string | null;
  requestedBuyer: string | null;
  requestDate: string | null;
  category: string | null;
  notes: string | null;
  targetMarket: string | null;
  deviceTarget: string | null;
  headline: string | null;
  rsocSite: string | null;
  articleUrl: string | null;
  campaignUrl: string | null;
  raw: Record<string, string | null>;
};

function getFlag(name: string, def = ''): string {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return def;
  return arg.slice(key.length);
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function parseUsDate(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (!month || !day || !year) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function normalizeSourceFile(filePath: string): string {
  return path.resolve(filePath);
}

function normalizeQueueId(sourceFile: string, sourceRow: number): string {
  return `${sourceFile}#${sourceRow}`;
}

function computeInitialAssignment(row: ParsedTemplateRow): { assignedBuyer: string | null; assignmentState: string } {
  const requested = row.requestedBuyer?.toLowerCase() ?? '';
  if (row.status?.toLowerCase() === 'live') {
    return { assignedBuyer: row.requestedBuyer, assignmentState: 'launched' };
  }
  if (requested && requested !== 'open') {
    return { assignedBuyer: row.requestedBuyer, assignmentState: 'assigned' };
  }
  return { assignedBuyer: null, assignmentState: 'unassigned' };
}

async function readTemplateRows(filePath: string, startRow: number, statusFilter: string | null): Promise<ParsedTemplateRow[]> {
  const rows: ParsedTemplateRow[] = [];
  const input = fs.createReadStream(filePath);
  const parser = parse({
    bom: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_records_with_error: true,
  });

  let header: string[] | null = null;
  let dataRowIndex = 0;

  await new Promise<void>((resolve, reject) => {
    parser.on('data', (record: unknown) => {
      if (!Array.isArray(record)) return;
      const cols = record.map((v) => (v === null || v === undefined ? '' : String(v)));
      if (!header) {
        header = cols;
        return;
      }

      dataRowIndex += 1;
      const sourceRow = dataRowIndex + 1;
      if (sourceRow < startRow) return;

      const status = clean(cols[0]);
      if (statusFilter && (status || '').toLowerCase() !== statusFilter.toLowerCase()) return;

      const parsed: ParsedTemplateRow = {
        sourceRow,
        status,
        requestedBuyer: clean(cols[1]),
        requestDate: parseUsDate(clean(cols[2])),
        category: clean(cols[3]),
        notes: clean(cols[4]),
        targetMarket: clean(cols[5]),
        deviceTarget: clean(cols[6]),
        headline: clean(cols[8]),
        rsocSite: clean(cols[9]),
        articleUrl: clean(cols[10]),
        campaignUrl: clean(cols[14]),
        raw: {
          status: clean(cols[0]),
          buyer: clean(cols[1]),
          date: clean(cols[2]),
          category: clean(cols[3]),
          notes: clean(cols[4]),
          targetMarket: clean(cols[5]),
          device: clean(cols[6]),
          headline: clean(cols[8]),
          rsocSite: clean(cols[9]),
          articleUrl: clean(cols[10]),
          campaignUrl: clean(cols[14]),
        },
      };

      rows.push(parsed);
    });
    parser.on('error', reject);
    parser.on('end', () => resolve());
    input.pipe(parser);
  });

  return rows;
}

async function main(): Promise<void> {
  const file = getFlag('file');
  if (!file) {
    throw new Error('Missing required flag --file=/absolute/path/to/template.csv');
  }
  const startRow = Math.max(2, Number(getFlag('start-row', '11')) || 11);
  const statusFilter = clean(getFlag('status', 'New Campaign'));
  const sourceFile = normalizeSourceFile(file);

  const parsedRows = await readTemplateRows(sourceFile, startRow, statusFilter);
  if (parsedRows.length === 0) {
    console.log(`[queue:ingest] No rows found for source=${sourceFile} startRow=${startRow} status=${statusFilter || 'ANY'}`);
    return;
  }

  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const existingRows = await allRows<ExistingQueueRow>(
      conn,
      `SELECT
        source_row,
        assigned_buyer,
        assignment_state,
        launch_campaign_id,
        launch_date,
        launch_owner,
        launch_media_source
      FROM campaign_assignment_queue
      WHERE source_file = ${sqlString(sourceFile)}`
    );
    const existingByRow = new Map<number, ExistingQueueRow>();
    for (const row of existingRows) {
      existingByRow.set(Number(row.source_row), row);
    }

    let insertedOrUpdated = 0;
    for (const row of parsedRows) {
      const queueId = normalizeQueueId(sourceFile, row.sourceRow);
      const existing = existingByRow.get(row.sourceRow);
      const computed = computeInitialAssignment(row);

      const assignedBuyer = existing?.assigned_buyer ?? computed.assignedBuyer;
      const assignmentState = existing?.assignment_state ?? computed.assignmentState;
      const launchCampaignId = existing?.launch_campaign_id ?? null;
      const launchDate = existing?.launch_date ?? null;
      const launchOwner = existing?.launch_owner ?? null;
      const launchMediaSource = existing?.launch_media_source ?? null;

      await runSql(
        conn,
        `DELETE FROM campaign_assignment_queue
         WHERE source_file = ${sqlString(sourceFile)}
           AND source_row = ${sqlNumber(row.sourceRow)}`
      );

      await runSql(
        conn,
        `INSERT INTO campaign_assignment_queue (
          queue_id,
          source_file,
          source_row,
          status,
          requested_buyer,
          assigned_buyer,
          assignment_state,
          request_date,
          category,
          notes,
          target_market,
          device_target,
          headline,
          rsoc_site,
          article_url,
          campaign_url,
          launch_campaign_id,
          launch_date,
          launch_owner,
          launch_media_source,
          last_seen_at,
          raw_payload,
          updated_at
        ) VALUES (
          ${sqlString(queueId)},
          ${sqlString(sourceFile)},
          ${sqlNumber(row.sourceRow)},
          ${sqlString(row.status)},
          ${sqlString(row.requestedBuyer)},
          ${sqlString(assignedBuyer)},
          ${sqlString(assignmentState)},
          ${sqlString(row.requestDate)},
          ${sqlString(row.category)},
          ${sqlString(row.notes)},
          ${sqlString(row.targetMarket)},
          ${sqlString(row.deviceTarget)},
          ${sqlString(row.headline)},
          ${sqlString(row.rsocSite)},
          ${sqlString(row.articleUrl)},
          ${sqlString(row.campaignUrl)},
          ${sqlString(launchCampaignId)},
          ${sqlString(launchDate)},
          ${sqlString(launchOwner)},
          ${sqlString(launchMediaSource)},
          CURRENT_TIMESTAMP,
          ${sqlString(JSON.stringify(row.raw))},
          CURRENT_TIMESTAMP
        )`
      );

      insertedOrUpdated += 1;
    }

    console.log(
      `[queue:ingest] Upserted ${insertedOrUpdated} rows from ${sourceFile} (startRow=${startRow}, status=${statusFilter || 'ANY'})`
    );
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('[queue:ingest] Fatal error:', err?.message || err);
  process.exit(1);
});

