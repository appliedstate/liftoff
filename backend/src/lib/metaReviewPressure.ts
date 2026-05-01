import { AssetBanRisk, MetaRiskBand } from './metaAdBoundaryScorer';
import { CommentComplaintSummary, summarizeComments } from './commentComplaintClassifier';
import { MetaEngagementFixture } from './metaEngagementFixtures';
import {
  labelMetaReactionSentiment,
  MetaReactionBreakdown,
  MetaReactionSentimentLabel,
  scoreMetaReactionSentiment,
} from './metaReactionSentiment';

export type MetaReviewPressureBand = 'low' | 'watch' | 'high' | 'acute';

export type MetaReviewPressureCluster = {
  pageHotZoneAds: number;
  pageHotZonePct: number;
  accountHotZoneAds: number;
  accountHotZonePct: number;
  siteHotZoneAds: number;
  siteHotZonePct: number;
};

export type MetaReviewPressureInput = {
  adId: string;
  adName?: string | null;
  buyer?: string | null;
  campaignName?: string | null;
  pageId?: string | null;
  accountId?: string | null;
  rsocSite?: string | null;
  spend?: number | null;
  overallBand: MetaRiskBand;
  totalScore: number;
  assetBanRisk?: AssetBanRisk | null;
  hotZone?: boolean;
  summary?: string[];
  offendingMatches?: string[];
  fixture?: MetaEngagementFixture | null;
  cluster?: MetaReviewPressureCluster | null;
};

export type MetaReviewPressureResult = {
  overallBand: MetaReviewPressureBand;
  totalScore: number;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  componentScores: {
    policyScore: number;
    spendScore: number;
    attentionScore: number;
    complaintScore: number;
    clusterScore: number;
  };
  signals: {
    hotZone: boolean;
    engagementFixturePresent: boolean;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    approximateCounts: boolean;
    reactionBreakdownAvailable: boolean;
    reactionBreakdown: MetaReactionBreakdown | null;
    reactionSentimentScore: number | null;
    reactionSentimentLabel: MetaReactionSentimentLabel;
    complaintSummary: CommentComplaintSummary;
  };
};

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreSpend(spend: number): number {
  if (spend >= 1000) return 20;
  if (spend >= 500) return 16;
  if (spend >= 200) return 12;
  if (spend >= 50) return 8;
  if (spend > 5) return 4;
  return 0;
}

function scoreAttention(reactions: number, comments: number, shares: number): number {
  let score = 0;
  if (comments >= 400) score += 8;
  else if (comments >= 100) score += 6;
  else if (comments >= 40) score += 4;
  else if (comments >= 10) score += 2;
  else if (comments > 0) score += 1;

  if (reactions >= 3000) score += 4;
  else if (reactions >= 500) score += 3;
  else if (reactions >= 100) score += 2;
  else if (reactions > 0) score += 1;

  if (shares >= 100) score += 3;
  else if (shares >= 20) score += 2;
  else if (shares > 0) score += 1;

  return cap(score, 0, 15);
}

function scoreComplaintPressure(summary: CommentComplaintSummary, visibleComments: number, totalComments: number): number {
  let score = 0;
  score += summary.labels.fraud * 12;
  score += summary.labels.spam * 10;
  score += summary.labels.bait_switch * 10;
  score += summary.labels.landing_failure * 10;
  score += summary.labels.generic_negative * 4;

  if (summary.negativeRate >= 0.5) score += 8;
  else if (summary.negativeRate >= 0.25) score += 5;
  else if (summary.negativeRate > 0) score += 2;

  if (!visibleComments && totalComments >= 10) {
    score += 3;
  }

  return cap(score, 0, 25);
}

function scoreCluster(cluster: MetaReviewPressureCluster | null | undefined): number {
  if (!cluster) return 0;
  let score = 0;

  if (cluster.pageHotZoneAds >= 10 && cluster.pageHotZonePct >= 10) score += 6;
  else if (cluster.pageHotZoneAds >= 5 && cluster.pageHotZonePct >= 5) score += 4;
  else if (cluster.pageHotZoneAds >= 1) score += 2;

  if (cluster.accountHotZoneAds >= 10 && cluster.accountHotZonePct >= 10) score += 5;
  else if (cluster.accountHotZoneAds >= 5 && cluster.accountHotZonePct >= 5) score += 3;
  else if (cluster.accountHotZoneAds >= 1) score += 1;

  if (cluster.siteHotZoneAds >= 10 && cluster.siteHotZonePct >= 10) score += 4;
  else if (cluster.siteHotZoneAds >= 5 && cluster.siteHotZonePct >= 5) score += 2;
  else if (cluster.siteHotZoneAds >= 1) score += 1;

  return cap(score, 0, 15);
}

function scorePolicyRisk(overallBand: MetaRiskBand, totalScore: number, assetBanRisk: AssetBanRisk | null | undefined): number {
  let score = 0;
  if (overallBand === 'black') score += 30;
  else if (overallBand === 'grey') score += 18;
  else score += 6;

  score += cap(Math.round(totalScore / 8), 0, 12);

  if (assetBanRisk === 'critical') score += 3;
  else if (assetBanRisk === 'high') score += 2;
  else if (assetBanRisk === 'moderate') score += 1;

  return cap(score, 0, 45);
}

function bandForScore(score: number): MetaReviewPressureBand {
  if (score >= 80) return 'acute';
  if (score >= 60) return 'high';
  if (score >= 35) return 'watch';
  return 'low';
}

export function evaluateMetaReviewPressure(input: MetaReviewPressureInput): MetaReviewPressureResult {
  const fixture = input.fixture || null;
  const commentSummary = summarizeComments(fixture?.sampleComments || []);
  const spend = Number(input.spend || 0);
  const reactions = Number(fixture?.reactions || 0);
  const comments = Number(fixture?.comments || 0);
  const shares = Number(fixture?.shares || 0);
  const reactionSentimentScore = scoreMetaReactionSentiment(fixture?.reactionBreakdown);
  const reactionSentimentLabel = labelMetaReactionSentiment(reactionSentimentScore);

  const policyScore = scorePolicyRisk(input.overallBand, input.totalScore, input.assetBanRisk || null);
  const spendScore = scoreSpend(spend);
  const attentionScore = fixture ? scoreAttention(reactions, comments, shares) : 0;
  const complaintScore = fixture
    ? scoreComplaintPressure(commentSummary, fixture.sampleComments.length, comments)
    : 0;
  const clusterScore = scoreCluster(input.cluster);

  const totalScore = policyScore + spendScore + attentionScore + complaintScore + clusterScore;
  const overallBand = bandForScore(totalScore);

  const reasons: string[] = [];
  if (input.hotZone || input.overallBand === 'black') {
    reasons.push('The ad is already in the Meta hot zone on copy-level policy risk.');
  }
  if (spendScore >= 12) {
    reasons.push(`Spend is high enough to generate meaningful review exposure ($${spend.toFixed(2)}).`);
  } else if (spendScore > 0) {
    reasons.push(`The ad is spending today ($${spend.toFixed(2)}), which increases exposure to review and complaints.`);
  }
  if (attentionScore >= 10) {
    reasons.push('Public engagement is high, which raises the odds of complaint-driven re-review.');
  } else if (attentionScore > 0) {
    reasons.push('The ad has visible public engagement, so comment sentiment should be monitored.');
  }
  if (!fixture?.reactionBreakdown && fixture?.reactions) {
    reasons.push('Reaction count is available, but the type breakdown is not yet captured, so reaction sentiment is still unknown.');
  }
  if (complaintScore >= 12) {
    reasons.push('Visible comments contain direct complaint language that could increase review pressure.');
  } else if (fixture && !fixture.sampleComments.length && comments >= 10) {
    reasons.push('Comment volume exists, but the captured snapshot did not expose the visible comment bodies; complaint pressure is still partially unknown.');
  } else if (fixture && commentSummary.sentiments.negative === 0) {
    reasons.push('The sampled visible comments did not show explicit spam/fraud complaint language.');
  }
  if (clusterScore >= 8) {
    reasons.push('The surrounding page/account/site cluster already concentrates hot-zone ads, which compounds account-level enforcement risk.');
  } else if (clusterScore > 0) {
    reasons.push('The ad sits inside a cluster that already has some hot-zone concentration.');
  }

  const confidence =
    fixture && fixture.sampleComments.length >= 4
      ? 'high'
      : fixture
        ? 'medium'
        : 'low';

  return {
    overallBand,
    totalScore,
    confidence,
    reasons,
    componentScores: {
      policyScore,
      spendScore,
      attentionScore,
      complaintScore,
      clusterScore,
    },
    signals: {
      hotZone: Boolean(input.hotZone || input.overallBand === 'black'),
      engagementFixturePresent: Boolean(fixture),
      reactions: fixture?.reactions ?? null,
      comments: fixture?.comments ?? null,
      shares: fixture?.shares ?? null,
      approximateCounts: Boolean(fixture?.approximateCounts),
      reactionBreakdownAvailable: Boolean(fixture?.reactionBreakdown),
      reactionBreakdown: fixture?.reactionBreakdown ?? null,
      reactionSentimentScore,
      reactionSentimentLabel,
      complaintSummary: commentSummary,
    },
  };
}
