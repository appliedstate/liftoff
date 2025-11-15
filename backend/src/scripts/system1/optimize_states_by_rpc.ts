import fs from 'fs';
import path from 'path';

async function main() {
  const clusterName = process.argv[2] || 'health/paid-depression-clinical-trials-up-to-3000-en-us';
  const runDate = process.argv[3] || '2025-11-07';
  
  console.log(`\n=== State Optimization for RPC Improvement ===\n`);
  console.log(`Cluster: ${clusterName}\n`);
  
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  const rpcByStatePath = path.join(baseDir, `${clusterName.replace(/\//g, '_')}_rpc_by_state.csv`);
  
  if (!fs.existsSync(rpcByStatePath)) {
    console.error(`RPC by state file not found: ${rpcByStatePath}`);
    console.error('Run rpc_by_state_for_cluster first.');
    process.exit(1);
  }
  
  // Read RPC by state data
  const content = fs.readFileSync(rpcByStatePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  
  const states: Array<{
    state: string;
    rpc: number;
    revenue: number;
    clicks: number;
  }> = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    states.push({
      state: row.state || '',
      rpc: parseFloat(row.rpc || '0'),
      revenue: parseFloat(row.revenue || '0'),
      clicks: parseFloat(row.clicks || '0'),
    });
  }
  
  // Calculate current average
  const totalRevenue = states.reduce((sum, s) => sum + s.revenue, 0);
  const totalClicks = states.reduce((sum, s) => sum + s.clicks, 0);
  const currentAvgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  
  console.log(`📊 CURRENT METRICS:\n`);
  console.log(`Total States: ${states.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Average RPC: $${currentAvgRPC.toFixed(4)}\n`);
  
  // Target improvements
  const targets = [
    { label: '10%', multiplier: 1.10 },
    { label: '20%', multiplier: 1.20 },
    { label: '30%', multiplier: 1.30 },
  ];
  
  console.log(`🎯 OPTIMIZATION SCENARIOS:\n`);
  
  for (const target of targets) {
    const targetRPC = currentAvgRPC * target.multiplier;
    console.log(`\n--- Target: ${target.label} Improvement (RPC: $${targetRPC.toFixed(4)}) ---\n`);
    
    // Strategy 1: Include only states above target RPC
    const aboveTarget = states.filter(s => s.rpc >= targetRPC);
    const aboveRevenue = aboveTarget.reduce((sum, s) => sum + s.revenue, 0);
    const aboveClicks = aboveTarget.reduce((sum, s) => sum + s.clicks, 0);
    const aboveAvgRPC = aboveClicks > 0 ? aboveRevenue / aboveClicks : 0;
    
    // Strategy 2: Include states sorted by RPC until we hit target
    const sortedByRPC = [...states].sort((a, b) => b.rpc - a.rpc);
    let cumulativeRevenue = 0;
    let cumulativeClicks = 0;
    const includedStates: typeof states = [];
    
    for (const state of sortedByRPC) {
      cumulativeRevenue += state.revenue;
      cumulativeClicks += state.clicks;
      includedStates.push(state);
      const currentAvg = cumulativeClicks > 0 ? cumulativeRevenue / cumulativeClicks : 0;
      if (currentAvg >= targetRPC) {
        break;
      }
    }
    
    // Strategy 3: Exclude states below a threshold
    // Find the minimum RPC threshold that gives us target average
    let minThreshold = 0;
    let bestExclusion: typeof states = [];
    let bestAvg = 0;
    
    // Try different thresholds
    for (let threshold = 0; threshold <= 2.0; threshold += 0.01) {
      const filtered = states.filter(s => s.rpc >= threshold);
      if (filtered.length === 0) continue;
      const fRevenue = filtered.reduce((sum, s) => sum + s.revenue, 0);
      const fClicks = filtered.reduce((sum, s) => sum + s.clicks, 0);
      const fAvg = fClicks > 0 ? fRevenue / fClicks : 0;
      if (fAvg >= targetRPC && filtered.length > bestExclusion.length) {
        minThreshold = threshold;
        bestExclusion = filtered;
        bestAvg = fAvg;
      }
    }
    
    // Strategy 4: Weighted selection - include top states by revenue contribution
    const sortedByRevenue = [...states].sort((a, b) => b.revenue - a.revenue);
    let weightedRevenue = 0;
    let weightedClicks = 0;
    const weightedStates: typeof states = [];
    
    for (const state of sortedByRevenue) {
      weightedRevenue += state.revenue;
      weightedClicks += state.clicks;
      weightedStates.push(state);
      const currentAvg = weightedClicks > 0 ? weightedRevenue / weightedClicks : 0;
      if (currentAvg >= targetRPC) {
        break;
      }
    }
    
    // Display results
    console.log(`Strategy 1: Include only states with RPC ≥ $${targetRPC.toFixed(4)}`);
    console.log(`  States: ${aboveTarget.length}`);
    console.log(`  Revenue: $${aboveRevenue.toFixed(2)} (${((aboveRevenue / totalRevenue) * 100).toFixed(1)}% of total)`);
    console.log(`  Clicks: ${aboveClicks.toFixed(0)} (${((aboveClicks / totalClicks) * 100).toFixed(1)}% of total)`);
    console.log(`  Average RPC: $${aboveAvgRPC.toFixed(4)}`);
    if (aboveAvgRPC >= targetRPC) {
      console.log(`  ✅ Meets target`);
    } else {
      console.log(`  ❌ Below target by $${(targetRPC - aboveAvgRPC).toFixed(4)}`);
    }
    
    console.log(`\nStrategy 2: Include top states by RPC until target reached`);
    console.log(`  States: ${includedStates.length}`);
    const incRevenue = includedStates.reduce((sum, s) => sum + s.revenue, 0);
    const incClicks = includedStates.reduce((sum, s) => sum + s.clicks, 0);
    const incAvgRPC = incClicks > 0 ? incRevenue / incClicks : 0;
    console.log(`  Revenue: $${incRevenue.toFixed(2)} (${((incRevenue / totalRevenue) * 100).toFixed(1)}% of total)`);
    console.log(`  Clicks: ${incClicks.toFixed(0)} (${((incClicks / totalClicks) * 100).toFixed(1)}% of total)`);
    console.log(`  Average RPC: $${incAvgRPC.toFixed(4)}`);
    console.log(`  Top states: ${includedStates.slice(0, 5).map(s => `${s.state} ($${s.rpc.toFixed(2)})`).join(', ')}`);
    
    console.log(`\nStrategy 3: Exclude states below RPC threshold`);
    console.log(`  Minimum RPC threshold: $${minThreshold.toFixed(4)}`);
    console.log(`  States included: ${bestExclusion.length}`);
    const exclRevenue = bestExclusion.reduce((sum, s) => sum + s.revenue, 0);
    const exclClicks = bestExclusion.reduce((sum, s) => sum + s.clicks, 0);
    console.log(`  Revenue: $${exclRevenue.toFixed(2)} (${((exclRevenue / totalRevenue) * 100).toFixed(1)}% of total)`);
    console.log(`  Clicks: ${exclClicks.toFixed(0)} (${((exclClicks / totalClicks) * 100).toFixed(1)}% of total)`);
    console.log(`  Average RPC: $${bestAvg.toFixed(4)}`);
    const excludedStates = states.filter(s => !bestExclusion.find(bs => bs.state === s.state));
    console.log(`  Excluded states: ${excludedStates.map(s => s.state).join(', ')}`);
    
    console.log(`\nStrategy 4: Include top states by revenue until target reached`);
    const wRevenue = weightedStates.reduce((sum, s) => sum + s.revenue, 0);
    const wClicks = weightedStates.reduce((sum, s) => sum + s.clicks, 0);
    const wAvgRPC = wClicks > 0 ? wRevenue / wClicks : 0;
    console.log(`  States: ${weightedStates.length}`);
    console.log(`  Revenue: $${wRevenue.toFixed(2)} (${((wRevenue / totalRevenue) * 100).toFixed(1)}% of total)`);
    console.log(`  Clicks: ${wClicks.toFixed(0)} (${((wClicks / totalClicks) * 100).toFixed(1)}% of total)`);
    console.log(`  Average RPC: $${wAvgRPC.toFixed(4)}`);
    console.log(`  Top states: ${weightedStates.slice(0, 5).map(s => `${s.state} ($${s.rpc.toFixed(2)}, $${s.revenue.toFixed(0)})`).join(', ')}`);
    
    // Recommend best strategy (balance between RPC improvement and revenue retention)
    console.log(`\n💡 RECOMMENDATION:`);
    if (bestExclusion.length > 0 && bestAvg >= targetRPC) {
      console.log(`  Use Strategy 3: Exclude states below $${minThreshold.toFixed(4)} RPC`);
      console.log(`  This maintains ${((exclRevenue / totalRevenue) * 100).toFixed(1)}% of revenue while achieving target RPC`);
      console.log(`  Exclude: ${excludedStates.map(s => s.state).join(', ')}`);
    } else if (includedStates.length > 0 && incAvgRPC >= targetRPC) {
      console.log(`  Use Strategy 2: Include top ${includedStates.length} states by RPC`);
      console.log(`  This maintains ${((incRevenue / totalRevenue) * 100).toFixed(1)}% of revenue`);
    } else {
      console.log(`  Target may be difficult to achieve. Consider Strategy 2 with top states.`);
    }
  }
  
  // Write recommendations to CSV
  const recommendations: Array<{
    target_improvement: string;
    strategy: string;
    states_count: number;
    revenue_pct: number;
    clicks_pct: number;
    avg_rpc: number;
    states: string;
  }> = [];
  
  for (const target of targets) {
    const targetRPC = currentAvgRPC * target.multiplier;
    const sortedByRPC = [...states].sort((a, b) => b.rpc - a.rpc);
    let cumulativeRevenue = 0;
    let cumulativeClicks = 0;
    const includedStates: typeof states = [];
    
    for (const state of sortedByRPC) {
      cumulativeRevenue += state.revenue;
      cumulativeClicks += state.clicks;
      includedStates.push(state);
      const currentAvg = cumulativeClicks > 0 ? cumulativeRevenue / cumulativeClicks : 0;
      if (currentAvg >= targetRPC) {
        break;
      }
    }
    
    recommendations.push({
      target_improvement: target.label,
      strategy: 'Top states by RPC',
      states_count: includedStates.length,
      revenue_pct: (cumulativeRevenue / totalRevenue) * 100,
      clicks_pct: (cumulativeClicks / totalClicks) * 100,
      avg_rpc: cumulativeClicks > 0 ? cumulativeRevenue / cumulativeClicks : 0,
      states: includedStates.map(s => s.state).join('; '),
    });
  }
  
  const csvRows = [
    ['target_improvement', 'strategy', 'states_count', 'revenue_pct', 'clicks_pct', 'avg_rpc', 'states'].join(','),
    ...recommendations.map(r => [
      r.target_improvement,
      r.strategy,
      r.states_count,
      r.revenue_pct.toFixed(2),
      r.clicks_pct.toFixed(2),
      r.avg_rpc.toFixed(4),
      `"${r.states}"`,
    ].join(','))
  ];
  
  const outputPath = path.join(baseDir, `${clusterName.replace(/\//g, '_')}_state_optimization.csv`);
  fs.writeFileSync(outputPath, csvRows.join('\n'));
  
  console.log(`\n✅ Recommendations written to: ${outputPath}\n`);
}

main().catch((err) => {
  console.error('optimize_states_by_rpc failed', err);
  process.exit(1);
});



