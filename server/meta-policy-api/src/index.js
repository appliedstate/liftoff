import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const META_POLICY_HARNESS_VERSION = "v2";
const META_POLICY_WRITER_PROMPT_VERSION = "v2-halbert-inspired-awareness";
const TARGET_REWRITE_VARIANT_COUNT = 3;
const PORT = Number(process.env.PORT || 3010);

const SURFACE_KEYS = ["transcript", "primaryText", "headline", "description", "cta"];

const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "your", "you", "are", "was", "have",
  "has", "had", "into", "near", "what", "when", "will", "they", "their", "them", "about",
  "these", "those", "more", "less", "than", "then", "just", "only", "onto", "over",
  "under", "here", "there", "learn", "review", "current", "ongoing", "qualified", "adults",
  "study", "studies", "clinical", "research", "details", "information"
]);

const POLICY_STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "your", "you", "are", "was", "have",
  "has", "had", "into", "what", "when", "will", "they", "their", "them", "about",
  "these", "those", "more", "less", "than", "then", "just", "only", "onto", "over",
  "under", "here", "there"
]);

let rejectionCorpusCache = null;
let officialPolicyManifestCache = null;
let officialPolicyChunkCache = null;
let officialPolicySnapshotIndexCache = null;
let copywriterConceptCache = null;
let audienceResearchCache = null;
let enforcementHeatCache = null;

const DETECTORS = [
  {
    surface: "personal_attribute_inference",
    severity: "hard",
    score: 16,
    reason: "Implies the viewer has a sensitive health condition or status.",
    pattern: /\b(do you have|have diabetes|with diabetes|suffer from|depressed\?|anxious\?)\b/i,
    evidenceType: "inferred",
    confidence: "high",
    evidenceNote: "Grounded in Meta sensitivity around health-status inference, but this exact phrase rule is internal inference rather than a directly cited policy clause."
  },
  {
    surface: "personal_attribute_inference",
    severity: "soft",
    score: 14,
    reason: "Uses local-relevance phrasing that can read as “we know this applies to you.”",
    pattern: /\b(near you|cerca de ti|cerca de usted|close to you)\b/i,
    evidenceType: "inferred",
    confidence: "medium",
    evidenceNote: "Meta does not appear to ban “near you” categorically; this is risky mainly when paired with sensitive conditions or vulnerable offers."
  },
  {
    surface: "medical_condition_targeting",
    severity: "soft",
    score: 8,
    reason: "Names a medical condition or procedure, which raises sensitivity and review scrutiny.",
    pattern: /\b(diabetes|sleep apnea|depressed|anxious|neuropathy|dental implants?|clinical research|clinical trial|ensayos clínicos)\b/i,
    evidenceType: "inferred",
    confidence: "medium",
    evidenceNote: "Naming a condition is not categorically prohibited; this is a sensitivity rule based on health-related review patterns."
  },
  {
    surface: "medical_claim_hype",
    severity: "hard",
    score: 14,
    reason: "Uses exaggerated treatment or care framing.",
    pattern: /\b(groundbreaking treatments?|innovative treatments?|elite care|world class care|exclusive access)\b/i,
    evidenceType: "historical",
    confidence: "high",
    evidenceNote: "Strongly supported by the local reject corpus and deceptive/misleading enforcement patterns, but not a published banned-phrase list."
  },
  {
    surface: "economic_vulnerability",
    severity: "hard",
    score: 13,
    reason: "Frames affordability or vulnerability in a sensitive way.",
    pattern: /\b(no insurance required|no necesitas seguro|bad credit|sin seguro|0 down|\$0|low monthly|monthly payments?|rebates?)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Mostly an empirical risk pattern from rejected ads, not a standalone official prohibition."
  },
  {
    surface: "study_compensation_framing",
    severity: "soft",
    score: 10,
    reason: "Leads with compensation in a research-participation context.",
    pattern: /\b(get paid|paid(?: to)? participate|compensation|stipend|receive up to|up to \$?\d+[kK]?\/?(day|week)?|\$?\d+[kK]?\s*(compensation|stipend))\b/i,
    requiresResearchContext: true,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "This is intended to reduce false job-classification on paid clinical-trial ads while still flagging incentive-forward research copy as review-sensitive."
  },
  {
    surface: "job_income_opportunity",
    severity: "hard",
    score: 18,
    reason: "Promises earnings or easy opportunity language associated with scam/job enforcement.",
    pattern: /\b(extra \$?\d+|gigs|easy jobs?|trabajos fáciles|opportunity near you|work opportunity|pick up gigs|side hustle|earn from home|get paid daily)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Intentionally over-catches scam/job-style compensation language and can false-positive on clinical-trial payment framing without more context."
  },
  {
    surface: "demographic_targeting",
    severity: "soft",
    score: 8,
    reason: "Calls out age or demographic groups directly.",
    pattern: /\b(seniors?|50\+|over 18|18\+ only|male dentist|women|men)\b/i,
    evidenceType: "historical",
    confidence: "low",
    evidenceNote: "Meta does not appear to prohibit these copy terms categorically in normal adult ads; this is treated as empirical review risk, not an official ban."
  },
  {
    surface: "manipulative_hook",
    severity: "soft",
    score: 9,
    reason: "Uses sensational or manipulative hook framing.",
    pattern: /\b(force dealerships to do this|in a pickle|almost nothing|approved for|see what(?:'s| is) left|leftover|record setting)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Based on local rejects and deceptive-link/spam patterns rather than a published phrase blacklist."
  },
  {
    surface: "trust_mismatch_spam",
    severity: "soft",
    score: 8,
    reason: "Aggressive CTA or vague destination language often correlates with spam/deceptive-link review.",
    pattern: /\b(check the link below|tap below|join now|learn more below|article below)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Empirical spam/deceptive-link pattern, not a direct policy quote."
  },
  {
    surface: "trust_mismatch_spam",
    severity: "soft",
    score: 8,
    reason: "Urgency and scarcity language increases trust-mismatch risk when paired with sensitive offers.",
    pattern: /\b(spots fill up quickly|enrollment is open|now available|limited spots?|hurry)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Review-risk heuristic based on spam/deceptive outcomes, not a standalone official prohibition."
  },
  {
    surface: "job_income_opportunity",
    severity: "hard",
    score: 14,
    reason: "Signals recruiting or job/opportunity framing.",
    pattern: /\b(participants needed|se buscan participantes|job opportunity|trabajo cerca de ti|employment|opportunity)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Useful for catching scam/employment patterns, but can false-positive on research recruitment language without additional context."
  },
  {
    surface: "economic_vulnerability",
    severity: "soft",
    score: 8,
    reason: "Financing or affordability framing can trigger financial-services review.",
    pattern: /\b(financing|monthly|payments?|insurance savings|save money|enganche|mensualidades)\b/i,
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Primarily an empirical review-sensitivity rule based on rejected ads."
  }
];

const ALL_SURFACES = [
  "personal_attribute_inference",
  "medical_claim_hype",
  "medical_condition_targeting",
  "study_compensation_framing",
  "economic_vulnerability",
  "job_income_opportunity",
  "demographic_targeting",
  "manipulative_hook",
  "trust_mismatch_spam"
];

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

function policyTokens(text) {
  return tokenize(text).filter((token) => token.length > 2 && !POLICY_STOPWORDS.has(token));
}

function termFrequency(text) {
  const map = new Map();
  for (const token of significantTokens(text)) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function rejectionCorpusPath() {
  return path.resolve(__dirname, "../data/meta_rejected_ads_with_copy_2026-01-01_to_2026-04-20.jsonl");
}

function officialPolicyManifestPath() {
  return path.resolve(__dirname, "../data/meta_policy_source_manifest.json");
}

function officialPolicyChunksPath() {
  return path.resolve(__dirname, "../data/meta_policy_chunks.json");
}

function officialPolicyRuntimeChunksPath() {
  return path.resolve(__dirname, "../data/meta_policy_runtime_chunks.json");
}

function officialPolicySnapshotIndexPath() {
  return path.resolve(__dirname, "../data/meta_policy_snapshots/index.json");
}

function copywriterConceptPath() {
  return path.resolve(__dirname, "../data/meta_copywriter_concepts.json");
}

function audienceResearchPath() {
  return path.resolve(__dirname, "../data/meta_audience_research.json");
}

function enforcementHeatPath() {
  return path.resolve(__dirname, "../data/meta_enforcement_heat.json");
}

function rejectCopy(row) {
  return normalizeText(row.observed_copy || row.ad_name || "");
}

function loadRejectionCorpus() {
  if (rejectionCorpusCache) return rejectionCorpusCache;
  const file = rejectionCorpusPath();
  if (!fs.existsSync(file)) {
    rejectionCorpusCache = [];
    return rejectionCorpusCache;
  }
  rejectionCorpusCache = fs.readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((raw) => {
      const copy = rejectCopy(raw);
      const tokens = significantTokens([copy, normalizeText(raw.reason), normalizeText(raw.policy)].filter(Boolean).join(" "));
      return {
        raw,
        copy,
        tokens,
        tokenSet: new Set(tokens)
      };
    })
    .filter((row) => row.copy);
  return rejectionCorpusCache;
}

function loadOfficialPolicyManifest() {
  if (officialPolicyManifestCache) return officialPolicyManifestCache;
  const file = officialPolicyManifestPath();
  if (!fs.existsSync(file)) {
    officialPolicyManifestCache = { version: META_POLICY_HARNESS_VERSION, sources: [] };
    return officialPolicyManifestCache;
  }
  try {
    officialPolicyManifestCache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    officialPolicyManifestCache = { version: META_POLICY_HARNESS_VERSION, sources: [] };
  }
  return officialPolicyManifestCache;
}

function loadOfficialPolicySnapshotIndex() {
  if (officialPolicySnapshotIndexCache) return officialPolicySnapshotIndexCache;
  const file = officialPolicySnapshotIndexPath();
  if (!fs.existsSync(file)) {
    officialPolicySnapshotIndexCache = { refreshedAt: null, sources: [] };
    return officialPolicySnapshotIndexCache;
  }
  try {
    officialPolicySnapshotIndexCache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    officialPolicySnapshotIndexCache = { refreshedAt: null, sources: [] };
  }
  return officialPolicySnapshotIndexCache;
}

function loadCopywriterConcepts() {
  if (copywriterConceptCache) return copywriterConceptCache;
  const file = copywriterConceptPath();
  if (!fs.existsSync(file)) {
    copywriterConceptCache = { version: META_POLICY_HARNESS_VERSION, concepts: [] };
    return copywriterConceptCache;
  }
  try {
    copywriterConceptCache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    copywriterConceptCache = { version: META_POLICY_HARNESS_VERSION, concepts: [] };
  }
  return copywriterConceptCache;
}

function loadAudienceResearch() {
  if (audienceResearchCache) return audienceResearchCache;
  const file = audienceResearchPath();
  if (!fs.existsSync(file)) {
    audienceResearchCache = { version: META_POLICY_HARNESS_VERSION, insights: [] };
    return audienceResearchCache;
  }
  try {
    audienceResearchCache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    audienceResearchCache = { version: META_POLICY_HARNESS_VERSION, insights: [] };
  }
  return audienceResearchCache;
}

function loadEnforcementHeat() {
  if (enforcementHeatCache) return enforcementHeatCache;
  const file = enforcementHeatPath();
  if (!fs.existsSync(file)) {
    enforcementHeatCache = { version: META_POLICY_HARNESS_VERSION, hotZones: [] };
    return enforcementHeatCache;
  }
  try {
    enforcementHeatCache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    enforcementHeatCache = { version: META_POLICY_HARNESS_VERSION, hotZones: [] };
  }
  return enforcementHeatCache;
}

function loadOfficialPolicyChunks() {
  if (officialPolicyChunkCache) return officialPolicyChunkCache;
  const runtimeFile = officialPolicyRuntimeChunksPath();
  const file = fs.existsSync(runtimeFile) ? runtimeFile : officialPolicyChunksPath();
  if (!fs.existsSync(file)) {
    officialPolicyChunkCache = [];
    return officialPolicyChunkCache;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const chunks = Array.isArray(parsed?.chunks) ? parsed.chunks : [];
    const manifestById = new Map(
      (loadOfficialPolicyManifest().sources || []).map((source) => [source.id, source])
    );
    const snapshotById = new Map(
      (loadOfficialPolicySnapshotIndex().sources || []).map((source) => [source.id, source])
    );
    officialPolicyChunkCache = chunks.map((chunk) => {
      const text = normalizeText(chunk.text);
      const tokens = policyTokens([chunk.title, text, chunk.category, ...(chunk.subcategories || [])].filter(Boolean).join(" "));
      return {
        ...chunk,
        text,
        tokens,
        tokenSet: new Set(tokens),
        source: manifestById.get(chunk.sourceId) || null,
        snapshot: snapshotById.get(chunk.sourceId) || null
      };
    });
  } catch {
    officialPolicyChunkCache = [];
  }
  return officialPolicyChunkCache;
}

function rejectReasonSummary(matches) {
  if (matches.length === 0) {
    return ["No similar historical rejects were found in the local corpus."];
  }
  const policies = unique(matches.map((match) => match.policy).filter(Boolean));
  const reasons = unique(matches.map((match) => match.reason).filter(Boolean));
  const summary = [`Found ${matches.length} similar historical rejects in the local corpus.`];
  if (policies.length > 0) {
    summary.push(`Most similar policy buckets: ${policies.slice(0, 3).join(", ")}.`);
  }
  if (reasons.length > 0) {
    summary.push(`Common historical rejection reasons: ${reasons.slice(0, 2).join(" | ")}.`);
  }
  return summary;
}

function findSimilarHistoricalRejects(text, limit = 5) {
  const normalized = normalizeText(text);
  const queryTokens = unique(significantTokens(normalized));
  const querySet = new Set(queryTokens);
  if (queryTokens.length === 0) {
    return {
      station: "historical_rejects",
      version: META_POLICY_HARNESS_VERSION,
      matches: [],
      summary: ["No ad-copy tokens were available for historical reject matching."]
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
      return { entry, overlap: unique(overlap), score };
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
      matchedTerms: overlap.slice(0, 8)
    }));
  return {
    station: "historical_rejects",
    version: META_POLICY_HARNESS_VERSION,
    matches,
    summary: rejectReasonSummary(matches)
  };
}

function officialPolicySummary(matches) {
  if (matches.length === 0) {
    return ["No official Meta policy chunks matched strongly enough for this input."];
  }
  const titles = unique(matches.map((match) => match.title).filter(Boolean));
  const categories = unique(matches.map((match) => match.category).filter(Boolean));
  const groundingModes = unique(matches.map((match) => match.groundingMode).filter(Boolean));
  const summary = [`Found ${matches.length} relevant official Meta policy chunks.`];
  if (categories.length > 0) {
    summary.push(`Top policy categories: ${categories.slice(0, 3).join(", ")}.`);
  }
  if (groundingModes.length > 0) {
    summary.push(`Evidence grounding modes: ${groundingModes.slice(0, 2).join(", ")}.`);
  }
  if (titles.length > 0) {
    summary.push(`Most relevant sources: ${titles.slice(0, 3).join(" | ")}.`);
  }
  return summary;
}

function findOfficialPolicySupport(text, limit = 5) {
  const normalized = normalizeText(text);
  const queryHints = [];
  if (/\b(clinical|trial|trials|study|studies|research|participant|participants|eligibility|screening|sleep apnea|diabetes|depressed|anxious)\b/i.test(normalized)) {
    queryHints.push("health", "medical", "claims", "health_status", "clinical", "research", "trial");
  }
  if (/\b(get paid|compensation|stipend|receive up to|\$\d+|employment|job|work|income|earn)\b/i.test(normalized)) {
    queryHints.push("employment", "financial", "payment", "compensation", "opportunity");
  }
  if (/\b(near you|near me|local|city|state|zipcode|zip code|location)\b/i.test(normalized)) {
    queryHints.push("location", "audience", "targeting");
  }
  if (/\b(page|business manager|ad account|restriction|restricted|disabled|appeal|account integrity|circumvent|circumvention|cloaking|evade|evasion)\b/i.test(normalized)) {
    queryHints.push("review", "enforcement", "pages", "assets", "evasion", "cloaking");
  }
  const queryTokens = unique([...policyTokens(normalized), ...queryHints.map((hint) => hint.toLowerCase())]);
  const querySet = new Set(queryTokens);
  if (queryTokens.length === 0) {
    return {
      station: "official_policy_support",
      version: META_POLICY_HARNESS_VERSION,
      manifestVersion: loadOfficialPolicyManifest().version || META_POLICY_HARNESS_VERSION,
      matches: [],
      summary: ["No ad-copy tokens were available for official policy retrieval."]
    };
  }
  const matches = loadOfficialPolicyChunks()
    .map((entry) => {
      const overlap = entry.tokens.filter((token) => querySet.has(token));
      const overlapCount = overlap.length;
      const union = new Set([...queryTokens, ...entry.tokens]).size || 1;
      const queryCoverage = overlapCount / queryTokens.length;
      const jaccard = overlapCount / union;
      const groundingBoost = entry.groundingMode === "raw_snapshot_excerpt" ? 0.03 : 0;
      const priorityBoost = entry.source?.priority === "critical" ? 0.02 : entry.source?.priority === "high" ? 0.01 : 0;
      const score = Number((queryCoverage * 0.7 + jaccard * 0.3 + groundingBoost + priorityBoost).toFixed(3));
      return { entry, overlap: unique(overlap), score };
    })
    .filter((row) => row.score >= 0.08 || row.overlap.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, overlap, score }) => ({
      chunkId: entry.chunkId,
      sourceId: entry.sourceId,
      title: entry.title,
      url: entry.url,
      category: entry.category,
      subcategories: entry.subcategories || [],
      groundingMode: entry.groundingMode || "curated_summary",
      text: entry.text,
      similarityScore: score,
      matchedTerms: overlap.slice(0, 8),
      sourceMeta: entry.source
        ? {
            title: entry.source.title,
            priority: entry.source.priority,
            captureMethod: entry.source.capture_method
          }
        : null,
      snapshotMeta: entry.snapshot
        ? {
            refreshedAt: entry.snapshot.refreshedAt || null,
            finalUrl: entry.snapshot.finalUrl || null,
            accessible: entry.snapshot.accessible,
            captureStatus: entry.snapshot.captureStatus || null,
            latestJsonPath: entry.snapshot.latestJsonPath || null
          }
        : null
    }));
  return {
    station: "official_policy_support",
    version: META_POLICY_HARNESS_VERSION,
    manifestVersion: loadOfficialPolicyManifest().version || META_POLICY_HARNESS_VERSION,
    snapshotRefreshedAt: loadOfficialPolicySnapshotIndex().refreshedAt || null,
    matches,
    summary: officialPolicySummary(matches)
  };
}

const SURFACE_POLICY_HINTS = {
  personal_attribute_inference: ["health_status", "special_protections", "sensitive", "condition"],
  medical_claim_hype: ["medical_claims", "health", "pharmaceuticals"],
  medical_condition_targeting: ["health", "medical", "health_status", "clinical", "research"],
  study_compensation_framing: ["clinical", "research", "trial", "employment", "payment", "review"],
  economic_vulnerability: ["financial_services", "misleading_practices", "review"],
  job_income_opportunity: ["employment", "special_ad_categories", "review", "restrictions"],
  demographic_targeting: ["age", "location", "audiences", "targeting", "special_ad_categories"],
  manipulative_hook: ["review", "enforcement", "scams", "misleading_practices"],
  trust_mismatch_spam: ["review", "enforcement", "scams", "cloaking", "deceptive_practices"]
};

const COMBO_EVIDENCE = {
  "Medical condition + personal-attribute inference": {
    evidenceType: "inferred",
    rationale: "Official sources support health-status sensitivity, while the dangerous part is the combination of health language plus apparent knowledge about the viewer."
  },
  "Medical condition + treatment/care hype": {
    evidenceType: "historical",
    rationale: "Official sources support medical-claim sensitivity; the combination with hype is modeled from rejects and review patterns."
  },
  "Medical condition + study-compensation framing": {
    evidenceType: "historical",
    rationale: "Official sources support health sensitivity; the additional compensation-hook risk is empirical for research ads."
  },
  "Medical condition + affordability/vulnerability framing": {
    evidenceType: "historical",
    rationale: "The health-plus-vulnerability interaction is mostly a review-risk pattern derived from local outcomes."
  },
  "Job/income promise + economic-vulnerability framing": {
    evidenceType: "historical",
    rationale: "This combination behaves like a scam/opportunity cluster in historical rejects and enforcement patterns."
  },
  "Demographic targeting + financial/eligibility framing": {
    evidenceType: "historical",
    rationale: "Meta does not clearly ban the demographic callout alone; the risk comes from pairing it with vulnerable or eligibility framing."
  },
  "Manipulative hook + trust-mismatch/spam cues": {
    evidenceType: "historical",
    rationale: "This cluster is an empirical spam/deception pattern reinforced by Meta's official anti-scam posture."
  },
  "Three or more hard-risk families active": {
    evidenceType: "inferred",
    rationale: "This is a system-level internal inference used to catch stacked-risk copy before it becomes an asset-trust problem."
  }
};

const COMBO_SURFACE_LINKS = {
  "Medical condition + personal-attribute inference": ["medical_condition_targeting", "personal_attribute_inference"],
  "Medical condition + treatment/care hype": ["medical_condition_targeting", "medical_claim_hype"],
  "Medical condition + study-compensation framing": ["medical_condition_targeting", "study_compensation_framing"],
  "Medical condition + affordability/vulnerability framing": ["medical_condition_targeting", "economic_vulnerability"],
  "Job/income promise + economic-vulnerability framing": ["job_income_opportunity", "economic_vulnerability"],
  "Demographic targeting + financial/eligibility framing": ["demographic_targeting", "economic_vulnerability"],
  "Manipulative hook + trust-mismatch/spam cues": ["manipulative_hook", "trust_mismatch_spam"],
  "Three or more hard-risk families active": []
};

function buildSurfacePolicySupport(boundary, combinedText) {
  const active = (boundary.review?.surfaceFindings || []).filter((finding) => finding.active);
  const support = {};
  for (const finding of active) {
    const hints = SURFACE_POLICY_HINTS[finding.surface] || [];
    const matchedPhrases = Array.isArray(finding.matchedPhrases) ? finding.matchedPhrases.join(" ") : "";
    const query = finding.surface === "personal_attribute_inference"
      ? `${finding.label} ${hints.join(" ")}`.trim()
      : `${finding.label} ${matchedPhrases} ${hints.join(" ")}`.trim();
    support[finding.surface] = findOfficialPolicySupport(query, 3);
  }
  return support;
}

function buildComboPolicyContext(boundary, surfacePolicySupport) {
  return (boundary.review?.comboFindings || []).map((combo) => {
    const meta = COMBO_EVIDENCE[combo.name] || {
      evidenceType: "inferred",
      rationale: "This combination effect is modeled internally from stacked-risk behavior."
    };
    const relevantSurfaces = COMBO_SURFACE_LINKS[combo.name] || [];
    const surfaceEntries = relevantSurfaces.length
      ? relevantSurfaces.map((surface) => surfacePolicySupport?.[surface]).filter(Boolean)
      : Object.values(surfacePolicySupport || {});
    const linkedSurfaceMatches = unique(
      surfaceEntries
        .flatMap((entry) => Array.isArray(entry?.matches) ? entry.matches.slice(0, 2) : [])
        .map((match) => `${match.title}||${match.url}`)
    ).slice(0, 4).map((item) => {
      const [title, url] = item.split("||");
      return { title, url };
    });
    return {
      name: combo.name,
      score: combo.score,
      explanation: combo.explanation,
      evidenceType: meta.evidenceType,
      rationale: meta.rationale,
      supportingPolicyCitations: linkedSurfaceMatches
    };
  });
}

function slimPolicyMatches(matches, limit = 2) {
  return (Array.isArray(matches) ? matches : []).slice(0, limit).map((match) => ({
    chunkId: match.chunkId,
    title: match.title,
    url: match.url,
    similarityScore: match.similarityScore,
    groundingMode: match.groundingMode,
    snapshotRefreshedAt: match?.snapshotMeta?.refreshedAt || null
  }));
}

function attachInlinePolicyCitations(boundary, officialPolicySupport, surfacePolicySupport, comboPolicyContext) {
  const review = boundary?.review;
  if (!review) return boundary;
  const officialSummary = officialPolicySupport?.summary || [];
  const officialSnapshotRefreshedAt = officialPolicySupport?.snapshotRefreshedAt || null;

  const enrichedReview = {
    ...review,
    groundingMeta: {
      officialSummary,
      officialSnapshotRefreshedAt
    },
    surfaceFindings: (review.surfaceFindings || []).map((finding) => ({
      ...finding,
      officialPolicyCitations: slimPolicyMatches(surfacePolicySupport?.[finding.surface]?.matches, 2)
    })),
    comboFindings: (review.comboFindings || []).map((combo) => {
      const comboContext = (comboPolicyContext || []).find((entry) => entry.name === combo.name);
      return {
        ...combo,
        evidenceType: comboContext?.evidenceType || "inferred",
        rationale: comboContext?.rationale || null,
        officialPolicyCitations: comboContext?.supportingPolicyCitations || []
      };
    }),
    lineFindings: (review.lineFindings || []).map((line) => ({
      ...line,
      issues: (line.issues || []).map((issue) => ({
        ...issue,
        officialPolicyCitations: slimPolicyMatches(surfacePolicySupport?.[issue.surface]?.matches, 2)
      }))
    }))
  };

  return {
    ...boundary,
    review: enrichedReview
  };
}

function policyCorpusStatus() {
  const manifest = loadOfficialPolicyManifest();
  const snapshots = loadOfficialPolicySnapshotIndex();
  const sources = Array.isArray(snapshots.sources) ? snapshots.sources : [];
  return {
    station: "policy_corpus_status",
    version: META_POLICY_HARNESS_VERSION,
    manifestVersion: manifest.version || null,
    snapshotRefreshedAt: snapshots.refreshedAt || null,
    sourceCount: Array.isArray(manifest.sources) ? manifest.sources.length : 0,
    snapshotCounts: {
      captured: sources.filter((source) => source.captureStatus === "captured").length,
      loginRedirect: sources.filter((source) => source.captureStatus === "login_redirect").length,
      temporaryBlock: sources.filter((source) => source.captureStatus === "temporary_block").length,
      fetchError: sources.filter((source) => source.captureStatus === "fetch_error").length
    },
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      category: source.category,
      priority: source.priority,
      refreshedAt: source.refreshedAt || null,
      captureStatus: source.captureStatus || null,
      accessible: source.accessible,
      finalUrl: source.finalUrl || null
    }))
  };
}

function selectCopywriterConcepts(bundle, painBrief, angleOutput) {
  const library = Array.isArray(loadCopywriterConcepts().concepts) ? loadCopywriterConcepts().concepts : [];
  const article = articleBlob(bundle).toLowerCase();
  const painBlob = [
    ...(painBrief?.functionalPain || []),
    ...(painBrief?.emotionalPain || []),
    ...(painBrief?.failedAlternatives || []),
    ...(painBrief?.stakes || []),
    ...(painBrief?.desiredOutcome || [])
  ].join(" ").toLowerCase();
  const conceptIds = new Set(["human_moment_articulation"]);

  if (/\b(still|stuck|frustrat|limiting|hard to stick with|same old|not working|worth a closer look)\b/.test(painBlob)) {
    conceptIds.add("contradiction_contrast");
  }
  if (/\b(mask|routine|night|morning|dinner|jeans|festival|cook|cooking|cpap|tired|exhausted)\b/.test(`${painBlob} ${article}`)) {
    conceptIds.add("hyper_specificity");
  }
  if (/\b(current|ongoing|right now|month|months|today|before|another month|now)\b/.test(`${article} ${(angleOutput?.angles || []).map((a) => a.hook).join(" ")}`)) {
    conceptIds.add("timeframe_tension");
  }
  if ((angleOutput?.angles || []).some((angle) => /pov/i.test(angle.name || "") || /scenario/i.test(angle.hook || ""))) {
    conceptIds.add("pov_advice_in_disguise");
  }

  const selected = library.filter((concept) => conceptIds.has(concept.id)).slice(0, 4);
  return {
    station: "copywriter_concepts",
    version: loadCopywriterConcepts().version || META_POLICY_HARNESS_VERSION,
    selected,
    summary: selected.map((concept) => `${concept.name}: ${concept.principle}`)
  };
}

function normalizeConceptNotes(input) {
  if (typeof input === "string") {
    const value = normalizeText(input);
    return value ? [value] : [];
  }
  if (Array.isArray(input)) {
    return unique(
      input
        .flatMap((item) => {
          if (typeof item === "string") return [normalizeText(item)];
          if (item && typeof item === "object") {
            return [
              normalizeText(item.name),
              normalizeText(item.notes),
              normalizeText(item.text),
              normalizeText(item.principle)
            ];
          }
          return [];
        })
        .filter(Boolean)
    );
  }
  if (input && typeof input === "object") {
    return unique(
      [normalizeText(input.name), normalizeText(input.notes), normalizeText(input.text), normalizeText(input.principle)].filter(Boolean)
    );
  }
  return [];
}

function slugifyConceptId(value, fallback = "custom_concept") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function conceptCanonicalKey(concept) {
  const blob = `${concept?.id || ""} ${concept?.name || ""} ${concept?.principle || ""}`.toLowerCase();
  if (/\bcontradict|contrast\b/.test(blob)) return "contradiction_contrast";
  if (/\bspecific/.test(blob)) return "hyper_specificity";
  if (/\btimeframe|timeline|right now|now\b/.test(blob)) return "timeframe_tension";
  if (/\bpov|scenario\b/.test(blob)) return "pov_advice_in_disguise";
  if (/\bhuman|genuine|moment|observation\b/.test(blob)) return "human_moment_articulation";
  return slugifyConceptId(concept?.name || concept?.id || "", "custom_concept");
}

function copywriterConceptDistillSchema() {
  return {
    type: "json_schema",
    name: "copywriter_concept_distillation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concepts: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              principle: { type: "string" },
              whyItWorks: { type: "string" },
              useWhen: {
                type: "array",
                items: { type: "string" }
              },
              avoidWhen: {
                type: "array",
                items: { type: "string" }
              },
              formats: {
                type: "array",
                items: { type: "string" }
              },
              policyGuardrails: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["name", "principle", "whyItWorks", "useWhen", "avoidWhen", "formats", "policyGuardrails"]
          }
        }
      },
      required: ["concepts"]
    }
  };
}

async function distillCopywriterConceptNotes(conceptNotes) {
  const notes = normalizeConceptNotes(conceptNotes);
  if (!notes.length) {
    return {
      station: "copywriter_concept_distillation",
      version: META_POLICY_HARNESS_VERSION,
      sourceNotes: [],
      distilled: [],
      summary: []
    };
  }

  const prompt = [
    "Distill the following raw copywriting concept notes into structured concepts for an ad-writing harness.",
    "Preserve the actual idea. Do not add guru fluff.",
    "Focus on modern hook mechanics, when to use them, and policy-safe guardrails.",
    "Return only concepts that are genuinely distinct.",
    "",
    "Raw notes:",
    ...notes.map((note, index) => `${index + 1}. ${note}`)
  ].join("\n");

  const system = "You distill modern copywriting notes into compact, operational concepts for a direct-response ad-writing harness. Be concrete and terse.";
  let concepts = [];
  try {
    const raw = await generateText({
      system,
      prompt,
      temperature: 0.2,
      maxTokens: 1400,
      model: process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5",
      textFormat: copywriterConceptDistillSchema()
    });
    const parsed = JSON.parse(raw);
    concepts = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
  } catch {
    concepts = [];
  }

  const distilled = concepts.map((concept, index) => ({
    id: slugifyConceptId(concept.name, `custom_concept_${index + 1}`),
    name: normalizeText(concept.name),
    principle: normalizeText(concept.principle),
    whyItWorks: normalizeText(concept.whyItWorks),
    useWhen: unique((concept.useWhen || []).map((value) => normalizeText(value)).filter(Boolean)),
    avoidWhen: unique((concept.avoidWhen || []).map((value) => normalizeText(value)).filter(Boolean)),
    formats: unique((concept.formats || []).map((value) => normalizeText(value)).filter(Boolean)),
    policyGuardrails: unique((concept.policyGuardrails || []).map((value) => normalizeText(value)).filter(Boolean)),
    source: "runtime_notes"
  })).filter((concept) => concept.name && concept.principle);

  return {
    station: "copywriter_concept_distillation",
    version: META_POLICY_HARNESS_VERSION,
    sourceNotes: notes,
    distilled,
    summary: distilled.map((concept) => `${concept.name}: ${concept.principle}`)
  };
}

function mergeCopywriterConcepts(baseConceptOutput, distilledConceptOutput) {
  const selected = [];
  const seen = new Set();
  for (const concept of [...(baseConceptOutput?.selected || []), ...(distilledConceptOutput?.distilled || [])]) {
    const key = conceptCanonicalKey(concept);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(concept);
  }
  return {
    station: "copywriter_concepts",
    version: baseConceptOutput?.version || META_POLICY_HARNESS_VERSION,
    selected,
    summary: selected.map((concept) => `${concept.name}: ${concept.principle}`),
    runtimeDistillation: distilledConceptOutput || null
  };
}

function inferAudienceResearchTopics(bundle) {
  const article = articleBlob(bundle).toLowerCase();
  const topics = new Set(["general_health"]);
  if (/\bclinical trial|clinical trials|research study|research studies|trial|trials|study|studies\b/.test(article)) {
    topics.add("clinical_trials");
  }
  if (/\bsleep apnea|osa|obstructive sleep apnea|cpap\b/.test(article)) {
    topics.add("sleep_apnea");
  }
  if (/\bdiabetes\b/.test(article)) {
    topics.add("diabetes");
  }
  return Array.from(topics);
}

function selectAudienceResearch(bundle) {
  const library = Array.isArray(loadAudienceResearch().insights) ? loadAudienceResearch().insights : [];
  const article = articleBlob(bundle).toLowerCase();
  const topics = inferAudienceResearchTopics(bundle);
  const selected = library
    .map((insight) => {
      let score = 0;
      for (const topic of insight.topics || []) {
        if (topics.includes(topic)) score += topic === "general_health" ? 1 : 4;
      }
      if (/sleep apnea/.test(article) && /\bcpap|sleep apnea\b/.test(`${insight.claim} ${(insight.tags || []).join(" ")}`.toLowerCase())) score += 3;
      if (/\bclinical trial|study|research\b/.test(article) && (insight.topics || []).includes("clinical_trials")) score += 2;
      return { ...insight, relevanceScore: score };
    })
    .filter((insight) => insight.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6);

  return {
    station: "audience_research",
    version: loadAudienceResearch().version || META_POLICY_HARNESS_VERSION,
    topics,
    selected,
    summary: selected.map((insight) => insight.claim)
  };
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
    study_compensation_framing: 0,
    economic_vulnerability: 0,
    job_income_opportunity: 0,
    demographic_targeting: 0,
    manipulative_hook: 0,
    trust_mismatch_spam: 0
  };
}

const SURFACE_META = {
  personal_attribute_inference: {
    label: "Personal Attribute Inference",
    explanation: "This surface fires when the copy sounds like it knows the viewer has a sensitive condition, status, or local relevance.",
    recommendations: ["Remove “near you” and other language that implies the ad knows who the viewer is or what they have."],
    evidenceType: "inferred",
    confidence: "high",
    evidenceNote: "Grounded in Meta sensitivity around special-protection topics, but the phrase-level implementation is internal inference."
  },
  medical_claim_hype: {
    label: "Medical Claim Hype",
    explanation: "This surface fires when treatment, care, or outcome language sounds exaggerated, premium, or insufficiently supported.",
    recommendations: ["Replace superlatives and hype with neutral, factual descriptions supported by the landing page."],
    evidenceType: "historical",
    confidence: "high",
    evidenceNote: "Best treated as a historical/deceptive-risk pattern rather than a directly cited Meta phrase ban."
  },
  medical_condition_targeting: {
    label: "Medical Condition Targeting",
    explanation: "This surface activates when the ad directly names a medical condition, procedure, or clinical context that increases policy sensitivity.",
    recommendations: ["Use condition language carefully and avoid stacking it with personalization, hype, or vulnerability framing."],
    evidenceType: "inferred",
    confidence: "medium",
    evidenceNote: "Naming a condition is not categorically prohibited, but it raises sensitivity and becomes risky in combination."
  },
  study_compensation_framing: {
    label: "Study Compensation Framing",
    explanation: "This surface activates when a research or clinical-trial ad leads with payment or stipend language. It is not the same as Meta officially classifying the ad as employment.",
    recommendations: ["Move compensation lower in the message, keep it factual, and avoid making payment the primary hook."],
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Empirical risk pattern for research ads. Useful to separate paid-study messaging from true employment/job claims."
  },
  economic_vulnerability: {
    label: "Economic Vulnerability",
    explanation: "This surface captures affordability, insurance, payments, and similar hooks that can read as exploiting financial vulnerability.",
    recommendations: ["Strip affordability hooks unless they are essential, neutral, and clearly supported by the landing page."],
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "This surface is empirical and should be read as review-risk, not direct policy text."
  },
  job_income_opportunity: {
    label: "Job / Income Opportunity",
    explanation: "This surface covers recruiting, earnings, and opportunity language that sits in Meta’s higher-enforcement scam and employment area.",
    recommendations: ["Remove earnings, easy-income, and recruiting language unless the offer is explicitly and safely in-policy."],
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "This can false-positive on paid study recruitment; treat it as a high-risk pattern, not an automatic jobs classification."
  },
  demographic_targeting: {
    label: "Demographic Callout",
    explanation: "This surface flags direct age or demographic callouts because they often correlate with reject patterns in scam-adjacent offers, not because Meta clearly bans them across normal adult ads.",
    recommendations: ["Avoid direct demographic callouts in copy unless they are absolutely required and policy-safe."],
    evidenceType: "historical",
    confidence: "low",
    evidenceNote: "Empirical risk, not a confirmed official prohibition for normal adult ads."
  },
  manipulative_hook: {
    label: "Manipulative Hook",
    explanation: "This surface captures sensationalized curiosity bait that can make the ad feel deceptive or spam-adjacent.",
    recommendations: ["Swap forced-curiosity hooks for specific, credible statements that still create interest."],
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Historical spam/deceptive pattern."
  },
  trust_mismatch_spam: {
    label: "Trust Mismatch / Spam",
    explanation: "This surface reflects vague CTA language, urgency, or message patterns that often correlate with deceptive destination mismatch.",
    recommendations: ["Use precise CTA language and keep the promise tightly aligned with the landing experience."],
    evidenceType: "historical",
    confidence: "medium",
    evidenceNote: "Empirical spam/deceptive-link pattern."
  }
};

const COMBO_LIBRARY = {
  "Medical condition + personal-attribute inference": {
    score: 18,
    explanation: "Naming a condition while also sounding like the ad knows it applies to the viewer creates a much stronger policy risk signal."
  },
  "Medical condition + treatment/care hype": {
    score: 14,
    explanation: "Condition-sensitive ads get riskier when treatment or care claims become aspirational, premium, or exaggerated."
  },
  "Medical condition + study-compensation framing": {
    score: 8,
    explanation: "Condition-sensitive research ads get riskier when payment is pushed as the primary hook."
  },
  "Medical condition + affordability/vulnerability framing": {
    score: 14,
    explanation: "Health-sensitive copy paired with insurance or affordability hooks often reads as targeting vulnerability."
  },
  "Job/income promise + economic-vulnerability framing": {
    score: 16,
    explanation: "Opportunity language combined with money pressure is a classic high-enforcement scam pattern."
  },
  "Demographic targeting + financial/eligibility framing": {
    score: 14,
    explanation: "Calling out a demographic while also talking about affordability or eligibility increases discrimination and policy risk."
  },
  "Manipulative hook + trust-mismatch/spam cues": {
    score: 10,
    explanation: "Aggressive curiosity bait plus vague CTA language pushes the ad toward deceptive or spam-like review patterns."
  },
  "Three or more hard-risk families active": {
    score: 15,
    explanation: "Once several hard-risk surfaces are active together, the ad starts to look like a system-level policy problem rather than a single bad phrase."
  }
};

function buildRecommendations(familyScores) {
  const recommendations = [];
  if (familyScores.personal_attribute_inference > 0) {
    recommendations.push("Remove “near you,” direct condition callouts, and any phrasing that implies the viewer has the condition.");
  }
  if (familyScores.medical_claim_hype > 0) {
    recommendations.push("Replace treatment hype with neutral, factual study or care descriptions.");
  }
  if (familyScores.study_compensation_framing > 0) {
    recommendations.push("Do not lead with payment for study participation; keep compensation factual and secondary.");
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

function highestSeverity(triggers) {
  if (triggers.some((trigger) => trigger.severity === "hard")) return "hard";
  if (triggers.length > 0) return "soft";
  return "none";
}

function slimHeatZone(zone) {
  return {
    id: zone.id,
    label: zone.label,
    severity: zone.severity,
    whyItMatters: zone.whyItMatters,
    sources: (zone.sources || []).slice(0, 3)
  };
}

function severityRank(value) {
  return value === "critical" ? 3 : value === "high" ? 2 : value === "medium" ? 1 : 0;
}

function enforcementHeatForSurface(surface) {
  const zones = Array.isArray(loadEnforcementHeat().hotZones) ? loadEnforcementHeat().hotZones : [];
  const matches = zones.filter((zone) => (zone.appliesToSurfaces || []).includes(surface));
  if (!matches.length) {
    return {
      active: false,
      severity: "none",
      hotZones: []
    };
  }
  const severity = matches.reduce((best, zone) => (severityRank(zone.severity) > severityRank(best) ? zone.severity : best), "none");
  return {
    active: true,
    severity,
    hotZones: matches.map(slimHeatZone)
  };
}

function enforcementHeatForCombo(name) {
  const zones = Array.isArray(loadEnforcementHeat().hotZones) ? loadEnforcementHeat().hotZones : [];
  const matches = zones.filter((zone) => (zone.appliesToCombos || []).includes(name));
  if (!matches.length) {
    return {
      active: false,
      severity: "none",
      hotZones: []
    };
  }
  const severity = matches.reduce((best, zone) => (severityRank(zone.severity) > severityRank(best) ? zone.severity : best), "none");
  return {
    active: true,
    severity,
    hotZones: matches.map(slimHeatZone)
  };
}

function buildEnforcementHeatSummary(surfaceFindings, comboFindings) {
  const activeZones = [];
  const seen = new Set();
  for (const item of [...surfaceFindings, ...comboFindings]) {
    for (const zone of item.enforcementHeat?.hotZones || []) {
      if (seen.has(zone.id)) continue;
      seen.add(zone.id);
      activeZones.push(zone);
    }
  }
  const overallSeverity = activeZones.reduce((best, zone) => (severityRank(zone.severity) > severityRank(best) ? zone.severity : best), "none");
  const summary = activeZones.length
    ? [
        `Active Meta enforcement hot zones: ${activeZones.map((zone) => zone.label).join(", ")}.`,
        `Highest active enforcement heat: ${overallSeverity.toUpperCase()}.`
      ]
    : ["No current public Meta enforcement hot zone was mapped onto the active surfaces or combos."];
  return {
    overallSeverity,
    activeZones,
    summary
  };
}

function whyBand(overallBand, totalScore, assetBanRisk, familyScores, combos) {
  const reasons = [`The ad scored ${totalScore}, which places it in the ${overallBand.toUpperCase()} band with ${assetBanRisk.toUpperCase()} asset-ban risk.`];
  const activeSurfaces = ALL_SURFACES
    .filter((surface) => familyScores[surface] > 0)
    .sort((a, b) => familyScores[b] - familyScores[a]);

  if (activeSurfaces.length > 0) {
    reasons.push(
      `The strongest active risk surfaces are ${activeSurfaces.slice(0, 3).map((surface) => `${SURFACE_META[surface].label} (${familyScores[surface]})`).join(", ")}.`
    );
  }

  if (combos.length > 0) {
    reasons.push(`Risk is amplified by combination effects: ${combos.join("; ")}.`);
  }

  if (overallBand === "white") {
    reasons.push("The copy stays mostly descriptive and avoids enough of the high-enforcement patterns to remain in the lowest band.");
  } else if (overallBand === "grey") {
    reasons.push("The copy contains meaningful policy-sensitive signals, but not enough stacked enforcement risk to be treated as a clear black-band failure.");
  } else {
    reasons.push("Too many hard-risk signals are stacked together, so the ad reads like a likely rejection or escalation candidate rather than a borderline case.");
  }

  return reasons;
}

function buildReview(overallBand, totalScore, assetBanRisk, familyScores, lineScores, combos, recommendations) {
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
      enforcementHeat: enforcementHeatForSurface(surface)
    };
  });

  const comboFindings = combos.map((name) => ({
    name,
    score: COMBO_LIBRARY[name]?.score || 0,
    explanation: COMBO_LIBRARY[name]?.explanation || "Multiple risky signals are interacting and making the ad meaningfully more dangerous than any single phrase alone.",
    enforcementHeat: enforcementHeatForCombo(name)
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
      evidenceNote: trigger.evidenceNote
    }));

    let why = "This line is mostly descriptive and does not activate material policy risk.";
    if (line.band === "grey") {
      why = "This line activates policy-sensitive language but does not stack enough risk to be an obvious black-band phrase by itself.";
    } else if (line.band === "black") {
      why = "This line carries enough stacked triggers on its own to behave like a direct rejection driver.";
    }

    return {
      line: line.line,
      band: line.band,
      score: line.score,
      why,
      issues,
      rewriteGuidance: unique(line.triggers.flatMap((trigger) => SURFACE_META[trigger.surface].recommendations))
    };
  });

  let verdict = "This copy is low-risk and mostly descriptive.";
  if (overallBand === "grey") {
    verdict = "This copy is borderline: it contains meaningful review risk, but can likely be salvaged with narrower, more factual phrasing.";
  } else if (overallBand === "black") {
    verdict = "This copy is high-risk: the active surfaces and combo effects make it a likely rejection or escalation candidate.";
  }

  if (recommendations.length > 0) {
    verdict = `${verdict} Priority fixes: ${recommendations.slice(0, 2).join(" ")}`;
  }

  const enforcementHeat = buildEnforcementHeatSummary(surfaceFindings, comboFindings);

  return {
    verdict,
    whyBand: whyBand(overallBand, totalScore, assetBanRisk, familyScores, combos),
    surfaceFindings,
    comboFindings,
    lineFindings,
    enforcementHeat
  };
}

function buildSummary(totalScore, assetBanRisk, familyScores) {
  const summary = [`Total risk score: ${totalScore}.`, `Asset-ban risk: ${assetBanRisk}.`];
  if (familyScores.personal_attribute_inference > 0) {
    summary.push("The copy implies knowledge of the viewer’s condition or status.");
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.medical_claim_hype > 0) {
    summary.push("Medical-condition targeting is compounded by treatment/care hype.");
  }
  if (familyScores.medical_condition_targeting > 0 && familyScores.study_compensation_framing > 0) {
    summary.push("Condition-sensitive study copy is also leaning on compensation as a hook.");
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
  if (familyScores.medical_condition_targeting > 0 && familyScores.study_compensation_framing > 0) {
    combos.push("Medical condition + study-compensation framing");
    comboScore += 8;
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
    familyScores.job_income_opportunity > 0
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
  const researchContext = /\b(clinical|trial|trials|study|studies|research|participant|participants|screening|eligibility)\b/i.test(normalized);
  const lines = splitIntoLines(normalized);
  const familyScores = createFamilyScores();
  const lineScores = lines.map((line) => {
    const triggers = [];
    for (const detector of DETECTORS) {
      if (detector.requiresResearchContext && !researchContext) continue;
      if (detector.forbidResearchContext && researchContext) continue;
      detector.pattern.lastIndex = 0;
      const match = line.match(detector.pattern);
      if (!match) continue;
      triggers.push({
        surface: detector.surface,
        severity: detector.severity,
        score: detector.score,
        match: match[0],
        reason: detector.reason,
        evidenceType: detector.evidenceType,
        confidence: detector.confidence,
        evidenceNote: detector.evidenceNote
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
    review: buildReview(overallBand, totalScore, assetBanRisk, familyScores, lineScores, combos, recommendations)
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
    combinedAdText,
    copywriterConceptNotes: normalizeConceptNotes(input.copywriterConceptNotes || input.copywriterConceptIdeas || [])
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
  let combined = scoreMetaAdBoundary(combinedText);
  const officialPolicySupport = findOfficialPolicySupport(combinedText);
  const surfacePolicySupport = buildSurfacePolicySupport(combined, combinedText);
  const comboPolicyContext = buildComboPolicyContext(combined, surfacePolicySupport);
  combined = attachInlinePolicyCitations(combined, officialPolicySupport, surfacePolicySupport, comboPolicyContext);
  const offendingMatches = unique(
    Object.values(bySurface)
      .flatMap((score) => score.lineScores)
      .flatMap((line) => line.triggers.map((trigger) => trigger.match))
  );
  const similarRejects = findSimilarHistoricalRejects(combinedText).matches;
  const rewriteRequired = combined.overallBand === "black";
  return {
    station: "boundary_judge",
    version: META_POLICY_HARNESS_VERSION,
    combined,
    bySurface,
    officialPolicySupport,
    surfacePolicySupport,
    comboPolicyContext,
    enforcementHeat: combined.review?.enforcementHeat || null,
    offendingMatches,
    similarRejects,
    gate: {
      rewriteRequired,
      pass: !rewriteRequired
    }
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

function articleDistillationSchema() {
  return {
    type: "json_schema",
    name: "article_distillation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        coreProblem: { type: "string" },
        audienceAwareness: {
          type: "object",
          additionalProperties: false,
          properties: {
            diagnosisAwareness: { type: "string", enum: ["low", "mixed", "high"] },
            languageStrategy: { type: "string", enum: ["symptom_first", "mixed", "diagnosis_forward"] },
            rationale: { type: "string" }
          },
          required: ["diagnosisAwareness", "languageStrategy", "rationale"]
        },
        painPoints: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              point: { type: "string" },
              whyCompelling: { type: "string" },
              support: { type: "string" }
            },
            required: ["point", "whyCompelling", "support"]
          }
        },
        gapPoints: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              point: { type: "string" },
              whyCompelling: { type: "string" },
              support: { type: "string" }
            },
            required: ["point", "whyCompelling", "support"]
          }
        },
        newPossibilityPoints: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              point: { type: "string" },
              whyCompelling: { type: "string" },
              support: { type: "string" }
            },
            required: ["point", "whyCompelling", "support"]
          }
        },
        proofPoints: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              point: { type: "string" },
              whyCompelling: { type: "string" },
              support: { type: "string" }
            },
            required: ["point", "whyCompelling", "support"]
          }
        },
        clickValuePoints: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              point: { type: "string" },
              whyCompelling: { type: "string" },
              support: { type: "string" }
            },
            required: ["point", "whyCompelling", "support"]
          }
        },
        processFillerPoints: {
          type: "array",
          maxItems: 4,
          items: { type: "string" }
        },
        strongestAngles: {
          type: "array",
          maxItems: 3,
          items: { type: "string" }
        },
        unsafeTemptations: {
          type: "array",
          maxItems: 5,
          items: { type: "string" }
        }
      },
      required: [
        "coreProblem",
        "audienceAwareness",
        "painPoints",
        "gapPoints",
        "newPossibilityPoints",
        "proofPoints",
        "clickValuePoints",
        "processFillerPoints",
        "strongestAngles",
        "unsafeTemptations"
      ]
    }
  };
}

function distillationFallback(bundle, envelope, painBrief) {
  const article = articleBlob(bundle).toLowerCase();
  const isSleepApnea = /sleep apnea/.test(article);
  const isDiabetes = /diabetes/.test(article);
  const diagnosisAwareness = isSleepApnea ? "mixed" : "high";
  const languageStrategy = isSleepApnea ? "symptom_first" : "diagnosis_forward";

  const painPoints = isSleepApnea
    ? [
        {
          point: "Feeling exhausted even after a full night and struggling with disrupted sleep.",
          whyCompelling: "Readers are more likely to identify with the symptom than the clinical label.",
          support: "The article is about sleep apnea trials and current treatment alternatives."
        },
        {
          point: "Current options can feel uncomfortable or hard to stick with.",
          whyCompelling: "Treatment friction is a stronger click driver than study process details.",
          support: "The article discusses CPAP alternatives and other treatment strategies."
        }
      ]
    : isDiabetes
      ? [
          {
            point: "Current condition management can feel limiting or incomplete.",
            whyCompelling: "It validates frustration without making an unsupported promise.",
            support: "The article covers current diabetes research studies and participation information."
          }
        ]
      : [
          {
            point: "The current problem is disruptive enough that readers may want another option.",
            whyCompelling: "This creates self-interest without overclaiming.",
            support: "The article presents current studies and what readers can review."
          }
        ];

  return {
    station: "article_distillation",
    version: META_POLICY_HARNESS_VERSION,
    coreProblem: isSleepApnea
      ? "People may be struggling with poor sleep and treatments that feel hard to live with."
      : isDiabetes
        ? "People may want to understand what newer diabetes research options are being studied."
        : "Readers may be looking for a practical next option beyond the status quo.",
    audienceAwareness: {
      diagnosisAwareness,
      languageStrategy,
      rationale: isSleepApnea
        ? "Many readers understand the symptom experience before they identify with the term sleep apnea, so symptom-first framing is safer and more compelling."
        : "The article topic is direct enough that diagnosis-forward language is acceptable if it remains congruent and non-personalized."
    },
    painPoints,
    gapPoints: [
      {
        point: "The usual path may feel incomplete, uncomfortable, or frustrating.",
        whyCompelling: "Gap language creates motivation without making a results claim.",
        support: envelope.evidenceSentences[0] || articleBlob(bundle)
      }
    ],
    newPossibilityPoints: [
      {
        point: "Current studies are exploring other approaches worth understanding.",
        whyCompelling: "This opens a credible new possibility without overpromising.",
        support: envelope.evidenceSentences[0] || articleBlob(bundle)
      }
    ],
    proofPoints: [
      {
        point: "The article explains what types of approaches are being studied and how to review them.",
        whyCompelling: "Concrete proof keeps the hook believable.",
        support: envelope.evidenceSentences[1] || envelope.evidenceSentences[0] || articleBlob(bundle)
      }
    ],
    clickValuePoints: [
      {
        point: "The click gives the reader a clearer look at what else is being tested right now.",
        whyCompelling: "It makes the click about useful clarity, not just generic information.",
        support: envelope.evidenceSentences[0] || articleBlob(bundle)
      }
    ],
    processFillerPoints: ["eligibility criteria", "participation steps", "screening mechanics", "administrative study process"],
    strongestAngles: ["frustration-to-alternative", "what-else-is-out-there", "stuck-reader"],
    unsafeTemptations: unique([
      ...envelope.unsupportedRiskPhrases,
      "diagnosis-first language when symptom-first language would be stronger",
      "making compensation the main hook"
    ])
  };
}

async function distillArticleForCopywriter(bundle, envelope, readerState, painBrief, angleOutput, audienceResearch) {
  const article = articleBlob(bundle);
  if (!article) {
    return distillationFallback(bundle, envelope, painBrief);
  }

  const prompt = [
    "Distill this landing article into the strongest honest persuasion brief for ad writing.",
    "Use only what the article supports.",
    "Do not summarize the whole article. Select only the parts that create the strongest honest desire to click.",
    "Think in first principles:",
    "- what pain or friction is real?",
    "- what current gap or dissatisfaction exists?",
    "- what new possibility does the article open?",
    "- what proof makes that believable?",
    "- what value does the click deliver right now?",
    "- what is just process filler and should not lead the ad?",
    "",
    "Important audience-awareness question:",
    "Do not assume readers know the diagnosis term. If the symptom is more recognizable than the diagnosis, recommend symptom-first language.",
    "Outside audience research can inform motivation and angle selection, but do not turn an outside fact into a front-facing ad claim unless the landing page supports it.",
    "",
    `Reader stage: ${readerState.stage}`,
    `Pain brief: functional=${painBrief.functionalPain.join(", ")} | emotional=${painBrief.emotionalPain.join(", ")} | failed_alternatives=${painBrief.failedAlternatives.join(", ")}`,
    "",
    "Outside audience research:",
    ...(audienceResearch?.selected?.length
      ? audienceResearch.selected.map((insight) => `- ${insight.kind}: ${insight.claim} | writer_use=${insight.writerUse} | landing_support_required=${insight.requiresLandingSupportForAdClaim}`)
      : ["(none)"]),
    "",
    "Candidate angles:",
    ...(angleOutput?.angles || []).map((angle) => `- ${angle.name}: ${angle.hook} | ${angle.promise}`),
    "",
    "Article evidence:",
    ...envelope.evidenceSentences.map((sentence) => `- ${sentence}`),
    "",
    "Unsupported or dangerous phrase families:",
    ...(envelope.unsupportedRiskPhrases.length ? envelope.unsupportedRiskPhrases.map((item) => `- ${item}`) : ["(none)"]),
    "",
    "Full article text:",
    article
  ].join("\n");

  try {
    const raw = await generateText({
      system: "You create grounded persuasion briefs for ad writers. Be selective, concrete, and honest. Prefer symptom language over diagnosis language when that will make the copy more relatable without losing accuracy.",
      prompt,
      temperature: 0.2,
      maxTokens: 1800,
      model: process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5",
      textFormat: articleDistillationSchema()
    });
    const parsed = JSON.parse(raw);
    return {
      station: "article_distillation",
      version: META_POLICY_HARNESS_VERSION,
      ...parsed
    };
  } catch {
    return distillationFallback(bundle, envelope, painBrief);
  }
}

function generateAngles(bundle) {
  const article = articleBlob(bundle).toLowerCase();
  const topic = article.includes("sleep apnea") ? "sleep apnea" : article.includes("diabetes") ? "diabetes" : "this condition";
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
    `Researchers are reviewing qualified adults for current ${topic}. See participation details and next steps.`
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

function buildRewriteRepairPrompt(raw, field) {
  return [
    `The previous response did not satisfy the required JSON schema for ${TARGET_REWRITE_VARIANT_COUNT} ad variants.`,
    "Rewrite and repair it now.",
    "Return JSON only.",
    `Return exactly ${TARGET_REWRITE_VARIANT_COUNT} variants.`,
    `Each variant must include \"${field}\" and may include transcript, primaryText, headline, description, and cta when relevant.`,
    "Do not add markdown fences.",
    "",
    "Previous invalid output:",
    raw || "(empty)",
    "",
    "Required JSON shape:",
    '{"variants":[{"label":"Option 1","rationale":"...","transcript":"","primaryText":"","headline":"","description":"","cta":""}]}'
  ].join("\n");
}

function rewriteResponseSchema() {
  return {
    type: "json_schema",
    name: "rewrite_variants",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        variants: {
          type: "array",
          minItems: TARGET_REWRITE_VARIANT_COUNT,
          maxItems: TARGET_REWRITE_VARIANT_COUNT,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              rationale: { type: "string" },
              transcript: { type: "string" },
              primaryText: { type: "string" },
              headline: { type: "string" },
              description: { type: "string" },
              cta: { type: "string" }
            },
            required: ["label", "rationale", "transcript", "primaryText", "headline", "description", "cta"]
          }
        }
      },
      required: ["variants"]
    }
  };
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
  let parsed = null;
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

async function generateText({ system, prompt, temperature = 0.3, maxTokens = 1800, model: requestedModel, textFormat }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const model = requestedModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const input = system ? `System:\n${system}\n\nUser:\n${prompt}` : prompt;
  const body = { model, input, max_output_tokens: maxTokens };
  if (!/^gpt-5($|-)/.test(model)) {
    body.temperature = temperature;
  }
  if (textFormat) {
    body.text = { format: textFormat };
  }

  const call = async (payload) =>
    fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

  let response = await call(body);
  if (!response.ok && body.temperature !== undefined) {
    delete body.temperature;
    response = await call(body);
  }
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const contentText = (payload.output || [])
    .flatMap((item) => item?.content || [])
    .map((item) => item?.text)
    .find((value) => typeof value === "string" && String(value).trim());
  return String(contentText || "").trim();
}

function groundedPolicyAnswerSchema() {
  return {
    type: "json_schema",
    name: "grounded_policy_answer",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        supported: { type: "boolean" },
        answer: { type: "string" },
        caveats: {
          type: "array",
          items: { type: "string" }
        },
        citations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              relevance: { type: "string" }
            },
            required: ["title", "url", "relevance"]
          }
        }
      },
      required: ["supported", "answer", "caveats", "citations"]
    }
  };
}

async function answerPolicyQuestion(question, contextText = "") {
  const combined = [normalizeText(question), normalizeText(contextText)].filter(Boolean).join("\n");
  const officialPolicySupport = findOfficialPolicySupport(combined, 6);
  if (!officialPolicySupport.matches.length) {
    return {
      station: "policy_answer",
      version: META_POLICY_HARNESS_VERSION,
      supported: false,
      answer: "The current official Meta policy corpus in this system does not contain enough directly relevant evidence to answer this confidently.",
      caveats: ["No sufficiently relevant official policy chunks were retrieved."],
      citations: [],
      officialPolicySupport
    };
  }
  const prompt = [
    `Question: ${normalizeText(question)}`,
    contextText ? `Context: ${normalizeText(contextText)}` : null,
    "",
    "Use only the official policy evidence below. Do not infer beyond it. If the evidence is insufficient, say so plainly.",
    "",
    "Official policy evidence:",
    ...officialPolicySupport.matches.map((match) => `- ${match.title} | ${match.url} | ${match.text}`)
  ].filter(Boolean).join("\n");
  const system = "You answer Meta policy questions using only the supplied official policy evidence. Never add unsupported claims. Always be explicit about uncertainty.";
  const raw = await generateText({
    system,
    prompt,
    temperature: 0.1,
    maxTokens: 900,
    textFormat: groundedPolicyAnswerSchema()
  });
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      supported: false,
      answer: "The grounded answer generator failed to return a parseable response.",
      caveats: ["Response parsing failed."],
      citations: []
    };
  }
  return {
    station: "policy_answer",
    version: META_POLICY_HARNESS_VERSION,
    ...parsed,
    officialPolicySupport
  };
}

function buyerLaunchJudgeSchema() {
  return {
    type: "json_schema",
    name: "media_buyer_peer_review",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        evaluations: {
          type: "array",
          minItems: TARGET_REWRITE_VARIANT_COUNT,
          maxItems: TARGET_REWRITE_VARIANT_COUNT,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              hookStrength: { type: "integer", minimum: 1, maximum: 10 },
              stopPower: { type: "integer", minimum: 1, maximum: 10 },
              actionPressure: { type: "integer", minimum: 1, maximum: 10 },
              novelty: { type: "integer", minimum: 1, maximum: 10 },
              buyerConfidence: { type: "integer", minimum: 1, maximum: 10 },
              patternInterrupt: { type: "integer", minimum: 1, maximum: 10 },
              messageMarketMatch: { type: "integer", minimum: 1, maximum: 10 },
              curiosityTension: { type: "integer", minimum: 1, maximum: 10 },
              expectationAlignment: { type: "integer", minimum: 1, maximum: 10 },
              believability: { type: "integer", minimum: 1, maximum: 10 },
              exactStopMoment: { type: "string" },
              firstThought: { type: "string" },
              formedQuestion: { type: "string" },
              expectedClickOutcome: { type: "string" },
              expectationBreak: { type: "string" },
              biggestWeakness: { type: "string" },
              missedAngle: { type: "string" },
              systemYieldScore: { type: "integer", minimum: 0, maximum: 100 },
              verdict: { type: "string" },
              whyLikelyToWork: {
                type: "array",
                items: { type: "string" }
              },
              whyLikelyToLose: {
                type: "array",
                items: { type: "string" }
              },
              strongerAlternativeHint: { type: "string" },
              nextRoundIdeas: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: [
              "label",
              "hookStrength",
              "stopPower",
              "actionPressure",
              "novelty",
              "buyerConfidence",
              "patternInterrupt",
              "messageMarketMatch",
              "curiosityTension",
              "expectationAlignment",
              "believability",
              "exactStopMoment",
              "firstThought",
              "formedQuestion",
              "expectedClickOutcome",
              "expectationBreak",
              "biggestWeakness",
              "missedAngle",
              "systemYieldScore",
              "verdict",
              "whyLikelyToWork",
              "whyLikelyToLose",
              "strongerAlternativeHint",
              "nextRoundIdeas"
            ]
          }
        }
      },
      required: ["evaluations"]
    }
  };
}

async function judgeVariantsForLaunch(variants, bundle, envelope, painBrief) {
  const model = process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5";
  const articleEvidence = envelope?.evidenceSentences || [];
  const painSummary = [
    `Functional pain: ${painBrief.functionalPain.join(", ")}`,
    `Emotional pain: ${painBrief.emotionalPain.join(", ")}`,
    `Failed alternatives: ${painBrief.failedAlternatives.join(", ")}`,
    `Desired outcome: ${painBrief.desiredOutcome.join(", ")}`
  ].join("\n");
  const prompt = [
    "You are an elite direct-response media buyer reviewing Facebook ad rewrite options.",
    "Judge ads like a physicist looking at a system: does intent energy flow cleanly from impression to click, or does it dissipate as friction?",
    "Use this chain: Impression -> Pattern Interrupt -> Relevance Match -> Curiosity Gap -> Click -> Expectation Match -> Conversion.",
    "If any major variable is weak, the system yield collapses.",
    "Be harsh on weak hooks, poor message-market match, low curiosity tension, expectation mismatch, and compliance-mush language.",
    "Do not judge policy here. Judge launch-worthiness, system yield, and media-buyer quality only.",
    "",
    "Landing evidence:",
    ...articleEvidence.map((line) => `- ${line}`),
    "",
    "Pain summary:",
    painSummary,
    "",
    "Variants:",
    ...variants.map((variant) => [
      `Label: ${variant.label}`,
      `Transcript: ${variant.transcript || ""}`,
      `Primary text: ${variant.primaryText || ""}`,
      `Headline: ${variant.headline || ""}`,
      `Description: ${variant.description || ""}`,
      `CTA: ${variant.cta || ""}`
    ].join("\n"))
  ].join("\n");

  const system = [
    "You judge launch-worthiness like a top media buyer.",
    "Evaluate each variant on the five core variables:",
    "1. hook strength / pattern interrupt",
    "2. message-market match",
    "3. curiosity tension",
    "4. expectation alignment",
    "5. believability",
    "Also score practical buyer variables already in use: stop power, action pressure, novelty, buyer confidence.",
    "Answer these exactly for each ad:",
    "- what exact moment makes someone stop?",
    "- what exact thought enters their head?",
    "- what question is formed?",
    "- what do they expect after clicking?",
    "- where does expectation break?",
    "Punish generic, broad, over-polished, or process-led copy.",
    "Reward sharp pain, specific tension, believable intrigue, and clean expectation transfer."
  ].join(" ");
  const raw = await generateText({
    system,
    prompt,
    temperature: 0.2,
    maxTokens: 1600,
    model,
    textFormat: buyerLaunchJudgeSchema()
  });
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.evaluations) ? parsed.evaluations : [];
  } catch {
    return [];
  }
}

function buildPeerReviewRefinementBrief(ranking) {
  const rejected = Array.isArray(ranking?.rejected) ? ranking.rejected.slice(0, 3) : [];
  const commonWeaknesses = unique(
    rejected
      .flatMap((item) => [
        item.mediaBuyerPeerReview?.biggestWeakness,
        item.mediaBuyerPeerReview?.expectationBreak,
        ...(item.mediaBuyerPeerReview?.whyLikelyToLose || [])
      ])
      .filter(Boolean)
  ).slice(0, 6);
  const missedAngles = unique(rejected.map((item) => item.mediaBuyerPeerReview?.missedAngle).filter(Boolean)).slice(0, 4);
  const strongerAlternativeHints = unique(rejected.map((item) => item.mediaBuyerPeerReview?.strongerAlternativeHint).filter(Boolean)).slice(0, 4);
  const nextRoundIdeas = unique(rejected.flatMap((item) => item.mediaBuyerPeerReview?.nextRoundIdeas || []).filter(Boolean)).slice(0, 6);
  const exactStopMoments = unique(rejected.map((item) => item.mediaBuyerPeerReview?.exactStopMoment).filter(Boolean)).slice(0, 3);
  const strongestRejectedVariants = rejected.map((item) => ({
    label: item.variant?.label,
    primaryText: item.variant?.primaryText || "",
    headline: item.variant?.headline || "",
    description: item.variant?.description || "",
    biggestWeakness: item.mediaBuyerPeerReview?.biggestWeakness || "",
    missedAngle: item.mediaBuyerPeerReview?.missedAngle || "",
    strongerAlternativeHint: item.mediaBuyerPeerReview?.strongerAlternativeHint || ""
  }));

  return {
    station: "media_buyer_refinement_brief",
    version: META_POLICY_HARNESS_VERSION,
    commonWeaknesses,
    missedAngles,
    strongerAlternativeHints,
    nextRoundIdeas,
    exactStopMoments,
    strongestRejectedVariants,
    summary: [
      ...(commonWeaknesses.length ? [`Common weaknesses: ${commonWeaknesses.join(" | ")}`] : []),
      ...(missedAngles.length ? [`Missed angles: ${missedAngles.join(" | ")}`] : []),
      ...(nextRoundIdeas.length ? [`Next round ideas: ${nextRoundIdeas.join(" | ")}`] : [])
    ]
  };
}

function rankingMaxSystemYield(ranking) {
  const all = [...(ranking?.accepted || []), ...(ranking?.rejected || [])];
  return all.reduce((max, item) => Math.max(max, Number(item?.launchReadiness?.systemYield || 0)), 0);
}

function shouldTriggerRewriteRefinement(rewriteStation, ranking, hookConstruction = null) {
  if (!rewriteStation || rewriteStation.writerMode !== "llm") return false;
  const viableHooks = (hookConstruction?.reviewedHooks || []).filter((hook) => hook.passes);
  if (viableHooks.length > 0) return false;
  const acceptedCount = Number(ranking?.accepted?.length || 0);
  const maxYield = rankingMaxSystemYield(ranking);
  return acceptedCount === 0 || maxYield < 18;
}

function choosePreferredRanking(initialRanking, refinedRanking) {
  const initialAccepted = Number(initialRanking?.accepted?.length || 0);
  const refinedAccepted = Number(refinedRanking?.accepted?.length || 0);
  if (refinedAccepted > initialAccepted) return "refined";
  if (refinedAccepted < initialAccepted) return "initial";
  return rankingMaxSystemYield(refinedRanking) > rankingMaxSystemYield(initialRanking) ? "refined" : "initial";
}

function hookBlueprintSchema() {
  return {
    type: "json_schema",
    name: "hook_blueprints",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        hooks: {
          type: "array",
          minItems: TARGET_REWRITE_VARIANT_COUNT,
          maxItems: TARGET_REWRITE_VARIANT_COUNT,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              route: { type: "string" },
              stopMoment: { type: "string" },
              painStatement: { type: "string" },
              openLoop: { type: "string" },
              expectedClickOutcome: { type: "string" },
              headlineAngle: { type: "string" },
              rationale: { type: "string" }
            },
            required: ["label", "route", "stopMoment", "painStatement", "openLoop", "expectedClickOutcome", "headlineAngle", "rationale"]
          }
        }
      },
      required: ["hooks"]
    }
  };
}

async function constructHookBlueprints(bundle, envelope, readerState, painBrief, angleOutput, articleDistillation, conceptOutput, audienceResearch) {
  const model = process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5";
  const prompt = [
    "Build 3 hook blueprints for a Meta ad rewrite system.",
    "Each blueprint must create a stop moment before the ad body is written.",
    "Use these exact routes:",
    "- Option 1: failed_alternative",
    "- Option 2: symptom_first",
    "- Option 3: new_possibility",
    "",
    `Reader awareness stage: ${readerState.stage}`,
    `Diagnosis awareness: ${articleDistillation?.audienceAwareness?.diagnosisAwareness || "mixed"}`,
    `Language strategy: ${articleDistillation?.audienceAwareness?.languageStrategy || "mixed"}`,
    "",
    "Pain brief:",
    `- Functional pain: ${painBrief.functionalPain.join(", ")}`,
    `- Emotional pain: ${painBrief.emotionalPain.join(", ")}`,
    `- Failed alternatives: ${painBrief.failedAlternatives.join(", ")}`,
    `- Desired outcome: ${painBrief.desiredOutcome.join(", ")}`,
    "",
    "Article distillation:",
    `- Core problem: ${articleDistillation?.coreProblem || "(none)"}`,
    `- Pain points: ${(articleDistillation?.painPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Gap points: ${(articleDistillation?.gapPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- New possibility points: ${(articleDistillation?.newPossibilityPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Proof points: ${(articleDistillation?.proofPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Click value points: ${(articleDistillation?.clickValuePoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Strongest angles: ${(articleDistillation?.strongestAngles || []).join(" | ") || "(none)"}`,
    "",
    "Available copy angles:",
    ...(angleOutput?.angles || []).map((angle) => `- ${angle.name}: ${angle.hook} | ${angle.promise}`),
    "",
    "Audience research:",
    ...(audienceResearch?.selected?.length
      ? audienceResearch.selected.map((insight) => `- ${insight.claim} | writer_use=${insight.writerUse}`)
      : ["(none)"]),
    "",
    "Selected concepts:",
    ...(conceptOutput?.selected?.length
      ? conceptOutput.selected.map((concept) => `- ${concept.name}: ${concept.principle}`)
      : ["(none)"]),
    "",
    "Landing evidence:",
    ...envelope.evidenceSentences.map((sentence) => `- ${sentence}`),
    "",
    "Rules:",
    "- Do not mention policy.",
    "- Do not write full ads yet.",
    "- Each stopMoment must be sharp, human, and specific enough to interrupt the feed.",
    "- Each openLoop must create curiosity without overpromising.",
    "- expectedClickOutcome must match what the landing page really gives.",
    "- If diagnosis awareness is mixed, prefer symptom-first language unless failed-alternative framing is stronger."
  ].join("\n");

  const raw = await generateText({
    system: "You construct high-performance hook blueprints for direct-response ads. Be concrete, specific, and psychologically precise.",
    prompt,
    temperature: 0.4,
    maxTokens: 1600,
    model,
    textFormat: hookBlueprintSchema()
  });

  let hooks = [];
  try {
    hooks = JSON.parse(raw)?.hooks || [];
  } catch {
    hooks = [];
  }

  return {
    station: "hook_construction",
    version: META_POLICY_HARNESS_VERSION,
    hooks: hooks.map((hook, index) => ({
      label: typeof hook?.label === "string" ? hook.label : `Option ${index + 1}`,
      route: normalizeText(hook?.route),
      stopMoment: normalizeText(hook?.stopMoment),
      painStatement: normalizeText(hook?.painStatement),
      openLoop: normalizeText(hook?.openLoop),
      expectedClickOutcome: normalizeText(hook?.expectedClickOutcome),
      headlineAngle: normalizeText(hook?.headlineAngle),
      rationale: normalizeText(hook?.rationale)
    })).filter((hook) => hook.stopMoment && hook.openLoop)
  };
}

function hookBlueprintsToVariants(hooks) {
  return (hooks || []).map((hook) => ({
    label: hook.label,
    transcript: "",
    primaryText: [hook.stopMoment, hook.openLoop].filter(Boolean).join(" ").trim(),
    headline: hook.headlineAngle || "",
    description: hook.expectedClickOutcome || "",
    cta: "Learn More"
  }));
}

function scoreTokenOverlap(tokens, text) {
  const lower = normalizeText(text).toLowerCase();
  return unique(tokens).filter((token) => lower.includes(token)).length;
}

function hookRoute(route) {
  const normalized = normalizeText(route).toLowerCase();
  if (normalized.includes("failed")) return "failed_alternative";
  if (normalized.includes("symptom")) return "symptom_first";
  if (normalized.includes("possibility")) return "new_possibility";
  return normalized || "general";
}

function hookPasses(review) {
  return (
    Number(review.systemYieldScore || 0) >= 30 &&
    Number(review.hookStrength || 0) >= 6 &&
    Number(review.messageMarketMatch || 0) >= 6 &&
    Number(review.expectationAlignment || 0) >= 6 &&
    Number(review.believability || 0) >= 6
  );
}

function heuristicHookReview(hook, bundle, envelope, painBrief) {
  const text = `${hook.stopMoment} ${hook.painStatement} ${hook.openLoop}`.trim();
  const lower = text.toLowerCase();
  const article = articleBlob(bundle).toLowerCase();
  const route = hookRoute(hook.route);
  const painTokens = unique(
    [...painBrief.functionalPain, ...painBrief.emotionalPain, ...painBrief.failedAlternatives]
      .flatMap((item) => significantTokens(item))
  );
  const supportedTerms = Array.isArray(envelope?.supportedTerms) ? envelope.supportedTerms : [];
  const evidenceText = Array.isArray(envelope?.evidenceSentences) ? envelope.evidenceSentences.join(" ") : "";
  const supportTokens = unique([...supportedTerms, ...significantTokens(evidenceText)]).slice(0, 40);
  const painHits = scoreTokenOverlap(painTokens, lower);
  const supportHits = scoreTokenOverlap(supportTokens, `${hook.expectedClickOutcome} ${hook.openLoop}`);
  const specificityHits = (lower.match(/\b(cpap|mask|oral|device|mouthpiece|surgery|surgical|drained|tired|exhausted|restless|sleep|treatment|options?)\b/g) || []).length;
  const frustrationHits = (lower.match(/\b(still|again|wrestling|frustrated|stuck|drained|tired|exhausted|restless|hard to|difficult)\b/g) || []).length;
  const newPossibilityHits = (lower.match(/\b(new|different|alternative|other|what else|being tested|studied|exploring|options?)\b/g) || []).length;
  const routeBonus =
    route === "failed_alternative" && /\b(cpap|mask|usual|standard|fixes|options?)\b/.test(lower) ? 2 :
    route === "symptom_first" && /\b(tired|drained|restless|waking|sleep)\b/.test(lower) ? 2 :
    route === "new_possibility" && /\b(new|different|other|what else|being tested|exploring)\b/.test(lower) ? 2 :
    0;
  const hookStrength = Math.min(10, 4 + Math.min(3, painHits) + Math.min(2, specificityHits > 0 ? 2 : 0) + Math.min(2, routeBonus));
  const stopPower = Math.min(10, 4 + (/\?/.test(hook.stopMoment) ? 1 : 0) + Math.min(2, specificityHits) + Math.min(2, frustrationHits > 0 ? 2 : 0) + (hook.stopMoment.length <= 95 ? 1 : 0));
  const actionPressure = Math.min(10, 3 + (/\b(now|right now|today|find out|see|look)\b/.test(lower) ? 2 : 0) + (/\?/.test(hook.openLoop) ? 1 : 0) + (supportHits >= 2 ? 1 : 0));
  const novelty = Math.min(10, 3 + Math.min(4, newPossibilityHits));
  const buyerConfidence = Math.min(10, 4 + Math.min(3, supportHits) + (!/\b(guaranteed|breakthrough|elite|groundbreaking)\b/.test(lower) ? 1 : 0));
  const patternInterrupt = Math.min(10, stopPower + (frustrationHits > 0 ? 1 : 0));
  const messageMarketMatch = Math.min(10, 4 + Math.min(3, painHits) + (frustrationHits > 0 ? 1 : 0) + (routeBonus > 0 ? 1 : 0));
  const curiosityTension = Math.min(10, 4 + (/\b(what else|what|how|before you|see what|find out)\b/.test(lower) ? 2 : 0) + Math.min(2, newPossibilityHits) + (/\b(still|even after)\b/.test(lower) ? 1 : 0));
  const expectationAlignment = Math.min(10, 4 + Math.min(4, supportHits) + (article.includes((hook.expectedClickOutcome || "").toLowerCase()) ? 1 : 0));
  const believability = Math.min(10, 5 + (!/\b(guaranteed|breakthrough|elite|groundbreaking)\b/.test(lower) ? 2 : -1));
  const multiplicativeCore = [hookStrength, messageMarketMatch, curiosityTension, expectationAlignment, believability]
    .reduce((product, score) => product * score / 10, 1);
  const systemYieldScore = Math.round(multiplicativeCore * 100);
  return {
    label: hook.label,
    hookStrength,
    stopPower,
    actionPressure,
    novelty,
    buyerConfidence,
    patternInterrupt,
    messageMarketMatch,
    curiosityTension,
    expectationAlignment,
    believability,
    exactStopMoment: hook.stopMoment,
    firstThought: hook.painStatement || "This sounds like my problem.",
    formedQuestion: hook.openLoop || "What does the click show me?",
    expectedClickOutcome: hook.expectedClickOutcome || "",
    expectationBreak: expectationAlignment < 6 ? "The promised click outcome may not be explicit enough or may drift from the article." : "",
    biggestWeakness: hookStrength < 7 ? "The hook needs sharper pain or specificity." : "Could be more urgent or surprising.",
    missedAngle: /\bcpap\b/.test(lower) ? "Could mention a more specific new possibility." : "Could directly call out the failed alternative more sharply.",
    systemYieldScore,
    verdict: systemYieldScore >= 30 ? "Strong hook candidate." : "Borderline hook; may need more specificity or tension.",
    whyLikelyToWork: [
      painHits > 0 ? "Connects to a known reader pain point." : "Creates a broad problem statement.",
      specificityHits > 0 ? "Uses concrete detail instead of generic category language." : "Leaves room for clearer specifics.",
      supportHits >= 2 ? "Expected click outcome stays close to what the landing page actually provides." : "Could make the click payoff more concrete."
    ],
    whyLikelyToLose: [
      hookStrength < 7 ? "Not sharp enough to guarantee a stop." : "Could still be more urgent.",
      expectationAlignment < 6 ? "Expected click outcome may not feel precise enough." : "Expectation alignment is acceptable but not perfect."
    ],
    strongerAlternativeHint: hookStrength < 7 ? "Increase specificity in the stop moment." : "Add a stronger new-possibility tease.",
    nextRoundIdeas: [
      "Sharpen the first line around one vivid frustration.",
      "Make the click outcome more concrete and immediate."
    ]
  };
}

async function evaluateHookBlueprints(hookConstruction, bundle, envelope, painBrief) {
  const reviewedHooks = (hookConstruction?.hooks || []).map((hook) => {
    const review = heuristicHookReview(hook, bundle, envelope, painBrief);
    const score = buyerLaunchScore(review);
    return {
      ...hook,
      mediaBuyerPeerReview: review,
      passes: hookPasses(review),
      systemYield: review.systemYieldScore
    };
  });
  return {
    ...hookConstruction,
    reviewedHooks,
    selectedHooks: reviewedHooks
      .slice()
      .sort((a, b) => (b.systemYield || 0) - (a.systemYield || 0))
      .slice(0, TARGET_REWRITE_VARIANT_COUNT)
  };
}

async function generateRewriteVariants(bundle, judge, envelope, readerState, painBrief, angleOutput, articleDistillation, hookConstruction, conceptOutput, audienceResearch, historicalRejects, officialPolicySupport, refinementBrief = null) {
  const field = selectPrimaryRewriteField(bundle);
  const forbidden = buildForbiddenPhraseList(bundle, judge, envelope);
  const combinedOriginal = SURFACE_KEYS.map((key) => bundle[key]).filter(Boolean).join("\n");
  const writerModel = process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5";
  const system = [
    "You are a world-class direct-response ad writer working in a Halbert-inspired style.",
    "Write with one sharp idea, concrete specificity, plain language, pain relevance, curiosity, and believability.",
    "You are not allowed to imply personal attributes, overpromise outcomes, add unsupported claims, or use spammy/scammy language.",
    "Your job is to move black-risk copy into strong grey-risk copy while preserving interest.",
    "Start from the reader tension first, not from the study mechanics.",
    "Think like an elite media buyer: create a real stop moment, preserve expectation alignment, and make the click feel worth it immediately.",
    "Return JSON only."
  ].join(" ");
  const prompt = [
    `Harness version: ${META_POLICY_HARNESS_VERSION}`,
    `Writer prompt version: ${META_POLICY_WRITER_PROMPT_VERSION}`,
    `Target risk band: ${bundle.targetBand}`,
    `Primary field to rewrite: ${field}`,
    `Reader awareness stage: ${readerState.stage}`,
    `Diagnosis awareness: ${articleDistillation?.audienceAwareness?.diagnosisAwareness || "mixed"}`,
    `Language strategy: ${articleDistillation?.audienceAwareness?.languageStrategy || "mixed"}`,
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
    "Most similar historical rejects:",
    ...(historicalRejects?.matches?.length
      ? historicalRejects.matches.slice(0, 3).map((match) => `- Similarity ${match.similarityScore}: copy=\"${match.observedCopy}\" reason=\"${match.reason}\" policy=\"${match.policy}\" matched_terms=\"${match.matchedTerms.join(", ")}\"`)
      : ["(none found)"]),
    "",
    "Relevant official Meta policy support:",
    ...(officialPolicySupport?.matches?.length
      ? officialPolicySupport.matches.slice(0, 3).map((match) => `- ${match.title}: ${match.text} (url=${match.url})`)
      : ["(none found)"]),
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
    "Article distillation:",
    `- Core problem: ${articleDistillation?.coreProblem || "(none)"}`,
    `- Awareness rationale: ${articleDistillation?.audienceAwareness?.rationale || "(none)"}`,
    `- Pain points: ${(articleDistillation?.painPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Gap points: ${(articleDistillation?.gapPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- New possibility points: ${(articleDistillation?.newPossibilityPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Proof points: ${(articleDistillation?.proofPoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Click value points: ${(articleDistillation?.clickValuePoints || []).map((item) => item.point).join(" | ") || "(none)"}`,
    `- Process filler to avoid leading with: ${(articleDistillation?.processFillerPoints || []).join(" | ") || "(none)"}`,
    `- Strongest angles from article: ${(articleDistillation?.strongestAngles || []).join(" | ") || "(none)"}`,
    `- Unsafe temptations: ${(articleDistillation?.unsafeTemptations || []).join(" | ") || "(none)"}`,
    "",
    "Available copy angles:",
    ...angleOutput.angles.map((angle) => `- ${angle.name}: hook="${angle.hook}" promise="${angle.promise}"`),
    "",
    "Approved hook blueprints to expand into full ads:",
    ...((hookConstruction?.selectedHooks || hookConstruction?.hooks || []).map((hook) =>
      `- ${hook.label} | route=${hook.route} | stop_moment="${hook.stopMoment}" | pain="${hook.painStatement}" | open_loop="${hook.openLoop}" | click_outcome="${hook.expectedClickOutcome}" | headline_angle="${hook.headlineAngle}"`)),
    "",
    "Selected modern copy concepts:",
    ...(conceptOutput?.selected?.length
      ? conceptOutput.selected.map((concept) => `- ${concept.name}: principle="${concept.principle}" use_when="${(concept.useWhen || []).join(" | ")}" guardrails="${(concept.policyGuardrails || []).join(" | ")}"`)
      : ["(none selected)"]),
    "",
    "Outside audience research:",
    ...(audienceResearch?.selected?.length
      ? audienceResearch.selected.map((insight) => `- ${insight.claim} | writer_use=${insight.writerUse} | requires_landing_support=${insight.requiresLandingSupportForAdClaim} | guidance=${insight.safeUseGuidance}`)
      : ["(none selected)"]),
    "",
    "Previous media-buyer peer review failures to fix:",
    ...(refinementBrief
      ? [
          ...(refinementBrief.summary || []),
          ...(refinementBrief.strongestRejectedVariants || []).map((item) => `- ${item.label}: primary="${item.primaryText}" weakness="${item.biggestWeakness}" missed_angle="${item.missedAngle}" stronger_hint="${item.strongerAlternativeHint}"`)
        ]
      : ["(none)"]),
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
    `- Return exactly ${TARGET_REWRITE_VARIANT_COUNT} variants.`,
    "- Build each variant from its corresponding hook blueprint rather than inventing a completely different angle.",
    "- Treat the whole Facebook creative array as one coordinated system with one dominant idea.",
    "- The transcript/primary text carries the stop moment and open loop. It should usually be 1-2 sentences, not a mini-article.",
    "- The headline sharpens or titles the same idea. It must not introduce a new major claim.",
    "- The description only supports the expected click outcome. It must not add a second persuasion angle.",
    "- Keep the CTA plain and short.",
    "- Each variant must feel like a complete launch-ready ad bundle, not a partial copy note.",
    "- Keep each variant believable and congruent with the landing article.",
    "- Use curiosity, clarity, specificity, self-interest, and action pressure without hype.",
    "- The first line must create a precise stop moment, not just a generic topic statement.",
    "- Balance curiosity with clarity: enough tension to earn the click, enough specificity to stay believable.",
    "- Preserve expectation alignment so the click feels like it leads exactly to the promised next step.",
    "- Do not cram pain, possibility, qualification, compensation, and process into the same field.",
    "- The user should feel a reason to click now, not just understand the topic better.",
    "- Do not lead with process language like eligibility, screening, participation steps, or study mechanics unless it is secondary to the hook.",
    "- The reader should care about the problem or possibility first, and the study second.",
    "- If diagnosis awareness is low or mixed, prefer symptom-first or frustration-first language unless diagnosis language is clearly the stronger honest choice.",
    "- You may use outside audience research to understand motives and choose angles, but you must not turn outside research into a front-facing claim unless the landing page supports it.",
    "- Do not include any forbidden phrase or close paraphrase that implies the same risky meaning.",
    "- If a field is not provided in the original, leave it empty.",
    "- The rewritten primary field must be the strongest persuasive grey-risk version, not a whitewashed compliance-only line.",
    "- Aim for compact bundle lengths: primary/transcript under about 180 characters when possible, headline under about 65 characters, description under about 100 characters.",
    "- Boring copy fails. If the line sounds like informational filler, rewrite it.",
    "",
    'Return JSON with this shape:',
    '{"variants":[{"label":"Option 1","rationale":"...","transcript":"","primaryText":"","headline":"","description":"","cta":""}]}'
  ].join("\n");
  let variants = [];
  let attempts = 0;
  let lastRaw = "";
  while (attempts < 3 && variants.length !== TARGET_REWRITE_VARIANT_COUNT) {
    attempts += 1;
    const raw = await generateText({
      system,
      prompt: attempts === 1 ? prompt : buildRewriteRepairPrompt(lastRaw, field),
      temperature: attempts === 1 ? 0.6 : 0.2,
      maxTokens: 1800,
      model: writerModel,
      textFormat: rewriteResponseSchema()
    });
    lastRaw = raw;
    variants = parseRewriteResponse(raw, field);
  }
  if (variants.length !== TARGET_REWRITE_VARIANT_COUNT) {
    variants = fallbackRewriteVariants(bundle, field, envelope);
    return {
      station: "rewrite",
      version: META_POLICY_WRITER_PROMPT_VERSION,
      writerMode: "fallback",
      attempts,
      copywriterConcepts: conceptOutput || null,
      variants
    };
  }
  return {
    station: "rewrite",
    version: META_POLICY_WRITER_PROMPT_VERSION,
    writerMode: "llm",
    attempts,
    copywriterConcepts: conceptOutput || null,
    variants
  };
}

function shouldTriggerBundleCompression(ranking, hookConstruction = null) {
  const viableHooks = (hookConstruction?.reviewedHooks || []).filter((hook) => hook.passes);
  if (!viableHooks.length) return false;
  if (Number(ranking?.accepted?.length || 0) > 0) return false;
  return (ranking?.rejected || []).some((item) =>
    (item?.launchReadiness?.status === "rewrite_weak_hook" || item?.launchReadiness?.status === "rewrite_boring")
  );
}

async function compressRewriteVariants(bundle, envelope, hookConstruction, ranking) {
  const writerModel = process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5";
  const variants = [...(ranking?.accepted || []), ...(ranking?.rejected || [])]
    .map((item) => item?.variant)
    .filter(Boolean)
    .slice(0, TARGET_REWRITE_VARIANT_COUNT);
  if (variants.length !== TARGET_REWRITE_VARIANT_COUNT) {
    return null;
  }
  const prompt = [
    "Rewrite these Facebook ad bundles into tighter hook-locked versions.",
    "Do not invent new angles. Preserve the same thesis and the same hook blueprint for each option.",
    "Your job is compression, not exploration.",
    "",
    "Landing evidence:",
    ...envelope.evidenceSentences.map((sentence) => `- ${sentence}`),
    "",
    "Approved hook blueprints:",
    ...((hookConstruction?.selectedHooks || hookConstruction?.hooks || []).map((hook) =>
      `- ${hook.label} | stop_moment=\"${hook.stopMoment}\" | open_loop=\"${hook.openLoop}\" | click_outcome=\"${hook.expectedClickOutcome}\" | headline_angle=\"${hook.headlineAngle}\"`
    )),
    "",
    "Variants to compress:",
    ...((ranking?.rejected || []).slice(0, TARGET_REWRITE_VARIANT_COUNT).map((item) => [
      `- ${item.variant?.label}`,
      `  primary=\"${item.variant?.primaryText || ""}\"`,
      `  headline=\"${item.variant?.headline || ""}\"`,
      `  description=\"${item.variant?.description || ""}\"`,
      `  weakness=\"${item.mediaBuyerPeerReview?.biggestWeakness || ""}\"`,
      `  buyer_verdict=\"${item.mediaBuyerPeerReview?.verdict || ""}\"`
    ].join("\n"))),
    "",
    "Compression rules:",
    "- Keep exactly one dominant idea per bundle.",
    "- Primary text: keep the approved stop moment and open loop. Usually 1 sentence, max 2 short sentences.",
    "- Headline: sharpen the same idea only. No new major claim. Prefer under 55 characters.",
    "- Description: click outcome only. Prefer under 85 characters.",
    "- CTA: plain and short.",
    "- Remove filler, hedging, and extra process details.",
    "- Do not add compensation, qualification, urgency theater, or unsupported specifics.",
    "- Stay tightly grounded in the landing evidence.",
    "",
    'Return JSON with this shape:',
    '{"variants":[{"label":"Option 1","rationale":"...","transcript":"","primaryText":"","headline":"","description":"","cta":""}]}'
  ].join("\n");

  const raw = await generateText({
    system: "You compress direct-response ad bundles to preserve hook force, brevity, and landing-page truth. Return JSON only.",
    prompt,
    temperature: 0.2,
    maxTokens: 1400,
    model: writerModel,
    textFormat: rewriteResponseSchema()
  });
  const parsed = parseRewriteResponse(raw, selectPrimaryRewriteField(bundle));
  if (parsed.length !== TARGET_REWRITE_VARIANT_COUNT) {
    return null;
  }
  return {
    station: "bundle_compression",
    version: META_POLICY_HARNESS_VERSION,
    writerMode: "llm",
    variants: parsed
  };
}

function combinedVariantText(variant) {
  return SURFACE_KEYS.map((key) => variant[key] || "").filter(Boolean).join("\n");
}

function canonicalOptionLabel(value) {
  const text = normalizeText(value);
  const match = text.match(/option\s*(\d+)/i);
  return match ? `option_${match[1]}` : text.toLowerCase();
}

function countClaimUnits(text) {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  return normalized
    .split(/(?<=[.!?])\s+|—|;|:\s+|\b(?:and|but|while|including)\b/gi)
    .map((part) => part.trim())
    .filter((part) => part && significantTokens(part).length >= 3)
    .length;
}

function bundleRoleAudit(variant, hookConstruction) {
  const variantKey = canonicalOptionLabel(variant.label);
  const blueprint = (hookConstruction?.selectedHooks || hookConstruction?.hooks || []).find((hook) => canonicalOptionLabel(hook.label) === variantKey) || null;
  const primary = normalizeText(variant.primaryText || variant.transcript || "");
  const headline = normalizeText(variant.headline || "");
  const description = normalizeText(variant.description || "");
  const cta = normalizeText(variant.cta || "");
  const issues = [];
  const notes = [];

  const primaryLength = primary.length;
  const headlineLength = headline.length;
  const descriptionLength = description.length;
  const primaryClaims = countClaimUnits(primary);
  const descriptionClaims = countClaimUnits(description);
  const bundleClaims = countClaimUnits([primary, headline, description].filter(Boolean).join(". "));

  if (primaryLength > 220) issues.push("Primary text is too long for a stop-scroll field.");
  if (headlineLength > 70) issues.push("Headline is too long and likely carrying too much meaning.");
  if (descriptionLength > 120) issues.push("Description is too long and is acting like body copy.");
  if (primaryClaims > 3) issues.push("Primary text contains too many distinct claims or ideas.");
  if (descriptionClaims > 2) issues.push("Description contains too many distinct claims or ideas.");
  if (bundleClaims > 6) issues.push("The creative bundle introduces too many ideas overall.");
  if (cta && cta.length > 20) issues.push("CTA should stay plain and short.");

  if (blueprint) {
    const stopTokens = new Set(significantTokens(blueprint.stopMoment || ""));
    const clickOutcomeTokens = new Set(significantTokens(blueprint.expectedClickOutcome || ""));
    const primaryTokens = new Set(significantTokens(primary));
    const descriptionTokens = new Set(significantTokens(description));
    const stopOverlap = Array.from(stopTokens).filter((token) => primaryTokens.has(token)).length;
    const clickOverlap = Array.from(clickOutcomeTokens).filter((token) => descriptionTokens.has(token)).length;

    if (stopTokens.size > 0 && stopOverlap === 0) {
      issues.push("Primary text drifted away from the approved stop moment.");
    }
    if (description && clickOutcomeTokens.size > 0 && clickOverlap === 0) {
      issues.push("Description does not clearly support the promised click outcome.");
    }
  }

  if (issues.length === 0) {
    notes.push("Bundle roles are disciplined: stop/open-loop in the lead field, click outcome in support fields.");
  }

  return {
    blueprintLabel: blueprint?.label || null,
    primaryLength,
    headlineLength,
    descriptionLength,
    primaryClaims,
    descriptionClaims,
    bundleClaims,
    overpacked: issues.length > 0,
    issues,
    notes
  };
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

function buildCopyReview(variant, boundary, congruence, persuasion) {
  const strengths = [];
  const weaknesses = [];
  const buyerNotes = [];

  if (persuasion.painRelevance >= 4) strengths.push("The copy ties back to reader pain or desired outcome instead of sounding like a sterile process summary.");
  if (persuasion.selfInterest >= 4) strengths.push("The hook gives the reader a self-interested reason to care before the mechanics of the study or offer.");
  if (persuasion.curiosity >= 3) strengths.push("The wording creates curiosity without relying on obvious hype or forced urgency.");
  if (persuasion.clarity >= 3) strengths.push("The message is compact enough to scan quickly in-feed.");
  if (persuasion.credibility >= 4) strengths.push("The language stays believable and avoids obvious hype patterns.");

  if (persuasion.boring) weaknesses.push("The copy reads too process-led or informational, which will likely suppress attention and click intent.");
  if (boundary.overallBand !== "white") weaknesses.push(`The copy still lives in the ${boundary.overallBand.toUpperCase()} risk band, so policy sensitivity remains part of the tradeoff.`);
  if (congruence.softWarnings.length > 0) weaknesses.push(...congruence.softWarnings);
  if (!congruence.supported) weaknesses.push(...congruence.hardViolations);

  if (variant.rationale) buyerNotes.push(variant.rationale);
  if (boundary.review.comboFindings.length > 0) {
    buyerNotes.push(`Watch the combo pattern: ${boundary.review.comboFindings.map((finding) => finding.name).join("; ")}.`);
  }
  const activeSurfaces = boundary.review.surfaceFindings.filter((finding) => finding.active).slice(0, 3).map((finding) => finding.label);
  if (activeSurfaces.length > 0) {
    buyerNotes.push(`Active policy surfaces in this variant: ${activeSurfaces.join(", ")}.`);
  }

  let verdict = "This variant is usable but unremarkable.";
  if (boundary.overallBand === "white" && !persuasion.boring && congruence.supported) {
    verdict = "This variant is clean, believable, and ready for launch.";
  } else if (boundary.overallBand === "grey" && !persuasion.boring && congruence.supported) {
    verdict = "This variant is a strong grey candidate: persuasive enough to test, with risk still visible but controlled.";
  } else if (boundary.overallBand === "black") {
    verdict = "This variant is still too risky to relaunch as written.";
  }

  let launchRecommendation = "Hold for revision.";
  if (boundary.overallBand === "white" && congruence.supported && !persuasion.boring) {
    launchRecommendation = "Launchable as a lower-risk control.";
  } else if (boundary.overallBand === "grey" && congruence.supported && !persuasion.boring) {
    launchRecommendation = "Launchable as an aggressive-but-defensible test cell.";
  } else if (persuasion.boring) {
    launchRecommendation = "Rewrite for stronger pain relevance or curiosity before launch.";
  } else if (!congruence.supported) {
    launchRecommendation = "Do not launch until the claim/landing mismatch is removed.";
  }

  return {
    verdict,
    strengths,
    weaknesses,
    buyerNotes,
    launchRecommendation
  };
}

function buyerEvalMap(evaluations) {
  const map = new Map();
  for (const evaluation of Array.isArray(evaluations) ? evaluations : []) {
    if (evaluation?.label) map.set(canonicalOptionLabel(evaluation.label), evaluation);
  }
  return map;
}

function buyerLaunchScore(evaluation) {
  if (!evaluation) {
    return {
      total: 0,
      systemYield: 0,
      boring: true,
      weakLaunch: true
    };
  }
  const additiveTotal =
    Number(evaluation.hookStrength || 0) +
    Number(evaluation.stopPower || 0) +
    Number(evaluation.actionPressure || 0) +
    Number(evaluation.novelty || 0) +
    Number(evaluation.buyerConfidence || 0);
  const multiplicativeCore = [
    Number(evaluation.hookStrength || 0),
    Number(evaluation.messageMarketMatch || 0),
    Number(evaluation.curiosityTension || 0),
    Number(evaluation.expectationAlignment || 0),
    Number(evaluation.believability || 0)
  ].reduce((product, score) => product * Math.max(0, Math.min(score, 10)) / 10, 1);
  const systemYield = Math.round(multiplicativeCore * 100);
  const total = Math.round((additiveTotal * 1.5) + systemYield);
  return {
    total,
    systemYield,
    boring:
      systemYield < 22 ||
      Number(evaluation.hookStrength || 0) <= 4 ||
      Number(evaluation.patternInterrupt || 0) <= 4 ||
      Number(evaluation.messageMarketMatch || 0) <= 4,
    weakLaunch:
      systemYield < 30 ||
      Number(evaluation.buyerConfidence || 0) <= 5 ||
      Number(evaluation.actionPressure || 0) <= 4 ||
      Number(evaluation.expectationAlignment || 0) <= 5 ||
      Number(evaluation.believability || 0) <= 5
  };
}

function buildLaunchReadiness(boundary, congruence, persuasion, buyerEvaluation) {
  const buyer = buyerLaunchScore(buyerEvaluation);
  let readiness = "hold";
  if (boundary.overallBand === "white" && congruence.supported && !persuasion.boring && !buyer.boring && !buyer.weakLaunch) {
    readiness = "launch_control";
  } else if (boundary.overallBand === "grey" && congruence.supported && !persuasion.boring && !buyer.boring && !buyer.weakLaunch) {
    readiness = "launch_aggressive_grey";
  } else if (buyer.boring || persuasion.boring) {
    readiness = "rewrite_boring";
  } else if (buyer.weakLaunch) {
    readiness = "rewrite_weak_hook";
  } else if (!congruence.supported) {
    readiness = "rewrite_claim_mismatch";
  } else if (boundary.overallBand === "black") {
    readiness = "reject_policy";
  }
  return {
    status: readiness,
    buyerScore: buyer.total,
    systemYield: buyer.systemYield,
    buyerBoring: buyer.boring,
    buyerWeakLaunch: buyer.weakLaunch
  };
}

function mergeBuyerFeedback(copyReview, buyerEvaluation) {
  if (!buyerEvaluation) return copyReview;
  const buyerNotes = [
    ...copyReview.buyerNotes,
    ...(Array.isArray(buyerEvaluation.whyLikelyToWork) ? buyerEvaluation.whyLikelyToWork : []),
    ...(buyerEvaluation.strongerAlternativeHint ? [`Stronger angle: ${buyerEvaluation.strongerAlternativeHint}`] : []),
    ...(buyerEvaluation.exactStopMoment ? [`Stop moment: ${buyerEvaluation.exactStopMoment}`] : []),
    ...(buyerEvaluation.firstThought ? [`First thought: ${buyerEvaluation.firstThought}`] : []),
    ...(buyerEvaluation.formedQuestion ? [`Question formed: ${buyerEvaluation.formedQuestion}`] : []),
    ...(buyerEvaluation.expectedClickOutcome ? [`Expected after click: ${buyerEvaluation.expectedClickOutcome}`] : [])
  ];
  const weaknesses = [
    ...copyReview.weaknesses,
    ...(Array.isArray(buyerEvaluation.whyLikelyToLose) ? buyerEvaluation.whyLikelyToLose : []),
    ...(buyerEvaluation.expectationBreak ? [`Expectation break: ${buyerEvaluation.expectationBreak}`] : []),
    ...(buyerEvaluation.biggestWeakness ? [`Biggest weakness: ${buyerEvaluation.biggestWeakness}`] : []),
    ...(buyerEvaluation.missedAngle ? [`Missed angle: ${buyerEvaluation.missedAngle}`] : [])
  ];
  return {
    ...copyReview,
    buyerNotes: unique(buyerNotes),
    weaknesses: unique(weaknesses),
    buyerJudgment: buyerEvaluation
  };
}

async function rankRewriteVariants(variants, bundle, envelope, painBrief, hookConstruction = null) {
  const buyerEvaluations = await judgeVariantsForLaunch(variants, bundle, envelope, painBrief);
  const buyerByLabel = buyerEvalMap(buyerEvaluations);
  const ranked = variants.map((variant) => {
    const text = combinedVariantText(variant);
    let boundary = scoreMetaAdBoundary(text);
    const officialPolicySupport = findOfficialPolicySupport(text);
    const surfacePolicySupport = buildSurfacePolicySupport(boundary, text);
    const comboPolicyContext = buildComboPolicyContext(boundary, surfacePolicySupport);
    boundary = attachInlinePolicyCitations(boundary, officialPolicySupport, surfacePolicySupport, comboPolicyContext);
    const congruence = auditCongruence(text, bundle, envelope);
    const persuasion = persuasionScore(text, boundary, painBrief);
    const bundleAudit = bundleRoleAudit(variant, hookConstruction);
    const buyerEvaluation = buyerByLabel.get(canonicalOptionLabel(variant.label)) || null;
    const launchReadiness = buildLaunchReadiness(boundary, congruence, persuasion, buyerEvaluation);
    const copyReview = mergeBuyerFeedback(
      buildCopyReview(variant, boundary, congruence, persuasion),
      buyerEvaluation
    );
    const rejectionReasons = [];
    if (boundary.overallBand === "black") rejectionReasons.push("Boundary judge still black.");
    if (!congruence.supported) rejectionReasons.push(...congruence.hardViolations);
    if (persuasion.boring) rejectionReasons.push("Variant is too boring or process-led to earn attention.");
    if (bundleAudit.overpacked) rejectionReasons.push(...bundleAudit.issues);
    if (launchReadiness.buyerBoring) rejectionReasons.push("Buyer judge marked the variant as too weak to stop scroll.");
    if (launchReadiness.buyerWeakLaunch) rejectionReasons.push("Buyer judge marked the variant as too weak to launch.");
    return {
      variant,
      combinedText: text,
      boundary,
      officialPolicySupport,
      surfacePolicySupport,
      comboPolicyContext,
      congruence,
      persuasion,
      bundleAudit,
      buyerEvaluation,
      mediaBuyerPeerReview: buyerEvaluation,
      launchReadiness,
      copyReview,
      accepted: rejectionReasons.length === 0,
      rejectionReasons: unique(rejectionReasons)
    };
  });
  return {
    station: "rank",
    version: META_POLICY_HARNESS_VERSION,
    accepted: ranked.filter((item) => item.accepted).sort((a, b) => (b.launchReadiness.buyerScore + b.persuasion.total) - (a.launchReadiness.buyerScore + a.persuasion.total)),
    rejected: ranked.filter((item) => !item.accepted)
  };
}

async function runMetaPolicyHarness(input) {
  const normalization = normalizeMetaAdBundle(input || {});
  const boundaryJudge = runBoundaryJudge(normalization.bundle);
  const historicalRejects = findSimilarHistoricalRejects(normalization.combinedAdText);
  const officialPolicySupport = findOfficialPolicySupport(normalization.combinedAdText);
  const claimEnvelope = extractClaimEnvelope(normalization.bundle);
  const readerState = inferReaderState(normalization.bundle, claimEnvelope);
  const painBrief = buildPainBrief(normalization.bundle);
  const angles = generateAngles(normalization.bundle);
  const audienceResearch = selectAudienceResearch(normalization.bundle);
  const articleDistillation = await distillArticleForCopywriter(normalization.bundle, claimEnvelope, readerState, painBrief, angles, audienceResearch);
  const baseCopywriterConcepts = selectCopywriterConcepts(normalization.bundle, painBrief, angles);
  const runtimeConceptDistillation = await distillCopywriterConceptNotes(normalization.copywriterConceptNotes);
  const copywriterConcepts = mergeCopywriterConcepts(baseCopywriterConcepts, runtimeConceptDistillation);
  const hookConstruction = await evaluateHookBlueprints(
    await constructHookBlueprints(normalization.bundle, claimEnvelope, readerState, painBrief, angles, articleDistillation, copywriterConcepts, audienceResearch),
    normalization.bundle,
    claimEnvelope,
    painBrief
  );
  const rewriteRequired = boundaryJudge.gate.rewriteRequired || input.forceRewrite === true;
  if (!rewriteRequired) {
    return {
      normalization,
      boundaryJudge,
      historicalRejects,
      officialPolicySupport,
      claimEnvelope,
      readerState,
      painBrief,
      angles,
      audienceResearch,
      articleDistillation,
      hookConstruction,
      copywriterConcepts,
      rewriteStation: null,
      rewriteRefinement: null,
      ranking: null
    };
  }
  let rewriteStation = await generateRewriteVariants(normalization.bundle, boundaryJudge, claimEnvelope, readerState, painBrief, angles, articleDistillation, hookConstruction, copywriterConcepts, audienceResearch, historicalRejects, officialPolicySupport);
  let ranking = await rankRewriteVariants(rewriteStation.variants, normalization.bundle, claimEnvelope, painBrief, hookConstruction);
  let rewriteRefinement = null;
  if (shouldTriggerRewriteRefinement(rewriteStation, ranking, hookConstruction)) {
    const refinementBrief = buildPeerReviewRefinementBrief(ranking);
    const refinedRewriteStation = await generateRewriteVariants(
      normalization.bundle,
      boundaryJudge,
      claimEnvelope,
      readerState,
      painBrief,
      angles,
      articleDistillation,
      hookConstruction,
      copywriterConcepts,
      audienceResearch,
      historicalRejects,
      officialPolicySupport,
      refinementBrief
    );
    const refinedRanking = await rankRewriteVariants(refinedRewriteStation.variants, normalization.bundle, claimEnvelope, painBrief, hookConstruction);
    const selectedRound = choosePreferredRanking(ranking, refinedRanking);
    rewriteRefinement = {
      station: "rewrite_refinement",
      version: META_POLICY_HARNESS_VERSION,
      triggered: true,
      selectedRound,
      initialAcceptedCount: ranking.accepted.length,
      refinedAcceptedCount: refinedRanking.accepted.length,
      initialMaxSystemYield: rankingMaxSystemYield(ranking),
      refinedMaxSystemYield: rankingMaxSystemYield(refinedRanking),
      refinementBrief
    };
    if (selectedRound === "refined") {
      rewriteStation = {
        ...refinedRewriteStation,
        refinementApplied: true
      };
      ranking = refinedRanking;
    } else {
      rewriteStation = {
        ...rewriteStation,
        refinementApplied: false
      };
    }
  }
  if (shouldTriggerBundleCompression(ranking, hookConstruction)) {
    const compressedRewriteStation = await compressRewriteVariants(
      normalization.bundle,
      claimEnvelope,
      hookConstruction,
      ranking
    );
    if (compressedRewriteStation?.variants?.length === TARGET_REWRITE_VARIANT_COUNT) {
      const compressedRanking = await rankRewriteVariants(compressedRewriteStation.variants, normalization.bundle, claimEnvelope, painBrief, hookConstruction);
      const selectedRound = choosePreferredRanking(ranking, compressedRanking);
      rewriteRefinement = {
        ...(rewriteRefinement || {
          station: "rewrite_refinement",
          version: META_POLICY_HARNESS_VERSION,
          triggered: false
        }),
        compressionTriggered: true,
        compressionSelectedRound: selectedRound,
        preCompressionAcceptedCount: ranking.accepted.length,
        compressedAcceptedCount: compressedRanking.accepted.length,
        preCompressionMaxSystemYield: rankingMaxSystemYield(ranking),
        compressedMaxSystemYield: rankingMaxSystemYield(compressedRanking)
      };
      if (selectedRound === "refined") {
        rewriteStation = {
          ...compressedRewriteStation,
          compressionApplied: true
        };
        ranking = compressedRanking;
      }
    }
  }
  return {
    normalization,
    boundaryJudge,
    historicalRejects,
    officialPolicySupport,
    claimEnvelope,
    readerState,
    painBrief,
    angles,
    audienceResearch,
    articleDistillation,
    hookConstruction,
    copywriterConcepts,
    rewriteStation,
    rewriteRefinement,
    ranking
  };
}

function requirePartnerAuth(req, res, next) {
  const expected = process.env.PARTNER_API_KEY;
  if (!expected) {
    return res.status(500).json({ ok: false, message: "PARTNER_API_KEY is not configured." });
  }
  const auth = req.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.slice("Bearer ".length).trim() !== expected.trim()) {
    return res.status(401).json({ ok: false, message: "Unauthorized." });
  }
  next();
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    mode: "server",
    version: META_POLICY_HARNESS_VERSION
  });
});

app.post("/api/meta-policy/normalize", requirePartnerAuth, (req, res) => {
  res.json(normalizeMetaAdBundle(req.body || {}));
});

app.post("/api/meta-policy/boundary-judge", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  res.json(runBoundaryJudge(normalized.bundle));
});

app.post("/api/meta-policy/official-policy-support", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  res.json(findOfficialPolicySupport(normalized.combinedAdText));
});

app.get("/api/meta-policy/policy-corpus-status", requirePartnerAuth, (_req, res) => {
  res.json(policyCorpusStatus());
});

app.post("/api/meta-policy/policy-ask", requirePartnerAuth, async (req, res) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question : "";
    const contextText = typeof req.body?.contextText === "string" ? req.body.contextText : "";
    if (!question.trim()) {
      return res.status(400).json({ error: "question is required (string)" });
    }
    res.json(await answerPolicyQuestion(question, contextText));
  } catch (error) {
    res.status(500).json({ error: error.message || "Policy question failed" });
  }
});

app.post("/api/meta-policy/claim-envelope", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  res.json(extractClaimEnvelope(normalized.bundle));
});

app.post("/api/meta-policy/reader-state", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const envelope = extractClaimEnvelope(normalized.bundle);
  res.json(inferReaderState(normalized.bundle, envelope));
});

app.post("/api/meta-policy/pain-brief", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  res.json(buildPainBrief(normalized.bundle));
});

app.post("/api/meta-policy/angles", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  res.json(generateAngles(normalized.bundle));
});

app.post("/api/meta-policy/congruence-audit", requirePartnerAuth, (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const candidateText = typeof req.body?.candidateText === "string" ? req.body.candidateText : "";
  if (!candidateText) {
    return res.status(400).json({ error: "candidateText is required (string)" });
  }
  const envelope = extractClaimEnvelope(normalized.bundle);
  res.json(auditCongruence(candidateText, normalized.bundle, envelope));
});

app.post("/api/meta-policy/rewrite", requirePartnerAuth, async (req, res) => {
  try {
    const normalized = normalizeMetaAdBundle(req.body || {});
    const judge = runBoundaryJudge(normalized.bundle);
    const historicalRejects = findSimilarHistoricalRejects(normalized.combinedAdText);
    const officialPolicySupport = findOfficialPolicySupport(normalized.combinedAdText);
    const envelope = extractClaimEnvelope(normalized.bundle);
    const readerState = inferReaderState(normalized.bundle, envelope);
    const painBrief = buildPainBrief(normalized.bundle);
    const angles = generateAngles(normalized.bundle);
    const audienceResearch = selectAudienceResearch(normalized.bundle);
    const articleDistillation = await distillArticleForCopywriter(normalized.bundle, envelope, readerState, painBrief, angles, audienceResearch);
    const baseCopywriterConcepts = selectCopywriterConcepts(normalized.bundle, painBrief, angles);
    const runtimeConceptDistillation = await distillCopywriterConceptNotes(normalized.copywriterConceptNotes);
    const copywriterConcepts = mergeCopywriterConcepts(baseCopywriterConcepts, runtimeConceptDistillation);
    const hookConstruction = await evaluateHookBlueprints(
      await constructHookBlueprints(normalized.bundle, envelope, readerState, painBrief, angles, articleDistillation, copywriterConcepts, audienceResearch),
      normalized.bundle,
      envelope,
      painBrief
    );
    res.json(await generateRewriteVariants(normalized.bundle, judge, envelope, readerState, painBrief, angles, articleDistillation, hookConstruction, copywriterConcepts, audienceResearch, historicalRejects, officialPolicySupport));
  } catch (error) {
    res.status(500).json({ error: error.message || "Rewrite station failed" });
  }
});

app.post("/api/meta-policy/rank", requirePartnerAuth, async (req, res) => {
  try {
    const normalized = normalizeMetaAdBundle(req.body || {});
    const envelope = extractClaimEnvelope(normalized.bundle);
    const painBrief = buildPainBrief(normalized.bundle);
    const variants = Array.isArray(req.body?.variants) ? req.body.variants : null;
    if (!variants) {
      return res.status(400).json({ error: "variants is required (array)" });
    }
    res.json(await rankRewriteVariants(variants, normalized.bundle, envelope, painBrief, null));
  } catch (error) {
    res.status(500).json({ error: error.message || "Ranking failed" });
  }
});

app.post("/api/meta-policy/run", requirePartnerAuth, async (req, res) => {
  try {
    res.json(await runMetaPolicyHarness(req.body || {}));
  } catch (error) {
    res.status(500).json({ error: error.message || "Meta policy harness failed" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, message: "Not found." });
});

app.listen(PORT, () => {
  console.log(`Meta policy API listening on port ${PORT}`);
});
