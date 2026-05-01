import { MetaReactionBreakdown } from './metaReactionSentiment';

export type MetaEngagementFixture = {
  adId: string;
  storyId: string | null;
  source: 'manual_browser_prototype';
  capturedAt: string;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  approximateCounts: boolean;
  reactionBreakdown?: MetaReactionBreakdown | null;
  sampleComments: string[];
  notes?: string | null;
};

export const META_ENGAGEMENT_FIXTURES: MetaEngagementFixture[] = [
  {
    adId: '120241636353480439',
    storyId: '257670250760352_122286250766234744',
    source: 'manual_browser_prototype',
    capturedAt: '2026-04-24',
    reactions: 238,
    comments: 60,
    shares: 20,
    approximateCounts: false,
    reactionBreakdown: null,
    sampleComments: [
      'Hi beautiful',
      'Amen',
      'Wow',
      "Wow that's awesome",
      'I like to have that too today',
      'Yes',
    ],
    notes: 'Low-risk control ad captured from the live Facebook reel view.',
  },
  {
    adId: '120239758294690461',
    storyId: '429349243595725_122192312288530731',
    source: 'manual_browser_prototype',
    capturedAt: '2026-04-24',
    reactions: 323,
    comments: 12,
    shares: 13,
    approximateCounts: false,
    reactionBreakdown: {
      like: 430,
      love: 22,
      care: 3,
      haha: 2,
    },
    sampleComments: [],
    notes:
      'Hot-zone depression-trial ad. The reel showed comment volume but the visible comment rail returned "No comments yet" during capture. Reaction breakdown was backfilled from the Facebook permalink reactor dialog on 2026-04-27.',
  },
  {
    adId: '120237146791920485',
    storyId: '233217303206930_122309771978198639',
    source: 'manual_browser_prototype',
    capturedAt: '2026-04-24',
    reactions: 4400,
    comments: 482,
    shares: 230,
    approximateCounts: true,
    reactionBreakdown: {
      like: 4278,
      love: 138,
      care: 21,
      haha: 42,
      wow: 17,
      sad: 3,
      angry: 9,
    },
    sampleComments: [
      'I like to try that clinical trial',
      'Coffee is good for your health.',
      'Hope is true',
      "Yes. I'll miss you in twenty",
      'That would be nice',
      'Thank you Lord',
    ],
    notes:
      'Hot-zone diabetes-trial ad. Reaction count was rendered as 4.4K in the reel UI, so the stored reaction count is approximate. Reaction breakdown was backfilled from the Facebook permalink reactor dialog on 2026-04-27.',
  },
  {
    adId: '120234434254120424',
    storyId: '447881721741024_122193303554561525',
    source: 'manual_browser_prototype',
    capturedAt: '2026-04-24',
    reactions: 374,
    comments: 90,
    shares: 19,
    approximateCounts: false,
    reactionBreakdown: {
      like: 353,
      love: 16,
      care: 1,
      haha: 3,
      wow: 1,
    },
    sampleComments: [
      'Love my are a mess',
      'Love them done but live in uk',
      'Sounds good',
      'Would love them done',
      'I wish would love them',
      "Oh I would really love my teeth done! I'm constantly at the dentist 😔",
    ],
    notes:
      'Hot-zone dental-implant-trial ad captured from the live Facebook reel view. Reaction breakdown was backfilled from the Facebook permalink reactor dialog on 2026-04-27.',
  },
];

export function getMetaEngagementFixture(adId: string | null | undefined): MetaEngagementFixture | null {
  const normalized = String(adId || '').trim();
  if (!normalized) return null;
  return META_ENGAGEMENT_FIXTURES.find((fixture) => fixture.adId === normalized) || null;
}
