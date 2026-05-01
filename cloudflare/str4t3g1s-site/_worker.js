const META_POLICY_HARNESS_VERSION = "v2";
const META_POLICY_WRITER_PROMPT_VERSION = "v2-halbert-inspired-awareness";

const SURFACE_KEYS = ["transcript", "primaryText", "headline", "description", "cta"];

const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "your", "you", "are", "was", "have",
  "has", "had", "into", "near", "what", "when", "will", "they", "their", "them", "about",
  "these", "those", "more", "less", "than", "then", "just", "only", "onto", "over",
  "under", "here", "there", "learn", "review", "current", "ongoing", "qualified", "adults",
  "study", "studies", "clinical", "research", "details", "information"
]);

const DETECTORS = [
  {
    surface: "personal_attribute_inference",
    severity: "hard",
    score: 16,
    reason: "Implies the viewer has a sensitive health condition or status.",
    pattern: /\b(do you have|have diabetes|with diabetes|suffer from|depressed\?|anxious\?)\b/i
  },
  {
    surface: "personal_attribute_inference",
    severity: "hard",
    score: 14,
    reason: "Uses local-relevance phrasing that can read as “we know this applies to you.”",
    pattern: /\b(near you|cerca de ti|cerca de usted|close to you)\b/i
  },
  {
    surface: "medical_condition_targeting",
    severity: "soft",
    score: 8,
    reason: "Names a medical condition or procedure, which raises sensitivity and review scrutiny.",
    pattern: /\b(diabetes|sleep apnea|depressed|anxious|neuropathy|dental implants?|clinical research|clinical trial|ensayos clínicos)\b/i
  },
  {
    surface: "medical_claim_hype",
    severity: "hard",
    score: 14,
    reason: "Uses exaggerated treatment or care framing.",
    pattern: /\b(groundbreaking treatments?|innovative treatments?|elite care|world class care|exclusive access)\b/i
  },
  {
    surface: "economic_vulnerability",
    severity: "hard",
    score: 13,
    reason: "Frames affordability or vulnerability in a sensitive way.",
    pattern: /\b(no insurance required|no necesitas seguro|bad credit|sin seguro|0 down|\$0|low monthly|monthly payments?|rebates?)\b/i
  },
  {
    surface: "job_income_opportunity",
    severity: "hard",
    score: 18,
    reason: "Promises earnings or easy opportunity language associated with scam/job enforcement.",
    pattern: /\b(up to \$?\d+[kK]?\/?(day|week)?|receive up to|extra \$?\d+|gigs|easy jobs?|trabajos fáciles|opportunity near you|work opportunity|pick up gigs)\b/i
  },
  {
    surface: "demographic_targeting",
    severity: "hard",
    score: 12,
    reason: "Calls out age or demographic groups directly.",
    pattern: /\b(seniors?|50\+|over 18|18\+ only|male dentist|women|men)\b/i
  },
  {
    surface: "manipulative_hook",
    severity: "soft",
    score: 9,
    reason: "Uses sensational or manipulative hook framing.",
    pattern: /\b(force dealerships to do this|in a pickle|almost nothing|approved for|see what(?:'s| is) left|leftover|record setting)\b/i
  },
  {
    surface: "trust_mismatch_spam",
    severity: "soft",
    score: 8,
    reason: "Aggressive CTA or vague destination language often correlates with spam/deceptive-link review.",
    pattern: /\b(check the link below|tap below|join now|learn more below|article below)\b/i
  },
  {
    surface: "trust_mismatch_spam",
    severity: "soft",
    score: 8,
    reason: "Urgency and scarcity language increases trust-mismatch risk when paired with sensitive offers.",
    pattern: /\b(spots fill up quickly|enrollment is open|now available|limited spots?|hurry)\b/i
  },
  {
    surface: "job_income_opportunity",
    severity: "hard",
    score: 14,
    reason: "Signals recruiting or job/opportunity framing.",
    pattern: /\b(participants needed|se buscan participantes|job opportunity|trabajo cerca de ti|employment|opportunity)\b/i
  },
  {
    surface: "economic_vulnerability",
    severity: "soft",
    score: 8,
    reason: "Financing or affordability framing can trigger financial-services review.",
    pattern: /\b(financing|monthly|payments?|insurance savings|save money|enganche|mensualidades)\b/i
  }
];

const ALL_SURFACES = [
  "personal_attribute_inference",
  "medical_claim_hype",
  "medical_condition_targeting",
  "economic_vulnerability",
  "job_income_opportunity",
  "demographic_targeting",
  "manipulative_hook",
  "trust_mismatch_spam"
];

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenize(text) {
  return normalizeText(text).toLowerCase().match(/[a-z0-9+]+/g) || [];
}

function significantTokens(text) {
  return tokenize(text).filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function termFrequency(text) {
  const map = new Map();
  for (const token of significantTokens(text)) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function splitIntoLines(text) {
  return text
    .split(/\n|•|\||(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function createFamilyScores() {
  return {
    personal_attribute_inference: 0,
    medical_claim_hype: 0,
    medical_condition_targeting: 0,
    economic_vulnerability: 0,
    job_income_opportunity: 0,
    demographic_targeting: 0,
    manipulative_hook: 0,
    trust_mismatch_spam: 0
  };
}

function buildRecommendations(familyScores) {
  const recommendations = [];
  if (familyScores.personal_attribute_inference > 0) {
    recommendations.push("Remove “near you,” direct condition callouts, and any phrasing that implies the viewer has the condition.");
  }
  if (familyScores.medical_claim_hype > 0) {
    recommendations.push("Replace treatment hype with neutral, factual study or care descriptions.");
  }
  if (familyScores.economic_vulnerability > 0) {
    recommendations.push("Remove affordability or vulnerability hooks unless they are essential and stated neutrally.");
  }
  if (familyScores.job_income_opportunity > 0) {
    recommendations.push("Remove earnings, “easy work,” “extra income,” and opportunity-promise language.");
  }
  if (familyScores.demographic_targeting > 0) {
    recommendations.push("Avoid direct demographic callouts such as age, gender, or “seniors” in copy.");
  }
  if (familyScores.manipulative_hook > 0) {
    recommendations.push("Replace sensational hooks with descriptive statements that do not imply secret access or forced action.");
  }
  if (familyScores.trust_mismatch_spam > 0) {
    recommendations.push("Tighten CTA and ensure the landing page exactly matches the claim and offer.");
  }
  return unique(recommendations);
}

function buildSummary(totalScore, assetBanRisk, familyScores) {
  const summary = [
    `Total risk score: ${totalScore}.`,
    `Asset-ban risk: ${assetBanRisk}.`
  ];
  if (familyScores.personal_attribute_inference > 0) {
    summary.push("The copy implies knowledge of the viewer’s condition or status.");
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.medical_claim_hype > 0) {
    summary.push("Medical-condition targeting is compounded by treatment/care hype.");
  }
  if (familyScores.job_income_opportunity > 0) {
    summary.push("The copy enters Meta’s high-enforcement job/income/opportunity surface.");
  }
  if (familyScores.economic_vulnerability > 0) {
    summary.push("Affordability or vulnerability framing increases sensitivity.");
  }
  return summary;
}

function applyCombos(familyScores, combos) {
  let comboScore = 0;
  if (familyScores.medical_condition_targeting > 0 && familyScores.personal_attribute_inference > 0) {
    combos.push("Medical condition + personal-attribute inference");
    comboScore += 18;
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.medical_claim_hype > 0) {
    combos.push("Medical condition + treatment/care hype");
    comboScore += 14;
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.economic_vulnerability > 0) {
    combos.push("Medical condition + affordability/vulnerability framing");
    comboScore += 14;
  }
  if (familyScores.job_income_opportunity > 0 && familyScores.economic_vulnerability > 0) {
    combos.push("Job/income promise + economic-vulnerability framing");
    comboScore += 16;
  }
  if (familyScores.demographic_targeting > 0 && familyScores.economic_vulnerability > 0) {
    combos.push("Demographic targeting + financial/eligibility framing");
    comboScore += 14;
  }
  if (familyScores.manipulative_hook > 0 && familyScores.trust_mismatch_spam > 0) {
    combos.push("Manipulative hook + trust-mismatch/spam cues");
    comboScore += 10;
  }
  const hardFamilies = [
    familyScores.personal_attribute_inference > 0,
    familyScores.medical_claim_hype > 0,
    familyScores.economic_vulnerability > 0,
    familyScores.job_income_opportunity > 0,
    familyScores.demographic_targeting > 0
  ].filter(Boolean).length;
  if (hardFamilies >= 3) {
    combos.push("Three or more hard-risk families active");
    comboScore += 15;
  }
  return comboScore;
}

function classifyAssetBanRisk(totalScore, familyScores) {
  const criticalFamilies =
    Number(familyScores.personal_attribute_inference > 0) +
    Number(familyScores.job_income_opportunity > 0) +
    Number(familyScores.medical_claim_hype > 0);

  if (totalScore >= 60 || criticalFamilies >= 3) return "critical";
  if (totalScore >= 40 || criticalFamilies >= 2) return "high";
  if (totalScore >= 18) return "moderate";
  return "low";
}

function scoreMetaAdBoundary(text) {
  const normalized = (text || "").trim();
  const lines = splitIntoLines(normalized);
  const familyScores = createFamilyScores();

  const lineScores = lines.map((line) => {
    const triggers = [];
    for (const detector of DETECTORS) {
      detector.pattern.lastIndex = 0;
      const match = line.match(detector.pattern);
      if (!match) continue;
      triggers.push({
        surface: detector.surface,
        severity: detector.severity,
        score: detector.score,
        match: match[0],
        reason: detector.reason
      });
      familyScores[detector.surface] += detector.score;
    }
    const lineScore = triggers.reduce((sum, trigger) => sum + trigger.score, 0);
    const band = lineScore >= 28 ? "black" : lineScore >= 12 ? "grey" : "white";
    return { line, score: lineScore, band, triggers };
  });

  const combos = [];
  const comboScore = applyCombos(familyScores, combos);
  const baseScore = ALL_SURFACES.reduce((sum, surface) => sum + familyScores[surface], 0);
  const totalScore = baseScore + comboScore;
  const overallBand = totalScore >= 45 ? "black" : totalScore >= 16 ? "grey" : "white";
  const assetBanRisk = classifyAssetBanRisk(totalScore, familyScores);

  return {
    overallBand,
    totalScore,
    assetBanRisk,
    familyScores,
    lineScores,
    combos,
    summary: buildSummary(totalScore, assetBanRisk, familyScores),
    recommendations: buildRecommendations(familyScores)
  };
}

function articleBlob(bundle) {
  return [bundle.landingArticleTitle, bundle.landingArticleSummary, bundle.landingArticleBody]
    .filter(Boolean)
    .join(". ");
}

function normalizeMetaAdBundle(input) {
  const bundle = {
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
    targetBand: input.targetBand || "grey"
  };

  const combinedAdText = SURFACE_KEYS.map((key) => bundle[key]).filter(Boolean).join("\n");
  return {
    station: "normalize",
    version: META_POLICY_HARNESS_VERSION,
    bundle,
    combinedAdText
  };
}

function runBoundaryJudge(bundle) {
  const combinedText = SURFACE_KEYS.map((key) => bundle[key]).filter(Boolean).join("\n");
  const bySurface = {};
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
  const rewriteRequired = combined.overallBand === "black";
  return {
    station: "boundary_judge",
    version: META_POLICY_HARNESS_VERSION,
    combined,
    bySurface,
    offendingMatches,
    gate: { rewriteRequired, pass: !rewriteRequired }
  };
}

function extractClaimEnvelope(bundle) {
  const article = articleBlob(bundle);
  const sentences = splitSentences(article);
  const tf = termFrequency(article);
  const supportedTerms = Array.from(tf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);
  const weakSupportTerms = supportedTerms.filter((term) => /study|research|participants|eligibility|clinical|trial|diabetes|dental|treatment|care|sleep|apnea/.test(term));
  const evidenceSentences = sentences.slice(0, 8);
  const lowerArticle = article.toLowerCase();
  const unsupportedRiskPhrases = [];

  if (!/insurance/.test(lowerArticle)) unsupportedRiskPhrases.push("no insurance required");
  if (!/(groundbreaking|innovative|innovation|elite|world class|exclusive)/.test(lowerArticle)) {
    unsupportedRiskPhrases.push("groundbreaking treatments");
    unsupportedRiskPhrases.push("elite care");
  }
  if (!/\$|compensation|stipend|get paid|payment/.test(lowerArticle)) {
    unsupportedRiskPhrases.push("earnings or compensation claims");
  }
  if (!/(near you|local|city|state|location)/.test(lowerArticle)) {
    unsupportedRiskPhrases.push("personalized local relevance");
  }

  return {
    station: "claim_envelope",
    version: META_POLICY_HARNESS_VERSION,
    evidenceSentences,
    supportedTerms,
    weakSupportTerms,
    unsupportedRiskPhrases: unique(unsupportedRiskPhrases)
  };
}

function inferReaderState(bundle) {
  const article = articleBlob(bundle).toLowerCase();
  let stage = "problem_aware";
  let rationale = "The article discusses a health problem and possible next steps, so the likely reader knows the problem but not necessarily the study process.";

  if (/\bhow to find|how to discover|how to join|how participation works\b/.test(article)) {
    stage = "solution_aware";
    rationale = "The article explains how to find studies, so the reader likely wants options but is not yet committed to participation.";
  }
  if (/\beligibility criteria|participation steps|screening\b/.test(article) && /\bclinical trial|research study\b/.test(article)) {
    stage = "solution_aware";
    rationale = "The article is about finding studies and understanding participation, which suggests readers are looking for alternatives, not already sold on a study.";
  }

  return {
    station: "reader_state",
    version: META_POLICY_HARNESS_VERSION,
    stage,
    rationale
  };
}

function buildPainBrief(bundle) {
  const article = articleBlob(bundle).toLowerCase();
  const functionalPain = [];
  const emotionalPain = [];
  const failedAlternatives = [];
  const stakes = [];
  const desiredOutcome = [];
  const whyNow = [];

  if (/sleep apnea/.test(article)) {
    functionalPain.push("disrupted sleep", "daytime fatigue", "difficulty finding workable treatment options");
    emotionalPain.push("frustration with feeling drained", "feeling stuck with uncomfortable treatment choices");
    failedAlternatives.push("CPAP discomfort or friction", "uncertainty about what options exist beyond standard treatment");
    stakes.push("ongoing poor sleep quality", "reduced day-to-day energy");
    desiredOutcome.push("better sleep", "a workable next option", "clearer understanding of current alternatives");
    whyNow.push("current studies are evaluating new approaches", "the article explains how to review current options");
  }

  if (/diabetes/.test(article)) {
    functionalPain.push("difficulty managing blood sugar", "wanting to understand what new options are being studied");
    emotionalPain.push("frustration with current treatment limits");
    failedAlternatives.push("limited satisfaction with existing approaches");
    stakes.push("ongoing condition-management burden");
    desiredOutcome.push("a clearer path forward", "new options worth exploring");
    whyNow.push("current studies are actively enrolling");
  }

  if (functionalPain.length === 0) {
    functionalPain.push("the condition is disruptive enough to make someone look for another option");
    emotionalPain.push("fatigue, frustration, or worry about staying stuck");
    failedAlternatives.push("current options may feel incomplete, unclear, or unsatisfying");
    stakes.push("the problem continues if nothing changes");
    desiredOutcome.push("a practical next step", "clarity about what options exist now");
    whyNow.push("the article presents current information a motivated reader can act on");
  }

  return {
    station: "pain_brief",
    version: META_POLICY_HARNESS_VERSION,
    functionalPain: unique(functionalPain),
    emotionalPain: unique(emotionalPain),
    failedAlternatives: unique(failedAlternatives),
    stakes: unique(stakes),
    desiredOutcome: unique(desiredOutcome),
    whyNow: unique(whyNow)
  };
}

function generateAngles(bundle) {
  const article = articleBlob(bundle).toLowerCase();
  const topic = article.includes("sleep apnea")
    ? "sleep apnea"
    : article.includes("diabetes")
      ? "diabetes"
      : "this condition";

  return {
    station: "angles",
    version: META_POLICY_HARNESS_VERSION,
    angles: [
      {
        name: "frustration-to-alternative",
        hook: `Still frustrated with ${topic}?`,
        promise: "Show that there are current research-backed options worth understanding.",
        riskNotes: ["Avoid implying the viewer has the condition directly in the final copy."]
      },
      {
        name: "what-else-is-out-there",
        hook: "What else is being tested right now?",
        promise: "Create curiosity around current studies and alternative approaches.",
        riskNotes: ["Keep claims tied to article support."]
      },
      {
        name: "before-you-rule-it-out",
        hook: "Before you rule this out...",
        promise: "Invite the reader to consider one more credible option without hype.",
        riskNotes: ["Do not use manipulative scarcity."]
      },
      {
        name: "new-option-clarity",
        hook: "See what current research is exploring.",
        promise: "Give a clean, credible reason to click for more detail.",
        riskNotes: ["Can become bland if not paired with pain relevance."]
      },
      {
        name: "stuck-reader",
        hook: "If current options feel hard to stick with...",
        promise: "Position the article as a place to learn what else exists.",
        riskNotes: ["Do not overstate dissatisfaction or promise relief."]
      }
    ]
  };
}

function auditCongruence(candidateText, bundle, envelope) {
  const article = [bundle.landingArticleTitle, bundle.landingArticleSummary, bundle.landingArticleBody]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const candidateTokens = significantTokens(candidateText);
  const articleTokens = new Set(significantTokens(article));
  const shared = candidateTokens.filter((token) => articleTokens.has(token));
  const overlapRatio = candidateTokens.length > 0 ? shared.length / candidateTokens.length : 1;
  const hardViolations = [];
  const softWarnings = [];
  const lower = candidateText.toLowerCase();

  const claimChecks = [
    { phrase: /no insurance required|no necesitas seguro|sin seguro/i, label: "Insurance claim not clearly supported by article", support: /insurance|seguro/i },
    { phrase: /groundbreaking|innovative treatments?|elite care|world class care|exclusive access/i, label: "Medical superlative not clearly supported by article", support: /groundbreaking|innovative|innovation|elite|world class|exclusive/i },
    { phrase: /up to \$?\d+|receive up to|get paid|compensation|stipend/i, label: "Compensation claim not clearly supported by article", support: /\$|compensation|stipend|get paid|payment/i },
    { phrase: /near you|cerca de ti|cerca de usted/i, label: "Personalized local-relevance claim not clearly supported by article", support: /near you|local|location|city|state/i }
  ];

  for (const check of claimChecks) {
    if (check.phrase.test(lower) && !check.support.test(article)) {
      hardViolations.push(check.label);
    }
  }

  if (envelope) {
    for (const phrase of envelope.unsupportedRiskPhrases) {
      const firstToken = phrase.split(/\s+/)[0];
      if (firstToken && lower.includes(firstToken) && !article.includes(firstToken)) {
        softWarnings.push(`Article does not strongly support phrase family: ${phrase}`);
      }
    }
  }

  if (candidateTokens.length >= 6 && overlapRatio < 0.35) {
    softWarnings.push("Low lexical overlap with landing article; possible message drift.");
  }

  return {
    station: "congruence_audit",
    version: META_POLICY_HARNESS_VERSION,
    supported: hardViolations.length === 0,
    overlapRatio,
    hardViolations: unique(hardViolations),
    softWarnings: unique(softWarnings)
  };
}

function buildForbiddenPhraseList(bundle, judge, envelope) {
  return unique([
    ...bundle.forbiddenPhrases,
    ...judge.offendingMatches.map((value) => value.toLowerCase()),
    ...envelope.unsupportedRiskPhrases.map((value) => value.toLowerCase()),
    "near you",
    "groundbreaking",
    "elite care",
    "world class care",
    "no insurance required",
    "get paid",
    "participants needed"
  ]);
}

function selectPrimaryRewriteField(bundle) {
  if (bundle.primaryText) return "primaryText";
  if (bundle.transcript) return "transcript";
  if (bundle.headline) return "headline";
  if (bundle.description) return "description";
  return "cta";
}

function focusTopic(bundle, envelope) {
  const article = [bundle.landingArticleTitle, bundle.landingArticleSummary, bundle.landingArticleBody].join(" ").toLowerCase();
  if (/diabetes/.test(article)) return "diabetes research studies";
  if (/sleep apnea/.test(article)) return "sleep apnea research studies";
  if (/dental|implant/.test(article)) return "dental research studies";
  if (/neuropathy/.test(article)) return "neuropathy research studies";
  if (/clinical/.test(article)) return "clinical research studies";
  return envelope.supportedTerms.slice(0, 3).join(" ") || "current research studies";
}

function fallbackRewriteVariants(bundle, field, envelope) {
  const topic = focusTopic(bundle, envelope);
  const candidates = [
    `Current ${topic} are enrolling qualified adults. Review study details and eligibility information.`,
    `Learn about ongoing ${topic} and review the eligibility criteria for participation.`,
    `Researchers are reviewing qualified adults for current ${topic}. See participation details and next steps.`,
    `Explore current ${topic} for qualified adults. Review the study overview and participation information.`,
    `Review current ${topic}, eligibility requirements, and participation details before submitting interest.`
  ];

  return candidates.map((copy, index) => {
    const variant = {
      label: `Fallback ${index + 1}`,
      rationale: "Deterministic fallback rewrite designed to remove black-risk triggers while preserving curiosity.",
      transcript: bundle.transcript,
      primaryText: bundle.primaryText,
      headline: bundle.headline,
      description: bundle.description,
      cta: bundle.cta
    };
    variant[field] = copy;
    return variant;
  });
}

function parseRewriteResponse(raw, field) {
  let payload = String(raw || "").trim();
  if (payload.startsWith("```")) {
    payload = payload.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  const firstBrace = payload.indexOf("{");
  const lastBrace = payload.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    payload = payload.slice(firstBrace, lastBrace + 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return [];
  }
  const variants = Array.isArray(parsed?.variants) ? parsed.variants : [];
  return variants
    .map((variant, index) => {
      const output = {
        label: typeof variant?.label === "string" ? variant.label : `Option ${index + 1}`,
        rationale: typeof variant?.rationale === "string" ? variant.rationale : ""
      };
      for (const key of SURFACE_KEYS) {
        if (typeof variant?.[key] === "string") output[key] = normalizeText(variant[key]);
      }
      if (!output[field] && typeof variant?.copy === "string") output[field] = normalizeText(variant.copy);
      return output;
    })
    .filter((variant) => SURFACE_KEYS.some((key) => Boolean(variant[key])));
}

async function generateText(env, { system, prompt, temperature = 0.3, maxTokens = 1800 }) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const input = system ? `System:\n${system}\n\nUser:\n${prompt}` : prompt;
  const body = { model, input, max_output_tokens: maxTokens };
  if (!/^gpt-5($|-)/.test(model)) {
    body.temperature = temperature;
  }

  let response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok && body.temperature !== undefined) {
    delete body.temperature;
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return String(payload.output_text || "").trim();
}

async function generateRewriteVariants(env, bundle, judge, envelope, readerState, painBrief, angleOutput) {
  const field = selectPrimaryRewriteField(bundle);
  const forbidden = buildForbiddenPhraseList(bundle, judge, envelope);
  const combinedOriginal = SURFACE_KEYS.map((key) => bundle[key]).filter(Boolean).join("\n");

  const system = [
    "You are a world-class direct-response ad writer working in a Halbert-inspired style.",
    "Write with one sharp idea, concrete specificity, plain language, pain relevance, curiosity, and believability.",
    "You are not allowed to imply personal attributes, overpromise outcomes, add unsupported claims, or use spammy/scammy language.",
    "Your job is to move black-risk copy into strong grey-risk copy while preserving interest.",
    "Start from the reader tension first, not from the study mechanics.",
    "Return JSON only."
  ].join(" ");

  const prompt = [
    `Harness version: ${META_POLICY_HARNESS_VERSION}`,
    `Writer prompt version: ${META_POLICY_WRITER_PROMPT_VERSION}`,
    `Target risk band: ${bundle.targetBand}`,
    `Primary field to rewrite: ${field}`,
    `Reader awareness stage: ${readerState.stage}`,
    "",
    "Original ad copy bundle:",
    combinedOriginal || "(empty)",
    "",
    "Known rejection context:",
    bundle.knownRejectionReason || "(none provided)",
    "",
    "Boundary judge triggers to avoid:",
    judge.offendingMatches.join(", ") || "(none)",
    "",
    "Landing article evidence sentences:",
    ...envelope.evidenceSentences.map((sentence) => `- ${sentence}`),
    "",
    "Pain brief:",
    `- Functional pain: ${painBrief.functionalPain.join(", ")}`,
    `- Emotional pain: ${painBrief.emotionalPain.join(", ")}`,
    `- Failed alternatives: ${painBrief.failedAlternatives.join(", ")}`,
    `- Stakes: ${painBrief.stakes.join(", ")}`,
    `- Desired outcome: ${painBrief.desiredOutcome.join(", ")}`,
    `- Why now: ${painBrief.whyNow.join(", ")}`,
    "",
    "Available copy angles:",
    ...angleOutput.angles.map((angle) => `- ${angle.name}: hook="${angle.hook}" promise="${angle.promise}"`),
    "",
    "Terms supported by landing article:",
    envelope.supportedTerms.join(", "),
    "",
    "Unsupported or dangerous phrase families:",
    envelope.unsupportedRiskPhrases.join(", ") || "(none)",
    "",
    "Forbidden phrases:",
    forbidden.join(", "),
    "",
    "Output requirements:",
    "- Return exactly 5 variants.",
    "- Keep each variant believable and congruent with the landing article.",
    "- Use curiosity, clarity, specificity, and reader self-interest without hype.",
    "- Do not lead with process language like eligibility, screening, participation steps, or study mechanics unless it is secondary to the hook.",
    "- The reader should care about the problem or possibility first, and the study second.",
    "- Do not include any forbidden phrase or close paraphrase that implies the same risky meaning.",
    "- If a field is not provided in the original, leave it empty.",
    "- The rewritten primary field must be the strongest persuasive grey-risk version, not a whitewashed compliance-only line.",
    "- Boring copy fails. If the line sounds like informational filler, rewrite it.",
    "",
    'Return JSON with this shape:',
    '{"variants":[{"label":"Option 1","rationale":"...","transcript":"","primaryText":"","headline":"","description":"","cta":""}]}'
  ].join("\n");

  const raw = await generateText(env, { system, prompt, temperature: 0.3, maxTokens: 1800 });
  let variants = parseRewriteResponse(raw, field);
  if (variants.length !== 5) {
    variants = fallbackRewriteVariants(bundle, field, envelope);
  }
  return {
    station: "rewrite",
    version: META_POLICY_WRITER_PROMPT_VERSION,
    variants
  };
}

function combinedVariantText(variant) {
  return SURFACE_KEYS.map((key) => variant[key] || "").filter(Boolean).join("\n");
}

function persuasionScore(text, boundary, painBrief) {
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
  if (boundary.overallBand !== "black") credibility += 2;

  const boring = painRelevance <= 1 && selfInterest <= 2 && curiosity <= 2;
  const total = painRelevance + selfInterest + curiosity + clarity + credibility - Math.round(boundary.totalScore / 20) - (boring ? 4 : 0);
  return { painRelevance, selfInterest, curiosity, clarity, credibility, boring, total };
}

function rankRewriteVariants(variants, bundle, envelope, painBrief) {
  const ranked = variants.map((variant) => {
    const text = combinedVariantText(variant);
    const boundary = scoreMetaAdBoundary(text);
    const congruence = auditCongruence(text, bundle, envelope);
    const persuasion = persuasionScore(text, boundary, painBrief);
    const rejectionReasons = [];

    if (boundary.overallBand === "black") rejectionReasons.push("Boundary judge still black.");
    if (!congruence.supported) rejectionReasons.push(...congruence.hardViolations);
    if (persuasion.boring) rejectionReasons.push("Variant is too boring or process-led to earn attention.");

    return {
      variant,
      combinedText: text,
      boundary,
      congruence,
      persuasion,
      accepted: rejectionReasons.length === 0,
      rejectionReasons: unique(rejectionReasons)
    };
  });

  return {
    station: "rank",
    version: META_POLICY_HARNESS_VERSION,
    accepted: ranked.filter((item) => item.accepted).sort((a, b) => b.persuasion.total - a.persuasion.total),
    rejected: ranked.filter((item) => !item.accepted)
  };
}

async function runMetaPolicyHarness(env, input) {
  const normalization = normalizeMetaAdBundle(input || {});
  const boundaryJudge = runBoundaryJudge(normalization.bundle);
  const claimEnvelope = extractClaimEnvelope(normalization.bundle);
  const readerState = inferReaderState(normalization.bundle, claimEnvelope);
  const painBrief = buildPainBrief(normalization.bundle);
  const angles = generateAngles(normalization.bundle, readerState, painBrief);
  const rewriteRequired = boundaryJudge.gate.rewriteRequired || input.forceRewrite === true;

  if (!rewriteRequired) {
    return {
      normalization,
      boundaryJudge,
      claimEnvelope,
      readerState,
      painBrief,
      angles,
      rewriteStation: null,
      ranking: null
    };
  }

  const rewriteStation = await generateRewriteVariants(env, normalization.bundle, boundaryJudge, claimEnvelope, readerState, painBrief, angles);
  const ranking = rankRewriteVariants(rewriteStation.variants, normalization.bundle, claimEnvelope, painBrief);
  return {
    normalization,
    boundaryJudge,
    claimEnvelope,
    readerState,
    painBrief,
    angles,
    rewriteStation,
    ranking
  };
}

async function parseJsonRequest(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function authorized(request, env) {
  const expected = env.PARTNER_API_KEY;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice("Bearer ".length).trim() === expected.trim();
}

const protectedPaths = new Set([
  "/api/meta-policy/run",
  "/api/meta-policy/rewrite",
  "/api/meta-policy/rank",
  "/api/meta-policy/boundary-judge",
  "/api/meta-policy/normalize",
  "/api/meta-policy/claim-envelope",
  "/api/meta-policy/reader-state",
  "/api/meta-policy/pain-brief",
  "/api/meta-policy/angles",
  "/api/meta-policy/congruence-audit"
]);

async function handleApi(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (pathname === "/api") {
    return json({
      ok: true,
      gateway: "str4t3g1s-pages-edge",
      mode: "edge-native",
      version: META_POLICY_HARNESS_VERSION,
      protected_paths: Array.from(protectedPaths)
    });
  }

  if (pathname === "/api/health") {
    return json({
      status: "OK",
      timestamp: new Date().toISOString(),
      mode: "edge-native",
      version: META_POLICY_HARNESS_VERSION
    });
  }

  if (!protectedPaths.has(pathname)) {
    return null;
  }

  if (!authorized(request, env)) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  let body;
  try {
    body = await parseJsonRequest(request);
  } catch (error) {
    return json({ ok: false, message: error.message }, 400);
  }

  try {
    if (pathname === "/api/meta-policy/normalize") {
      return json(normalizeMetaAdBundle(body));
    }
    if (pathname === "/api/meta-policy/boundary-judge") {
      const normalized = normalizeMetaAdBundle(body);
      return json(runBoundaryJudge(normalized.bundle));
    }
    if (pathname === "/api/meta-policy/claim-envelope") {
      const normalized = normalizeMetaAdBundle(body);
      return json(extractClaimEnvelope(normalized.bundle));
    }
    if (pathname === "/api/meta-policy/reader-state") {
      const normalized = normalizeMetaAdBundle(body);
      const envelope = extractClaimEnvelope(normalized.bundle);
      return json(inferReaderState(normalized.bundle, envelope));
    }
    if (pathname === "/api/meta-policy/pain-brief") {
      const normalized = normalizeMetaAdBundle(body);
      return json(buildPainBrief(normalized.bundle));
    }
    if (pathname === "/api/meta-policy/angles") {
      const normalized = normalizeMetaAdBundle(body);
      const envelope = extractClaimEnvelope(normalized.bundle);
      const readerState = inferReaderState(normalized.bundle, envelope);
      const painBrief = buildPainBrief(normalized.bundle);
      return json(generateAngles(normalized.bundle, readerState, painBrief));
    }
    if (pathname === "/api/meta-policy/congruence-audit") {
      const normalized = normalizeMetaAdBundle(body);
      const candidateText = typeof body?.candidateText === "string" ? body.candidateText : "";
      if (!candidateText) return json({ error: "candidateText is required (string)" }, 400);
      const envelope = extractClaimEnvelope(normalized.bundle);
      return json(auditCongruence(candidateText, normalized.bundle, envelope));
    }
    if (pathname === "/api/meta-policy/rewrite") {
      const normalized = normalizeMetaAdBundle(body);
      const judge = runBoundaryJudge(normalized.bundle);
      const envelope = extractClaimEnvelope(normalized.bundle);
      const readerState = inferReaderState(normalized.bundle, envelope);
      const painBrief = buildPainBrief(normalized.bundle);
      const angles = generateAngles(normalized.bundle, readerState, painBrief);
      return json(await generateRewriteVariants(env, normalized.bundle, judge, envelope, readerState, painBrief, angles));
    }
    if (pathname === "/api/meta-policy/rank") {
      const normalized = normalizeMetaAdBundle(body);
      const envelope = extractClaimEnvelope(normalized.bundle);
      const painBrief = buildPainBrief(normalized.bundle);
      const variants = Array.isArray(body?.variants) ? body.variants : null;
      if (!variants) return json({ error: "variants is required (array)" }, 400);
      return json(rankRewriteVariants(variants, normalized.bundle, envelope, painBrief));
    }
    if (pathname === "/api/meta-policy/run") {
      return json(await runMetaPolicyHarness(env, body));
    }
    return json({ ok: false, message: "Not found." }, 404);
  } catch (error) {
    return json({ ok: false, message: error.message || "Meta policy harness failed." }, 500);
  }
}

export default {
  async fetch(request, env) {
    const apiResponse = await handleApi(request, env);
    if (apiResponse) return apiResponse;
    return env.ASSETS.fetch(request);
  }
};
