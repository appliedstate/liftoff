import express from 'express';
import { generateIntentPacket, generateIntentPacketBatch } from '../lib/intentPacket';
import { discoverIntentPacketAxioms } from '../lib/intentPacketAxioms';
import { discoverIntentPackets } from '../lib/intentPacketDiscovery';
import { createMonitoringConnection, closeConnection, initMonitoringSchema } from '../lib/monitoringDb';
import { queryIntentPacketLearningReport, recordIntentPacketObservations } from '../lib/intentPacketLearning';
import { buildIntentPacketLaunchPreview } from '../lib/intentPacketLaunch';
import { buildIntentPacketDeployPreview, deployIntentPacketLive } from '../lib/intentPacketDeploy';
import { getIntentPacketOwnershipReport, upsertIntentPacketOwnership } from '../lib/intentPacketOwnershipQueue';
import { queryArticleBuyerAttribution } from '../lib/articleBuyerAttribution';
import {
  buildIntentPacketRampArticlePlan,
  resolveSystem1RampApiKey,
  submitIntentPacketRampArticle,
  System1RampClient,
} from '../lib/system1Ramp';

const router = express.Router();

router.post('/generate', (req, res) => {
  try {
    const result = generateIntentPacket(req.body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet generation failed' });
  }
});

router.post('/batch', (req, res) => {
  try {
    const inputs = Array.isArray(req.body?.packets) ? req.body.packets : [];
    if (!inputs.length) {
      return res.status(400).json({ error: 'packets is required (non-empty array)' });
    }
    const result = generateIntentPacketBatch(inputs);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet batch generation failed' });
  }
});

router.post('/launch-preview', (req, res) => {
  try {
    const packetInput = req.body?.packet || req.body || {};
    const launchConfig = req.body?.launchConfig || {};
    const required = ['brand', 'adAccountId', 'organization', 'domain', 'destination', 'strategisTemplateId'];
    const missing = required.filter((field) => !launchConfig[field]);
    if (missing.length) {
      return res.status(400).json({
        error: 'Missing launchConfig fields',
        missing,
      });
    }
    const result = buildIntentPacketLaunchPreview(packetInput, launchConfig);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet launch preview failed' });
  }
});

router.post('/articles/preview', (req, res) => {
  try {
    const packetInput = req.body?.packet || req.body || {};
    const articleConfig = req.body?.articleConfig || req.body?.deployConfig || req.body?.launchConfig || req.body || {};
    const packet = generateIntentPacket(packetInput);
    const result = buildIntentPacketRampArticlePlan(packet, articleConfig);
    return res.status(200).json({ packet, articleGeneration: result });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet article preview failed' });
  }
});

router.post('/articles/generate', async (req, res) => {
  try {
    const packetInput = req.body?.packet || req.body || {};
    const articleConfig = req.body?.articleConfig || req.body?.deployConfig || req.body?.launchConfig || req.body || {};
    const packet = generateIntentPacket(packetInput);
    const result = await submitIntentPacketRampArticle(packet, articleConfig);
    return res.status(201).json({ packet, articleGeneration: result });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet article generation failed' });
  }
});

router.get('/articles', async (req, res) => {
  try {
    const domain = String(req.query.domain || '').trim();
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    const apiKey = resolveSystem1RampApiKey(domain);
    if (!apiKey) {
      return res.status(400).json({ error: `No System1 RAMP API key configured for domain ${domain}` });
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.max(1, Math.min(50, Number(req.query.per_page || 20)));
    const client = new System1RampClient({ apiKey });
    const result = await client.listPrompts(page, perPage);
    return res.status(200).json({ domain, ...result });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet article list failed' });
  }
});

router.get('/articles/quota', async (req, res) => {
  try {
    const domain = String(req.query.domain || '').trim();
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }
    const apiKey = resolveSystem1RampApiKey(domain);
    if (!apiKey) {
      return res.status(400).json({ error: `No System1 RAMP API key configured for domain ${domain}` });
    }
    const client = new System1RampClient({ apiKey });
    const result = await client.getQuota();
    return res.status(200).json({ domain, ...result });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet article quota failed' });
  }
});

router.get('/articles/attribution', async (req, res) => {
  try {
    const authToken = String(
      req.query.authToken ||
      req.headers['x-strategis-auth-token'] ||
      process.env.STRATEGIS_AUTH_TOKEN ||
      process.env.STRATEGIST_AUTH_TOKEN ||
      ''
    ).trim() || null;

    const result = await queryArticleBuyerAttribution({
      organization: String(req.query.organization || '').trim() || null,
      domain: String(req.query.domain || '').trim() || null,
      articleUrl: String(req.query.article_url || req.query.articleUrl || '').trim() || null,
      articleSlug: String(req.query.article_slug || req.query.articleSlug || '').trim() || null,
      authToken,
      includeSystem1Failed: String(req.query.include_failed || '').toLowerCase() === 'true',
      maxArticlesPerDomain: Number(req.query.max_articles_per_domain || 100),
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet article attribution failed' });
  }
});

router.post('/deploy-preview', (req, res) => {
  try {
    const packetInput = req.body?.packet || req.body || {};
    const deployConfig = req.body?.deployConfig || req.body?.launchConfig || {};
    const result = buildIntentPacketDeployPreview(packetInput, deployConfig);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet deploy preview failed' });
  }
});

router.post('/deploy', async (req, res) => {
  try {
    const packetInput = req.body?.packet || req.body || {};
    const deployConfig = req.body?.deployConfig || req.body?.launchConfig || {};
    const result = await deployIntentPacketLive(packetInput, deployConfig);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet live deploy failed' });
  }
});

router.post('/discover', async (req, res) => {
  try {
    const result = await discoverIntentPackets(req.body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet discovery failed' });
  }
});

router.post('/axioms', async (req, res) => {
  try {
    const result = await discoverIntentPacketAxioms(req.body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet axiom discovery failed' });
  }
});

router.post('/learning/observe', async (req, res) => {
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const observations = Array.isArray(req.body?.observations) ? req.body.observations : [req.body || {}];
    const result = await recordIntentPacketObservations(conn, observations);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet learning observation ingest failed' });
  } finally {
    closeConnection(conn);
  }
});

router.post('/learning/priors', async (req, res) => {
  const conn = createMonitoringConnection();
  try {
    await initMonitoringSchema(conn);
    const body = req.body || {};
    const result = await queryIntentPacketLearningReport(conn, {
      keywords: Array.isArray(body.keywords) ? body.keywords : null,
      featureKeys: Array.isArray(body.featureKeys) ? body.featureKeys : null,
      namespaces: Array.isArray(body.namespaces) ? body.namespaces : null,
      sources: Array.isArray(body.sources) ? body.sources : null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      market: body.market || null,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Intent packet learning prior query failed' });
  } finally {
    closeConnection(conn);
  }
});

router.post('/ownership', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.queueKey || !body.primaryKeyword) {
      return res.status(400).json({ error: 'queueKey and primaryKeyword are required' });
    }
    await upsertIntentPacketOwnership({
      queueKey: String(body.queueKey),
      primaryKeyword: String(body.primaryKeyword),
      packetName: body.packetName ? String(body.packetName) : null,
      market: body.market ? String(body.market) : null,
      ownerName: body.ownerName ? String(body.ownerName) : null,
      queueStatus: body.queueStatus ? String(body.queueStatus) : undefined,
      priority: body.priority ? String(body.priority) : undefined,
      nextStep: body.nextStep ? String(body.nextStep) : null,
      nextReviewAt: body.nextReviewAt ? String(body.nextReviewAt) : null,
      blockerSummary: body.blockerSummary ? String(body.blockerSummary) : null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
    });
    return res.status(201).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Intent packet ownership upsert failed' });
  }
});

router.get('/ownership/report', async (req, res) => {
  try {
    const result = await getIntentPacketOwnershipReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Intent packet ownership report failed' });
  }
});

export default router;
