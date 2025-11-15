import { getPgPool } from '../../lib/pg';

async function main() {
  const pool = getPgPool();
  try {
    const result = await pool.query(`
      SELECT keyword, revenue, clicks, searches, rpc, rps, angle, category
      FROM s1_embeddings
      WHERE run_date = '2025-11-06'
        AND LOWER(keyword) = 'cruise'
    `);

    console.log(`\n=== Cruise Keyword Analysis ===\n`);
    
    if (result.rows.length === 0) {
      console.log('No "cruise" keyword found in database\n');
    } else {
      result.rows.forEach((row: any) => {
        console.log(`Keyword: "${row.keyword}"`);
        console.log(`Angle: ${row.angle || 'N/A'}`);
        console.log(`Category: ${row.category || 'N/A'}`);
        console.log(`Searches: ${row.searches || 0}`);
        console.log(`Clicks: ${Number(row.clicks || 0).toFixed(2)}`);
        console.log(`Revenue: $${Number(row.revenue || 0).toFixed(2)}`);
        console.log(`RPC: ${row.rpc ? Number(row.rpc).toFixed(4) : 'N/A'}`);
        console.log(`RPS: ${row.rps ? Number(row.rps).toFixed(4) : 'N/A'}`);
        console.log('');
      });
    }

    // Also check for any keywords containing cruise
    const allCruise = await pool.query(`
      SELECT keyword, revenue, clicks, searches, rpc, rps, angle, category
      FROM s1_embeddings
      WHERE run_date = '2025-11-06'
        AND LOWER(keyword) LIKE '%cruise%'
      ORDER BY revenue DESC
      LIMIT 20
    `);

    console.log(`\n=== All Keywords Containing "cruise" ===\n`);
    console.log(`Total found: ${allCruise.rows.length}\n`);
    
    if (allCruise.rows.length === 0) {
      console.log('No keywords containing "cruise" found\n');
    } else {
      allCruise.rows.forEach((row: any, i: number) => {
        console.log(`${i + 1}. "${row.keyword}"`);
        console.log(`   Revenue: $${Number(row.revenue || 0).toFixed(2)}, Clicks: ${Number(row.clicks || 0).toFixed(0)}, Searches: ${row.searches || 0}`);
        console.log(`   Angle: ${row.angle || 'N/A'}, Category: ${row.category || 'N/A'}\n`);
      });
    }

    const totalRevenue = allCruise.rows.reduce((sum: number, r: any) => sum + (Number(r.revenue) || 0), 0);
    const totalClicks = allCruise.rows.reduce((sum: number, r: any) => sum + (Number(r.clicks) || 0), 0);
    const totalSearches = allCruise.rows.reduce((sum: number, r: any) => sum + (Number(r.searches) || 0), 0);

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Keywords: ${allCruise.rows.length}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Total Clicks: ${totalClicks.toFixed(0)}`);
    console.log(`   Total Searches: ${totalSearches.toFixed(0)}\n`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);



