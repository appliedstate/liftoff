/**
 * Campaign Factory Service
 * 
 * Orchestrates campaign creation across Strategis and Facebook via Strategis relay.
 * Handles naming conventions, ID storage, and error tracking.
 */

import { generateCampaignName, generateAdSetName, generateStrategisCampaignName } from './namingGenerator';
import { StrategisClient } from './strategisClient';
import { StrategisFacebookClient } from './strategisFacebookClient';
import { getPgPool } from '../lib/pg';
import { randomUUID } from 'crypto';

export interface CampaignPlan {
  // Campaign Metadata
  brand: string;
  objective: string;
  hookSetId: string;
  market: string;
  channel: string;
  date: string; // YYYY-MM-DD
  category: string;
  
  // Account & Organization
  adAccountId: string; // Facebook ad account (act_*)
  organization: string;
  
  // Tracking Configuration
  domain: string;
  destination: string; // "S1" or "Lincx"
  strategisTemplateId?: string;
  article?: string;
  fbPage?: string;
  
  // Ad Sets
  adSets: AdSetPlan[];
}

export interface AdSetPlan {
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
  dailyBudget?: string; // In micros, for ABO
  bidStrategy?: string;
  startTime?: string;
}

export interface CampaignCreationResult {
  requestId: string;
  campaignPlanId: string;
  campaignMappingId: string;
  facebookCampaign: { id: string; name: string };
  facebookAdSets: Array<{ id: string; name: string }>;
  strategisCampaigns: Array<{ id: string; name: string; trackingUrl: string }>;
  mappings: {
    fbCampaignId: string;
    fbAdSetIds: string[];
    strategisCampaignIds: string[];
    trackingUrls: string[];
  };
}

export class CampaignFactory {
  constructor(
    private strategisClient: StrategisClient,
    private strategisFacebookClient: StrategisFacebookClient
  ) {}

  /**
   * Create campaign with Attention Engine naming in both Facebook and Strategis
   */
  async createCampaignWithNaming(plan: CampaignPlan): Promise<CampaignCreationResult> {
    const requestId = randomUUID();
    const pool = getPgPool();
    
    try {
      // 1. Generate names from Attention Engine
      const campaignName = generateCampaignName({
        brand: plan.brand,
        objective: plan.objective,
        hookSetId: plan.hookSetId,
        market: plan.market,
        channel: plan.channel,
        date: plan.date,
      });

      const adSetNames = plan.adSets.map(adSet => 
        generateAdSetName({
          audienceKey: adSet.audienceKey,
          placementKey: adSet.placementKey,
          optimizationEvent: adSet.optimizationEvent,
          budgetType: adSet.budgetType,
          version: adSet.version,
        })
      );

      // 2. Store campaign plan in database
      const planResult = await pool.query(
        `INSERT INTO campaign_plans (
          request_id, brand, objective, hook_set_id, market, channel, date, category,
          ad_account_id, organization, domain, destination, strategis_template_id,
          campaign_name, ad_set_names, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id`,
        [
          requestId,
          plan.brand,
          plan.objective,
          plan.hookSetId,
          plan.market,
          plan.channel,
          plan.date,
          plan.category,
          plan.adAccountId,
          plan.organization,
          plan.domain,
          plan.destination,
          plan.strategisTemplateId || null,
          campaignName,
          adSetNames,
          'creating',
        ]
      );
      const campaignPlanId = planResult.rows[0].id;

      // 3. Create Facebook campaign via Strategis relay
      const fbCampaign = await this.strategisFacebookClient.createCampaign({
        organization: plan.organization,
        adAccountId: plan.adAccountId.replace('act_', ''),
        name: campaignName,
        objective: plan.objective,
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        buying_type: 'AUCTION',
        is_campaign_budget_optimized: plan.adSets[0]?.budgetType === 'CBO',
        daily_budget: plan.adSets[0]?.budgetType === 'CBO' ? plan.adSets[0]?.dailyBudget : undefined,
        clientRequestKey: `campaign-${requestId}`,
      });

      // 4. Create Facebook ad sets via Strategis relay
      const fbAdSets = [];
      for (const [index, adSetPlan] of plan.adSets.entries()) {
        const adSetName = adSetNames[index];
        
        const fbAdSet = await this.strategisFacebookClient.createAdSet({
          organization: plan.organization,
          campaign_id: fbCampaign.id,
          name: adSetName,
          optimization_goal: this.mapOptimizationGoal(adSetPlan.optimizationEvent),
          billing_event: 'IMPRESSIONS',
          targeting: adSetPlan.targeting,
          status: 'PAUSED',
          start_time: adSetPlan.startTime,
          promoted_object: adSetPlan.promotedObject ? {
            pixel_id: adSetPlan.promotedObject.pixelId,
            custom_event_type: adSetPlan.promotedObject.customEventType,
          } : undefined,
          daily_budget: adSetPlan.budgetType === 'ABO' ? adSetPlan.dailyBudget : undefined,
          bid_strategy: adSetPlan.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
          clientRequestKey: `adset-${requestId}-${index}`,
        });

        fbAdSets.push({ id: fbAdSet.id, name: adSetName });
      }

      // 5. Create Strategis tracking campaigns (one per Facebook ad set)
      const strategisCampaigns = [];
      const trackingUrls = [];
      
      for (const [index, fbAdSet] of fbAdSets.entries()) {
        const adSetName = adSetNames[index];
        const strategisCampaignName = generateStrategisCampaignName(campaignName, adSetName);

        const strategisCampaign = await this.strategisClient.createCampaign({
          name: strategisCampaignName,
          category: plan.category,
          template: { id: plan.strategisTemplateId! },
          properties: {
            buyer: plan.brand,
            networkName: 'facebook',
            networkAccountId: plan.adAccountId,
            destination: plan.destination,
            domain: plan.domain,
            article: plan.article,
            fbPage: plan.fbPage,
            fbAdAccount: plan.adAccountId.replace('act_', ''),
            fbCampaignId: fbCampaign.id,
            fbAdSetId: fbAdSet.id,
          },
          organizations: [plan.organization],
        });

        const trackingUrl = `https://r.strateg.is/route?campaignId=${strategisCampaign.id}&fbclid={{fbclid}}`;
        
        strategisCampaigns.push({ 
          id: strategisCampaign.id, 
          name: strategisCampaignName,
          trackingUrl,
        });
        trackingUrls.push(trackingUrl);
      }

      // 6. Store campaign mapping in database
      const mappingResult = await pool.query(
        `INSERT INTO campaign_mappings (
          campaign_plan_id, request_id, strategis_template_id,
          strategis_campaign_ids, facebook_campaign_id, facebook_ad_set_ids,
          tracking_urls, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          campaignPlanId,
          requestId,
          plan.strategisTemplateId || null,
          strategisCampaigns.map(c => c.id),
          fbCampaign.id,
          fbAdSets.map(a => a.id),
          trackingUrls,
          'active',
        ]
      );
      const campaignMappingId = mappingResult.rows[0].id;

      // 7. Update campaign plan status
      await pool.query(
        `UPDATE campaign_plans SET status = $1, updated_at = NOW() WHERE id = $2`,
        ['active', campaignPlanId]
      );

      return {
        requestId,
        campaignPlanId,
        campaignMappingId,
        facebookCampaign: { id: fbCampaign.id, name: campaignName },
        facebookAdSets: fbAdSets,
        strategisCampaigns,
        mappings: {
          fbCampaignId: fbCampaign.id,
          fbAdSetIds: fbAdSets.map(a => a.id),
          strategisCampaignIds: strategisCampaigns.map(c => c.id),
          trackingUrls,
        },
      };
    } catch (error) {
      // Log error to database
      await pool.query(
        `INSERT INTO campaign_errors (campaign_plan_id, request_id, step, error_type, error_message, error_details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          (await pool.query('SELECT id FROM campaign_plans WHERE request_id = $1', [requestId])).rows[0]?.id || null,
          requestId,
          'campaign_creation',
          error instanceof Error ? error.constructor.name : 'UnknownError',
          error instanceof Error ? error.message : String(error),
          { stack: error instanceof Error ? error.stack : undefined },
        ]
      );
      throw error;
    }
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

