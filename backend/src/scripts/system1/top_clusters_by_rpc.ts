import fs from 'fs';
import path from 'path';

async function main() {
  const runDate = process.argv[2] || '2025-11-07';
  const limit = parseInt(process.argv[3] || '100', 10);
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Top ${limit} Clusters by RPC ===\n`);
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
    slug_count: number;
    total_revenue: number;
    total_clicks: number;
    total_keywords: number;
    rpc: number;
  }> = [];
  
  for (let i = 1; i < summaryLines.length; i++) {
    const values = summaryLines[i].split(',');
    const cluster: any = {};
    summaryHeaders.forEach((h, idx) => {
      cluster[h] = values[idx] || '';
    });
    
    const revenue = parseFloat(cluster.total_revenue || '0');
    const clicks = parseFloat(cluster.total_clicks || '0');
    const rpc = clicks > 0 ? revenue / clicks : 0;
    
    clusters.push({
      cluster_name: cluster.cluster_name || '',
      slug_count: parseInt(cluster.slug_count || '0', 10),
      total_revenue: revenue,
      total_clicks: clicks,
      total_keywords: parseInt(cluster.total_keywords || '0', 10),
      rpc: rpc,
    });
  }
  
  // Filter out leadgen clusters
  const filteredClusters = clusters.filter(c => {
    const lower = c.cluster_name.toLowerCase();
    return !lower.includes('instant-loan') && 
           !lower.includes('instant-loans') &&
           !lower.includes('emergency-fund') &&
           !lower.includes('emergency-funds');
  });
  
  // Sort by RPC descending
  const sorted = [...filteredClusters]
    .filter(c => c.total_clicks > 0) // Only clusters with clicks
    .sort((a, b) => b.rpc - a.rpc)
    .slice(0, limit);
  
  // Print table
  console.log('Rank | Cluster Name | RPC | Revenue | Clicks | Keywords | Slugs');
  console.log('-----|--------------|-----|---------|--------|----------|------');
  
  sorted.forEach((cluster, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const name = cluster.cluster_name.length > 50 
      ? cluster.cluster_name.substring(0, 47) + '...' 
      : cluster.cluster_name;
    const rpc = `$${cluster.rpc.toFixed(4)}`.padStart(7);
    const revenue = `$${cluster.total_revenue.toFixed(2)}`.padStart(9);
    const clicks = cluster.total_clicks.toFixed(0).padStart(6);
    const keywords = cluster.total_keywords.toString().padStart(8);
    const slugs = cluster.slug_count.toString().padStart(5);
    
    console.log(`${rank} | ${name.padEnd(50)} | ${rpc} | ${revenue} | ${clicks} | ${keywords} | ${slugs}`);
  });
  
  // Write CSV
  const csvRows = [
    ['rank', 'cluster_name', 'rpc', 'total_revenue', 'total_clicks', 'total_keywords', 'slug_count'].join(','),
    ...sorted.map((c, idx) => [
      idx + 1,
      c.cluster_name,
      c.rpc.toFixed(4),
      c.total_revenue.toFixed(2),
      c.total_clicks.toFixed(2),
      c.total_keywords,
      c.slug_count,
    ].join(','))
  ];
  
  const outputPath = path.join(baseDir, `top_${limit}_clusters_by_rpc.csv`);
  fs.writeFileSync(outputPath, csvRows.join('\n'));
  
  console.log(`\n✅ Output written to: ${outputPath}\n`);
  
  // Summary stats
  const avgRPC = sorted.reduce((sum, c) => sum + c.rpc, 0) / sorted.length;
  const totalRevenue = sorted.reduce((sum, c) => sum + c.total_revenue, 0);
  const totalClicks = sorted.reduce((sum, c) => sum + c.total_clicks, 0);
  
  console.log(`📊 SUMMARY:\n`);
  console.log(`Top ${limit} clusters by RPC:`);
  console.log(`  Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`  Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`  Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`  Highest RPC: $${sorted[0]?.rpc.toFixed(4)} (${sorted[0]?.cluster_name})`);
  console.log(`  Lowest RPC: $${sorted[sorted.length - 1]?.rpc.toFixed(4)} (${sorted[sorted.length - 1]?.cluster_name})\n`);
}

main().catch((err) => {
  console.error('top_clusters_by_rpc failed', err);
  process.exit(1);
});



