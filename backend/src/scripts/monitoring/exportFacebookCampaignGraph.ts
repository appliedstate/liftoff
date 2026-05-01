import fs from 'fs';
import path from 'path';
import { createStrategisApiClient } from '../../lib/strategistClient';

type Args = {
  date: string;
  organization: string;
  spendThreshold: number;
  outputDir: string;
};

type JsonRecord = Record<string, any>;

function parseArgs(argv: string[]): Args {
  const today = new Date().toISOString().slice(0, 10);
  const args: Args = {
    date: today,
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    spendThreshold: 5,
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/campaign-graph'),
  };

  for (const raw of argv) {
    const [flag, value = ''] = raw.split('=');
    if (flag === '--date' && value) args.date = value;
    if (flag === '--organization' && value) args.organization = value;
    if (flag === '--spend-threshold' && value) args.spendThreshold = Number.parseFloat(value) || args.spendThreshold;
    if (flag === '--output-dir' && value) args.outputDir = path.resolve(process.cwd(), value);
  }

  return args;
}

function asRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload as JsonRecord[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as JsonRecord).data)) {
    return (payload as JsonRecord).data as JsonRecord[];
  }
  return [];
}

function toUniqueSortedStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort();
}

function groupBy<T>(rows: T[], getKey: (row: T) => string | null | undefined): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(getKey(row) || '').trim();
    if (!key) continue;
    const current = grouped.get(key);
    if (current) current.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

function normalizeSpend(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = createStrategisApiClient();

  const reportRows = asRows(
    await client.get('/api/facebook/report', {
      dateStart: args.date,
      dateEnd: args.date,
      organization: args.organization,
      adSource: 'rsoc',
      networkName: 'facebook',
      level: 'campaign',
      dimensions: 'campaignId',
      cached: 1,
      dbSource: 'ch',
    })
  );

  const spendQualifiedCampaigns = reportRows.filter((row) => normalizeSpend(row?.spend) > args.spendThreshold);
  const networkCampaignIds = new Set(
    spendQualifiedCampaigns.map((row) => String(row?.networkCampaignId || '')).filter(Boolean)
  );

  const [adsetsRows, adsRows] = await Promise.all([
    asRows(
      await client.get('/api/facebook/adsets', {
        organization: args.organization,
        fields: 'id,name,status,campaign_id,account_id',
      })
    ),
    asRows(
      await client.get('/api/facebook/ads', {
        organization: args.organization,
        fields:
          'id,name,status,effective_status,campaign_id,adset_id,account_id,creative{id,name,title,body,object_story_spec,effective_object_story_id}',
      })
    ),
  ]);

  const relevantAdsets = adsetsRows.filter((row) => networkCampaignIds.has(String(row?.campaign_id || '')));
  const relevantAds = adsRows.filter((row) => networkCampaignIds.has(String(row?.campaign_id || '')));

  const adsetsByCampaignId = groupBy(relevantAdsets, (row) => row?.campaign_id);
  const adsByCampaignId = groupBy(relevantAds, (row) => row?.campaign_id);
  const adsByAdsetId = groupBy(relevantAds, (row) => row?.adset_id);
  const campaignRowsByPageId = new Map<string, JsonRecord[]>();

  for (const ad of relevantAds) {
    const pageId =
      ad?.creative?.object_story_spec?.page_id ||
      ad?.creative?.object_story_spec?.video_data?.page_id ||
      ad?.creative?.object_story_spec?.link_data?.page_id;
    const normalizedPageId = String(pageId || '').trim();
    if (!normalizedPageId) continue;
    const existing = campaignRowsByPageId.get(normalizedPageId) || [];
    const campaign = spendQualifiedCampaigns.find(
      (row) => String(row?.networkCampaignId || '') === String(ad?.campaign_id || '')
    );
    if (campaign) existing.push(campaign);
    campaignRowsByPageId.set(normalizedPageId, existing);
  }

  const pageToCampaigns = Array.from(campaignRowsByPageId.entries())
    .map(([pageId, rows]) => {
      const networkIds = toUniqueSortedStrings(rows.map((row) => row?.networkCampaignId));
      const strategisIds = toUniqueSortedStrings(rows.map((row) => row?.strategisCampaignId || row?.campaignId));
      const buyers = toUniqueSortedStrings(rows.map((row) => row?.buyer));
      const rsocSites = toUniqueSortedStrings(rows.map((row) => row?.rsocSite));
      return {
        pageId,
        campaignCount: networkIds.length,
        strategisCampaignIds: strategisIds,
        facebookCampaignIds: networkIds,
        buyers,
        rsocSites,
      };
    })
    .sort((a, b) => b.campaignCount - a.campaignCount || a.pageId.localeCompare(b.pageId));

  const campaignRowsByAccountId = groupBy(spendQualifiedCampaigns, (row) => row?.adAccountId);
  const adAccountToCampaigns = Array.from(campaignRowsByAccountId.entries())
    .map(([adAccountId, rows]) => ({
      adAccountId,
      campaignCount: toUniqueSortedStrings(rows.map((row) => row?.networkCampaignId)).length,
      strategisCampaignIds: toUniqueSortedStrings(rows.map((row) => row?.strategisCampaignId || row?.campaignId)),
      facebookCampaignIds: toUniqueSortedStrings(rows.map((row) => row?.networkCampaignId)),
      buyers: toUniqueSortedStrings(rows.map((row) => row?.buyer)),
      rsocSites: toUniqueSortedStrings(rows.map((row) => row?.rsocSite)),
    }))
    .sort((a, b) => b.campaignCount - a.campaignCount || a.adAccountId.localeCompare(b.adAccountId));

  const nodes: JsonRecord[] = [];
  const edges: JsonRecord[] = [];
  const nodeKeySet = new Set<string>();
  const edgeKeySet = new Set<string>();

  function addNode(type: string, id: string, data: JsonRecord) {
    const key = `${type}:${id}`;
    if (nodeKeySet.has(key)) return;
    nodeKeySet.add(key);
    nodes.push({ id, type, ...data });
  }

  function addEdge(type: string, fromType: string, fromId: string, toType: string, toId: string, data: JsonRecord = {}) {
    const key = `${type}:${fromType}:${fromId}:${toType}:${toId}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    edges.push({ type, from: { type: fromType, id: fromId }, to: { type: toType, id: toId }, ...data });
  }

  for (const row of spendQualifiedCampaigns) {
    const strategisCampaignId = String(row?.strategisCampaignId || row?.campaignId || '').trim();
    const facebookCampaignId = String(row?.networkCampaignId || '').trim();
    const buyer = String(row?.buyer || '').trim();
    const adAccountId = String(row?.adAccountId || '').trim();
    const rsocSite = String(row?.rsocSite || '').trim();

    if (buyer) addNode('buyer', buyer, { name: buyer });
    if (adAccountId) addNode('ad_account', adAccountId, { adAccountId });
    if (rsocSite) addNode('rsoc_site', rsocSite, { domain: rsocSite });

    if (strategisCampaignId) {
      addNode('strategis_campaign', strategisCampaignId, {
        strategisCampaignId,
        campaignName: row?.campaign_name || row?.campaignName || row?.networkCampaignName || null,
        category: row?.category || null,
        buyer: row?.buyer || null,
        rsocSite: row?.rsocSite || null,
        spend: normalizeSpend(row?.spend),
        status: row?.status || null,
      });
    }

    if (facebookCampaignId) {
      addNode('facebook_campaign', facebookCampaignId, {
        facebookCampaignId,
        campaignName: row?.networkCampaignName || row?.campaign_name || null,
        spend: normalizeSpend(row?.spend),
        status: row?.status || null,
      });
    }

    if (buyer && strategisCampaignId) addEdge('owns', 'buyer', buyer, 'strategis_campaign', strategisCampaignId);
    if (strategisCampaignId && facebookCampaignId) addEdge('maps_to', 'strategis_campaign', strategisCampaignId, 'facebook_campaign', facebookCampaignId);
    if (facebookCampaignId && adAccountId) addEdge('runs_in', 'facebook_campaign', facebookCampaignId, 'ad_account', adAccountId);
    if (strategisCampaignId && rsocSite) addEdge('lands_on', 'strategis_campaign', strategisCampaignId, 'rsoc_site', rsocSite);
  }

  for (const adset of relevantAdsets) {
    const adsetId = String(adset?.id || '').trim();
    const campaignId = String(adset?.campaign_id || '').trim();
    const accountId = String(adset?.account_id || '').trim();
    if (!adsetId || !campaignId) continue;
    addNode('facebook_adset', adsetId, {
      adsetId,
      name: adset?.name || null,
      status: adset?.status || null,
    });
    addEdge('contains', 'facebook_campaign', campaignId, 'facebook_adset', adsetId);
    if (accountId) addEdge('runs_in', 'facebook_adset', adsetId, 'ad_account', accountId);
  }

  for (const ad of relevantAds) {
    const adId = String(ad?.id || '').trim();
    const campaignId = String(ad?.campaign_id || '').trim();
    const adsetId = String(ad?.adset_id || '').trim();
    const accountId = String(ad?.account_id || '').trim();
    if (!adId || !campaignId) continue;
    const pageId =
      ad?.creative?.object_story_spec?.page_id ||
      ad?.creative?.object_story_spec?.video_data?.page_id ||
      ad?.creative?.object_story_spec?.link_data?.page_id ||
      null;
    const routeUrl =
      ad?.creative?.object_story_spec?.video_data?.call_to_action?.value?.link ||
      ad?.creative?.object_story_spec?.link_data?.call_to_action?.value?.link ||
      null;
    addNode('facebook_ad', adId, {
      adId,
      name: ad?.name || null,
      status: ad?.status || null,
      effectiveStatus: ad?.effective_status || null,
      headline: ad?.creative?.title || null,
      body: ad?.creative?.body || null,
      routeUrl,
      pageId: pageId ? String(pageId) : null,
    });
    addEdge('contains', 'facebook_campaign', campaignId, 'facebook_ad', adId);
    if (adsetId) addEdge('contains', 'facebook_adset', adsetId, 'facebook_ad', adId);
    if (accountId) addEdge('runs_in', 'facebook_ad', adId, 'ad_account', accountId);
    if (pageId) {
      const normalizedPageId = String(pageId);
      addNode('facebook_page', normalizedPageId, { pageId: normalizedPageId });
      addEdge('publishes', 'facebook_page', normalizedPageId, 'facebook_ad', adId);
    }
  }

  const buyerBreakdown: Record<string, number> = {};
  for (const row of spendQualifiedCampaigns) {
    const buyer = String(row?.buyer || 'unknown').trim() || 'unknown';
    buyerBreakdown[buyer] = (buyerBreakdown[buyer] || 0) + 1;
  }

  const summary = {
    date: args.date,
    organization: args.organization,
    spendThreshold: args.spendThreshold,
    campaignsWithSpendOverThreshold: spendQualifiedCampaigns.length,
    uniqueFacebookCampaignIds: networkCampaignIds.size,
    uniqueAdsets: toUniqueSortedStrings(relevantAdsets.map((row) => row?.id)).length,
    activeAdsets: relevantAdsets.filter((row) => String(row?.status || '').toUpperCase() === 'ACTIVE').length,
    uniqueAds: toUniqueSortedStrings(relevantAds.map((row) => row?.id)).length,
    activeAds: relevantAds.filter((row) => String(row?.status || row?.effective_status || '').toUpperCase() === 'ACTIVE').length,
    uniquePages: pageToCampaigns.length,
    uniqueAdAccounts: adAccountToCampaigns.length,
    buyerBreakdown,
    topPages: pageToCampaigns.slice(0, 10),
    topAdAccounts: adAccountToCampaigns.slice(0, 10),
  };

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(path.join(args.outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'page-to-campaigns.json'), JSON.stringify(pageToCampaigns, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'ad-account-to-campaigns.json'), JSON.stringify(adAccountToCampaigns, null, 2));
  fs.writeFileSync(
    path.join(args.outputDir, 'campaign-details.json'),
    JSON.stringify(
      spendQualifiedCampaigns.map((row) => ({
        strategisCampaignId: row?.strategisCampaignId || row?.campaignId || null,
        facebookCampaignId: row?.networkCampaignId || null,
        campaignName: row?.networkCampaignName || row?.campaign_name || null,
        buyer: row?.buyer || null,
        rsocSite: row?.rsocSite || null,
        adAccountId: row?.adAccountId || null,
        category: row?.category || null,
        spend: normalizeSpend(row?.spend),
        adsetCount: (adsetsByCampaignId.get(String(row?.networkCampaignId || '')) || []).length,
        adCount: (adsByCampaignId.get(String(row?.networkCampaignId || '')) || []).length,
        adsetIds: toUniqueSortedStrings((adsetsByCampaignId.get(String(row?.networkCampaignId || '')) || []).map((item) => item?.id)),
        adIds: toUniqueSortedStrings((adsByCampaignId.get(String(row?.networkCampaignId || '')) || []).map((item) => item?.id)),
        pageIds: toUniqueSortedStrings(
          (adsByCampaignId.get(String(row?.networkCampaignId || '')) || []).map(
            (item) =>
              item?.creative?.object_story_spec?.page_id ||
              item?.creative?.object_story_spec?.video_data?.page_id ||
              item?.creative?.object_story_spec?.link_data?.page_id
          )
        ),
      })),
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(args.outputDir, 'graph.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary,
        nodes,
        edges,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(args.outputDir, 'adset-to-ads.json'),
    JSON.stringify(
      Array.from(adsByAdsetId.entries())
        .map(([adsetId, rows]) => ({
          adsetId,
          adCount: rows.length,
          adIds: toUniqueSortedStrings(rows.map((row) => row?.id)),
        }))
        .sort((a, b) => b.adCount - a.adCount || a.adsetId.localeCompare(b.adsetId)),
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir: args.outputDir,
        summary,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
