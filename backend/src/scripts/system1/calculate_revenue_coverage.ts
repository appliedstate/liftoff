import fs from 'fs';
import path from 'path';
import { getPgPool } from '../../lib/pg';

async function main() {
  const runDate = process.argv[2] || '2025-11-07';
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Revenue Coverage Analysis ===\n`);
  console.log(`Run Date: ${runDate}\n`);
  
  // Load cluster summary
  const clusterSummaryPath = path.join(baseDir, 'slug_clusters_by_embedding_summary.csv');
  if (!fs.existsSync(clusterSummaryPath)) {
    console.error(`Cluster summary not found: ${clusterSummaryPath}`);
    process.exit(1);
  }
  
  const summaryContent = fs.readFileSync(clusterSummaryPath, 'utf-8');
  const summaryLines = summaryContent.split('\n').filter(l => l.trim());
  const summaryHeaders = summaryLines[0].split(',');
  
  const clusters: Array<{
    cluster_name: string;
    total_revenue: number;
  }> = [];
  
  for (let i = 1; i < summaryLines.length; i++) {
    const values = summaryLines[i].split(',');
    const cluster: any = {};
    summaryHeaders.forEach((h, idx) => {
      cluster[h] = values[idx] || '';
    });
    
    clusters.push({
      cluster_name: cluster.cluster_name || '',
      total_revenue: parseFloat(cluster.total_revenue || '0'),
    });
  }
  
  // Calculate totals
  const totalClusteredRevenue = clusters.reduce((sum, c) => sum + c.total_revenue, 0);
  
  // Filter leadgen clusters
  const leadgenClusters = clusters.filter(c => {
    const lower = c.cluster_name.toLowerCase();
    return lower.includes('instant-loan') || 
           lower.includes('instant-loans') ||
           lower.includes('emergency-fund') ||
           lower.includes('emergency-funds');
  });
  
  const leadgenRevenue = leadgenClusters.reduce((sum, c) => sum + c.total_revenue, 0);
  const facebookEligibleRevenue = totalClusteredRevenue - leadgenRevenue;
  
  // Get total revenue from database (all slugs)
  const pool = getPgPool();
  try {
    const totalRevenueResult = await pool.query(`
      SELECT SUM(revenue) as total_revenue
      FROM s1_slug_embeddings
      WHERE run_date = $1
    `, [runDate.replace(/-/g, '').substring(0, 8) === '20251107' ? '2025-11-06' : runDate]);
    
    const totalRevenueInDatabase = Number(totalRevenueResult.rows[0]?.total_revenue || 0);
    
    // Also get count of slugs
    const slugCountResult = await pool.query(`
      SELECT COUNT(*) as total_slugs, COUNT(DISTINCT slug) as unique_slugs
      FROM s1_slug_embeddings
      WHERE run_date = $1
    `, [runDate.replace(/-/g, '').substring(0, 8) === '20251107' ? '2025-11-06' : runDate]);
    
    const totalSlugs = Number(slugCountResult.rows[0]?.total_slugs || 0);
    const uniqueSlugs = Number(slugCountResult.rows[0]?.unique_slugs || 0);
    
    // Count clustered slugs
    const clusterMembersPath = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
    const clusterMembers = fs.readFileSync(clusterMembersPath, 'utf-8');
    const memberLines = clusterMembers.split('\n').filter(l => l.trim());
    const clusteredSlugCount = memberLines.length - 1; // Subtract header
    
    // Count unique clustered slugs
    const uniqueClusteredSlugs = new Set<string>();
    for (let i = 1; i < memberLines.length; i++) {
      const values = memberLines[i].split(',');
      const slug = values[1] || '';
      if (slug) uniqueClusteredSlugs.add(slug);
    }
    
    console.log(`📊 REVENUE BREAKDOWN:\n`);
    console.log(`Total Revenue in Database: $${totalRevenueInDatabase.toFixed(2)}`);
    console.log(`Total Clustered Revenue: $${totalClusteredRevenue.toFixed(2)}`);
    console.log(`  - Leadgen Clusters: $${leadgenRevenue.toFixed(2)} (${((leadgenRevenue / totalClusteredRevenue) * 100).toFixed(1)}% of clustered)`);
    console.log(`  - Facebook-Eligible: $${facebookEligibleRevenue.toFixed(2)} (${((facebookEligibleRevenue / totalClusteredRevenue) * 100).toFixed(1)}% of clustered)\n`);
    
    console.log(`📈 COVERAGE METRICS:\n`);
    const clusteredPercentage = totalRevenueInDatabase > 0 
      ? (totalClusteredRevenue / totalRevenueInDatabase) * 100 
      : 0;
    const facebookPercentage = totalRevenueInDatabase > 0
      ? (facebookEligibleRevenue / totalRevenueInDatabase) * 100
      : 0;
    const unclusteredRevenue = totalRevenueInDatabase - totalClusteredRevenue;
    const unclusteredPercentage = totalRevenueInDatabase > 0
      ? (unclusteredRevenue / totalRevenueInDatabase) * 100
      : 0;
    
    console.log(`Clustered Revenue Coverage: ${clusteredPercentage.toFixed(2)}%`);
    console.log(`  - Total clustered: $${totalClusteredRevenue.toFixed(2)} / $${totalRevenueInDatabase.toFixed(2)}`);
    console.log(`\nFacebook-Eligible Revenue Coverage: ${facebookPercentage.toFixed(2)}%`);
    console.log(`  - Facebook-eligible: $${facebookEligibleRevenue.toFixed(2)} / $${totalRevenueInDatabase.toFixed(2)}`);
    console.log(`\nUnclustered Revenue: ${unclusteredPercentage.toFixed(2)}%`);
    console.log(`  - Unclustered: $${unclusteredRevenue.toFixed(2)} / $${totalRevenueInDatabase.toFixed(2)}\n`);
    
    console.log(`📋 SLUG BREAKDOWN:\n`);
    console.log(`Total Slugs in Database: ${uniqueSlugs}`);
    console.log(`Clustered Slugs: ${uniqueClusteredSlugs.size}`);
    console.log(`Unclustered Slugs: ${uniqueSlugs - uniqueClusteredSlugs.size}\n`);
    
    console.log(`Clustered Slug Coverage: ${((uniqueClusteredSlugs.size / uniqueSlugs) * 100).toFixed(2)}%\n`);
    
    // Summary
    console.log(`\n✅ SUMMARY:\n`);
    console.log(`For Facebook Campaign Opportunities:`);
    console.log(`  - ${facebookPercentage.toFixed(2)}% of total revenue is clustered and Facebook-eligible`);
    console.log(`  - ${facebookEligibleRevenue.toFixed(2)} out of $${totalRevenueInDatabase.toFixed(2)} total revenue`);
    console.log(`  - ${uniqueClusteredSlugs.size} slugs clustered (${clusters.length} clusters)`);
    console.log(`  - ${clusters.length - leadgenClusters.length} Facebook-eligible clusters\n`);
    
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('calculate_revenue_coverage failed', err);
  process.exit(1);
});



