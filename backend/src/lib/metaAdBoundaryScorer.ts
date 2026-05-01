export type MetaRiskBand = 'white' | 'grey' | 'black';
export type AssetBanRisk = 'low' | 'moderate' | 'high' | 'critical';

export type RiskSurface =
  | 'personal_attribute_inference'
  | 'medical_claim_hype'
  | 'medical_condition_targeting'
  | 'study_compensation_framing'
  | 'economic_vulnerability'
  | 'job_income_opportunity'
  | 'demographic_targeting'
  | 'manipulative_hook'
  | 'trust_mismatch_spam';

export type TriggerSeverity = 'soft' | 'hard';
export type EvidenceType = 'official' | 'historical' | 'inferred';

export type RiskTrigger = {
  surface: RiskSurface;
  severity: TriggerSeverity;
  score: number;
  match: string;
  reason: string;
  evidenceType: EvidenceType;
  confidence: 'low' | 'medium' | 'high';
  evidenceNote: string;
};

export type LineRiskScore = {
  line: string;
  score: number;
  band: MetaRiskBand;
  triggers: RiskTrigger[];
};

export type MetaBoundaryScore = {
  overallBand: MetaRiskBand;
  totalScore: number;
  assetBanRisk: AssetBanRisk;
  familyScores: Record<RiskSurface, number>;
  lineScores: LineRiskScore[];
  combos: string[];
  summary: string[];
  recommendations: string[];
  review: {
    verdict: string;
    whyBand: string[];
    surfaceFindings: Array<{
      surface: RiskSurface;
      label: string;
      score: number;
      active: boolean;
      severity: 'none' | TriggerSeverity;
      explanation: string;
      matchedPhrases: string[];
      affectedLines: string[];
      recommendations: string[];
      evidenceType: EvidenceType;
      confidence: 'low' | 'medium' | 'high';
      evidenceNote: string;
    }>;
    comboFindings: Array<{
      name: string;
      score: number;
      explanation: string;
    }>;
    lineFindings: Array<{
      line: string;
      band: MetaRiskBand;
      score: number;
      why: string;
      issues: Array<{
        surface: RiskSurface;
        label: string;
        severity: TriggerSeverity;
        match: string;
        reason: string;
        evidenceType: EvidenceType;
        confidence: 'low' | 'medium' | 'high';
        evidenceNote: string;
      }>;
      rewriteGuidance: string[];
    }>;
  };
};

type Detector = {
  surface: RiskSurface;
  severity: TriggerSeverity;
  score: number;
  reason: string;
  pattern: RegExp;
  requiresResearchContext?: boolean;
  forbidResearchContext?: boolean;
  evidenceType: EvidenceType;
  confidence: 'low' | 'medium' | 'high';
  evidenceNote: string;
};

const DETECTORS: Detector[] = [
  {
    surface: 'personal_attribute_inference',
    severity: 'hard',
    score: 16,
    reason: 'Implies the viewer has a sensitive health condition or status.',
    pattern: /\b(do you have|have diabetes|with diabetes|suffer from|depressed\?|anxious\?)\b/i,
    evidenceType: 'inferred',
    confidence: 'high',
    evidenceNote: 'Grounded in Meta sensitivity around health-status inference, but this exact phrase rule is internal inference rather than a directly cited policy clause.',
  },
  {
    surface: 'personal_attribute_inference',
    severity: 'soft',
    score: 14,
    reason: 'Uses local-relevance phrasing that can read as “we know this applies to you.”',
    pattern: /\b(near you|cerca de ti|cerca de usted|close to you)\b/i,
    evidenceType: 'inferred',
    confidence: 'medium',
    evidenceNote: 'Meta does not appear to ban “near you” categorically; this is risky mainly when paired with sensitive conditions or vulnerable offers.',
  },
  {
    surface: 'medical_condition_targeting',
    severity: 'soft',
    score: 8,
    reason: 'Names a medical condition or procedure, which raises sensitivity and review scrutiny.',
    pattern: /\b(diabetes|depressed|anxious|neuropathy|dental implants?|clinical research|clinical trial|ensayos clínicos)\b/i,
    evidenceType: 'inferred',
    confidence: 'medium',
    evidenceNote: 'Naming a condition is not categorically prohibited; this is a sensitivity rule based on health-related review patterns.',
  },
  {
    surface: 'medical_claim_hype',
    severity: 'hard',
    score: 14,
    reason: 'Uses exaggerated treatment or care framing.',
    pattern: /\b(groundbreaking treatments?|innovative treatments?|elite care|world class care|exclusive access)\b/i,
    evidenceType: 'historical',
    confidence: 'high',
    evidenceNote: 'Strongly supported by the local reject corpus and deceptive/misleading enforcement patterns, but not a published banned-phrase list.',
  },
  {
    surface: 'economic_vulnerability',
    severity: 'hard',
    score: 13,
    reason: 'Frames affordability or vulnerability in a sensitive way.',
    pattern: /\b(no insurance required|no necesitas seguro|bad credit|sin seguro|0 down|\$0|low monthly|monthly payments?|rebates?)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Mostly an empirical risk pattern from rejected ads, not a standalone official prohibition.',
  },
  {
    surface: 'study_compensation_framing',
    severity: 'soft',
    score: 10,
    reason: 'Leads with compensation in a research-participation context.',
    pattern: /\b(get paid|paid(?: to)? participate|compensation|stipend|receive up to|up to \$?\d+[kK]?\/?(day|week)?|\$?\d+[kK]?\s*(compensation|stipend))\b/i,
    requiresResearchContext: true,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'This is intended to reduce false job-classification on paid clinical-trial ads while still flagging incentive-forward research copy as review-sensitive.',
  },
  {
    surface: 'job_income_opportunity',
    severity: 'hard',
    score: 18,
    reason: 'Promises earnings or easy opportunity language associated with scam/job enforcement.',
    pattern: /\b(extra \$?\d+|gigs|easy jobs?|trabajos fáciles|opportunity near you|work opportunity|pick up gigs|side hustle|earn from home|get paid daily)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Intentionally over-catches scam/job-style compensation language and can false-positive on clinical-trial payment framing without more context.',
  },
  {
    surface: 'demographic_targeting',
    severity: 'soft',
    score: 8,
    reason: 'Calls out age or demographic groups directly.',
    pattern: /\b(seniors?|50\+|over 18|18\+ only|male dentist|women|men)\b/i,
    evidenceType: 'historical',
    confidence: 'low',
    evidenceNote: 'Meta does not appear to prohibit these copy terms categorically in normal adult ads; this is treated as empirical review risk, not an official ban.',
  },
  {
    surface: 'manipulative_hook',
    severity: 'soft',
    score: 9,
    reason: 'Uses sensational or manipulative hook framing.',
    pattern: /\b(force dealerships to do this|in a pickle|almost nothing|approved for|see what(?:'s| is) left|leftover|record setting)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Based on local rejects and deceptive-link/spam patterns rather than a published phrase blacklist.',
  },
  {
    surface: 'trust_mismatch_spam',
    severity: 'soft',
    score: 8,
    reason: 'Aggressive CTA or vague destination language often correlates with spam/deceptive-link review.',
    pattern: /\b(check the link below|tap below|join now|learn more below|article below)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Empirical spam/deceptive-link pattern, not a direct policy quote.',
  },
  {
    surface: 'trust_mismatch_spam',
    severity: 'soft',
    score: 8,
    reason: 'Urgency and scarcity language increases trust-mismatch risk when paired with sensitive offers.',
    pattern: /\b(spots fill up quickly|enrollment is open|now available|limited spots?|hurry)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Review-risk heuristic based on spam/deceptive outcomes, not a standalone official prohibition.',
  },
  {
    surface: 'job_income_opportunity',
    severity: 'hard',
    score: 14,
    reason: 'Signals recruiting or job/opportunity framing.',
    pattern: /\b(participants needed|se buscan participantes|job opportunity|trabajo cerca de ti|employment|opportunity)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Useful for catching scam/employment patterns, but can false-positive on research recruitment language without additional context.',
  },
  {
    surface: 'economic_vulnerability',
    severity: 'soft',
    score: 8,
    reason: 'Financing or affordability framing can trigger financial-services review.',
    pattern: /\b(financing|monthly|payments?|insurance savings|save money|enganche|mensualidades)\b/i,
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Primarily an empirical review-sensitivity rule based on rejected ads.',
  },
];

const ALL_SURFACES: RiskSurface[] = [
  'personal_attribute_inference',
  'medical_claim_hype',
  'medical_condition_targeting',
  'study_compensation_framing',
  'economic_vulnerability',
  'job_income_opportunity',
  'demographic_targeting',
  'manipulative_hook',
  'trust_mismatch_spam',
];

const SURFACE_META: Record<RiskSurface, { label: string; explanation: string; recommendations: string[]; evidenceType: EvidenceType; confidence: 'low' | 'medium' | 'high'; evidenceNote: string }> = {
  personal_attribute_inference: {
    label: 'Personal Attribute Inference',
    explanation: 'This surface fires when the copy sounds like it knows the viewer has a sensitive condition, status, or local relevance.',
    recommendations: ['Remove “near you” and other language that implies the ad knows who the viewer is or what they have.'],
    evidenceType: 'inferred',
    confidence: 'high',
    evidenceNote: 'Grounded in Meta sensitivity around special-protection topics, but the phrase-level implementation is internal inference.',
  },
  medical_claim_hype: {
    label: 'Medical Claim Hype',
    explanation: 'This surface fires when treatment, care, or outcome language sounds exaggerated, premium, or insufficiently supported.',
    recommendations: ['Replace superlatives and hype with neutral, factual descriptions supported by the landing page.'],
    evidenceType: 'historical',
    confidence: 'high',
    evidenceNote: 'Best treated as a historical/deceptive-risk pattern rather than a directly cited Meta phrase ban.',
  },
  medical_condition_targeting: {
    label: 'Medical Condition Targeting',
    explanation: 'This surface activates when the ad directly names a medical condition, procedure, or clinical context that increases policy sensitivity.',
    recommendations: ['Use condition language carefully and avoid stacking it with personalization, hype, or vulnerability framing.'],
    evidenceType: 'inferred',
    confidence: 'medium',
    evidenceNote: 'Naming a condition is not categorically prohibited, but it raises sensitivity and becomes risky in combination.',
  },
  study_compensation_framing: {
    label: 'Study Compensation Framing',
    explanation: 'This surface activates when a research or clinical-trial ad leads with payment or stipend language. It is not the same as Meta officially classifying the ad as employment.',
    recommendations: ['Move compensation lower in the message, keep it factual, and avoid making payment the primary hook.'],
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Empirical risk pattern for research ads. Useful to separate paid-study messaging from true employment/job claims.',
  },
  economic_vulnerability: {
    label: 'Economic Vulnerability',
    explanation: 'This surface captures affordability, insurance, payments, and similar hooks that can read as exploiting financial vulnerability.',
    recommendations: ['Strip affordability hooks unless they are essential, neutral, and clearly supported by the landing page.'],
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'This surface is empirical and should be read as review-risk, not direct policy text.',
  },
  job_income_opportunity: {
    label: 'Job / Income Opportunity',
    explanation: 'This surface covers recruiting, earnings, and opportunity language that sits in Meta’s higher-enforcement scam and employment area.',
    recommendations: ['Remove earnings, easy-income, and recruiting language unless the offer is explicitly and safely in-policy.'],
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'This can false-positive on paid study recruitment; treat it as a high-risk pattern, not an automatic jobs classification.',
  },
  demographic_targeting: {
    label: 'Demographic Callout',
    explanation: 'This surface flags direct age or demographic callouts because they often correlate with reject patterns in scam-adjacent offers, not because Meta clearly bans them across normal adult ads.',
    recommendations: ['Avoid direct demographic callouts in copy unless they are absolutely required and policy-safe.'],
    evidenceType: 'historical',
    confidence: 'low',
    evidenceNote: 'Empirical risk, not a confirmed official prohibition for normal adult ads.',
  },
  manipulative_hook: {
    label: 'Manipulative Hook',
    explanation: 'This surface captures sensationalized curiosity bait that can make the ad feel deceptive or spam-adjacent.',
    recommendations: ['Swap forced-curiosity hooks for specific, credible statements that still create interest.'],
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Historical spam/deceptive pattern.',
  },
  trust_mismatch_spam: {
    label: 'Trust Mismatch / Spam',
    explanation: 'This surface reflects vague CTA language, urgency, or message patterns that often correlate with deceptive destination mismatch.',
    recommendations: ['Use precise CTA language and keep the promise tightly aligned with the landing experience.'],
    evidenceType: 'historical',
    confidence: 'medium',
    evidenceNote: 'Empirical spam/deceptive-link pattern.',
  },
};

const COMBO_LIBRARY: Record<string, { score: number; explanation: string }> = {
  'Medical condition + personal-attribute inference': {
    score: 18,
    explanation: 'Naming a condition while also sounding like the ad knows it applies to the viewer creates a much stronger policy risk signal.',
  },
  'Medical condition + treatment/care hype': {
    score: 14,
    explanation: 'Condition-sensitive ads get riskier when treatment or care claims become aspirational, premium, or exaggerated.',
  },
  'Medical condition + study-compensation framing': {
    score: 8,
    explanation: 'Condition-sensitive research ads get riskier when payment is pushed as the primary hook.',
  },
  'Medical condition + affordability/vulnerability framing': {
    score: 14,
    explanation: 'Health-sensitive copy paired with insurance or affordability hooks often reads as targeting vulnerability.',
  },
  'Job/income promise + economic-vulnerability framing': {
    score: 16,
    explanation: 'Opportunity language combined with money pressure is a classic high-enforcement scam pattern.',
  },
  'Demographic targeting + financial/eligibility framing': {
    score: 14,
    explanation: 'Calling out a demographic while also talking about affordability or eligibility increases discrimination and policy risk.',
  },
  'Manipulative hook + trust-mismatch/spam cues': {
    score: 10,
    explanation: 'Aggressive curiosity bait plus vague CTA language pushes the ad toward deceptive or spam-like review patterns.',
  },
  'Three or more hard-risk families active': {
    score: 15,
    explanation: 'Once several hard-risk surfaces are active together, the ad starts to look like a system-level policy problem rather than a single bad phrase.',
  },
};

function createFamilyScores(): Record<RiskSurface, number> {
  return {
    personal_attribute_inference: 0,
    medical_claim_hype: 0,
    medical_condition_targeting: 0,
    study_compensation_framing: 0,
    economic_vulnerability: 0,
    job_income_opportunity: 0,
    demographic_targeting: 0,
    manipulative_hook: 0,
    trust_mismatch_spam: 0,
  };
}

function splitIntoLines(text: string): string[] {
  return text
    .split(/\n|•|\||(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function bandForScore(score: number): MetaRiskBand {
  if (score >= 28) return 'black';
  if (score >= 12) return 'grey';
  return 'white';
}

function applyCombos(
  familyScores: Record<RiskSurface, number>,
  combos: string[]
): number {
  let comboScore = 0;

  if (
    familyScores.medical_condition_targeting > 0 &&
    familyScores.personal_attribute_inference > 0
  ) {
    combos.push('Medical condition + personal-attribute inference');
    comboScore += 18;
  }

  if (
    familyScores.medical_condition_targeting > 0 &&
    familyScores.medical_claim_hype > 0
  ) {
    combos.push('Medical condition + treatment/care hype');
    comboScore += 14;
  }

  if (
    familyScores.medical_condition_targeting > 0 &&
    familyScores.study_compensation_framing > 0
  ) {
    combos.push('Medical condition + study-compensation framing');
    comboScore += 8;
  }

  if (
    familyScores.medical_condition_targeting > 0 &&
    familyScores.economic_vulnerability > 0
  ) {
    combos.push('Medical condition + affordability/vulnerability framing');
    comboScore += 14;
  }

  if (
    familyScores.job_income_opportunity > 0 &&
    familyScores.economic_vulnerability > 0
  ) {
    combos.push('Job/income promise + economic-vulnerability framing');
    comboScore += 16;
  }

  if (
    familyScores.demographic_targeting > 0 &&
    familyScores.economic_vulnerability > 0
  ) {
    combos.push('Demographic targeting + financial/eligibility framing');
    comboScore += 14;
  }

  if (
    familyScores.manipulative_hook > 0 &&
    familyScores.trust_mismatch_spam > 0
  ) {
    combos.push('Manipulative hook + trust-mismatch/spam cues');
    comboScore += 10;
  }

  const hardFamilies = [
    familyScores.personal_attribute_inference > 0,
    familyScores.medical_claim_hype > 0,
    familyScores.economic_vulnerability > 0,
    familyScores.job_income_opportunity > 0,
  ].filter(Boolean).length;

  if (hardFamilies >= 3) {
    combos.push('Three or more hard-risk families active');
    comboScore += 15;
  }

  return comboScore;
}

function classifyAssetBanRisk(totalScore: number, familyScores: Record<RiskSurface, number>): AssetBanRisk {
  const criticalFamilies =
    Number(familyScores.personal_attribute_inference > 0) +
    Number(familyScores.job_income_opportunity > 0) +
    Number(familyScores.medical_claim_hype > 0);

  if (totalScore >= 60 || criticalFamilies >= 3) return 'critical';
  if (totalScore >= 40 || criticalFamilies >= 2) return 'high';
  if (totalScore >= 18) return 'moderate';
  return 'low';
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function buildRecommendations(
  familyScores: Record<RiskSurface, number>
): string[] {
  const recommendations: string[] = [];

  if (familyScores.personal_attribute_inference > 0) {
    recommendations.push('Remove “near you,” direct condition callouts, and any phrasing that implies the viewer has the condition.');
  }
  if (familyScores.medical_claim_hype > 0) {
    recommendations.push('Replace treatment hype with neutral, factual study or care descriptions.');
  }
  if (familyScores.study_compensation_framing > 0) {
    recommendations.push('Do not lead with payment for study participation; keep compensation factual and secondary.');
  }
  if (familyScores.economic_vulnerability > 0) {
    recommendations.push('Remove affordability or vulnerability hooks unless they are essential and stated neutrally.');
  }
  if (familyScores.job_income_opportunity > 0) {
    recommendations.push('Remove earnings, “easy work,” “extra income,” and opportunity-promise language.');
  }
  if (familyScores.demographic_targeting > 0) {
    recommendations.push('Avoid direct demographic callouts such as age, gender, or “seniors” in copy.');
  }
  if (familyScores.manipulative_hook > 0) {
    recommendations.push('Replace sensational hooks with descriptive statements that do not imply secret access or forced action.');
  }
  if (familyScores.trust_mismatch_spam > 0) {
    recommendations.push('Tighten CTA and ensure the landing page exactly matches the claim and offer.');
  }

  return unique(recommendations);
}

function highestSeverity(triggers: RiskTrigger[]): 'none' | TriggerSeverity {
  if (triggers.some((trigger) => trigger.severity === 'hard')) return 'hard';
  if (triggers.length > 0) return 'soft';
  return 'none';
}

function whyBand(
  overallBand: MetaRiskBand,
  totalScore: number,
  assetBanRisk: AssetBanRisk,
  familyScores: Record<RiskSurface, number>,
  combos: string[]
): string[] {
  const reasons: string[] = [
    `The ad scored ${totalScore}, which places it in the ${overallBand.toUpperCase()} band with ${assetBanRisk.toUpperCase()} asset-ban risk.`,
  ];

  const activeSurfaces = ALL_SURFACES
    .filter((surface) => familyScores[surface] > 0)
    .sort((a, b) => familyScores[b] - familyScores[a]);

  if (activeSurfaces.length > 0) {
    reasons.push(
      `The strongest active risk surfaces are ${activeSurfaces
        .slice(0, 3)
        .map((surface) => `${SURFACE_META[surface].label} (${familyScores[surface]})`)
        .join(', ')}.`
    );
  }

  if (combos.length > 0) {
    reasons.push(`Risk is amplified by combination effects: ${combos.join('; ')}.`);
  }

  if (overallBand === 'white') {
    reasons.push('The copy stays mostly descriptive and avoids enough of the high-enforcement patterns to remain in the lowest band.');
  } else if (overallBand === 'grey') {
    reasons.push('The copy contains meaningful policy-sensitive signals, but not enough stacked enforcement risk to be treated as a clear black-band failure.');
  } else {
    reasons.push('Too many hard-risk signals are stacked together, so the ad reads like a likely rejection or escalation candidate rather than a borderline case.');
  }

  return reasons;
}

function buildReview(
  overallBand: MetaRiskBand,
  totalScore: number,
  assetBanRisk: AssetBanRisk,
  familyScores: Record<RiskSurface, number>,
  lineScores: LineRiskScore[],
  combos: string[],
  recommendations: string[]
): MetaBoundaryScore['review'] {
  const surfaceFindings = ALL_SURFACES.map((surface) => {
    const matchedPhrases = unique(
      lineScores.flatMap((line) =>
        line.triggers
          .filter((trigger) => trigger.surface === surface)
          .map((trigger) => trigger.match)
      )
    );
    const affectedLines = unique(
      lineScores
        .filter((line) => line.triggers.some((trigger) => trigger.surface === surface))
        .map((line) => line.line)
    );
    const triggers = lineScores.flatMap((line) => line.triggers.filter((trigger) => trigger.surface === surface));

    return {
      surface,
      label: SURFACE_META[surface].label,
      score: familyScores[surface],
      active: familyScores[surface] > 0,
      severity: highestSeverity(triggers),
      explanation: SURFACE_META[surface].explanation,
      matchedPhrases,
      affectedLines,
      recommendations: familyScores[surface] > 0 ? SURFACE_META[surface].recommendations : [],
      evidenceType: SURFACE_META[surface].evidenceType,
      confidence: SURFACE_META[surface].confidence,
      evidenceNote: SURFACE_META[surface].evidenceNote,
    };
  });

  const comboFindings = combos.map((name) => ({
    name,
    score: COMBO_LIBRARY[name]?.score || 0,
    explanation: COMBO_LIBRARY[name]?.explanation || 'Multiple risky signals are interacting and making the ad meaningfully more dangerous than any single phrase alone.',
  }));

  const lineFindings = lineScores.map((line) => {
    const issues = line.triggers.map((trigger) => ({
      surface: trigger.surface,
      label: SURFACE_META[trigger.surface].label,
      severity: trigger.severity,
      match: trigger.match,
      reason: trigger.reason,
      evidenceType: trigger.evidenceType,
      confidence: trigger.confidence,
      evidenceNote: trigger.evidenceNote,
    }));

    let why = 'This line is mostly descriptive and does not activate material policy risk.';
    if (line.band === 'grey') {
      why = 'This line activates policy-sensitive language but does not stack enough risk to be an obvious black-band phrase by itself.';
    } else if (line.band === 'black') {
      why = 'This line carries enough stacked triggers on its own to behave like a direct rejection driver.';
    }

    const rewriteGuidance = unique(
      line.triggers.flatMap((trigger) => SURFACE_META[trigger.surface].recommendations)
    );

    return {
      line: line.line,
      band: line.band,
      score: line.score,
      why,
      issues,
      rewriteGuidance,
    };
  });

  let verdict = 'This copy is low-risk and mostly descriptive.';
  if (overallBand === 'grey') {
    verdict = 'This copy is borderline: it contains meaningful review risk, but can likely be salvaged with narrower, more factual phrasing.';
  } else if (overallBand === 'black') {
    verdict = 'This copy is high-risk: the active surfaces and combo effects make it a likely rejection or escalation candidate.';
  }

  if (recommendations.length > 0) {
    verdict = `${verdict} Priority fixes: ${recommendations.slice(0, 2).join(' ')}`;
  }

  return {
    verdict,
    whyBand: whyBand(overallBand, totalScore, assetBanRisk, familyScores, combos),
    surfaceFindings,
    comboFindings,
    lineFindings,
  };
}

function buildSummary(
  totalScore: number,
  assetBanRisk: AssetBanRisk,
  familyScores: Record<RiskSurface, number>
): string[] {
  const summary: string[] = [
    `Total risk score: ${totalScore}.`,
    `Asset-ban risk: ${assetBanRisk}.`,
  ];

  if (familyScores.personal_attribute_inference > 0) {
    summary.push('The copy implies knowledge of the viewer’s condition or status.');
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.medical_claim_hype > 0) {
    summary.push('Medical-condition targeting is compounded by treatment/care hype.');
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.study_compensation_framing > 0) {
    summary.push('Condition-sensitive study copy is also leaning on compensation as a hook.');
  }
  if (familyScores.job_income_opportunity > 0) {
    summary.push('The copy enters Meta’s high-enforcement job/income/opportunity surface.');
  }
  if (familyScores.economic_vulnerability > 0) {
    summary.push('Affordability or vulnerability framing increases sensitivity.');
  }

  return summary;
}

export function scoreMetaAdBoundary(text: string): MetaBoundaryScore {
  const normalized = (text || '').trim();
  const researchContext = /\b(clinical|trial|trials|study|studies|research|participant|participants|screening|eligibility)\b/i.test(normalized);
  const lines = splitIntoLines(normalized);
  const familyScores = createFamilyScores();

  const lineScores: LineRiskScore[] = lines.map((line) => {
    const triggers: RiskTrigger[] = [];

    for (const detector of DETECTORS) {
      if (detector.requiresResearchContext && !researchContext) continue;
      if (detector.forbidResearchContext && researchContext) continue;
      detector.pattern.lastIndex = 0;
      const match = line.match(detector.pattern);
      if (!match) continue;
      const trigger: RiskTrigger = {
        surface: detector.surface,
        severity: detector.severity,
        score: detector.score,
        match: match[0],
        reason: detector.reason,
        evidenceType: detector.evidenceType,
        confidence: detector.confidence,
        evidenceNote: detector.evidenceNote,
      };
      triggers.push(trigger);
      familyScores[detector.surface] += detector.score;
    }

    const lineScore = triggers.reduce((sum, trigger) => sum + trigger.score, 0);
    return {
      line,
      score: lineScore,
      band: bandForScore(lineScore),
      triggers,
    };
  });

  const combos: string[] = [];
  const comboScore = applyCombos(familyScores, combos);
  const baseScore = ALL_SURFACES.reduce((sum, surface) => sum + familyScores[surface], 0);
  const totalScore = baseScore + comboScore;

  let overallBand: MetaRiskBand = 'white';
  if (totalScore >= 45) overallBand = 'black';
  else if (totalScore >= 16) overallBand = 'grey';

  const assetBanRisk = classifyAssetBanRisk(totalScore, familyScores);
  const recommendations = buildRecommendations(familyScores);

  return {
    overallBand,
    totalScore,
    assetBanRisk,
    familyScores,
    lineScores,
    combos,
    summary: buildSummary(totalScore, assetBanRisk, familyScores),
    recommendations,
    review: buildReview(overallBand, totalScore, assetBanRisk, familyScores, lineScores, combos, recommendations),
  };
}
