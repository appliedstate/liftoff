# Terminal-Strategist Integration Runbook

## Document Purpose
This runbook provides operational procedures for managing the Terminal-Strategist integration in production. It covers monitoring, troubleshooting, incident response, and maintenance procedures.

**Audience**: On-call engineers, operations team, media buyers

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Monitoring & Alerts](#monitoring--alerts)
3. [Daily Operations](#daily-operations)
4. [Troubleshooting](#troubleshooting)
5. [Incident Response](#incident-response)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Escalation Procedures](#escalation-procedures)

---

## System Overview

### Architecture Diagram
```
Strategist (Liftoff)          Terminal (strateg.is)          Meta Ads API
     │                              │                              │
     │ 1. Generate Recommendations │                              │
     │──────────────────────────────>│                              │
     │                              │                              │
     │ 2. Execute (async)           │                              │
     │──────────────────────────────>│                              │
     │                              │ 3. Apply Changes             │
     │                              │──────────────────────────────>│
     │                              │                              │
     │ 4. Poll Job Status           │                              │
     │<──────────────────────────────│                              │
     │                              │                              │
```

### Key Components
- **Strategist**: Decision engine in Liftoff (`/api/strategist/*`)
- **Terminal**: Execution engine in strateg.is (`/api/terminal/*`)
- **State Storage**: Redis (cooldowns) + PostgreSQL (policy, audit logs)
- **Meta Ads API**: Facebook's advertising API

### Data Flow
1. Strategist analyzes performance data → generates recommendations
2. Strategist calls Terminal `/execute` → returns job ID
3. Terminal validates guards → executes via Meta API
4. Terminal updates cooldowns → logs actions
5. Strategist polls job status → updates recommendation tracking

---

## Monitoring & Alerts

### Key Metrics

#### Strategist Metrics
- **Recommendation Generation Rate**: `strategist.recommendations.count`
- **Execution Request Rate**: `strategist.execute.requests.count`
- **Execution Success Rate**: `strategist.execute.success.rate`
- **Terminal API Latency**: `strategist.terminal_api.latency.p99`
- **Terminal API Error Rate**: `strategist.terminal_api.errors.rate`

#### Terminal Metrics
- **Job Processing Rate**: `terminal.jobs.processed.count`
- **Job Success Rate**: `terminal.jobs.success.rate`
- **Guard Rejection Rate**: `terminal.guards.rejected.count`
- **Meta API Latency**: `terminal.meta_api.latency.p99`
- **Meta API Error Rate**: `terminal.meta_api.errors.rate`

#### Business Metrics
- **Decisions Executed**: Count of successful executions
- **Budget Changes**: Total budget delta per day
- **Cooldown Violations**: Attempts blocked by cooldowns
- **Portfolio Impact**: Net margin delta from automation

### Alert Thresholds

#### Critical Alerts (Page On-Call)
- Terminal API unavailable > 5 minutes
- Execution success rate < 90% for 15 minutes
- Meta API error rate > 10% for 10 minutes
- Guard violations detected (unexpected failures)

#### Warning Alerts (Slack/Email)
- Terminal API latency > 10s (p99)
- Cooldown cache stale > 10 minutes
- Job processing backlog > 100 jobs
- Execution success rate < 95% for 1 hour

### Dashboard Queries

**Grafana/Prometheus Queries**:
```promql
# Execution success rate (5m window)
rate(strategist_execute_success_total[5m]) / rate(strategist_execute_requests_total[5m])

# Terminal API latency (p99)
histogram_quantile(0.99, rate(strategist_terminal_api_duration_seconds_bucket[5m]))

# Guard rejection rate
rate(terminal_guards_rejected_total[5m]) / rate(terminal_jobs_received_total[5m])
```

---

## Daily Operations

### Morning Checklist (07:00-08:00 UTC)

1. **Check System Health**
   ```bash
   # Check Strategist health
   curl https://api.liftoff.com/api/strategist/health
   
   # Check Terminal health
   curl https://terminal-api.strategis.internal/api/terminal/health
   ```

2. **Review Overnight Executions**
   - Check execution logs for errors
   - Review guard rejections
   - Verify cooldowns updated correctly

3. **Validate Data Freshness**
   ```bash
   # Check latest snapshot
   curl "https://api.liftoff.com/api/strategist/query?date=$(date -d yesterday +%Y-%m-%d)&level=adset&limit=1"
   ```

4. **Review Alerts**
   - Check for any overnight alerts
   - Review error rates
   - Check Meta API rate limit usage

### Daily Execution Flow

**Expected Flow**:
1. **07:00 UTC**: Reconciled data available
2. **07:15 UTC**: Strategist generates recommendations
3. **07:20 UTC**: Recommendations executed via Terminal
4. **07:25 UTC**: Terminal completes Meta API calls
5. **07:30 UTC**: Cooldowns updated, logs written

**Verification Steps**:
```bash
# 1. Check recommendations generated
curl "https://api.liftoff.com/api/strategist/recommendations?date=$(date -d yesterday +%Y-%m-%d)&level=adset" | jq '.data | length'

# 2. Check execution jobs
curl "https://api.liftoff.com/api/strategist/execute-recommendations" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"recommendations": [...], "dryRun": true}'

# 3. Check Terminal state
curl "https://terminal-api.strategis.internal/api/terminal/state" \
  -H "Authorization: Bearer $TERMINAL_TOKEN"
```

### Weekly Review (Monday Morning)

1. **Performance Review**
   - Total decisions executed
   - Success rate trends
   - Guard effectiveness
   - Portfolio impact

2. **Policy Review**
   - Policy state changes
   - Learning loop outcomes
   - Threshold adjustments

3. **Incident Review**
   - Any incidents from past week
   - Root cause analysis
   - Process improvements

---

## Troubleshooting

### Common Issues

#### Issue 1: Terminal API Unavailable

**Symptoms**:
- `503 Service Unavailable` errors
- Timeout errors from Strategist
- No job status updates

**Diagnosis**:
```bash
# Check Terminal health
curl -v https://terminal-api.strategis.internal/api/terminal/health

# Check network connectivity
ping terminal-api.strategis.internal

# Check authentication
curl -H "Authorization: Bearer $TOKEN" \
  https://terminal-api.strategis.internal/api/terminal/state
```

**Resolution**:
1. Check Terminal service status in strateg.is infrastructure
2. Verify network connectivity between Liftoff and strateg.is
3. Check authentication tokens
4. Review Terminal service logs
5. **Fallback**: Disable automatic execution, use manual mode

#### Issue 2: High Guard Rejection Rate

**Symptoms**:
- Many recommendations rejected
- Cooldown violations
- Freeze period blocks

**Diagnosis**:
```bash
# Check cooldown state
curl https://terminal-api.strategis.internal/api/terminal/state | jq '.cooldowns'

# Check recent executions
curl https://terminal-api.strategis.internal/api/terminal/jobs | jq '.[] | select(.status == "completed")'
```

**Resolution**:
1. Review cooldown periods — may be too aggressive
2. Check freeze period configuration
3. Verify launch dates are correct
4. Review guard thresholds
5. **Action**: Adjust cooldown periods if needed

#### Issue 3: Meta API Rate Limits

**Symptoms**:
- `429 Too Many Requests` errors
- Slow job processing
- Timeout errors

**Diagnosis**:
```bash
# Check Meta API rate limit headers
curl -v https://terminal-api.strategis.internal/api/terminal/jobs/$JOB_ID \
  | grep -i "x-app-usage\|x-business-use-case-usage"
```

**Resolution**:
1. Reduce batch sizes
2. Add delays between Meta API calls
3. Implement exponential backoff
4. **Action**: Contact Meta support if persistent

#### Issue 4: Stale Cooldown Cache

**Symptoms**:
- Recommendations generated for entities in cooldown
- Inconsistent state between Strategist and Terminal

**Diagnosis**:
```bash
# Check cache TTL
# Review cooldownCache implementation

# Force cache refresh
curl -X POST https://api.liftoff.com/api/strategist/admin/refresh-cooldowns
```

**Resolution**:
1. Reduce cache TTL (currently 5 minutes)
2. Implement cache invalidation events
3. Add cache staleness monitoring
4. **Action**: Manual cache refresh if needed

#### Issue 5: Job Stuck in "Running" State

**Symptoms**:
- Job status not updating
- No completion after expected time
- Terminal logs show no activity

**Diagnosis**:
```bash
# Check job status
curl https://terminal-api.strategis.internal/api/terminal/jobs/$JOB_ID

# Check Terminal worker logs
# Review background job processor
```

**Resolution**:
1. Check Terminal worker processes
2. Review job queue depth
3. Check for deadlocks or stuck processes
4. **Action**: Restart Terminal workers if needed
5. **Manual**: Mark job as failed, retry if needed

### Debugging Commands

```bash
# Get execution trace for correlation ID
grep "correlation_id=abc-123" /var/log/strategist/strategist.log

# Check Terminal state for specific entity
curl "https://terminal-api.strategis.internal/api/terminal/state" | \
  jq '.cooldowns | to_entries | map(select(.key | contains("adset:123456")))'

# Simulate execution (dry-run)
curl -X POST https://api.liftoff.com/api/strategist/execute-recommendations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendations": [...],
    "dryRun": true,
    "preValidate": true
  }'

# Check recent decisions
ls -lt /data/decisions/$(date +%Y-%m-%d)/ | head -10

# View decision details
cat /data/decisions/$(date +%Y-%m-%d)/decisions_*.jsonl | jq 'select(.id == "123456")'
```

---

## Incident Response

### Severity Levels

#### P0 - Critical (Page Immediately)
- Terminal service down
- All executions failing
- Meta API authentication failure
- Data corruption detected

#### P1 - High (Respond within 1 hour)
- >50% execution failure rate
- Terminal API degraded
- Cooldown cache stale >30 minutes
- Guard violations detected

#### P2 - Medium (Respond within 4 hours)
- <10% execution failure rate
- Increased latency
- Non-critical errors

#### P3 - Low (Respond within 24 hours)
- Minor issues
- Performance degradation
- Non-blocking errors

### Incident Response Playbook

#### Step 1: Assess Impact
```bash
# Check current error rate
curl https://api.liftoff.com/api/strategist/metrics | jq '.execution_error_rate'

# Check affected entities
curl "https://terminal-api.strategis.internal/api/terminal/jobs?status=failed" | \
  jq '.[] | .decisions[] | select(.status == "failed")'
```

#### Step 2: Mitigate
- **Disable automatic execution**: Set feature flag to false
- **Enable dry-run mode**: All executions in dry-run
- **Manual execution**: Use manual mode for critical changes

#### Step 3: Investigate
- Review logs for error patterns
- Check system health metrics
- Verify external dependencies (Meta API, network)

#### Step 4: Resolve
- Apply fix (code change, config update, restart service)
- Verify fix with test execution
- Re-enable automatic execution gradually

#### Step 5: Post-Mortem
- Document root cause
- Identify prevention measures
- Update runbook with new procedures

### Rollback Procedures

**Disable Integration**:
```bash
# Set environment variable
export STRATEGIST_TERMINAL_ENABLED=false

# Or disable via feature flag
curl -X POST https://api.liftoff.com/api/strategist/admin/feature-flags \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"terminal_integration": false}'
```

**Manual Execution Mode**:
- Use Strategist `/recommendations` endpoint
- Review recommendations manually
- Execute via Terminal UI or Meta Ads Manager
- Update cooldowns manually if needed

---

## Maintenance Procedures

### Weekly Maintenance

**Monday Morning**:
1. Review execution metrics from past week
2. Check for stuck jobs
3. Clean up old job records (>30 days)
4. Review and update guard thresholds if needed

**Friday Afternoon**:
1. Review policy state updates
2. Check learning loop outcomes
3. Prepare weekly report

### Monthly Maintenance

1. **Policy State Review**
   - Review policy state changes
   - Validate learning loop effectiveness
   - Adjust thresholds if needed

2. **Performance Optimization**
   - Review slow queries
   - Optimize cache TTLs
   - Review batch sizes

3. **Security Review**
   - Rotate API keys
   - Review access logs
   - Audit permissions

### Database Maintenance

**Cleanup Old Data**:
```sql
-- Clean up jobs older than 90 days
DELETE FROM terminal_jobs WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old decisions
INSERT INTO decisions_archive SELECT * FROM decisions WHERE date < CURRENT_DATE - INTERVAL '90 days';
DELETE FROM decisions WHERE date < CURRENT_DATE - INTERVAL '90 days';
```

**Cooldown Cleanup**:
```bash
# Remove expired cooldowns (handled automatically by Redis TTL)
# Manual cleanup if needed:
redis-cli KEYS "cooldown:*" | xargs redis-cli DEL
```

---

## Escalation Procedures

### Escalation Path

1. **On-Call Engineer** (First responder)
   - Initial diagnosis
   - Basic troubleshooting
   - Mitigation steps

2. **Engineering Lead** (If unresolved in 30 minutes)
   - Deep technical investigation
   - Code changes if needed
   - Coordination with strateg.is team

3. **Product/Operations** (If business impact)
   - Communication with stakeholders
   - Manual workarounds
   - Process adjustments

4. **Meta Support** (If Meta API issues)
   - Contact Meta Ads API support
   - Escalate rate limit issues
   - Report bugs

### Contact Information

- **On-Call**: Check PagerDuty/Slack #oncall
- **Engineering Lead**: [Contact Info]
- **strateg.is Team**: [Contact Info]
- **Meta Support**: https://developers.facebook.com/support

---

## Appendix

### Environment Variables

```bash
# Strategist Configuration
TERMINAL_API_BASE_URL=https://terminal-api.strategis.internal
TERMINAL_API_KEY=<service-token>
TERMINAL_API_TIMEOUT=30000
STRATEGIST_EXEC_DRY_RUN=false
STRATEGIST_TERMINAL_ENABLED=true

# Terminal Configuration (strateg.is)
META_API_ACCESS_TOKEN=<token>
META_API_VERSION=v18.0
TERMINAL_COOLDOWN_HOURS=24
TERMINAL_FREEZE_HOURS=72
```

### Useful Scripts

**Check Integration Health**:
```bash
#!/bin/bash
# scripts/check-integration-health.sh

echo "Checking Strategist health..."
curl -s https://api.liftoff.com/api/strategist/health | jq

echo "Checking Terminal health..."
curl -s -H "Authorization: Bearer $TERMINAL_API_KEY" \
  https://terminal-api.strategis.internal/api/terminal/health | jq

echo "Checking recent executions..."
curl -s "https://api.liftoff.com/api/strategist/metrics" | jq '.execution_stats'
```

**Force Cache Refresh**:
```bash
#!/bin/bash
# scripts/refresh-cooldown-cache.sh

curl -X POST https://api.liftoff.com/api/strategist/admin/refresh-cooldowns \
  -H "Authorization: Bearer $TOKEN"
```

---

## References

- Integration Playbook: `docs/operations/terminal-strategist-integration-playbook.md`
- Q&A Document: `docs/prd/terminal-strategist-integration-qa.md`
- Terminal PRD: `docs/prd/terminal-facebook-bidder-prd.md`



