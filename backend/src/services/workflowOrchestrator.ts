/**
 * Workflow Orchestrator Service
 * 
 * Orchestrates end-to-end workflow from opportunities to campaign launch.
 * Handles status tracking, error handling, and automated triggers.
 */

import { OpportunityQueue, Opportunity, CampaignBlueprint } from './opportunityQueue';
import { CampaignFactory, CampaignPlan } from './campaignFactory';
import { getPgPool } from '../lib/pg';

export interface WorkflowState {
  opportunityId: string;
  blueprintId?: string;
  campaignPlanId?: string;
  campaignMappingId?: string;
  status: 'opportunity' | 'blueprint' | 'campaign_plan' | 'campaign_created' | 'failed';
  currentStep: string;
  errors: Array<{ step: string; error: string; timestamp: Date }>;
}

export class WorkflowOrchestrator {
  constructor(
    private opportunityQueue: OpportunityQueue,
    private campaignFactory: CampaignFactory
  ) {}

  /**
   * Process opportunity end-to-end: Opportunity → Blueprint → Campaign
   * 
   * This is the main automated workflow function.
   */
  async processOpportunity(
    opportunityId: string,
    blueprintConfig: {
      brand: string;
      adAccountId: string;
      organization: string;
      domain: string;
      destination: string;
      strategisTemplateId: string;
      category: string;
      article?: string;
      fbPage?: string;
    }
  ): Promise<WorkflowState> {
    const state: WorkflowState = {
      opportunityId,
      status: 'opportunity',
      currentStep: 'load_opportunity',
      errors: [],
    };

    try {
      // Step 1: Load opportunity
      const opportunity = await this.opportunityQueue.getById(opportunityId);
      if (!opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found`);
      }

      state.currentStep = 'generate_blueprint';

      // Step 2: Generate blueprint from opportunity
      const blueprint = await this.generateBlueprintFromOpportunity(
        opportunity,
        blueprintConfig
      );

      const createdBlueprint = await this.opportunityQueue.createBlueprint(
        opportunityId,
        blueprint
      );
      state.blueprintId = createdBlueprint.id!;

      state.status = 'blueprint';
      state.currentStep = 'create_campaign_plan';

      // Step 3: Convert blueprint to campaign plan
      const campaignPlan = await this.convertBlueprintToCampaignPlan(
        createdBlueprint,
        opportunity,
        blueprintConfig
      );

      state.status = 'campaign_plan';
      state.currentStep = 'create_campaign';

      // Step 4: Create campaign via Campaign Factory
      const result = await this.campaignFactory.createCampaignWithNaming(campaignPlan);

      state.campaignPlanId = result.campaignPlanId;
      state.campaignMappingId = result.campaignMappingId;
      state.status = 'campaign_created';

      // Step 5: Update opportunity and blueprint status
      await this.opportunityQueue.updateStatus(opportunityId, 'launched');
      if (state.blueprintId) {
        await this.opportunityQueue.updateBlueprintStatus(state.blueprintId, 'launched');
      }

      return state;
    } catch (error) {
      state.status = 'failed';
      state.errors.push({
        step: state.currentStep,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      // Log error to database
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO campaign_errors (campaign_plan_id, request_id, step, error_type, error_message, error_details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          state.campaignPlanId || null,
          `workflow-${opportunityId}`,
          state.currentStep,
          error instanceof Error ? error.constructor.name : 'UnknownError',
          error instanceof Error ? error.message : String(error),
          { workflowState: state },
        ]
      );

      throw error;
    }
  }

  /**
   * Generate blueprint from opportunity
   */
  private async generateBlueprintFromOpportunity(
    opportunity: Opportunity,
    config: {
      brand: string;
      category: string;
    }
  ): Promise<CampaignBlueprint> {
    // This would integrate with generate_blueprint.ts logic
    // For now, create a basic blueprint structure
    
    const laneMix = opportunity.recommended_lane_mix || {
      asc: 33,
      lal: 17,
      interest: 50,
    };

    return {
      vertical: config.category,
      angle: opportunity.angle,
      lane_mix: laneMix,
      budget_plan: {
        total_budget: opportunity.recommended_budget || 5000,
        asc_budget: (opportunity.recommended_budget || 5000) * (laneMix.asc / 100),
        lal_budget: (opportunity.recommended_budget || 5000) * (laneMix.lal / 100),
      },
      targeting: {
        geo_locations: { countries: ['US'] }, // TODO: derive from opportunity
        age_min: 21,
        age_max: 65,
      },
      creative_requirements: {
        hooks_needed: 6,
        formats: ['916', '45', '11'],
      },
      kpi_targets: {
        roas: 1.30,
        emq: 5,
      },
      status: 'draft',
    };
  }

  /**
   * Convert blueprint to campaign plan
   */
  private async convertBlueprintToCampaignPlan(
    blueprint: CampaignBlueprint,
    opportunity: Opportunity,
    config: {
      brand: string;
      adAccountId: string;
      organization: string;
      domain: string;
      destination: string;
      strategisTemplateId: string;
      article?: string;
      fbPage?: string;
    }
  ): Promise<CampaignPlan> {
    // Generate hookSetId from opportunity
    const hookSetId = `hookset_${opportunity.angle.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}`;

    // Generate ad sets from blueprint lane mix
    const adSets: CampaignPlan['adSets'] = [];

    // ASC ad set
    if (blueprint.lane_mix && blueprint.lane_mix.asc > 0) {
      adSets.push({
        audienceKey: 'asc', // TODO: derive from blueprint
        placementKey: 'advplus_all_auto',
        optimizationEvent: 'PURCHASE',
        budgetType: 'CBO',
        version: 1,
        targeting: blueprint.targeting || {},
        promotedObject: {
          pixelId: '', // TODO: get from config
          customEventType: 'PURCHASE',
        },
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      });
    }

    // LAL ad set
    if (blueprint.lane_mix && blueprint.lane_mix.lal > 0) {
      adSets.push({
        audienceKey: 'll_2p_purchasers_180',
        placementKey: 'advplus_all_auto',
        optimizationEvent: 'PURCHASE',
        budgetType: 'CBO',
        version: 1,
        targeting: blueprint.targeting || {},
        promotedObject: {
          pixelId: '', // TODO: get from config
          customEventType: 'PURCHASE',
        },
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      });
    }

    return {
      brand: config.brand,
      objective: 'CONVERSIONS',
      hookSetId,
      market: 'US', // TODO: derive from opportunity
      channel: 'FB',
      date: new Date().toISOString().split('T')[0],
      category: config.brand, // TODO: use blueprint vertical
      adAccountId: config.adAccountId,
      organization: config.organization,
      domain: config.domain,
      destination: config.destination,
      strategisTemplateId: config.strategisTemplateId,
      article: config.article,
      fbPage: config.fbPage,
      adSets,
    };
  }

  /**
   * Process pending opportunities (automated batch processing)
   */
  async processPendingOpportunities(
    limit: number = 10,
    blueprintConfig: Parameters<typeof this.processOpportunity>[1]
  ): Promise<WorkflowState[]> {
    const pending = await this.opportunityQueue.getPending(limit);
    const results: WorkflowState[] = [];

    for (const opportunity of pending) {
      try {
        const result = await this.processOpportunity(opportunity.id!, blueprintConfig);
        results.push(result);
      } catch (error) {
        results.push({
          opportunityId: opportunity.id!,
          status: 'failed',
          currentStep: 'process_opportunity',
          errors: [{
            step: 'process_opportunity',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          }],
        });
      }
    }

    return results;
  }

  /**
   * Weekly opportunity refresh (automated trigger)
   * 
   * This would be called by a scheduled job (cron/worker)
   */
  async weeklyOpportunityRefresh(): Promise<void> {
    // TODO: Integrate with score_opportunities.ts
    // 1. Run System1 intake
    // 2. Score opportunities
    // 3. Import top opportunities into database
    // 4. Queue for processing
    
    throw new Error('Not implemented - needs integration with score_opportunities.ts');
  }
}

