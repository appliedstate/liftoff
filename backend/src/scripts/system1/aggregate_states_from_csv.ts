import fs from 'fs';
import path from 'path';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

async function main() {
  const csvPath = process.argv[2] || './runs/system1/2025-11-07/depression_cluster_state_analysis_2025-11-10T22-25-22.csv';
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    console.error('CSV file is empty or has no data rows');
    process.exit(1);
  }
  
  const stateMap = new Map<string, {
    state: string;
    revenue: number;
    clicks: number;
    searches: number;
    keywords: number;
    slugCount: number;
  }>();
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 9) continue;
    
    const state = values[2].replace(/^"/, '').replace(/"$/, '').trim();
    const revenue = parseFloat(values[3] || '0');
    const rpc = parseFloat(values[4] || '0');
    const rps = parseFloat(values[5] || '0');
    const clicks = parseFloat(values[6] || '0');
    const searches = parseFloat(values[7] || '0');
    const keywords = parseFloat(values[8] || '0');
    
    if (!state || state === 'state' || state.length !== 2) continue;
    
    if (!stateMap.has(state)) {
      stateMap.set(state, {
        state,
        revenue: 0,
        clicks: 0,
        searches: 0,
        keywords: 0,
        slugCount: 0,
      });
    }
    
    const stateData = stateMap.get(state)!;
    stateData.revenue += revenue;
    stateData.clicks += clicks;
    stateData.searches += searches;
    stateData.keywords = Math.max(stateData.keywords, keywords);
    stateData.slugCount += 1;
  }
  
  const states = Array.from(stateMap.values())
    .map(s => ({
      ...s,
      rpc: s.clicks > 0 ? s.revenue / s.clicks : 0,
      rps: s.searches > 0 ? s.revenue / s.searches : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  
  console.log('\n📊 ALL STATES - DEPRESSION CLUSTER ANALYSIS\n');
  console.log('Rank | State | Revenue | RPC | RPS | Clicks | Searches | Keywords | Slugs');
  console.log('-----|-------|---------|-----|-----|--------|----------|----------|------');
  
  states.forEach((s, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${s.state.padEnd(5)} | $${s.revenue.toFixed(2).padStart(8)} | $${s.rpc.toFixed(4)} | $${s.rps.toFixed(4)} | ${s.clicks.toFixed(0).padStart(6)} | ${s.searches.toFixed(0).padStart(8)} | ${s.keywords.toString().padStart(9)} | ${s.slugCount.toString().padStart(5)}`
    );
  });
  
  const total = states.reduce((sum, s) => ({
    revenue: sum.revenue + s.revenue,
    clicks: sum.clicks + s.clicks,
    searches: sum.searches + s.searches,
  }), { revenue: 0, clicks: 0, searches: 0 });
  
  const avgRPC = total.clicks > 0 ? total.revenue / total.clicks : 0;
  const avgRPS = total.searches > 0 ? total.revenue / total.searches : 0;
  
  console.log(`\n📈 SUMMARY:\n`);
  console.log(`Total States: ${states.length}`);
  console.log(`Total Revenue: $${total.revenue.toFixed(2)}`);
  console.log(`Total Clicks: ${total.clicks.toFixed(0)}`);
  console.log(`Total Searches: ${total.searches.toFixed(0)}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}\n`);
}

main().catch((err) => {
  console.error('aggregate_states_from_csv failed', err);
  process.exit(1);
});



