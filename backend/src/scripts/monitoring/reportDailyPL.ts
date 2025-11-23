#!/usr/bin/env ts-node

/**
 * Daily P&L Report by Network and Buyer
 * Shows revenue, spend, ROAS, and profit/loss for a specific date
 */

import 'dotenv/config';
import { allRows, createMonitoringConnection, closeConnection } from '../../lib/monitoringDb';
import { initMonitoringSchema } from '../../lib/monitoringDb';

function getPSTDate(date: Date): string {
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

function getTodayPST(): string {
  return getPSTDate(new Date());
}

function getYesterdayPST(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getPSTDate(date);
}

async function main() {
  const dateArg = process.argv[2];
  const date = dateArg || getYesterdayPST();
  const conn = createMonitoringConnection();
  
  try {
    await initMonitoringSchema(conn);
    
    console.log(`\n# Daily P&L Report for ${date}\n`);
    
    // Get overall totals
    const overall = await allRows(
      conn,
      `SELECT 
        SUM(ci.spend_usd) as total_spend,
        SUM(ci.revenue_usd) as total_revenue,
        SUM(ci.sessions) as total_sessions,
        SUM(ci.clicks) as total_clicks,
        SUM(ci.conversions) as total_conversions
      FROM campaign_index ci
      WHERE ci.date = '${date}'
        AND ci.spend_usd IS NOT NULL
        AND ci.revenue_usd IS NOT NULL`
    );
    
    const totalSpend = Number(overall[0]?.total_spend || 0);
    const totalRevenue = Number(overall[0]?.total_revenue || 0);
    const totalProfit = totalRevenue - totalSpend;
    const overallROAS = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
    const totalSessions = Number(overall[0]?.total_sessions || 0);
    const totalClicks = Number(overall[0]?.total_clicks || 0);
    const totalConversions = Number(overall[0]?.total_conversions || 0);
    const rpc = totalClicks > 0 ? (totalRevenue / totalClicks) : 0;
    
    console.log('## 📊 Overall Summary\n');
    console.log(`- **Total Spend**: $${totalSpend.toFixed(2)}`);
    console.log(`- **Total Revenue**: $${totalRevenue.toFixed(2)}`);
    console.log(`- **Profit/Loss**: $${totalProfit.toFixed(2)} ${totalProfit >= 0 ? '✅' : '❌'}`);
    console.log(`- **ROAS**: ${(overallROAS * 100).toFixed(1)}%`);
    console.log(`- **Total Sessions**: ${totalSessions.toLocaleString()}`);
    console.log(`- **Total Clicks**: ${totalClicks.toLocaleString()}`);
    console.log(`- **Total Conversions**: ${totalConversions.toLocaleString()}`);
    console.log(`- **RPC**: $${rpc.toFixed(4)}`);
    console.log('');
    
    // P&L by Network
    console.log('## 🌐 P&L by Network\n');
    const byNetwork = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.media_source, 'UNKNOWN') as network,
        SUM(ci.spend_usd) as spend,
        SUM(ci.revenue_usd) as revenue,
        SUM(ci.sessions) as sessions,
        SUM(ci.clicks) as clicks,
        SUM(ci.conversions) as conversions,
        COUNT(DISTINCT ci.campaign_id) as campaign_count
      FROM campaign_index ci
      WHERE ci.date = '${date}'
        AND ci.spend_usd IS NOT NULL
        AND ci.revenue_usd IS NOT NULL
      GROUP BY ci.media_source
      ORDER BY revenue DESC`
    );
    
    console.log('| Network | Spend | Revenue | Profit/Loss | ROAS | Sessions | Clicks | Campaigns |');
    console.log('|---------|-------|---------|-------------|------|----------|--------|-----------|');
    
    for (const row of byNetwork) {
      const network = String(row.network || 'UNKNOWN').padEnd(7);
      const spend = Number(row.spend || 0);
      const revenue = Number(row.revenue || 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? (revenue / spend) : 0;
      const sessions = Number(row.sessions || 0).toLocaleString();
      const clicks = Number(row.clicks || 0).toLocaleString();
      const campaigns = Number(row.campaign_count || 0);
      
      const profitStr = profit >= 0 
        ? `$${profit.toFixed(2)} ✅`.padStart(13)
        : `$${profit.toFixed(2)} ❌`.padStart(13);
      
      console.log(`| ${network} | $${spend.toFixed(2).padStart(7)} | $${revenue.toFixed(2).padStart(8)} | ${profitStr} | ${(roas * 100).toFixed(1).padStart(4)}% | ${sessions.padStart(8)} | ${clicks.padStart(6)} | ${String(campaigns).padStart(9)} |`);
    }
    
    // P&L by Buyer
    console.log('\n## 👥 P&L by Buyer\n');
    const byBuyer = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.owner, 'UNKNOWN') as buyer,
        SUM(ci.spend_usd) as spend,
        SUM(ci.revenue_usd) as revenue,
        SUM(ci.sessions) as sessions,
        SUM(ci.clicks) as clicks,
        SUM(ci.conversions) as conversions,
        COUNT(DISTINCT ci.campaign_id) as campaign_count
      FROM campaign_index ci
      WHERE ci.date = '${date}'
        AND ci.spend_usd IS NOT NULL
        AND ci.revenue_usd IS NOT NULL
      GROUP BY ci.owner
      ORDER BY revenue DESC`
    );
    
    console.log('| Buyer | Spend | Revenue | Profit/Loss | ROAS | Sessions | Clicks | Campaigns |');
    console.log('|-------|-------|---------|-------------|------|----------|--------|-----------|');
    
    for (const row of byBuyer) {
      const buyer = String(row.buyer || 'UNKNOWN').padEnd(11);
      const spend = Number(row.spend || 0);
      const revenue = Number(row.revenue || 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? (revenue / spend) : 0;
      const sessions = Number(row.sessions || 0).toLocaleString();
      const clicks = Number(row.clicks || 0).toLocaleString();
      const campaigns = Number(row.campaign_count || 0);
      
      const profitStr = profit >= 0 
        ? `$${profit.toFixed(2)} ✅`.padStart(13)
        : `$${profit.toFixed(2)} ❌`.padStart(13);
      
      console.log(`| ${buyer} | $${spend.toFixed(2).padStart(7)} | $${revenue.toFixed(2).padStart(8)} | ${profitStr} | ${(roas * 100).toFixed(1).padStart(4)}% | ${sessions.padStart(8)} | ${clicks.padStart(6)} | ${String(campaigns).padStart(9)} |`);
    }
    
    // Detailed: Buyer → Network breakdown
    console.log('\n## 📋 Detailed P&L: Buyer → Network\n');
    const byBuyerNetwork = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.owner, 'UNKNOWN') as buyer,
        COALESCE(ci.media_source, 'UNKNOWN') as network,
        SUM(ci.spend_usd) as spend,
        SUM(ci.revenue_usd) as revenue,
        SUM(ci.sessions) as sessions,
        SUM(ci.clicks) as clicks,
        SUM(ci.conversions) as conversions,
        COUNT(DISTINCT ci.campaign_id) as campaign_count
      FROM campaign_index ci
      WHERE ci.date = '${date}'
        AND ci.spend_usd IS NOT NULL
        AND ci.revenue_usd IS NOT NULL
      GROUP BY ci.owner, ci.media_source
      ORDER BY revenue DESC, ci.owner, ci.media_source`
    );
    
    console.log('| Buyer | Network | Spend | Revenue | Profit/Loss | ROAS | Sessions | Clicks | Campaigns |');
    console.log('|-------|---------|-------|---------|-------------|------|----------|--------|-----------|');
    
    for (const row of byBuyerNetwork) {
      const buyer = String(row.buyer || 'UNKNOWN').substring(0, 11).padEnd(11);
      const network = String(row.network || 'UNKNOWN').substring(0, 7).padEnd(7);
      const spend = Number(row.spend || 0);
      const revenue = Number(row.revenue || 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? (revenue / spend) : 0;
      const sessions = Number(row.sessions || 0).toLocaleString();
      const clicks = Number(row.clicks || 0).toLocaleString();
      const campaigns = Number(row.campaign_count || 0);
      
      const profitStr = profit >= 0 
        ? `$${profit.toFixed(2)} ✅`.padStart(13)
        : `$${profit.toFixed(2)} ❌`.padStart(13);
      
      console.log(`| ${buyer} | ${network} | $${spend.toFixed(2).padStart(7)} | $${revenue.toFixed(2).padStart(8)} | ${profitStr} | ${(roas * 100).toFixed(1).padStart(4)}% | ${sessions.padStart(8)} | ${clicks.padStart(6)} | ${String(campaigns).padStart(9)} |`);
    }
    
    // Top performing buyer-network combinations
    console.log('\n## 🔥 Top 10 Buyer-Network Combinations by Revenue\n');
    const topPerformers = byBuyerNetwork.slice(0, 10);
    for (let i = 0; i < topPerformers.length; i++) {
      const combo = topPerformers[i];
      const buyer = String(combo.buyer || 'UNKNOWN');
      const network = String(combo.network || 'UNKNOWN');
      const spend = Number(combo.spend || 0);
      const revenue = Number(combo.revenue || 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? (revenue / spend) : 0;
      const profitIcon = profit >= 0 ? '✅' : '❌';
      
      console.log(`${i + 1}. **${buyer}** → **${network}**: $${revenue.toFixed(2)} revenue, $${spend.toFixed(2)} spend, ${(roas * 100).toFixed(1)}% ROAS, $${profit.toFixed(2)} ${profitIcon}`);
    }
    
    // Revenue by Site
    console.log('\n## 🌍 Revenue by Site\n');
    const bySite = await allRows(
      conn,
      `SELECT 
        COALESCE(ci.rsoc_site, 'N/A') as site,
        COALESCE(ci.s1_google_account, 'N/A') as s1_account,
        SUM(ci.spend_usd) as spend,
        SUM(ci.revenue_usd) as revenue,
        COUNT(DISTINCT ci.campaign_id) as campaign_count
      FROM campaign_index ci
      WHERE ci.date = '${date}'
        AND ci.spend_usd IS NOT NULL
        AND ci.revenue_usd IS NOT NULL
      GROUP BY ci.rsoc_site, ci.s1_google_account
      ORDER BY revenue DESC
      LIMIT 10`
    );
    
    console.log('| Site | S1 Google Account | Spend | Revenue | Profit/Loss | ROAS | Campaigns |');
    console.log('|------|-------------------|-------|---------|-------------|------|-----------|');
    
    for (const row of bySite) {
      const site = String(row.site || 'N/A').substring(0, 20).padEnd(20);
      const s1Account = String(row.s1_account || 'N/A').substring(0, 17).padEnd(17);
      const spend = Number(row.spend || 0);
      const revenue = Number(row.revenue || 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? (revenue / spend) : 0;
      const campaigns = Number(row.campaign_count || 0);
      
      const profitStr = profit >= 0 
        ? `$${profit.toFixed(2)} ✅`.padStart(13)
        : `$${profit.toFixed(2)} ❌`.padStart(13);
      
      console.log(`| ${site} | ${s1Account} | $${spend.toFixed(2).padStart(7)} | $${revenue.toFixed(2).padStart(8)} | ${profitStr} | ${(roas * 100).toFixed(1).padStart(4)}% | ${String(campaigns).padStart(9)} |`);
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

