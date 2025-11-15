import fs from 'fs';
import path from 'path';

/**
 * Filter out leadgen clusters (short-term loans, emergency funds, etc.)
 * These clusters drive traffic from leadgen placements, not Facebook ads.
 */

const LEADGEN_KEYWORDS = [
  'instant loan',
  'quick loan',
  'fast loan',
  'emergency loan',
  'payday loan',
  'short term loan',
  'cash advance',
  'emergency fund',
  'emergency cash',
  'urgent loan',
  'same day loan',
  'instant cash',
];

function isLeadgenCluster(clusterName: string, slugs: string[]): boolean {
  const lowerName = clusterName.toLowerCase();
  const lowerSlugs = slugs.map(s => s.toLowerCase()).join(' ');
  
  // Check cluster name
  for (const keyword of LEADGEN_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return true;
    }
  }
  
  // Check slugs
  for (const keyword of LEADGEN_KEYWORDS) {
    if (lowerSlugs.includes(keyword)) {
      return true;
    }
  }
  
  // Check for specific patterns
  if (lowerName.includes('instant-loan') || lowerName.includes('instant-loans')) {
    return true;
  }
  
  if (lowerName.includes('emergency-fund') || lowerName.includes('emergency-funds')) {
    return true;
  }
  
  if (lowerName.includes('quick-loan') || lowerName.includes('fast-loan')) {
    return true;
  }
  
  return false;
}

async function main() {
  const runDate = process.argv[2] || '2025-11-07';
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  
  console.log(`\n=== Filtering Leadgen Clusters ===\n`);
  console.log(`Run Date: ${runDate}\n`);
  
  // Load cluster members
  const membersPath = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
  if (!fs.existsSync(membersPath)) {
    console.error(`Cluster members file not found: ${membersPath}`);
    process.exit(1);
  }
  
  const membersContent = fs.readFileSync(membersPath, 'utf-8');
  const memberLines = membersContent.split('\n').filter(l => l.trim());
  const memberHeaders = memberLines[0].split(',');
  
  // Group slugs by cluster
  const clusterToSlugs = new Map<string, string[]>();
  for (let i = 1; i < memberLines.length; i++) {
    const values = memberLines[i].split(',');
    const clusterName = values[0] || '';
    const slug = values[1] || '';
    if (!clusterToSlugs.has(clusterName)) {
      clusterToSlugs.set(clusterName, []);
    }
    clusterToSlugs.get(clusterName)!.push(slug);
  }
  
  // Load cluster summary
  const summaryPath = path.join(baseDir, 'slug_clusters_by_embedding_summary.csv');
  if (!fs.existsSync(summaryPath)) {
    console.error(`Cluster summary file not found: ${summaryPath}`);
    process.exit(1);
  }
  
  const summaryContent = fs.readFileSync(summaryPath, 'utf-8');
  const summaryLines = summaryContent.split('\n').filter(l => l.trim());
  const summaryHeaders = summaryLines[0].split(',');
  
  const clusters: Array<{
    cluster_name: string;
    slug_count: number;
    total_revenue: number;
    total_clicks: number;
    total_keywords: number;
  }> = [];
  
  for (let i = 1; i < summaryLines.length; i++) {
    const values = summaryLines[i].split(',');
    const cluster: any = {};
    summaryHeaders.forEach((h, idx) => {
      cluster[h] = values[idx] || '';
    });
    
    clusters.push({
      cluster_name: cluster.cluster_name || '',
      slug_count: parseInt(cluster.slug_count || '0', 10),
      total_revenue: parseFloat(cluster.total_revenue || '0'),
      total_clicks: parseFloat(cluster.total_clicks || '0'),
      total_keywords: parseInt(cluster.total_keywords || '0', 10),
    });
  }
  
  // Identify leadgen clusters
  const leadgenClusters: string[] = [];
  const facebookClusters: string[] = [];
  
  console.log(`Analyzing ${clusters.length} clusters...\n`);
  
  for (const cluster of clusters) {
    const slugs = clusterToSlugs.get(cluster.cluster_name) || [];
    if (isLeadgenCluster(cluster.cluster_name, slugs)) {
      leadgenClusters.push(cluster.cluster_name);
      console.log(`❌ LEADGEN: ${cluster.cluster_name}`);
      console.log(`   Revenue: $${cluster.total_revenue.toFixed(2)} | Slugs: ${cluster.slug_count}`);
      console.log(`   Sample slugs: ${slugs.slice(0, 3).join(', ')}...\n`);
    } else {
      facebookClusters.push(cluster.cluster_name);
    }
  }
  
  console.log(`\n📊 SUMMARY:\n`);
  console.log(`Total clusters: ${clusters.length}`);
  console.log(`Leadgen clusters (excluded): ${leadgenClusters.length}`);
  console.log(`Facebook clusters (included): ${facebookClusters.length}\n`);
  
  // Filter opportunities
  const opportunitiesPath = path.join(baseDir, 'opportunities_detailed.json');
  if (fs.existsSync(opportunitiesPath)) {
    const opportunities = JSON.parse(fs.readFileSync(opportunitiesPath, 'utf-8'));
    const filtered = opportunities.filter((op: any) => 
      !leadgenClusters.includes(op.cluster_name)
    );
    
    console.log(`Filtering opportunities...`);
    console.log(`Before: ${opportunities.length}`);
    console.log(`After: ${filtered.length}`);
    console.log(`Removed: ${opportunities.length - filtered.length}\n`);
    
    // Write filtered opportunities
    fs.writeFileSync(
      path.join(baseDir, 'opportunities_detailed_filtered.json'),
      JSON.stringify(filtered, null, 2)
    );
    
    // Write leadgen cluster list
    fs.writeFileSync(
      path.join(baseDir, 'leadgen_clusters.json'),
      JSON.stringify(leadgenClusters, null, 2)
    );
    
    console.log(`✅ Output files:`);
    console.log(`   - opportunities_detailed_filtered.json`);
    console.log(`   - leadgen_clusters.json\n`);
  }
}

main().catch((err) => {
  console.error('filter_leadgen_clusters failed', err);
  process.exit(1);
});



