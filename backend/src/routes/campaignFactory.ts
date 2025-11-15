/**
 * Campaign Factory API Routes
 * 
 * REST endpoints for campaign creation and management
 */

import express from 'express';
import { StrategisClient } from '../services/strategisClient';
import { StrategisFacebookClient } from '../services/strategisFacebookClient';
import { CampaignFactory, CampaignPlan } from '../services/campaignFactory';
import { getPgPool } from '../lib/pg';

const router = express.Router();

// Initialize clients
const strategisClient = new StrategisClient({
  baseUrl: process.env.STRATEGIS_API_BASE_URL || 'https://api.strategis.internal',
  apiKey: process.env.STRATEGIS_API_KEY,
});

const strategisFacebookClient = new StrategisFacebookClient({
  baseUrl: process.env.STRATEGIS_API_BASE_URL || 'https://api.strategis.internal',
  apiKey: process.env.STRATEGIS_API_KEY,
});

const campaignFactory = new CampaignFactory(strategisClient, strategisFacebookClient);

/**
 * POST /api/campaign-factory/create
 * Create a new campaign with naming conventions
 */
router.post('/create', async (req, res) => {
  try {
    const plan: CampaignPlan = req.body;

    // Validate required fields
    if (!plan.brand || !plan.objective || !plan.hookSetId || !plan.market || 
        !plan.channel || !plan.date || !plan.category || !plan.adAccountId || 
        !plan.organization || !plan.domain || !plan.destination || !plan.adSets) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: [
          'brand', 'objective', 'hookSetId', 'market', 'channel', 'date',
          'category', 'adAccountId', 'organization', 'domain', 'destination', 'adSets'
        ],
      });
    }

    // Validate strategisTemplateId is provided
    if (!plan.strategisTemplateId) {
      return res.status(400).json({
        error: 'strategisTemplateId is required',
      });
    }

    const result = await campaignFactory.createCampaignWithNaming(plan);

    res.status(201).json(result);
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({
      error: 'Campaign creation failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/requests/:requestId
 * Get request status by request ID
 */
router.get('/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT 
        cp.*,
        cm.id as mapping_id,
        cm.strategis_campaign_ids,
        cm.facebook_campaign_id,
        cm.facebook_ad_set_ids,
        cm.tracking_urls,
        cm.status as mapping_status
       FROM campaign_plans cp
       LEFT JOIN campaign_mappings cm ON cm.campaign_plan_id = cp.id
       WHERE cp.request_id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({
      error: 'Failed to fetch request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/plans/:planId
 * Get campaign plan by ID
 */
router.get('/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT * FROM campaign_plans WHERE id = $1`,
      [planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign plan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching campaign plan:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign plan',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/mappings/:mappingId
 * Get campaign mapping by ID
 */
router.get('/mappings/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT * FROM campaign_mappings WHERE id = $1`,
      [mappingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign mapping not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching campaign mapping:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign mapping',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/plans
 * List campaign plans with optional filters
 */
router.get('/plans', async (req, res) => {
  try {
    const { status, hookSetId, organization } = req.query;
    const pool = getPgPool();

    let query = 'SELECT * FROM campaign_plans WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (hookSetId) {
      query += ` AND hook_set_id = $${paramIndex++}`;
      params.push(hookSetId);
    }

    if (organization) {
      query += ` AND organization = $${paramIndex++}`;
      params.push(organization);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing campaign plans:', error);
    res.status(500).json({
      error: 'Failed to list campaign plans',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

