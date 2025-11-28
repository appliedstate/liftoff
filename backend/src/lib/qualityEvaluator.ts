import OpenAI from 'openai';
import { searchGuidelinesChunks, GuidelineChunk } from './guidelinesRag';

export type QualityDimension =
  | 'needs_met'
  | 'page_quality'
  | 'eeat'
  | 'ads_ux'
  | 'deception';

export type PageEvalInput = {
  /**
   * The user's search query or force key this page is intended to satisfy.
   */
  query: string;
  /**
   * Concise natural-language summary of the page:
   * - title, H1
   * - article body synopsis
   * - author/bio highlights
   * - any notable disclaimers
   */
  pageSummary: string;
  /**
   * Optional description of monetization / widgets / ad layout.
   */
  widgetSummary?: string;
  /**
   * Optional hint if you already know the page is YMYL.
   */
  ymyLHint?: boolean;
};

export type DimensionScore = {
  dimension: QualityDimension;
  score: string;
  reasoning: string;
  guidelineSections: string[];
};

export type PageEvalResult = {
  classification: {
    ymyL: boolean;
    purpose: string;
    contentType: string;
  };
  dimensions: DimensionScore[];
};

const DEFAULT_MODEL = process.env.QUALITY_EVAL_MODEL || 'gpt-4.1-mini';

async function getOpenAI(): Promise<OpenAI> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey });
}

type ClassificationResult = {
  ymyL: boolean;
  purpose: string;
  contentType: string;
};

async function classifyPage(input: PageEvalInput): Promise<ClassificationResult> {
  const client = await getOpenAI();

  const prompt = [
    'You are a Google Search Quality rater following the Search Quality Evaluator Guidelines.',
    'Classify the page based on the official guidelines.',
    '',
    `User query (force key): ${input.query}`,
    '',
    'Page summary:',
    input.pageSummary,
    '',
    input.widgetSummary ? `Monetization/widgets summary:\n${input.widgetSummary}\n` : '',
    'Return JSON with fields: ymyL (boolean), purpose (short phrase), contentType (one of: "article", "landing_page", "tool", "forum", "other").',
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are an experienced search quality rater.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  return {
    ymyL: typeof parsed.ymyL === 'boolean' ? parsed.ymyL : !!input.ymyLHint,
    purpose: typeof parsed.purpose === 'string' ? parsed.purpose : 'unknown',
    contentType:
      typeof parsed.contentType === 'string' ? parsed.contentType : 'article',
  };
}

function buildGuidelineQuery(
  dim: QualityDimension,
  classification: ClassificationResult
): string {
  const base = `Google Search Quality Evaluator Guidelines sections about`;
  const ymyLPart = classification.ymyL ? 'for YMYL pages' : 'for non-YMYL pages';
  switch (dim) {
    case 'needs_met':
      return `${base} Needs Met ratings ${ymyLPart}, especially for ${classification.contentType} pages`;
    case 'page_quality':
      return `${base} Page Quality ratings ${ymyLPart}, including Lowest/Low/Medium/High criteria`;
    case 'eeat':
      return `${base} E-E-A-T (experience, expertise, authoritativeness, trust) ${ymyLPart}`;
    case 'ads_ux':
      return `${base} ads, supplementary content, page layout, and user experience ${ymyLPart}`;
    case 'deception':
      return `${base} deceptive or misleading pages, clickbait, and Lowest quality criteria ${ymyLPart}`;
    default:
      return `${base} overall ratings ${ymyLPart}`;
  }
}

function contextFromChunks(chunks: GuidelineChunk[]): string {
  return chunks
    .map((c, idx) =>
      [
        `Guideline chunk ${idx + 1}:`,
        `Path: ${c.path}`,
        `Section: ${c.section_title || '(no section title)'}`,
        '',
        c.content,
      ].join('\n')
    )
    .join('\n\n-----\n\n');
}

async function scoreDimension(
  dim: QualityDimension,
  classification: ClassificationResult,
  input: PageEvalInput
): Promise<DimensionScore> {
  const guidelineQuery = buildGuidelineQuery(dim, classification);
  const chunks = await searchGuidelinesChunks({
    query: guidelineQuery,
    k: 6,
    // Restrict to Search Quality Evaluator Guidelines PDF only
    pathLike: process.env.GUIDELINES_PATH_LIKE || 'searchqualityevaluatorguidelines%',
  });

  const ctx = contextFromChunks(chunks);
  const client = await getOpenAI();

  const taskInstructions: Record<QualityDimension, string> = {
    needs_met:
      'Decide the Needs Met rating for this page for the given query, using the official rating scale (FailsM, SlightlyMet, ModeratelyMet, HighlyMet, FullyMet).',
    page_quality:
      'Decide the Page Quality rating (Lowest, Low, Medium, High, Highest) based on the guidelines.',
    eeat:
      'Assess E-E-A-T (experience, expertise, authoritativeness, trust) and output a bucket like "Very weak", "Weak", "Moderate", "Strong", or "Very strong".',
    ads_ux:
      'Evaluate how ads, widgets, and layout affect user experience, and output one of "Problematic", "Borderline", or "Acceptable".',
    deception:
      'Assess whether the page shows any signs of deception, misleading claims, or Lowest-quality patterns. Output one of "None", "Mild risk", "High risk".',
  };

  const expectedScoreHint: Record<QualityDimension, string> = {
    needs_met:
      'score should be one of: "FailsM", "SlightlyMet", "ModeratelyMet", "HighlyMet", "FullyMet".',
    page_quality:
      'score should be one of: "Lowest", "Low", "Medium", "High", "Highest".',
    eeat:
      'score should be one of: "Very weak", "Weak", "Moderate", "Strong", "Very strong".',
    ads_ux: 'score should be one of: "Problematic", "Borderline", "Acceptable".',
    deception: 'score should be one of: "None", "Mild risk", "High risk".',
  };

  const instructions = [
    taskInstructions[dim],
    expectedScoreHint[dim],
    'Use only the information from the page summary and the guideline excerpts. When in doubt, be conservative.',
  ].join(' ');

  const prompt = [
    'GUIDELINE EXCERPTS:',
    ctx,
    '',
    'PAGE CONTEXT:',
    `User query (force key): ${input.query}`,
    '',
    'Page summary:',
    input.pageSummary,
    '',
    input.widgetSummary ? `Monetization/widgets summary:\n${input.widgetSummary}\n` : '',
    '',
    'TASK:',
    instructions,
    '',
    'Return a JSON object with fields:',
    '- score: short string bucket as described above',
    '- reasoning: one or two sentences explaining the rating',
    '- guidelineSections: array of strings naming sections or concepts you relied on (free-form, e.g. "Needs Met for YMYL pages").',
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a meticulous Google Search Quality rater. Base all judgments strictly on the provided guideline excerpts.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const score =
    typeof parsed.score === 'string' && parsed.score.trim()
      ? parsed.score.trim()
      : 'Unknown';
  const reasoning =
    typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : 'No reasoning provided.';
  const guidelineSections: string[] = Array.isArray(parsed.guidelineSections)
    ? parsed.guidelineSections.map((s: any) => String(s))
    : [];

  return {
    dimension: dim,
    score,
    reasoning,
    guidelineSections,
  };
}

export async function evaluatePageWithGuidelines(
  input: PageEvalInput
): Promise<PageEvalResult> {
  if (!input.query || !input.pageSummary) {
    throw new Error('evaluatePageWithGuidelines: query and pageSummary are required');
  }

  const classification = await classifyPage(input);

  const dimensions: QualityDimension[] = [
    'needs_met',
    'page_quality',
    'eeat',
    'ads_ux',
    'deception',
  ];

  const scores: DimensionScore[] = [];
  for (const dim of dimensions) {
    // Run sequentially for now; could be parallelized later.
    const s = await scoreDimension(dim, classification, input);
    scores.push(s);
  }

  return {
    classification,
    dimensions: scores,
  };
}


