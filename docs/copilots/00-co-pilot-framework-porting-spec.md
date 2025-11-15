---
title: Co‑Pilot Framework Porting Spec (Repo‑Agnostic)
status: stable
owners:
  - growth-team@company.com
last_reviewed: 2025-10-25
---

## Co‑Pilot Framework Porting Spec (Repo‑Agnostic)

### Purpose
Enable a new repository to implement “official co‑pilots” using the same architecture as our existing `/zuck` and `/elon` co‑pilots. This spec is written so ChatGPT‑5 can implement it end‑to‑end, migrate existing “experts” into first‑class co‑pilots, and wire the same orchestration, APIs, observability, and guardrails. Include Strategist as an internal API consumable by external clients like Facebook Co‑Pilot/Atlas via a public URL (staging/ngrok).

---

## Scope and Definitions

- **Co‑Pilot**: An autonomous agent with domain‑specific tools, decision policies, and prompts. Exposed via HTTP API and optionally a web UI.
- **Coordinator**: Router/manager that selects a co‑pilot, routes tasks, enforces guardrails, and logs/audits.
- **Strategist**: Internal decision engine + APIs (query/plan/act) integrated with ad/marketing domains, exposed via internal endpoints and a public URL for consumption by Atlas.
- **Expert**: Legacy single‑purpose agents to be migrated into co‑pilots.

---

## High‑Level Architecture

- **Runtime**: Node.js 20+, TypeScript.
- **Process**:
  - Request enters API Gateway → Coordinator → Co‑Pilot → Tool invocations → Results stream back.
  - Persistent logs, metrics, and audit trails.
- **Extensibility**:
  - Co‑pilot registry and tool plugin interface.
  - YAML/JSON manifests for co‑pilots and tools.
- **Security/Privacy**:
  - API key/JWT auth, role‑based permissions, audit logging, PII redaction, rate limiting.

---

## Directory Structure

```
repo-root/
  backend/
    src/
      index.ts
      routes/
        copilots.ts
        strategist.ts
        health.ts
        admin.ts
      agents/
        coordinator/
          coordinator.ts
          policies.ts
        copilots/
          zuck/
            manifest.yaml
            system-prompt.md
            tools.ts
          elon/
            manifest.yaml
            system-prompt.md
            tools.ts
          <new-copilot>/
            manifest.yaml
            system-prompt.md
            tools.ts
        tools/
          registry.ts
          interfaces.ts
          standard/
            http.ts
            sql.ts
            filesystem.ts
            kv.ts
      lib/
        logger.ts
        telemetry.ts
        auth.ts
        config.ts
        errors.ts
        streaming.ts
        validation.ts
      middleware/
        auth.ts
        rateLimit.ts
        requestId.ts
        errorHandler.ts
      services/
        strategist/
          planner.ts
          queries.ts
          actions.ts
          guards.ts
          adapters/
            facebook.ts
            assets.ts
            metrics.ts
        storage/
          kv.ts
          blob.ts
          db.ts
      types/
        index.ts
      scripts/
        migrate-experts-to-copilots.ts
        seed.ts
        smoke.ts
    package.json
    tsconfig.json
    .env.example
  frontend/ (optional, if you maintain a UI)
    src/
      pages/
        copilots/[id].tsx
        admin/copilots.tsx
      components/
        ChatPanel.tsx
        ToolOutput.tsx
        PolicyViolations.tsx
      lib/
        api.ts
    package.json
  docs/
    copilots/
      framework.md
      adding-a-copilot.md
      tools.md
      strategist.md
      api.md
      guardrails.md
      migration.md
  tests/
    e2e/
    integration/
    unit/
  ops/
    docker/
      Dockerfile.backend
      Dockerfile.frontend
    k8s/
      deployment.yaml
      service.yaml
      hpa.yaml
    vercel.json (if UI on Vercel)
```

---

## Configuration

- **Environment**:
  - NODE_ENV, PORT, LOG_LEVEL
  - AUTH_SECRET (JWT), API_KEYS (service tokens)
  - MODEL_PROVIDER (OpenAI, Anthropic, etc.), MODEL_NAME, TOKEN_LIMITS
  - STORAGE_URL/DB_URL, KV_URL
  - PUBLIC_BASE_URL (for Strategist public exposure)
  - RATE_LIMIT_* (global and per‑copilot)
- **Feature Flags**:
  - ENABLE_AUDIT_LOGS, ENABLE_STREAMING, ENABLE_TOOL_SANDBOX, ENABLE_STRATEGIST_PUBLIC

---

## Core Types

```ts
// backend/src/types/index.ts
export type CoPilotId = string;

export interface CoPilotManifest {
  id: CoPilotId;
  displayName: string;
  description: string;
  version: string;
  owner: string;
  permissions: string[]; // e.g., ['read.metrics', 'write.budget']
  defaultTools: string[];
  inputSchema?: unknown; // zod/json schema
  outputSchema?: unknown;
  policy?: PolicyConfig;
}

export interface PolicyConfig {
  maxSteps: number;
  maxToolCalls: number;
  cooldownSeconds?: number;
  restrictedTools?: string[];
  approvalRequiredFor?: string[]; // e.g., ['write.budget']
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  handler: (args: unknown, ctx: ToolContext) => Promise<unknown>;
  permissionsRequired?: string[];
  rateLimit?: { maxPerMinute: number };
}

export interface ToolContext {
  logger: Logger;
  auth: AuthContext;
  storage: StorageContext;
  telemetry: Telemetry;
  requestId: string;
}

export interface CoPilotRequest {
  copilotId: CoPilotId;
  task: string;
  input?: unknown;
  sessionId?: string;
  stream?: boolean;
}

export interface CoPilotResponse {
  requestId: string;
  sessionId: string;
  output: unknown;
  steps?: AgentStep[];
  policyViolations?: string[];
}
```

---

## Tooling Interface

- Implement `ToolDefinition` with:
  - Zod schemas for input/output.
  - Permission check in handler.
  - Rate limit guard.
- Add to `backend/src/agents/tools/registry.ts`:
  - `registerTool(def: ToolDefinition)`
  - `getTool(name: string)`
  - `listTools()`

---

## Coordinator

- Responsibilities:
  - Validate request, load `CoPilotManifest`, enforce `PolicyConfig`.
  - Build system prompt from manifest + `system-prompt.md`.
  - Route tool calls via registry.
  - Stream tokens/results if requested.
  - Log steps, tool I/O (with PII redaction), and policy violations.

- File: `backend/src/agents/coordinator/coordinator.ts`
  - `runCopilot(req: CoPilotRequest, ctx): Promise<CoPilotResponse>`

---

## Co‑Pilot Definition

- Each co‑pilot folder contains:
  - `manifest.yaml`
  - `system-prompt.md`
  - `tools.ts` (local tool bindings if any) + reuse `standard/` tools.

Example `manifest.yaml`:
```yaml
id: zuck
displayName: Facebook Growth Strategist
description: Data-driven strategist for Facebook ads.
version: 1.2.0
owner: growth-team@company.com
permissions:
  - read.metrics
  - read.assets
  - write.budget
defaultTools:
  - strategist.queryMetrics
  - strategist.listCampaigns
  - strategist.adjustBudget
policy:
  maxSteps: 12
  maxToolCalls: 20
  cooldownSeconds: 300
  approvalRequiredFor:
    - write.budget
```

Example `system-prompt.md`:
```md
You are the Facebook Growth Strategist. Always:
- Prioritize ROAS and spend efficiency.
- Propose small, reversible changes first.
- Explain reasoning briefly; cite metrics and time windows.
- Obey policy: budget changes require approval and respect cooldowns.
```

---

## Strategist Service

- Files: `backend/src/services/strategist/*`
- Capabilities:
  - Queries: metrics, entities (ads/adsets/campaigns) with filters (e.g., ROAS > 40% for yesterday).
  - Media retrieval by ad ID via assets manifest.
  - Actions: budget adjustments (set absolute or +/- %) with guardrails (cooldowns, dry‑run, audit logs).
- Public exposure:
  - `ENABLE_STRATEGIST_PUBLIC=true` exposes read‑only/query endpoints on a public base URL (ngrok/staging) for consumption by Atlas.

Endpoints:
```text
GET    /api/strategist/health
POST   /api/strategist/query           // { entity: 'campaign'|'adset'|'ad', filters: {...}, window: 'yesterday'|'last_7d'|... }
GET    /api/strategist/media/:adId     // returns signed URLs or file paths from assets manifest
POST   /api/strategist/budget/plan     // { ids: string[], op: 'set'|'increase'|'decrease', amountPct?: number, amountAbs?: number, dryRun?: boolean }
POST   /api/strategist/budget/apply    // requires approval token if policy demands
```

Guards:
- Cooldown tracker per entity.
- Max daily delta per entity and per portfolio.
- Dry‑run default with explicit apply.
- Audit records written before and after action with diff and approver.

---

## Co‑Pilot API

Routes in `backend/src/routes/copilots.ts`:
```text
GET    /api/copilots                   // list manifests (sanitized)
GET    /api/copilots/:id               // manifest details
POST   /api/copilots/:id/act           // CoPilotRequest { task, input, sessionId, stream }
GET    /api/copilots/:id/stream/:rid   // optional server-sent events or WS reconnect
```

Request example:
```json
{
  "task": "Audit yesterday's performance and propose safe budget tweaks",
  "input": { "portfolioId": "abc", "limits": { "maxChangePct": 10 } },
  "sessionId": "sess_123",
  "stream": true
}
```

Response example:
```json
{
  "requestId": "req_456",
  "sessionId": "sess_123",
  "output": {
    "summary": "3 campaigns under target ROAS; propose -5% on C1, +3% on C2...",
    "plans": [ ]
  },
  "steps": [
    { "type": "tool", "name": "strategist.queryMetrics", "args": { "window": "yesterday" } },
    { "type": "reasoning", "content": "C2 scalable; C1 overspending" }
  ]
}
```

---

## Middleware and Guardrails

- `auth.ts`: API key/JWT validation, roles (viewer/editor/admin).
- `rateLimit.ts`: IP + key‑scoped limits, per‑tool overrides.
- `requestId.ts`: attach `x-request-id`.
- `errorHandler.ts`: consistent error shape, redaction.
- `validation.ts`: zod schemas per endpoint.

---

## Telemetry, Logging, and Audits

- `lib/logger.ts`: pino/winston with JSON.
- `lib/telemetry.ts`: OpenTelemetry traces; spans for agent step, tool call, model call.
- `services/storage/db.ts`: audit table:
  - fields: requestId, userId, copilotId, action, before, after, approvedBy, dryRun, timestamp.

---

## Storage

- KV (Redis/Upstash) for sessions, cooldowns.
- DB (Postgres/SQLite) for audits, manifests (optional if file‑backed), usage.
- Blob store (S3/local) for assets; media manifest loader mapping ad IDs to paths.

---

## Tool Sandbox

- Isolate risky tools with:
  - Max runtime per call.
  - Allowed domains/paths allowlist.
  - Preview/dry‑run mode.
  - Automatic redaction of secrets in outputs.

---

## Streaming

- SSE/WebSocket support in `lib/streaming.ts`.
- Token‑level or step‑level streaming toggled per request and per copilot.

---

## Testing

- Unit:
  - Policies, tool handlers, adapters.
- Integration:
  - Coordinator with mock tools and model.
  - Strategist queries and guardrails.
- E2E:
  - `/api/copilots/:id/act` happy path and denial cases.
  - Budget plan/apply dry‑run → apply with approval.

---

## Deployment

- Backend: Dockerfile, health checks (`/api/health`), k8s manifests, HPA based on CPU and RPS.
- Public Strategist: flag‑gated, distinct service or path; publish via ngrok/staging domain with auth.
- UI (optional): Vercel/Next.

---

## Migration: Experts → Co‑Pilots

- Script: `scripts/migrate-experts-to-copilots.ts`:
  - For each expert:
    - Create `backend/src/agents/copilots/<expert-id>/manifest.yaml`.
    - Convert existing system prompts → `system-prompt.md`.
    - Map legacy functions → tools in `tools.ts` or standard tools.
    - Define permissions and policies.
  - Register in manifest registry.
- Acceptance:
  - All previous expert capabilities callable via `/api/copilots/:id/act`.
  - Same or stricter guardrails in place.

---

## Example Tools

1) Metrics query tool
```ts
// backend/src/services/strategist/queries.ts
export async function queryMetrics(args: { window: string; filters?: unknown }, ctx: ToolContext) {
  // fetch from DB/warehouse; respect auth scopes
  return { rows: [], stats: { roas: 1.23 } };
}
```

2) Assets retrieval
```ts
// backend/src/services/strategist/adapters/assets.ts
export async function getMediaByAdId(adId: string) {
  // load assets_manifest.csv; return local file paths or signed URLs
  return [{ type: "video/mp4", url: "/assets/.../file.mp4" }];
}
```

3) Budget adjustment planning
```ts
// backend/src/services/strategist/planner.ts
export async function planBudgetChange(args: { ids: string[]; op: 'set'|'increase'|'decrease'; amountPct?: number; amountAbs?: number; dryRun?: boolean }, ctx: ToolContext) {
  // compute plan with guardrails, no side effects
  return { plan: [{ id: "c_1", changePct: -5 }], requiresApproval: true };
}
```

Register as tools:
```ts
// backend/src/agents/tools/standard/strategist.ts
registerTool({
  name: "strategist.queryMetrics",
  description: "Query metrics for entities with filters and windows",
  inputSchema: z.object({ window: z.string(), filters: z.any().optional() }),
  outputSchema: z.any(),
  handler: (args, ctx) => queryMetrics(args as any, ctx),
  permissionsRequired: ["read.metrics"]
});

registerTool({
  name: "strategist.mediaByAdId",
  description: "Fetch media assets for an ad ID",
  inputSchema: z.object({ adId: z.string() }),
  outputSchema: z.any(),
  handler: async ({ adId }, ctx) => getMediaByAdId(adId),
  permissionsRequired: ["read.assets"]
});

registerTool({
  name: "strategist.planBudget",
  description: "Propose budget changes with guardrails (dry-run by default)",
  inputSchema: z.object({ ids: z.array(z.string()), op: z.enum(['set','increase','decrease']), amountPct: z.number().optional(), amountAbs: z.number().optional(), dryRun: z.boolean().default(true) }),
  outputSchema: z.any(),
  handler: (args, ctx) => planBudgetChange(args as any, ctx),
  permissionsRequired: ["write.budget"]
});
```

---

## Admin and Observability

- `GET /api/admin/tools` list tools and rates.
- `GET /api/admin/sessions` active sessions and cooldowns.
- `GET /api/admin/audits` filters by copilot, action, date.
- Metrics dashboard: RPS, token usage, error rates, policy violations, top tools.

---

## Security and Compliance

- JWT + per‑key scopes; per‑copilot permission mapping.
- PII redaction in logs; configurable allowlist for fields to retain.
- Rate limiting: global, per key, per copilot, per tool.
- Approval workflow for sensitive actions (budget changes).

---

## Developer Experience

- CLI scripts:
  - `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm seed`, `pnpm smoke`
  - `pnpm migrate:experts`
- Scaffolding:
  - `pnpm scaffold:copilot <id>` creates folder with manifest/prompt/tools.
- Docs:
  - How‑to add co‑pilot, add tool, publish Strategist, set guardrails, migrate experts.

---

## Acceptance Criteria

- **Parity**: New repo can register, run, and stream from at least two co‑pilots ported from `/zuck` and `/elon`.
- **Strategist**: Query, media retrieval by ad ID, and budget planning/apply with cooldowns, dry‑run, and full audits.
- **Security**: AuthZ enforced; sensitive actions require approval; rate limits active.
- **Observability**: Traces for model/tool calls; audits persisted.
- **Migration**: All legacy experts callable via `/api/copilots/:id/act` with manifests and policies.
- **Docs**: Developer docs present; `.env.example` complete.

---

## “Paste‑Into‑ChatGPT‑5” Instruction Block

Copy/paste the below into ChatGPT‑5 in the target repo.

```markdown
You are ChatGPT‑5. Implement the Co‑Pilot Framework per the following high‑level requirements:

1) Create the backend TypeScript architecture with these folders:
- backend/src/agents/{coordinator,copilots,tools}
- backend/src/routes/{copilots.ts,strategist.ts,health.ts,admin.ts}
- backend/src/services/strategist/{planner.ts,queries.ts,actions.ts,guards.ts,adapters/{facebook.ts,assets.ts}}
- backend/src/lib/{logger.ts,telemetry.ts,auth.ts,config.ts,errors.ts,streaming.ts,validation.ts}
- backend/src/middleware/{auth.ts,rateLimit.ts,requestId.ts,errorHandler.ts}
- backend/src/types/index.ts
- backend/src/scripts/{migrate-experts-to-copilots.ts,seed.ts,smoke.ts}

2) Implement:
- Co‑pilot registry via manifests and `system-prompt.md` files.
- Coordinator that enforces policies (max steps/calls, cooldowns, approvals).
- Tool registry with zod schemas and permission checks.
- Strategist service with:
  - query endpoint for metrics and filtered entity listing
  - media retrieval by ad ID from assets manifest
  - budget plan/apply with cooldowns, dry‑run default, and audit logs
  - optional public read‑only exposure behind auth (flag ENABLE_STRATEGIST_PUBLIC)

3) Expose endpoints:
- GET /api/copilots, GET /api/copilots/:id, POST /api/copilots/:id/act, GET /api/strategist/health
- POST /api/strategist/query, GET /api/strategist/media/:adId
- POST /api/strategist/budget/plan, POST /api/strategist/budget/apply
- Admin: GET /api/admin/tools, /api/admin/sessions, /api/admin/audits

4) Security and guardrails:
- JWT/API key auth, role scopes, rate limits per key/copilot/tool.
- Approval workflow for budget apply; enforce cooldowns and daily change limits.
- Redact PII and secrets from logs.

5) Telemetry:
- OpenTelemetry spans for model/tool calls; JSON logs; durable audit table.

6) Migration:
- Script to convert legacy “experts” into co‑pilots (create manifest.yaml, system-prompt.md, tools.ts). Ensure parity.

7) Provide:
- .env.example with all flags and secrets
- NPM scripts: dev, build, start, test, lint, seed, smoke, migrate:experts
- Minimal tests (unit/integration/e2e) covering policies, strategist endpoints, and a streaming act call.

Deliverables:
- Running dev server with two example co‑pilots.
- Strategist endpoints working with dry‑run and audit logs.
- Docs in docs/copilots/*.md for adding co‑pilots, tools, strategist, guardrails, migration.
```

---

## Minimal .env.example

```dotenv
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

AUTH_SECRET=replace_me
API_KEYS=key1,key2

MODEL_PROVIDER=openai
MODEL_NAME=gpt-4o-mini
TOKEN_LIMITS=8192

DB_URL=postgres://user:pass@localhost:5432/app
KV_URL=redis://localhost:6379
BLOB_URL=file://./backend/assets

PUBLIC_BASE_URL=https://<your-ngrok-or-staging-domain>
ENABLE_STRATEGIST_PUBLIC=false

RATE_LIMIT_GLOBAL_RPM=600
RATE_LIMIT_TOOL_DEFAULT_RPM=60

ENABLE_AUDIT_LOGS=true
ENABLE_STREAMING=true
ENABLE_TOOL_SANDBOX=true
```

---

Built this to let you drop it into any repo, have ChatGPT‑5 scaffold the same co‑pilot system, migrate legacy experts, and expose Strategist features (queries, media by ad ID, and budget actions) behind strong guardrails.


