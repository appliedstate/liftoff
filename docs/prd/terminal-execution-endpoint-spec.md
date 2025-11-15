# Terminal Execution Endpoint: Complete Specification

## Document Purpose
Complete specification for building the Terminal `/execute` endpoint in strategis-api, based on confirmed findings from codebase analysis.

**Status**: ✅ **READY TO IMPLEMENT**  
**Target**: `strategis-api/server/routes/terminal.js`  
**Date**: 2025-01-XX

---

## Endpoint Specification

### POST /api/terminal/execute

**Purpose**: Execute Decision objects by applying budget and bid cap changes via Meta Ads API.

**Authentication**: Same as existing strategis-api endpoints (JWT/API key)

**Request**:
```typescript
{
  decisions: Decision[];
  idempotencyKey: string;
  dryRun?: boolean;  // Default: false
  correlationId?: string;  // Optional: for tracing
}
```

**Decision Schema** (from Liftoff `backend/src/lib/decisions.ts`):
```typescript
{
  decision_id: string;  // Format: "${date}:${level}:${id}"
  id: string;  // Facebook campaign_id or adset_id
  level: 'adset' | 'campaign';
  account_id: string | null;
  action: 'bump_budget' | 'trim_budget' | 'hold';
  budget_multiplier: number | null;  // e.g., 1.2 for +20%
  bid_cap_multiplier: number | null;  // e.g., 0.9 for -10%
  spend_delta_usd?: number | null;
  reason: string;
  policy_version?: string;
  confidence?: number | null;
  date: string;  // YYYY-MM-DD
  snapshot_dir: string;
  created_at: string;  // ISO timestamp
}
```

**Response**:
```typescript
{
  executionId: string;  // UUID for this execution batch
  acceptedCount: number;
  rejectedCount: number;
  results: Array<{
    decision_id: string;
    status: 'success' | 'failed' | 'rejected';
    error?: string;
    guard_type?: 'cooldown' | 'freeze' | 'learning' | 'portfolio_cap' | 'validation';
    changes?: {
      current_budget?: number;
      new_budget?: number;
      current_bid_cap?: number;
      new_bid_cap?: number;
    };
  }>;
}
```

**HTTP Status Codes**:
- `200` - Success (all decisions processed, may include rejected/failed)
- `400` - Bad Request (invalid schema, missing required fields)
- `401` - Unauthorized
- `429` - Rate Limited (if Meta API rate limits)
- `500` - Internal Server Error

---

## Implementation Structure

### File: `strategis-api/server/routes/terminal.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const terminalService = require('../lib/services/terminal');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/terminal/execute
 * Execute Decision objects via Meta Ads API
 */
router.post('/execute', authenticateUser, async (req, res) => {
  try {
    const { decisions, idempotencyKey, dryRun = false, correlationId } = req.body;
    
    // Validate request
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'decisions array is required and must not be empty'
        }
      });
    }
    
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'idempotencyKey is required'
        }
      });
    }
    
    // Check idempotency
    const isDuplicate = await terminalService.checkIdempotency(idempotencyKey);
    if (isDuplicate) {
      return res.status(200).json({
        executionId: idempotencyKey,
        acceptedCount: 0,
        rejectedCount: 0,
        results: [],
        note: 'Duplicate request (idempotency check)'
      });
    }
    
    // Execute decisions
    const executionId = correlationId || uuidv4();
    const results = await terminalService.executeDecisions({
      decisions,
      executionId,
      idempotencyKey,
      dryRun,
      correlationId: correlationId || executionId,
      organization: req.user.organization  // From auth middleware
    });
    
    // Calculate counts
    const acceptedCount = results.filter(r => r.status === 'success').length;
    const rejectedCount = results.filter(r => r.status === 'rejected' || r.status === 'failed').length;
    
    return res.status(200).json({
      executionId,
      acceptedCount,
      rejectedCount,
      results
    });
    
  } catch (error) {
    console.error('Terminal execute error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Execution failed'
      }
    });
  }
});

/**
 * GET /api/terminal/state
 * Get current cooldowns and policy state
 */
router.get('/state', authenticateUser, async (req, res) => {
  try {
    const state = await terminalService.getState({
      organization: req.user.organization
    });
    
    return res.status(200).json(state);
  } catch (error) {
    console.error('Terminal state error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to load state'
      }
    });
  }
});

/**
 * POST /api/terminal/simulate
 * Dry-run validation without executing Meta API calls
 */
router.post('/simulate', authenticateUser, async (req, res) => {
  try {
    const { decisions, correlationId } = req.body;
    
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'decisions array is required'
        }
      });
    }
    
    const results = await terminalService.executeDecisions({
      decisions,
      executionId: correlationId || uuidv4(),
      idempotencyKey: `simulate-${Date.now()}`,
      dryRun: true,  // Always dry-run for simulate
      correlationId: correlationId || uuidv4(),
      organization: req.user.organization
    });
    
    return res.status(200).json({
      simulated: true,
      results
    });
    
  } catch (error) {
    console.error('Terminal simulate error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Simulation failed'
      }
    });
  }
});

module.exports = router;
```

---

## Service Implementation

### File: `strategis-api/lib/services/terminal.js`

```javascript
const redis = require('../lib/redis');
const db = require('../lib/db');
const facebookService = require('./facebook');  // Existing Facebook service

/**
 * Check if request is idempotent
 */
async function checkIdempotency(key) {
  const exists = await redis.get(`idempotency:${key}`);
  return !!exists;
}

/**
 * Set idempotency key
 */
async function setIdempotency(key, ttl = 86400) {
  await redis.setex(`idempotency:${key}`, ttl, JSON.stringify({
    executed_at: new Date().toISOString()
  }));
}

/**
 * Check cooldown for decision
 */
async function checkCooldown(decision, organization) {
  const key = `cooldown:${organization}:${decision.level}:${decision.id}:${decision.action}`;
  const cooldownUntil = await redis.get(key);
  
  if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
    return {
      passed: false,
      guard_type: 'cooldown',
      error: `Cooldown active until ${cooldownUntil}`
    };
  }
  
  return { passed: true };
}

/**
 * Set cooldown after execution
 */
async function setCooldown(decision, organization, hours = 24) {
  const key = `cooldown:${organization}:${decision.level}:${decision.id}:${decision.action}`;
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  await redis.setex(key, hours * 3600, expiresAt.toISOString());
}

/**
 * Check freeze period (48-72h post-launch)
 */
async function checkFreezePeriod(decision, organization) {
  // Only applies to budget changes
  if (decision.action === 'hold') {
    return { passed: true };
  }
  
  // Fetch campaign metadata to get created_time
  const campaign = await facebookService.getCampaign({
    id: decision.level === 'campaign' ? decision.id : await getCampaignIdFromAdset(decision.id),
    organization
  });
  
  const launchDate = new Date(campaign.created_time);
  const hoursSinceLaunch = (Date.now() - launchDate.getTime()) / 3600000;
  
  const freezeHours = process.env.TERMINAL_FREEZE_HOURS || 48;
  
  if (hoursSinceLaunch < freezeHours) {
    return {
      passed: false,
      guard_type: 'freeze',
      error: `Campaign in freeze period (${hoursSinceLaunch.toFixed(1)}h < ${freezeHours}h)`
    };
  }
  
  return { passed: true };
}

/**
 * Check learning phase (no budget increases during learning)
 */
async function checkLearningPhase(decision, organization) {
  // Only applies to budget increases
  if (decision.action !== 'bump_budget' || decision.level !== 'adset') {
    return { passed: true };
  }
  
  const adset = await facebookService.getAdSet({
    id: decision.id,
    organization
  });
  
  if (adset.status === 'LEARNING' || adset.status === 'LEARNING_LIMITED') {
    return {
      passed: false,
      guard_type: 'learning',
      error: `Ad set in learning phase: ${adset.status}`
    };
  }
  
  return { passed: true };
}

/**
 * Validate Decision schema
 */
function validateDecision(decision) {
  const required = ['decision_id', 'id', 'level', 'account_id', 'action', 'date'];
  for (const field of required) {
    if (decision[field] === undefined || decision[field] === null) {
      return {
        valid: false,
        error: `Missing required field: ${field}`
      };
    }
  }
  
  if (!['adset', 'campaign'].includes(decision.level)) {
    return {
      valid: false,
      error: `Invalid level: ${decision.level}`
    };
  }
  
  if (!['bump_budget', 'trim_budget', 'hold'].includes(decision.action)) {
    return {
      valid: false,
      error: `Invalid action: ${decision.action}`
    };
  }
  
  if (decision.action !== 'hold' && !decision.budget_multiplier) {
    return {
      valid: false,
      error: 'budget_multiplier required for budget actions'
    };
  }
  
  return { valid: true };
}

/**
 * Execute budget change
 */
async function executeBudgetChange(decision, organization, dryRun) {
  try {
    // Fetch current budget from Meta API
    const current = decision.level === 'campaign'
      ? await facebookService.getCampaign({ id: decision.id, organization })
      : await facebookService.getAdSet({ id: decision.id, organization });
    
    const currentBudget = parseFloat(current.daily_budget || current.dailyBudget) / 100; // Convert from cents
    
    // Calculate new budget
    const newBudget = currentBudget * decision.budget_multiplier;
    
    // Validate bounds (Meta API constraints)
    const MIN_BUDGET = 1.0;  // $1/day minimum
    const MAX_BUDGET = 1000000.0;  // $1M/day maximum (adjust as needed)
    
    if (newBudget < MIN_BUDGET || newBudget > MAX_BUDGET) {
      return {
        status: 'failed',
        error: `Budget ${newBudget.toFixed(2)} outside allowed range [${MIN_BUDGET}, ${MAX_BUDGET}]`
      };
    }
    
    if (dryRun) {
      return {
        status: 'success',
        simulated: true,
        changes: {
          current_budget: currentBudget,
          new_budget: newBudget
        }
      };
    }
    
    // Execute Meta API call
    const budgetInCents = Math.round(newBudget * 100);
    
    if (decision.level === 'campaign') {
      await facebookService.updateCampaignBudget({
        id: decision.id,
        organization,
        dailyBudget: budgetInCents
      });
    } else {
      await facebookService.updateAdSetBudget({
        id: decision.id,
        organization,
        dailyBudget: budgetInCents
      });
    }
    
    return {
      status: 'success',
      changes: {
        current_budget: currentBudget,
        new_budget: newBudget
      }
    };
    
  } catch (error) {
    return {
      status: 'failed',
      error: `Meta API error: ${error.message}`
    };
  }
}

/**
 * Execute bid cap change
 */
async function executeBidCapChange(decision, organization, dryRun) {
  try {
    if (decision.level !== 'adset') {
      return {
        status: 'failed',
        error: 'Bid cap changes only supported for ad sets'
      };
    }
    
    // Fetch current bid cap
    const adset = await facebookService.getAdSet({
      id: decision.id,
      organization
    });
    
    const currentBidCap = parseFloat(adset.bid_amount || adset.bidAmount || 0) / 100; // Convert from cents
    
    if (!currentBidCap) {
      return {
        status: 'failed',
        error: 'Ad set does not have bid cap set'
      };
    }
    
    // Calculate new bid cap
    const newBidCap = currentBidCap * decision.bid_cap_multiplier;
    
    if (dryRun) {
      return {
        status: 'success',
        simulated: true,
        changes: {
          current_bid_cap: currentBidCap,
          new_bid_cap: newBidCap
        }
      };
    }
    
    // Execute Meta API call
    const bidCapInCents = Math.round(newBidCap * 100);
    
    await facebookService.updateAdSetBid({
      id: decision.id,
      organization,
      bidAmount: bidCapInCents
    });
    
    return {
      status: 'success',
      changes: {
        current_bid_cap: currentBidCap,
        new_bid_cap: newBidCap
      }
    };
    
  } catch (error) {
    return {
      status: 'failed',
      error: `Meta API error: ${error.message}`
    };
  }
}

/**
 * Execute a single decision
 */
async function executeDecision(decision, organization, dryRun) {
  // 1. Validate schema
  const validation = validateDecision(decision);
  if (!validation.valid) {
    return {
      decision_id: decision.decision_id,
      status: 'rejected',
      guard_type: 'validation',
      error: validation.error
    };
  }
  
  // 2. Check guards
  const guards = [
    await checkCooldown(decision, organization),
    await checkFreezePeriod(decision, organization),
    await checkLearningPhase(decision, organization)
  ];
  
  const failedGuard = guards.find(g => !g.passed);
  if (failedGuard) {
    return {
      decision_id: decision.decision_id,
      status: 'rejected',
      guard_type: failedGuard.guard_type,
      error: failedGuard.error
    };
  }
  
  // 3. Execute action
  if (decision.action === 'hold') {
    return {
      decision_id: decision.decision_id,
      status: 'success',
      changes: {}
    };
  }
  
  let result;
  if (decision.budget_multiplier) {
    result = await executeBudgetChange(decision, organization, dryRun);
  }
  
  if (decision.bid_cap_multiplier && decision.level === 'adset') {
    const bidResult = await executeBidCapChange(decision, organization, dryRun);
    if (result && result.status === 'success') {
      // Merge bid changes into budget result
      result.changes = { ...result.changes, ...bidResult.changes };
    } else {
      result = bidResult;
    }
  }
  
  // 4. Update cooldown if successful
  if (result.status === 'success' && !dryRun) {
    await setCooldown(decision, organization);
  }
  
  // 5. Log execution
  await logExecution({
    decision_id: decision.decision_id,
    execution_id: executionId,
    organization,
    decision,
    result,
    dryRun
  });
  
  return {
    decision_id: decision.decision_id,
    ...result
  };
}

/**
 * Execute batch of decisions
 */
async function executeDecisions({ decisions, executionId, idempotencyKey, dryRun, correlationId, organization }) {
  // Set idempotency key
  await setIdempotency(idempotencyKey);
  
  // Execute decisions sequentially (to avoid rate limits)
  const results = [];
  for (const decision of decisions) {
    const result = await executeDecision(decision, organization, dryRun);
    results.push(result);
    
    // Small delay between executions to avoid rate limits
    if (!dryRun && results.length < decisions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Get current state (cooldowns, policy)
 */
async function getState({ organization }) {
  // Fetch all cooldowns for organization
  const keys = await redis.keys(`cooldown:${organization}:*`);
  const cooldowns = [];
  
  for (const key of keys) {
    const expiresAt = await redis.get(key);
    const parts = key.split(':');
    cooldowns.push({
      level: parts[2],
      id: parts[3],
      action: parts[4],
      expires_at: expiresAt
    });
  }
  
  return {
    cooldowns,
    policyVersion: 'v1',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Log execution to database
 */
async function logExecution({ decision_id, execution_id, organization, decision, result, dryRun }) {
  await db.query(`
    INSERT INTO terminal_executions (
      id, execution_id, decision_id, account_id, level, entity_id,
      action, status, error, guard_type, changes, executed_at,
      correlation_id, organization, dry_run
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `, [
    uuidv4(),
    execution_id,
    decision_id,
    decision.account_id,
    decision.level,
    decision.id,
    decision.action,
    result.status,
    result.error || null,
    result.guard_type || null,
    JSON.stringify(result.changes || {}),
    new Date(),
    correlationId,
    organization,
    dryRun
  ]);
}

module.exports = {
  checkIdempotency,
  executeDecisions,
  getState
};
```

---

## Database Schema

### Table: `terminal_executions`

```sql
CREATE TABLE terminal_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id VARCHAR(255) NOT NULL,
  decision_id VARCHAR(255) NOT NULL,
  account_id VARCHAR(255),
  level VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error TEXT,
  guard_type VARCHAR(50),
  changes JSONB,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correlation_id VARCHAR(255),
  organization VARCHAR(255) NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_terminal_executions_execution_id ON terminal_executions(execution_id);
CREATE INDEX idx_terminal_executions_decision_id ON terminal_executions(decision_id);
CREATE INDEX idx_terminal_executions_organization ON terminal_executions(organization);
CREATE INDEX idx_terminal_executions_executed_at ON terminal_executions(executed_at);
```

---

## Integration with Existing Facebook Service

**CONFIRMED**: strategis-static calls these endpoints (from `client/api/base.js`):

```javascript
// strategis-api/lib/services/facebook.js (existing or to be created)

// These endpoints are called by strategis-static but may need to be built in strategis-api

module.exports = {
  // Get campaign (needed to fetch current budget and created_time)
  async getCampaign({ id, organization }) {
    // Calls: GET /v18.0/{campaign_id} via Meta Graph API
    // Returns: { daily_budget, created_time, ... }
  },
  
  // Get ad set (needed to fetch current budget, bid_amount, status)
  async getAdSet({ id, organization }) {
    // Calls: GET /v18.0/{adset_id} via Meta Graph API
    // Returns: { dailyBudget, bidAmount, status, ... }
  },
  
  // Update campaign budget
  async updateCampaignBudget({ id, organization, dailyBudget }) {
    // Calls: PUT /api/facebook/campaigns/:id/budget?organization={org}&dailyBudget={budget}
    // Body: { daily_budget: dailyBudget } (in cents, multiplied by 100)
    // Pattern from strategis-static: auth.put(url, { daily_budget: Number(dailyBudget) * 100 }, cb)
  },
  
  // Update ad set budget
  async updateAdSetBudget({ id, organization, dailyBudget }) {
    // Calls: PUT /api/facebook/adsets/:id/budget?organization={org}&dailyBudget={budget}
    // Body: { dailyBudget: dailyBudget } (in cents, multiplied by 100)
    // Pattern from strategis-static: auth.put(url, { dailyBudget: Number(dailyBudget) * 100 }, cb)
  },
  
  // Update ad set bid
  async updateAdSetBid({ id, organization, bidAmount }) {
    // Calls: PUT /api/facebook/adsets/:id/bid?organization={org}&bidAmount={bid}
    // Body: { bidAmount: bidAmount } (in cents, multiplied by 100)
    // Pattern from strategis-static: auth.put(url, { bidAmount: Number(bidAmount) * 100 }, cb)
  }
};
```

**Note**: These endpoints exist in strategis-static's API calls but may need to be implemented in strategis-api backend. Check if they exist in `strategis-api/lib/api/facebook.js` or need to be built.

---

## Next Steps

1. **Confirm Facebook Service Interface** - Verify existing methods or create them
2. **Create Database Table** - Run migration for `terminal_executions`
3. **Implement Routes** - Create `server/routes/terminal.js`
4. **Implement Service** - Create `lib/services/terminal.js`
5. **Add Route Registration** - Register in main app: `app.use('/api/terminal', terminalRouter)`
6. **Test with Dry-Run** - Test end-to-end with `dryRun: true`
7. **Deploy to Staging** - Validate before production

---

## Testing Examples

### Test Request (Dry-Run)
```bash
curl -X POST https://api.strategis.internal/api/terminal/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "decisions": [{
      "decision_id": "2025-01-15:adset:123456789",
      "id": "123456789",
      "level": "adset",
      "account_id": "act_123",
      "action": "bump_budget",
      "budget_multiplier": 1.2,
      "bid_cap_multiplier": null,
      "reason": "ROAS 1.35 ≥ 1.3",
      "date": "2025-01-15",
      "snapshot_dir": "/path/to/snapshot",
      "created_at": "2025-01-15T07:00:00Z"
    }],
    "idempotencyKey": "test-key-123",
    "dryRun": true,
    "correlationId": "test-correlation-456"
  }'
```

### Expected Response
```json
{
  "executionId": "test-correlation-456",
  "acceptedCount": 1,
  "rejectedCount": 0,
  "results": [{
    "decision_id": "2025-01-15:adset:123456789",
    "status": "success",
    "simulated": true,
    "changes": {
      "current_budget": 100.0,
      "new_budget": 120.0
    }
  }]
}
```

