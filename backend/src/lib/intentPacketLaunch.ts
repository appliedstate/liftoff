import { generateAdSetName, generateCampaignName, generateStrategisCampaignName } from '../services/namingGenerator';
import { IntentPacket, IntentPacketInput, generateIntentPacket } from './intentPacket';
import { buildIntentPacketRampArticlePlan, IntentPacketRampArticleConfig, IntentPacketRampArticlePlan } from './system1Ramp';

export type IntentPacketLaunchConfig = IntentPacketRampArticleConfig & {
  brand: string;
  adAccountId: string;
  organization: string;
  domain: string;
  destination: string;
  strategisTemplateId: string;
  sourceBuyer?: string | null;
  fbPage?: string | null;
  pixelId?: string | null;
};

export type IntentPacketArticleDraft = {
  title: string;
  h1: string;
  metaDescription: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  widgetLeadIn: string;
  widgetKeywordPhrases: string[];
};

export type IntentPacketOpportunityDraft = {
  source: 'system1';
  angle: string;
  category: string;
  revenue_potential: number;
  rpc_floor: number;
  confidence_score: number;
  keywords: Array<{ keyword: string; role: 'primary' | 'supporting' }>;
  top_keywords: Array<{ keyword: string; revenue: number; rpc: number }>;
  predicted_delta_cm: number;
  recommended_budget: number;
  recommended_lane_mix: {
    asc: number;
    lal: number;
    interest: number;
  };
  overlap_risk: 'low' | 'medium' | 'high';
  freeze_window_hours: number;
  success_threshold_cpa: number;
  kill_threshold_cpa: number;
  status: 'pending';
};

export type IntentPacketLaunchPreview = {
  packet: IntentPacket;
  opportunity: IntentPacketOpportunityDraft;
  articleDraft: IntentPacketArticleDraft;
  articleGeneration: IntentPacketRampArticlePlan;
  campaignPlan: {
    campaignName: string;
    strategisCampaignNames: string[];
    adSetNames: string[];
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
  willCreate: {
    facebookCampaign: {
      name: string;
      objective: string;
      status: 'PAUSED';
      isCBO: boolean;
      dailyBudget?: string;
    };
    facebookAdSets: Array<{
      name: string;
      optimizationGoal: string;
      billingEvent: 'IMPRESSIONS';
      targeting: Record<string, any>;
      status: 'PAUSED';
    }>;
    strategisCampaigns: Array<{
      name: string;
      category: string;
      properties: Record<string, any>;
      trackingUrl: string;
    }>;
    ads: Array<{
      name: string;
      headline: string;
      primaryText: string;
      cta: string;
      metaBand: string;
    }>;
  };
  launchReadout: {
    firstLookMetrics: string[];
    scaleRule: string;
    killRule: string;
  };
};

function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function verticalToCategory(vertical: IntentPacket['vertical']): string {
  const mapping: Record<IntentPacket['vertical'], string> = {
    health: 'Healthcare',
    finance: 'Finance',
    vehicles: 'Vehicles',
    technology: 'Technology',
    jobs: 'Jobs',
    general: 'General',
  };
  return mapping[vertical];
}

function buildArticleDraft(packet: IntentPacket): IntentPacketArticleDraft {
  const intro = `${packet.article.summary} The goal is to keep the reader inside the same intent packet from the ad promise through the widget click.`;
  const sections = packet.article.outline.map((heading, index) => ({
    heading,
    body:
      index === 0
        ? `Frame the user problem in plain language and connect it directly to ${packet.intent.primaryKeyword}. Avoid claims the page cannot support.`
        : index === packet.article.outline.length - 1
          ? `Show the RSOC widget and direct the user into the highest-intent phrase first: ${packet.article.widgetKeywordPhrases[0]}.`
          : `Compare the available paths around ${packet.intent.primaryKeyword}, keeping the language aligned with the widget phrases and advertiser intent.`,
  }));

  return {
    title: packet.article.title,
    h1: packet.article.h1,
    metaDescription: packet.article.metaDescription,
    intro,
    sections,
    widgetLeadIn: `Use the related searches below to continue with ${packet.article.widgetKeywordPhrases[0]}.`,
    widgetKeywordPhrases: packet.article.widgetKeywordPhrases,
  };
}

function buildOpportunity(packet: IntentPacket): IntentPacketOpportunityDraft {
  const recommendedBudget = Math.max(packet.launchTest.recommendedDailyBudget * 3, 300);
  const confidenceScore = Math.max(1, Math.min(100, Math.round((packet.scores.launchPriority * 0.6) + (packet.scores.evidenceConfidence * 0.4))));
  const overlapRisk =
    packet.scores.metaRiskPenalty >= 25 || packet.scores.googleRiskPenalty >= 20
      ? 'high'
      : packet.scores.launchPriority >= 70
        ? 'low'
        : 'medium';

  return {
    source: 'system1',
    angle: packet.intent.packetHypothesis,
    category: verticalToCategory(packet.vertical),
    revenue_potential: packet.scores.monetizationPotential,
    rpc_floor: Number((packet.scores.keywordCommerciality / 100).toFixed(2)),
    confidence_score: confidenceScore,
    keywords: [
      { keyword: packet.intent.primaryKeyword, role: 'primary' as const },
      ...packet.intent.supportingKeywords.map((keyword) => ({ keyword, role: 'supporting' as const })),
    ],
    top_keywords: [
      { keyword: packet.intent.primaryKeyword, revenue: packet.scores.monetizationPotential, rpc: Number((packet.scores.keywordCommerciality / 100).toFixed(2)) },
      ...packet.intent.supportingKeywords.slice(0, 3).map((keyword) => ({
        keyword,
        revenue: Math.round(packet.scores.monetizationPotential * 0.7),
        rpc: Number((packet.scores.keywordCommerciality / 120).toFixed(2)),
      })),
    ],
    predicted_delta_cm: Number((packet.scores.launchPriority / 100).toFixed(2)),
    recommended_budget: recommendedBudget,
    recommended_lane_mix: packet.scores.metaRiskPenalty >= 25
      ? { asc: 0, lal: 20, interest: 80 }
      : { asc: 40, lal: 20, interest: 40 },
    overlap_risk: overlapRisk,
    freeze_window_hours: 24,
    success_threshold_cpa: Math.max(20, Math.round(100 - packet.scores.launchPriority)),
    kill_threshold_cpa: Math.max(35, Math.round(140 - packet.scores.launchPriority)),
    status: 'pending',
  };
}

function buildCampaignPlan(packet: IntentPacket, config: IntentPacketLaunchConfig, opportunity: IntentPacketOpportunityDraft) {
  const hookSetId = `packet_${packet.slug}_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}`;
  const campaignName = generateCampaignName({
    brand: config.brand,
    objective: config.pixelId ? 'CONVERSIONS' : 'TRAFFIC',
    hookSetId,
    market: packet.market,
    channel: 'FB',
    date: new Date().toISOString().slice(0, 10),
  });

  const lanes = packet.scores.metaRiskPenalty >= 25
    ? [
        { audienceKey: 'interest_stack', placementKey: 'advplus_all_auto', optimizationEvent: config.pixelId ? 'PURCHASE' : 'LINK_CLICKS', budgetType: 'ABO' as const, version: 1, share: 1 },
      ]
    : [
        { audienceKey: 'broad_25_65', placementKey: 'advplus_all_auto', optimizationEvent: config.pixelId ? 'PURCHASE' : 'LINK_CLICKS', budgetType: 'CBO' as const, version: 1, share: 0.65 },
        { audienceKey: 'interest_stack', placementKey: 'advplus_all_auto', optimizationEvent: config.pixelId ? 'PURCHASE' : 'LINK_CLICKS', budgetType: 'ABO' as const, version: 1, share: 0.35 },
      ];

  const adSets = lanes.map((lane) => {
    const name = generateAdSetName({
      audienceKey: lane.audienceKey,
      placementKey: lane.placementKey,
      optimizationEvent: lane.optimizationEvent,
      budgetType: lane.budgetType,
      version: lane.version,
    });
    return {
      name,
      audienceKey: lane.audienceKey,
      placementKey: lane.placementKey,
      optimizationEvent: lane.optimizationEvent,
      budgetType: lane.budgetType,
      version: lane.version,
      targeting: {
        geo_locations: { countries: [packet.market] },
        age_min: packet.vertical === 'health' ? 25 : 21,
        age_max: 65,
      },
      promotedObject: config.pixelId
        ? {
            pixelId: config.pixelId,
            customEventType: 'PURCHASE',
          }
        : undefined,
      dailyBudget: lane.budgetType === 'ABO' ? String(Math.round(opportunity.recommended_budget * lane.share)) : undefined,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    };
  });

  const strategisCampaignNames = adSets.map((adSet) => generateStrategisCampaignName(campaignName, adSet.name));

  return {
    campaignName,
    strategisCampaignNames,
    adSetNames: adSets.map((adSet) => adSet.name),
    adSets,
  };
}

function mapOptimizationGoal(event: string): string {
  const mapping: Record<string, string> = {
    PURCHASE: 'OFFSITE_CONVERSIONS',
    LINK_CLICKS: 'LINK_CLICKS',
  };
  return mapping[event] || 'LINK_CLICKS';
}

export function buildIntentPacketLaunchPreview(
  packetInput: IntentPacketInput,
  launchConfig: IntentPacketLaunchConfig
): IntentPacketLaunchPreview {
  const packet = generateIntentPacket(packetInput);
  const articleDraft = buildArticleDraft(packet);
  const articleGeneration = buildIntentPacketRampArticlePlan(packet, launchConfig);
  const opportunity = buildOpportunity(packet);
  const campaignPlan = buildCampaignPlan(packet, launchConfig, opportunity);

  return {
    packet,
    opportunity,
    articleDraft,
    articleGeneration,
    campaignPlan,
    willCreate: {
      facebookCampaign: {
        name: campaignPlan.campaignName,
        objective: launchConfig.pixelId ? 'CONVERSIONS' : 'TRAFFIC',
        status: 'PAUSED',
        isCBO: campaignPlan.adSets.some((adSet) => adSet.budgetType === 'CBO'),
        dailyBudget: campaignPlan.adSets.find((adSet) => adSet.budgetType === 'CBO')?.dailyBudget,
      },
      facebookAdSets: campaignPlan.adSets.map((adSet) => ({
        name: adSet.name,
        optimizationGoal: mapOptimizationGoal(adSet.optimizationEvent),
        billingEvent: 'IMPRESSIONS' as const,
        targeting: adSet.targeting,
        status: 'PAUSED' as const,
      })),
      strategisCampaigns: campaignPlan.adSets.map((adSet, index) => ({
        name: campaignPlan.strategisCampaignNames[index],
        category: opportunity.category,
        properties: {
          buyer: launchConfig.brand,
          sourceBuyer: launchConfig.sourceBuyer || packet.buyer || null,
          networkName: 'facebook',
          networkAccountId: launchConfig.adAccountId,
          destination: launchConfig.destination,
          domain: launchConfig.domain,
          article: articleDraft.title,
          rampArticleMode: articleGeneration.enabled ? articleGeneration.mode : null,
          rampArticleTopic: articleGeneration.prompt?.topic || null,
          rampMarketingAngle: articleGeneration.prompt?.marketing_angle || null,
          rampArticleTargetLanguage: articleGeneration.prompt?.target_language || null,
          rampArticleTargetGeo: articleGeneration.prompt?.target_geo || null,
          fbPage: launchConfig.fbPage || null,
          fbAdAccount: launchConfig.adAccountId.replace('act_', ''),
          widgetKeywords: articleDraft.widgetKeywordPhrases,
        },
        trackingUrl: `https://r.strateg.is/route?packetId=${packet.id}&campaignId=<strategis-id>&fbclid={{fbclid}}`,
      })),
      ads: packet.ads.map((ad, index) => ({
        name: `${index + 1} | ${titleCase(packet.slug)} | ${ad.angle}`,
        headline: ad.headline,
        primaryText: ad.primaryText,
        cta: ad.cta,
        metaBand: ad.metaRisk.overallBand,
      })),
    },
    launchReadout: {
      firstLookMetrics: [
        'Meta approval / rejection rate',
        'CTR from ad to article',
        'Widget clickthrough rate',
        'Advertiser click rate and RPC',
        'Packet-level spend versus packet-level advertiser revenue',
      ],
      scaleRule: 'Scale only if approval is stable, widget clicks are flowing, and advertiser-click revenue clears packet spend with room for margin.',
      killRule: 'Kill fast if Meta approval fails, CTR is weak, or the packet leaks intent between ad, article, and RSOC click.',
    },
  };
}
