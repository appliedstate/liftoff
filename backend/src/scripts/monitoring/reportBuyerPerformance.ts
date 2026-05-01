#!/usr/bin/env ts-node

/**
 * Detailed Buyer Performance Report
 * Shows spend, revenue, ROAS by Buyer -> Network -> Site for a specific date
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';
import { getYesterdayPST } from '../../lib/dateUtils';

function pstDateToUtcForQuery(pstDate: string): string {
  const [year, month, day] = pstDate.split('-').map(Number);
  const pstMidnight = new Date(Date.UTC(year, month - 1, day, 8, 0, 0));
  return pstMidnight.toISOString().slice(0, 10);
}

async function main() {
  const dateArg = process.argv[2];
  const pstDate = dateArg || getYesterdayPST();
  const utcDate = pstDateToUtcForQuery(pstDate);
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log(`\n# Buyer Performance Report for ${pstDate} (PST)`);
    console.log(`Querying UTC date: ${utcDate}\n`);
    
    const rows = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.owner, 'UNKNOWN') as buyer,
        COALESCE(ci.media_source, 'UNKNOWN') as network,
        COALESCE(ci.rsoc_site, 'N/A') as site,
        SUM(ci.spend_usd) as spend,
        SUM(ci.revenue_usd) as revenue,
        SUM(ci.clicks) as clicks,
        COUNT(DISTINCT ci.campaign_id) as campaign_count
      FROM campaign_index ci
      WHERE ci.date = '${utcDate}'
        AND (ci.spend_usd > 0 OR ci.revenue_usd > 0)
      GROUP BY ci.owner, ci.media_source, ci.rsoc_site
      ORDER BY ci.owner, ci.media_source, revenue DESC`
    );
    
    if (rows.length === 0) {
        console.log("No data found for this date.");
        return;
    }

    console.log('| Buyer | Network | Site | Spend | Revenue | ROAS | Clicks | Campaigns |');
    console.log('|-------|---------|------|-------|---------|------|--------|-----------|');
    
    for (const row of rows) {
      const buyer = String(row.buyer || 'UNKNOWN').padEnd(10);
      const network = String(row.network || 'UNKNOWN').padEnd(10);
      const site = String(row.site || 'N/A').padEnd(20);
      const spend = Number(row.spend || 0);
      const revenue = Number(row.revenue || 0);
      const roas = spend > 0 ? (revenue / spend) : 0;
      const clicks = Number(row.clicks || 0).toLocaleString();
      const campaigns = Number(row.campaign_count || 0);
      
      const roasStr = (roas * 100).toFixed(1) + '%';
      const profitIcon = (revenue - spend) >= 0 ? '✅' : '❌';
      
      console.log(`| ${buyer} | ${network} | ${site} | $${spend.toFixed(2).padStart(7)} | $${revenue.toFixed(2).padStart(8)} | ${roasStr.padStart(6)} ${profitIcon} | ${clicks.padStart(6)} | ${String(campaigns).padStart(4)} |`);
    }
    
    console.log('\n');

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

