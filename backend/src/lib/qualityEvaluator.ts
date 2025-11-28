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
   * Either provide a URL to extract, OR provide the structured content directly.
   * If url is provided, the system will extract full article content automatically.
   */
  url?: string;
  /**
   * Structured article content (if not providing URL).
   * If url is provided, these fields will be auto-populated from extraction.
   */
  pageSummary?: string; // Title, H1, author, headings summary
  widgetSummary?: string; // Monetization/widgets description
  fullArticleText?: string; // Full article body content
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
  aiContentDetection?: {
    aiLikelihood: number;
    isScaledContentAbuse: boolean;
    confidence: number;
    signals: {
      repetitivePatterns: boolean;
      genericLanguage: boolean;
      perfectGrammar: boolean;
      lacksPersonalVoice: boolean;
      missingSpecificDetails: boolean;
      templatedStructure: boolean;
      lowOriginality: boolean;
    };
    evidence: string[];
  };
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

  const contextParts: string[] = [
    `User query (force key): ${input.query}`,
    '',
  ];

  if (input.pageSummary) {
    contextParts.push('Page metadata:', input.pageSummary, '');
  }

  if (input.fullArticleText) {
    // Use first 2000 chars for classification (enough to determine YMYL, purpose)
    const articlePreview = input.fullArticleText.slice(0, 2000);
    contextParts.push('Article preview:', articlePreview, '');
  }

  if (input.widgetSummary) {
    contextParts.push('Monetization/widgets summary:', input.widgetSummary, '');
  }

  const prompt = [
    'You are a Google Search Quality rater following the Search Quality Evaluator Guidelines.',
    'Classify the page based on the official guidelines.',
    '',
    'IMPORTANT: If this is medical, health, financial, or legal content, it is YMYL (Your Money or Your Life) and requires the highest standards.',
    '',
    ...contextParts,
    'Return JSON with fields: ymyL (boolean), purpose (short phrase), contentType (one of: "article", "landing_page", "tool", "forum", "other").',
    'For ymyL: Set to true if the content is about health, medical, financial, legal, or safety topics that could impact users\' wellbeing.',
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
  // If user explicitly hints YMYL, trust that (they know their content)
  const isYMYL = input.ymyLHint === true ? true : (typeof parsed.ymyL === 'boolean' ? parsed.ymyL : false);
  
  return {
    ymyL: isYMYL,
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
    k: parseInt(process.env.QUALITY_EVAL_CHUNKS_PER_DIMENSION || '12', 10), // Increased from 6 for better coverage
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
      'Evaluate how ads, widgets, and layout affect user experience. The PDF discusses "Supplementary Content (SC)" placement and its impact on user experience. Consider: widget placement (above/below fold, interrupting content), amount of content before widgets, RSOC widget keywords relevance. Output one of "Problematic", "Borderline", or "Acceptable".',
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

  // Detect AI-generated/scaled content abuse
  // NOTE: AI detection is CUSTOM - the PDF mentions "scaled content abuse" but doesn't provide
  // specific detection algorithms. Our detector catches both fully AI-generated (high confidence)
  // and partially AI-written content (lower thresholds, 15%+ AI likelihood flagged).
  let aiContentWarning = '';
  if (input.fullArticleText) {
    const { detectScaledContentAbuse } = await import('./aiContentDetector');
    const wordCount = input.fullArticleText.split(/\s+/).filter(w => w.length > 0).length;
    const abuseCheck = detectScaledContentAbuse(input.fullArticleText, wordCount);
    
    if (abuseCheck.isAbuse) {
      aiContentWarning = `\n\n⚠️ SCALED CONTENT ABUSE DETECTED (confidence: ${(abuseCheck.confidence * 100).toFixed(0)}%): ${abuseCheck.reasons.join('; ')}. This indicates LOW-VALUE, TEMPLATED AI content - Google's SpamBrain penalizes scaled content abuse. Score accordingly lower.`;
    } else if (abuseCheck.confidence > 0.15) {
      // Lower threshold to catch partial AI (15%+ AI content with low-value patterns)
      aiContentWarning = `\n\n⚠️ Possible low-value AI content detected (${(abuseCheck.confidence * 100).toFixed(0)}% confidence): ${abuseCheck.reasons.slice(0, 2).join('; ')}. Google penalizes AI content that doesn't add unique value or is templated/scaled. Review carefully.`;
    }
  }

  // Build strict evaluation instructions
  const strictnessNote = classification.ymyL
    ? 'CRITICAL: This is YMYL (Your Money or Your Life) content. Apply the HIGHEST standards. Medical/health content requires visible expertise, authoritativeness, and trustworthiness. If author credentials are missing or unclear, if the site lacks reputation, or if content seems thin or AI-generated, score accordingly lower.'
    : 'Apply strict quality standards. Look for signs of thin content, scaled content abuse, missing E-E-A-T, deceptive practices, or low value.';

  const instructions = [
    taskInstructions[dim],
    expectedScoreHint[dim],
    strictnessNote,
    'Use only the information from the page summary and the guideline excerpts.',
    'When evaluating, be STRICT and CONSERVATIVE. If there are ANY red flags (missing author credentials, thin content, unclear expertise, excessive ads, etc.), score lower.',
    'Remember: Google penalizes pages that fail to meet quality standards. Err on the side of caution.',
  ].join(' ');

  // Build comprehensive page context
  const pageContextParts: string[] = [
    `User query (force key): ${input.query}`,
    '',
  ];

  if (input.pageSummary) {
    pageContextParts.push('Page metadata:', input.pageSummary, '');
  }

  if (input.fullArticleText) {
    pageContextParts.push(
      'Full article content:',
      input.fullArticleText.length > 8000
        ? input.fullArticleText.slice(0, 8000) + ' [truncated for length]'
        : input.fullArticleText,
      ''
    );
  }

  if (input.widgetSummary) {
    pageContextParts.push('Monetization/widgets summary:', input.widgetSummary, '');
  }

  const prompt = [
    'GUIDELINE EXCERPTS:',
    ctx,
    '',
    'PAGE CONTEXT:',
    pageContextParts.join('\n'),
    aiContentWarning, // Add AI detection warning if present
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
        content: [
          'You are a strict Google Search Quality rater following the official Search Quality Evaluator Guidelines.',
          'Apply CONSERVATIVE standards. Google penalizes low-quality, thin, or deceptive content.',
          'For YMYL content: Require visible expertise, author credentials, and authoritative sources. Missing these is a major red flag.',
          'Look for red flags:',
          '- Thin or low-value content',
          '- Missing or unclear author credentials (especially for YMYL)',
          '- Scaled content abuse (low-value AI content, templated, non-unique, mass-produced)',
          '- Excessive ads/widgets interfering with content',
          '- Deceptive or misleading information',
          '- Lack of E-E-A-T (especially for YMYL topics)',
          '- Non-unique content (Google penalizes AI content that doesn\'t add unique value)',
          'When in doubt, score LOWER. It is better to be too strict than too lenient.',
          'Base all judgments strictly on the provided guideline excerpts.',
        ].join('\n'),
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
  if (!input.query) {
    throw new Error('evaluatePageWithGuidelines: query is required');
  }

  // If URL provided, extract full article content
  let evalInput = input;
  if (input.url) {
    const { extractArticleFromUrl, articleToEvaluationInput } = await import('./articleExtractor');
    const article = await extractArticleFromUrl(input.url);
    const extracted = articleToEvaluationInput(article, input.query);
    evalInput = {
      ...input,
      pageSummary: extracted.pageSummary,
      widgetSummary: extracted.widgetSummary,
      fullArticleText: extracted.fullArticleText,
    };
  }

  // Validate we have content to evaluate
  if (!evalInput.pageSummary && !evalInput.fullArticleText) {
    throw new Error(
      'evaluatePageWithGuidelines: either url, pageSummary, or fullArticleText must be provided'
    );
  }

  const classification = await classifyPage(evalInput);

  const dimensions: QualityDimension[] = [
    'needs_met',
    'page_quality',
    'eeat',
    'ads_ux',
    'deception',
  ];

  // Detect AI-generated/scaled content abuse
  let aiContentDetection: PageEvalResult['aiContentDetection'] | undefined;
  if (evalInput.fullArticleText) {
    const { detectAIContentSignals, detectScaledContentAbuse } = await import('./aiContentDetector');
    const wordCount = evalInput.fullArticleText.split(/\s+/).filter(w => w.length > 0).length;
    const aiSignals = detectAIContentSignals(evalInput.fullArticleText);
    const abuseCheck = detectScaledContentAbuse(evalInput.fullArticleText, wordCount);
    
    aiContentDetection = {
      aiLikelihood: aiSignals.aiLikelihood,
      isScaledContentAbuse: abuseCheck.isAbuse,
      confidence: abuseCheck.confidence,
      signals: aiSignals.signals,
      evidence: [...aiSignals.evidence, ...abuseCheck.reasons],
    };
  }

  const scores: DimensionScore[] = [];
  for (const dim of dimensions) {
    // Run sequentially for now; could be parallelized later.
    const s = await scoreDimension(dim, classification, evalInput);
    scores.push(s);
  }

  return {
    classification,
    dimensions: scores,
    ...(aiContentDetection && { aiContentDetection }),
  };
}


