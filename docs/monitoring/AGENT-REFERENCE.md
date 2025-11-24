# Agent Reference Card - Quick Commands

## ⚠️ CRITICAL: DuckDB Usage

**We use DuckDB Node.js library, NOT CLI**

- ✅ **DO**: `npm run monitor:daily-pl`
- ❌ **DON'T**: `duckdb /opt/liftoff/data/monitoring.duckdb "SELECT ..."`

All database access is through npm scripts using the Node.js library.

---

## Quick Commands

### Check System Status
```bash
cd /opt/liftoff/backend
npm run monitor:check-dates          # See what dates have data
npm run monitor:test-endpoints      # Test API health
```

### Pull Data
```bash
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
npm run monitor:ingest-sessions -- --date=$(date -u +%Y-%m-%d)
npm run monitor:track-launches -- $(date -u +%Y-%m-%d)
```

### Analyze Buyers
```bash
npm run monitor:daily-pl                                    # Yesterday's P&L
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)      # Launches today
npm run monitor:buyer-activity -- Cook taboola 2           # Specific buyer
npm run monitor:launch-velocity -- 7                        # Launch trends
```

### Environment Setup
```bash
export IX_ID_EMAIL="roach@interlincx.com"
export IX_ID_PASSWORD="<password>"
export STRATEGIS_API_BASE_URL="https://strategis.lincx.in"
export IX_ID_BASE_URL="https://ix-id.lincx.la"
export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb"
```

---

## Common Questions

**"What did buyers do yesterday?"**
→ `npm run monitor:daily-pl`

**"Who launched campaigns today?"**
→ `npm run monitor:date-launches -- $(date -u +%Y-%m-%d)`

**"What is Cook doing on Taboola?"**
→ `npm run monitor:buyer-activity -- Cook taboola 7`

**"Is the database working?"**
→ `npm run monitor:check-dates` (NOT `duckdb` CLI)

---

## Troubleshooting

**"Command 'duckdb' not found"**
→ Expected! Use `npm run monitor:*` scripts instead.

**"Cannot find module 'duckdb'"**
→ Run `npm install` in `/opt/liftoff/backend`

**"No data found"**
→ Run ingestion: `npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)`

---

**See**: `docs/monitoring/duckdb-usage-clarification.md` for full details.

