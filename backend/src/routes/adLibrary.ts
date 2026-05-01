import { Router } from 'express';
import axios from 'axios';
import { extractRows } from '../lib/strategisApi';
import { StrategistClient } from '../lib/strategistClient';
import {
  fetchStrategisCampaign,
  renderIntendedDestinationUrl,
  type StrategisCampaignRecord,
} from '../lib/strategisCampaignResolver';
import { transcribeVideoUrl } from '../lib/videoTranscription';
import {
  articleToEvaluationInput,
  extractArticleFromUrl,
  type ExtractedArticle,
} from '../lib/articleExtractor';
import {
  evaluateGoogleRsocCompliance,
  type GoogleRsocComplianceResult,
} from '../lib/googleRsocPolicy';
import { mapRsocSiteToS1GoogleAccount } from '../lib/rsocSiteMapping';

type SortField = 'cost' | 'leads' | 'clicks' | 'impressions' | 'ctr' | 'cpa' | 'cpc' | 'cpm' | 'updated';
type SortOrder = 'asc' | 'desc';
type MediaType = 'video' | 'image' | 'carousel' | 'unknown';

type AuthConfig = {
  organization: string;
  apiBaseUrl?: string;
  ixIdBaseUrl?: string;
  authToken?: string;
  email?: string;
  password?: string;
};

type ExportAdRecord = {
  adId: string;
  adName: string | null;
  adStatus: string | null;
  adEffectiveStatus: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  callToActionType: string | null;
  creativeId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  campaignStatus: string | null;
  campaignEffectiveStatus: string | null;
  adSetId: string | null;
  adSetName: string | null;
  adSetStatus: string | null;
  adSetEffectiveStatus: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  carouselTexts: string[];
  linkUrl: string | null;
  mediaType: MediaType;
  previewImageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  assetUrls: string[];
  carouselAssetUrls: string[];
  creative: any;
  rawAd: any;
};

type AggregatedPerformance = {
  entityId: string;
  buyer: string | null;
  category: string | null;
  domain: string | null;
  rsocSite: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  cost: number | null;
  leads: number | null;
  conversions: number | null;
  clicks: number | null;
  impressions: number | null;
  reach: number | null;
  ctr: number | null;
  cpa: number | null;
  cpc: number | null;
  cpm: number | null;
  rawRows: any[];
};

type LibraryCard = {
  adId: string;
  creativeId: string | null;
  status: string;
  buyer: string | null;
  category: string | null;
  domain: string | null;
  rsocSite: string | null;
  isRunning: boolean;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  campaign: {
    id: string | null;
    name: string | null;
    status: string | null;
    effectiveStatus: string | null;
  };
  adSet: {
    id: string | null;
    name: string | null;
    status: string | null;
    effectiveStatus: string | null;
  };
  ad: {
    id: string;
    name: string | null;
    status: string | null;
    effectiveStatus: string | null;
    createdTime: string | null;
    updatedTime: string | null;
  };
  creative: {
    id: string | null;
    mediaType: MediaType;
    primaryText: string | null;
    headline: string | null;
    description: string | null;
    callToAction: string | null;
    linkUrl: string | null;
    previewImageUrl: string | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    downloadUrl: string | null;
    assetUrls: string[];
    carouselAssetUrls: string[];
    carouselTexts: string[];
  };
  copy: {
    primaryText: string | null;
    headline: string | null;
    description: string | null;
    callToAction: string | null;
    linkUrl: string | null;
    carouselTexts: string[];
    urlTags: string | null;
    allText: string[];
  };
  destination: {
    strategisCampaignId: string | null;
    routeUrl: string | null;
    intendedUrl: string | null;
    templateId: string | null;
    templateValue: string | null;
    redirectProtected: boolean;
    resolutionStatus: 'resolved_from_campaign' | 'missing_campaign' | 'campaign_lookup_failed';
  };
  landingPage: {
    status:
      | 'not_requested'
      | 'ready'
      | 'missing_destination'
      | 'fetch_failed';
    url: string | null;
    title: string | null;
    h1: string | null;
    metaDescription: string | null;
    pageSummary: string | null;
    widgetSummary: string | null;
    articleText: string | null;
    rsocWidget: {
      keywordPhrases: string[];
      keywordSource: 'dom_widget' | 'url_forcekeys' | 'both' | 'none' | null;
      domKeywordPhrases: string[];
      urlParamKeywordPhrases: string[];
      keywordCount: number;
      widgetTexts: string[];
      firstWidgetPosition: 'above_fold' | 'below_fold' | 'not_found' | null;
      contentBeforeFirstWidget: number | null;
      widgetInterruptsContent: boolean | null;
      monetizationFlow: string;
      monetizationExplanation: string;
    };
    referrerProof: {
      isArbitrage: boolean | null;
      hasReferrerProof: boolean | null;
      status: 'ok' | 'missing_proof' | 'not_required' | null;
    };
    error: string | null;
  };
  googleRsocCompliance: {
    status:
      | 'not_requested'
      | 'ready'
      | 'missing_landing_page'
      | 'failed';
    result: GoogleRsocComplianceResult | null;
    error: string | null;
  };
  transcript: {
    status:
      | 'not_requested'
      | 'ready'
      | 'blocked_missing_video_source'
      | 'blocked_missing_openai_key'
      | 'failed';
    text: string | null;
    sourceUrl: string | null;
    error: string | null;
  };
  metrics: {
    cost: number | null;
    leads: number | null;
    conversions: number | null;
    clicks: number | null;
    impressions: number | null;
    reach: number | null;
    ctr: number | null;
    cpa: number | null;
    cpc: number | null;
    cpm: number | null;
  };
  raw?: {
    creative: any;
    performanceRows: any[];
  };
};

type LandingPageSnapshot = {
  status: 'ready';
  url: string;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  pageSummary: string;
  widgetSummary: string;
  articleText: string | null;
  rsocWidget: {
    keywordPhrases: string[];
    keywordSource: 'dom_widget' | 'url_forcekeys' | 'both' | 'none';
    domKeywordPhrases: string[];
    urlParamKeywordPhrases: string[];
    keywordCount: number;
    widgetTexts: string[];
    firstWidgetPosition: 'above_fold' | 'below_fold' | 'not_found';
    contentBeforeFirstWidget: number;
    widgetInterruptsContent: boolean;
    monetizationFlow: string;
    monetizationExplanation: string;
  };
  referrerProof: {
    isArbitrage: boolean;
    hasReferrerProof: boolean;
    status: 'ok' | 'missing_proof' | 'not_required';
  };
};

const DEFAULT_ORGANIZATION = process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
const DEFAULT_API_BASE_URL = process.env.STRATEGIS_API_BASE_URL || 'https://strategis.lincx.in';
const DEFAULT_AUTH_BASE_URL = process.env.STRATEGIS_AUTH_BASE_URL || process.env.IX_ID_BASE_URL || 'https://ix-id.lincx.la';
const DEFAULT_PERFORMANCE_WINDOW_DAYS = Number(process.env.AD_LIBRARY_DEFAULT_DAYS || '30');
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const FACEBOOK_AD_FIELDS = [
  'id',
  'name',
  'status',
  'effective_status',
  'created_time',
  'updated_time',
  'campaign{id,name,status,effective_status}',
  'adset{id,name,status,effective_status}',
  'creative{id,name,title,body,image_hash,video_id,thumbnail_url,object_story_spec,asset_feed_spec,url_tags}',
].join(',');
const ALLOWED_DOWNLOAD_HOST_PATTERNS = [
  /\.fbcdn\.net$/i,
  /\.cdninstagram\.com$/i,
  /\.fbsbx\.com$/i,
  /(^|\.)facebook\.com$/i,
];

const router = Router();
const MONETIZATION_FLOW = 'article -> rsoc_widget -> google_serp -> advertiser_click';
const MONETIZATION_EXPLANATION =
  'Users read the destination article, click one of the RSOC related-search keyword phrases, land on a Google SERP, and revenue happens when they click an advertiser there.';

function toSingle(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  const raw = String(toSingle(value) ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'y'].includes(raw)) return true;
  if (['0', 'false', 'no', 'n'].includes(raw)) return false;
  return fallback;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = parseNumber(value);
  if (parsed === null) return fallback;
  return Math.trunc(parsed);
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw.length > 0 ? raw : null;
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );
}

function clampLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

function defaultDateRange(): { dateStart: string; dateEnd: string } {
  const end = new Date();
  const start = new Date(end.getTime() - (DEFAULT_PERFORMANCE_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
  return {
    dateStart: start.toISOString().slice(0, 10),
    dateEnd: end.toISOString().slice(0, 10),
  };
}

function splitCsv(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  const values = input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function pickString(record: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(record: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const value = parseNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function sumNullable(parts: Array<number | null | undefined>): number | null {
  let total = 0;
  let found = false;
  for (const part of parts) {
    if (part === null || part === undefined) continue;
    total += part;
    found = true;
  }
  return found ? total : null;
}

function isRunningStatus(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => String(value || '').toUpperCase() === 'ACTIVE');
}

function detectMediaType(creative: any): MediaType {
  const spec = creative?.object_story_spec || {};
  const hasCarousel = asArray<any>(spec?.link_data?.child_attachments).length > 0;
  const hasVideo = Boolean(spec?.video_data?.video_id || creative?.video_id || asArray<any>(creative?.assets?.videos).length > 0);
  const hasImage = Boolean(
    spec?.link_data?.image_url ||
      spec?.link_data?.picture ||
      spec?.video_data?.image_url ||
      creative?.thumbnail_url ||
      asArray<any>(creative?.assets?.images).length > 0
  );

  if (hasCarousel) return 'carousel';
  if (hasVideo) return 'video';
  if (hasImage) return 'image';
  return 'unknown';
}

function creativeLinkUrl(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  const linkData = spec?.link_data || {};
  const videoData = spec?.video_data || {};
  const templateData = spec?.template_data || {};
  return (
    asString(linkData?.call_to_action?.value?.link) ||
    asString(videoData?.call_to_action?.value?.link) ||
    asString(templateData?.call_to_action?.value?.link) ||
    asString(linkData?.link) ||
    asString(videoData?.link) ||
    asString(templateData?.link)
  );
}

function creativePrimaryText(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    asString(creative?.body) ||
    asString(spec?.video_data?.message) ||
    asString(spec?.link_data?.message) ||
    asString(spec?.template_data?.message)
  );
}

function creativeHeadline(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    asString(creative?.title) ||
    asString(spec?.video_data?.title) ||
    asString(spec?.link_data?.name) ||
    asString(spec?.template_data?.name)
  );
}

function creativeDescription(creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return asString(spec?.link_data?.description) || asString(spec?.template_data?.description);
}

function creativeCarouselTexts(creative: any): string[] {
  const attachments = asArray<any>(creative?.object_story_spec?.link_data?.child_attachments);
  return attachments.flatMap((attachment) =>
    uniqueStrings([attachment?.name, attachment?.description, attachment?.caption])
  );
}

function creativeCallToActionType(ad: any, creative: any): string | null {
  const spec = creative?.object_story_spec || {};
  return (
    asString(ad?.call_to_action_type) ||
    asString(spec?.video_data?.call_to_action?.type) ||
    asString(spec?.link_data?.call_to_action?.type) ||
    asString(spec?.template_data?.call_to_action?.type)
  );
}

function assetUrlsFromCreative(creative: any): {
  previewImageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  assetUrls: string[];
  carouselAssetUrls: string[];
} {
  const assets = creative?.assets || {};
  const spec = creative?.object_story_spec || {};
  const linkData = spec?.link_data || {};
  const videoData = spec?.video_data || {};
  const images = asArray<any>(assets.images);
  const videos = asArray<any>(assets.videos);
  const childAttachments = asArray<any>(linkData?.child_attachments);

  const previewImageUrl =
    asString(linkData?.image_url) ||
    asString(linkData?.picture) ||
    asString(videoData?.image_url) ||
    asString(creative?.thumbnail_url) ||
    asString(images[0]?.url) ||
    asString(videos[0]?.thumbnailUrl) ||
    asString(childAttachments[0]?.image_url) ||
    asString(childAttachments[0]?.picture);

  const videoUrl = asString(videos[0]?.url);
  const videoThumbnailUrl = asString(videos[0]?.thumbnailUrl) || asString(videoData?.image_url);
  const carouselAssetUrls = uniqueStrings(
    childAttachments.flatMap((attachment) => [attachment?.image_url, attachment?.picture])
  );

  return {
    previewImageUrl,
    videoUrl,
    videoThumbnailUrl: videoThumbnailUrl || asString(creative?.thumbnail_url),
    assetUrls: uniqueStrings([
      ...images.map((item) => item?.url),
      ...videos.flatMap((item) => [item?.url, item?.thumbnailUrl]),
      linkData?.image_url,
      linkData?.picture,
      videoData?.image_url,
      creative?.thumbnail_url,
      ...carouselAssetUrls,
    ]),
    carouselAssetUrls,
  };
}

function normalizeApiAds(rows: any[]): ExportAdRecord[] {
  return rows.flatMap((ad) => {
    const creative = ad?.creative || {};
    const assetInfo = assetUrlsFromCreative(creative);
    const adId = asString(ad?.id);
    if (!adId) return [];

    return [
      {
        adId,
        adName: asString(ad?.name),
        adStatus: asString(ad?.status),
        adEffectiveStatus: asString(ad?.effective_status),
        createdTime: asString(ad?.created_time),
        updatedTime: asString(ad?.updated_time),
        callToActionType: creativeCallToActionType(ad, creative),
        creativeId: asString(creative?.id),
        campaignId: asString(ad?.campaign?.id),
        campaignName: asString(ad?.campaign?.name),
        campaignStatus: asString(ad?.campaign?.status),
        campaignEffectiveStatus: asString(ad?.campaign?.effective_status),
        adSetId: asString(ad?.adset?.id),
        adSetName: asString(ad?.adset?.name),
        adSetStatus: asString(ad?.adset?.status),
        adSetEffectiveStatus: asString(ad?.adset?.effective_status),
        primaryText: creativePrimaryText(creative),
        headline: creativeHeadline(creative),
        description: creativeDescription(creative),
        carouselTexts: creativeCarouselTexts(creative),
        linkUrl: creativeLinkUrl(creative),
        mediaType: detectMediaType(creative),
        previewImageUrl: assetInfo.previewImageUrl,
        videoUrl: assetInfo.videoUrl,
        videoThumbnailUrl: assetInfo.videoThumbnailUrl,
        assetUrls: assetInfo.assetUrls,
        carouselAssetUrls: assetInfo.carouselAssetUrls,
        creative,
        rawAd: ad,
      },
    ];
  });
}

function extractActionMetric(row: Record<string, any>, actionTypes: string[]): number | null {
  const sources = [row.actions, row.action_values];
  let total = 0;
  let found = false;

  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const action of source) {
        const actionType = asString(action?.action_type);
        if (!actionType || !actionTypes.includes(actionType)) continue;
        const value = parseNumber(action?.value);
        if (value === null) continue;
        total += value;
        found = true;
      }
      continue;
    }

    if (typeof source === 'object') {
      for (const actionType of actionTypes) {
        const value = parseNumber(source[actionType]);
        if (value === null) continue;
        total += value;
        found = true;
      }
    }
  }

  return found ? total : null;
}

function leadCountFromRow(row: Record<string, any>): number | null {
  const direct = pickNumber(row, [
    'leads',
    'lead',
    'results',
    'result',
    'conversions',
    'purchases',
  ]);
  if (direct !== null) return direct;

  return extractActionMetric(row, [
    'lead',
    'omni_lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
    'submit_application',
    'contact',
  ]);
}

function conversionsFromRow(row: Record<string, any>): number | null {
  const direct = pickNumber(row, ['conversions', 'results', 'result']);
  if (direct !== null) return direct;

  return extractActionMetric(row, [
    'purchase',
    'lead',
    'omni_purchase',
    'omni_lead',
    'offsite_conversion.fb_pixel_purchase',
    'offsite_conversion.fb_pixel_lead',
  ]);
}

function aggregatePerformanceRows(rows: any[], keySelectors: string[]): Map<string, AggregatedPerformance> {
  const byEntityId = new Map<string, AggregatedPerformance>();

  for (const row of rows) {
    const entityId = pickString(row, keySelectors);
    if (!entityId) continue;

    const existing =
      byEntityId.get(entityId) ||
      {
        entityId,
        buyer: null,
        category: null,
        domain: null,
        rsocSite: null,
        dateStart: null,
        dateEnd: null,
        cost: null,
        leads: null,
        conversions: null,
        clicks: null,
        impressions: null,
        reach: null,
        ctr: null,
        cpa: null,
        cpc: null,
        cpm: null,
        rawRows: [],
      };

    const rowDate = pickString(row, ['date', 'date_start', 'dateStart']);
    if (rowDate && (!existing.dateStart || rowDate < existing.dateStart)) existing.dateStart = rowDate;
    if (rowDate && (!existing.dateEnd || rowDate > existing.dateEnd)) existing.dateEnd = rowDate;

    existing.buyer = pickString(row, ['buyer', 'owner']) || existing.buyer;
    existing.category = pickString(row, ['category']) || existing.category;
    existing.domain = pickString(row, ['domain']) || existing.domain;
    existing.rsocSite = pickString(row, ['rsocSite', 'rsoc_site']) || existing.rsocSite;
    existing.cost = sumNullable([existing.cost, pickNumber(row, ['spend', 'cost', 'spend_usd'])]);
    existing.leads = sumNullable([existing.leads, leadCountFromRow(row)]);
    existing.conversions = sumNullable([existing.conversions, conversionsFromRow(row)]);
    existing.clicks = sumNullable([existing.clicks, pickNumber(row, ['clicks'])]);
    existing.impressions = sumNullable([existing.impressions, pickNumber(row, ['impressions'])]);
    existing.reach = sumNullable([existing.reach, pickNumber(row, ['reach'])]);
    existing.rawRows.push(row);

    byEntityId.set(entityId, existing);
  }

  for (const perf of Array.from(byEntityId.values())) {
    const leads = perf.leads || perf.conversions || null;
    perf.ctr = perf.impressions && perf.clicks !== null ? (perf.clicks / perf.impressions) * 100 : null;
    perf.cpc = perf.clicks && perf.cost !== null ? perf.cost / perf.clicks : null;
    perf.cpa = leads && perf.cost !== null ? perf.cost / leads : null;
    perf.cpm = perf.impressions && perf.cost !== null ? (perf.cost / perf.impressions) * 1000 : null;
  }

  return byEntityId;
}

function compareNullable(left: number | string | null | undefined, right: number | string | null | undefined): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : -1;
  if (right === null || right === undefined) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function buildDownloadUrl(videoUrl: string | null): string | null {
  if (!videoUrl) return null;
  return `/api/ad-library/download?url=${encodeURIComponent(videoUrl)}`;
}

function compactText(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );
}

function strategisCampaignIdFromPerformance(perf: AggregatedPerformance | undefined): string | null {
  if (!perf) return null;
  const first = perf.rawRows[0] || {};
  return pickString(first, ['strategisCampaignId', 'campaignId']);
}

function buildCard(ad: ExportAdRecord, perf: AggregatedPerformance | undefined): LibraryCard {
  const isRunning = ad.adEffectiveStatus
    ? isRunningStatus(ad.adEffectiveStatus)
    : ad.adStatus
      ? isRunningStatus(ad.adStatus)
      : isRunningStatus(ad.campaignEffectiveStatus, ad.adSetEffectiveStatus, ad.adEffectiveStatus);
  const effectiveStatus = ad.adEffectiveStatus || ad.adStatus || (isRunning ? 'ACTIVE' : 'UNKNOWN');

  return {
    adId: ad.adId,
    creativeId: ad.creativeId,
    status: effectiveStatus,
    buyer: perf?.buyer || null,
    category: perf?.category || null,
    domain: perf?.domain || null,
    rsocSite: perf?.rsocSite || null,
    isRunning,
    dateRange: {
      start: perf?.dateStart || null,
      end: perf?.dateEnd || null,
    },
    campaign: {
      id: ad.campaignId,
      name: ad.campaignName,
      status: ad.campaignStatus,
      effectiveStatus: ad.campaignEffectiveStatus,
    },
    adSet: {
      id: ad.adSetId,
      name: ad.adSetName,
      status: ad.adSetStatus,
      effectiveStatus: ad.adSetEffectiveStatus,
    },
    ad: {
      id: ad.adId,
      name: ad.adName,
      status: ad.adStatus,
      effectiveStatus: ad.adEffectiveStatus,
      createdTime: ad.createdTime,
      updatedTime: ad.updatedTime,
    },
    creative: {
      id: ad.creativeId,
      mediaType: ad.mediaType,
      primaryText: ad.primaryText,
      headline: ad.headline,
      description: ad.description,
      callToAction: ad.callToActionType,
      linkUrl: ad.linkUrl,
      previewImageUrl: ad.previewImageUrl,
      thumbnailUrl: ad.videoThumbnailUrl || ad.previewImageUrl,
      videoUrl: ad.videoUrl,
      downloadUrl: buildDownloadUrl(ad.videoUrl || ad.previewImageUrl),
      assetUrls: ad.assetUrls,
      carouselAssetUrls: ad.carouselAssetUrls,
      carouselTexts: ad.carouselTexts,
    },
    copy: {
      primaryText: ad.primaryText,
      headline: ad.headline,
      description: ad.description,
      callToAction: ad.callToActionType,
      linkUrl: ad.linkUrl,
      carouselTexts: ad.carouselTexts,
      urlTags: asString(ad.creative?.url_tags),
      allText: compactText([
        ad.primaryText,
        ad.headline,
        ad.description,
        ad.callToActionType,
        ad.linkUrl,
        asString(ad.creative?.url_tags),
        ...ad.carouselTexts,
      ]),
    },
    destination: {
      strategisCampaignId: strategisCampaignIdFromPerformance(perf),
      routeUrl: ad.linkUrl,
      intendedUrl: null,
      templateId: null,
      templateValue: null,
      redirectProtected: Boolean(ad.linkUrl && /\/route\?/i.test(ad.linkUrl)),
      resolutionStatus: 'missing_campaign',
    },
    landingPage: {
      status: 'not_requested',
      url: null,
      title: null,
      h1: null,
      metaDescription: null,
      pageSummary: null,
      widgetSummary: null,
      articleText: null,
      rsocWidget: {
        keywordPhrases: [],
        keywordSource: null,
        domKeywordPhrases: [],
        urlParamKeywordPhrases: [],
        keywordCount: 0,
        widgetTexts: [],
        firstWidgetPosition: null,
        contentBeforeFirstWidget: null,
        widgetInterruptsContent: null,
        monetizationFlow: MONETIZATION_FLOW,
        monetizationExplanation: MONETIZATION_EXPLANATION,
      },
      referrerProof: {
        isArbitrage: null,
        hasReferrerProof: null,
        status: null,
      },
      error: null,
    },
    googleRsocCompliance: {
      status: 'not_requested',
      result: null,
      error: null,
    },
    transcript: {
      status: 'not_requested',
      text: null,
      sourceUrl: ad.videoUrl,
      error: null,
    },
    metrics: {
      cost: perf?.cost || null,
      leads: perf?.leads || null,
      conversions: perf?.conversions || null,
      clicks: perf?.clicks || null,
      impressions: perf?.impressions || null,
      reach: perf?.reach || null,
      ctr: perf?.ctr || null,
      cpa: perf?.cpa || null,
      cpc: perf?.cpc || null,
      cpm: perf?.cpm || null,
    },
  };
}

class InternalAdLibraryClient {
  private readonly apiBaseUrl: string;
  private readonly strategistClient: StrategistClient | null;
  private readonly authToken: string | null;
  private readonly organization: string;
  private readonly campaignCache = new Map<string, Promise<StrategisCampaignRecord>>();
  private readonly landingPageCache = new Map<string, Promise<LandingPageSnapshot>>();

  constructor(config: AuthConfig) {
    this.organization = config.organization;
    this.apiBaseUrl = config.apiBaseUrl || DEFAULT_API_BASE_URL;
    this.authToken = config.authToken || null;
    this.strategistClient = this.authToken
      ? null
      : new StrategistClient({
          apiBaseUrl: this.apiBaseUrl,
          ixIdBaseUrl: config.ixIdBaseUrl || DEFAULT_AUTH_BASE_URL,
          email: config.email,
          password: config.password,
        });
  }

  async fetchAds(params: { adAccountId?: string }): Promise<any[]> {
    const query: Record<string, any> = {
      organization: this.organization,
      fields: FACEBOOK_AD_FIELDS,
    };
    if (params.adAccountId) query.adAccountId = params.adAccountId;

    if (this.authToken) {
      const response = await axios.get(`${this.apiBaseUrl.replace(/\/$/, '')}/api/facebook/ads`, {
        params: query,
        timeout: 180000,
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });
      return extractRows(response.data);
    }

    if (!this.strategistClient) {
      throw new Error('Missing Strategis client for ad library ad lookup');
    }

    const payload = await this.strategistClient.get('/api/facebook/ads', query);
    return extractRows(payload);
  }

  async fetchPerformance(params: {
    organization: string;
    adAccountId?: string;
    dateStart: string;
    dateEnd: string;
    cached: boolean;
  }): Promise<any[]> {
    const query: Record<string, any> = {
      organization: params.organization,
      dateStart: params.dateStart,
      dateEnd: params.dateEnd,
      adSource: 'rsoc',
      networkName: 'facebook',
      level: 'campaign',
      dimensions: 'campaignId',
      cached: params.cached ? 1 : 0,
      dbSource: 'ch',
    };
    if (params.adAccountId) query.adAccountId = params.adAccountId;

    if (this.authToken) {
      const response = await axios.get(`${this.apiBaseUrl.replace(/\/$/, '')}/api/facebook/report`, {
        params: query,
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });
      return extractRows(response.data);
    }

    if (!this.strategistClient) {
      throw new Error('Missing Strategis client for ad library performance lookup');
    }

    const payload = await this.strategistClient.get('/api/facebook/report', query);
    return extractRows(payload);
  }

  async fetchCampaign(campaignId: string): Promise<StrategisCampaignRecord> {
    if (!this.campaignCache.has(campaignId)) {
      this.campaignCache.set(
        campaignId,
        fetchStrategisCampaign(campaignId, {
          apiBaseUrl: this.apiBaseUrl,
          authToken: this.authToken,
          strategistClient: this.strategistClient,
        })
      );
    }
    return this.campaignCache.get(campaignId)!;
  }

  async fetchLandingPage(url: string, includeArticleText: boolean): Promise<LandingPageSnapshot> {
    const cacheKey = `${url}::${includeArticleText ? 'full' : 'summary'}`;
    if (!this.landingPageCache.has(cacheKey)) {
      this.landingPageCache.set(cacheKey, this.loadLandingPage(url, includeArticleText));
    }
    return this.landingPageCache.get(cacheKey)!;
  }

  private async loadLandingPage(url: string, includeArticleText: boolean): Promise<LandingPageSnapshot> {
    const article = await extractArticleFromUrl(url, { timeoutMs: 45000 });
    return articleToLandingPageSnapshot(article, includeArticleText);
  }
}

function articleToLandingPageSnapshot(article: ExtractedArticle, includeArticleText: boolean): LandingPageSnapshot {
  const evaluation = articleToEvaluationInput(
    article,
    article.rsocKeywords[0] || article.h1 || article.title || article.url
  );

  return {
    status: 'ready',
    url: article.url,
    title: article.title,
    h1: article.h1,
    metaDescription: article.metaDescription,
    pageSummary: evaluation.pageSummary,
    widgetSummary: evaluation.widgetSummary,
    articleText: includeArticleText ? evaluation.fullArticleText : null,
    rsocWidget: {
      keywordPhrases: article.rsocKeywords || [],
      keywordSource: article.rsocKeywordDetails?.source || 'none',
      domKeywordPhrases: article.rsocKeywordDetails?.domKeywords || [],
      urlParamKeywordPhrases: article.rsocKeywordDetails?.urlParamKeywords || [],
      keywordCount: article.rsocKeywords?.length || 0,
      widgetTexts: article.widgetTexts || [],
      firstWidgetPosition: article.widgetPlacement?.firstWidgetPosition || 'not_found',
      contentBeforeFirstWidget: article.widgetPlacement?.contentBeforeFirstWidget || 0,
      widgetInterruptsContent: Boolean(article.widgetPlacement?.widgetInterruptsContent),
      monetizationFlow: MONETIZATION_FLOW,
      monetizationExplanation: MONETIZATION_EXPLANATION,
    },
    referrerProof: {
      isArbitrage: Boolean(article.referrerProof?.isArbitrage),
      hasReferrerProof: Boolean(article.referrerProof?.hasReferrerProof),
      status: article.referrerProof?.status || 'not_required',
    },
  };
}

function cardMetric(card: LibraryCard, sortBy: SortField): number | string | null {
  switch (sortBy) {
    case 'cost':
      return card.metrics.cost;
    case 'leads':
      return card.metrics.leads;
    case 'clicks':
      return card.metrics.clicks;
    case 'impressions':
      return card.metrics.impressions;
    case 'ctr':
      return card.metrics.ctr;
    case 'cpa':
      return card.metrics.cpa;
    case 'cpc':
      return card.metrics.cpc;
    case 'cpm':
      return card.metrics.cpm;
    case 'updated':
      return card.ad.updatedTime;
    default:
      return card.metrics.cost;
  }
}

function matchesQuery(card: LibraryCard, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    card.ad.name,
    card.campaign.name,
    card.adSet.name,
    card.creative.primaryText,
    card.creative.headline,
    card.creative.description,
    card.buyer,
    card.category,
    card.domain,
    card.rsocSite,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

function matchesCaseInsensitive(value: string | null, expected: string | undefined): boolean {
  if (!expected) return true;
  return String(value || '').toLowerCase() === expected.toLowerCase();
}

function parseSortField(value: string | undefined): SortField {
  const sort = (value || 'cost').toLowerCase();
  if (['cost', 'leads', 'clicks', 'impressions', 'ctr', 'cpa', 'cpc', 'cpm', 'updated'].includes(sort)) {
    return sort as SortField;
  }
  return 'cost';
}

function parseSortOrder(value: string | undefined): SortOrder {
  return (value || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function isAllowedDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return ALLOWED_DOWNLOAD_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

function authConfigFromRequest(req: any): AuthConfig {
  const headers = req.headers || {};
  return {
    organization: toSingle(req.query.organization) || DEFAULT_ORGANIZATION,
    apiBaseUrl: headers['x-strategis-api-base-url'] || process.env.STRATEGIS_API_BASE_URL || DEFAULT_API_BASE_URL,
    ixIdBaseUrl:
      headers['x-strategis-auth-base-url'] ||
      process.env.STRATEGIS_AUTH_BASE_URL ||
      process.env.IX_ID_BASE_URL ||
      DEFAULT_AUTH_BASE_URL,
    authToken: headers['x-strategis-auth-token'] || process.env.STRATEGIS_AUTH_TOKEN || process.env.STRATEGIST_AUTH_TOKEN,
    email: headers['x-strategis-email'] || process.env.STRATEGIS_EMAIL || process.env.IX_ID_EMAIL,
    password: headers['x-strategis-password'] || process.env.STRATEGIS_PASSWORD || process.env.IX_ID_PASSWORD,
  };
}

async function buildCards(req: any): Promise<{
  items: LibraryCard[];
  total: number;
  warnings: string[];
  meta: Record<string, any>;
}> {
  const limit = clampLimit(parseInteger(req.query.limit, DEFAULT_LIMIT));
  const offset = Math.max(0, parseInteger(req.query.offset, 0));
  const sortBy = parseSortField(toSingle(req.query.sortBy));
  const sortOrder = parseSortOrder(toSingle(req.query.sortOrder));
  const includeRaw = parseBoolean(req.query.includeRaw, false);
  const includePerformance = parseBoolean(req.query.includePerformance, true);
  const onlyRunning = parseBoolean(req.query.onlyRunning, true);
  const cached = parseBoolean(req.query.cached, true);
  const includeDestinations = parseBoolean(req.query.includeDestinations, true);
  const includeLandingPage = parseBoolean(req.query.includeLandingPage, false);
  const includeLandingText = parseBoolean(req.query.includeLandingText, false);
  const includeGoogleRsocCompliance = parseBoolean(req.query.includeGoogleRsocCompliance, false);
  const includeTranscript = parseBoolean(req.query.includeTranscript, false);
  const query = toSingle(req.query.q);
  const buyer = toSingle(req.query.buyer);
  const category = toSingle(req.query.category);
  const mediaType = toSingle(req.query.mediaType);
  const { dateStart: defaultStart, dateEnd: defaultEnd } = defaultDateRange();
  const dateStart = toSingle(req.query.dateStart) || defaultStart;
  const dateEnd = toSingle(req.query.dateEnd) || defaultEnd;
  const auth = authConfigFromRequest(req);
  const client = new InternalAdLibraryClient(auth);
  const warnings: string[] = [];
  const singleCampaignId = toSingle(req.query.campaignId);
  const requestedCampaignIds = splitCsv(toSingle(req.query.campaignIds)) || (singleCampaignId ? [singleCampaignId] : undefined);

  const adRows = await client.fetchAds({
    adAccountId: toSingle(req.query.adAccountId) || undefined,
  });
  const normalizedAds = normalizeApiAds(adRows);
  const performanceByCampaignId = new Map<string, AggregatedPerformance>();
  const requestedNetworkCampaignIds = new Set<string>();

  if (includePerformance) {
    try {
      const performanceRows = await client.fetchPerformance({
        organization: auth.organization,
        adAccountId: toSingle(req.query.adAccountId),
        dateStart,
        dateEnd,
        cached,
      });
      for (const [campaignId, perf] of Array.from(
        aggregatePerformanceRows(performanceRows, ['networkCampaignId', 'campaignId', 'id']).entries()
      )) {
        performanceByCampaignId.set(campaignId, perf);
      }

      if (requestedCampaignIds && requestedCampaignIds.length > 0) {
        for (const row of performanceRows) {
          const networkCampaignId = pickString(row, ['networkCampaignId', 'id']);
          const strategisCampaignId = pickString(row, ['strategisCampaignId', 'campaignId']);
          if (!networkCampaignId) continue;
          if (
            requestedCampaignIds.includes(networkCampaignId) ||
            (strategisCampaignId && requestedCampaignIds.includes(strategisCampaignId))
          ) {
            requestedNetworkCampaignIds.add(networkCampaignId);
          }
        }
      }
    } catch (err: any) {
      warnings.push(`Performance lookup failed: ${err?.message || String(err)}`);
    }
  }

  if (requestedCampaignIds && requestedCampaignIds.length > 0 && requestedNetworkCampaignIds.size === 0) {
    for (const campaignId of requestedCampaignIds) {
      requestedNetworkCampaignIds.add(campaignId);
    }
  }

  const filtered = normalizedAds
    .filter((ad) => {
      if (!requestedCampaignIds || requestedCampaignIds.length === 0) return true;
      return ad.campaignId ? requestedNetworkCampaignIds.has(ad.campaignId) : false;
    })
    .map((ad) => {
      const perf = ad.campaignId ? performanceByCampaignId.get(ad.campaignId) : undefined;
      const card = buildCard(ad, perf);
      if (includeRaw) {
        card.raw = {
          creative: ad.creative,
          performanceRows: perf?.rawRows || [],
        };
      }
      return card;
    })
    .filter((card) => (onlyRunning ? card.isRunning : true))
    .filter((card) => (mediaType ? card.creative.mediaType === mediaType : true))
    .filter((card) => matchesCaseInsensitive(card.buyer, buyer))
    .filter((card) => matchesCaseInsensitive(card.category, category))
    .filter((card) => matchesQuery(card, query));

  filtered.sort((left, right) => {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return compareNullable(cardMetric(left, sortBy), cardMetric(right, sortBy)) * direction;
  });

  const items = filtered.slice(offset, offset + limit);

  if (includeDestinations) {
    await Promise.all(
      items.map(async (item) => {
        const strategisCampaignId = item.destination.strategisCampaignId;
        if (!strategisCampaignId) return;
        try {
          const campaign = await client.fetchCampaign(strategisCampaignId);
          item.destination.intendedUrl = renderIntendedDestinationUrl(campaign);
          item.destination.templateId = asString(campaign.template?.id);
          item.destination.templateValue = asString(campaign.template?.value);
          item.destination.resolutionStatus = item.destination.intendedUrl
            ? 'resolved_from_campaign'
            : 'missing_campaign';
          if (campaign.properties?.headline) {
            item.copy.allText = compactText([...item.copy.allText, asString(campaign.properties.headline)]);
          }
        } catch (err: any) {
          item.destination.resolutionStatus = 'campaign_lookup_failed';
          warnings.push(
            `Destination lookup failed for ${strategisCampaignId}: ${err?.message || String(err)}`
          );
        }
      })
    );
  }

  const needLandingPage = includeLandingPage || includeGoogleRsocCompliance;
  const needLandingText = includeLandingText || includeGoogleRsocCompliance;

  if (needLandingPage) {
    await Promise.all(
      items.map(async (item) => {
        const url = item.destination.intendedUrl;
        if (!url) {
          item.landingPage = {
            ...item.landingPage,
            status: 'missing_destination',
            url: null,
            error: 'No resolved destination URL is available for this ad yet.',
          };
          return;
        }
        try {
          const page = await client.fetchLandingPage(url, needLandingText);
          item.landingPage = {
            status: page.status,
            url: page.url,
            title: page.title,
            h1: page.h1,
            metaDescription: page.metaDescription,
            pageSummary: page.pageSummary,
            widgetSummary: page.widgetSummary,
            articleText: page.articleText,
            rsocWidget: page.rsocWidget,
            referrerProof: page.referrerProof,
            error: null,
          };
          item.copy.allText = compactText([
            ...item.copy.allText,
            page.title,
            page.h1,
            page.metaDescription,
            ...page.rsocWidget.keywordPhrases,
          ]);
        } catch (err: any) {
          item.landingPage = {
            ...item.landingPage,
            status: 'fetch_failed',
            url,
            error: err?.message || String(err),
          };
          warnings.push(`Landing-page extraction failed for ${url}: ${err?.message || String(err)}`);
        }
      })
    );
  }

  if (includeGoogleRsocCompliance) {
    for (const item of items) {
      try {
        if (item.landingPage.status !== 'ready') {
          item.googleRsocCompliance = {
            status: 'missing_landing_page',
            result: null,
            error: 'Landing-page extraction is required before Google/RSOC compliance can be evaluated.',
          };
          continue;
        }

        const landingBody =
          item.landingPage.articleText ||
          [
            item.landingPage.title,
            item.landingPage.h1,
            item.landingPage.metaDescription,
            item.landingPage.pageSummary,
            item.landingPage.widgetSummary,
          ]
            .filter(Boolean)
            .join('\n');

        item.googleRsocCompliance = {
          status: 'ready',
          result: evaluateGoogleRsocCompliance({
            primaryText: item.copy.primaryText,
            headline: item.copy.headline,
            description: item.copy.description,
            transcript: item.transcript.text,
            cta: item.copy.callToAction,
            routeUrl: item.destination.routeUrl,
            intendedUrl: item.destination.intendedUrl,
            landingArticleTitle: item.landingPage.title,
            landingArticleSummary: [item.landingPage.pageSummary, item.landingPage.widgetSummary]
              .filter(Boolean)
              .join('\n'),
            landingArticleBody: landingBody,
            landingMetaDescription: item.landingPage.metaDescription,
            rsocKeywords: item.landingPage.rsocWidget.keywordPhrases,
            rsocKeywordSource: item.landingPage.rsocWidget.keywordSource,
            domKeywordPhrases: item.landingPage.rsocWidget.domKeywordPhrases,
            urlParamKeywordPhrases: item.landingPage.rsocWidget.urlParamKeywordPhrases,
            widgetTexts: item.landingPage.rsocWidget.widgetTexts,
            widgetPlacement: {
              firstWidgetPosition: item.landingPage.rsocWidget.firstWidgetPosition,
              contentBeforeFirstWidget: item.landingPage.rsocWidget.contentBeforeFirstWidget,
              widgetInterruptsContent: item.landingPage.rsocWidget.widgetInterruptsContent,
            },
            referrerProof: item.landingPage.referrerProof,
            rsocSite: item.rsocSite,
            s1GoogleAccount: mapRsocSiteToS1GoogleAccount(item.rsocSite),
          }),
          error: null,
        };
      } catch (err: any) {
        item.googleRsocCompliance = {
          status: 'failed',
          result: null,
          error: err?.message || String(err),
        };
        warnings.push(`Google/RSOC compliance evaluation failed for ${item.adId}: ${err?.message || String(err)}`);
      }
    }
  }

  if (includeTranscript) {
    const canTranscribe = Boolean(process.env.OPENAI_API_KEY);
    await Promise.all(
      items.map(async (item) => {
        if (!item.creative.videoUrl) {
          item.transcript = {
            status: canTranscribe ? 'blocked_missing_video_source' : 'blocked_missing_openai_key',
            text: null,
            sourceUrl: null,
            error: canTranscribe ? 'No downloadable video URL is available for this ad yet.' : 'Missing OPENAI_API_KEY',
          };
          return;
        }
        if (!canTranscribe) {
          item.transcript = {
            status: 'blocked_missing_openai_key',
            text: null,
            sourceUrl: item.creative.videoUrl,
            error: 'Missing OPENAI_API_KEY',
          };
          return;
        }
        try {
          const text = await transcribeVideoUrl(item.creative.videoUrl, `${item.adId}.mp4`);
          item.transcript = {
            status: 'ready',
            text,
            sourceUrl: item.creative.videoUrl,
            error: null,
          };
          item.copy.allText = compactText([...item.copy.allText, text]);
        } catch (err: any) {
          item.transcript = {
            status: 'failed',
            text: null,
            sourceUrl: item.creative.videoUrl,
            error: err?.message || String(err),
          };
        }
      })
    );
  }

  return {
    items,
    total: filtered.length,
    warnings,
    meta: {
      organization: auth.organization,
      totalFetchedAds: normalizedAds.length,
      totalMatchedAds: filtered.length,
      performanceWindow: includePerformance ? { dateStart, dateEnd, cached } : null,
      pagination: { limit, offset },
      sorting: { sortBy, sortOrder },
      filters: {
        query: query || null,
        buyer: buyer || null,
        category: category || null,
        mediaType: mediaType || null,
        campaignIds: requestedCampaignIds || null,
        onlyRunning,
        includeDestinations,
        includeLandingPage,
        includeLandingText,
        includeGoogleRsocCompliance,
        includeTranscript,
        includePerformance,
      },
    },
  };
}

router.get('/search', async (req, res) => {
  try {
    const result = await buildCards(req);
    res.json({ ok: true, data: result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to load ad library' });
  }
});

router.get('/ads/:adId', async (req, res) => {
  try {
    const result = await buildCards({
      ...req,
      query: {
        ...req.query,
        includeRaw: toSingle(req.query.includeRaw) || '1',
        includeLandingPage: toSingle(req.query.includeLandingPage) || '1',
        includeGoogleRsocCompliance: toSingle(req.query.includeGoogleRsocCompliance) || '1',
        limit: String(MAX_LIMIT),
        offset: '0',
        onlyRunning: toSingle(req.query.onlyRunning) || '0',
      },
    });
    const ad = result.items.find((item) => item.adId === req.params.adId);
    if (!ad) {
      return res.status(404).json({ ok: false, error: `Ad ${req.params.adId} not found in current export scope` });
    }
    return res.json({ ok: true, data: { item: ad, warnings: result.warnings, meta: result.meta } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to load ad detail' });
  }
});

router.get('/download', async (req, res) => {
  const rawUrl = toSingle(req.query.url);
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'Missing url query parameter' });
  }
  if (!isAllowedDownloadUrl(rawUrl)) {
    return res.status(400).json({ ok: false, error: 'Only Facebook CDN/media URLs are allowed' });
  }

  try {
    const upstream = await axios.get(rawUrl, {
      responseType: 'stream',
      timeout: 120000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'liftoff-ad-library-proxy/1.0',
      },
    });

    const contentType = upstream.headers['content-type'];
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = upstream.headers['content-length'];
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', upstream.headers['cache-control'] || 'public, max-age=3600');

    upstream.data.on('error', (err: any) => {
      if (!res.headersSent) {
        res.status(502).json({ ok: false, error: err?.message || 'Upstream media stream failed' });
      } else {
        res.end();
      }
    });

    upstream.data.pipe(res);
  } catch (err: any) {
    const status = err?.response?.status || 502;
    return res.status(status).json({
      ok: false,
      error: err?.message || 'Failed to proxy ad asset',
    });
  }
});

export default router;
