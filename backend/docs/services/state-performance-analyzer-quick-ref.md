# State Performance Analyzer - Quick Reference

## One-Line Command

```bash
npm run system1:state-perf -- "<slug1>" ["<slug2>" ...]
```

## Examples

### Single Slug
```bash
npm run system1:state-perf -- "health/paid-depression-clinical-trials-up-to-3000-en-us/"
```

### Cluster (2-6 slugs)
```bash
npm run system1:state-perf -- \
  "health/paid-depression-clinical-trials-up-to-3000-en-us/" \
  "health/exploring-innovative-treatments-in-depression-clinical-trials-en-us/" \
  "health/anxiety-trials-and-treatments-en-us/"
```

## Output

- **Console**: Summary table + detailed state breakdown
- **CSV**: `backend/runs/system1/2025-11-07/depression_cluster_state_analysis_[timestamp].csv`

## Metrics Provided

For each state:
- Revenue
- RPC (Revenue Per Click)
- RPS (Revenue Per Search)
- Clicks
- Searches
- Keywords

## Agent Workflow

1. User provides slug(s) or cluster definition
2. Run command with slug(s)
3. Read console output for immediate results
4. Reference CSV for detailed data
5. Optionally aggregate: `npx ts-node src/scripts/system1/aggregate_states_from_csv.ts [csv_file]`

