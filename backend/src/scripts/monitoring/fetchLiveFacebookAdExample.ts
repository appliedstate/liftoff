import fs from 'fs';
import path from 'path';
import { createStrategisApiClient } from '../../lib/strategistClient';
import { renderIntendedDestinationUrl } from '../../lib/strategisCampaignResolver';

type Args = {
  date: string;
  organization: string;
  adAccountId?: string;
  outputDir: string;
};

function parseArgs(argv: string[]): Args {
  const today = new Date().toISOString().slice(0, 10);
  const args: Args = {
    date: today,
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    adAccountId: undefined,
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/live-ad-example'),
  };

  for (const raw of argv) {
    const [flag, value = ''] = raw.split('=');
    if (flag === '--date' && value) args.date = value;
    if (flag === '--organization' && value) args.organization = value;
    if (flag === '--ad-account-id' && value) args.adAccountId = value;
    if (flag === '--output-dir' && value) args.outputDir = path.resolve(process.cwd(), value);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = createStrategisApiClient();

  const reportRows = await client.get('/api/facebook/report', {
    dateStart: args.date,
    dateEnd: args.date,
    organization: args.organization,
    adSource: 'rsoc',
    networkName: 'facebook',
    level: 'campaign',
    dimensions: 'campaignId',
    cached: 1,
    dbSource: 'ch',
  });

  const campaignRows = Array.isArray(reportRows) ? reportRows : [];
  const activeCampaignRows = campaignRows.filter((row) => String(row?.status || '').toUpperCase() === 'ACTIVE');
  const targetAccountId = args.adAccountId || String(activeCampaignRows[0]?.adAccountId || '');

  if (!targetAccountId) {
    throw new Error('No active Facebook ad account ID found for the requested date');
  }

  const adRows = await client.get('/api/facebook/ads', {
    organization: args.organization,
    adAccountId: targetAccountId,
    fields: [
      'id',
      'name',
      'status',
      'effective_status',
      'created_time',
      'updated_time',
      'campaign{id,name,status,effective_status}',
      'adset{id,name,status,effective_status}',
      'creative{id,name,title,body,image_hash,video_id,thumbnail_url,object_story_spec,url_tags}',
    ].join(','),
  });

  const ads = Array.isArray(adRows) ? adRows : [];
  const activeCampaignIds = new Set(activeCampaignRows.map((row) => String(row?.networkCampaignId || '')));
  const matchedAds = ads.filter((ad) => activeCampaignIds.has(String(ad?.campaign?.id || '')));
  const activeAds = matchedAds.filter((ad) => {
    const adStatus = String(ad?.status || '').toUpperCase();
    const effectiveStatus = String(ad?.effective_status || '').toUpperCase();
    const campaignStatus = String(ad?.campaign?.effective_status || ad?.campaign?.status || '').toUpperCase();
    return adStatus === 'ACTIVE' || effectiveStatus === 'ACTIVE' || campaignStatus === 'ACTIVE';
  });
  const sample = activeAds[0] || matchedAds[0] || ads[0];
  const samplePerformance =
    activeCampaignRows.find((row) => String(row?.networkCampaignId || '') === String(sample?.campaign?.id || '')) || null;
  const strategisCampaignId = samplePerformance?.strategisCampaignId || null;
  const campaignRecord = strategisCampaignId ? await client.get(`/api/campaigns/${strategisCampaignId}`) : null;
  const intendedUrl = campaignRecord ? renderIntendedDestinationUrl(campaignRecord) : null;
  const copyBundle = sample
    ? {
        primaryText: sample?.creative?.body || sample?.creative?.object_story_spec?.video_data?.message || null,
        headline:
          sample?.creative?.title ||
          sample?.creative?.object_story_spec?.link_data?.name ||
          sample?.creative?.object_story_spec?.video_data?.title ||
          null,
        description:
          sample?.creative?.object_story_spec?.link_data?.description ||
          sample?.creative?.object_story_spec?.template_data?.description ||
          null,
        callToAction:
          sample?.creative?.object_story_spec?.video_data?.call_to_action?.type ||
          sample?.creative?.object_story_spec?.link_data?.call_to_action?.type ||
          null,
        routeUrl:
          sample?.creative?.object_story_spec?.video_data?.call_to_action?.value?.link ||
          sample?.creative?.object_story_spec?.link_data?.call_to_action?.value?.link ||
          null,
        urlTags: sample?.creative?.url_tags || null,
        landingHeadline: campaignRecord?.properties?.headline || null,
        allText: Array.from(
          new Set(
            [
              sample?.creative?.body,
              sample?.creative?.title,
              sample?.creative?.object_story_spec?.video_data?.message,
              sample?.creative?.object_story_spec?.video_data?.title,
              sample?.creative?.object_story_spec?.link_data?.name,
              sample?.creative?.object_story_spec?.link_data?.description,
              sample?.creative?.url_tags,
              campaignRecord?.properties?.headline,
            ]
              .map((value) => String(value || '').trim())
              .filter(Boolean)
          )
        ),
      }
    : null;

  const output = {
    date: args.date,
    organization: args.organization,
    adAccountId: targetAccountId,
    activeCampaignCount: activeCampaignRows.length,
    matchedAdCount: matchedAds.length,
    matchedActiveAdCount: activeAds.length,
    strategisCampaignId,
    intendedUrl,
    campaignRecord,
    copyBundle,
    transcript: sample?.creative?.video_id
      ? {
          status: 'blocked_missing_video_source',
          text: null,
          reason: 'The live Strategis ad payload includes video IDs and thumbnails but not a downloadable video source URL.',
        }
      : {
          status: 'not_applicable',
          text: null,
          reason: 'Sample creative is not a video with a downloadable source.',
        },
    sample,
    matchedAds: matchedAds.slice(0, 25),
  };

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(path.join(args.outputDir, 'report.json'), JSON.stringify(activeCampaignRows, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'ads.json'), JSON.stringify(matchedAds, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'sample.json'), JSON.stringify(output, null, 2));

  console.log(JSON.stringify({
    ok: true,
    outputDir: args.outputDir,
    adAccountId: targetAccountId,
    activeCampaignCount: activeCampaignRows.length,
    matchedAdCount: matchedAds.length,
    matchedActiveAdCount: activeAds.length,
    strategisCampaignId,
    intendedUrl,
    sampleAdId: sample?.id || null,
    sampleCampaignId: sample?.campaign?.id || null,
    sampleCreativeId: sample?.creative?.id || null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
