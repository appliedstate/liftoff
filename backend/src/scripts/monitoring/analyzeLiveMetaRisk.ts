import fs from 'fs';
import path from 'path';
import { scoreMetaAdBoundary } from '../../lib/metaAdBoundaryScorer';
import { createStrategisApiClient } from '../../lib/strategistClient';

type JsonRecord = Record<string, any>;

type Args = {
  date: string;
  organization: string;
  spendThreshold: number;
  outputDir: string;
};

type ClassifiedAd = {
  adId: string;
  adName: string | null;
  campaignId: string;
  adsetId: string | null;
  accountId: string | null;
  pageId: string | null;
  strategisCampaignId: string | null;
  buyer: string | null;
  rsocSite: string | null;
  campaignName: string | null;
  spend: number;
  status: string | null;
  effectiveStatus: string | null;
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  routeUrl: string | null;
  overallBand: 'white' | 'grey' | 'black';
  totalScore: number;
  assetBanRisk: 'low' | 'moderate' | 'high' | 'critical';
  hotZone: boolean;
  atRisk: boolean;
  topSurfaces: Array<{ surface: string; score: number }>;
  summary: string[];
  offendingMatches: string[];
};

function parseArgs(argv: string[]): Args {
  const today = new Date().toISOString().slice(0, 10);
  const args: Args = {
    date: today,
    organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
    spendThreshold: 5,
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/meta-risk-analysis'),
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

function normalizeSpend(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toUniqueSortedStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort();
}

function percentage(part: number, whole: number): number {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(2));
}

function aggregateBy<T extends Record<string, any>>(
  ads: ClassifiedAd[],
  getKey: (ad: ClassifiedAd) => string | null,
  includeExtra?: (ad: ClassifiedAd) => Partial<T>
) {
  const map = new Map<string, {
    id: string;
    totalAds: number;
    hotZoneAds: number;
    atRiskAds: number;
    blackAds: number;
    greyAds: number;
    whiteAds: number;
    buyers: Set<string>;
    rsocSites: Set<string>;
    strategisCampaignIds: Set<string>;
    facebookCampaignIds: Set<string>;
    extras: Partial<T>;
  }>();

  for (const ad of ads) {
    const key = String(getKey(ad) || '').trim();
    if (!key) continue;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        id: key,
        totalAds: 0,
        hotZoneAds: 0,
        atRiskAds: 0,
        blackAds: 0,
        greyAds: 0,
        whiteAds: 0,
        buyers: new Set<string>(),
        rsocSites: new Set<string>(),
        strategisCampaignIds: new Set<string>(),
        facebookCampaignIds: new Set<string>(),
        extras: {},
      };
      map.set(key, entry);
    }

    entry.totalAds += 1;
    if (ad.hotZone) entry.hotZoneAds += 1;
    if (ad.atRisk) entry.atRiskAds += 1;
    if (ad.overallBand === 'black') entry.blackAds += 1;
    else if (ad.overallBand === 'grey') entry.greyAds += 1;
    else entry.whiteAds += 1;
    if (ad.buyer) entry.buyers.add(ad.buyer);
    if (ad.rsocSite) entry.rsocSites.add(ad.rsocSite);
    if (ad.strategisCampaignId) entry.strategisCampaignIds.add(ad.strategisCampaignId);
    if (ad.campaignId) entry.facebookCampaignIds.add(ad.campaignId);
    if (includeExtra) entry.extras = { ...entry.extras, ...includeExtra(ad) };
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry.extras,
      id: entry.id,
      totalAds: entry.totalAds,
      hotZoneAds: entry.hotZoneAds,
      hotZonePct: percentage(entry.hotZoneAds, entry.totalAds),
      atRiskAds: entry.atRiskAds,
      atRiskPct: percentage(entry.atRiskAds, entry.totalAds),
      blackAds: entry.blackAds,
      greyAds: entry.greyAds,
      whiteAds: entry.whiteAds,
      buyers: Array.from(entry.buyers).sort(),
      rsocSites: Array.from(entry.rsocSites).sort(),
      strategisCampaignIds: Array.from(entry.strategisCampaignIds).sort(),
      facebookCampaignIds: Array.from(entry.facebookCampaignIds).sort(),
    }))
    .sort((a, b) => b.hotZoneAds - a.hotZoneAds || b.atRiskAds - a.atRiskAds || b.totalAds - a.totalAds || a.id.localeCompare(b.id));
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
  const campaignByFacebookId = new Map<string, JsonRecord>();
  for (const row of spendQualifiedCampaigns) {
    const id = String(row?.networkCampaignId || '').trim();
    if (id) campaignByFacebookId.set(id, row);
  }

  const networkCampaignIds = new Set(campaignByFacebookId.keys());
  const adsRows = asRows(
    await client.get('/api/facebook/ads', {
      organization: args.organization,
      fields:
        'id,name,status,effective_status,campaign_id,adset_id,account_id,creative{id,name,title,body,object_story_spec,effective_object_story_id}',
    })
  );

  const activeAds = adsRows.filter((row) => {
    const campaignId = String(row?.campaign_id || '').trim();
    if (!networkCampaignIds.has(campaignId)) return false;
    const status = String(row?.status || '').toUpperCase();
    const effectiveStatus = String(row?.effective_status || '').toUpperCase();
    return status === 'ACTIVE' || effectiveStatus === 'ACTIVE';
  });

  const classifiedAds: ClassifiedAd[] = activeAds.map((ad) => {
    const campaign = campaignByFacebookId.get(String(ad?.campaign_id || '').trim()) || {};
    const headline = String(ad?.creative?.title || ad?.creative?.object_story_spec?.link_data?.name || '').trim() || null;
    const primaryText = String(
      ad?.creative?.body ||
        ad?.creative?.object_story_spec?.video_data?.message ||
        ad?.creative?.object_story_spec?.link_data?.message ||
        ''
    ).trim() || null;
    const cta =
      String(
        ad?.creative?.object_story_spec?.video_data?.call_to_action?.type ||
          ad?.creative?.object_story_spec?.link_data?.call_to_action?.type ||
          ''
      ).trim() || null;
    const routeUrl =
      String(
        ad?.creative?.object_story_spec?.video_data?.call_to_action?.value?.link ||
          ad?.creative?.object_story_spec?.link_data?.call_to_action?.value?.link ||
          ''
      ).trim() || null;
    const combinedText = [primaryText, headline, cta].filter(Boolean).join('\n');
    const boundary = scoreMetaAdBoundary(combinedText);
    const topSurfaces = Object.entries(boundary.familyScores)
      .filter(([, score]) => Number(score) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([surface, score]) => ({ surface, score: Number(score) }));
    const offendingMatches = Array.from(
      new Set(
        boundary.lineScores.flatMap((line) => line.triggers.map((trigger) => trigger.match)).filter(Boolean)
      )
    );

    return {
      adId: String(ad?.id || '').trim(),
      adName: String(ad?.name || '').trim() || null,
      campaignId: String(ad?.campaign_id || '').trim(),
      adsetId: String(ad?.adset_id || '').trim() || null,
      accountId: String(ad?.account_id || '').trim() || null,
      pageId:
        String(
          ad?.creative?.object_story_spec?.page_id ||
            ad?.creative?.object_story_spec?.video_data?.page_id ||
            ad?.creative?.object_story_spec?.link_data?.page_id ||
            ''
        ).trim() || null,
      strategisCampaignId: String(campaign?.strategisCampaignId || campaign?.campaignId || '').trim() || null,
      buyer: String(campaign?.buyer || '').trim() || null,
      rsocSite: String(campaign?.rsocSite || '').trim() || null,
      campaignName: String(campaign?.networkCampaignName || campaign?.campaign_name || '').trim() || null,
      spend: normalizeSpend(campaign?.spend),
      status: String(ad?.status || '').trim() || null,
      effectiveStatus: String(ad?.effective_status || '').trim() || null,
      headline,
      primaryText,
      cta,
      routeUrl,
      overallBand: boundary.overallBand,
      totalScore: boundary.totalScore,
      assetBanRisk: boundary.assetBanRisk,
      hotZone: boundary.overallBand === 'black',
      atRisk: boundary.overallBand !== 'white',
      topSurfaces,
      summary: boundary.summary,
      offendingMatches,
    };
  });

  const totalActiveAds = classifiedAds.length;
  const hotZoneAds = classifiedAds.filter((ad) => ad.hotZone);
  const atRiskAds = classifiedAds.filter((ad) => ad.atRisk);
  const whiteAds = classifiedAds.filter((ad) => ad.overallBand === 'white');
  const greyAds = classifiedAds.filter((ad) => ad.overallBand === 'grey');
  const blackAds = hotZoneAds;

  const byBuyer = aggregateBy(classifiedAds, (ad) => ad.buyer, (ad) => ({ buyer: ad.buyer }));
  const byPage = aggregateBy(classifiedAds, (ad) => ad.pageId, (ad) => ({ pageId: ad.pageId }));
  const byAdAccount = aggregateBy(classifiedAds, (ad) => ad.accountId, (ad) => ({ adAccountId: ad.accountId }));
  const bySite = aggregateBy(classifiedAds, (ad) => ad.rsocSite, (ad) => ({ rsocSite: ad.rsocSite }));

  const topHotAds = hotZoneAds
    .sort((a, b) => b.totalScore - a.totalScore || a.adId.localeCompare(b.adId))
    .slice(0, 25);

  const riskSummary = {
    date: args.date,
    organization: args.organization,
    spendThreshold: args.spendThreshold,
    methodology: {
      campaignUniverse: 'Campaigns with spend above threshold in today’s /api/facebook/report level=campaign feed.',
      adUniverse: 'Active ads from /api/facebook/ads whose facebook campaign_id belongs to that spend-qualified campaign set.',
      hotZoneDefinition: 'Meta boundary overallBand = black. This is the harness rewrite-required / likely rejection-or-escalation band.',
      atRiskDefinition: 'Meta boundary overallBand = grey or black.',
      note: 'Live ad-level spend rows were unavailable from /api/facebook/report level=ad today, so the analysis uses active ads inside spending campaigns rather than confirmed per-ad spend.',
    },
    counts: {
      campaignsWithSpendOverThreshold: spendQualifiedCampaigns.length,
      activeAdsInSpendingCampaigns: totalActiveAds,
      whiteAds: whiteAds.length,
      greyAds: greyAds.length,
      blackAds: blackAds.length,
      hotZoneAds: hotZoneAds.length,
      atRiskAds: atRiskAds.length,
    },
    percentages: {
      whiteAdsPct: percentage(whiteAds.length, totalActiveAds),
      greyAdsPct: percentage(greyAds.length, totalActiveAds),
      blackAdsPct: percentage(blackAds.length, totalActiveAds),
      hotZoneAdsPct: percentage(hotZoneAds.length, totalActiveAds),
      atRiskAdsPct: percentage(atRiskAds.length, totalActiveAds),
    },
    topHotSurfaces: Array.from(
      hotZoneAds.reduce((map, ad) => {
        for (const item of ad.topSurfaces) {
          map.set(item.surface, (map.get(item.surface) || 0) + 1);
        }
        return map;
      }, new Map<string, number>())
    )
      .map(([surface, count]) => ({ surface, adCount: count }))
      .sort((a, b) => b.adCount - a.adCount || a.surface.localeCompare(b.surface)),
    hottestEntities: {
      buyers: byBuyer.slice(0, 10),
      pages: byPage.slice(0, 10),
      adAccounts: byAdAccount.slice(0, 10),
      rsocSites: bySite.slice(0, 10),
    },
  };

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(path.join(args.outputDir, 'summary.json'), JSON.stringify(riskSummary, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'ads.json'), JSON.stringify(classifiedAds, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'hot-zone-ads.json'), JSON.stringify(topHotAds, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'by-buyer.json'), JSON.stringify(byBuyer, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'by-page.json'), JSON.stringify(byPage, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'by-ad-account.json'), JSON.stringify(byAdAccount, null, 2));
  fs.writeFileSync(path.join(args.outputDir, 'by-rsoc-site.json'), JSON.stringify(bySite, null, 2));

  console.log(JSON.stringify({ ok: true, outputDir: args.outputDir, summary: riskSummary }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
