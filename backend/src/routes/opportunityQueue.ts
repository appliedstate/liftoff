/**
 * Opportunity Queue API Routes
 * 
 * REST endpoints for managing opportunities and blueprints
 */

import express from 'express';
import { OpportunityQueue, Opportunity, CampaignBlueprint } from '../services/opportunityQueue';
import { CampaignPlanPreviewService } from '../services/campaignPlanPreview';

const router = express.Router();
const opportunityQueue = new OpportunityQueue();
const previewService = new CampaignPlanPreviewService(opportunityQueue);

/**
 * POST /api/opportunities
 * Add opportunity to queue
 */
router.post('/', async (req, res) => {
  try {
    const opportunity: Opportunity = req.body;
    const result = await opportunityQueue.addOpportunity(opportunity);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding opportunity:', error);
    res.status(500).json({
      error: 'Failed to add opportunity',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities
 * List opportunities with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      source: req.query.source as string | undefined,
      category: req.query.category as string | undefined,
      minConfidence: req.query.minConfidence ? Number(req.query.minConfidence) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    };
    
    const opportunities = await opportunityQueue.list(filters);
    res.json(opportunities);
  } catch (error) {
    console.error('Error listing opportunities:', error);
    res.status(500).json({
      error: 'Failed to list opportunities',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities/pending
 * Get pending opportunities (ranked by ΔCM)
 */
router.get('/pending', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const opportunities = await opportunityQueue.getPending(limit);
    res.json(opportunities);
  } catch (error) {
    console.error('Error getting pending opportunities:', error);
    res.status(500).json({
      error: 'Failed to get pending opportunities',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities/:id
 * Get opportunity by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await opportunityQueue.getById(id);
    
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    res.json(opportunity);
  } catch (error) {
    console.error('Error getting opportunity:', error);
    res.status(500).json({
      error: 'Failed to get opportunity',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/opportunities/:id/status
 * Update opportunity status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['pending', 'approved', 'launched', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const opportunity = await opportunityQueue.updateStatus(id, status);
    res.json(opportunity);
  } catch (error) {
    console.error('Error updating opportunity status:', error);
    res.status(500).json({
      error: 'Failed to update opportunity status',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/opportunities/:id/blueprints
 * Create blueprint from opportunity
 */
router.post('/:id/blueprints', async (req, res) => {
  try {
    const { id } = req.params;
    const blueprint: CampaignBlueprint = req.body;
    
    // Verify opportunity exists
    const opportunity = await opportunityQueue.getById(id);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    const result = await opportunityQueue.createBlueprint(id, blueprint);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating blueprint:', error);
    res.status(500).json({
      error: 'Failed to create blueprint',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities/:id/blueprints
 * Get blueprints for an opportunity
 */
router.get('/:id/blueprints', async (req, res) => {
  try {
    const { id } = req.params;
    const blueprints = await opportunityQueue.getBlueprintsByOpportunity(id);
    res.json(blueprints);
  } catch (error) {
    console.error('Error getting blueprints:', error);
    res.status(500).json({
      error: 'Failed to get blueprints',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities/blueprints/:id
 * Get blueprint by ID
 */
router.get('/blueprints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const blueprint = await opportunityQueue.getBlueprintById(id);
    
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }
    
    res.json(blueprint);
  } catch (error) {
    console.error('Error getting blueprint:', error);
    res.status(500).json({
      error: 'Failed to get blueprint',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/opportunities/blueprints/:id/status
 * Update blueprint status
 */
router.patch('/blueprints/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['draft', 'approved', 'launched'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const blueprint = await opportunityQueue.updateBlueprintStatus(id, status);
    res.json(blueprint);
  } catch (error) {
    console.error('Error updating blueprint status:', error);
    res.status(500).json({
      error: 'Failed to update blueprint status',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities/:id/preview
 * Preview opportunity - shows all required information and how campaigns will be set up
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const blueprintConfig = req.query;

    // Validate required fields
    const required = ['brand', 'adAccountId', 'organization', 'domain', 'destination', 'strategisTemplateId', 'category'];
    const missing = required.filter(field => !blueprintConfig[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required query parameters',
        missing,
        required,
        example: '/api/opportunities/:id/preview?brand=BrandX&adAccountId=act_123&organization=Interlincx&domain=brandx.com&destination=S1&strategisTemplateId=template-123&category=Healthcare',
      });
    }

    const preview = await previewService.previewOpportunity(id, {
      brand: blueprintConfig.brand as string,
      adAccountId: blueprintConfig.adAccountId as string,
      organization: blueprintConfig.organization as string,
      domain: blueprintConfig.domain as string,
      destination: blueprintConfig.destination as string,
      strategisTemplateId: blueprintConfig.strategisTemplateId as string,
      category: blueprintConfig.category as string,
      article: blueprintConfig.article as string | undefined,
      fbPage: blueprintConfig.fbPage as string | undefined,
      pixelId: blueprintConfig.pixelId as string | undefined,
    });

    res.json(preview);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/opportunities/:id/required-info
 * Get checklist of required information for an opportunity
 */
router.get('/:id/required-info', async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await opportunityQueue.getById(id);

    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Return checklist of what's needed
    const requiredInfo = {
      opportunity: {
        hasAngle: !!opportunity.angle,
        hasCategory: !!opportunity.category,
        hasRevenuePotential: !!opportunity.revenue_potential,
        hasConfidenceScore: !!opportunity.confidence_score,
        hasRecommendedBudget: !!opportunity.recommended_budget,
      },
      config: {
        required: [
          'brand',
          'adAccountId',
          'organization',
          'domain',
          'destination',
          'strategisTemplateId',
          'category',
        ],
        optional: [
          'article',
          'fbPage',
          'pixelId',
        ],
      },
      blueprint: {
        needsLaneMix: !opportunity.recommended_lane_mix,
        needsTargeting: true,
        needsKPITargets: true,
      },
    };

    res.json(requiredInfo);
  } catch (error) {
    console.error('Error getting required info:', error);
    res.status(500).json({
      error: 'Failed to get required info',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

