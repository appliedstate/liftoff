export type GoogleRsocRiskBand = 'white' | 'grey' | 'black';
export type GoogleRsocSeverity = 'soft' | 'hard';

export type GoogleRsocSurface =
  | 'traffic_source_truth'
  | 'referrer_ad_creative'
  | 'dishonest_declarations'
  | 'page_value'
  | 'widget_implementation'
  | 'query_integrity';

export type GoogleRsocPolicyRef = {
  label: string;
  url: string;
};

export type GoogleRsocFinding = {
  surface: GoogleRsocSurface;
  severity: GoogleRsocSeverity;
  score: number;
  title: string;
  summary: string;
  evidence: string[];
  policyRefs: GoogleRsocPolicyRef[];
};

export type GoogleRsocComplianceInput = {
  primaryText?: string | null;
  headline?: string | null;
  description?: string | null;
  transcript?: string | null;
  cta?: string | null;
  routeUrl?: string | null;
  intendedUrl?: string | null;
  landingArticleTitle?: string | null;
  landingArticleSummary?: string | null;
  landingArticleBody?: string | null;
  landingMetaDescription?: string | null;
  rsocKeywords?: string[];
  rsocKeywordSource?: 'dom_widget' | 'url_forcekeys' | 'both' | 'none' | null;
  domKeywordPhrases?: string[];
  urlParamKeywordPhrases?: string[];
  widgetTexts?: string[];
  widgetPlacement?: {
    firstWidgetPosition?: 'above_fold' | 'below_fold' | 'not_found' | null;
    contentBeforeFirstWidget?: number | null;
    widgetInterruptsContent?: boolean | null;
  } | null;
  referrerProof?: {
    isArbitrage?: boolean | null;
    hasReferrerProof?: boolean | null;
    status?: 'ok' | 'missing_proof' | 'not_required' | null;
    referrerAdCreative?: string | null;
  } | null;
  rsocSite?: string | null;
  s1GoogleAccount?: string | null;
};

export type GoogleRsocComplianceResult = {
  overallBand: GoogleRsocRiskBand;
  totalScore: number;
  verdict: string;
  findings: GoogleRsocFinding[];
  summary: string[];
  recommendations: string[];
  evidence: {
    adCopyReviewed: Array<{ surface: string; text: string }>;
    supportedDestinationEvidence: string[];
    unsupportedPromises: string[];
    rsocSite: string | null;
    s1GoogleAccount: string | null;
    rsocKeywords: string[];
    rsocKeywordSource: 'dom_widget' | 'url_forcekeys' | 'both' | 'none';
  };
  policyRefs: GoogleRsocPolicyRef[];
};

const POLICY_REFS = {
  relatedSearchContent: {
    label: 'Google AdSense Help: Related search for your content pages',
    url: 'https://support.google.com/adsense/answer/10233819?hl=en',
  },
  afsPolicies: {
    label: 'Google AdSense Help: AdSense for Search (AFS) policies',
    url: 'https://support.google.com/adsense/answer/1354757?hl=en',
  },
  rafViolations: {
    label: 'Google AdSense Help: RAF in-scope policy violations',
    url: 'https://support.google.com/adsense/answer/16269587',
  },
  searchParams: {
    label: 'Google AdSense Help: Search ads parameter descriptions',
    url: 'https://support.google.com/adsense/answer/9055049?hl=en',
  },
  publisherPolicies: {
    label: 'Google AdSense Help: Google Publisher Policies',
    url: 'https://support.google.com/adsense/answer/10502938?hl=en',
  },
  asqPolicies: {
    label: 'Google AdSense Help: Alternative Search Query policies',
    url: 'https://support.google.com/adsense/answer/9467389?hl=en',
  },
  changeLog: {
    label: 'Google AdSense Help: AdSense policy change log',
    url: 'https://support.google.com/adsense/answer/9336650?hl=en-EN',
  },
} as const;

const PROMISE_PATTERNS: Array<{
  title: string;
  regex: RegExp;
  supportTokens: string[];
}> = [
  {
    title: 'free_offer',
    regex: /\bfree\b[^.!?\n]{0,40}\b(kit|guide|report|quote|trial|bonus)\b/gi,
    supportTokens: ['free', 'kit'],
  },
  {
    title: 'bonus_offer',
    regex: /\$\s?\d[\d,]*(?:\s*(?:gold coin )?)?\s*bonus\b/gi,
    supportTokens: ['bonus'],
  },
  {
    title: 'qualification_gate',
    regex: /\b(see if you qualify|qualify|approved|eligibility requirements apply)\b/gi,
    supportTokens: ['qualify', 'approved', 'eligibility'],
  },
  {
    title: 'urgency_scarcity',
    regex: /\b(before the bonus ends|limited time|ends soon|hurry)\b/gi,
    supportTokens: ['ends', 'limited', 'hurry'],
  },
  {
    title: 'no_cost',
    regex: /\bno cost\b|\[\$0 cost\]|\$0 cost/gi,
    supportTokens: ['no cost', '$0 cost', '0 cost'],
  },
];

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitSentences(text: string): string[] {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function bandForScore(score: number): GoogleRsocRiskBand {
  if (score >= 28) return 'black';
  if (score >= 12) return 'grey';
  return 'white';
}

function collectAdCopy(input: GoogleRsocComplianceInput): Array<{ surface: string; text: string }> {
  const rows = [
    { surface: 'primaryText', text: normalizeText(input.primaryText) },
    { surface: 'headline', text: normalizeText(input.headline) },
    { surface: 'description', text: normalizeText(input.description) },
    { surface: 'transcript', text: normalizeText(input.transcript) },
    { surface: 'cta', text: normalizeText(input.cta) },
  ];
  return rows.filter((row) => row.text.length > 0);
}

function landingCorpus(input: GoogleRsocComplianceInput): string {
  return [
    normalizeText(input.landingArticleTitle),
    normalizeText(input.landingMetaDescription),
    normalizeText(input.landingArticleSummary),
    normalizeText(input.landingArticleBody),
  ]
    .filter(Boolean)
    .join('\n');
}

function extractPromises(adCopyRows: Array<{ surface: string; text: string }>): string[] {
  const found: string[] = [];
  for (const row of adCopyRows) {
    for (const pattern of PROMISE_PATTERNS) {
      const matches = row.text.match(pattern.regex) || [];
      for (const match of matches) found.push(normalizeText(match));
    }
  }
  return unique(found);
}

function sentenceEvidence(corpus: string, tokens: string[]): string[] {
  const sentences = splitSentences(corpus);
  const lowerTokens = unique(tokens.map((token) => token.toLowerCase()).filter(Boolean));
  return sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return lowerTokens.some((token) => lower.includes(token));
  }).slice(0, 5);
}

function supportTokensForPromise(promise: string): string[] {
  const lower = promise.toLowerCase();
  for (const pattern of PROMISE_PATTERNS) {
    if (pattern.supportTokens.some((token) => lower.includes(token.toLowerCase()))) {
      return pattern.supportTokens;
    }
  }
  return lower.match(/[a-z0-9$]+/gi) || [];
}

function compareExactCreative(referrerAdCreative: string, adCopyRows: Array<{ surface: string; text: string }>): boolean {
  const rac = normalizeText(referrerAdCreative).toLowerCase();
  if (!rac) return false;
  const upstream = adCopyRows.map((row) => row.text.toLowerCase());
  return upstream.some((text) => text.includes(rac) || rac.includes(text));
}

export function evaluateGoogleRsocCompliance(input: GoogleRsocComplianceInput): GoogleRsocComplianceResult {
  const adCopyRows = collectAdCopy(input);
  const landing = landingCorpus(input);
  const findings: GoogleRsocFinding[] = [];
  const recommendations: string[] = [];
  const promises = extractPromises(adCopyRows);
  const unsupportedPromises: string[] = [];

  if (input.referrerProof?.isArbitrage && !input.referrerProof?.hasReferrerProof) {
    findings.push({
      surface: 'referrer_ad_creative',
      severity: 'hard',
      score: 22,
      title: 'Missing referrerAdCreative on paid / controlled traffic',
      summary:
        'Traffic appears to arrive from a controlled paid source, but the required referrerAdCreative provenance parameter is missing.',
      evidence: [
        `isArbitrage=${String(input.referrerProof?.isArbitrage)}`,
        `referrerProof.status=${String(input.referrerProof?.status || 'unknown')}`,
      ],
      policyRefs: [POLICY_REFS.relatedSearchContent, POLICY_REFS.changeLog, POLICY_REFS.rafViolations],
    });
    recommendations.push('Populate referrerAdCreative for every controlled paid traffic arrival to a related-search content page.');
  }

  if (input.referrerProof?.hasReferrerProof && input.referrerProof?.referrerAdCreative) {
    const accurate = compareExactCreative(input.referrerProof.referrerAdCreative, adCopyRows);
    if (!accurate) {
      findings.push({
        surface: 'dishonest_declarations',
        severity: 'hard',
        score: 18,
        title: 'referrerAdCreative does not match upstream creative text',
        summary:
          'Google requires the referrerAdCreative declaration to be precise and complete. The supplied value does not appear to match the upstream creative surfaces reviewed here.',
        evidence: [
          `referrerAdCreative=${normalizeText(input.referrerProof.referrerAdCreative)}`,
          ...adCopyRows.slice(0, 3).map((row) => `${row.surface}: ${row.text}`),
        ],
        policyRefs: [POLICY_REFS.relatedSearchContent, POLICY_REFS.searchParams, POLICY_REFS.publisherPolicies],
      });
      recommendations.push('Use a literal, complete transcription of the upstream ad creative in referrerAdCreative.');
    }
  }

  for (const promise of promises) {
    const support = sentenceEvidence(landing, supportTokensForPromise(promise));
    if (support.length === 0) unsupportedPromises.push(promise);
  }

  if (unsupportedPromises.length > 0) {
    findings.push({
      surface: 'traffic_source_truth',
      severity: 'hard',
      score: 18,
      title: 'Traffic source promises are not clearly fulfillable on the destination page',
      summary:
        'The ad or upstream traffic source appears to promise offers or qualification states that are unavailable or not easily found on the destination page itself.',
      evidence: unsupportedPromises,
      policyRefs: [POLICY_REFS.relatedSearchContent, POLICY_REFS.publisherPolicies],
    });
    recommendations.push('Remove promotional promises from upstream traffic sources unless they are plainly and easily found on the destination page.');
  }

  const wordCountMatch = normalizeText(input.landingArticleSummary).match(/Word Count:\s*(\d+)/i);
  const wordCount = wordCountMatch ? Number(wordCountMatch[1]) : null;
  const lowValueSignals: string[] = [];
  if (!normalizeText(input.landingArticleTitle)) lowValueSignals.push('missing title');
  if (!normalizeText(input.landingArticleBody) && !normalizeText(input.landingArticleSummary)) lowValueSignals.push('missing article text');
  if (wordCount !== null && wordCount < 300) lowValueSignals.push(`low word count (${wordCount})`);
  if (/Ad density:\s*high/i.test(normalizeText(input.landingArticleSummary))) lowValueSignals.push('high ad density');

  if (lowValueSignals.length > 0) {
    findings.push({
      surface: 'page_value',
      severity: lowValueSignals.includes('missing article text') ? 'hard' : 'soft',
      score: lowValueSignals.includes('missing article text') ? 16 : 8,
      title: 'Destination page may not provide enough standalone value',
      summary:
        'Google requires related-search content pages to provide sufficient standalone value beyond the monetization unit.',
      evidence: lowValueSignals,
      policyRefs: [POLICY_REFS.relatedSearchContent, POLICY_REFS.rafViolations, POLICY_REFS.publisherPolicies],
    });
    recommendations.push('Ensure the landing page has clear, original, standalone text value before the related-search experience.');
  }

  const widgetPlacement = input.widgetPlacement || {};
  const widgetSignals: string[] = [];
  if (widgetPlacement.firstWidgetPosition === 'above_fold' && (widgetPlacement.contentBeforeFirstWidget || 0) < 150) {
    widgetSignals.push(`widget above fold with only ${widgetPlacement.contentBeforeFirstWidget || 0} words before it`);
  }
  if (widgetPlacement.widgetInterruptsContent) widgetSignals.push('widget interrupts content before substantial value is delivered');
  if (widgetSignals.length > 0) {
    findings.push({
      surface: 'widget_implementation',
      severity: 'hard',
      score: 16,
      title: 'Related-search implementation may draw unnatural attention',
      summary:
        'The widget placement looks too close to the focal point of the page and may encourage accidental or deceptive engagement.',
      evidence: widgetSignals,
      policyRefs: [POLICY_REFS.relatedSearchContent, POLICY_REFS.rafViolations],
    });
    recommendations.push('Move the related-search unit farther down or add more relevant textual content before it so it remains complementary rather than focal.');
  }

  const rsocKeywords = unique((input.rsocKeywords || []).map((term) => normalizeText(term)).filter(Boolean));
  const unsupportedKeywords = rsocKeywords.filter((term) => {
    const support = sentenceEvidence(landing, term.match(/[a-z0-9$]+/gi) || []);
    const lower = term.toLowerCase();
    const hasPromotionalSignal = /(\$0|free|bonus|approved|qualify)/i.test(term);
    if (hasPromotionalSignal) {
      return !landing.toLowerCase().includes(lower) && support.length === 0;
    }
    return support.length === 0;
  });

  if (unsupportedKeywords.length > 0) {
    findings.push({
      surface: 'query_integrity',
      severity: 'soft',
      score: 10,
      title: 'Some related-search / RAF terms are not clearly supported by the page',
      summary:
        'Google requires related-search and partner-provided terms to reflect relevant user intent rather than monetization-oriented query shaping.',
      evidence: unsupportedKeywords.slice(0, 8),
      policyRefs: [POLICY_REFS.relatedSearchContent, POLICY_REFS.asqPolicies, POLICY_REFS.searchParams],
    });
    recommendations.push('Tighten related-search or RAF terms so they are fully supported by the article and do not extend beyond the page promise.');
  }

  const totalScore = findings.reduce((sum, finding) => sum + finding.score, 0);
  const overallBand = bandForScore(totalScore);
  const verdict =
    overallBand === 'white'
      ? 'Low apparent Google/RSOC compliance risk based on current page, provenance, and term signals.'
      : overallBand === 'grey'
        ? 'Material Google/RSOC compliance risk exists. The flow should be reviewed before scaling.'
        : 'High Google/RSOC compliance risk. The flow should be treated as failing until corrected.';

  const summary = [
    `Total Google/RSOC compliance score: ${totalScore}.`,
    `Overall band: ${overallBand.toUpperCase()}.`,
    ...(findings.length > 0
      ? findings.slice(0, 3).map((finding) => `${finding.title}: ${finding.summary}`)
      : ['No major Google/RSOC rule triggers were detected in this first-pass lens.']),
  ];

  return {
    overallBand,
    totalScore,
    verdict,
    findings,
    summary,
    recommendations: unique(recommendations),
    evidence: {
      adCopyReviewed: adCopyRows,
      supportedDestinationEvidence: unique(
        [
          ...sentenceEvidence(landing, ['gold', 'retirement', 'ira', 'investment']),
          ...sentenceEvidence(landing, ['free', 'bonus', 'qualify', 'approved']),
        ].slice(0, 8)
      ),
      unsupportedPromises,
      rsocSite: input.rsocSite || null,
      s1GoogleAccount: input.s1GoogleAccount || null,
      rsocKeywords,
      rsocKeywordSource: input.rsocKeywordSource || 'none',
    },
    policyRefs: unique(
      findings.flatMap((finding) => finding.policyRefs.map((ref) => `${ref.label}|${ref.url}`))
    ).map((entry) => {
      const [label, url] = entry.split('|');
      return { label, url };
    }),
  };
}
