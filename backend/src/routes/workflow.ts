/**
 * Workflow Orchestration API Routes
 * 
 * REST endpoints for automated workflow orchestration
 */

import express from 'express';
import { OpportunityQueue } from '../services/opportunityQueue';
import { CampaignFactory } from '../services/campaignFactory';
import { StrategisClient } from '../services/strategisClient';
import { StrategisFacebookClient } from '../services/strategisFacebookClient';
import { WorkflowOrchestrator } from '../services/workflowOrchestrator';

const router = express.Router();

// Initialize services
const strategisClient = new StrategisClient({
  baseUrl: process.env.STRATEGIS_API_BASE_URL || 'https://api.strategis.internal',
  apiKey: process.env.STRATEGIS_API_KEY,
});

const strategisFacebookClient = new StrategisFacebookClient({
  baseUrl: process.env.STRATEGIS_API_BASE_URL || 'https://api.strategis.internal',
  apiKey: process.env.STRATEGIS_API_KEY,
});

const campaignFactory = new CampaignFactory(strategisClient, strategisFacebookClient);
const opportunityQueue = new OpportunityQueue();
const workflowOrchestrator = new WorkflowOrchestrator(opportunityQueue, campaignFactory);

/**
 * POST /api/workflow/process-opportunity/:id
 * Process opportunity end-to-end: Opportunity → Blueprint → Campaign
 */
router.post('/process-opportunity/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const blueprintConfig = req.body;

    // Validate required fields
    if (!blueprintConfig.brand || !blueprintConfig.adAccountId || 
        !blueprintConfig.organization || !blueprintConfig.domain || 
        !blueprintConfig.destination || !blueprintConfig.strategisTemplateId) {
      return res.status(400).json({
        error: 'Missing required blueprint config fields',
        required: [
          'brand', 'adAccountId', 'organization', 'domain',
          'destination', 'strategisTemplateId', 'category'
        ],
      });
    }

    const result = await workflowOrchestrator.processOpportunity(id, blueprintConfig);
    res.json(result);
  } catch (error) {
    console.error('Workflow orchestration error:', error);
    res.status(500).json({
      error: 'Workflow orchestration failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/workflow/process-pending
 * Process pending opportunities (batch)
 */
router.post('/process-pending', async (req, res) => {
  try {
    const { limit = 10, blueprintConfig } = req.body;

    if (!blueprintConfig) {
      return res.status(400).json({
        error: 'Missing blueprintConfig',
      });
    }

    const results = await workflowOrchestrator.processPendingOpportunities(
      limit,
      blueprintConfig
    );

    res.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({
      error: 'Batch processing failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/workflow/weekly-refresh
 * Trigger weekly opportunity refresh (scheduled job)
 */
router.post('/weekly-refresh', async (req, res) => {
  try {
    await workflowOrchestrator.weeklyOpportunityRefresh();
    res.json({ status: 'success', message: 'Weekly refresh completed' });
  } catch (error) {
    console.error('Weekly refresh error:', error);
    res.status(500).json({
      error: 'Weekly refresh failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

