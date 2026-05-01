import { LincxProxyFacebookClient } from './lincxProxyFacebookClient';

type CreativeMode = 'inherit' | 'image_url' | 'video_url';

export type CloneCreativeInput = {
  organization: string;
  sourceFacebookCampaignId: string;
  sourceCampaignName: string;
  adAccountId: string;
  targetCampaignName: string;
  targetAdName: string;
  destinationUrl: string;
  headline: string;
  primaryText?: string | null;
  description?: string | null;
  callToActionType?: string | null;
  creativeMode: CreativeMode;
  assetUrl?: string | null;
};

export type CloneCreativeResult = {
  facebookCampaign: { id: string; name: string };
  facebookAdSet: { id: string; name: string } | null;
  facebookAd: { id: string; name: string } | null;
  facebookCreative: { id: string };
  source: {
    campaignId: string;
    adId: string | null;
    creativeId: string | null;
  };
  warnings: string[];
};

function asString(value: unknown): string {
  return String(value || '').trim();
}

function pick<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value as T;
  }
  return null;
}

function extractCopiedCampaignId(payload: any): string | null {
  return (
    asString(payload?.copied_campaign_id) ||
    asString(payload?.copiedCampaignId) ||
    asString(payload?.campaign_id) ||
    asString(payload?.campaignId) ||
    asString(payload?.id) ||
    null
  );
}

function creativePrimaryText(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    pick<string>(
      asString(creative?.body),
      asString(spec?.video_data?.message),
      asString(spec?.link_data?.message)
    ) || null
  );
}

function creativeHeadline(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    pick<string>(
      asString(creative?.title),
      asString(spec?.video_data?.title),
      asString(spec?.link_data?.name)
    ) || null
  );
}

function creativeDescription(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    pick<string>(
      asString(spec?.link_data?.description),
      asString(spec?.template_data?.description),
      asString(spec?.video_data?.link_description)
    ) || null
  );
}

function creativeCallToActionType(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    pick<string>(
      asString(spec?.video_data?.call_to_action?.type),
      asString(spec?.link_data?.call_to_action?.type)
    ) || null
  );
}

function buildCreativePayload(
  sourceAd: any,
  input: CloneCreativeInput,
  uploaded: { imageHash?: string | null; videoId?: string | null }
): Record<string, any> {
  const creative = sourceAd?.creative || {};
  const spec = JSON.parse(JSON.stringify(creative?.object_story_spec || {}));
  const primaryText = input.primaryText?.trim() || creativePrimaryText(creative) || '';
  const headline = input.headline.trim() || creativeHeadline(creative) || '';
  const description = input.description?.trim() || creativeDescription(creative) || '';
  const ctaType = input.callToActionType?.trim() || creativeCallToActionType(creative) || 'LEARN_MORE';
  const pageId =
    asString(spec?.page_id) ||
    asString(spec?.video_data?.page_id) ||
    asString(spec?.link_data?.page_id);

  if (spec?.video_data || uploaded.videoId) {
    spec.page_id = pageId || undefined;
    spec.video_data = {
      ...(spec.video_data || {}),
      video_id: uploaded.videoId || spec?.video_data?.video_id || creative?.video_id,
      message: primaryText,
      title: headline,
      image_hash: uploaded.imageHash || spec?.video_data?.image_hash || creative?.image_hash,
      call_to_action: {
        type: ctaType,
        value: { link: input.destinationUrl },
      },
    };
    if (description) {
      spec.video_data.link_description = description;
    }
    delete spec.video_data.image_url;
  } else {
    spec.page_id = pageId || undefined;
    spec.link_data = {
      ...(spec.link_data || {}),
      message: primaryText,
      name: headline,
      description,
      link: input.destinationUrl,
      image_hash: uploaded.imageHash || spec?.link_data?.image_hash || creative?.image_hash,
      call_to_action: {
        type: ctaType,
        value: { link: input.destinationUrl },
      },
    };
    delete spec.link_data.image_url;
  }

  const payload: Record<string, any> = {
    name: `${input.targetCampaignName} | creative`,
    title: headline || undefined,
    body: primaryText || undefined,
    object_story_spec: spec,
  };

  if (creative?.asset_feed_spec) payload.asset_feed_spec = creative.asset_feed_spec;
  if (creative?.url_tags) payload.url_tags = creative.url_tags;
  if (uploaded.imageHash) payload.image_hash = uploaded.imageHash;
  if (uploaded.videoId) payload.video_id = uploaded.videoId;

  return payload;
}

async function findSourceAd(
  client: LincxProxyFacebookClient,
  organization: string,
  adAccountId: string,
  sourceFacebookCampaignId: string
) {
  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'campaign{id,name,status,effective_status}',
    'adset{id,name,status,effective_status}',
    'creative{id,name,title,body,image_hash,video_id,thumbnail_url,object_story_spec,asset_feed_spec,url_tags}',
  ].join(',');

  const ads = await client.listAds({ organization, adAccountId, fields });
  const matched = ads.filter(
    (ad) => asString(ad?.campaign?.id) === sourceFacebookCampaignId
  );
  const preferred =
    matched.find((ad) => asString(ad?.effective_status).toUpperCase() === 'ACTIVE') ||
    matched.find((ad) => asString(ad?.status).toUpperCase() === 'ACTIVE') ||
    matched[0] ||
    null;

  if (!preferred) {
    throw new Error(`No Facebook ads found for source campaign ${sourceFacebookCampaignId}.`);
  }
  return preferred;
}

async function waitForClonedAd(
  client: LincxProxyFacebookClient,
  organization: string,
  adAccountId: string,
  clonedCampaignId: string
) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ads = await client.listAds({
      organization,
      adAccountId,
      fields: [
        'id',
        'name',
        'status',
        'effective_status',
        'campaign{id,name}',
        'adset{id,name,status,effective_status}',
        'creative{id,name,title,body,image_hash,video_id,thumbnail_url,object_story_spec,asset_feed_spec,url_tags}',
      ].join(','),
    });
    const matched = ads.filter((ad) => asString(ad?.campaign?.id) === clonedCampaignId);
    if (matched.length > 0) return matched[0];
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for cloned ads in campaign ${clonedCampaignId}.`);
}

export async function cloneFacebookShellWithCreative(
  client: LincxProxyFacebookClient,
  input: CloneCreativeInput
): Promise<CloneCreativeResult> {
  const sourceAd = await findSourceAd(
    client,
    input.organization,
    input.adAccountId,
    input.sourceFacebookCampaignId
  );

  const warnings: string[] = [];
  const clonePayload = {
    deep_copy: true,
    status_option: 'PAUSED',
  };

  const cloneResponse = await client.cloneCampaign(
    input.organization,
    input.sourceFacebookCampaignId,
    clonePayload
  );
  const clonedCampaignId = extractCopiedCampaignId(cloneResponse);
  if (!clonedCampaignId) {
    throw new Error('Facebook campaign clone succeeded without returning a copied campaign id.');
  }

  await client.updateObject(input.organization, clonedCampaignId, {
    name: input.targetCampaignName,
    status: 'PAUSED',
  });

  const clonedAd = await waitForClonedAd(
    client,
    input.organization,
    input.adAccountId,
    clonedCampaignId
  );

  let imageHash: string | null = null;
  let videoId: string | null = null;
  if (input.creativeMode === 'image_url' && input.assetUrl) {
    const upload = await client.uploadImage(input.organization, input.adAccountId, input.assetUrl);
    imageHash =
      asString(upload?.images?.[Object.keys(upload?.images || {})[0]]?.hash) ||
      asString(upload?.hash) ||
      null;
    if (!imageHash) warnings.push('Image upload completed without returning a hash; source media was preserved.');
  }
  if (input.creativeMode === 'video_url' && input.assetUrl) {
    const upload = await client.uploadVideo(input.organization, input.adAccountId, input.assetUrl);
    videoId = asString(upload?.id) || asString(upload?.video_id) || null;
    if (!videoId) warnings.push('Video upload completed without returning a video id; source media was preserved.');
  }

  const creativePayload = buildCreativePayload(sourceAd, input, { imageHash, videoId });
  const createdCreative = await client.createCreative(
    input.organization,
    input.adAccountId,
    creativePayload
  );
  const creativeId = asString(createdCreative?.id);
  if (!creativeId) {
    throw new Error('Facebook creative creation succeeded without returning an id.');
  }

  await client.updateObject(input.organization, asString(clonedAd.id), {
    creative: { creative_id: creativeId },
    name: input.targetAdName,
    status: 'PAUSED',
  });

  return {
    facebookCampaign: {
      id: clonedCampaignId,
      name: input.targetCampaignName,
    },
    facebookAdSet: clonedAd?.adset?.id
      ? {
          id: asString(clonedAd.adset.id),
          name: asString(clonedAd.adset.name),
        }
      : null,
    facebookAd: clonedAd?.id
      ? {
          id: asString(clonedAd.id),
          name: input.targetAdName,
        }
      : null,
    facebookCreative: {
      id: creativeId,
    },
    source: {
      campaignId: input.sourceFacebookCampaignId,
      adId: asString(sourceAd?.id) || null,
      creativeId: asString(sourceAd?.creative?.id) || null,
    },
    warnings,
  };
}

