/**
 * Intent Detection and Query Routing for Analytics
 * 
 * Analyzes user queries to determine analytical intent and route to appropriate data sources
 */

export interface AnalyticalIntent {
  type: 'performance' | 'comparison' | 'trend' | 'breakdown' | 'summary' | 'recommendation' | 'explanation';
  visualization: 'bar' | 'line' | 'table' | 'pie' | 'area' | 'text' | 'mixed';
  dataSource: 'strategist' | 'system1' | 'both';
  filters?: {
    date?: string;
    dateRange?: { start: string; end: string };
    owner?: string;
    lane?: string;
    category?: string;
    level?: 'campaign' | 'adset';
    roasThreshold?: number;
  };
  aggregation?: {
    groupBy?: string[];
    metrics?: string[];
  };
  confidence: number;
}

/**
 * Detect analytical intent from natural language query
 */
export function detectIntent(query: string, context?: any): AnalyticalIntent {
  const lowerQuery = query.toLowerCase();
  
  // Default intent
  let intent: AnalyticalIntent = {
    type: 'performance',
    visualization: 'table',
    dataSource: 'strategist',
    confidence: 0.5,
  };

  // Performance queries
  if (lowerQuery.match(/performance|how.*doing|how.*performing|revenue|spend|roas|margin/)) {
    intent.type = 'performance';
    intent.visualization = 'table';
    intent.confidence = 0.8;
  }

  // Trend queries
  if (lowerQuery.match(/trend|over time|quarterly|monthly|weekly|daily|last.*days|last.*weeks|compare.*year|compare.*quarter/)) {
    intent.type = 'trend';
    intent.visualization = 'line';
    intent.confidence = 0.85;
  }

  // Comparison queries
  if (lowerQuery.match(/compare|versus|vs|better|worse|difference|between/)) {
    intent.type = 'comparison';
    intent.visualization = 'bar';
    intent.confidence = 0.8;
  }

  // Breakdown queries
  if (lowerQuery.match(/breakdown|split|by|group|segment|region|category|owner|lane/)) {
    intent.type = 'breakdown';
    intent.visualization = 'bar';
    intent.confidence = 0.85;
    
    // Detect breakdown dimension
    if (lowerQuery.match(/by region|by owner|by lane|by category/)) {
      if (lowerQuery.includes('region')) intent.aggregation = { groupBy: ['region'] };
      if (lowerQuery.includes('owner')) intent.aggregation = { groupBy: ['owner'] };
      if (lowerQuery.includes('lane')) intent.aggregation = { groupBy: ['lane'] };
      if (lowerQuery.includes('category')) intent.aggregation = { groupBy: ['category'] };
    }
  }

  // Summary queries
  if (lowerQuery.match(/summary|overview|total|aggregate|sum|all/)) {
    intent.type = 'summary';
    intent.visualization = 'text';
    intent.confidence = 0.75;
  }

  // Recommendation queries
  if (lowerQuery.match(/recommend|suggest|should|what.*do|next.*action|optimize/)) {
    intent.type = 'recommendation';
    intent.visualization = 'text';
    intent.confidence = 0.8;
  }

  // Explanation queries
  if (lowerQuery.match(/why|explain|reason|cause|because/)) {
    intent.type = 'explanation';
    intent.visualization = 'text';
    intent.confidence = 0.85;
  }

  // Extract filters from query
  const filters: AnalyticalIntent['filters'] = {};
  
  // Date extraction
  if (lowerQuery.match(/yesterday/)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    filters.date = yesterday.toISOString().split('T')[0];
  } else if (lowerQuery.match(/last.*(\d+).*days?/)) {
    const match = lowerQuery.match(/last.*(\d+).*days?/);
    const days = parseInt(match?.[1] || '7', 10);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    filters.dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  } else if (lowerQuery.match(/quarterly|q[1-4]/)) {
    intent.aggregation = { groupBy: ['quarter'] };
  }

  // Owner extraction
  const ownerMatch = lowerQuery.match(/(?:owner|by)\s+(ben|tj|dan|mike|anastasia)/);
  if (ownerMatch) {
    filters.owner = ownerMatch[1];
  }

  // Lane extraction
  const laneMatch = lowerQuery.match(/(asc|lal[_\s]?1|lal[_\s]?2[_\s]?5|contextual|sandbox|warm)/);
  if (laneMatch) {
    const laneMap: Record<string, string> = {
      'asc': 'ASC',
      'lal1': 'LAL_1',
      'lal 1': 'LAL_1',
      'lal_1': 'LAL_1',
      'lal2': 'LAL_2_5',
      'lal 2': 'LAL_2_5',
      'lal 2 5': 'LAL_2_5',
      'lal_2_5': 'LAL_2_5',
      'contextual': 'Contextual',
      'sandbox': 'Sandbox',
      'warm': 'Warm',
    };
    filters.lane = laneMap[laneMatch[1].toLowerCase().replace(/\s+/g, '')];
  }

  // ROAS threshold extraction
  const roasMatch = lowerQuery.match(/roas\s*(?:>|greater|above|over)\s*([\d.]+)/);
  if (roasMatch) {
    filters.roasThreshold = parseFloat(roasMatch[1]);
  }

  // Level extraction
  if (lowerQuery.match(/campaign/)) {
    filters.level = 'campaign';
  } else if (lowerQuery.match(/adset|ad\s*set/)) {
    filters.level = 'adset';
  }

  if (Object.keys(filters).length > 0) {
    intent.filters = filters;
  }

  // Apply context from previous queries
  if (context?.currentFocus) {
    intent.filters = { ...context.currentFocus.filters, ...intent.filters };
  }

  return intent;
}

/**
 * Generate MCP tool calls based on intent
 */
export function intentToMCPToolCalls(intent: AnalyticalIntent): Array<{ name: string; arguments: any }> {
  const toolCalls: Array<{ name: string; arguments: any }> = [];

  switch (intent.type) {
    case 'performance':
    case 'trend':
    case 'comparison':
    case 'breakdown': {
      const args: any = {
        level: intent.filters?.level || 'adset',
      };
      
      if (intent.filters?.date) {
        args.date = intent.filters.date;
      } else if (intent.filters?.dateRange) {
        args.start_date = intent.filters.dateRange.start;
        args.end_date = intent.filters.dateRange.end;
      }
      
      if (intent.filters?.owner) args.owner = intent.filters.owner;
      if (intent.filters?.lane) args.lane = intent.filters.lane;
      if (intent.filters?.category) args.category = intent.filters.category;
      if (intent.filters?.roasThreshold) args.roas_gt = intent.filters.roasThreshold;
      
      if (intent.type === 'trend' || intent.type === 'breakdown') {
        args.limit = 1000; // Get more data for aggregations
      } else {
        args.limit = 100;
      }
      
      toolCalls.push({
        name: 'query_campaign_performance',
        arguments: args,
      });
      break;
    }

    case 'summary': {
      toolCalls.push({
        name: 'get_daily_rollup',
        arguments: {
          date: intent.filters?.date,
          owner: intent.filters?.owner,
          lane: intent.filters?.lane,
        },
      });
      break;
    }

    case 'recommendation': {
      toolCalls.push({
        name: 'get_recommendations',
        arguments: {
          date: intent.filters?.date,
          level: intent.filters?.level || 'adset',
          owner: intent.filters?.owner,
        },
      });
      break;
    }
  }

  return toolCalls;
}


