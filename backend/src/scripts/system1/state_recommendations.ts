import fs from 'fs';
import path from 'path';

async function main() {
  const clusterName = process.argv[2] || 'health/paid-depression-clinical-trials-up-to-3000-en-us';
  const runDate = process.argv[3] || '2025-11-07';
  
  console.log(`\n=== State Recommendations for RPC Improvement ===\n`);
  console.log(`Cluster: ${clusterName}\n`);
  
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  const rpcByStatePath = path.join(baseDir, `${clusterName.replace(/\//g, '_')}_rpc_by_state.csv`);
  
  if (!fs.existsSync(rpcByStatePath)) {
    console.error(`RPC by state file not found: ${rpcByStatePath}`);
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
    
    // Skip invalid states
    if (row.state && row.state.length === 2 && row.state !== 'TA') {
      states.push({
        state: row.state,
        rpc: parseFloat(row.rpc || '0'),
        revenue: parseFloat(row.revenue || '0'),
        clicks: parseFloat(row.clicks || '0'),
      });
    }
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
  
  console.log(`🎯 STATE RECOMMENDATIONS BY TARGET:\n`);
  
  for (const target of targets) {
    const targetRPC = currentAvgRPC * target.multiplier;
    
    // Strategy: Include high RPC states first, then add lower RPC states until we can't add more without dropping below target
    const sortedByRPC = [...states].sort((a, b) => b.rpc - a.rpc);
    let cumulativeRevenue = 0;
    let cumulativeClicks = 0;
    const includedStates: typeof states = [];
    
    for (const state of sortedByRPC) {
      // Test if adding this state would keep us above target
      const testRevenue = cumulativeRevenue + state.revenue;
      const testClicks = cumulativeClicks + state.clicks;
      const testAvg = testClicks > 0 ? testRevenue / testClicks : 0;
      
      if (testAvg >= targetRPC) {
        // Safe to add this state
        cumulativeRevenue = testRevenue;
        cumulativeClicks = testClicks;
        includedStates.push(state);
      } else {
        // Adding this state would drop us below target, stop
        break;
      }
    }
    
    if (includedStates.length === 0 || cumulativeClicks === 0) {
      console.log(`❌ Cannot achieve ${target.label} improvement`);
      continue;
    }
    
    const finalAvgRPC = cumulativeRevenue / cumulativeClicks;
    const revenueRetention = (cumulativeRevenue / totalRevenue) * 100;
    const clicksRetention = (cumulativeClicks / totalClicks) * 100;
    
    console.log(`Target: ${target.label} Improvement → RPC: $${targetRPC.toFixed(4)}`);
    console.log(`\n✅ RECOMMENDED STATES (${includedStates.length} states):\n`);
    
    // Sort by RPC for display
    const sortedBest = [...includedStates].sort((a, b) => b.rpc - a.rpc);
    sortedBest.forEach((s, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2)}. ${s.state.padEnd(2)} - RPC: $${s.rpc.toFixed(4).padStart(7)} | Revenue: $${s.revenue.toFixed(2).padStart(9)} | Clicks: ${s.clicks.toFixed(0).padStart(6)}`);
    });
    
    console.log(`\n📊 RESULTS:\n`);
    console.log(`  Average RPC: $${finalAvgRPC.toFixed(4)} (target: $${targetRPC.toFixed(4)}) ✅`);
    console.log(`  Revenue: $${cumulativeRevenue.toFixed(2)} (${revenueRetention.toFixed(1)}% of total)`);
    console.log(`  Clicks: ${cumulativeClicks.toFixed(0)} (${clicksRetention.toFixed(1)}% of total)`);
    
    const excludedStates = states.filter(s => !includedStates.find(bs => bs.state === s.state));
    console.log(`\n🚫 EXCLUDED STATES (${excludedStates.length} states):\n`);
    const sortedExcluded = [...excludedStates].sort((a, b) => b.rpc - a.rpc);
    sortedExcluded.slice(0, 10).forEach((s) => {
      console.log(`  ${s.state} - RPC: $${s.rpc.toFixed(4)} | Revenue: $${s.revenue.toFixed(2)}`);
    });
    if (excludedStates.length > 10) {
      console.log(`  ... (${excludedStates.length - 10} more states)`);
    }
    
    console.log(`\n💡 STRATEGY:\n`);
    console.log(`  Include top ${includedStates.length} states by RPC`);
    console.log(`  This achieves ${target.label} RPC improvement while retaining ${revenueRetention.toFixed(1)}% of revenue\n`);
  }
}

main().catch((err) => {
  console.error('state_recommendations failed', err);
  process.exit(1);
});

