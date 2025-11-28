/**
 * Detects signs of AI-generated or scaled content abuse.
 * Similar to how Google's SpamBrain identifies templated/low-effort content.
 */

export type AIContentSignals = {
  // Overall score (0-1, higher = more likely AI-generated)
  aiLikelihood: number;
  // Specific signals detected
  signals: {
    repetitivePatterns: boolean;
    genericLanguage: boolean;
    perfectGrammar: boolean;
    lacksPersonalVoice: boolean;
    missingSpecificDetails: boolean;
    templatedStructure: boolean;
    lowOriginality: boolean;
  };
  // Evidence/examples
  evidence: string[];
};

/**
 * Detect AI-generated content patterns similar to SpamBrain.
 * 
 * Key signals Google looks for:
 * - Repetitive sentence structures
 * - Generic, templated language
 * - Overly perfect grammar (no natural errors)
 * - Lack of personal voice or unique perspective
 * - Missing specific details, citations, or original research
 * - Similar structure across multiple pages
 * - Low semantic diversity
 */
export function detectAIContentSignals(content: string): AIContentSignals {
  const signals = {
    repetitivePatterns: false,
    genericLanguage: false,
    perfectGrammar: false,
    lacksPersonalVoice: false,
    missingSpecificDetails: false,
    templatedStructure: false,
    lowOriginality: false,
  };
  const evidence: string[] = [];
  let aiLikelihood = 0;

  if (!content || content.length < 100) {
    return { aiLikelihood: 0, signals, evidence };
  }

  const words = content.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);

  // 1. Check for repetitive sentence structures
  if (sentences.length > 3) {
    const sentenceStarts: string[] = [];
    sentences.forEach(s => {
      const firstWords = s.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
      sentenceStarts.push(firstWords);
    });

    const startPatterns = new Map<string, number>();
    sentenceStarts.forEach(start => {
      startPatterns.set(start, (startPatterns.get(start) || 0) + 1);
    });

    const maxRepeat = Math.max(...Array.from(startPatterns.values()));
    if (maxRepeat > sentences.length * 0.3) {
      signals.repetitivePatterns = true;
      evidence.push(`Repetitive sentence starts: ${maxRepeat} sentences start similarly`);
      aiLikelihood += 0.15;
    }
  }

  // 2. Check for generic/templated language
  const genericPhrases = [
    'in conclusion',
    'it is important to note',
    'it should be noted',
    'as we can see',
    'it is worth mentioning',
    'in today\'s world',
    'in the modern era',
    'it goes without saying',
    'without a doubt',
    'it is clear that',
    'one might argue',
    'it is essential to',
    'it is crucial to',
    'it is vital to',
    'it is imperative to',
  ];

  const genericCount = genericPhrases.reduce((count, phrase) => {
    const regex = new RegExp(phrase, 'gi');
    const matches = content.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);

  if (genericCount > sentences.length * 0.1) {
    signals.genericLanguage = true;
    evidence.push(`High use of generic phrases: ${genericCount} instances`);
    aiLikelihood += 0.2;
  }

  // 3. Check for overly perfect grammar (no contractions, very formal)
  const contractions = /\b(?:i'm|you're|we're|they're|it's|don't|won't|can't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|wouldn't|couldn't|shouldn't)\b/gi;
  const contractionCount = (content.match(contractions) || []).length;
  const veryFormal = contractionCount < sentences.length * 0.1 && sentences.length > 5;

  // Check for consistent capitalization (AI often capitalizes properly)
  const properNouns = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  const allCaps = content.match(/\b[A-Z]{2,}\b/g) || [];
  const hasNaturalVariation = allCaps.length < properNouns.length * 0.2;

  if (veryFormal && hasNaturalVariation && sentences.length > 10) {
    signals.perfectGrammar = true;
    evidence.push('Overly formal language with minimal contractions (unnatural for human writing)');
    aiLikelihood += 0.1;
  }

  // 4. Check for lack of personal voice (no first person, no opinions, no anecdotes)
  const firstPerson = /\b(?:i|me|my|mine|we|us|our|ours)\b/gi;
  const firstPersonCount = (content.match(firstPerson) || []).length;
  const hasPersonalVoice = firstPersonCount > words.length * 0.01;

  const opinionMarkers = /\b(?:i think|i believe|in my opinion|i feel|i've noticed|i've found|in my experience)\b/gi;
  const hasOpinions = (content.match(opinionMarkers) || []).length > 0;

  if (!hasPersonalVoice && !hasOpinions && content.length > 500) {
    signals.lacksPersonalVoice = true;
    evidence.push('Lacks first-person perspective or personal opinions');
    aiLikelihood += 0.15;
  }

  // 5. Check for missing specific details (dates, names, citations, numbers)
  const hasDates = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})\b/gi.test(content);
  const hasSpecificNumbers = /\b\d+[%$]|\b\d+\.\d+|\b\d{4,}\b/gi.test(content);
  const hasCitations = /\[?\d+\]?|\([A-Za-z]+\s+et\s+al\.|according to|source:|reference:/gi.test(content);
  const hasQuotes = /["'']/g.test(content) && (content.match(/["'']/g) || []).length > 2;

  if (!hasDates && !hasSpecificNumbers && !hasCitations && !hasQuotes && content.length > 1000) {
    signals.missingSpecificDetails = true;
    evidence.push('Missing specific details: no dates, numbers, citations, or quotes');
    aiLikelihood += 0.2;
  }

  // 6. Check for templated structure (repetitive headings, similar paragraph lengths)
  if (paragraphs.length > 3) {
    const paragraphLengths = paragraphs.map(p => p.length);
    const avgLength = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length;
    const variance = paragraphLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / paragraphLengths.length;
    const stdDev = Math.sqrt(variance);

    // Very uniform paragraph lengths suggest templating
    if (stdDev < avgLength * 0.3 && paragraphs.length > 5) {
      signals.templatedStructure = true;
      evidence.push('Very uniform paragraph structure (suggests templating)');
      aiLikelihood += 0.1;
    }
  }

  // 7. Check for low semantic diversity (repeated concepts, limited vocabulary)
  const uniqueWords = new Set(words.filter(w => w.length > 3));
  const uniqueRatio = uniqueWords.size / words.length;
  
  // Check for repeated phrases (3+ word sequences)
  const phraseMap = new Map<string, number>();
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ');
    phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
  }
  const repeatedPhrases = Array.from(phraseMap.values()).filter(count => count > 2).length;

  if (uniqueRatio < 0.3 && words.length > 200) {
    signals.lowOriginality = true;
    evidence.push(`Low vocabulary diversity: ${(uniqueRatio * 100).toFixed(1)}% unique words`);
    aiLikelihood += 0.1;
  }

  if (repeatedPhrases > words.length * 0.05) {
    signals.lowOriginality = true;
    evidence.push(`High phrase repetition: ${repeatedPhrases} repeated 3-word phrases`);
    aiLikelihood += 0.1;
  }

  // Cap at 1.0
  aiLikelihood = Math.min(1.0, aiLikelihood);

  return {
    aiLikelihood,
    signals,
    evidence,
  };
}

/**
 * Check if content shows signs of scaled content abuse.
 * This is a stricter check that combines AI detection with other abuse patterns.
 */
export function detectScaledContentAbuse(content: string, wordCount: number): {
  isAbuse: boolean;
  confidence: number;
  reasons: string[];
} {
  const aiSignals = detectAIContentSignals(content);
  const reasons: string[] = [];
  let confidence = 0;

  // Very short content is suspicious
  if (wordCount < 300) {
    reasons.push('Very short content (<300 words)');
    confidence += 0.2;
  }

  // High AI likelihood
  if (aiSignals.aiLikelihood > 0.5) {
    reasons.push(`High AI content likelihood: ${(aiSignals.aiLikelihood * 100).toFixed(0)}%`);
    confidence += aiSignals.aiLikelihood * 0.4;
    reasons.push(...aiSignals.evidence);
  }

  // Multiple AI signals
  const signalCount = Object.values(aiSignals.signals).filter(Boolean).length;
  if (signalCount >= 3) {
    reasons.push(`Multiple AI content signals detected: ${signalCount}`);
    confidence += 0.2;
  }

  // Check for templated patterns (common in scaled content)
  if (aiSignals.signals.templatedStructure && aiSignals.signals.genericLanguage) {
    reasons.push('Templated structure with generic language (classic scaled content pattern)');
    confidence += 0.2;
  }

  confidence = Math.min(1.0, confidence);
  const isAbuse = confidence > 0.5;

  return {
    isAbuse,
    confidence,
    reasons,
  };
}

