import fs from 'fs';
import path from 'path';
import { CommentComplaintLabel, classifyComment } from '../../lib/commentComplaintClassifier';
import { getMetaEngagementFixture, META_ENGAGEMENT_FIXTURES } from '../../lib/metaEngagementFixtures';
import { evaluateMetaReviewPressure, MetaReviewPressureCluster } from '../../lib/metaReviewPressure';

type JsonRecord = Record<string, any>;

type Args = {
  input: string;
  outputDir: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    input: path.resolve(process.cwd(), '.local/strategis/facebook/meta-risk-analysis/ads.json'),
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/review-pressure-prototype'),
  };

  for (const raw of argv) {
    const [flag, value = ''] = raw.split('=');
    if (flag === '--input' && value) args.input = path.resolve(process.cwd(), value);
    if (flag === '--output-dir' && value) args.outputDir = path.resolve(process.cwd(), value);
  }

  return args;
}

function readJsonArray(filePath: string): JsonRecord[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function percentage(part: number, whole: number): number {
  if (!whole) return 0;
  return Number(((part / whole) * 100).toFixed(2));
}

function summarizeCluster(ads: JsonRecord[], ad: JsonRecord): MetaReviewPressureCluster {
  const samePage = ads.filter((row) => row.pageId && ad.pageId && row.pageId === ad.pageId);
  const sameAccount = ads.filter((row) => row.accountId && ad.accountId && row.accountId === ad.accountId);
  const sameSite = ads.filter((row) => row.rsocSite && ad.rsocSite && row.rsocSite === ad.rsocSite);

  const hotCount = (rows: JsonRecord[]) => rows.filter((row) => row.hotZone || row.overallBand === 'black').length;

  return {
    pageHotZoneAds: hotCount(samePage),
    pageHotZonePct: percentage(hotCount(samePage), samePage.length),
    accountHotZoneAds: hotCount(sameAccount),
    accountHotZonePct: percentage(hotCount(sameAccount), sameAccount.length),
    siteHotZoneAds: hotCount(sameSite),
    siteHotZonePct: percentage(hotCount(sameSite), sameSite.length),
  };
}

function summarizeVisibleLabels(comments: string[]) {
  const labels: Record<CommentComplaintLabel, number> = {
    fraud: 0,
    spam: 0,
    bait_switch: 0,
    landing_failure: 0,
    generic_negative: 0,
    neutral: 0,
    positive: 0,
  };
  for (const comment of comments) {
    const row = classifyComment(comment);
    for (const label of row.labels) labels[label] += 1;
  }
  return labels;
}

function aggregateBy(
  ads: Array<{
    pageId: string | null;
    accountId: string | null;
    rsocSite: string | null;
    reviewPressure: { overallBand: string; totalScore: number };
    metaRisk: { overallBand: string };
    spend: number;
    buyer: string | null;
    campaignName: string | null;
  }>,
  getKey: (ad: any) => string | null,
  label: string
) {
  const map = new Map<
    string,
    {
      id: string;
      testedAds: number;
      acuteAds: number;
      highAds: number;
      watchAds: number;
      lowAds: number;
      hotZoneAds: number;
      spend: number;
      buyers: Set<string>;
      campaigns: Set<string>;
    }
  >();

  for (const ad of ads) {
    const key = String(getKey(ad) || '').trim();
    if (!key) continue;
    let row = map.get(key);
    if (!row) {
      row = {
        id: key,
        testedAds: 0,
        acuteAds: 0,
        highAds: 0,
        watchAds: 0,
        lowAds: 0,
        hotZoneAds: 0,
        spend: 0,
        buyers: new Set<string>(),
        campaigns: new Set<string>(),
      };
      map.set(key, row);
    }
    row.testedAds += 1;
    row.spend += Number(ad.spend || 0);
    row[`${ad.reviewPressure.overallBand}Ads` as 'acuteAds'] += 1;
    if (ad.metaRisk.overallBand === 'black') row.hotZoneAds += 1;
    if (ad.buyer) row.buyers.add(ad.buyer);
    if (ad.campaignName) row.campaigns.add(ad.campaignName);
  }

  return Array.from(map.values())
    .map((row) => ({
      [label]: row.id,
      testedAds: row.testedAds,
      acuteAds: row.acuteAds,
      highAds: row.highAds,
      watchAds: row.watchAds,
      lowAds: row.lowAds,
      hotZoneAds: row.hotZoneAds,
      totalSpend: Number(row.spend.toFixed(2)),
      buyers: Array.from(row.buyers).sort(),
      campaigns: Array.from(row.campaigns).sort(),
    }))
    .sort((a, b) => b.acuteAds - a.acuteAds || b.highAds - a.highAds || b.totalSpend - a.totalSpend);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ads = readJsonArray(args.input);
  const testedAds = ads
    .filter((ad) => getMetaEngagementFixture(String(ad.adId || '')))
    .map((ad) => {
      const fixture = getMetaEngagementFixture(String(ad.adId || ''));
      const cluster = summarizeCluster(ads, ad);
      const reviewPressure = evaluateMetaReviewPressure({
        adId: String(ad.adId || ''),
        adName: ad.adName || null,
        buyer: ad.buyer || null,
        campaignName: ad.campaignName || null,
        pageId: ad.pageId || null,
        accountId: ad.accountId || null,
        rsocSite: ad.rsocSite || null,
        spend: Number(ad.spend || 0),
        overallBand: ad.overallBand,
        totalScore: Number(ad.totalScore || 0),
        assetBanRisk: ad.assetBanRisk || null,
        hotZone: Boolean(ad.hotZone),
        summary: Array.isArray(ad.summary) ? ad.summary : [],
        offendingMatches: Array.isArray(ad.offendingMatches) ? ad.offendingMatches : [],
        fixture,
        cluster,
      });

      return {
        adId: ad.adId,
        adName: ad.adName || null,
        buyer: ad.buyer || null,
        campaignName: ad.campaignName || null,
        rsocSite: ad.rsocSite || null,
        pageId: ad.pageId || null,
        accountId: ad.accountId || null,
        spend: Number(ad.spend || 0),
        metaRisk: {
          overallBand: ad.overallBand,
          totalScore: Number(ad.totalScore || 0),
          assetBanRisk: ad.assetBanRisk || null,
          hotZone: Boolean(ad.hotZone),
          topSurfaces: Array.isArray(ad.topSurfaces) ? ad.topSurfaces : [],
          summary: Array.isArray(ad.summary) ? ad.summary : [],
        },
        engagementFixture: fixture,
        visibleCommentLabels: summarizeVisibleLabels(fixture?.sampleComments || []),
        cluster,
        reviewPressure,
      };
    })
    .sort((a, b) => b.reviewPressure.totalScore - a.reviewPressure.totalScore || b.spend - a.spend);

  const counts = testedAds.reduce(
    (acc, ad) => {
      acc[ad.reviewPressure.overallBand] += 1;
      return acc;
    },
    { acute: 0, high: 0, watch: 0, low: 0 }
  );

  const summary = {
    testedAds: testedAds.length,
    fixtureInventory: META_ENGAGEMENT_FIXTURES.length,
    bands: counts,
    topAds: testedAds.slice(0, 5).map((ad) => ({
      adId: ad.adId,
      campaignName: ad.campaignName,
      buyer: ad.buyer,
      rsocSite: ad.rsocSite,
      metaBand: ad.metaRisk.overallBand,
      reviewPressureBand: ad.reviewPressure.overallBand,
      reviewPressureScore: ad.reviewPressure.totalScore,
      spend: ad.spend,
      comments: ad.engagementFixture?.comments ?? null,
      reasons: ad.reviewPressure.reasons,
    })),
  };

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(path.join(args.outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(args.outputDir, 'ads.json'), `${JSON.stringify(testedAds, null, 2)}\n`);
  fs.writeFileSync(
    path.join(args.outputDir, 'by-page.json'),
    `${JSON.stringify(aggregateBy(testedAds, (ad) => ad.pageId, 'pageId'), null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(args.outputDir, 'by-account.json'),
    `${JSON.stringify(aggregateBy(testedAds, (ad) => ad.accountId, 'accountId'), null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(args.outputDir, 'by-rsoc-site.json'),
    `${JSON.stringify(aggregateBy(testedAds, (ad) => ad.rsocSite, 'rsocSite'), null, 2)}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
