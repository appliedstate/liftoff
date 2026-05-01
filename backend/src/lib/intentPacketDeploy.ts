import { createStrategisApiClient } from './strategistClient';
import { IntentPacket, IntentPacketInput, generateIntentPacket } from './intentPacket';
import {
  buildIntentPacketRampArticlePlan,
  buildStrategisRampProperties,
  extractArticleSlug,
  IntentPacketRampArticleConfig,
  IntentPacketRampArticleExecution,
  IntentPacketRampArticlePlan,
  submitIntentPacketRampArticle,
} from './system1Ramp';

export type IntentPacketDeployMode =
  | 'packet_new_campaign'
  | 'existing_campaign_shell_insert'
  | 'new_campaign_shell_clone';

export type IntentPacketCreativeMode = 'link' | 'video_url' | 'shell';

export type IntentPacketDeployConfig = IntentPacketRampArticleConfig & {
  organization: string;
  buyer: string;
  sourceBuyer?: string | null;
  category: string;
  adAccountId: string;
  domain: string;
  destination: string;
  strategisTemplateId: string;
  fbPage?: string | null;
  rsocSite?: string | null;
  routeBaseUrl?: string | null;
  articleSlug?: string | null;
  dailyBudgetMinor?: number | null;
  objective?: string | null;
  optimizationGoal?: string | null;
  billingEvent?: string | null;
  bidStrategy?: string | null;
  status?: 'PAUSED' | 'ACTIVE';
  market?: string | null;
  creativeMode?: IntentPacketCreativeMode | null;
  publicVideoUrl?: string | null;
  creativeVideoId?: string | null;
  adVariantIndex?: number | null;
  linkDescription?: string | null;
  facebookCampaignId?: string | null;
  strategisCampaignId?: string | null;
  shell?: Record<string, any> | null;
  deployMode?: IntentPacketDeployMode | null;
  targeting?: Record<string, any> | null;
  promotedObject?: {
    pixel_id: string;
    custom_event_type: string;
  } | null;
  extraStrategisProperties?: Record<string, any> | null;
};

export type IntentPacketDeployPreview = {
  packet: IntentPacket;
  deployMode: IntentPacketDeployMode;
  creativeMode: IntentPacketCreativeMode;
  articleGeneration: IntentPacketRampArticlePlan;
  readyForLiveDeploy: boolean;
  blockers: string[];
  slackContract: {
    canonicalRecord: string;
    bindingRule: string;
    requiredInputsByMode: Record<IntentPacketDeployMode, string[]>;
    variableRules: string[];
    deploymentScenarios: string[];
  };
  strategis: {
    schemaEndpoint: string;
    templateEndpoint: string;
    getCampaignEndpoint: string;
    updateCampaignEndpoint: string;
    keywordLinkEndpoints: string[];
    createCampaignRequest: Record<string, any> | null;
    postCreateUpdateRequest: Record<string, any> | null;
  };
  facebook: {
    campaignRequest: Record<string, any> | null;
    adSetRequest: Record<string, any> | null;
    creativeRequest: Record<string, any> | null;
    adRequest: Record<string, any> | null;
  };
  shellContract: {
    mode: IntentPacketDeployMode;
    requiredIds: string[];
    notes: string[];
  };
};

export type IntentPacketDeployExecutionResult = {
  preview: IntentPacketDeployPreview;
  executionMode: 'live';
  articleGeneration: IntentPacketRampArticleExecution;
  created: {
    strategisCampaign: { id: string; name: string };
    facebookCampaign: { id: string; name: string };
    facebookAdSet: { id: string; name: string };
    facebookCreative: { id: string };
    facebookAd: { id: string; name: string };
  };
  routeUrl: string;
  template: {
    id: string;
    found: boolean;
  };
};

function titleCase(input: string): string {
  return String(input || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeAdAccountId(adAccountId: string): string {
  const clean = String(adAccountId || '').trim();
  if (!clean) return '';
  return clean.startsWith('act_') ? clean : `act_${clean}`;
}

function stripActPrefix(adAccountId: string): string {
  return normalizeAdAccountId(adAccountId).replace(/^act_/, '');
}

function buildDefaultTargeting(packet: IntentPacket, targeting?: Record<string, any> | null): Record<string, any> {
  const base: Record<string, any> = {
    geo_locations: { countries: [packet.market || 'US'] },
    age_min: packet.vertical === 'health' ? 25 : 21,
    age_max: 65,
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'story', 'reels'],
    instagram_positions: ['feed', 'story', 'reels'],
  };
  return Object.assign(base, targeting || {});
}

function buildRouteUrl(strategisCampaignId: string, routeBaseUrl?: string | null): string {
  if (routeBaseUrl && /^https?:\/\//i.test(routeBaseUrl)) {
    const separator = routeBaseUrl.includes('?') ? '&' : '?';
    return `${routeBaseUrl}${separator}campaignId=${encodeURIComponent(strategisCampaignId)}&fbclid={{fbclid}}`;
  }
  return `https://r.strateg.is/route?campaignId=${encodeURIComponent(strategisCampaignId)}&fbclid={{fbclid}}`;
}

function buildStrategisCampaignName(packet: IntentPacket, config: IntentPacketDeployConfig): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${packet.slug}_${date}_${String(config.buyer || packet.buyer || 'packet')}`;
}

function buildBoundFacebookCampaignName(strategisCampaignId: string, packet: IntentPacket): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${strategisCampaignId}_${packet.slug}_fb_${date}`;
}

function buildAdSetName(packet: IntentPacket): string {
  return `${packet.slug} | packet_shell | LINK_CLICKS | ABO | v1`;
}

function buildAdName(packet: IntentPacket, adIndex: number, creativeMode: IntentPacketCreativeMode): string {
  const mode = creativeMode === 'video_url' ? 'VIDEO' : 'LINK';
  return `${mode} | ${packet.slug} | variant_${adIndex + 1} | packet`;
}

function buildDescription(packet: IntentPacket, config: IntentPacketDeployConfig): string {
  return String(config.linkDescription || packet.article.summary || '').trim().slice(0, 255);
}

function getSelectedAd(packet: IntentPacket, adVariantIndex?: number | null) {
  const index = Math.max(0, Math.min(packet.ads.length - 1, Number(adVariantIndex || 0)));
  return { index, ad: packet.ads[index] };
}

export function buildIntentPacketDeployPreview(
  packetInput: IntentPacketInput,
  deployConfig: IntentPacketDeployConfig
): IntentPacketDeployPreview {
  const packet = generateIntentPacket(packetInput);
  const deployMode: IntentPacketDeployMode = deployConfig.deployMode || 'packet_new_campaign';
  const creativeMode: IntentPacketCreativeMode = deployConfig.creativeMode || 'link';
  const articleGeneration = buildIntentPacketRampArticlePlan(packet, deployConfig);
  const normalizedAdAccountId = normalizeAdAccountId(deployConfig.adAccountId);
  const strippedAdAccountId = stripActPrefix(deployConfig.adAccountId);
  const { index: adIndex, ad } = getSelectedAd(packet, deployConfig.adVariantIndex);
  const dailyBudgetMinor = Number(
    deployConfig.dailyBudgetMinor ??
      Math.max(100, Math.round((packet.launchTest.recommendedDailyBudget || 100) * 100))
  );

  const blockers: string[] = [];
  const addRequired = (field: string, value: any) => {
    if (value === undefined || value === null || String(value).trim() === '') blockers.push(`${field} is required`);
  };

  addRequired('organization', deployConfig.organization);
  addRequired('buyer', deployConfig.buyer);
  addRequired('category', deployConfig.category);
  addRequired('adAccountId', deployConfig.adAccountId);
  addRequired('domain', deployConfig.domain);
  addRequired('destination', deployConfig.destination);
  addRequired('strategisTemplateId', deployConfig.strategisTemplateId);

  if (deployMode === 'packet_new_campaign' && creativeMode === 'link' && !deployConfig.fbPage) {
    blockers.push('fbPage is required for live link creative creation');
  }
  if (creativeMode === 'video_url' && !deployConfig.publicVideoUrl && !deployConfig.creativeVideoId) {
    blockers.push('publicVideoUrl or creativeVideoId is required for video creative mode');
  }
  if (deployMode === 'existing_campaign_shell_insert' && !deployConfig.facebookCampaignId) {
    blockers.push('facebookCampaignId is required for existing campaign shell insert');
  }
  if (deployMode === 'new_campaign_shell_clone') {
    if (!deployConfig.facebookCampaignId) blockers.push('facebookCampaignId is required for shell clone mode');
    if (!deployConfig.strategisCampaignId) blockers.push('strategisCampaignId is required for shell clone mode');
  }
  if (deployMode !== 'packet_new_campaign' && !deployConfig.shell) {
    blockers.push('shell is required for shell-based deployment modes');
  }
  if (deployMode !== 'packet_new_campaign') {
    blockers.push('Shell-based live deploy is not implemented yet in this repo; use deploy-preview for shape validation only');
  }
  if (creativeMode === 'video_url' && !deployConfig.creativeVideoId) {
    blockers.push('Video URL deploy is preview-only right now because Strategis relay expects a Meta video_id, not a raw public video URL');
  }
  blockers.push(...articleGeneration.blockers);

  const strategisName = buildStrategisCampaignName(packet, deployConfig);
  const placeholderStrategisId = deployConfig.strategisCampaignId || '<strategis-id>';
  const routeUrl = buildRouteUrl(placeholderStrategisId, deployConfig.routeBaseUrl);
  const fbCampaignName = buildBoundFacebookCampaignName(placeholderStrategisId, packet);
  const adSetName = buildAdSetName(packet);
  const adName = buildAdName(packet, adIndex, creativeMode);
  const description = buildDescription(packet, deployConfig);
  const targeting = buildDefaultTargeting(packet, deployConfig.targeting);

  const strategisProperties = {
    buyer: deployConfig.buyer,
    sourceBuyer: deployConfig.sourceBuyer || packet.buyer || null,
    networkName: 'facebook',
    networkAccountId: strippedAdAccountId,
    destination: deployConfig.destination,
    domain: deployConfig.domain,
    article: packet.article.title,
    articleSlug: deployConfig.articleSlug || packet.slug,
    rsocSite: deployConfig.rsocSite || packet.rsocSite,
    fbPage: deployConfig.fbPage || null,
    fbAdAccount: strippedAdAccountId,
    widgetKeywords: packet.article.widgetKeywordPhrases,
    intentPacketId: packet.id,
    intentPacketName: packet.packetName,
    ...buildStrategisRampProperties({
      plan: articleGeneration,
      quotaBefore: null,
      submission: null,
      acceptedPrompt: null,
      finalPrompt: null,
    }),
    ...Object(deployConfig.extraStrategisProperties || {}),
  };

  const createCampaignRequest =
    deployMode === 'packet_new_campaign'
      ? {
          name: strategisName,
          category: deployConfig.category,
          template: { id: deployConfig.strategisTemplateId },
          properties: strategisProperties,
          organizations: [deployConfig.organization],
        }
      : null;

  const postCreateUpdateRequest =
    deployMode === 'packet_new_campaign'
      ? {
          name: strategisName,
          category: deployConfig.category,
          template: { id: deployConfig.strategisTemplateId },
          properties: {
            ...strategisProperties,
            fbCampaignId: '<facebook-campaign-id>',
            fbAdSetId: '<facebook-adset-id>',
            fbAdId: '<facebook-ad-id>',
            fbCreativeId: '<facebook-creative-id>',
          },
          organizations: [deployConfig.organization],
        }
      : null;

  const campaignRequest =
    deployMode === 'packet_new_campaign'
      ? {
          organization: deployConfig.organization,
          adAccountId: normalizedAdAccountId,
          clientRequestKey: `packet-campaign-${packet.id}`,
          name: fbCampaignName,
          objective: deployConfig.objective || 'TRAFFIC',
          status: deployConfig.status || 'PAUSED',
          special_ad_categories: [],
          buying_type: 'AUCTION',
          daily_budget: dailyBudgetMinor,
          lifetime_budget: 0,
        }
      : null;

  const adSetRequest =
    deployMode === 'packet_new_campaign'
      ? {
          organization: deployConfig.organization,
          adAccountId: normalizedAdAccountId,
          clientRequestKey: `packet-adset-${packet.id}`,
          campaign_id: '<facebook-campaign-id>',
          name: adSetName,
          optimization_goal: deployConfig.optimizationGoal || 'LINK_CLICKS',
          billing_event: deployConfig.billingEvent || 'IMPRESSIONS',
          status: deployConfig.status || 'PAUSED',
          daily_budget: dailyBudgetMinor,
          lifetime_budget: 0,
          bid_strategy: deployConfig.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
          targeting,
          promoted_object: deployConfig.promotedObject || undefined,
        }
      : null;

  const creativeRequest =
    deployMode === 'packet_new_campaign'
      ? creativeMode === 'link'
        ? {
            organization: deployConfig.organization,
            adAccountId: normalizedAdAccountId,
            clientRequestKey: `packet-creative-${packet.id}`,
            name: `${packet.slug}_creative_${adIndex + 1}`,
            object_story_spec: {
              page_id: deployConfig.fbPage,
              link_data: {
                message: ad.primaryText,
                name: ad.headline,
                description,
                link: routeUrl,
                call_to_action: {
                  type: ad.cta || 'LEARN_MORE',
                  value: { link: routeUrl },
                },
              },
            },
          }
        : {
            organization: deployConfig.organization,
            adAccountId: normalizedAdAccountId,
            clientRequestKey: `packet-creative-${packet.id}`,
            name: `${packet.slug}_creative_${adIndex + 1}`,
            public_video_url: deployConfig.publicVideoUrl || null,
            object_story_spec: {
              page_id: deployConfig.fbPage,
              video_data: {
                message: ad.primaryText,
                title: ad.headline,
                description,
                video_id: deployConfig.creativeVideoId || '<video-id-required>',
                call_to_action: {
                  type: ad.cta || 'LEARN_MORE',
                  value: { link: routeUrl },
                },
              },
            },
          }
      : null;

  const adRequest =
    deployMode === 'packet_new_campaign'
      ? {
          organization: deployConfig.organization,
          adAccountId: normalizedAdAccountId,
          clientRequestKey: `packet-ad-${packet.id}`,
          adset_id: '<facebook-adset-id>',
          name: adName,
          creative: { creative_id: '<facebook-creative-id>' },
          status: deployConfig.status || 'PAUSED',
        }
      : null;

  return {
    packet,
    deployMode,
    creativeMode,
    articleGeneration,
    readyForLiveDeploy: blockers.length === 0,
    blockers,
    slackContract: {
      canonicalRecord: 'Strategis remains the canonical record; the ad tool orchestrates launch but should not become a second source of truth.',
      bindingRule: 'The Facebook campaign name must start with the Strategis campaign ID before the first underscore or Strategis report linking breaks.',
      requiredInputsByMode: {
        packet_new_campaign: [
          'organization',
          'buyer (deploy buyer, e.g. Edge)',
          'category',
          'strategisTemplateId',
          'adAccountId',
          'fbPage',
          'destination',
          'domain',
        ],
        existing_campaign_shell_insert: [
          'facebookCampaignId',
          'modified shell',
          'public video URL or resolved creative/video id',
        ],
        new_campaign_shell_clone: [
          'facebookCampaignId',
          'strategisCampaignId',
          'modified shell',
          'public video URL or resolved creative/video id',
        ],
      },
      variableRules: [
        'Template swaps are separate from campaign duplication; fetch the desired template instead of mutating a stale template object in place.',
        'Keyword families are separate operations via /api/link and /api/unlink, not part of the main campaign update payload.',
        'Template compatibility depends on rsocSite and networkName; the tool should validate those before live launch.',
        'fbAdAccount is a reference property only; the campaign-name Strategis-ID prefix is the actual report-binding key.',
        'Deploy buyer can differ from the packet/source buyer; preserve both so launch routing can go through the Edge buyer without losing source attribution.',
      ],
      deploymentScenarios: [
        'New stuff: Strategis campaign + one Facebook campaign + one ad group/ad set + one ad.',
        'Existing stuff: inject a new ad into an existing Facebook shell campaign or create a new ad group from an existing shell.',
      ],
    },
    strategis: {
      schemaEndpoint: `/api/schemas/campaign?organization=${encodeURIComponent(deployConfig.organization)}&cached=true`,
      templateEndpoint: `/api/templates/${encodeURIComponent(deployConfig.strategisTemplateId)}`,
      getCampaignEndpoint: deployConfig.strategisCampaignId
        ? `/api/campaigns/${encodeURIComponent(deployConfig.strategisCampaignId)}`
        : '/api/campaigns/{id}',
      updateCampaignEndpoint: deployConfig.strategisCampaignId
        ? `/api/campaigns/${encodeURIComponent(deployConfig.strategisCampaignId)}`
        : '/api/campaigns/{id}',
      keywordLinkEndpoints: ['/api/link', '/api/unlink'],
      createCampaignRequest,
      postCreateUpdateRequest,
    },
    facebook: {
      campaignRequest,
      adSetRequest,
      creativeRequest,
      adRequest,
    },
    shellContract: {
      mode: deployMode,
      requiredIds:
        deployMode === 'existing_campaign_shell_insert'
          ? ['facebookCampaignId']
          : deployMode === 'new_campaign_shell_clone'
            ? ['facebookCampaignId', 'strategisCampaignId']
            : [],
      notes:
        deployMode === 'packet_new_campaign'
          ? [
              'This repo can create a net-new packet launch by creating the Strategis campaign first, then binding the Facebook campaign name to that Strategis ID prefix.',
              'For packet-based launch we collapse to one Facebook campaign, one ad set, and one selected ad variant until shell cloning is fully implemented.',
            ]
          : [
              'Shell modes require the backend to fetch the Facebook shell, return it in Facebook-shaped JSON, and then accept the fully modified shell back.',
              'Those modes are preview-only right now; the deploy route will not execute them yet.',
            ],
    },
  };
}

export async function deployIntentPacketLive(
  packetInput: IntentPacketInput,
  deployConfig: IntentPacketDeployConfig
): Promise<IntentPacketDeployExecutionResult> {
  const preview = buildIntentPacketDeployPreview(packetInput, deployConfig);
  if (preview.deployMode !== 'packet_new_campaign') {
    throw new Error('Only packet_new_campaign live deploy is implemented in this repo right now');
  }
  if (preview.blockers.length) {
    throw new Error(`Live deploy blocked: ${preview.blockers.join('; ')}`);
  }

  const client = createStrategisApiClient();
  const createRequest = preview.strategis.createCampaignRequest;
  const updateRequestTemplate = preview.strategis.postCreateUpdateRequest;
  const campaignRequest = preview.facebook.campaignRequest;
  const adSetRequest = preview.facebook.adSetRequest;
  const creativeRequest = preview.facebook.creativeRequest;
  const adRequest = preview.facebook.adRequest;

  if (!createRequest || !updateRequestTemplate || !campaignRequest || !adSetRequest || !creativeRequest || !adRequest) {
    throw new Error('Deploy preview did not produce the required Strategis/Facebook payloads');
  }

  const template = await client.get(`/api/templates/${encodeURIComponent(deployConfig.strategisTemplateId)}`);
  if (!template || !String((template as any)?.id || '').trim()) {
    throw new Error(`Strategis template ${deployConfig.strategisTemplateId} was not found`);
  }

  const articleGeneration = await submitIntentPacketRampArticle(preview.packet, deployConfig);
  const articleProperties = buildStrategisRampProperties(articleGeneration);
  const liveArticleSlug =
    deployConfig.articleSlug ||
    extractArticleSlug(articleGeneration.finalPrompt?.publication_link || articleGeneration.acceptedPrompt?.publication_link) ||
    preview.packet.slug;

  const liveCreateRequest = {
    ...createRequest,
    properties: {
      ...(createRequest.properties || {}),
      ...articleProperties,
      articleSlug: liveArticleSlug,
    },
  };

  const strategisCampaign = await client.request<any>({
    method: 'POST',
    url: '/api/campaigns',
    data: liveCreateRequest,
  });
  const strategisCampaignRecord = strategisCampaign.data || {};
  const strategisCampaignId = String(strategisCampaignRecord.id || '').trim();
  if (!strategisCampaignId) {
    throw new Error('Strategis campaign creation succeeded without returning an id');
  }

  const routeUrl = buildRouteUrl(strategisCampaignId, deployConfig.routeBaseUrl);

  const liveCampaignRequest = {
    ...campaignRequest,
    name: buildBoundFacebookCampaignName(strategisCampaignId, preview.packet),
  };
  const liveCreativeRequest =
    preview.creativeMode === 'link'
      ? {
          ...creativeRequest,
          object_story_spec: {
            ...(creativeRequest.object_story_spec || {}),
            link_data: {
              ...(creativeRequest.object_story_spec?.link_data || {}),
              link: routeUrl,
              call_to_action: {
                type:
                  creativeRequest.object_story_spec?.link_data?.call_to_action?.type || 'LEARN_MORE',
                value: { link: routeUrl },
              },
            },
          },
        }
      : creativeRequest;

  const fbCampaignResp = await client.request<any>({
    method: 'POST',
    url: '/api/facebook/campaigns/create',
    data: liveCampaignRequest,
  });
  const fbCampaign = fbCampaignResp.data || {};
  const fbCampaignId = String(fbCampaign.id || '').trim();
  if (!fbCampaignId) {
    throw new Error('Facebook campaign creation succeeded without returning an id');
  }

  const liveAdSetRequest = {
    ...adSetRequest,
    campaign_id: fbCampaignId,
  };
  const fbAdSetResp = await client.request<any>({
    method: 'POST',
    url: '/api/facebook/adsets/create',
    data: liveAdSetRequest,
  });
  const fbAdSet = fbAdSetResp.data || {};
  const fbAdSetId = String(fbAdSet.id || '').trim();
  if (!fbAdSetId) {
    throw new Error('Facebook ad set creation succeeded without returning an id');
  }

  const fbCreativeResp = await client.request<any>({
    method: 'POST',
    url: '/api/facebook/adcreatives/create',
    data: liveCreativeRequest,
  });
  const fbCreative = fbCreativeResp.data || {};
  const fbCreativeId = String(fbCreative.id || '').trim();
  if (!fbCreativeId) {
    throw new Error('Facebook creative creation succeeded without returning an id');
  }

  const liveAdRequest = {
    ...adRequest,
    adset_id: fbAdSetId,
    creative: { creative_id: fbCreativeId },
  };
  const fbAdResp = await client.request<any>({
    method: 'POST',
    url: '/api/facebook/ads/create',
    data: liveAdRequest,
  });
  const fbAd = fbAdResp.data || {};
  const fbAdId = String(fbAd.id || '').trim();
  if (!fbAdId) {
    throw new Error('Facebook ad creation succeeded without returning an id');
  }

  const liveUpdateRequest = {
    ...updateRequestTemplate,
    properties: {
      ...(updateRequestTemplate.properties || {}),
      ...articleProperties,
      articleSlug: liveArticleSlug,
      fbCampaignId,
      fbAdSetId,
      fbAdId,
      fbCreativeId,
      fbAdAccount: stripActPrefix(deployConfig.adAccountId),
    },
  };
  await client.request({
    method: 'POST',
    url: `/api/campaigns/${encodeURIComponent(strategisCampaignId)}`,
    data: liveUpdateRequest,
  });

  return {
    preview: buildIntentPacketDeployPreview(packetInput, {
      ...deployConfig,
      strategisCampaignId,
      articleSlug: liveArticleSlug,
    }),
    executionMode: 'live',
    articleGeneration,
    created: {
      strategisCampaign: {
        id: strategisCampaignId,
        name: String(strategisCampaignRecord.name || (liveCreateRequest as any).name || ''),
      },
      facebookCampaign: {
        id: fbCampaignId,
        name: String(fbCampaign.name || liveCampaignRequest.name),
      },
      facebookAdSet: {
        id: fbAdSetId,
        name: String(fbAdSet.name || (liveAdSetRequest as any).name || ''),
      },
      facebookCreative: {
        id: fbCreativeId,
      },
      facebookAd: {
        id: fbAdId,
        name: String(fbAd.name || (liveAdRequest as any).name || ''),
      },
    },
    routeUrl,
    template: {
      id: deployConfig.strategisTemplateId,
      found: true,
    },
  };
}
