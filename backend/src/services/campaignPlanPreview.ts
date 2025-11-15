/**
 * Campaign Plan Preview Service
 * 
 * Generates preview of campaign plan without actually creating campaigns.
 * Shows all required information and how campaigns will be set up.
 */

import { OpportunityQueue, Opportunity, CampaignBlueprint } from './opportunityQueue';
import { generateCampaignName, generateAdSetName, generateStrategisCampaignName } from './namingGenerator';

export interface CampaignPlanPreview {
  opportunity: Opportunity;
  blueprint: CampaignBlueprint;
  campaignPlan: {
    // Campaign Metadata
    brand: string;
    objective: string;
    hookSetId: string;
    market: string;
    channel: string;
    date: string;
    category: string;
    
    // Account & Organization
    adAccountId: string;
    organization: string;
    
    // Tracking Configuration
    domain: string;
    destination: string;
    strategisTemplateId: string;
    article?: string;
    fbPage?: string;
    
    // Generated Names
    campaignName: string;
    adSetNames: string[];
    strategisCampaignNames: string[];
    
    // Ad Sets
    adSets: Array<{
      name: string;
      audienceKey: string;
      placementKey: string;
      optimizationEvent: string;
      budgetType: 'CBO' | 'ABO';
      version: number;
      targeting: Record<string, any>;
      promotedObject?: {
        pixelId: string;
        customEventType: string;
      };
      dailyBudget?: string;
      bidStrategy?: string;
    }>;
  };
  
  // What Will Be Created
  willCreate: {
    facebookCampaign: {
      name: string;
      objective: string;
      status: string;
      isCBO: boolean;
      dailyBudget?: string;
    };
    facebookAdSets: Array<{
      name: string;
      optimizationGoal: string;
      billingEvent: string;
      targeting: Record<string, any>;
      status: string;
    }>;
    strategisCampaigns: Array<{
      name: string;
      category: string;
      properties: Record<string, any>;
      trackingUrl: string;
    }>;
  };
  
  // Required Information Checklist
  requiredInfo: {
    hasAllRequired: boolean;
    missing: string[];
    present: string[];
  };
}

export class CampaignPlanPreviewService {
  constructor(private opportunityQueue: OpportunityQueue) {}

  /**
   * Generate preview for an opportunity
   * Shows all required information and how campaigns will be set up
   */
  async previewOpportunity(
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
      pixelId?: string;
    }
  ): Promise<CampaignPlanPreview> {
    // Load opportunity
    const opportunity = await this.opportunityQueue.getById(opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    // Generate blueprint (preview only, don't save)
    const blueprint = await this.generateBlueprintPreview(opportunity, blueprintConfig);

    // Generate campaign plan (preview only)
    const campaignPlan = await this.generateCampaignPlanPreview(
      blueprint,
      opportunity,
      blueprintConfig
    );

    // Generate "what will be created" preview
    const willCreate = this.generateWillCreatePreview(campaignPlan, blueprintConfig);

    // Check required information
    const requiredInfo = this.checkRequiredInfo(opportunity, blueprintConfig, campaignPlan);

    return {
      opportunity,
      blueprint,
      campaignPlan,
      willCreate,
      requiredInfo,
    };
  }

  /**
   * Generate blueprint preview (doesn't save to database)
   */
  private async generateBlueprintPreview(
    opportunity: Opportunity,
    config: { category: string }
  ): Promise<CampaignBlueprint> {
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
        geo_locations: { countries: ['US'] },
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
   * Generate campaign plan preview
   */
  private async generateCampaignPlanPreview(
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
      pixelId?: string;
    }
  ): Promise<CampaignPlanPreview['campaignPlan']> {
    // Generate hookSetId
    const hookSetId = `hookset_${opportunity.angle.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}`;

    // Generate campaign name
    const campaignName = generateCampaignName({
      brand: config.brand,
      objective: 'CONVERSIONS',
      hookSetId,
      market: 'US',
      channel: 'FB',
      date: new Date().toISOString().split('T')[0],
    });

    // Generate ad sets
    const adSets: CampaignPlanPreview['campaignPlan']['adSets'] = [];
    const adSetNames: string[] = [];
    const strategisCampaignNames: string[] = [];

    // ASC ad set
    if (blueprint.lane_mix && blueprint.lane_mix.asc > 0) {
      const adSetName = generateAdSetName({
        audienceKey: 'asc',
        placementKey: 'advplus_all_auto',
        optimizationEvent: 'PURCHASE',
        budgetType: 'CBO',
        version: 1,
      });
      adSetNames.push(adSetName);
      strategisCampaignNames.push(generateStrategisCampaignName(campaignName, adSetName));

      adSets.push({
        name: adSetName,
        audienceKey: 'asc',
        placementKey: 'advplus_all_auto',
        optimizationEvent: 'PURCHASE',
        budgetType: 'CBO',
        version: 1,
        targeting: blueprint.targeting || {},
        promotedObject: config.pixelId ? {
          pixelId: config.pixelId,
          customEventType: 'PURCHASE',
        } : undefined,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      });
    }

    // LAL ad set
    if (blueprint.lane_mix && blueprint.lane_mix.lal > 0) {
      const adSetName = generateAdSetName({
        audienceKey: 'll_2p_purchasers_180',
        placementKey: 'advplus_all_auto',
        optimizationEvent: 'PURCHASE',
        budgetType: 'CBO',
        version: 1,
      });
      adSetNames.push(adSetName);
      strategisCampaignNames.push(generateStrategisCampaignName(campaignName, adSetName));

      adSets.push({
        name: adSetName,
        audienceKey: 'll_2p_purchasers_180',
        placementKey: 'advplus_all_auto',
        optimizationEvent: 'PURCHASE',
        budgetType: 'CBO',
        version: 1,
        targeting: blueprint.targeting || {},
        promotedObject: config.pixelId ? {
          pixelId: config.pixelId,
          customEventType: 'PURCHASE',
        } : undefined,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      });
    }

    return {
      brand: config.brand,
      objective: 'CONVERSIONS',
      hookSetId,
      market: 'US',
      channel: 'FB',
      date: new Date().toISOString().split('T')[0],
      category: config.brand,
      adAccountId: config.adAccountId,
      organization: config.organization,
      domain: config.domain,
      destination: config.destination,
      strategisTemplateId: config.strategisTemplateId,
      article: config.article,
      fbPage: config.fbPage,
      campaignName,
      adSetNames,
      strategisCampaignNames,
      adSets,
    };
  }

  /**
   * Generate "what will be created" preview
   */
  private generateWillCreatePreview(
    campaignPlan: CampaignPlanPreview['campaignPlan'],
    config: { strategisTemplateId: string }
  ): CampaignPlanPreview['willCreate'] {
    const isCBO = campaignPlan.adSets[0]?.budgetType === 'CBO';
    const dailyBudget = isCBO ? campaignPlan.adSets[0]?.dailyBudget : undefined;

    return {
      facebookCampaign: {
        name: campaignPlan.campaignName,
        objective: campaignPlan.objective,
        status: 'PAUSED',
        isCBO,
        dailyBudget,
      },
      facebookAdSets: campaignPlan.adSets.map(adSet => ({
        name: adSet.name,
        optimizationGoal: this.mapOptimizationGoal(adSet.optimizationEvent),
        billingEvent: 'IMPRESSIONS',
        targeting: adSet.targeting,
        status: 'PAUSED',
      })),
      strategisCampaigns: campaignPlan.adSets.map((adSet, index) => ({
        name: campaignPlan.strategisCampaignNames[index],
        category: campaignPlan.category,
        properties: {
          buyer: campaignPlan.brand,
          networkName: 'facebook',
          networkAccountId: campaignPlan.adAccountId,
          destination: campaignPlan.destination,
          domain: campaignPlan.domain,
          article: campaignPlan.article,
          fbPage: campaignPlan.fbPage,
          fbAdAccount: campaignPlan.adAccountId.replace('act_', ''),
        },
        trackingUrl: `https://r.strateg.is/route?campaignId=<strategis-id>&fbclid={{fbclid}}`,
      })),
    };
  }

  /**
   * Check required information
   */
  private checkRequiredInfo(
    opportunity: Opportunity,
    config: Record<string, any>,
    campaignPlan: CampaignPlanPreview['campaignPlan']
  ): CampaignPlanPreview['requiredInfo'] {
    const required: string[] = [];
    const missing: string[] = [];

    // Opportunity requirements
    if (!opportunity.angle) missing.push('opportunity.angle');
    else required.push('opportunity.angle');

    if (!opportunity.category) missing.push('opportunity.category');
    else required.push('opportunity.category');

    // Config requirements
    const configRequired = [
      'brand',
      'adAccountId',
      'organization',
      'domain',
      'destination',
      'strategisTemplateId',
      'category',
    ];

    for (const field of configRequired) {
      if (!config[field]) {
        missing.push(`config.${field}`);
      } else {
        required.push(`config.${field}`);
      }
    }

    // Campaign plan requirements
    if (!campaignPlan.campaignName) missing.push('campaignPlan.campaignName');
    else required.push('campaignPlan.campaignName');

    if (campaignPlan.adSets.length === 0) {
      missing.push('campaignPlan.adSets (at least one ad set required)');
    } else {
      required.push(`campaignPlan.adSets (${campaignPlan.adSets.length} ad sets)`);
    }

    // Pixel requirements (for conversions)
    if (campaignPlan.objective === 'CONVERSIONS') {
      const hasPixel = campaignPlan.adSets.some(adSet => adSet.promotedObject?.pixelId);
      if (!hasPixel) {
        missing.push('pixelId (required for CONVERSIONS objective)');
      } else {
        required.push('pixelId');
      }
    }

    return {
      hasAllRequired: missing.length === 0,
      missing,
      present: required,
    };
  }

  private mapOptimizationGoal(event: string): string {
    const mapping: Record<string, string> = {
      'PURCHASE': 'OFFSITE_CONVERSIONS',
      'LEAD_GENERATION': 'LEAD_GENERATION',
      'LINK_CLICKS': 'LINK_CLICKS',
    };
    return mapping[event] || 'OFFSITE_CONVERSIONS';
  }
}

