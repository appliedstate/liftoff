import fs from 'fs';
import path from 'path';
import { summarizeComments } from '../../lib/commentComplaintClassifier';
import { getMetaEngagementFixture, META_ENGAGEMENT_FIXTURES } from '../../lib/metaEngagementFixtures';
import {
  countMetaReactions,
  labelMetaReactionSentiment,
  scoreMetaReactionSentiment,
} from '../../lib/metaReactionSentiment';

type JsonRecord = Record<string, any>;

type Args = {
  input: string;
  output: string;
  spendMin: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    input: path.resolve(process.cwd(), '.local/strategis/facebook/meta-risk-analysis/ads.json'),
    output: path.resolve(process.cwd(), '.local/strategis/facebook/review-pressure-prototype/reaction-sentiment.json'),
    spendMin: 5,
  };

  for (const raw of argv) {
    const [flag, value = ''] = raw.split('=');
    if (flag === '--input' && value) args.input = path.resolve(process.cwd(), value);
    if (flag === '--output' && value) args.output = path.resolve(process.cwd(), value);
    if (flag === '--spend-min' && value) args.spendMin = Number(value);
  }

  return args;
}

function readJsonArray(filePath: string): JsonRecord[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function commentSentimentLabel(comments: string[]): 'unknown' | 'negative' | 'mixed' | 'positive' {
  if (!comments.length) return 'unknown';
  const summary = summarizeComments(comments);
  if (summary.negativeRate >= 0.5) return 'negative';
  if (summary.sentiments.positive > 0 && summary.sentiments.negative === 0) return 'positive';
  if (summary.sentiments.negative > 0 || summary.sentiments.positive > 0) return 'mixed';
  return 'unknown';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ads = readJsonArray(args.input);

  const reviewedAds = ads
    .filter((ad) => Number(ad.spend || 0) > args.spendMin)
    .map((ad) => {
      const fixture = getMetaEngagementFixture(String(ad.adId || ''));
      if (!fixture) return null;

      const reactionSentimentScore = scoreMetaReactionSentiment(fixture.reactionBreakdown);
      const reactionSentimentLabel = labelMetaReactionSentiment(reactionSentimentScore);

      return {
        adId: String(ad.adId || ''),
        adName: ad.adName || null,
        buyer: ad.buyer || null,
        campaignName: ad.campaignName || null,
        spend: Number(ad.spend || 0),
        reactions: fixture.reactions,
        reactionBreakdownAvailable: Boolean(fixture.reactionBreakdown),
        reactionBreakdownCapturedTotal: countMetaReactions(fixture.reactionBreakdown),
        reactionSentimentLabel,
        reactionSentimentScore,
        visibleCommentSentimentLabel: commentSentimentLabel(fixture.sampleComments),
        visibleCommentSamples: fixture.sampleComments.length,
        notes: fixture.notes || null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.spend - a.spend || (b.reactions || 0) - (a.reactions || 0));

  const summary = reviewedAds.reduce(
    (acc, ad) => {
      acc.totalReviewedAds += 1;
      acc.reactionSentiment[ad.reactionSentimentLabel] += 1;
      acc.visibleCommentSentiment[ad.visibleCommentSentimentLabel] += 1;
      if (ad.reactionBreakdownAvailable) acc.breakdownAvailableAds += 1;
      return acc;
    },
    {
      totalReviewedAds: 0,
      breakdownAvailableAds: 0,
      fixtureInventory: META_ENGAGEMENT_FIXTURES.length,
      reactionSentiment: {
        unknown: 0,
        strongly_negative: 0,
        negative: 0,
        mixed: 0,
        positive: 0,
        strongly_positive: 0,
      },
      visibleCommentSentiment: {
        unknown: 0,
        negative: 0,
        mixed: 0,
        positive: 0,
      },
    }
  );

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(
    args.output,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        spendMin: args.spendMin,
        summary,
        reviewedAds,
      },
      null,
      2
    )
  );

  console.log(`Wrote reaction sentiment report for ${reviewedAds.length} reviewed ads to ${args.output}`);
}

main();
