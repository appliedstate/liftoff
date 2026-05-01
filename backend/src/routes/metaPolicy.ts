import express from 'express';
import { scoreMetaAdBoundary } from '../lib/metaAdBoundaryScorer';
import {
  auditCongruence,
  buildPainBrief,
  extractClaimEnvelope,
  generateRewriteVariants,
  generateAngles,
  inferReaderState,
  normalizeMetaAdBundle,
  rankRewriteVariants,
  runBoundaryJudge,
  runMetaPolicyHarness,
} from '../lib/metaPolicyHarness';

const router = express.Router();

router.post('/score', (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required (string)' });
  }

  const result = scoreMetaAdBoundary(text);
  return res.status(200).json(result);
});

router.post('/normalize', (req, res) => {
  const result = normalizeMetaAdBundle(req.body || {});
  return res.status(200).json(result);
});

router.post('/boundary-judge', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const result = runBoundaryJudge(normalized.bundle);
  return res.status(200).json(result);
});

router.post('/claim-envelope', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const result = extractClaimEnvelope(normalized.bundle);
  return res.status(200).json(result);
});

router.post('/reader-state', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const envelope = extractClaimEnvelope(normalized.bundle);
  const result = inferReaderState(normalized.bundle, envelope);
  return res.status(200).json(result);
});

router.post('/pain-brief', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const result = buildPainBrief(normalized.bundle);
  return res.status(200).json(result);
});

router.post('/angles', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const envelope = extractClaimEnvelope(normalized.bundle);
  const readerState = inferReaderState(normalized.bundle, envelope);
  const painBrief = buildPainBrief(normalized.bundle);
  const result = generateAngles(normalized.bundle, readerState, painBrief);
  return res.status(200).json(result);
});

router.post('/congruence-audit', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const { candidateText } = req.body || {};

  if (!candidateText || typeof candidateText !== 'string') {
    return res.status(400).json({ error: 'candidateText is required (string)' });
  }

  const envelope = extractClaimEnvelope(normalized.bundle);
  const result = auditCongruence(candidateText, normalized.bundle, envelope);
  return res.status(200).json(result);
});

router.post('/rewrite', async (req, res) => {
  try {
    const normalized = normalizeMetaAdBundle(req.body || {});
    const judge = runBoundaryJudge(normalized.bundle);
    const envelope = extractClaimEnvelope(normalized.bundle);
    const readerState = inferReaderState(normalized.bundle, envelope);
    const painBrief = buildPainBrief(normalized.bundle);
    const angles = generateAngles(normalized.bundle, readerState, painBrief);
    const result = await generateRewriteVariants(normalized.bundle, judge, envelope, readerState, painBrief, angles);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Rewrite station failed' });
  }
});

router.post('/rank', (req, res) => {
  const normalized = normalizeMetaAdBundle(req.body || {});
  const envelope = extractClaimEnvelope(normalized.bundle);
  const painBrief = buildPainBrief(normalized.bundle);
  const variants = Array.isArray(req.body?.variants) ? req.body.variants : null;
  if (!variants) {
    return res.status(400).json({ error: 'variants is required (array)' });
  }
  const result = rankRewriteVariants(variants, normalized.bundle, envelope, painBrief);
  return res.status(200).json(result);
});

router.post('/run', async (req, res) => {
  try {
    const result = await runMetaPolicyHarness(req.body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Meta policy harness failed' });
  }
});

export default router;
