/**
 * MCP (Model Context Protocol) Server Utilities
 * 
 * Provides standardized data access patterns for AI agents and analytics.
 * Acts as a thin adapter over existing API endpoints.
 */

import axios from 'axios';

const BACKEND_BASE = process.env.BACKEND_URL || 'http://localhost:3001';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP Tools for Strategist Analytics
 */
export const strategistMCPTools: MCPTool[] = [
  {
    name: 'query_campaign_performance',
    description: 'Query campaign or adset performance metrics with filters (date, owner, lane, category, ROAS thresholds, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['campaign', 'adset'], description: 'Entity level to query' },
        date: { type: 'string', description: 'Specific date (YYYY-MM-DD) or null for latest' },
        start_date: { type: 'string', description: 'Start date for range queries (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date for range queries (YYYY-MM-DD)' },
        owner: { type: 'string', description: 'Filter by owner (ben, tj, dan, mike, etc.)' },
        lane: { type: 'string', enum: ['ASC', 'LAL_1', 'LAL_2_5', 'Contextual', 'Sandbox', 'Warm'], description: 'Filter by lane' },
        category: { type: 'string', description: 'Filter by category' },
        roas_gt: { type: 'number', description: 'Filter by ROAS greater than' },
        roas_lt: { type: 'number', description: 'Filter by ROAS less than' },
        limit: { type: 'number', description: 'Maximum number of results (default: 100, max: 10000)' },
        format: { type: 'string', enum: ['json', 'csv'], description: 'Response format' },
      },
      required: ['level'],
    },
  },
  {
    name: 'get_daily_rollup',
    description: 'Get aggregated daily performance metrics (spend, revenue, margin, ROAS)',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date (YYYY-MM-DD) or null for latest' },
        owner: { type: 'string', description: 'Filter by owner' },
        lane: { type: 'string', description: 'Filter by lane' },
        category: { type: 'string', description: 'Filter by category' },
      },
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get scaling recommendations based on ROAS thresholds',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date (YYYY-MM-DD) or null for latest' },
        level: { type: 'string', enum: ['campaign', 'adset'], description: 'Entity level' },
        owner: { type: 'string', description: 'Filter by owner' },
      },
    },
  },
];

/**
 * Execute an MCP tool call against the Strategist API
 */
export async function executeMCPTool(toolCall: MCPToolCall): Promise<any> {
  const { name, arguments: args } = toolCall;

  try {
    switch (name) {
      case 'query_campaign_performance': {
        const level = args.level || 'adset';
        const params = new URLSearchParams();
        
        if (args.date) params.append('date', args.date);
        if (args.start_date) params.append('start_date', args.start_date);
        if (args.end_date) params.append('end_date', args.end_date);
        if (args.owner) params.append('owner', args.owner);
        if (args.lane) params.append('lane', args.lane);
        if (args.category) params.append('category', args.category);
        if (args.roas_gt !== undefined) params.append('roas_gt', String(args.roas_gt));
        if (args.roas_lt !== undefined) params.append('roas_lt', String(args.roas_lt));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.format) params.append('format', args.format);
        
        params.append('level', level);
        
        const response = await axios.get(`${BACKEND_BASE}/api/strategist/query?${params.toString()}`);
        return response.data;
      }

      case 'get_daily_rollup': {
        const params = new URLSearchParams();
        if (args.date) params.append('date', args.date);
        if (args.owner) params.append('owner', args.owner);
        if (args.lane) params.append('lane', args.lane);
        if (args.category) params.append('category', args.category);
        
        // Use query endpoint with aggregation
        const response = await axios.get(`${BACKEND_BASE}/api/strategist/query?${params.toString()}&level=campaign`);
        const data = response.data;
        
        // Aggregate the results
        if (data.rows && Array.isArray(data.rows)) {
          const totals = data.rows.reduce((acc: any, row: any) => {
            acc.spend_usd = (acc.spend_usd || 0) + (row.spend_usd || 0);
            acc.revenue_usd = (acc.revenue_usd || 0) + (row.revenue_usd || 0);
            acc.net_margin_usd = (acc.net_margin_usd || 0) + (row.net_margin_usd || 0);
            acc.impressions = (acc.impressions || 0) + (row.impressions || 0);
            acc.clicks = (acc.clicks || 0) + (row.clicks || 0);
            acc.sessions = (acc.sessions || 0) + (row.sessions || 0);
            acc.conversions = (acc.conversions || 0) + (row.conversions || 0);
            return acc;
          }, {});
          
          totals.roas = totals.revenue_usd > 0 && totals.spend_usd > 0 
            ? totals.revenue_usd / totals.spend_usd 
            : null;
          totals.margin_rate = totals.revenue_usd > 0 
            ? totals.net_margin_usd / totals.revenue_usd 
            : null;
          
          return { date: args.date || data.meta?.date, ...totals };
        }
        
        return data;
      }

      case 'get_recommendations': {
        const params = new URLSearchParams();
        if (args.date) params.append('date', args.date);
        if (args.level) params.append('level', args.level);
        if (args.owner) params.append('owner', args.owner);
        
        const response = await axios.get(`${BACKEND_BASE}/api/strategist/recommendations?${params.toString()}`);
        return response.data;
      }

      default:
        throw new Error(`Unknown MCP tool: ${name}`);
    }
  } catch (error: any) {
    throw new Error(`MCP tool execution failed: ${error.message}`);
  }
}

/**
 * Get all available MCP tools
 */
export function getAvailableMCPTools(): MCPTool[] {
  return [...strategistMCPTools];
}




