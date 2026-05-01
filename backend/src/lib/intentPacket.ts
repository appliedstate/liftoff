import crypto from 'crypto';
import { evaluateGoogleRsocCompliance } from './googleRsocPolicy';
import { scoreMetaAdBoundary } from './metaAdBoundaryScorer';
import { mapRsocSiteToS1GoogleAccount } from './rsocSiteMapping';

export type IntentPacketVertical =
  | 'health'
  | 'finance'
  | 'vehicles'
  | 'technology'
  | 'jobs'
  | 'general';

export type IntentPacketInput = {
  vertical?: IntentPacketVertical | null;
  market?: string | null;
  buyer?: string | null;
  rsocSite?: string | null;
  primaryKeyword: string;
  supportingKeywords?: string[];
  keywordEvidence?: Array<{
    keyword: string;
    revenue?: number | null;
    clicks?: number | null;
    rpc?: number | null;
    sessions?: number | null;
  }>;
  destinationDomain?: string | null;
  testBudgetDaily?: number | null;
};

export type IntentPacketAd = {
  angle: 'direct' | 'comparison' | 'qualification';
  headline: string;
  primaryText: string;
  cta: string;
  metaRisk: {
    overallBand: 'white' | 'grey' | 'black';
    totalScore: number;
    summary: string[];
  };
  googleRsocRisk: {
    overallBand: 'white' | 'grey' | 'black';
    totalScore: number;
    unsupportedPromises: string[];
    summary: string[];
  };
};

export type IntentPacket = {
  id: string;
  slug: string;
  packetName: string;
  vertical: IntentPacketVertical;
  market: string;
  buyer: string | null;
  rsocSite: string | null;
  s1GoogleAccount: string | null;
  destinationDomain: string | null;
  intent: {
    primaryKeyword: string;
    supportingKeywords: string[];
    packetHypothesis: string;
    conservedIntent: string;
    frictionRisks: string[];
  };
  article: {
    title: string;
    h1: string;
    metaDescription: string;
    summary: string;
    outline: string[];
    widgetKeywordPhrases: string[];
  };
  ads: IntentPacketAd[];
  launchTest: {
    campaignSeed: string;
    adSetSeed: string;
    recommendedDailyBudget: number;
    optimizationGoal: string;
    widgetKeywords: string[];
    checklist: string[];
  };
  scores: {
    monetizationPotential: number;
    keywordCommerciality: number;
    packetCoherence: number;
    metaRiskPenalty: number;
    googleRiskPenalty: number;
    evidenceConfidence: number;
    launchPriority: number;
  };
};

export type IntentPacketBatchResult = {
  packets: IntentPacket[];
  summary: {
    totalPackets: number;
    averageLaunchPriority: number;
    recommendedFirstPacketId: string | null;
  };
};

const TITLE_CASE_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

const VERTICAL_HINTS: Array<{ vertical: IntentPacketVertical; patterns: RegExp[] }> = [
  {
    vertical: 'health',
    patterns: [/\b(diabetes|trial|clinical|dental|implant|depression|anxious|neuropathy|treatment)\b/i],
  },
  {
    vertical: 'finance',
    patterns: [/\b(gold ira|ira|retirement|investing|debt|credit|loan|bonus|mortgage)\b/i],
  },
  {
    vertical: 'vehicles',
    patterns: [/\b(suv|truck|car|jeep|nissan|tesla|dealership|auto)\b/i],
  },
  {
    vertical: 'technology',
    patterns: [/\b(phone|tablet|internet|tech|smartphone|service plan)\b/i],
  },
  {
    vertical: 'jobs',
    patterns: [/\b(job|jobs|earn|income|delivery|drivers license|weekly)\b/i],
  },
];

function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_CASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function detectVertical(primaryKeyword: string, supportingKeywords: string[]): IntentPacketVertical {
  const corpus = [primaryKeyword, ...supportingKeywords].join(' ');
  for (const hint of VERTICAL_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(corpus))) return hint.vertical;
  }
  return 'general';
}

function scoreCommerciality(
  primaryKeyword: string,
  supportingKeywords: string[],
  keywordEvidence: IntentPacketInput['keywordEvidence']
): { keywordCommerciality: number; evidenceConfidence: number } {
  const corpus = [primaryKeyword, ...supportingKeywords].join(' ').toLowerCase();
  let score = 35;
  if (/\b(compare|best|top|quotes?|rates?|plans?|options?|near you|near me|kits?|bonus|free)\b/.test(corpus)) score += 25;
  if (/\b(clinical trial|research trial|ira|insurance|loan|dealership|phones?)\b/.test(corpus)) score += 20;
  if (/\b(cheap|low cost|no cost|\$0|save|discount)\b/.test(corpus)) score += 10;
  if (/\b(what is|how to|guide|definition)\b/.test(corpus)) score -= 10;
  let evidenceConfidence = 0;
  if (keywordEvidence?.length) {
    const rpcValues = keywordEvidence.map((row) => Number(row.rpc || 0)).filter((value) => value > 0);
    const revenueValues = keywordEvidence.map((row) => Number(row.revenue || 0)).filter((value) => value > 0);
    const clicksValues = keywordEvidence.map((row) => Number(row.clicks || 0)).filter((value) => value > 0);
    if (rpcValues.length) score += Math.min(20, Math.round((rpcValues.reduce((a, b) => a + b, 0) / rpcValues.length) * 20));
    if (revenueValues.length) score += Math.min(10, Math.round(Math.log10(revenueValues.reduce((a, b) => a + b, 0) + 1) * 4));
    evidenceConfidence = Math.min(
      100,
      (rpcValues.length ? 40 : 0) + (revenueValues.length ? 30 : 0) + (clicksValues.length ? 30 : 0)
    );
  }
  return {
    keywordCommerciality: Math.max(0, Math.min(100, score)),
    evidenceConfidence,
  };
}

function buildArticle(primaryKeyword: string, supportingKeywords: string[], vertical: IntentPacketVertical) {
  const keywordTitle = titleCase(primaryKeyword);
  const comparisonKeyword = supportingKeywords[0] || primaryKeyword;
  const title = (() => {
    if (vertical === 'finance') return `${keywordTitle}: What to Know Before You Start`;
    if (vertical === 'health') return `${keywordTitle}: What People Should Review Before Taking the Next Step`;
    if (vertical === 'vehicles') return `${keywordTitle}: How to Compare Today’s Best Options`;
    if (vertical === 'technology') return `${keywordTitle}: Compare the Options Before You Click`;
    if (vertical === 'jobs') return `${keywordTitle}: What to Check Before You Apply`;
    return `${keywordTitle}: A Practical Guide to the Best Options`;
  })();

  const summary = (() => {
    if (vertical === 'finance') {
      return `This article frames ${primaryKeyword} around comparison, eligibility, and the next action a user should take before choosing an option. It should support RSOC widget clicks on closely related financial phrases.`;
    }
    if (vertical === 'health') {
      return `This article frames ${primaryKeyword} as a research and comparison decision, not a medical promise. It should lead naturally into keyword clicks for related trial or treatment options without overclaiming.`;
    }
    if (vertical === 'vehicles') {
      return `This article frames ${primaryKeyword} as a comparison shopping decision with clear next-step keywords that can flow into a Google advertiser click.`;
    }
    if (vertical === 'technology') {
      return `This article frames ${primaryKeyword} around comparison, price sensitivity, and available options so the RSOC widget feels like the natural next step.`;
    }
    if (vertical === 'jobs') {
      return `This article frames ${primaryKeyword} around availability, requirements, and next steps, while keeping claims grounded enough to avoid the most obvious job-scam triggers.`;
    }
    return `This article frames ${primaryKeyword} around concrete options and tradeoffs so the user can continue into related search terms with low intent loss.`;
  })();

  const outline = [
    `Why ${primaryKeyword} is getting attention right now`,
    `How to compare ${comparisonKeyword} without wasting clicks`,
    `What to review before choosing the next step`,
    `Which related searches are worth checking first`,
    `How to use the comparison widget below`,
  ];

  const widgetKeywordPhrases = dedupe([
    titleCase(primaryKeyword),
    ...supportingKeywords.slice(0, 4).map((keyword) => titleCase(keyword)),
    `Best ${titleCase(primaryKeyword)}`,
  ]).slice(0, 5);

  return {
    title,
    h1: title,
    metaDescription: summary,
    summary,
    outline,
    widgetKeywordPhrases,
  };
}

function buildAdVariants(primaryKeyword: string, supportingKeywords: string[], vertical: IntentPacketVertical, article: ReturnType<typeof buildArticle>, rsocSite: string | null) {
  const comparePhrase = supportingKeywords[0] || `best ${primaryKeyword}`;
  const safeCTA = vertical === 'health' ? 'LEARN_MORE' : 'LEARN_MORE';
  const routeUrl = rsocSite ? `https://${rsocSite}/route?keyword=${encodeURIComponent(primaryKeyword)}` : null;

  const variants = [
    {
      angle: 'direct' as const,
      headline: titleCase(primaryKeyword),
      primaryText: `Review ${primaryKeyword} and compare the strongest options before you click into the next step.`,
      cta: safeCTA,
    },
    {
      angle: 'comparison' as const,
      headline: `Compare ${titleCase(comparePhrase)}`,
      primaryText: `See how ${primaryKeyword} stacks up against the most relevant alternatives, then use the related searches below to keep going.`,
      cta: safeCTA,
    },
    {
      angle: 'qualification' as const,
      headline: `See the Best ${titleCase(primaryKeyword)} Options`,
      primaryText: `Start with the article, then use the keyword widget to compare the option that best fits what you are looking for.`,
      cta: safeCTA,
    },
  ];

  return variants.map((variant) => {
    const meta = scoreMetaAdBoundary([variant.primaryText, variant.headline, variant.cta].join('\n'));
    const google = evaluateGoogleRsocCompliance({
      primaryText: variant.primaryText,
      headline: variant.headline,
      cta: variant.cta,
      routeUrl,
      intendedUrl: routeUrl,
      landingArticleTitle: article.title,
      landingArticleSummary: article.summary,
      landingArticleBody: article.outline.join('. '),
      landingMetaDescription: article.metaDescription,
      rsocKeywords: article.widgetKeywordPhrases,
      rsocKeywordSource: 'url_forcekeys',
      urlParamKeywordPhrases: article.widgetKeywordPhrases,
      referrerProof: {
        isArbitrage: true,
        hasReferrerProof: false,
        status: 'missing_proof',
      },
      rsocSite,
      s1GoogleAccount: mapRsocSiteToS1GoogleAccount(rsocSite),
    });

    return {
      ...variant,
      metaRisk: {
        overallBand: meta.overallBand,
        totalScore: meta.totalScore,
        summary: meta.summary,
      },
      googleRsocRisk: {
        overallBand: google.overallBand,
        totalScore: google.totalScore,
        unsupportedPromises: google.evidence.unsupportedPromises,
        summary: google.summary,
      },
    };
  });
}

function buildFrictionRisks(vertical: IntentPacketVertical, ads: IntentPacketAd[]): string[] {
  const risks = new Set<string>();
  if (vertical === 'health') risks.add('Health-trial style copy can drift into personal-attribute inference quickly.');
  if (vertical === 'finance') risks.add('Financial framing can outrun what the landing page actually supports.');
  if (vertical === 'jobs') risks.add('Job/opportunity language can trip misleading-opportunity enforcement fast.');
  if (ads.some((ad) => ad.metaRisk.overallBand !== 'white')) risks.add('At least one ad variant is already creating Meta policy pressure.');
  if (ads.some((ad) => ad.googleRsocRisk.overallBand !== 'white')) risks.add('At least one ad/article/keyword handoff creates RSOC policy pressure.');
  return Array.from(risks);
}

function buildScores(
  primaryKeyword: string,
  supportingKeywords: string[],
  ads: IntentPacketAd[],
  keywordEvidence: IntentPacketInput['keywordEvidence']
) {
  const { keywordCommerciality, evidenceConfidence } = scoreCommerciality(primaryKeyword, supportingKeywords, keywordEvidence);
  const metaPenalty = Math.max(...ads.map((ad) => ad.metaRisk.totalScore), 0);
  const googlePenalty = Math.max(...ads.map((ad) => ad.googleRsocRisk.totalScore), 0);
  const packetCoherence = Math.max(0, Math.min(100, 100 - Math.round(metaPenalty / 2) - Math.round(googlePenalty / 2)));
  const monetizationPotential = Math.max(
    0,
    Math.min(100, Math.round((keywordCommerciality * 0.55) + (packetCoherence * 0.25) + (evidenceConfidence * 0.2)))
  );
  const launchPriority = Math.max(
    0,
    Math.min(100, monetizationPotential - Math.round(metaPenalty * 0.35) - Math.round(googlePenalty * 0.25))
  );

  return {
    monetizationPotential,
    keywordCommerciality,
    packetCoherence,
    metaRiskPenalty: metaPenalty,
    googleRiskPenalty: googlePenalty,
    evidenceConfidence,
    launchPriority,
  };
}

function buildPacketHypothesis(primaryKeyword: string, articleTitle: string): string {
  return `If we frame ${primaryKeyword} through "${articleTitle}" and keep the widget aligned to the same search intent, we should get cleaner RSOC clicks without losing the user between ad, article, and search.`;
}

export function generateIntentPacket(input: IntentPacketInput): IntentPacket {
  const primaryKeyword = String(input.primaryKeyword || '').trim();
  if (!primaryKeyword) {
    throw new Error('primaryKeyword is required');
  }

  const supportingKeywords = dedupe(input.supportingKeywords || []).filter((keyword) => keyword.toLowerCase() !== primaryKeyword.toLowerCase());
  const vertical = input.vertical || detectVertical(primaryKeyword, supportingKeywords);
  const market = String(input.market || 'US').trim() || 'US';
  const buyer = input.buyer ? String(input.buyer).trim() : null;
  const rsocSite = input.rsocSite ? String(input.rsocSite).trim() : null;
  const destinationDomain = input.destinationDomain ? String(input.destinationDomain).trim() : rsocSite;
  const article = buildArticle(primaryKeyword, supportingKeywords, vertical);
  const ads = buildAdVariants(primaryKeyword, supportingKeywords, vertical, article, rsocSite);
  const frictionRisks = buildFrictionRisks(vertical, ads);
  const scores = buildScores(primaryKeyword, supportingKeywords, ads, input.keywordEvidence);
  const slug = slugify(primaryKeyword);
  const packetName = `${titleCase(primaryKeyword)} Intent Packet`;
  const campaignSeed = `${slug.slice(0, 18)}_${market.toLowerCase()}_test`;
  const adSetSeed = `${slug.slice(0, 12)}_${vertical}_v1`;
  const recommendedDailyBudget = Math.max(50, Number(input.testBudgetDaily || 150));
  const id = crypto.createHash('sha1').update(`${vertical}|${primaryKeyword}|${supportingKeywords.join('|')}|${rsocSite || ''}`).digest('hex').slice(0, 16);

  return {
    id,
    slug,
    packetName,
    vertical,
    market,
    buyer,
    rsocSite,
    s1GoogleAccount: mapRsocSiteToS1GoogleAccount(rsocSite),
    destinationDomain,
    intent: {
      primaryKeyword,
      supportingKeywords,
      packetHypothesis: buildPacketHypothesis(primaryKeyword, article.title),
      conservedIntent: `User wants to evaluate ${primaryKeyword} and then click into the most relevant commercial option.`,
      frictionRisks,
    },
    article,
    ads,
    launchTest: {
      campaignSeed,
      adSetSeed,
      recommendedDailyBudget,
      optimizationGoal: 'LINK_CLICKS',
      widgetKeywords: article.widgetKeywordPhrases,
      checklist: [
        'Generate article draft and confirm the title/H1 directly supports the top keyword.',
        'Confirm widget keyword order matches the intent packet keyword hierarchy.',
        'Create 2-3 ads from the packet and keep claims inside the article’s actual support envelope.',
        'Launch a low-budget Facebook test and monitor approval, CTR, and RSOC clickthrough.',
        'Compare advertiser-click revenue against packet-level spend before scaling.',
      ],
    },
    scores,
  };
}

export function generateIntentPacketBatch(inputs: IntentPacketInput[]): IntentPacketBatchResult {
  const packets = inputs.map((input) => generateIntentPacket(input)).sort((a, b) => b.scores.launchPriority - a.scores.launchPriority);
  const averageLaunchPriority = packets.length
    ? Number((packets.reduce((sum, packet) => sum + packet.scores.launchPriority, 0) / packets.length).toFixed(2))
    : 0;

  return {
    packets,
    summary: {
      totalPackets: packets.length,
      averageLaunchPriority,
      recommendedFirstPacketId: packets[0]?.id || null,
    },
  };
}
