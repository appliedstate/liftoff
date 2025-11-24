# System Verification Checklist

Run these commands to verify the system is ready for an agent to use.

---

## ✅ Local Verification (Can run anywhere)

### 1. Verify Scripts Exist
```bash
cd /opt/liftoff/backend
ls -la src/scripts/monitoring/ | grep -E "(ingestCampaignIndex|reportDailyPL|queryBuyer)"
```

**Expected**: Should see all monitoring scripts listed.

### 2. Verify npm Scripts Defined
```bash
cd /opt/liftoff/backend
npm run | grep monitor:
```

**Expected**: Should see all `monitor:*` scripts listed.

### 3. Verify DuckDB Package Installed
```bash
cd /opt/liftoff/backend
npm list duckdb
```

**Expected**: Should show `duckdb@1.4.1` (or similar version).

---

## ✅ Server Verification (Run on Hetzner server)

### 1. Verify Environment Variables
```bash
ssh root@5.78.105.235
cd /opt/liftoff/backend

echo "IX_ID_EMAIL: $IX_ID_EMAIL"
echo "MONITORING_DB_PATH: $MONITORING_DB_PATH"
echo "STRATEGIS_API_BASE_URL: $STRATEGIS_API_BASE_URL"
```

**Expected**: All variables should be set (not empty).

**If missing**, export them:
```bash
export IX_ID_EMAIL="roach@interlincx.com"
export IX_ID_PASSWORD="<password>"
export STRATEGIS_API_BASE_URL="https://strategis.lincx.in"
export IX_ID_BASE_URL="https://ix-id.lincx.la"
export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb"
```

### 2. Verify Database File Exists
```bash
ls -lh /opt/liftoff/data/monitoring.duckdb
```

**Expected**: Should show the database file with size > 0.

**If missing**, run ingestion first:
```bash
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
```

### 3. Test API Connection
```bash
cd /opt/liftoff/backend
npm run monitor:test-endpoints
```

**Expected**: Should show success/failure for each endpoint.

**Common issues**:
- ❌ 401 Unauthorized → Check `IX_ID_EMAIL` and `IX_ID_PASSWORD`
- ❌ 502 Bad Gateway → API server issue (check with Devin)
- ❌ Network error → Check server connectivity

### 4. Check Existing Data
```bash
npm run monitor:check-dates
```

**Expected**: Should list dates that have data in `campaign_index`.

**If empty**, need to ingest data:
```bash
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
```

### 5. Test Query Scripts
```bash
# Test P&L report (uses yesterday's date by default)
npm run monitor:daily-pl

# Test launch velocity
npm run monitor:launch-velocity -- 7

# Test date launches
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)
```

**Expected**: Should output formatted reports (even if empty).

**If errors**:
- "Table does not exist" → Run ingestion first
- "Cannot find module" → Run `npm install`
- "Permission denied" → Check file permissions

---

## ✅ Full System Test

### Complete Workflow Test
```bash
cd /opt/liftoff/backend

# 1. Pull latest code
git pull origin main
npm install

# 2. Verify environment
echo $IX_ID_EMAIL
echo $MONITORING_DB_PATH

# 3. Test API
npm run monitor:test-endpoints

# 4. Check data
npm run monitor:check-dates

# 5. Ingest today's data (if needed)
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)

# 6. Generate reports
npm run monitor:daily-pl
npm run monitor:launch-velocity -- 7
```

**Expected**: All commands should complete without errors.

---

## ❌ Common Issues & Fixes

### Issue: "Command 'duckdb' not found"
**Fix**: This is expected! Use `npm run monitor:*` scripts instead.

### Issue: "Cannot find module 'duckdb'"
**Fix**: 
```bash
cd /opt/liftoff/backend
npm install
```

### Issue: "Table does not exist"
**Fix**: Run ingestion first:
```bash
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
```

### Issue: "IX_ID_EMAIL and IX_ID_PASSWORD must be set"
**Fix**: Export environment variables (see step 1 above).

### Issue: "Permission denied" on database file
**Fix**:
```bash
chmod 644 /opt/liftoff/data/monitoring.duckdb
chown root:root /opt/liftoff/data/monitoring.duckdb
```

### Issue: "401 Unauthorized" from API
**Fix**: Check credentials are correct:
```bash
echo $IX_ID_EMAIL
echo $IX_ID_PASSWORD
```

### Issue: "502 Bad Gateway" from API
**Fix**: API server issue - check with Devin or wait for recovery.

---

## ✅ Success Criteria

System is ready when:
- ✅ All npm scripts are defined (`npm run | grep monitor:` shows all scripts)
- ✅ DuckDB package installed (`npm list duckdb` shows version)
- ✅ Environment variables set (all non-empty)
- ✅ Database file exists (`ls -lh` shows file)
- ✅ API connection works (`npm run monitor:test-endpoints` succeeds)
- ✅ Query scripts work (`npm run monitor:check-dates` runs without errors)

---

## 🚀 Quick Start After Verification

Once verified, agent can immediately:

```bash
# See what buyers did yesterday
npm run monitor:daily-pl

# See all launches today
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)

# Analyze specific buyer
npm run monitor:buyer-activity -- Cook taboola 2
```

---

**See also**: 
- `docs/monitoring/agent-quick-start.md` - Full quick start guide
- `docs/monitoring/AGENT-REFERENCE.md` - Command reference
- `docs/monitoring/duckdb-usage-clarification.md` - DuckDB usage details

