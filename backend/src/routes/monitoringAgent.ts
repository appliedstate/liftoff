import { Router } from 'express';
import { createMonitoringConnection, closeConnection, allRows } from '../lib/monitoringDb';
import { generateText } from '../lib/openai';

const router = Router();

type MonitoringPlan = {
  sql: string;
  summary?: string;
};

const SCHEMA_SUMMARY = `
You are querying a DuckDB database with these key tables:

1) campaign_index (one row per campaign per day; UTC dates)
   - campaign_id (TEXT)
   - level (TEXT)
   - date (DATE)                -- stored in UTC; user questions are in PST
   - snapshot_source (TEXT)
   - account_id (TEXT)
   - campaign_name (TEXT)
   - adset_id (TEXT)
   - adset_name (TEXT)
   - owner (TEXT)               -- buyer name
   - lane (TEXT)
   - category (TEXT)
   - media_source (TEXT)        -- network: 'facebook', 'taboola', 'mediago', 'newsbreak', 'outbrain', etc.
   - rsoc_site (TEXT)           -- site / domain, e.g. 'wesoughtit.com'
   - s1_google_account (TEXT)   -- S1 account name, e.g. 'Zeus LLC'
   - spend_usd (DOUBLE)
   - revenue_usd (DOUBLE)
   - sessions (DOUBLE)
   - clicks (DOUBLE)
   - conversions (DOUBLE)
   - roas (DOUBLE)

2) session_hourly_metrics (hourly revenue/sessions by campaign)
   - date (DATE)                -- UTC day corresponding to click hour
   - campaign_id (TEXT)
   - click_hour (INTEGER)       -- 0-23 UTC
   - sessions (INTEGER)
   - revenue (DOUBLE)
   - rpc (DOUBLE)
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

Important notes:
- Data in campaign_index and session_hourly_metrics is stored by UTC date, but business questions are in PST.
- For "yesterday", interpret as the PST calendar day; queries usually filter on the corresponding UTC date.
- For P&L by network or buyer, you normally GROUP BY media_source and/or owner in campaign_index.
- For launches, join campaign_launches to campaign_index on campaign_id and date = first_seen_date.

Your job:
- Given a user question, produce a single safe, read-only SQL SELECT statement.
- The SQL must be valid DuckDB SQL and only reference the tables/columns described above.
- NEVER use INSERT, UPDATE, DELETE, CREATE, DROP, or other write/DDL operations.
- Prefer concise aggregations (GROUP BY, SUM, COUNT, AVG) over raw row dumps.
- Always LIMIT result sets to at most 200 rows.
- If the question is about "yesterday" or a relative day, assume the dates are in PST and note that assumption in the summary.
`;

function stripCodeFences(text: string): string {
  return text
    .replace(/```json/gi, '```')
    .replace(/```sql/gi, '```')
    .replace(/```/g, '')
    .trim();
}

function parseMonitoringPlan(raw: string): MonitoringPlan {
  const cleaned = stripCodeFences(raw);
  let json: any;
  try {
    json = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Agent response was not valid JSON');
    }
    json = JSON.parse(match[0]);
  }
  if (!json.sql || typeof json.sql !== 'string') {
    throw new Error('Agent response JSON is missing "sql" string field');
  }
  return {
    sql: json.sql.trim(),
    summary: typeof json.summary === 'string' ? json.summary.trim() : undefined,
  };
}

async function planSql(question: string, previousError?: string): Promise<MonitoringPlan> {
  const system = [
    'You are a senior analytics engineer helping to answer questions from a marketing team about multi-network ad performance.',
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
  const text = await generateText({
    system,
    prompt,
    temperature: previousError ? 0.2 : 0,
    maxTokens: 600,
  });
  return parseMonitoringPlan(text);
}

router.post('/agent', async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required (string)' });
  }

  const conn = createMonitoringConnection();
  try {
    let plan: MonitoringPlan;
    try {
      plan = await planSql(query);
    } catch (e: any) {
      console.error('[monitoring.agent] Failed to generate SQL plan:', e?.message || e);
      return res.status(500).json({ error: e?.message || 'Failed to generate monitoring SQL plan' });
    }

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
        console.error(`[monitoring.agent] SQL execution error (attempt ${attempt}):`, lastError);
        if (attempt >= 2) {
          throw e;
        }
        plan = await planSql(query, lastError);
      }
    }

    return res.status(200).json({
      status: 'ok',
      sql: plan.sql,
      summary: plan.summary || null,
      rowCount: rows.length,
      rows,
    });
  } catch (e: any) {
    console.error('[monitoring.agent] Error:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Monitoring agent failed' });
  } finally {
    closeConnection(conn);
  }
});

export default router;


