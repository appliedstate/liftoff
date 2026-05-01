#!/usr/bin/env ts-node

/**
 * Fill in missing owner/buyer information by looking at historical campaign_index data
 * If a campaign has UNKNOWN owner on one date but has owner data on another date, use that
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection, runSql } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log('\n# Filling Missing Owner Information\n');

    // Stats before
    const before = await allRows<any>(
      conn,
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN owner IS NULL OR owner = 'UNKNOWN' OR owner = '' THEN 1 END) as unknown_owner,
        COUNT(CASE WHEN owner IS NOT NULL AND owner != '' AND owner != 'UNKNOWN' THEN 1 END) as known_owner
      FROM campaign_launches`
    );
    const beforeStats = before[0] || {};
    console.log(`Before: known_owner=${Number(beforeStats.known_owner || 0)} unknown_owner=${Number(beforeStats.unknown_owner || 0)} total=${Number(beforeStats.total || 0)}`);

    // Bulk-fill owner/lane/category from campaign_index using the most recent known value per campaign.
    // This avoids N+1 queries and is much faster on larger datasets.
    const updateSql = `
      WITH owner_best AS (
        SELECT
          campaign_id,
          arg_max(owner_candidate, date) AS owner
        FROM (
          SELECT
            campaign_id,
            date,
            COALESCE(
              NULLIF(owner, ''),
              NULLIF(trim(both '"' from CAST(json_extract(raw_payload, '$.owner') AS VARCHAR)), ''),
              NULLIF(trim(both '"' from CAST(json_extract(raw_payload, '$.buyer') AS VARCHAR)), ''),
              NULLIF(trim(both '"' from CAST(json_extract(raw_payload, '$.Buyer') AS VARCHAR)), ''),
              NULLIF(trim(both '"' from CAST(json_extract(raw_payload, '$.buyer_name') AS VARCHAR)), ''),
              NULLIF(trim(both '"' from CAST(json_extract(raw_payload, '$.buyerName') AS VARCHAR)), '')
            ) AS owner_candidate
          FROM campaign_index
        ) t
        WHERE owner_candidate IS NOT NULL AND owner_candidate != '' AND owner_candidate != 'UNKNOWN'
        GROUP BY campaign_id
      ),
      lane_best AS (
        SELECT
          campaign_id,
          arg_max(lane, date) AS lane
        FROM campaign_index
        WHERE lane IS NOT NULL AND lane != '' AND lane != 'UNKNOWN'
        GROUP BY campaign_id
      ),
      category_best AS (
        SELECT
          campaign_id,
          arg_max(category, date) AS category
        FROM campaign_index
        WHERE category IS NOT NULL AND category != '' AND category != 'UNKNOWN'
        GROUP BY campaign_id
      ),
      best AS (
        SELECT
          COALESCE(o.campaign_id, l.campaign_id, c.campaign_id) AS campaign_id,
          o.owner AS owner,
          l.lane AS lane,
          c.category AS category
        FROM owner_best o
        FULL OUTER JOIN lane_best l USING (campaign_id)
        FULL OUTER JOIN category_best c USING (campaign_id)
      )
      UPDATE campaign_launches cl
      SET
        owner = CASE
          WHEN cl.owner IS NULL OR cl.owner = '' OR cl.owner = 'UNKNOWN' THEN best.owner
          ELSE cl.owner
        END,
        lane = CASE
          WHEN cl.lane IS NULL OR cl.lane = '' OR cl.lane = 'UNKNOWN' THEN best.lane
          ELSE cl.lane
        END,
        category = CASE
          WHEN cl.category IS NULL OR cl.category = '' OR cl.category = 'UNKNOWN' THEN best.category
          ELSE cl.category
        END
      FROM best
      WHERE cl.campaign_id = best.campaign_id
        AND (
          (cl.owner IS NULL OR cl.owner = '' OR cl.owner = 'UNKNOWN') OR
          (cl.lane IS NULL OR cl.lane = '' OR cl.lane = 'UNKNOWN') OR
          (cl.category IS NULL OR cl.category = '' OR cl.category = 'UNKNOWN')
        );
    `;

    await runSql(conn, updateSql);
    
    // Show summary
    const summary = await allRows(
      conn,
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN owner IS NULL OR owner = 'UNKNOWN' OR owner = '' THEN 1 END) as unknown,
        COUNT(CASE WHEN owner IS NOT NULL AND owner != '' AND owner != 'UNKNOWN' THEN 1 END) as known
      FROM campaign_launches`
    );
    
    const stats = summary[0];
    console.log('## Summary\n');
    console.log(`Total Campaigns: ${Number(stats.total || 0)}`);
    console.log(`With Owner Info: ${Number(stats.known || 0)}`);
    console.log(`Missing Owner Info: ${Number(stats.unknown || 0)}`);
    console.log(`Coverage: ${((Number(stats.known || 0) / Number(stats.total || 1)) * 100).toFixed(1)}%\n`);
    
  } catch (err: any) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  } finally {
    closeConnection(conn);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

