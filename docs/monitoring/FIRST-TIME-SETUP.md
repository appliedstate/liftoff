# First Time Setup Guide

**If you see "No data found" or all zeros in reports, you need to ingest data first!**

---

## 🚨 The Problem

The database starts **empty**. Query scripts will show:
- "No data found in campaign_index"
- All zeros ($0.00 spend, $0.00 revenue)
- "No campaign launches found"

**This is normal** - you just need to ingest data first!

---

## ✅ Solution: Ingest Data

### Step 1: Verify Environment

```bash
ssh root@5.78.105.235
cd /opt/liftoff/backend

# Check environment variables
echo $IX_ID_EMAIL
echo $MONITORING_DB_PATH

# If missing, export them:
export IX_ID_EMAIL="roach@interlincx.com"
export IX_ID_PASSWORD="<password>"
export STRATEGIS_API_BASE_URL="https://strategis.lincx.in"
export IX_ID_BASE_URL="https://ix-id.lincx.la"
export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb"
```

### Step 2: Test API Connection

```bash
npm run monitor:test-endpoints
```

**Expected**: Should show success/failure for each endpoint.

**If 401 errors**: Check credentials  
**If 502 errors**: API server issue (may need to wait or contact Devin)

### Step 3: Ingest Data for Today

```bash
# Ingest campaign data (this pulls from all APIs)
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)

# Ingest session metrics
npm run monitor:ingest-sessions -- --date=$(date -u +%Y-%m-%d)

# Track campaign launches
npm run monitor:track-launches -- $(date -u +%Y-%m-%d)
```

**Expected**: Should see progress logs and "Success" messages.

**Time**: May take 1-5 minutes depending on data volume.

### Step 4: Verify Data Exists

```bash
# Check what dates have data
npm run monitor:check-dates

# Should now show dates with data
```

### Step 5: Run Analysis

```bash
# Now these should work!
npm run monitor:daily-pl
npm run monitor:launch-velocity -- 7
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)
```

---

## 📅 Ingesting Historical Data

### Single Date

```bash
npm run monitor:ingest-campaigns -- --mode=remote --date=2025-11-22
npm run monitor:ingest-sessions -- --date=2025-11-22
npm run monitor:track-launches -- 2025-11-22
```

### Date Range (Bulk)

```bash
# Ingest Nov 1 - Nov 23
npm run monitor:bulk-ingest -- 2025-11-01 2025-11-23

# This will ingest campaign data for each date
# Then run track-launches for each date manually, or:
for date in $(seq -f "2025-11-%02g" 1 23); do
  npm run monitor:track-launches -- $date
done
```

---

## 🔄 Daily Workflow

Once initial setup is done, daily workflow is:

```bash
# 1. Ingest today's data (or run via cron)
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
npm run monitor:ingest-sessions -- --date=$(date -u +%Y-%m-%d)
npm run monitor:track-launches -- $(date -u +%Y-%m-%d)

# 2. Analyze
npm run monitor:daily-pl
npm run monitor:launch-velocity -- 7
```

---

## ❌ Troubleshooting

### "No data found" after ingestion

**Check**:
```bash
# Verify ingestion succeeded
npm run monitor:check-dates

# Check for errors in ingestion logs
tail -f /opt/liftoff/logs/campaign-index.log
```

**Fix**: Re-run ingestion if it failed.

### "401 Unauthorized" during ingestion

**Fix**: Check credentials:
```bash
echo $IX_ID_EMAIL
echo $IX_ID_PASSWORD
```

### "502 Bad Gateway" during ingestion

**Fix**: API server issue. Some endpoints may fail (like Taboola spend), but others should work. Check:
```bash
npm run monitor:test-endpoints
```

### Database file doesn't exist

**Fix**: First ingestion will create it automatically. If it fails:
```bash
mkdir -p /opt/liftoff/data
chmod 755 /opt/liftoff/data
```

---

## ✅ Success Checklist

After setup, verify:

- [ ] `npm run monitor:check-dates` shows dates with data
- [ ] `npm run monitor:daily-pl` shows non-zero values
- [ ] `npm run monitor:launch-velocity -- 7` shows launches (or "No launches" if none)
- [ ] Database file exists: `ls -lh /opt/liftoff/data/monitoring.duckdb`

---

**Remember**: Database starts empty. Always ingest data before querying!

