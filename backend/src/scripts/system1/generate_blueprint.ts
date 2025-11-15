import fs from 'fs';
import path from 'path';

/**
 * Blueprint Generator
 * 
 * Generates launch-ready blueprints from scored opportunities.
 * Blueprints include: lane mix, budgets, geo targeting, creative requirements, KPI targets.
 */

interface Blueprint {
  opportunity_id: string;
  cluster_name: string;
  category: string;
  
  // Launch configuration
  lanes: Array<{
    type: 'ASC' | 'LAL' | 'Interest';
    budget: number;
    percentage: number;
    targeting: {
      geo?: string[];
      audience?: string[];
      interests?: string[];
    };
  }>;
  
  // Creative requirements
  hooks: string[]; // Top keywords to use as hooks
  formats: Array<{
    format: '9:16' | '4:5' | '1:1';
    percentage: number;
  }>;
  landing_pages: Array<{
    slug: string;
    priority: number;
  }>;
  
  // KPI targets
  target_cpa: number;
  success_threshold_cpa: number;
  kill_threshold_cpa: number;
  freeze_window_hours: number;
  
  // Test plan
  canary_lanes: string[]; // Which lanes to test first
  promotion_ladder: Array<{
    condition: string;
    action: string;
    budget_increase: number;
  }>;
}

async function main() {
  const runDate = process.argv[2] || '2025-11-07';
  const opportunityId = process.argv[3]; // Optional: specific opportunity
  
  console.log(`\n=== Blueprint Generator ===\n`);
  console.log(`Run Date: ${runDate}\n`);
  
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  const opportunitiesPath = path.join(baseDir, 'opportunities_detailed.json');
  
  if (!fs.existsSync(opportunitiesPath)) {
    console.error(`Opportunities file not found: ${opportunitiesPath}`);
    console.error('Run system1:score first to generate opportunities.');
    process.exit(1);
  }
  
  const opportunities = JSON.parse(fs.readFileSync(opportunitiesPath, 'utf-8'));
  
  // Filter to top opportunities (positive ΔCM or top by revenue)
  const topOpportunities = opportunities
    .filter((op: any) => op.predicted_delta_cm > -200 || op.total_revenue > 1000)
    .sort((a: any, b: any) => b.predicted_delta_cm - a.predicted_delta_cm)
    .slice(0, 20); // Top 20
  
  console.log(`Generating blueprints for ${topOpportunities.length} opportunities...\n`);
  
  const blueprints: Blueprint[] = [];
  
  for (const opp of topOpportunities) {
    const blueprint: Blueprint = {
      opportunity_id: opp.cluster_name,
      cluster_name: opp.cluster_name,
      category: opp.category,
      
      lanes: [
        {
          type: 'ASC',
          budget: opp.recommended_budget * (opp.recommended_lane_mix.asc || 0.4),
          percentage: (opp.recommended_lane_mix.asc || 0.4) * 100,
          targeting: {},
        },
        {
          type: 'LAL',
          budget: opp.recommended_budget * (opp.recommended_lane_mix.lal || 0.35),
          percentage: (opp.recommended_lane_mix.lal || 0.35) * 100,
          targeting: {},
        },
        {
          type: 'Interest',
          budget: opp.recommended_budget * (opp.recommended_lane_mix.interest || 0.25),
          percentage: (opp.recommended_lane_mix.interest || 0.25) * 100,
          targeting: {
            interests: [opp.category], // Use category as interest
          },
        },
      ],
      
      hooks: opp.top_keywords?.slice(0, 5).map((k: any) => k.keyword) || [],
      
      formats: [
        { format: '9:16', percentage: 40 },
        { format: '4:5', percentage: 30 },
        { format: '1:1', percentage: 30 },
      ],
      
      landing_pages: opp.top_slugs?.slice(0, 3).map((s: any, idx: number) => ({
        slug: s.slug,
        priority: idx + 1,
      })) || [],
      
      target_cpa: opp.success_threshold_cpa || 25.0,
      success_threshold_cpa: opp.success_threshold_cpa || 22.5,
      kill_threshold_cpa: opp.kill_threshold_cpa || 30.0,
      freeze_window_hours: opp.freeze_window_hours || 72,
      
      canary_lanes: ['ASC'], // Start with ASC as canary
      
      promotion_ladder: [
        {
          condition: 'cCPA < target_cpa AND stable for 48h',
          action: 'Increase budget 20%',
          budget_increase: 0.2,
        },
        {
          condition: 'cCPA < target_cpa * 0.9 AND stable for 72h',
          action: 'Increase budget 50%',
          budget_increase: 0.5,
        },
      ],
    };
    
    blueprints.push(blueprint);
  }
  
  // Write blueprints
  const outputPath = path.join(baseDir, 'blueprints.json');
  fs.writeFileSync(outputPath, JSON.stringify(blueprints, null, 2));
  
  // Write CSV summary
  const csvRows = [
    [
      'cluster_name',
      'category',
      'total_budget',
      'asc_budget',
      'lal_budget',
      'interest_budget',
      'target_cpa',
      'freeze_hours',
      'hooks_count',
      'landing_pages_count',
    ].join(','),
    ...blueprints.map(bp => [
      bp.cluster_name,
      bp.category,
      bp.lanes.reduce((sum, l) => sum + l.budget, 0).toFixed(2),
      bp.lanes.find(l => l.type === 'ASC')?.budget.toFixed(2) || '0',
      bp.lanes.find(l => l.type === 'LAL')?.budget.toFixed(2) || '0',
      bp.lanes.find(l => l.type === 'Interest')?.budget.toFixed(2) || '0',
      bp.target_cpa.toFixed(2),
      bp.freeze_window_hours.toString(),
      bp.hooks.length.toString(),
      bp.landing_pages.length.toString(),
    ].join(',')),
  ];
  
  fs.writeFileSync(path.join(baseDir, 'blueprints_summary.csv'), csvRows.join('\n'));
  
  console.log(`✅ Generated ${blueprints.length} blueprints\n`);
  console.log(`📋 SAMPLE BLUEPRINT:\n`);
  if (blueprints.length > 0) {
    const sample = blueprints[0];
    console.log(`Cluster: ${sample.cluster_name}`);
    console.log(`Category: ${sample.category}`);
    console.log(`Total Budget: $${sample.lanes.reduce((sum, l) => sum + l.budget, 0).toFixed(2)}`);
    console.log(`  - ASC: $${sample.lanes.find(l => l.type === 'ASC')?.budget.toFixed(2)} (${sample.lanes.find(l => l.type === 'ASC')?.percentage}%)`);
    console.log(`  - LAL: $${sample.lanes.find(l => l.type === 'LAL')?.budget.toFixed(2)} (${sample.lanes.find(l => l.type === 'LAL')?.percentage}%)`);
    console.log(`  - Interest: $${sample.lanes.find(l => l.type === 'Interest')?.budget.toFixed(2)} (${sample.lanes.find(l => l.type === 'Interest')?.percentage}%)`);
    console.log(`Target CPA: $${sample.target_cpa.toFixed(2)}`);
    console.log(`Freeze Window: ${sample.freeze_window_hours}h`);
    console.log(`Hooks: ${sample.hooks.slice(0, 3).join(', ')}...`);
    console.log(`Landing Pages: ${sample.landing_pages.map(lp => lp.slug).slice(0, 2).join(', ')}...\n`);
  }
  
  console.log(`✅ Output files:`);
  console.log(`   - ${outputPath}`);
  console.log(`   - ${path.join(baseDir, 'blueprints_summary.csv')}\n`);
}

main().catch((err) => {
  console.error('generate_blueprint failed', err);
  process.exit(1);
});



