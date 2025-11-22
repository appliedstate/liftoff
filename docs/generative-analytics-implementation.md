# Generative Analytics Implementation Guide

## Overview

This implementation brings **Generative Analytics with Thesys C1 and MCP** to the Liftoff codebase. It transforms static analytics dashboards into dynamic, conversational interfaces that generate the perfect UI component for each analytical question.

## Architecture

### Components

1. **MCP Server Infrastructure** (`backend/src/lib/mcp.ts`)
   - Standardized data access patterns for AI agents
   - Thin adapter over existing API endpoints
   - Provides tools like `query_campaign_performance`, `get_daily_rollup`, `get_recommendations`

2. **Intent Detection** (`backend/src/lib/analyticsIntent.ts`)
   - Analyzes natural language queries to determine analytical intent
   - Routes to appropriate data sources and visualization types
   - Supports: performance, comparison, trend, breakdown, summary, recommendation, explanation

3. **Context Management** (`backend/src/lib/analyticsContext.ts`)
   - Tracks conversation history
   - Maintains user preferences
   - Preserves analytical threads across interactions

4. **Analytics API Routes** (`backend/src/routes/analytics.ts`)
   - `/api/analytics/intent` - Detect intent and fetch data
   - `/api/analytics/context` - Manage conversation context
   - `/api/analytics/mcp-tools` - List available MCP tools

5. **C1 Analytics Chat** (`apps/c1-dashboard/src/app/api/analytics-chat/route.ts`)
   - Frontend API route that orchestrates the full workflow
   - Generates C1 components (charts, tables) based on queries
   - Streams responses with natural language explanations

6. **Data Formatter** (`apps/c1-dashboard/src/app/api/analytics-chat/dataFormatter.ts`)
   - Transforms raw analytics data into C1 component formats
   - Supports BarChart, LineChart, Table, TextContent components

7. **Analytics UI** (`apps/c1-dashboard/src/app/analytics/page.tsx`)
   - React page with C1Chat component
   - Provides conversational analytics interface

## Workflow

```
User Query → Intent Detection → MCP Tool Execution → Data Fetching → 
C1 Component Generation → Natural Language Explanation → Response Stream
```

### Example Flow

1. **User asks**: "Show me quarterly performance for campaigns with ROAS > 1.5"

2. **Intent Detection**:
   - Type: `trend`
   - Visualization: `line`
   - Filters: `{ roas_gt: 1.5, level: 'campaign' }`
   - Aggregation: `{ groupBy: ['quarter'] }`

3. **MCP Tool Call**:
   ```json
   {
     "name": "query_campaign_performance",
     "arguments": {
       "level": "campaign",
       "roas_gt": 1.5,
       "start_date": "2025-01-01",
       "end_date": "2025-12-31",
       "limit": 1000
     }
   }
   ```

4. **Data Retrieved**: Campaign performance rows from Strategist API

5. **C1 Component Generated**: LineChart showing quarterly revenue trends

6. **Response**: Natural language explanation + interactive chart

## Usage

### Starting the Services

1. **Backend** (port 3001):
   ```bash
   cd backend
   npm run dev
   ```

2. **Frontend Dashboard** (port 3000):
   ```bash
   cd apps/c1-dashboard
   npm run dev
   ```

### Accessing the Analytics Interface

Navigate to: `http://localhost:3000/analytics`

### Example Queries

- **Performance**: "Show me yesterday's performance"
- **Trends**: "Quarterly revenue trends for last year"
- **Breakdowns**: "Split revenue by owner"
- **Comparisons**: "Compare ROAS between ASC and LAL_1 lanes"
- **Summaries**: "What's our total margin this month?"
- **Recommendations**: "What campaigns should I scale?"

## Query Patterns

### Date Ranges
- "yesterday" → Single date filter
- "last 7 days" → Date range
- "quarterly" → Grouped by quarter

### Filters
- Owner: "by ben", "owner tj"
- Lane: "ASC campaigns", "LAL_1 performance"
- Category: "healthcare campaigns"
- ROAS: "ROAS > 1.5", "high ROAS campaigns"

### Aggregations
- "by owner" → Group by owner
- "by lane" → Group by lane
- "by category" → Group by category
- "by region" → Group by region

## MCP Tools

### Available Tools

1. **query_campaign_performance**
   - Query campaigns/adsets with filters
   - Supports date ranges, owner, lane, category, ROAS thresholds
   - Returns performance metrics (spend, revenue, margin, ROAS, etc.)

2. **get_daily_rollup**
   - Get aggregated daily metrics
   - Supports filtering by owner, lane, category
   - Returns totals and averages

3. **get_recommendations**
   - Get scaling recommendations
   - Based on ROAS thresholds
   - Returns actionable suggestions

## C1 Components

### Supported Components

- **BarChart**: Comparisons, breakdowns, categorical data
- **LineChart**: Trends over time
- **Table**: Detailed data views
- **TextContent**: Explanations, summaries, recommendations

### Component Generation

Components are automatically generated based on:
- Query intent (performance, trend, comparison, etc.)
- Data structure (rows, columns, metrics)
- User preferences (if set)

## Context Management

### Conversation History
- Maintains last 20 messages per thread
- Preserves analytical context across turns
- Enables follow-up questions

### User Preferences
- Default date ranges
- Preferred visualization types
- Default filters (owner, lane, etc.)

### Current Focus
- Active query context
- Applied filters
- Last visualization type

## Extending the System

### Adding New MCP Tools

1. Define tool in `backend/src/lib/mcp.ts`:
   ```typescript
   {
     name: 'new_tool',
     description: 'Tool description',
     inputSchema: { ... }
   }
   ```

2. Implement execution in `executeMCPTool()`:
   ```typescript
   case 'new_tool': {
     // Implementation
   }
   ```

### Adding New Intent Types

1. Update `detectIntent()` in `backend/src/lib/analyticsIntent.ts`:
   ```typescript
   if (lowerQuery.match(/pattern/)) {
     intent.type = 'new_type';
     intent.visualization = 'appropriate_chart';
   }
   ```

2. Add routing in `intentToMCPToolCalls()`:
   ```typescript
   case 'new_type': {
     // Generate appropriate tool calls
   }
   ```

### Adding New Visualizations

1. Update `generateC1Component()` in `dataFormatter.ts`:
   ```typescript
   case 'new_viz': {
     // Format data for new visualization
     return { component: { component: 'NewComponent', props: {...} } };
   }
   ```

## Production Considerations

### Rate Limiting
- Implement per-user rate limits
- Monitor C1 API token usage
- Cache common queries

### Error Handling
- Graceful fallbacks when data unavailable
- Clear error messages
- Alternative visualizations when primary fails

### Performance
- Cache intent detection results
- Pre-aggregate common queries
- Optimize MCP tool calls

### Monitoring
- Track popular query patterns
- Monitor visualization generation success rates
- Log user preferences and context usage

## Environment Variables

### Required
- `THESYS_API_KEY` - C1 by Thesys API key
- `BACKEND_URL` - Backend service URL (for frontend)
- `NEXT_PUBLIC_BACKEND_URL` - Public backend URL

### Optional
- `NODE_ENV` - Environment (development/production)
- `DEBUG_STRATEGIST_QUERY` - Enable query debugging

## Next Steps

1. **Add More Data Sources**: Extend MCP tools to System1, vector DB, etc.
2. **Enhanced Visualizations**: Add PieChart, AreaChart, ScatterPlot
3. **Advanced Aggregations**: Support complex grouping and calculations
4. **User Preferences UI**: Allow users to set preferences in UI
5. **Query Templates**: Pre-built queries for common scenarios
6. **Export Functionality**: Download charts/data as images/CSV
7. **Collaboration**: Share analytical threads with team members

## References

- [C1 by Thesys Documentation](https://thesys.dev)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- [Strategist API Documentation](../prd/strategis-facebook-metrics-endpoint.md)



