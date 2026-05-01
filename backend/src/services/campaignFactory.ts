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
  redirectDomain?: string;
  strategisProperties?: Record<string, any>;
  campaignNameOverride?: string;
  adSetNamesOverride?: string[];
  strategistCampaignNamesOverride?: string[];
  strategisCloneSourceId?: string;
  
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

export interface ShellCreationResult {
  requestId: string;
  campaignName: string;
  adSetNames: string[];
  facebookCampaign?: { id: string; name: string } | null;
  facebookAdSets?: Array<{ id: string; name: string }>;
  strategisCampaigns?: Array<{ id: string; name: string; trackingUrl: string }>;
  mappingStored?: boolean;
  mappingId?: string | null;
  warnings?: string[];
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
      const { campaignName, adSetNames, strategistCampaignNames } = this.resolveNames(plan);

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

      const facebookShell = await this.createFacebookEntities(plan, requestId, campaignName, adSetNames);
      const fbCampaign = facebookShell.facebookCampaign;
      const fbAdSets = facebookShell.facebookAdSets;

      // 5. Create Strategis tracking campaigns (one per Facebook ad set)
      const strategisShell = await this.createStrategisEntities(
        plan,
        requestId,
        campaignName,
        adSetNames,
        strategistCampaignNames,
        {
          facebookCampaignId: fbCampaign.id,
          facebookAdSetIds: fbAdSets.map((item) => item.id),
        }
      );
      const strategisCampaigns = strategisShell.strategisCampaigns;
      const trackingUrls = strategisShell.trackingUrls;

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

  async createStrategisShellOnly(plan: CampaignPlan): Promise<ShellCreationResult> {
    const requestId = randomUUID();
    const { campaignName, adSetNames, strategistCampaignNames } = this.resolveNames(plan);
    const strategisShell = await this.createStrategisEntities(
      plan,
      requestId,
      campaignName,
      adSetNames,
      strategistCampaignNames
    );

    return {
      requestId,
      campaignName,
      adSetNames,
      strategisCampaigns: strategisShell.strategisCampaigns,
      warnings: [],
    };
  }

  async createFacebookShellOnly(plan: CampaignPlan): Promise<ShellCreationResult> {
    const requestId = randomUUID();
    const { campaignName, adSetNames } = this.resolveNames(plan);
    const facebookShell = await this.createFacebookEntities(plan, requestId, campaignName, adSetNames);

    return {
      requestId,
      campaignName,
      adSetNames,
      facebookCampaign: facebookShell.facebookCampaign,
      facebookAdSets: facebookShell.facebookAdSets,
      warnings: [],
    };
  }

  async createShellInBoth(plan: CampaignPlan): Promise<ShellCreationResult> {
    const requestId = randomUUID();
    const warnings: string[] = [];
    const { campaignName, adSetNames, strategistCampaignNames } = this.resolveNames(plan);
    const facebookShell = await this.createFacebookEntities(plan, requestId, campaignName, adSetNames);
    const strategisShell = await this.createStrategisEntities(
      plan,
      requestId,
      campaignName,
      adSetNames,
      strategistCampaignNames,
      {
        facebookCampaignId: facebookShell.facebookCampaign.id,
        facebookAdSetIds: facebookShell.facebookAdSets.map((item) => item.id),
      }
    );

    let mappingStored = false;
    let mappingId: string | null = null;
    try {
      const stored = await this.tryStorePlanAndMapping(plan, requestId, campaignName, adSetNames, {
        facebookCampaignId: facebookShell.facebookCampaign.id,
        facebookAdSetIds: facebookShell.facebookAdSets.map((item) => item.id),
        strategisCampaignIds: strategisShell.strategisCampaigns.map((item) => item.id),
        trackingUrls: strategisShell.trackingUrls,
      });
      mappingStored = stored.mappingStored;
      mappingId = stored.mappingId;
      warnings.push(...stored.warnings);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }

    return {
      requestId,
      campaignName,
      adSetNames,
      facebookCampaign: facebookShell.facebookCampaign,
      facebookAdSets: facebookShell.facebookAdSets,
      strategisCampaigns: strategisShell.strategisCampaigns,
      mappingStored,
      mappingId,
      warnings,
    };
  }

  private resolveNames(plan: CampaignPlan) {
    const campaignName =
      plan.campaignNameOverride ||
      generateCampaignName({
        brand: plan.brand,
        objective: plan.objective,
        hookSetId: plan.hookSetId,
        market: plan.market,
        channel: plan.channel,
        date: plan.date,
      });

    const adSetNames =
      plan.adSetNamesOverride && plan.adSetNamesOverride.length === plan.adSets.length
        ? plan.adSetNamesOverride
        : plan.adSets.map((adSet) =>
            generateAdSetName({
              audienceKey: adSet.audienceKey,
              placementKey: adSet.placementKey,
              optimizationEvent: adSet.optimizationEvent,
              budgetType: adSet.budgetType,
              version: adSet.version,
            })
          );

    const strategistCampaignNames =
      plan.strategistCampaignNamesOverride &&
      plan.strategistCampaignNamesOverride.length === adSetNames.length
        ? plan.strategistCampaignNamesOverride
        : adSetNames.map((adSetName) => generateStrategisCampaignName(campaignName, adSetName));

    return { campaignName, adSetNames, strategistCampaignNames };
  }

  private async createFacebookEntities(
    plan: CampaignPlan,
    requestId: string,
    campaignName: string,
    adSetNames: string[]
  ) {
    const facebookCampaign = await this.strategisFacebookClient.createCampaign({
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

    const facebookAdSets: Array<{ id: string; name: string }> = [];
    for (const [index, adSetPlan] of plan.adSets.entries()) {
      const adSetName = adSetNames[index];
      const fbAdSet = await this.strategisFacebookClient.createAdSet({
        organization: plan.organization,
        campaign_id: facebookCampaign.id,
        name: adSetName,
        optimization_goal: this.mapOptimizationGoal(adSetPlan.optimizationEvent),
        billing_event: 'IMPRESSIONS',
        targeting: adSetPlan.targeting,
        status: 'PAUSED',
        start_time: adSetPlan.startTime,
        promoted_object: adSetPlan.promotedObject
          ? {
              pixel_id: adSetPlan.promotedObject.pixelId,
              custom_event_type: adSetPlan.promotedObject.customEventType,
            }
          : undefined,
        daily_budget: adSetPlan.budgetType === 'ABO' ? adSetPlan.dailyBudget : undefined,
        bid_strategy: adSetPlan.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        clientRequestKey: `adset-${requestId}-${index}`,
      });
      facebookAdSets.push({ id: fbAdSet.id, name: adSetName });
    }

    return { facebookCampaign, facebookAdSets };
  }

  private async createStrategisEntities(
    plan: CampaignPlan,
    requestId: string,
    campaignName: string,
    adSetNames: string[],
    strategistCampaignNames: string[],
    opts: { facebookCampaignId?: string; facebookAdSetIds?: string[] } = {}
  ) {
    const strategisCampaigns: Array<{ id: string; name: string; trackingUrl: string }> = [];
    const trackingUrls: string[] = [];
    const template = plan.strategisTemplateId
      ? await this.strategisClient.getTemplate(plan.strategisTemplateId)
      : null;

    const cloneSourceCampaign = plan.strategisCloneSourceId
      ? await this.strategisClient.getCampaign(plan.strategisCloneSourceId)
      : null;
    const clonedIds = cloneSourceCampaign
      ? await this.strategisClient.createIdenticalCampaigns(
          cloneSourceCampaign,
          strategistCampaignNames.length
        )
      : [];

    if (cloneSourceCampaign && clonedIds.length < strategistCampaignNames.length) {
      throw new Error(
        `Strategis clone returned ${clonedIds.length} copies for ${strategistCampaignNames.length} requested shell campaigns.`
      );
    }

    for (const [index, strategistCampaignName] of strategistCampaignNames.entries()) {
      const facebookAdSetId = opts.facebookAdSetIds?.[index];
      const properties = this.buildStrategisProperties(plan, {
        facebookCampaignId: opts.facebookCampaignId,
        facebookAdSetId,
      });
      const strategisCampaign = cloneSourceCampaign
        ? await this.strategisClient.updateCampaign(clonedIds[index], this.buildStrategisCloneUpdatePayload(
            await this.strategisClient.getCampaign(clonedIds[index]),
            {
              campaignName: strategistCampaignName,
              category: plan.category,
              template: template || cloneSourceCampaign.template,
              organization: plan.organization,
              redirectDomain: plan.redirectDomain,
              properties,
            }
          ))
        : await this.strategisClient.createCampaign({
            name: strategistCampaignName,
            category: plan.category,
            template: template || { id: plan.strategisTemplateId! },
            redirectDomain: plan.redirectDomain,
            properties,
            organizations: [plan.organization],
          });

      const trackingUrl = `https://r.strateg.is/route?campaignId=${strategisCampaign.id}&fbclid={{fbclid}}`;
      strategisCampaigns.push({
        id: strategisCampaign.id,
        name: strategistCampaignName,
        trackingUrl,
      });
      trackingUrls.push(trackingUrl);
    }

    return { strategisCampaigns, trackingUrls };
  }

  private buildStrategisCloneUpdatePayload(
    clonedCampaign: Record<string, any>,
    opts: {
      campaignName: string;
      category: string;
      template: Record<string, any>;
      organization: string;
      redirectDomain?: string;
      properties: Record<string, any>;
    }
  ) {
    const safePropertyKeys = new Set([
      'buyer',
      'networkName',
      'rsocSite',
      'article',
      'forcekeyA',
      'forcekeyB',
      'forcekeyC',
      'forcekeyD',
      'forcekeyE',
      'forcekeyF',
      'forcekeyG',
      'forcekeyH',
      'forcekeyI',
      'forcekeyJ',
      'forcekeyK',
      'forcekeyL',
      'headline',
      'headlines',
      'subdirectory',
      'country',
      'language',
      'fbAdAccount',
      'fbPage',
    ]);

    const nextProperties = {
      ...(clonedCampaign.properties || {}),
    };

    for (const [key, value] of Object.entries(opts.properties || {})) {
      if (!safePropertyKeys.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      nextProperties[key] = value;
    }

    return {
      ...clonedCampaign,
      name: opts.campaignName,
      category: opts.category,
      template: opts.template,
      organizations:
        Array.isArray(clonedCampaign.organizations) && clonedCampaign.organizations.length
          ? clonedCampaign.organizations
          : [opts.organization],
      redirectDomain: opts.redirectDomain || clonedCampaign.redirectDomain,
      properties: nextProperties,
    };
  }

  private buildStrategisProperties(
    plan: CampaignPlan,
    opts: { facebookCampaignId?: string; facebookAdSetId?: string } = {}
  ) {
    const merged: Record<string, any> = {
      buyer: plan.brand,
      networkName: 'facebook',
      networkAccountId: plan.adAccountId,
      destination: plan.destination,
      domain: plan.domain,
      article: plan.article,
      fbPage: plan.fbPage,
      fbAdAccount: plan.adAccountId.replace('act_', ''),
      templateId: plan.strategisTemplateId,
      ...plan.strategisProperties,
    };

    const allowedKeys = new Set([
      'adkey1',
      'adkey2',
      'adkey3',
      'adkey4',
      'article',
      'buyer',
      'buyingModel',
      'compkey',
      'country',
      'destination',
      'domain',
      'eventName',
      'fbAdAccount',
      'fbPage',
      'forcekeyA',
      'forcekeyB',
      'forcekeyC',
      'forcekeyD',
      'forcekeyE',
      'forcekeyF',
      'forcekeyG',
      'forcekeyH',
      'forcekeyI',
      'forcekeyJ',
      'forcekeyK',
      'forcekeyL',
      'headline',
      'headlines',
      'language',
      'nbAdAccount',
      'networkAccountId',
      'networkName',
      'optkey',
      'pushTag',
      'rskey',
      'rsocSite',
      'subdirectory',
      'templateId',
      'zoneId',
    ]);

    return Object.fromEntries(
      Object.entries(merged).filter(([key, value]) => {
        if (!allowedKeys.has(key)) return false;
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && !value.trim()) return false;
        return true;
      })
    );
  }

  private async tryStorePlanAndMapping(
    plan: CampaignPlan,
    requestId: string,
    campaignName: string,
    adSetNames: string[],
    mapping: {
      facebookCampaignId: string;
      facebookAdSetIds: string[];
      strategisCampaignIds: string[];
      trackingUrls: string[];
    }
  ): Promise<{ mappingStored: boolean; mappingId: string | null; warnings: string[] }> {
    const warnings: string[] = [];
    try {
      const pool = getPgPool();
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
          'active',
        ]
      );
      const campaignPlanId = planResult.rows[0].id;
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
          mapping.strategisCampaignIds,
          mapping.facebookCampaignId,
          mapping.facebookAdSetIds,
          mapping.trackingUrls,
          'active',
        ]
      );
      return { mappingStored: true, mappingId: mappingResult.rows[0].id, warnings };
    } catch (error) {
      warnings.push(
        `Created shells, but mapping was not stored: ${error instanceof Error ? error.message : String(error)}`
      );
      return { mappingStored: false, mappingId: null, warnings };
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
