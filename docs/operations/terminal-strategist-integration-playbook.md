# Terminal-Strategist Integration Playbook

## Document Purpose
This playbook provides step-by-step implementation guidance for integrating Strategist (Liftoff) with Terminal (strateg.is) to enable automated Facebook campaign budget and bid management. This is a **working document** based on PROPOSED answers from Devin; items marked **MISSING** require confirmation.

**Status Legend:**
- ✅ **CONFIRMED**: Ready to implement
- ⚠️ **PROPOSED**: Recommended approach, may need adjustment
- ❌ **MISSING**: Requires confirmation before implementation

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Phase 1: Basic Integration](#phase-1-basic-integration)
3. [Phase 2: Async Job Pattern](#phase-2-async-job-pattern)
4. [Phase 3: State Synchronization](#phase-3-state-synchronization)
5. [Phase 4: Production Hardening](#phase-4-production-hardening)
6. [Testing Strategy](#testing-strategy)
7. [Rollout Plan](#rollout-plan)

---

## Prerequisites

### Infrastructure Requirements
- ⚠️ **Terminal Service**: Independent HTTP service in strateg.is infrastructure
- ⚠️ **Network Access**: Private network or authenticated public endpoints between Liftoff and strateg.is
- ⚠️ **State Storage**: Redis (cooldowns) + PostgreSQL (policy state, audit logs)
- ✅ **Liftoff Backend**: Strategist routes already exist

### Authentication Setup
⚠️ **PROPOSED**: Service-to-service authentication
```typescript
// Environment variables needed
TERMINAL_API_BASE_URL=https://terminal-api.strategis.internal
TERMINAL_API_KEY=<service-token>
TERMINAL_API_TIMEOUT=30000
```

### Code Dependencies
```bash
# Add to backend/package.json
npm install axios uuid
npm install --save-dev @types/uuid
```

---

## Phase 1: Basic Integration

### Step 1.1: Create Terminal HTTP Client

**File**: `backend/src/lib/terminalClient.ts`

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Decision } from './decisions';

export interface TerminalSimulateRequest {
  decisions: Decision[];
  snapshotDir: string;
  dryRun?: boolean;
  correlationId: string;
}

export interface TerminalSimulateResponse {
  intents: Array<{
    decision_id: string;
    action: string;
    budget_multiplier: number;
    reason: string;
  }>;
  rejected: Array<{
    decision_id: string;
    reason: string;
    guard_type: 'cooldown' | 'freeze' | 'signal_health' | 'learning_density' | 'portfolio_cap';
  }>;
}

export interface TerminalExecuteRequest {
  decisions: Decision[];
  idempotencyKey: string;
  dryRun?: boolean;
  correlationId: string;
  policyVersion?: string;
}

export interface TerminalExecuteResponse {
  jobId: string;
  acceptedCount: number;
  rejected: Array<{
    decision_id: string;
    reason: string;
  }>;
}

export interface TerminalStateResponse {
  cooldowns: Record<string, {
    id: string;
    level: 'adset' | 'campaign';
    next_eligible_ts?: string;
    last_action?: string;
  }>;
  policy: {
    version: string;
    lastUpdated: string;
  };
}

class TerminalClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TERMINAL_API_BASE_URL || 'http://localhost:3001';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.TERMINAL_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.TERMINAL_API_TIMEOUT || 30000),
    });

    // Add retry interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;
        if (!config || !config.retry) config.retry = 0;
        config.retryCount = config.retryCount || 0;

        // Retry on network errors and 5xx
        if (
          (!error.response || error.response.status >= 500) &&
          config.retryCount < 3
        ) {
          config.retryCount += 1;
          const delay = Math.min(1000 * Math.pow(2, config.retryCount - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(config);
        }

        // Handle rate limits
        if (error.response?.status === 429) {
          const retryAfter = Number(error.response.headers['retry-after'] || 60);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async simulate(request: TerminalSimulateRequest): Promise<TerminalSimulateResponse> {
    const response = await this.client.post<TerminalSimulateResponse>(
      '/api/terminal/simulate',
      request
    );
    return response.data;
  }

  async execute(request: TerminalExecuteRequest): Promise<TerminalExecuteResponse> {
    const response = await this.client.post<TerminalExecuteResponse>(
      '/api/terminal/execute',
      request
    );
    return response.data;
  }

  async getState(): Promise<TerminalStateResponse> {
    const response = await this.client.get<TerminalStateResponse>('/api/terminal/state');
    return response.data;
  }

  async getJobStatus(jobId: string): Promise<any> {
    const response = await this.client.get(`/api/terminal/jobs/${jobId}`);
    return response.data;
  }
}

export const terminalClient = new TerminalClient();
```

### Step 1.2: Create Recommendation Execution Service

**File**: `backend/src/lib/recommendationExecutor.ts`

```typescript
import { terminalClient, TerminalExecuteRequest, TerminalSimulateRequest } from './terminalClient';
import { Decision } from './decisions';
import { latestSnapshotDir, defaultSnapshotsBase } from './snapshots';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionResult {
  jobId: string;
  acceptedCount: number;
  rejected: Array<{ decision_id: string; reason: string }>;
  correlationId: string;
}

export interface ExecutionOptions {
  dryRun?: boolean;
  preValidate?: boolean;
  correlationId?: string;
}

export class RecommendationExecutor {
  /**
   * Execute recommendations via Terminal
   */
  async executeRecommendations(
    recommendations: Decision[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const correlationId = options.correlationId || uuidv4();
    const snapshotDir = latestSnapshotDir(defaultSnapshotsBase()) || '';

    // Optional pre-validation
    if (options.preValidate) {
      const simulation = await terminalClient.simulate({
        decisions: recommendations,
        snapshotDir,
        dryRun: options.dryRun || false,
        correlationId,
      });

      // Filter out rejected decisions
      const rejectedIds = new Set(simulation.rejected.map((r) => r.decision_id));
      recommendations = recommendations.filter((d) => !rejectedIds.has(d.decision_id));

      if (recommendations.length === 0) {
        throw new Error('All recommendations rejected by Terminal guards');
      }
    }

    // Generate idempotency key
    const idempotencyKey = this.generateIdempotencyKey(recommendations);

    // Execute via Terminal
    const executeRequest: TerminalExecuteRequest = {
      decisions: recommendations,
      idempotencyKey,
      dryRun: options.dryRun || false,
      correlationId,
      policyVersion: recommendations[0]?.policy_version,
    };

    const result = await terminalClient.execute(executeRequest);

    return {
      jobId: result.jobId,
      acceptedCount: result.acceptedCount,
      rejected: result.rejected,
      correlationId,
    };
  }

  /**
   * Poll job status until completion
   */
  async pollJobCompletion(
    jobId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<any> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await terminalClient.getJobStatus(jobId);

      if (['completed', 'failed', 'partial'].includes(status.status)) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    }

    throw new Error(`Job polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Generate idempotency key from decisions
   */
  private generateIdempotencyKey(decisions: Decision[]): string {
    const hash = decisions
      .map((d) => `${d.account_id}:${d.level}:${d.id}:${d.action}:${d.date}`)
      .sort()
      .join('|');
    // In production, use crypto.createHash('sha256')
    return Buffer.from(hash).toString('base64').slice(0, 32);
  }
}

export const recommendationExecutor = new RecommendationExecutor();
```

### Step 1.3: Add Execution Endpoint to Strategist

**File**: `backend/src/routes/strategist.ts` (add new route)

```typescript
import { recommendationExecutor } from '../lib/recommendationExecutor';
import { Decision } from '../lib/decisions';

// POST /execute-recommendations — execute recommendations via Terminal
router.post('/execute-recommendations', authenticateUser, async (req: any, res) => {
  try {
    const { recommendations, dryRun, preValidate } = req.body || {};

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return res.status(400).json({
        code: 'bad_request',
        message: 'recommendations[] array required',
      });
    }

    // Validate decision format
    const decisions: Decision[] = recommendations.map((r: any) => ({
      decision_id: r.decision_id || `${r.date}:${r.level}:${r.id}`,
      id: r.id,
      level: r.level,
      account_id: r.account_id || null,
      action: r.action,
      budget_multiplier: r.budget_multiplier || null,
      bid_cap_multiplier: r.bid_cap_multiplier || null,
      spend_delta_usd: r.spend_delta_usd || null,
      reason: r.reason || '',
      policy_version: r.policy_version || 'v1',
      confidence: r.confidence || null,
      date: r.date,
      snapshot_dir: r.snapshot_dir || latestSnapshotDir(defaultSnapshotsBase()) || '',
      created_at: r.created_at || new Date().toISOString(),
    }));

    // Execute via Terminal
    const result = await recommendationExecutor.executeRecommendations(decisions, {
      dryRun: dryRun !== false && process.env.STRATEGIST_EXEC_DRY_RUN !== 'false',
      preValidate: preValidate !== false,
    });

    return res.status(200).json({
      success: true,
      jobId: result.jobId,
      acceptedCount: result.acceptedCount,
      rejected: result.rejected,
      correlationId: result.correlationId,
      note: dryRun ? 'Dry-run mode: no actual changes applied' : 'Execution started',
    });
  } catch (err: any) {
    console.error('strategist.execute-recommendations error', err);
    return res.status(500).json({
      code: 'internal_error',
      message: err?.message || 'Execution failed',
    });
  }
});

// GET /execute-recommendations/:jobId — poll job status
router.get('/execute-recommendations/:jobId', authenticateUser, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const status = await recommendationExecutor.pollJobCompletion(jobId);
    return res.status(200).json(status);
  } catch (err: any) {
    console.error('strategist.execute-recommendations status error', err);
    return res.status(500).json({
      code: 'internal_error',
      message: err?.message || 'Status check failed',
    });
  }
});
```

### Step 1.4: Add Cooldown Check to Recommendations

**File**: `backend/src/routes/strategist.ts` (modify `/recommendations` endpoint)

```typescript
// Add before generating recommendations
import { terminalClient } from '../lib/terminalClient';

// In /recommendations handler, add cooldown filtering:
let terminalState: any = null;
try {
  terminalState = await terminalClient.getState();
} catch (err) {
  console.warn('Failed to fetch Terminal state, proceeding without cooldown filter', err);
}

// Filter recommendations by cooldowns
if (terminalState?.cooldowns) {
  const now = new Date().toISOString();
  intents = intents.filter((intent) => {
    const cooldown = terminalState.cooldowns[`${intent.level}:${intent.id}`];
    if (cooldown?.next_eligible_ts && cooldown.next_eligible_ts > now) {
      return false; // Skip entities in cooldown
    }
    return true;
  });
}
```

---

## Phase 2: Async Job Pattern

### Step 2.1: Add Job Status Tracking

**File**: `backend/src/lib/jobTracker.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

export interface JobStatus {
  jobId: string;
  correlationId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial';
  createdAt: string;
  updatedAt: string;
  decisions: Array<{
    decision_id: string;
    status: 'pending' | 'success' | 'failed';
    error?: string;
  }>;
  results?: any;
}

// In-memory store (replace with database in production)
const jobs = new Map<string, JobStatus>();

export class JobTracker {
  createJob(correlationId: string, decisionIds: string[]): string {
    const jobId = uuidv4();
    const job: JobStatus = {
      jobId,
      correlationId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decisions: decisionIds.map((id) => ({
        decision_id: id,
        status: 'pending',
      })),
    };
    jobs.set(jobId, job);
    return jobId;
  }

  updateJob(jobId: string, updates: Partial<JobStatus>): void {
    const job = jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  }

  getJob(jobId: string): JobStatus | undefined {
    return jobs.get(jobId);
  }
}

export const jobTracker = new JobTracker();
```

### Step 2.2: Background Job Processor

**File**: `backend/src/scripts/processTerminalJobs.ts`

```typescript
import { recommendationExecutor } from '../lib/recommendationExecutor';
import { jobTracker } from '../lib/jobTracker';

/**
 * Background worker to poll Terminal job status and update local tracking
 */
async function processTerminalJobs() {
  // Get all pending jobs
  const pendingJobs = Array.from(jobTracker.jobs.values()).filter(
    (j) => j.status === 'queued' || j.status === 'running'
  );

  for (const job of pendingJobs) {
    try {
      const status = await recommendationExecutor.pollJobCompletion(job.jobId, 1, 0);
      jobTracker.updateJob(job.jobId, {
        status: status.status,
        results: status.results,
      });
    } catch (err) {
      console.error(`Failed to poll job ${job.jobId}:`, err);
    }
  }
}

// Run every 10 seconds
setInterval(processTerminalJobs, 10000);
```

---

## Phase 3: State Synchronization

### Step 3.1: Cooldown Cache with TTL

**File**: `backend/src/lib/cooldownCache.ts`

```typescript
import { terminalClient } from './terminalClient';

interface CachedState {
  data: any;
  expiresAt: number;
  etag?: string;
}

class CooldownCache {
  private cache: Map<string, CachedState> = new Map();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getState(forceRefresh: boolean = false): Promise<any> {
    const cacheKey = 'terminal-state';
    const cached = this.cache.get(cacheKey);

    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const state = await terminalClient.getState();
      this.cache.set(cacheKey, {
        data: state,
        expiresAt: Date.now() + this.TTL_MS,
      });
      return state;
    } catch (err) {
      // Return stale cache if available
      if (cached) {
        console.warn('Terminal state fetch failed, using stale cache', err);
        return cached.data;
      }
      throw err;
    }
  }

  invalidate(): void {
    this.cache.clear();
  }
}

export const cooldownCache = new CooldownCache();
```

### Step 3.2: Update Recommendations to Use Cache

**File**: `backend/src/routes/strategist.ts`

```typescript
import { cooldownCache } from '../lib/cooldownCache';

// In /recommendations handler:
const terminalState = await cooldownCache.getState();
// ... use terminalState for filtering
```

---

## Phase 4: Production Hardening

### Step 4.1: Add Observability

**File**: `backend/src/lib/terminalMetrics.ts`

```typescript
export class TerminalMetrics {
  recordExecution(duration: number, success: boolean, rejectedCount: number): void {
    // Log to metrics system
    console.log('terminal.execution', {
      duration_ms: duration,
      success,
      rejected_count: rejectedCount,
      timestamp: new Date().toISOString(),
    });
  }

  recordError(error: Error, context: any): void {
    console.error('terminal.error', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}

export const terminalMetrics = new TerminalMetrics();
```

### Step 4.2: Add Circuit Breaker

**File**: `backend/src/lib/circuitBreaker.ts`

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      throw err;
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
```

---

## Testing Strategy

### Unit Tests

**File**: `backend/src/lib/__tests__/terminalClient.test.ts`

```typescript
import { terminalClient } from '../terminalClient';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TerminalClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('simulate calls correct endpoint', async () => {
    mockedAxios.create.mockReturnValue({
      post: jest.fn().mockResolvedValue({ data: { intents: [], rejected: [] } }),
    } as any);

    await terminalClient.simulate({
      decisions: [],
      snapshotDir: '/test',
      correlationId: 'test-123',
    });

    // Assert endpoint called
  });
});
```

### Integration Tests

**File**: `backend/src/routes/__tests__/strategist-execute.test.ts`

```typescript
describe('POST /execute-recommendations', () => {
  test('executes recommendations successfully', async () => {
    const recommendations = [
      {
        id: '123',
        level: 'adset',
        action: 'bump_budget',
        budget_multiplier: 1.2,
        // ... other fields
      },
    ];

    const response = await request(app)
      .post('/api/strategist/execute-recommendations')
      .send({ recommendations, dryRun: true });

    expect(response.status).toBe(200);
    expect(response.body.jobId).toBeDefined();
  });
});
```

---

## Rollout Plan

### Week 1: Development
- ✅ Implement Terminal client
- ✅ Add execution endpoint
- ✅ Unit tests

### Week 2: Staging
- ⚠️ Deploy to staging environment
- ⚠️ Integration tests with mock Terminal
- ⚠️ Manual testing with dry-run mode

### Week 3: Production (Canary)
- ⚠️ Deploy to production with feature flag
- ⚠️ Enable for 10% of recommendations
- ⚠️ Monitor metrics and errors

### Week 4: Full Rollout
- ⚠️ Increase to 100% if metrics look good
- ⚠️ Remove feature flag
- ⚠️ Document operational procedures

---

## Next Steps

1. **Confirm MISSING items** with Devin before Phase 1 implementation
2. **Set up Terminal service** in strateg.is infrastructure
3. **Configure authentication** between Liftoff and Terminal
4. **Implement Phase 1** basic integration
5. **Test thoroughly** in staging before production

---

## References

- Terminal PRD: `docs/prd/terminal-facebook-bidder-prd.md`
- Q&A Document: `docs/prd/terminal-strategist-integration-qa.md`
- Terminal Routes: `backend/src/routes/terminal.ts`
- Strategist Routes: `backend/src/routes/strategist.ts`



