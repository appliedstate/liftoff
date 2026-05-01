export type CommentSentiment = 'positive' | 'neutral' | 'negative';

export type CommentComplaintLabel =
  | 'fraud'
  | 'spam'
  | 'bait_switch'
  | 'landing_failure'
  | 'generic_negative'
  | 'neutral'
  | 'positive';

export type ClassifiedComment = {
  text: string;
  sentiment: CommentSentiment;
  labels: CommentComplaintLabel[];
  matchedPhrases: string[];
};

export type CommentComplaintSummary = {
  totalComments: number;
  visibleComments: number;
  sentiments: Record<CommentSentiment, number>;
  labels: Record<CommentComplaintLabel, number>;
  complaintComments: string[];
  complaintRate: number;
  negativeRate: number;
  positiveRate: number;
  dominantSentiment: CommentSentiment;
  sentimentScore: number;
  sentimentBand: 'positive' | 'mixed' | 'negative' | 'unknown';
};

type PhraseMatcher = {
  label: Extract<CommentComplaintLabel, 'fraud' | 'spam' | 'bait_switch' | 'landing_failure' | 'generic_negative' | 'positive'>;
  patterns: RegExp[];
};

const MATCHERS: PhraseMatcher[] = [
  {
    label: 'fraud',
    patterns: [/\b(scam|fraud|fake|not legit|rip[- ]?off|con artist|stolen|steal(?:ing)?)\b/i],
  },
  {
    label: 'spam',
    patterns: [/\b(spam|report(?:ing)? this|reported|clickbait|bot|phishing|misleading|lie|lying)\b/i],
  },
  {
    label: 'bait_switch',
    patterns: [
      /\b(not what i clicked|wrong page|sent me somewhere else|took me to yahoo|why am i seeing yahoo|bait and switch|bait[- ]?switch)\b/i,
    ],
  },
  {
    label: 'landing_failure',
    patterns: [/\b(broken|doesn'?t work|won'?t load|cant load|cannot load|error page|link is dead|page not found)\b/i],
  },
  {
    label: 'generic_negative',
    patterns: [/\b(terrible|awful|hate this|bad ad|annoying|stupid|dumb|gross)\b/i],
  },
  {
    label: 'positive',
    patterns: [/\b(amen|wow|awesome|sounds good|yes\b|love|thank you|hope|nice|beautiful)\b/i],
  },
];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function roundRate(value: number): number {
  return Number(value.toFixed(4));
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

export function classifyComment(text: string): ClassifiedComment {
  const normalized = String(text || '').trim();
  const labels: CommentComplaintLabel[] = [];
  const matchedPhrases: string[] = [];

  for (const matcher of MATCHERS) {
    for (const pattern of matcher.patterns) {
      const match = normalized.match(pattern);
      if (!match) continue;
      labels.push(matcher.label);
      matchedPhrases.push(match[0]);
    }
  }

  const deduped = unique(labels);
  if (!deduped.length) {
    deduped.push('neutral');
  }

  let sentiment: CommentSentiment = 'neutral';
  if (deduped.some((label) => ['fraud', 'spam', 'bait_switch', 'landing_failure', 'generic_negative'].includes(label))) {
    sentiment = 'negative';
  } else if (deduped.includes('positive')) {
    sentiment = 'positive';
  }

  if (sentiment === 'negative' && !deduped.includes('generic_negative')) {
    // Keep a stable generic negative bucket for simple rate calculations.
    deduped.push('generic_negative');
  }

  return {
    text: normalized,
    sentiment,
    labels: unique(deduped),
    matchedPhrases: unique(matchedPhrases),
  };
}

export function summarizeComments(comments: string[]): CommentComplaintSummary {
  const rows = comments.map((comment) => classifyComment(comment));
  const sentiments: Record<CommentSentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  const labels: Record<CommentComplaintLabel, number> = {
    fraud: 0,
    spam: 0,
    bait_switch: 0,
    landing_failure: 0,
    generic_negative: 0,
    neutral: 0,
    positive: 0,
  };

  for (const row of rows) {
    sentiments[row.sentiment] += 1;
    for (const label of row.labels) labels[label] += 1;
  }

  const visibleComments = rows.length;
  const complaintComments = rows
    .filter((row) =>
      row.labels.some((label) => ['fraud', 'spam', 'bait_switch', 'landing_failure', 'generic_negative'].includes(label))
    )
    .map((row) => row.text);

  const dominantSentiment =
    visibleComments === 0
      ? 'neutral'
      : sentiments.negative >= sentiments.positive && sentiments.negative >= sentiments.neutral
        ? 'negative'
        : sentiments.positive >= sentiments.neutral
        ? 'positive'
          : 'neutral';

  const sentimentScore = visibleComments
    ? roundScore(((sentiments.positive - sentiments.negative) / visibleComments) * 100)
    : 0;
  const sentimentBand =
    visibleComments === 0
      ? 'unknown'
      : sentimentScore >= 25
        ? 'positive'
        : sentimentScore <= -25
          ? 'negative'
          : 'mixed';

  return {
    totalComments: comments.length,
    visibleComments,
    sentiments,
    labels,
    complaintComments,
    complaintRate: visibleComments ? roundRate(complaintComments.length / visibleComments) : 0,
    negativeRate: visibleComments ? roundRate(sentiments.negative / visibleComments) : 0,
    positiveRate: visibleComments ? roundRate(sentiments.positive / visibleComments) : 0,
    dominantSentiment,
    sentimentScore,
    sentimentBand,
  };
}
