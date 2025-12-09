#!/usr/bin/env ts-node

/**
 * Natural-language monitoring agent over DuckDB.
 *
 * Usage:
 *   npm run monitor:ask -- "What was our NewsBreak P&L yesterday?"
 *
 * The script:
 *   - Sends the question + schema summary to OpenAI
 *   - Receives JSON: { sql: "...", summary: "..." }
 *   - Executes the SQL against monitoring.duckdb (read-only)
 *   - Prints a markdown table of results and the LLM summary
 */

import 'dotenv/config';
import { createMonitoringConnection, closeConnection, allRows } from '../../lib/monitoringDb';
import { generateText } from '../../lib/openai';

type AgentPlan = {
  sql: string;
  summary?: string;
};

const SCHEMA_SUMMARY = `
You are querying a DuckDB database with these key tables:

1) campaign_index (one row per campaign per day; UTC dates)
   - campaign_id (TEXT)
   - level (TEXT)               -- "campaign" or "adset"
   - date (DATE)                -- stored in UTC; user questions are in PST
   - snapshot_source (TEXT)     -- e.g. 's1_daily_v3', 'facebook_report', 'mediago_report'
   - account_id (TEXT)
   - campaign_name (TEXT)
   - adset_id (TEXT)
   - adset_name (TEXT)
   - owner (TEXT)               -- buyer name
   - lane (TEXT)
   - category (TEXT)
   - media_source (TEXT)        -- network, e.g. 'facebook', 'taboola', 'mediago', 'newsbreak', 'outbrain'
   - rsoc_site (TEXT)           -- site / domain, e.g. 'wesoughtit.com'
   - s1_google_account (TEXT)   -- S1 account name, e.g. 'Zeus LLC'
   - spend_usd (DOUBLE)
   - revenue_usd (DOUBLE)
   - sessions (DOUBLE)
   - clicks (DOUBLE)
   - conversions (DOUBLE)
   - roas (DOUBLE)              -- revenue_usd / spend_usd when available

2) session_hourly_metrics (hourly revenue/sessions by campaign)
   - date (DATE)                -- UTC day corresponding to click hour
   - campaign_id (TEXT)
   - click_hour (INTEGER)       -- 0-23 UTC
   - sessions (INTEGER)
   - revenue (DOUBLE)
   - rpc (DOUBLE)               -- revenue per click / session
   - traffic_source (TEXT)
   - owner (TEXT)
   - lane (TEXT)
   - category (TEXT)
   - media_source (TEXT)

3) campaign_launches (first-seen launches)
   - campaign_id (TEXT PRIMARY KEY)
   - first_seen_date (DATE)     -- currently stored as a PST date string
   - owner (TEXT)
   - lane (TEXT)
   - category (TEXT)
   - media_source (TEXT)
   - campaign_name (TEXT)
   - account_id (TEXT)

4) hourly_snapshot_metrics (time-aligned hourly snapshots for comparison)
   - snapshot_pst (TIMESTAMP)   -- When the snapshot was taken (PST)
   - day_pst (DATE)             -- PST calendar day
   - hour_pst (INTEGER)         -- Hour of day in PST (0-23)
   - media_source (TEXT)
   - rsoc_site (TEXT)           -- Site/domain
   - owner (TEXT)
   - lane (TEXT)
   - category (TEXT)
   - level (TEXT)               -- "campaign" or "adset"
   - campaign_id (TEXT)         -- Strategis campaign ID
   - campaign_name (TEXT)
   - adset_id (TEXT)
   - adset_name (TEXT)
   - sessions (DOUBLE)
   - revenue (DOUBLE)
   - clicks (DOUBLE)
   - conversions (DOUBLE)
   - rpc (DOUBLE)               -- revenue per session

Important notes:
- Data in campaign_index and session_hourly_metrics is stored by UTC date, but business questions are in PST.
- For "today" or "yesterday", interpret as the PST calendar day. PST is UTC-8, so:
  * "today" in PST = CURRENT_DATE - INTERVAL 8 HOUR (if current UTC hour < 8) OR CURRENT_DATE (if current UTC hour >= 8)
  * "yesterday" in PST = CURRENT_DATE - INTERVAL 1 DAY - INTERVAL 8 HOUR (if current UTC hour < 8) OR CURRENT_DATE - INTERVAL 1 DAY (if current UTC hour >= 8)
  * Better approach: Use DATE(CURRENT_TIMESTAMP - INTERVAL 8 HOUR) for PST date
- For P&L by network or buyer, you normally GROUP BY media_source and/or owner in campaign_index.
- For launches, join campaign_launches to campaign_index on campaign_id and date = first_seen_date.
- campaign_id in campaign_index and hourly_snapshot_metrics is Strategis campaign ID (e.g., "siqd18d06g4", "sire1f06al").
- campaign_id in session_hourly_metrics may be Facebook campaign ID (long numeric) or Strategis ID.
- hourly_snapshot_metrics enables "as-of" comparisons: compare today vs prior days at the same wall-clock time.
- To query by Strategis campaign ID, use campaign_index.campaign_id or hourly_snapshot_metrics.campaign_id.
- When querying for "today", check multiple tables:
  * campaign_index: aggregated daily data (may not have today's data yet if ingestion hasn't run)
  * session_hourly_metrics: hourly breakdowns (more likely to have recent data)
  * hourly_snapshot_metrics: time-aligned snapshots (best for "as-of" comparisons)
- If no data found in campaign_index for today, try session_hourly_metrics or hourly_snapshot_metrics.

Your job:
- Given a user question, produce a single safe, read-only SQL SELECT statement.
- The SQL must be valid DuckDB SQL and only reference the tables/columns described above.
- NEVER use INSERT, UPDATE, DELETE, CREATE, DROP, or other write/DDL operations.
- Prefer concise aggregations (GROUP BY, SUM, COUNT, AVG) over raw row dumps.
- Always LIMIT result sets to at most 200 rows.
- If the question is about "yesterday" or a relative day, assume the dates are in PST and explain the assumption in the summary.
`;

function getQuestionFromArgs(): string {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  return args.join(' ').trim();
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```json/gi, '```')
    .replace(/```sql/gi, '```')
    .replace(/```/g, '')
    .trim();
}

function parseAgentPlan(raw: string): AgentPlan {
  const cleaned = stripCodeFences(raw);
  let json: any;
  try {
    json = JSON.parse(cleaned);
  } catch {
    // Try to locate a JSON object within the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Agent response was not valid JSON');
    }
    json = JSON.parse(match[0]);
  }
  if (!json.sql || typeof json.sql !== 'string') {
    throw new Error('Agent response JSON is missing "sql" string field');
  }
  return { sql: json.sql.trim(), summary: typeof json.summary === 'string' ? json.summary.trim() : undefined };
}

async function planSql(question: string, previousError?: string): Promise<AgentPlan> {
  const system = [
    'You are a senior analytics engineer helping to answer questions from a marketing team.',
    'You must respond ONLY with a compact JSON object on a single line.',
    'Shape: { "sql": "...", "summary": "..." }',
    'The "sql" field is mandatory and must contain a complete, executable DuckDB SELECT statement.',
    'The "summary" field is optional: a 1-2 sentence explanation in plain English of what the SQL will return.',
    'Do not add comments or extra keys. Do not wrap the JSON in code fences.',
    'Always include a LIMIT <= 200 at the end of the main query.',
  ].join(' ');

  const promptLines: string[] = [];
  promptLines.push('Database schema:', SCHEMA_SUMMARY.trim(), '');
  promptLines.push(`User question: ${question.trim()}`);
  if (previousError) {
    promptLines.push('');
    promptLines.push('The previous SQL failed with this error:');
    promptLines.push(previousError.trim());
    promptLines.push('Please correct the SQL and return a new JSON plan.');
  }

  const prompt = promptLines.join('\n');
  const text = await generateText({ system, prompt, temperature: previousError ? 0.2 : 0, maxTokens: 600 });
  return parseAgentPlan(text);
}

function formatTable(rows: any[]): string {
  if (!rows.length) {
    return 'No rows returned.\n';
  }
  const columns = Object.keys(rows[0]);
  const header = `| ${columns.join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .slice(0, 200)
    .map((r) =>
      `| ${columns
        .map((c) => {
          const v = (r as any)[c];
          if (v === null || v === undefined) return '';
          if (typeof v === 'number') return v.toString();
          return String(v);
        })
        .join(' | ')} |`
    )
    .join('\n');
  return `${header}\n${sep}\n${body}\n`;
}

async function main() {
  const question = getQuestionFromArgs();
  if (!question) {
    console.error('Usage: npm run monitor:ask -- "<question in plain English>"');
    process.exit(1);
  }

  console.log(`\n# Monitoring Agent\n`);
  console.log(`Question: ${question}\n`);

  const conn = createMonitoringConnection();
  try {
    // Plan and possibly re-plan once on error
    let plan: AgentPlan;
    try {
      plan = await planSql(question);
    } catch (e: any) {
      console.error('Failed to generate SQL plan:', e?.message || e);
      process.exit(1);
    }

    console.log('Proposed SQL:\n');
    console.log(plan.sql);
    console.log('');

    let rows: any[] = [];
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt < 2) {
      attempt += 1;
      try {
        rows = await allRows(conn, plan.sql);
        break;
      } catch (e: any) {
        lastError = e?.message || String(e);
        console.error(`SQL execution error (attempt ${attempt}): ${lastError}`);
        if (attempt >= 2) {
          throw e;
        }
        console.log('\nRe-planning with error feedback...\n');
        plan = await planSql(question, lastError);
        console.log('Revised SQL:\n');
        console.log(plan.sql);
        console.log('');
      }
    }

    const table = formatTable(rows);
    console.log('## Result\n');
    console.log(table);

    if (plan.summary) {
      console.log('\n## Agent Summary\n');
      console.log(plan.summary);
      console.log('');
    }
  } catch (err: any) {
    console.error('Fatal error:', err?.message || err);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


