import fs from 'fs';
import path from 'path';
import { CampaignShellExportRow } from './campaignShellProfiles';
import { FacebookSettingsProfileReport } from './facebookSettingsProfilesCompat';

type CampaignGraphDetail = {
  strategisCampaignId: string;
  facebookCampaignId?: string | null;
  buyer?: string | null;
  adAccountId?: string | null;
  category?: string | null;
  adsetCount?: number | null;
  adCount?: number | null;
  pageIds?: string[] | null;
};

type ValueCount = {
  value: string;
  count: number;
  pct: number;
};

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function countValues(values: string[]): ValueCount[] {
  const counts = new Map<string, number>();
  for (const value of values.map((entry) => asString(entry)).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const total = values.map((entry) => asString(entry)).filter(Boolean).length;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      count,
      pct: total > 0 ? count / total : 0,
    }));
}

function dominant(values: string[]): ValueCount | null {
  return countValues(values)[0] || null;
}

function loadCampaignGraphIndex(): Map<string, CampaignGraphDetail> {
  const graphPath = path.join(
    process.cwd(),
    '.local',
    'strategis',
    'facebook',
    'campaign-graph',
    'campaign-details.json'
  );
  const index = new Map<string, CampaignGraphDetail>();
  if (!fs.existsSync(graphPath)) return index;
  const rows = JSON.parse(fs.readFileSync(graphPath, 'utf8')) as CampaignGraphDetail[];
  for (const row of rows) {
    const id = asString(row?.strategisCampaignId);
    if (!id) continue;
    index.set(id, row);
  }
  return index;
}

export function buildFallbackFacebookSettingsProfileReport(args: {
  buyer: string;
  strategisRows: CampaignShellExportRow[];
}): FacebookSettingsProfileReport {
  const buyer = args.buyer.trim() || 'Ben';
  const normalizedBuyer = buyer.toLowerCase();
  const graphIndex = loadCampaignGraphIndex();

  const campaigns = args.strategisRows
    .filter((row) => row.status === 200 && row.body?.raw)
    .map((row) => row.body!.raw)
    .filter((raw) => asString(raw?.properties?.buyer).toLowerCase() === normalizedBuyer);

  const matchedGraphRows = campaigns
    .map((campaign) => ({
      campaign,
      graph: graphIndex.get(asString(campaign.id)) || null,
    }))
    .filter(({ graph }) => Boolean(graph));

  const groupedByCategory = new Map<
    string,
    Array<{ campaign: Record<string, any>; graph: CampaignGraphDetail | null }>
  >();

  for (const entry of campaigns.map((campaign) => ({
    campaign,
    graph: graphIndex.get(asString(campaign.id)) || null,
  }))) {
    const category = asString(entry.campaign.category) || 'Uncategorized';
    const list = groupedByCategory.get(category) || [];
    list.push(entry);
    groupedByCategory.set(category, list);
  }

  return {
    scope: {
      buyer,
      matchedCampaigns: campaigns.length,
      matchedAdSets: matchedGraphRows.reduce((sum, entry) => sum + Number(entry.graph?.adsetCount || 0), 0),
      matchedAds: matchedGraphRows.reduce((sum, entry) => sum + Number(entry.graph?.adCount || 0), 0),
    },
    generatedAt: new Date().toISOString(),
    campaignFields: {
      account_id: countValues(
        campaigns.map((campaign) => asString(campaign.properties?.networkAccountId || campaign.properties?.fbAdAccount))
      ),
    },
    adSetFields: {},
    selectorFamilies: [],
    categoryProfiles: Array.from(groupedByCategory.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([category, entries]) => {
        const adAccountValues = entries.map(
          ({ campaign, graph }) =>
            asString(campaign.properties?.networkAccountId || campaign.properties?.fbAdAccount || graph?.adAccountId)
        );
        const pageValues = entries.flatMap(({ graph }) => (Array.isArray(graph?.pageIds) ? graph!.pageIds! : []));
        return {
          category,
          campaignCount: entries.length,
          dominantAccountId: dominant(adAccountValues),
          dominantPixelId: null,
          dominantPageId: dominant(pageValues),
          selectorFamilies: [],
        };
      }),
    recommendations: {
      lockedSelectors: [],
      profileSelectors: [],
      manualFields: ['targeting', 'optimization_goal', 'billing_event', 'bid_strategy', 'pixel_id'],
      notes: [
        `Fallback Facebook profile report for ${buyer}.`,
        'This was synthesized from Strategis shell records and the cached Facebook campaign graph because detailed ad set targeting exports were not available.',
        'Ad account and page hints are still useful, but selector families and optimization settings should remain manual until a deeper Facebook export is restored.',
      ],
    },
  };
}
