# Agent Quick Start Guide

**Purpose**: Get an agent up and running immediately to analyze buyer activity and pull data from APIs.

---

## ✅ System Status: READY

The system is **fully operational** and ready to:
- ✅ Pull data from Strategis APIs
- ✅ Track buyer activity across all networks
- ✅ Generate P&L reports
- ✅ Analyze campaign launches
- ✅ Query buyer-network-site activity

---

## 🚀 Immediate Actions (5 Minutes)

### 1. Verify Environment (On Hetzner Server)

```bash
ssh root@5.78.105.235
cd /opt/liftoff/backend

# Check environment variables
echo $IX_ID_EMAIL
echo $MONITORING_DB_PATH

# If not set, export them:
export IX_ID_EMAIL="roach@interlincx.com"
export IX_ID_PASSWORD="<password>"
export STRATEGIS_API_BASE_URL="https://strategis.lincx.in"
export IX_ID_BASE_URL="https://ix-id.lincx.la"
export MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb"
```

### 2. Pull Latest Code

```bash
cd /opt/liftoff/backend
git pull origin main
npm install  # If new dependencies added
```

### 3. Test API Connection

```bash
# Test all endpoints
npm run monitor:test-endpoints

# Should show success/failure for each endpoint
```

### 4. Check Existing Data

```bash
# See what dates have data
npm run monitor:check-dates

# Check recent launches
npm run monitor:launch-velocity -- 7
```

---

## 📊 Start Analyzing Buyer Activity (Right Now)

### Quick Analysis Commands

```bash
# 1. Get yesterday's P&L (all buyers, all networks)
npm run monitor:daily-pl

# 2. See all launches yesterday (by buyer, network, site)
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)

# 3. Analyze specific buyer (e.g., Cook's Taboola activity)
npm run monitor:buyer-activity -- Cook taboola 2

# 4. Get launch summary
npm run monitor:launches-summary -- $(date -u +%Y-%m-%d)
```

### Answer Common Questions

**"What did all buyers launch yesterday?"**
```bash
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)
```

**"What's our revenue by network?"**
```bash
npm run monitor:daily-pl
```

**"What is Cook doing on Taboola?"**
```bash
npm run monitor:buyer-activity -- Cook taboola 7  # Last 7 days
```

**"Who launched the most campaigns this week?"**
```bash
npm run monitor:launch-velocity -- 7
```

---

## 🔄 Start Automated Data Pulling

### Option 1: Manual Run (Test First)

```bash
# Pull today's campaign data
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)

# Pull today's session data
npm run monitor:ingest-sessions -- --date=$(date -u +%Y-%m-%d)

# Track today's launches
npm run monitor:track-launches -- $(date -u +%Y-%m-%d)
```

### Option 2: Set Up Cron Jobs (Automated)

```bash
# Edit crontab
crontab -e

# Add these lines (runs hourly):
20 * * * * cd /opt/liftoff/backend && MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" IX_ID_EMAIL="roach@interlincx.com" IX_ID_PASSWORD="<password>" STRATEGIS_API_BASE_URL="https://strategis.lincx.in" IX_ID_BASE_URL="https://ix-id.lincx.la" npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +\%Y-\%m-\%d) >> /opt/liftoff/logs/campaign-index.log 2>&1

25 * * * * cd /opt/liftoff/backend && MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" IX_ID_EMAIL="roach@interlincx.com" IX_ID_PASSWORD="<password>" STRATEGIS_API_BASE_URL="https://strategis.lincx.in" IX_ID_BASE_URL="https://ix-id.lincx.la" npm run monitor:ingest-sessions -- --date=$(date -u +\%Y-\%m-\%d) >> /opt/liftoff/logs/session-metrics.log 2>&1

30 * * * * cd /opt/liftoff/backend && MONITORING_DB_PATH="/opt/liftoff/data/monitoring.duckdb" IX_ID_EMAIL="roach@interlincx.com" IX_ID_PASSWORD="<password>" STRATEGIS_API_BASE_URL="https://strategis.lincx.in" IX_ID_BASE_URL="https://ix-id.lincx.la" npm run monitor:track-launches -- $(date -u +\%Y-\%m-\%d) >> /opt/liftoff/logs/launch-tracking.log 2>&1
```

---

## 🎯 What You Can Do Right Now

### 1. Analyze Current Buyer Activity

```bash
# See all buyers' activity yesterday
npm run monitor:daily-pl

# Breakdown by buyer → network → site
npm run monitor:date-launches -- $(date -u +%Y-%m-%d)
```

### 2. Track Specific Buyer

```bash
# All of Cook's activity (all networks, all sites)
npm run monitor:buyer-activity -- Cook mediago 2
npm run monitor:buyer-activity -- Cook taboola 2
npm run monitor:buyer-activity -- Cook facebook 2

# Specific buyer + network + site
npm run monitor:buyer-activity -- Cook taboola wesoughtit.com 2
```

### 3. Monitor Launch Velocity

```bash
# Who's launching the most?
npm run monitor:launch-velocity -- 7

# Daily breakdown
npm run monitor:today-launches -- $(date -u +%Y-%m-%d)
```

### 4. Performance Analysis

```bash
# P&L by network
npm run monitor:daily-pl | grep "P&L by Network"

# P&L by buyer
npm run monitor:daily-pl | grep "P&L by Buyer"

# Top performing combinations
npm run monitor:daily-pl | grep "Top 10"
```

---

## 🔍 Understanding the Data

### What Data is Available

**From `campaign_index`**:
- ✅ Revenue (from S1 reports)
- ✅ Spend (from Facebook/platform reports)
- ✅ Sessions, clicks, conversions
- ✅ Buyer attribution (owner, lane)
- ✅ Category, media source
- ✅ Site and S1 Google Account

**From `session_hourly_metrics`**:
- ✅ Hourly revenue by campaign
- ✅ RPC by click hour
- ✅ Session counts by hour

**From `campaign_launches`**:
- ✅ When campaigns were first detected
- ✅ Buyer attribution
- ✅ Network and site

### Data Coverage

**Platforms Covered**:
- ✅ Facebook (spend + revenue)
- ✅ MediaGo (spend + revenue)
- ✅ Taboola (revenue ✅, spend ❌ - 502 error)
- ✅ Outbrain (spend + revenue)
- ✅ NewsBreak (spend + revenue)
- ✅ Zemanta (spend + revenue)
- ✅ SmartNews (spend + revenue)

**Missing**:
- ⚠️ Taboola spend (502 errors from API)

---

## 🐛 Troubleshooting

### No Data Returned

```bash
# 1. Check if data exists
npm run monitor:check-dates

# 2. Check endpoint health
npm run monitor:test-endpoints

# 3. Try manual ingestion
npm run monitor:ingest-campaigns -- --mode=remote --date=$(date -u +%Y-%m-%d)
```

### API Errors

```bash
# Test authentication
npm run monitor:test-endpoints

# Check logs
tail -f /opt/liftoff/logs/campaign-index.log
```

### Wrong Dates

**Remember**: 
- Data is stored in **UTC**
- Scripts convert PST → UTC automatically
- Output shows both PST and UTC dates

If dates seem wrong, check the UTC date shown in output.

---

## 📚 Key Files to Know

**Start Here**:
- `docs/monitoring/complete-system-documentation.md` - Full system docs
- `backend/src/scripts/monitoring/reportDailyPL.ts` - P&L reports
- `backend/src/scripts/monitoring/queryBuyerNetworkSiteActivity.ts` - Buyer analysis

**Core Libraries**:
- `backend/src/lib/strategisApi.ts` - API client
- `backend/src/lib/monitoringDb.ts` - Database schema
- `backend/src/lib/dateUtils.ts` - Timezone utilities

---

## ✅ Checklist: Is System Ready?

- [x] **API Access**: Strategis API endpoints configured
- [x] **Authentication**: IX ID credentials set up
- [x] **Database**: DuckDB file exists and accessible
- [x] **Ingestion Scripts**: Can pull data from APIs
- [x] **Query Scripts**: Can analyze buyer activity
- [x] **Documentation**: Complete system docs available
- [x] **Timezone Handling**: PST → UTC conversion working
- [x] **Multi-Platform**: All platforms integrated (except Taboola spend)

**Status**: ✅ **READY TO USE**

---

## 🎬 Next Steps

1. **Test the system**: Run `npm run monitor:daily-pl` to see current data
2. **Pull fresh data**: Run ingestion scripts for today
3. **Analyze buyers**: Use `monitor:buyer-activity` to see what each buyer is doing
4. **Set up automation**: Configure cron jobs for hourly ingestion
5. **Monitor**: Check `endpoint_completeness` table for API health

---

## 💡 Pro Tips

1. **Always use UTC dates** when manually specifying dates: `$(date -u +%Y-%m-%d)`
2. **Check endpoint health** before troubleshooting: `npm run monitor:test-endpoints`
3. **Use `--debug` flag** for detailed output: `npm run monitor:buyer-activity -- Cook taboola 2 --debug`
4. **Query `campaign_index` directly** for custom analysis: Use DuckDB CLI or create new script
5. **Check `endpoint_completeness`** table to see which APIs are failing

---

**You're ready to go!** Start with `npm run monitor:daily-pl` to see what buyers are doing right now.

