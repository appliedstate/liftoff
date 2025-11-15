# State Performance Analyzer

## Overview

The **State Performance Analyzer** provides state-level performance metrics (revenue, RPC, RPS, clicks, searches, keywords) for individual slugs or clusters of slugs from the System1 dataset.

## Quick Start

### Basic Command

**Option 1: Direct command**
```bash
npx ts-node src/scripts/system1/state_analysis_for_slug_cluster.ts "<slug1>" ["<slug2>" ...]
```

**Option 2: Using npm script (recommended)**
```bash
npm run system1:state-perf -- "<slug1>" ["<slug2>" ...]
```

### Single Slug Analysis

```bash
npm run system1:state-perf -- "health/paid-depression-clinical-trials-up-to-3000-en-us/"
```

### Cluster Analysis (Multiple Slugs)

```bash
npm run system1:state-perf -- "health/slug1/" "health/slug2/" "health/slug3/"
```

## What It Does

1. **Analyzes** one or more slugs from the System1 dataset
2. **Aggregates** performance metrics by state (all 51 US states + DC)
3. **Calculates** RPC (Revenue Per Click) and RPS (Revenue Per Search) for each state
4. **Exports** results to CSV for further analysis

## Output Metrics

For each state, the service provides:
- **Revenue**: Total revenue generated
- **RPC**: Revenue Per Click ($)
- **RPS**: Revenue Per Search ($)
- **Clicks**: Total clicks
- **Searches**: Total searches
- **Keywords**: Number of unique keywords

## Example Use Cases

### 1. Analyze a Single High-Performing Slug

```bash
npm run system1:state-perf -- "personal-finance/best-checking-accounts-that-offer-cash-bonuses/"
```

**Use Case**: Understand which states drive the most revenue for a specific article.

### 2. Analyze a Topic Cluster

```bash
npm run system1:state-perf -- \
  "health/paid-depression-clinical-trials-up-to-3000-en-us/" \
  "health/exploring-innovative-treatments-in-depression-clinical-trials-en-us/" \
  "health/anxiety-trials-and-treatments-en-us/"
```

**Use Case**: Get combined state-level performance for all depression-related articles.

### 3. Compare Related Topics

```bash
npm run system1:state-perf -- \
  "health/how-paid-weight-loss-trials-offer-cutting-edge-health-solutions/" \
  "health/affordable-non-surgical-belly-fat-reduction-en-us/"
```

**Use Case**: Understand geographic performance patterns for weight loss content.

## Output Files

Results are automatically exported to:
```
backend/runs/system1/2025-11-07/depression_cluster_state_analysis_[timestamp].csv
```

The CSV contains:
- `rank`: Ranking by revenue
- `slug`: Article slug
- `state`: US state code (2 letters)
- `revenue`: Total revenue for that state-slug combination
- `rpc`: Revenue per click
- `rps`: Revenue per search
- `clicks`: Total clicks
- `searches`: Total searches
- `keywords`: Number of unique keywords

## Generate Visualizations

After running the state analysis, generate interactive charts:

```bash
npm run system1:state-chart -- runs/system1/2025-11-07/depression_cluster_state_analysis_[timestamp].csv
```

This creates an HTML file with Recharts visualizations showing:
- Revenue by State (bar chart)
- RPC by State (bar chart)
- RPS by State (bar chart)
- Summary statistics

Open the generated HTML file in your browser to view the charts.

## Console Output

The service displays:
1. **Summary by Slug**: Total metrics for each slug analyzed
2. **Detailed State Breakdown**: State-by-state metrics for each slug
3. **Aggregated Totals**: Combined metrics across all slugs

## Common Questions

### Q: How do I get aggregated state totals for a cluster?

After running the analysis, use the aggregation script:

```bash
npx ts-node src/scripts/system1/aggregate_states_from_csv.ts runs/system1/2025-11-07/[filename].csv
```

### Q: What if a slug doesn't have data for all states?

The service will only show states with data. Some slugs may have fewer than 51 states if there's no traffic/revenue for certain states.

### Q: Can I analyze slugs from different categories together?

Yes! The service works with any combination of slugs, regardless of topic or category.

## Agent Usage Pattern

For an AI agent, the typical workflow is:

1. **Identify slugs** to analyze (from user query or cluster definition)
2. **Run the analysis**:
   ```bash
   npm run system1:state-perf -- "<slug1>" ["<slug2>" ...]
   ```
3. **Read the console output** for immediate results
4. **Reference the CSV file** for detailed data or further analysis
5. **Optionally aggregate** if analyzing multiple slugs:
   ```bash
   npx ts-node src/scripts/system1/aggregate_states_from_csv.ts [csv_file]
   ```

## Example Agent Command

```bash
# User asks: "Show me state performance for depression clinical trials"
npm run system1:state-perf -- \
  "health/paid-depression-clinical-trials-up-to-3000-en-us/" \
  "health/exploring-innovative-treatments-in-depression-clinical-trials-en-us/" \
  "health/anxiety-trials-and-treatments-en-us/"
```

## Notes

- Slugs should include trailing slashes (e.g., `health/slug-name/`)
- The service automatically handles slug normalization (with/without trailing slashes)
- Results are sorted by revenue (highest to lowest)
- All revenue, clicks, and searches are aggregated from the System1 source CSV

