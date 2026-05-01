#!/usr/bin/env ts-node

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { StrategisCampaignExportClient } from '../../lib/strategisCampaignExport';

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

function getFlagBool(name: string, def: boolean = false): boolean {
  const raw = (getFlag(name) ?? (def ? '1' : '0')).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function getFlagInt(name: string): number | undefined {
  const raw = getFlag(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function safeFilePart(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function toArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );
}

function isActiveStatus(...values: Array<string | undefined | null>): boolean {
  return values.some((value) => String(value || '').toUpperCase() === 'ACTIVE');
}

function extFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').pop() || '';
    const dot = filename.lastIndexOf('.');
    if (dot >= 0 && dot < filename.length - 1) {
      const ext = filename.slice(dot + 1).toLowerCase();
      if (/^[a-z0-9]{1,5}$/.test(ext)) return `.${ext}`;
    }
  } catch {}
  return '';
}

async function downloadBinary(url: string, outPath: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, response.data);
}

function assetUrlsFromCreative(creative: any): string[] {
  const assets = creative?.assets || {};
  const spec = creative?.object_story_spec || {};
  const linkData = spec?.link_data || {};
  const videoData = spec?.video_data || {};

  return uniqueStrings([
    ...toArray<any>(assets.images).map((item) => item?.url),
    ...toArray<any>(assets.videos).map((item) => item?.thumbnailUrl || item?.url),
    linkData?.image_url,
    linkData?.picture,
    videoData?.image_url,
    ...toArray<any>(linkData?.child_attachments).flatMap((item) => [item?.image_url, item?.picture]),
  ]);
}

function creativeLinkUrl(creative: any): string | undefined {
  const spec = creative?.object_story_spec || {};
  const linkData = spec?.link_data || {};
  const videoData = spec?.video_data || {};
  return (
    linkData?.call_to_action?.value?.link ||
    videoData?.call_to_action?.value?.link ||
    linkData?.link ||
    videoData?.link
  );
}

function normalizeCampaigns(payload: any): any[] {
  if (Array.isArray(payload?.campaigns)) return payload.campaigns;
  if (payload && payload.id && Array.isArray(payload?.adSets)) return [payload];
  if (Array.isArray(payload)) return payload;
  return [];
}

function flattenAds(campaigns: any[], onlyRunning: boolean): any[] {
  const ads: any[] = [];

  for (const campaign of campaigns) {
    const campaignRunning = isActiveStatus(campaign?.effective_status, campaign?.status);

    for (const adSet of toArray<any>(campaign?.adSets)) {
      const adSetRunning = isActiveStatus(adSet?.effective_status, adSet?.status);

      for (const ad of toArray<any>(adSet?.ads)) {
        const adRunning = isActiveStatus(ad?.effective_status, ad?.status);
        const running = campaignRunning && adSetRunning && adRunning;
        if (onlyRunning && !running) continue;

        const creative = ad?.creative || {};
        const textFields = creative?.textFields || {};
        ads.push({
          campaignId: campaign?.id,
          campaignName: campaign?.name,
          campaignStatus: campaign?.status,
          campaignEffectiveStatus: campaign?.effective_status,
          adSetId: adSet?.id,
          adSetName: adSet?.name,
          adSetStatus: adSet?.status,
          adSetEffectiveStatus: adSet?.effective_status,
          adId: ad?.id,
          adName: ad?.name,
          adStatus: ad?.status,
          adEffectiveStatus: ad?.effective_status,
          isRunning: running,
          creativeId: ad?.creativeId || creative?.id,
          callToActionType: ad?.callToActionType || textFields?.callToAction,
          primaryText: textFields?.primaryText,
          headline: textFields?.headline,
          description: textFields?.description,
          carouselTexts: toArray<string>(textFields?.carouselTexts),
          linkUrl: creativeLinkUrl(creative),
          assetUrls: assetUrlsFromCreative(creative),
          creative,
        });
      }
    }
  }

  return ads;
}

async function main(): Promise<void> {
  const organization = getFlag('organization') || process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const campaignId = getFlag('campaign-id');
  const adAccountId = getFlag('ad-account-id');
  const status = getFlag('status') || 'ACTIVE';
  const updatedSince = getFlag('updated-since');
  const includeAssets = getFlagBool('include-assets', true);
  const includePerformance = getFlagBool('include-performance', false);
  const downloadAssets = getFlagBool('download-assets', false);
  const onlyRunning = getFlagBool('only-running', true);
  const authToken = getFlag('auth-token') || process.env.STRATEGIS_AUTH_TOKEN || process.env.STRATEGIST_AUTH_TOKEN;
  const apiBaseUrl = getFlag('base-url') || process.env.STRATEGIS_API_BASE_URL;
  const ixIdBaseUrl = getFlag('auth-base-url') || process.env.STRATEGIS_AUTH_BASE_URL || process.env.IX_ID_BASE_URL;
  const email = getFlag('email') || process.env.STRATEGIS_EMAIL || process.env.IX_ID_EMAIL;
  const password = getFlag('password') || process.env.STRATEGIS_PASSWORD || process.env.IX_ID_PASSWORD;
  const outDir = getFlag('out') || path.join('.local', 'strategis', 'facebook', 'campaign-export');
  const maxCampaigns = getFlagInt('max-campaigns');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = [
    safeFilePart(organization),
    campaignId ? safeFilePart(campaignId) : safeFilePart(status),
    timestamp,
  ].join('__');
  const runDir = path.resolve(outDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const client = new StrategisCampaignExportClient({
    organization,
    authToken,
    apiBaseUrl,
    ixIdBaseUrl,
    email,
    password,
  });
  const query = {
    organization,
    adAccountId,
    status,
    updatedSince,
    includeAssets,
    includePerformance,
  };

  const rawResponse = campaignId
    ? await client.fetchCampaignExportById(campaignId, query)
    : await client.fetchCampaignExport(query);

  let campaigns = normalizeCampaigns(rawResponse);
  if (typeof maxCampaigns === 'number' && maxCampaigns >= 0) {
    campaigns = campaigns.slice(0, maxCampaigns);
  }

  const ads = flattenAds(campaigns, onlyRunning);
  const assetUrls = Array.from(new Set(ads.flatMap((ad) => ad.assetUrls))).sort();
  const summary = {
    organization,
    campaignId: campaignId || null,
    fetchedAt: new Date().toISOString(),
    totalCampaigns: campaigns.length,
    totalAds: ads.length,
    totalAssetUrls: assetUrls.length,
    filters: {
      adAccountId: adAccountId || null,
      status,
      updatedSince: updatedSince || null,
      includeAssets,
      includePerformance,
      onlyRunning,
      maxCampaigns: maxCampaigns ?? null,
    },
  };

  fs.writeFileSync(path.join(runDir, 'response.json'), JSON.stringify(rawResponse, null, 2));
  fs.writeFileSync(path.join(runDir, 'campaigns.json'), JSON.stringify(campaigns, null, 2));
  fs.writeFileSync(path.join(runDir, 'running-ads.json'), JSON.stringify(ads, null, 2));
  fs.writeFileSync(path.join(runDir, 'asset-urls.json'), JSON.stringify(assetUrls, null, 2));
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));

  if (downloadAssets && assetUrls.length > 0) {
    const assetsDir = path.join(runDir, 'assets');
    let index = 0;
    for (const url of assetUrls) {
      index += 1;
      const ext = extFromUrl(url) || '.bin';
      const outPath = path.join(assetsDir, `${String(index).padStart(5, '0')}${ext}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await downloadBinary(url, outPath);
      } catch (err: any) {
        fs.appendFileSync(path.join(runDir, 'asset-download-errors.log'), `${url}\n${String(err?.message || err)}\n\n`);
      }
    }
  }

  console.log(`[campaign-export] Wrote ${path.join(runDir, 'response.json')}`);
  console.log(`[campaign-export] Campaigns: ${campaigns.length}`);
  console.log(`[campaign-export] Ads${onlyRunning ? ' (running)' : ''}: ${ads.length}`);
  console.log(`[campaign-export] Asset URLs: ${assetUrls.length}`);
  if (downloadAssets) console.log(`[campaign-export] Downloaded assets into ${path.join(runDir, 'assets')}`);
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});
