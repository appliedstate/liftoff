export const META_REACTION_TYPES = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'] as const;

export type MetaReactionType = (typeof META_REACTION_TYPES)[number];

export type MetaReactionBreakdown = Partial<Record<MetaReactionType, number>>;

export type MetaReactionSentimentLabel =
  | 'unknown'
  | 'strongly_negative'
  | 'negative'
  | 'mixed'
  | 'positive'
  | 'strongly_positive';

export const META_REACTION_SENTIMENT_WEIGHTS: Record<MetaReactionType, number> = {
  like: 1,
  love: 2,
  care: 1.5,
  haha: 0.5,
  wow: 0.5,
  sad: -1,
  angry: -2,
};

export const FACEBOOK_REACTION_ID_MAP: Record<string, MetaReactionType> = {
  '1635855486666999': 'like',
  '1678524932434102': 'love',
  '613557422527858': 'care',
  '115940658764963': 'haha',
  '478547315650144': 'wow',
  '908563459236466': 'sad',
  '444813342392137': 'angry',
};

export function countMetaReactions(breakdown: MetaReactionBreakdown | null | undefined): number {
  if (!breakdown) return 0;
  return META_REACTION_TYPES.reduce((sum, key) => sum + Number(breakdown[key] || 0), 0);
}

export function scoreMetaReactionSentiment(breakdown: MetaReactionBreakdown | null | undefined): number | null {
  const total = countMetaReactions(breakdown);
  if (!total || !breakdown) return null;

  let weighted = 0;
  for (const key of META_REACTION_TYPES) {
    weighted += Number(breakdown[key] || 0) * META_REACTION_SENTIMENT_WEIGHTS[key];
  }

  return Number(((weighted / (total * 2)) * 100).toFixed(2));
}

export function labelMetaReactionSentiment(score: number | null | undefined): MetaReactionSentimentLabel {
  if (score === null || score === undefined || Number.isNaN(score)) return 'unknown';
  if (score <= -35) return 'strongly_negative';
  if (score < -10) return 'negative';
  if (score < 15) return 'mixed';
  if (score < 40) return 'positive';
  return 'strongly_positive';
}
