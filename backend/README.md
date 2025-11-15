## Strategist Backend

### Dev
```bash
cd backend
npm run dev
```

### Day-level ingest
```bash
npm run snapshots:ingest-day -- --start=YYYY-MM-DD --end=YYYY-MM-DD --levels=adset,campaign
```

### Query
```bash
# Raw day
curl -s "http://localhost:3001/api/strategist/query?source=day&level=adset&date=2025-10-24&no_raw=1" | jq .

# Day + reconciled overlay
curl -s "http://localhost:3001/api/strategist/query?source=day&overlay=1&level=adset&date=2025-10-24&no_raw=1" | jq .

# Reconciled only
curl -s "http://localhost:3001/api/strategist/query?source=reconciled&level=adset&date=2025-10-24&no_raw=1" | jq .

# Select fields
curl -s "http://localhost:3001/api/strategist/query?source=day&level=campaign&date=2025-10-24&fields=date,campaign_id,spend_usd,revenue_usd,roas&no_raw=1" | jq .
```

### Validation
```bash
npm run snapshots:validate -- --date=YYYY-MM-DD

curl -s "http://localhost:3001/api/strategist/validate?date=YYYY-MM-DD" | jq .
curl -s "http://localhost:3001/api/strategist/slo?date=YYYY-MM-DD&level=adset" | jq .
```

### Scheduling (PM2)
```bash
pm2 start ecosystem.config.js
pm2 save
```
`strategist-daily-ingest` runs daily at 06:00 server time. `strategist-backfill-tplus1` runs at 08:00 for T+1 refresh. Configure `DAY_SETTLE_HOUR_LOCAL` and ENV as needed.

### Vector Search (System1) — Version B
Enable semantic exploration of System1 keyword phrases with revenue-aware ranking using pgvector.

Prereqs:
- Set `PGVECTOR_URL` (e.g., `postgres://postgres:postgres@localhost:5432/liftoff`)
- Set `OPENAI_API_KEY`
- Optional: adjust `EMBEDDING_MODEL`, `EMBEDDING_BATCH_SIZE`, `EMBEDDING_CONCURRENCY`

Local Postgres + pgvector (optional):
```bash
cd backend
docker compose -f docker-compose.pgvector.yml up -d

# one-time setup (extension, table, indexes)
npm run ts-node -- src/scripts/vector/setup_pgvector.ts
```

Embed + index from latest run:
```bash
# Example input path
RUN_DATE=2025-11-06
INPUT="backend/runs/system1/$RUN_DATE/angle_full.csv"

# Run embedding job (idempotent, caches by hash_key)
npm run ts-node -- src/scripts/vector/embed_keywords.ts --runDate $RUN_DATE --input "$INPUT"
```

Sanity test:
```bash
npm run ts-node -- src/scripts/vector/test_search.ts --q "nissan rogue lease"
```

API:
```bash
# After starting the server
curl -s "http://localhost:3001/api/vector/search?q=nissan%20rogue&k=50" | jq .
```

Notes:
- Score = 0.7 * cosine + 0.3 * sigmoid(revenue / revenue_p95)
- Filters: `angle`, `category`, `minRevenue`, `runDate`
- Rebuild IVFFLAT index: `REINDEX INDEX CONCURRENTLY s1_embeddings_embedding_idx;`

### State Performance Analyzer (System1)

Analyze state-level performance metrics (revenue, RPC, RPS, clicks, searches) for individual slugs or clusters.

**Quick Command:**
```bash
# Single slug
npm run system1:state-perf -- "health/paid-depression-clinical-trials-up-to-3000-en-us/"

# Cluster (multiple slugs)
npm run system1:state-perf -- "health/slug1/" "health/slug2/" "health/slug3/"
```

**Output:**
- Console: Summary by slug + detailed state breakdown
- CSV: `backend/runs/system1/2025-11-07/depression_cluster_state_analysis_[timestamp].csv`

**Aggregate states for cluster:**
```bash
npx ts-node src/scripts/system1/aggregate_states_from_csv.ts runs/system1/2025-11-07/[filename].csv
```

**Generate charts:**
```bash
npm run system1:state-chart -- runs/system1/2025-11-07/[filename].csv
```

See `docs/services/state-performance-analyzer.md` for full documentation.

### ENV
See `ENV_TEMPLATE` for all supported variables:
- STRATEGIS_* knobs (base URL, token, org, adSource)
- Timeouts, retries, backoff, concurrency
- S1: STRATEGIS_NETWORK_ID, STRATEGIS_TIMEZONE
- Pagination: STRATEGIS_PAGE_SIZE, STRATEGIS_MAX_PAGES
- Rate limiting & breaker: STRATEGIS_RPS, STRATEGIS_BURST, STRATEGIS_CB_FAILS, STRATEGIS_CB_COOLDOWN_MS
- Snapshots base dirs and settle gate

SLO:
- SLO_MAX_NULL_RATE, SLO_MIN_ROWS, SLO_REQUIRE_RECONCILED_OK, SLO_MAX_RECONCILED_MISS_PCT, SLO_EPSILON, SLO_BLOCK_DECISIONS

Global switches:
- STRATEGIST_OVERLAY_DISABLED=true  # kill overlay globally
- STRATEGIST_FORCE_DAY=true        # force source=day for reads/decisions

Backfill:
- Use `npm run snapshots:backfill -- --start=YYYY-MM-DD --end=YYYY-MM-DD --levels=adset,campaign`
- Or POST /api/strategist/backfill { start, end, levels }

Autofix (self-healing):
- Runs every 30 minutes via PM2 (`strategist-autofix`) and replays the last N days that breach freshness/completeness SLOs.
- Manual run: `npm run snapshots:autofix`

Prune snapshots (retention):
- Manual run: `npm run snapshots:prune -- --max_gb=50 --retention_days=14 --dry_run=true`


