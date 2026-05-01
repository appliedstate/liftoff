import fs from 'fs';
import path from 'path';
import { generateText } from './openai';
import {
  AssetBanRisk,
  MetaBoundaryScore,
  MetaRiskBand,
  scoreMetaAdBoundary,
} from './metaAdBoundaryScorer';

export const META_POLICY_HARNESS_VERSION = 'v2';
export const META_POLICY_WRITER_PROMPT_VERSION = 'v2-halbert-inspired-awareness';
const TARGET_REWRITE_VARIANT_COUNT = 3;

export type MetaAdSurfaceKey =
  | 'transcript'
  | 'primaryText'
  | 'headline'
  | 'description'
  | 'cta';

export type MetaAdHarnessInput = {
  transcript?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  cta?: string;
  landingArticleTitle?: string;
  landingArticleSummary?: string;
  landingArticleBody?: string;
  offerType?: string;
  audience?: string;
  knownRejectionReason?: string;
  forbiddenPhrases?: string[];
  targetBand?: MetaRiskBand;
  forceRewrite?: boolean;
};

export type NormalizedMetaAdBundle = {
  transcript: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  landingArticleTitle: string;
  landingArticleSummary: string;
  landingArticleBody: string;
  offerType: string;
  audience: string;
  knownRejectionReason: string;
  forbiddenPhrases: string[];
  targetBand: MetaRiskBand;
};

export type NormalizationStationOutput = {
  station: 'normalize';
  version: typeof META_POLICY_HARNESS_VERSION;
  bundle: NormalizedMetaAdBundle;
  combinedAdText: string;
};

export type BoundaryJudgeOutput = {
  station: 'boundary_judge';
  version: typeof META_POLICY_HARNESS_VERSION;
  combined: MetaBoundaryScore;
  bySurface: Partial<Record<MetaAdSurfaceKey, MetaBoundaryScore>>;
  offendingMatches: string[];
  similarRejects: HistoricalRejectMatch[];
  gate: {
    rewriteRequired: boolean;
    pass: boolean;
  };
};

export type ClaimEnvelopeOutput = {
  station: 'claim_envelope';
  version: typeof META_POLICY_HARNESS_VERSION;
  evidenceSentences: string[];
  supportedTerms: string[];
  weakSupportTerms: string[];
  unsupportedRiskPhrases: string[];
};

export type AwarenessStage =
  | 'unaware'
  | 'problem_aware'
  | 'solution_aware'
  | 'study_aware';

export type ReaderStateOutput = {
  station: 'reader_state';
  version: typeof META_POLICY_HARNESS_VERSION;
  stage: AwarenessStage;
  rationale: string;
};

export type PainBriefOutput = {
  station: 'pain_brief';
  version: typeof META_POLICY_HARNESS_VERSION;
  functionalPain: string[];
  emotionalPain: string[];
  failedAlternatives: string[];
  stakes: string[];
  desiredOutcome: string[];
  whyNow: string[];
};

export type Angle = {
  name: string;
  hook: string;
  promise: string;
  riskNotes: string[];
};

export type AngleGenerationOutput = {
  station: 'angles';
  version: typeof META_POLICY_HARNESS_VERSION;
  angles: Angle[];
};

export type HistoricalRejectMatch = {
  adId: string;
  adName: string;
  reason: string;
  policy: string;
  observedCopy: string;
  copySource: string;
  receivedAt: string;
  similarityScore: number;
  matchedTerms: string[];
};

export type HistoricalRejectsOutput = {
  station: 'historical_rejects';
  version: typeof META_POLICY_HARNESS_VERSION;
  matches: HistoricalRejectMatch[];
  summary: string[];
};

export type CongruenceAuditOutput = {
  station: 'congruence_audit';
  version: typeof META_POLICY_HARNESS_VERSION;
  supported: boolean;
  overlapRatio: number;
  hardViolations: string[];
  softWarnings: string[];
};

export type RewriteVariant = {
  label: string;
  transcript?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  cta?: string;
  rationale?: string;
};

export type RewriteStationOutput = {
  station: 'rewrite';
  version: typeof META_POLICY_WRITER_PROMPT_VERSION;
  writerMode: 'llm' | 'fallback';
  attempts: number;
  variants: RewriteVariant[];
};

export type RankedVariant = {
  variant: RewriteVariant;
  combinedText: string;
  boundary: MetaBoundaryScore;
  congruence: CongruenceAuditOutput;
  persuasion: {
    painRelevance: number;
    selfInterest: number;
    curiosity: number;
    clarity: number;
    credibility: number;
    boring: boolean;
    total: number;
  };
  copyReview: {
    verdict: string;
    strengths: string[];
    weaknesses: string[];
    buyerNotes: string[];
    launchRecommendation: string;
  };
  accepted: boolean;
  rejectionReasons: string[];
};

export type RankingStationOutput = {
  station: 'rank';
  version: typeof META_POLICY_HARNESS_VERSION;
  accepted: RankedVariant[];
  rejected: RankedVariant[];
};

const SURFACE_KEYS: MetaAdSurfaceKey[] = [
  'transcript',
  'primaryText',
  'headline',
  'description',
  'cta',
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'your', 'you', 'are', 'was', 'have',
  'has', 'had', 'into', 'near', 'what', 'when', 'will', 'they', 'their', 'them', 'about',
  'these', 'those', 'more', 'less', 'than', 'then', 'just', 'only', 'into', 'onto', 'over',
  'under', 'here', 'there', 'learn', 'review', 'current', 'ongoing', 'qualified', 'adults',
  'study', 'studies', 'clinical', 'research', 'details', 'information',
]);

type RejectionCorpusRow = {
  received_at?: string;
  account_id?: string;
  ad_id?: string;
  reason?: string;
  policy?: string;
  observed_copy?: string;
  copy_source?: string;
  ad_name?: string;
};

type IndexedReject = {
  raw: RejectionCorpusRow;
  copy: string;
  tokens: string[];
  tokenSet: Set<string>;
};

let rejectionCorpusCache: IndexedReject[] | null = null;

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .match(/[a-z0-9+]+/g) || [];
}

function significantTokens(text: string): string[] {
  return tokenize(text).filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function termFrequency(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of significantTokens(text)) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function articleBlob(bundle: NormalizedMetaAdBundle): string {
  return [bundle.landingArticleTitle, bundle.landingArticleSummary, bundle.landingArticleBody]
    .filter(Boolean)
    .join('. ');
}

function rejectionCorpusPath(): string {
  return path.resolve(__dirname, '../../../meta_rejected_ads_with_copy_2026-01-01_to_2026-04-20.jsonl');
}

function rejectCopy(row: RejectionCorpusRow): string {
  return normalizeText(row.observed_copy || row.ad_name || '');
}

function loadRejectionCorpus(): IndexedReject[] {
  if (rejectionCorpusCache) return rejectionCorpusCache;
  const file = rejectionCorpusPath();
  if (!fs.existsSync(file)) {
    rejectionCorpusCache = [];
    return rejectionCorpusCache;
  }

  const rows = fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as RejectionCorpusRow;
      } catch {
        return null;
      }
    })
    .filter((row): row is RejectionCorpusRow => Boolean(row))
    .map((raw) => {
      const copy = rejectCopy(raw);
      const tokens = significantTokens([copy, normalizeText(raw.reason), normalizeText(raw.policy)].filter(Boolean).join(' '));
      return {
        raw,
        copy,
        tokens,
        tokenSet: new Set(tokens),
      };
    })
    .filter((row) => row.copy);

  rejectionCorpusCache = rows;
  return rows;
}

function rejectReasonSummary(matches: HistoricalRejectMatch[]): string[] {
  if (matches.length === 0) {
    return ['No similar historical rejects were found in the local corpus.'];
  }

  const policies = unique(matches.map((match) => match.policy).filter(Boolean));
  const reasons = unique(matches.map((match) => match.reason).filter(Boolean));
  const summary: string[] = [
    `Found ${matches.length} similar historical rejects in the local corpus.`,
  ];
  if (policies.length > 0) {
    summary.push(`Most similar policy buckets: ${policies.slice(0, 3).join(', ')}.`);
  }
  if (reasons.length > 0) {
    summary.push(`Common historical rejection reasons: ${reasons.slice(0, 2).join(' | ')}.`);
  }
  return summary;
}

export function findSimilarHistoricalRejects(text: string, limit = 5): HistoricalRejectsOutput {
  const normalized = normalizeText(text);
  const queryTokens = unique(significantTokens(normalized));
  const querySet = new Set(queryTokens);

  if (queryTokens.length === 0) {
    return {
      station: 'historical_rejects',
      version: META_POLICY_HARNESS_VERSION,
      matches: [],
      summary: ['No ad-copy tokens were available for historical reject matching.'],
    };
  }

  const matches = loadRejectionCorpus()
    .map((entry) => {
      const overlap = entry.tokens.filter((token) => querySet.has(token));
      const overlapCount = overlap.length;
      const union = new Set([...queryTokens, ...entry.tokens]).size || 1;
      const queryCoverage = overlapCount / queryTokens.length;
      const jaccard = overlapCount / union;
      const score = Number((queryCoverage * 0.75 + jaccard * 0.25).toFixed(3));
      return {
        entry,
        overlap: unique(overlap),
        score,
      };
    })
    .filter((row) => row.score >= 0.12 || row.overlap.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, overlap, score }) => ({
      adId: normalizeText(entry.raw.ad_id),
      adName: normalizeText(entry.raw.ad_name),
      reason: normalizeText(entry.raw.reason),
      policy: normalizeText(entry.raw.policy),
      observedCopy: entry.copy,
      copySource: normalizeText(entry.raw.copy_source),
      receivedAt: normalizeText(entry.raw.received_at),
      similarityScore: score,
      matchedTerms: overlap.slice(0, 8),
    }));

  return {
    station: 'historical_rejects',
    version: META_POLICY_HARNESS_VERSION,
    matches,
    summary: rejectReasonSummary(matches),
  };
}

export function normalizeMetaAdBundle(input: MetaAdHarnessInput): NormalizationStationOutput {
  const bundle: NormalizedMetaAdBundle = {
    transcript: normalizeText(input.transcript),
    primaryText: normalizeText(input.primaryText),
    headline: normalizeText(input.headline),
    description: normalizeText(input.description),
    cta: normalizeText(input.cta),
    landingArticleTitle: normalizeText(input.landingArticleTitle),
    landingArticleSummary: normalizeText(input.landingArticleSummary),
    landingArticleBody: normalizeText(input.landingArticleBody),
    offerType: normalizeText(input.offerType),
    audience: normalizeText(input.audience),
    knownRejectionReason: normalizeText(input.knownRejectionReason),
    forbiddenPhrases: unique((input.forbiddenPhrases || []).map((value) => normalizeText(value).toLowerCase())),
    targetBand: input.targetBand || 'grey',
  };

  const combinedAdText = SURFACE_KEYS
    .map((key) => bundle[key])
    .filter(Boolean)
    .join('\n');

  return {
    station: 'normalize',
    version: META_POLICY_HARNESS_VERSION,
    bundle,
    combinedAdText,
  };
}

export function runBoundaryJudge(bundle: NormalizedMetaAdBundle): BoundaryJudgeOutput {
  const combinedText = SURFACE_KEYS
    .map((key) => bundle[key])
    .filter(Boolean)
    .join('\n');

  const bySurface: Partial<Record<MetaAdSurfaceKey, MetaBoundaryScore>> = {};
  for (const key of SURFACE_KEYS) {
    const value = bundle[key];
    if (!value) continue;
    bySurface[key] = scoreMetaAdBoundary(value);
  }

  const combined = scoreMetaAdBoundary(combinedText);
  const offendingMatches = unique(
    Object.values(bySurface)
      .flatMap((score) => score.lineScores)
      .flatMap((line) => line.triggers.map((trigger) => trigger.match))
  );
  const similarRejects = findSimilarHistoricalRejects(combinedText).matches;

  const rewriteRequired = combined.overallBand === 'black';
  return {
    station: 'boundary_judge',
    version: META_POLICY_HARNESS_VERSION,
    combined,
    bySurface,
    offendingMatches,
    similarRejects,
    gate: {
      rewriteRequired,
      pass: !rewriteRequired,
    },
  };
}

export function extractClaimEnvelope(bundle: NormalizedMetaAdBundle): ClaimEnvelopeOutput {
  const article = articleBlob(bundle);
  const sentences = splitSentences(article);
  const tf = termFrequency(article);

  const supportedTerms = Array.from(tf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);

  const weakSupportTerms = supportedTerms.filter((term) => /study|research|participants|eligibility|clinical|trial|diabetes|dental|treatment|care/.test(term));
  const evidenceSentences = sentences.slice(0, 8);
  const lowerArticle = article.toLowerCase();

  const unsupportedRiskPhrases: string[] = [];
  if (!/insurance/.test(lowerArticle)) unsupportedRiskPhrases.push('no insurance required');
  if (!/(groundbreaking|innovative|innovation|elite|world class|exclusive)/.test(lowerArticle)) {
    unsupportedRiskPhrases.push('groundbreaking treatments');
    unsupportedRiskPhrases.push('elite care');
  }
  if (!/\$|compensation|stipend|get paid|payment/.test(lowerArticle)) {
    unsupportedRiskPhrases.push('earnings or compensation claims');
  }
  if (!/(near you|local|city|state|location)/.test(lowerArticle)) {
    unsupportedRiskPhrases.push('personalized local relevance');
  }

  return {
    station: 'claim_envelope',
    version: META_POLICY_HARNESS_VERSION,
    evidenceSentences,
    supportedTerms,
    weakSupportTerms,
    unsupportedRiskPhrases: unique(unsupportedRiskPhrases),
  };
}

export function inferReaderState(bundle: NormalizedMetaAdBundle, envelope: ClaimEnvelopeOutput): ReaderStateOutput {
  const article = articleBlob(bundle).toLowerCase();
  let stage: AwarenessStage = 'problem_aware';
  let rationale = 'The article discusses a health problem and possible next steps, so the likely reader knows the problem but not necessarily the study process.';

  if (/\bclinical trial|research study|eligibility|participants\b/.test(article)) {
    stage = 'problem_aware';
  }
  if (/\bhow to find|how to discover|how to join|how participation works\b/.test(article)) {
    stage = 'solution_aware';
    rationale = 'The article explains how to find studies, so the reader likely wants options but is not yet committed to participation.';
  }
  if (/\beligibility criteria|participation steps|screening\b/.test(article) && /\bclinical trial|research study\b/.test(article)) {
    stage = 'solution_aware';
    rationale = 'The article is about finding studies and understanding participation, which suggests readers are looking for alternatives, not already sold on a study.';
  }

  return {
    station: 'reader_state',
    version: META_POLICY_HARNESS_VERSION,
    stage,
    rationale,
  };
}

export function buildPainBrief(bundle: NormalizedMetaAdBundle): PainBriefOutput {
  const article = articleBlob(bundle).toLowerCase();
  const functionalPain: string[] = [];
  const emotionalPain: string[] = [];
  const failedAlternatives: string[] = [];
  const stakes: string[] = [];
  const desiredOutcome: string[] = [];
  const whyNow: string[] = [];

  if (/sleep apnea/.test(article)) {
    functionalPain.push('disrupted sleep', 'daytime fatigue', 'difficulty finding workable treatment options');
    emotionalPain.push('frustration with feeling drained', 'feeling stuck with uncomfortable treatment choices');
    failedAlternatives.push('CPAP discomfort or friction', 'uncertainty about what options exist beyond standard treatment');
    stakes.push('ongoing poor sleep quality', 'reduced day-to-day energy');
    desiredOutcome.push('better sleep', 'a workable next option', 'clearer understanding of current alternatives');
    whyNow.push('current studies are evaluating new approaches', 'the article explains how to review current options');
  }

  if (/diabetes/.test(article)) {
    functionalPain.push('difficulty managing blood sugar', 'wanting to understand what new options are being studied');
    emotionalPain.push('frustration with current treatment limits');
    failedAlternatives.push('limited satisfaction with existing approaches');
    stakes.push('ongoing condition-management burden');
    desiredOutcome.push('a clearer path forward', 'new options worth exploring');
    whyNow.push('current studies are actively enrolling');
  }

  if (functionalPain.length === 0) {
    functionalPain.push('the condition is disruptive enough to make someone look for another option');
    emotionalPain.push('fatigue, frustration, or worry about staying stuck');
    failedAlternatives.push('current options may feel incomplete, unclear, or unsatisfying');
    stakes.push('the problem continues if nothing changes');
    desiredOutcome.push('a practical next step', 'clarity about what options exist now');
    whyNow.push('the article presents current information a motivated reader can act on');
  }

  return {
    station: 'pain_brief',
    version: META_POLICY_HARNESS_VERSION,
    functionalPain: unique(functionalPain),
    emotionalPain: unique(emotionalPain),
    failedAlternatives: unique(failedAlternatives),
    stakes: unique(stakes),
    desiredOutcome: unique(desiredOutcome),
    whyNow: unique(whyNow),
  };
}

export function generateAngles(
  bundle: NormalizedMetaAdBundle,
  readerState: ReaderStateOutput,
  painBrief: PainBriefOutput
): AngleGenerationOutput {
  const topic = articleBlob(bundle).toLowerCase().includes('sleep apnea')
    ? 'sleep apnea'
    : articleBlob(bundle).toLowerCase().includes('diabetes')
      ? 'diabetes'
      : 'this condition';

  const angles: Angle[] = [
    {
      name: 'frustration-to-alternative',
      hook: `Still frustrated with ${topic}?`,
      promise: `Show that there are current research-backed options worth understanding.`,
      riskNotes: ['Avoid implying the viewer has the condition directly in the final copy.'],
    },
    {
      name: 'what-else-is-out-there',
      hook: `What else is being tested right now?`,
      promise: `Create curiosity around current studies and alternative approaches.`,
      riskNotes: ['Keep claims tied to article support.'],
    },
    {
      name: 'before-you-rule-it-out',
      hook: `Before you rule this out...`,
      promise: `Invite the reader to consider one more credible option without hype.`,
      riskNotes: ['Do not use manipulative scarcity.'],
    },
    {
      name: 'new-option-clarity',
      hook: `See what current research is exploring.`,
      promise: `Give a clean, credible reason to click for more detail.`,
      riskNotes: ['Can become bland if not paired with pain relevance.'],
    },
    {
      name: 'stuck-reader',
      hook: `If current options feel hard to stick with...`,
      promise: `Position the article as a place to learn what else exists.`,
      riskNotes: ['Do not overstate dissatisfaction or promise relief.'],
    },
  ];

  return {
    station: 'angles',
    version: META_POLICY_HARNESS_VERSION,
    angles,
  };
}

export function auditCongruence(
  candidateText: string,
  bundle: NormalizedMetaAdBundle,
  envelope?: ClaimEnvelopeOutput
): CongruenceAuditOutput {
  const article = [bundle.landingArticleTitle, bundle.landingArticleSummary, bundle.landingArticleBody]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const candidateTokens = significantTokens(candidateText);
  const articleTokens = new Set(significantTokens(article));
  const shared = candidateTokens.filter((token) => articleTokens.has(token));
  const overlapRatio = candidateTokens.length > 0 ? shared.length / candidateTokens.length : 1;

  const hardViolations: string[] = [];
  const softWarnings: string[] = [];
  const lower = candidateText.toLowerCase();

  const claimChecks: Array<{ phrase: RegExp; label: string; support: RegExp }> = [
    { phrase: /no insurance required|no necesitas seguro|sin seguro/i, label: 'Insurance claim not clearly supported by article', support: /insurance|seguro/i },
    { phrase: /groundbreaking|innovative treatments?|elite care|world class care|exclusive access/i, label: 'Medical superlative not clearly supported by article', support: /groundbreaking|innovative|innovation|elite|world class|exclusive/i },
    { phrase: /up to \$?\d+|receive up to|get paid|compensation|stipend/i, label: 'Compensation claim not clearly supported by article', support: /\$|compensation|stipend|get paid|payment/i },
    { phrase: /near you|cerca de ti|cerca de usted/i, label: 'Personalized local-relevance claim not clearly supported by article', support: /near you|local|location|city|state/i },
  ];

  for (const check of claimChecks) {
    if (check.phrase.test(lower) && !check.support.test(article)) {
      hardViolations.push(check.label);
    }
  }

  if (envelope) {
    for (const phrase of envelope.unsupportedRiskPhrases) {
      if (!phrase) continue;
      const firstToken = phrase.split(/\s+/)[0];
      if (firstToken && lower.includes(firstToken) && !article.includes(firstToken)) {
        softWarnings.push(`Article does not strongly support phrase family: ${phrase}`);
      }
    }
  }

  if (candidateTokens.length >= 6 && overlapRatio < 0.35) {
    softWarnings.push('Low lexical overlap with landing article; possible message drift.');
  }

  return {
    station: 'congruence_audit',
    version: META_POLICY_HARNESS_VERSION,
    supported: hardViolations.length === 0,
    overlapRatio,
    hardViolations: unique(hardViolations),
    softWarnings: unique(softWarnings),
  };
}

function buildForbiddenPhraseList(
  bundle: NormalizedMetaAdBundle,
  judge: BoundaryJudgeOutput,
  envelope: ClaimEnvelopeOutput
): string[] {
  const base = [
    ...bundle.forbiddenPhrases,
    ...judge.offendingMatches.map((value) => value.toLowerCase()),
    ...envelope.unsupportedRiskPhrases.map((value) => value.toLowerCase()),
    'near you',
    'groundbreaking',
    'elite care',
    'world class care',
    'no insurance required',
    'get paid',
    'participants needed',
  ];
  return unique(base);
}

function selectPrimaryRewriteField(bundle: NormalizedMetaAdBundle): MetaAdSurfaceKey {
  if (bundle.primaryText) return 'primaryText';
  if (bundle.transcript) return 'transcript';
  if (bundle.headline) return 'headline';
  if (bundle.description) return 'description';
  return 'cta';
}

function parseRewriteResponse(raw: string, field: MetaAdSurfaceKey): RewriteVariant[] {
  let payload = raw.trim();
  if (payload.startsWith('```')) {
    payload = payload.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const firstBrace = payload.indexOf('{');
  const lastBrace = payload.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    payload = payload.slice(firstBrace, lastBrace + 1);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return [];
  }
  const variants = Array.isArray(parsed?.variants) ? parsed.variants : [];
  return variants
    .map((variant: any, index: number) => {
      const output: RewriteVariant = {
        label: typeof variant?.label === 'string' ? variant.label : `Option ${index + 1}`,
        rationale: typeof variant?.rationale === 'string' ? variant.rationale : '',
      };
      for (const key of SURFACE_KEYS) {
        if (typeof variant?.[key] === 'string') output[key] = normalizeText(variant[key]);
      }
      if (!output[field] && typeof variant?.copy === 'string') output[field] = normalizeText(variant.copy);
      return output;
    })
    .filter((variant: RewriteVariant) => SURFACE_KEYS.some((key) => Boolean(variant[key])));
}

function focusTopic(bundle: NormalizedMetaAdBundle, envelope: ClaimEnvelopeOutput): string {
  const article = [bundle.landingArticleTitle, bundle.landingArticleSummary, bundle.landingArticleBody]
    .join(' ')
    .toLowerCase();
  if (/diabetes/.test(article)) return 'diabetes research studies';
  if (/dental|implant/.test(article)) return 'dental research studies';
  if (/neuropathy/.test(article)) return 'neuropathy research studies';
  if (/clinical/.test(article)) return 'clinical research studies';
  return envelope.supportedTerms.slice(0, 3).join(' ') || 'current research studies';
}

function fallbackRewriteVariants(
  bundle: NormalizedMetaAdBundle,
  field: MetaAdSurfaceKey,
  envelope: ClaimEnvelopeOutput
): RewriteVariant[] {
  const topic = focusTopic(bundle, envelope);
  const candidates = [
    `Current ${topic} are enrolling qualified adults. Review study details and eligibility information.`,
    `Learn about ongoing ${topic} and review the eligibility criteria for participation.`,
    `Researchers are reviewing qualified adults for current ${topic}. See participation details and next steps.`,
    `Explore current ${topic} for qualified adults. Review the study overview and participation information.`,
  ];

  return candidates.map((copy, index) => {
    const variant: RewriteVariant = {
      label: `Fallback ${index + 1}`,
      rationale: 'Deterministic fallback rewrite designed to remove black-risk triggers while preserving curiosity.',
      transcript: bundle.transcript,
      primaryText: bundle.primaryText,
      headline: bundle.headline,
      description: bundle.description,
      cta: bundle.cta,
    };
    variant[field] = copy;
    return variant;
  });
}

function buildRewriteRepairPrompt(raw: string, field: MetaAdSurfaceKey): string {
  return [
    `The previous response did not satisfy the required JSON schema for ${TARGET_REWRITE_VARIANT_COUNT} ad variants.`,
    `Rewrite and repair it now.`,
    `Return JSON only.`,
    `Return exactly ${TARGET_REWRITE_VARIANT_COUNT} variants.`,
    `Each variant must include "${field}" and may include transcript, primaryText, headline, description, and cta when relevant.`,
    `Do not add markdown fences.`,
    '',
    'Previous invalid output:',
    raw || '(empty)',
    '',
    'Required JSON shape:',
    '{"variants":[{"label":"Option 1","rationale":"...","transcript":"","primaryText":"","headline":"","description":"","cta":""}]}',
  ].join('\n');
}

function rewriteResponseSchema() {
  return {
    type: 'json_schema',
    name: 'rewrite_variants',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variants: {
          type: 'array',
          minItems: TARGET_REWRITE_VARIANT_COUNT,
          maxItems: TARGET_REWRITE_VARIANT_COUNT,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              rationale: { type: 'string' },
              transcript: { type: 'string' },
              primaryText: { type: 'string' },
              headline: { type: 'string' },
              description: { type: 'string' },
              cta: { type: 'string' },
            },
            required: ['label', 'rationale', 'transcript', 'primaryText', 'headline', 'description', 'cta'],
          },
        },
      },
      required: ['variants'],
    },
  };
}

export async function generateRewriteVariants(
  bundle: NormalizedMetaAdBundle,
  judge: BoundaryJudgeOutput,
  envelope: ClaimEnvelopeOutput,
  readerState: ReaderStateOutput,
  painBrief: PainBriefOutput,
  angleOutput: AngleGenerationOutput,
  historicalRejects?: HistoricalRejectsOutput
): Promise<RewriteStationOutput> {
  const field = selectPrimaryRewriteField(bundle);
  const forbidden = buildForbiddenPhraseList(bundle, judge, envelope);
  const combinedOriginal = SURFACE_KEYS.map((key) => bundle[key]).filter(Boolean).join('\n');
  const writerModel = process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || 'gpt-5';

  const system = [
    'You are a world-class direct-response ad writer working in a Halbert-inspired style.',
    'Write with one sharp idea, concrete specificity, plain language, pain relevance, curiosity, and believability.',
    'You are not allowed to imply personal attributes, overpromise outcomes, add unsupported claims, or use spammy/scammy language.',
    'Your job is to move black-risk copy into strong grey-risk copy while preserving interest.',
    'Start from the reader tension first, not from the study mechanics.',
    'Return JSON only.',
  ].join(' ');

  const prompt = [
    `Harness version: ${META_POLICY_HARNESS_VERSION}`,
    `Writer prompt version: ${META_POLICY_WRITER_PROMPT_VERSION}`,
    `Target risk band: ${bundle.targetBand}`,
    `Primary field to rewrite: ${field}`,
    `Reader awareness stage: ${readerState.stage}`,
    '',
    'Original ad copy bundle:',
    combinedOriginal || '(empty)',
    '',
    'Known rejection context:',
    bundle.knownRejectionReason || '(none provided)',
    '',
    'Boundary judge triggers to avoid:',
    judge.offendingMatches.join(', ') || '(none)',
    '',
    'Most similar historical rejects:',
    ...(historicalRejects?.matches.length
      ? historicalRejects.matches.slice(0, 3).map((match) =>
        `- Similarity ${match.similarityScore}: copy="${match.observedCopy}" reason="${match.reason}" policy="${match.policy}" matched_terms="${match.matchedTerms.join(', ')}"`
      )
      : ['(none found)']),
    '',
    'Landing article evidence sentences:',
    ...envelope.evidenceSentences.map((sentence) => `- ${sentence}`),
    '',
    'Pain brief:',
    `- Functional pain: ${painBrief.functionalPain.join(', ')}`,
    `- Emotional pain: ${painBrief.emotionalPain.join(', ')}`,
    `- Failed alternatives: ${painBrief.failedAlternatives.join(', ')}`,
    `- Stakes: ${painBrief.stakes.join(', ')}`,
    `- Desired outcome: ${painBrief.desiredOutcome.join(', ')}`,
    `- Why now: ${painBrief.whyNow.join(', ')}`,
    '',
    'Available copy angles:',
    ...angleOutput.angles.map((angle) => `- ${angle.name}: hook="${angle.hook}" promise="${angle.promise}"`),
    '',
    'Terms supported by landing article:',
    envelope.supportedTerms.join(', '),
    '',
    'Unsupported or dangerous phrase families:',
    envelope.unsupportedRiskPhrases.join(', ') || '(none)',
    '',
    'Forbidden phrases:',
    forbidden.join(', '),
    '',
    'Output requirements:',
    `- Return exactly ${TARGET_REWRITE_VARIANT_COUNT} variants.`,
    '- Keep each variant believable and congruent with the landing article.',
    '- Use curiosity, clarity, specificity, and reader self-interest without hype.',
    '- Do not lead with process language like eligibility, screening, participation steps, or study mechanics unless it is secondary to the hook.',
    '- The reader should care about the problem or possibility first, and the study second.',
    '- Do not include any forbidden phrase or close paraphrase that implies the same risky meaning.',
    '- If a field is not provided in the original, leave it empty.',
    '- The rewritten primary field must be the strongest persuasive grey-risk version, not a whitewashed compliance-only line.',
    '- Boring copy fails. If the line sounds like informational filler, rewrite it.',
    '',
    'Return JSON with this shape:',
    '{"variants":[{"label":"Option 1","rationale":"...","transcript":"","primaryText":"","headline":"","description":"","cta":""}]}',
  ].join('\n');

  let variants: RewriteVariant[] = [];
  let attempts = 0;
  let lastRaw = '';

  while (attempts < 3 && variants.length !== TARGET_REWRITE_VARIANT_COUNT) {
    attempts += 1;
    const raw = await generateText({
      system,
      prompt: attempts === 1 ? prompt : buildRewriteRepairPrompt(lastRaw, field),
      temperature: attempts === 1 ? 0.6 : 0.2,
      maxTokens: 1800,
      model: writerModel,
      textFormat: rewriteResponseSchema(),
    });
    lastRaw = raw;
    variants = parseRewriteResponse(raw, field);
  }

  if (variants.length !== TARGET_REWRITE_VARIANT_COUNT) {
    variants = fallbackRewriteVariants(bundle, field, envelope);
    return {
      station: 'rewrite',
      version: META_POLICY_WRITER_PROMPT_VERSION,
      writerMode: 'fallback',
      attempts,
      variants,
    };
  }

  return {
    station: 'rewrite',
    version: META_POLICY_WRITER_PROMPT_VERSION,
    writerMode: 'llm',
    attempts,
    variants,
  };
}

function combinedVariantText(variant: RewriteVariant): string {
  return SURFACE_KEYS.map((key) => variant[key] || '').filter(Boolean).join('\n');
}

function persuasionScore(
  text: string,
  boundary: MetaBoundaryScore,
  painBrief: PainBriefOutput
): { painRelevance: number; selfInterest: number; curiosity: number; clarity: number; credibility: number; boring: boolean; total: number } {
  const lower = text.toLowerCase();
  let painRelevance = 0;
  let selfInterest = 0;
  let curiosity = 0;
  let clarity = 0;
  let credibility = 0;

  const painTokens = unique(
    [...painBrief.functionalPain, ...painBrief.emotionalPain, ...painBrief.failedAlternatives, ...painBrief.desiredOutcome]
      .flatMap((item) => significantTokens(item))
  );
  const painHits = painTokens.filter((token) => lower.includes(token));
  if (painHits.length >= 2) painRelevance += 4;
  else if (painHits.length === 1) painRelevance += 2;

  if (/\b(see|discover|what else|before you|still|looking into|worth a closer look|new option|another option)\b/.test(lower)) selfInterest += 4;
  else if (/\b(learn|explore|review)\b/.test(lower)) selfInterest += 2;

  if (/\b(what else|before you|still|worth a closer look|new|current|another)\b/.test(lower)) curiosity += 3;
  else if (/\b(learn|see|review|explore|discover|find out|ongoing)\b/.test(lower)) curiosity += 2;
  if (/\?/.test(text)) curiosity += 1;
  if (text.length >= 50 && text.length <= 180) clarity += 3;
  else if (text.length <= 240) clarity += 2;
  if (!/[A-Z]{4,}/.test(text) && !/!!/.test(text)) clarity += 1;
  if (!/\b(groundbreaking|elite|world class|almost nothing|force .* do this)\b/.test(lower)) credibility += 3;
  if (boundary.overallBand !== 'black') credibility += 2;

  const boring = painRelevance <= 1 && selfInterest <= 2 && curiosity <= 2;
  const total = painRelevance + selfInterest + curiosity + clarity + credibility - Math.round(boundary.totalScore / 20) - (boring ? 4 : 0);
  return { painRelevance, selfInterest, curiosity, clarity, credibility, boring, total };
}

function buildCopyReview(
  variant: RewriteVariant,
  boundary: MetaBoundaryScore,
  congruence: CongruenceAuditOutput,
  persuasion: { painRelevance: number; selfInterest: number; curiosity: number; clarity: number; credibility: number; boring: boolean; total: number }
): RankedVariant['copyReview'] {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const buyerNotes: string[] = [];

  if (persuasion.painRelevance >= 4) strengths.push('The copy ties back to reader pain or desired outcome instead of sounding like a sterile process summary.');
  if (persuasion.selfInterest >= 4) strengths.push('The hook gives the reader a self-interested reason to care before the mechanics of the study or offer.');
  if (persuasion.curiosity >= 3) strengths.push('The wording creates curiosity without relying on obvious hype or forced urgency.');
  if (persuasion.clarity >= 3) strengths.push('The message is compact enough to scan quickly in-feed.');
  if (persuasion.credibility >= 4) strengths.push('The language stays believable and avoids obvious hype patterns.');

  if (persuasion.boring) weaknesses.push('The copy reads too process-led or informational, which will likely suppress attention and click intent.');
  if (boundary.overallBand !== 'white') weaknesses.push(`The copy still lives in the ${boundary.overallBand.toUpperCase()} risk band, so policy sensitivity remains part of the tradeoff.`);
  if (congruence.softWarnings.length > 0) weaknesses.push(...congruence.softWarnings);
  if (!congruence.supported) weaknesses.push(...congruence.hardViolations);

  if (variant.rationale) buyerNotes.push(variant.rationale);
  if (boundary.review.comboFindings.length > 0) {
    buyerNotes.push(`Watch the combo pattern: ${boundary.review.comboFindings.map((finding) => finding.name).join('; ')}.`);
  }
  if (boundary.review.surfaceFindings.some((finding) => finding.active)) {
    const active = boundary.review.surfaceFindings
      .filter((finding) => finding.active)
      .slice(0, 3)
      .map((finding) => finding.label)
      .join(', ');
    buyerNotes.push(`Active policy surfaces in this variant: ${active}.`);
  }

  let verdict = 'This variant is usable but unremarkable.';
  if (boundary.overallBand === 'white' && !persuasion.boring && congruence.supported) {
    verdict = 'This variant is clean, believable, and ready for launch.';
  } else if (boundary.overallBand === 'grey' && !persuasion.boring && congruence.supported) {
    verdict = 'This variant is a strong grey candidate: persuasive enough to test, with risk still visible but controlled.';
  } else if (boundary.overallBand === 'black') {
    verdict = 'This variant is still too risky to relaunch as written.';
  }

  let launchRecommendation = 'Hold for revision.';
  if (boundary.overallBand === 'white' && congruence.supported && !persuasion.boring) {
    launchRecommendation = 'Launchable as a lower-risk control.';
  } else if (boundary.overallBand === 'grey' && congruence.supported && !persuasion.boring) {
    launchRecommendation = 'Launchable as an aggressive-but-defensible test cell.';
  } else if (persuasion.boring) {
    launchRecommendation = 'Rewrite for stronger pain relevance or curiosity before launch.';
  } else if (!congruence.supported) {
    launchRecommendation = 'Do not launch until the claim/landing mismatch is removed.';
  }

  return {
    verdict,
    strengths,
    weaknesses,
    buyerNotes,
    launchRecommendation,
  };
}

export function rankRewriteVariants(
  variants: RewriteVariant[],
  bundle: NormalizedMetaAdBundle,
  envelope: ClaimEnvelopeOutput,
  painBrief: PainBriefOutput
): RankingStationOutput {
  const ranked: RankedVariant[] = variants.map((variant) => {
    const text = combinedVariantText(variant);
    const boundary = scoreMetaAdBoundary(text);
    const congruence = auditCongruence(text, bundle, envelope);
    const persuasion = persuasionScore(text, boundary, painBrief);
    const copyReview = buildCopyReview(variant, boundary, congruence, persuasion);
    const rejectionReasons: string[] = [];

    if (boundary.overallBand === 'black') rejectionReasons.push('Boundary judge still black.');
    if (!congruence.supported) rejectionReasons.push(...congruence.hardViolations);
    if (persuasion.boring) rejectionReasons.push('Variant is too boring or process-led to earn attention.');

    return {
      variant,
      combinedText: text,
      boundary,
      congruence,
      persuasion,
      copyReview,
      accepted: rejectionReasons.length === 0,
      rejectionReasons: unique(rejectionReasons),
    };
  });

  const accepted = ranked
    .filter((item) => item.accepted)
    .sort((a, b) => b.persuasion.total - a.persuasion.total);
  const rejected = ranked.filter((item) => !item.accepted);

  return {
    station: 'rank',
    version: META_POLICY_HARNESS_VERSION,
    accepted,
    rejected,
  };
}

export async function runMetaPolicyHarness(input: MetaAdHarnessInput): Promise<{
  normalization: NormalizationStationOutput;
  boundaryJudge: BoundaryJudgeOutput;
  historicalRejects: HistoricalRejectsOutput;
  claimEnvelope: ClaimEnvelopeOutput;
  readerState: ReaderStateOutput;
  painBrief: PainBriefOutput;
  angles: AngleGenerationOutput;
  rewriteStation: RewriteStationOutput | null;
  ranking: RankingStationOutput | null;
}> {
  const normalization = normalizeMetaAdBundle(input);
  const boundaryJudge = runBoundaryJudge(normalization.bundle);
  const historicalRejects = findSimilarHistoricalRejects(normalization.combinedAdText);
  const claimEnvelope = extractClaimEnvelope(normalization.bundle);
  const readerState = inferReaderState(normalization.bundle, claimEnvelope);
  const painBrief = buildPainBrief(normalization.bundle);
  const angles = generateAngles(normalization.bundle, readerState, painBrief);

  const rewriteRequired = boundaryJudge.gate.rewriteRequired || input.forceRewrite === true;
  if (!rewriteRequired) {
    return {
      normalization,
      boundaryJudge,
      historicalRejects,
      claimEnvelope,
      readerState,
      painBrief,
      angles,
      rewriteStation: null,
      ranking: null,
    };
  }

  const rewriteStation = await generateRewriteVariants(
    normalization.bundle,
    boundaryJudge,
    claimEnvelope,
    readerState,
    painBrief,
    angles,
    historicalRejects
  );
  const ranking = rankRewriteVariants(rewriteStation.variants, normalization.bundle, claimEnvelope, painBrief);

  return {
    normalization,
    boundaryJudge,
    historicalRejects,
    claimEnvelope,
    readerState,
    painBrief,
    angles,
    rewriteStation,
    ranking,
  };
}
