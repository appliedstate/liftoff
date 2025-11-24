# DuckDB Usage Clarification

## ⚠️ CRITICAL: We Use Node.js Library, NOT CLI

**The system uses the DuckDB Node.js library**, not the DuckDB CLI.

### ✅ Correct Approach

**Access database via npm scripts**:
```bash
# Query data using npm scripts
npm run monitor:daily-pl
npm run monitor:check-dates
npm run monitor:date-launches -- 2025-11-22

# These scripts use the DuckDB Node.js library internally
```

**How it works**:
- Scripts use `duckdb` npm package (installed via `npm install`)
- Database file: `/opt/liftoff/data/monitoring.duckdb`
- All access through Node.js code in `backend/src/lib/monitoringDb.ts`

### ❌ Wrong Approach

**DO NOT install DuckDB CLI**:
```bash
# ❌ DON'T DO THIS
apt-get install duckdb
duckdb /opt/liftoff/data/monitoring.duckdb "SELECT ..."
```

**Why not**:
- DuckDB CLI is not installed on the server
- We don't need it - all access is through Node.js
- Installing CLI won't help and may cause confusion

## How Database Access Works

### Code Path

```
npm run monitor:daily-pl
  ↓
reportDailyPL.ts (Node.js script)
  ↓
import { createMonitoringConnection } from '../../lib/monitoringDb'
  ↓
monitoringDb.ts
  ↓
import duckdb from 'duckdb'  // Node.js library
  ↓
const db = new duckdb.Database('/opt/liftoff/data/monitoring.duckdb')
  ↓
conn.all('SELECT ...', callback)
```

### Installation

**DuckDB is installed as npm package**:
```bash
cd /opt/liftoff/backend
npm install  # Installs duckdb@1.4.1 (or similar)

# Verify installation
npm list duckdb
# Should show: duckdb@1.4.1
```

**No system-level installation needed**:
- No `apt-get install duckdb` required
- No CLI commands needed
- Everything works through Node.js

## Troubleshooting

### "Command 'duckdb' not found"

**This is expected** - we don't use the CLI.

**Solution**: Use npm scripts instead:
```bash
# Instead of: duckdb ... "SELECT ..."
# Use:
npm run monitor:check-dates
```

### "Cannot find module 'duckdb'"

**This means npm package not installed**:
```bash
cd /opt/liftoff/backend
npm install
npm list duckdb  # Verify it's installed
```

### Database File Not Found

**Check file exists**:
```bash
ls -lh /opt/liftoff/data/monitoring.duckdb

# If missing, run ingestion first:
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
```

## Direct Database Queries

If you need to query the database directly (not recommended, but possible):

**Option 1: Create a custom script** (recommended):
```typescript
// backend/src/scripts/monitoring/customQuery.ts
import { createMonitoringConnection, allRows, closeConnection } from '../../lib/monitoringDb';

async function main() {
  const conn = createMonitoringConnection();
  const results = await allRows(conn, 'SELECT * FROM campaign_index LIMIT 10');
  console.log(results);
  closeConnection(conn);
}

main();
```

Then run: `npm run ts-node src/scripts/monitoring/customQuery.ts`

**Option 2: Use existing query scripts**:
- Modify existing scripts
- Or use `npm run monitor:check-dates` and similar

**Option 3: Install DuckDB CLI** (not recommended, but works):
```bash
apt-get install -y duckdb
duckdb /opt/liftoff/data/monitoring.duckdb
```

But this is unnecessary - use npm scripts instead.

## Summary

- ✅ **Use**: `npm run monitor:*` scripts
- ✅ **Library**: DuckDB Node.js library (`duckdb` npm package)
- ❌ **Don't use**: DuckDB CLI (`duckdb` command)
- ❌ **Don't install**: `apt-get install duckdb` (not needed)

All database access is through Node.js scripts using the npm package.

