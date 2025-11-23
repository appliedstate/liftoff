/**
 * Analytics API Routes
 * 
 * Provides endpoints for generative analytics:
 * - Intent detection
 * - MCP tool execution
 * - Context management
 */

import express from 'express';
import { detectIntent, intentToMCPToolCalls } from '../lib/analyticsIntent';
import { executeMCPTool } from '../lib/mcp';
import {
  getAnalyticsContext,
  addMessage,
  updateCurrentFocus,
  getConversationHistory,
} from '../lib/analyticsContext';

const router = express.Router();

/**
 * POST /api/analytics/intent
 * Detect analytical intent and execute MCP tools to fetch data
 */
router.post('/intent', async (req, res) => {
  try {
    const { query, threadId } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    // Get context
    const context = getAnalyticsContext(threadId || 'default');

    // Detect intent
    const intent = detectIntent(query, context);

    // Generate MCP tool calls
    const toolCalls = intentToMCPToolCalls(intent);

    // Execute tool calls
    const dataResults: any[] = [];
    for (const toolCall of toolCalls) {
      try {
        const result = await executeMCPTool(toolCall);
        dataResults.push(result);
      } catch (error: any) {
        console.error(`[analytics] MCP tool execution failed:`, error);
        dataResults.push({ error: error.message });
      }
    }

    // Combine results
    let data: any = null;
    if (dataResults.length === 1) {
      data = dataResults[0];
    } else if (dataResults.length > 1) {
      data = { results: dataResults };
    }

    // Update context
    addMessage(threadId || 'default', {
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      metadata: {
        queryType: intent.type,
        dataSource: intent.dataSource,
      },
    });

    updateCurrentFocus(threadId || 'default', {
      query,
      filters: intent.filters,
      lastVisualization: intent.visualization,
    });

    res.json({
      intent,
      data,
      toolCalls,
    });
  } catch (error: any) {
    console.error('[analytics/intent] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analytics/context
 * Update analytics context (called by frontend after message)
 */
router.post('/context', async (req, res) => {
  try {
    const { threadId, message } = req.body;

    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' });
    }

    if (message) {
      addMessage(threadId, {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || new Date().toISOString(),
        metadata: message.metadata,
      });
    }

    const context = getAnalyticsContext(threadId);
    res.json({ context });
  } catch (error: any) {
    console.error('[analytics/context] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/context/:threadId
 * Get analytics context for a thread
 */
router.get('/context/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const context = getAnalyticsContext(threadId);
    res.json({ context });
  } catch (error: any) {
    console.error('[analytics/context] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/mcp-tools
 * List available MCP tools
 */
router.get('/mcp-tools', async (req, res) => {
  try {
    const { getAvailableMCPTools } = await import('../lib/mcp');
    const tools = getAvailableMCPTools();
    res.json({ tools });
  } catch (error: any) {
    console.error('[analytics/mcp-tools] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;




