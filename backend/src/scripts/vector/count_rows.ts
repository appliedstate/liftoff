import { getPgPool } from '../../lib/pg';

async function main() {
  const pool = getPgPool();
  
  try {
    // Count total rows in s1_embeddings
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total_rows
      FROM s1_embeddings
    `);
    
    // Count by run_date
    const byRunDate = await pool.query(`
      SELECT 
        run_date,
        COUNT(*) as count,
        COUNT(DISTINCT keyword) as unique_keywords
      FROM s1_embeddings
      GROUP BY run_date
      ORDER BY run_date DESC
    `);
    
    // Get some stats
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT keyword) as unique_keywords,
        COUNT(DISTINCT run_date) as unique_run_dates,
        MIN(run_date) as earliest_run,
        MAX(run_date) as latest_run
      FROM s1_embeddings
    `);
    
    console.log('\n=== Database Row Count ===\n');
    console.log('Total rows:', totalResult.rows[0].total_rows);
    console.log('\nStats:');
    console.log(JSON.stringify(stats.rows[0], null, 2));
    console.log('\nBy Run Date:');
    console.log(JSON.stringify(byRunDate.rows.map((r: any) => ({
      run_date: r.run_date,
      count: Number(r.count),
      unique_keywords: Number(r.unique_keywords)
    })), null, 2));
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

