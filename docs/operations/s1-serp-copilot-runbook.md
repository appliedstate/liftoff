### S1 SERP Copilot – Runbook & Handoff

This document captures the current state of the **S1 SERP Copilot** and provides a step‑by‑step runbook for operating and extending it.

---

## 1. High‑Level Overview

- **Goal**: Let marketers ask natural‑language questions about System1 SERP data (8M+ rows in `serp_keyword_slug_embeddings`) and get:
  - A **ranked list of slugs/keywords** (via pgvector K‑NN search).
  - A **natural‑language answer** summarizing the results (via OpenAI/C1).
- **Back end** (repo: `backend/`):
  - Node + Express (`backend/src/index.ts`) running under PM2 as `strategist-backend`.
  - pg + pgvector for SERP embeddings (`serp_keyword_slug_embeddings`), configured via `PGVECTOR_URL` in `backend/.env`.
  - OpenAI integration (`backend/src/lib/openai.ts`) with `OPENAI_API_KEY` and `EMBEDDING_MODEL` (default `text-embedding-3-small`).
  - System1 SERP ingestion & embedding scripts under `backend/src/scripts/vector/`.
  - New routes in `backend/src/routes/s1.ts`:
    - `POST /api/s1/serp/search` → pgvector K‑NN over `serp_keyword_slug_embeddings` (returns raw rows + scores).
    - `POST /api/s1/serp/qa` → wraps `serpVectorSearch`, builds an LLM prompt from top rows, calls `generateText` and returns `{ status, runDate, query, params, answer, context: { rows } }`.
- **Frontend / Copilot** (repo: `apps/c1-dashboard/`):
  - Next.js 15 app with C1 React SDK (`@thesysai/genui-sdk`).
  - Root page (`apps/c1-dashboard/src/app/page.tsx`) is a client component that dynamically renders the S1 copilot.
  - S1 copilot page (`apps/c1-dashboard/src/app/s1-serp-chat/page.tsx`) uses:
    ```tsx
    "use client";
    import { C1Chat } from "@thesysai/genui-sdk";
    import "@crayonai/react-ui/styles/index.css";

    export default function S1SerpChatPage() {
      return (
        <C1Chat
          apiUrl="/api/s1-serp-chat"
          theme={{ mode: "dark" }}
          placeholder="Ask about System1 SERP performance…"
        />
      );
    }
    ```
  - API route proxy (`apps/c1-dashboard/src/app/api/s1-serp-chat/route.ts`) takes the latest user `prompt` and calls the backend:
    ```ts
    const BACKEND_BASE = process.env.NEXT_PUBLIC_SERVICE_URL || "http://localhost:3001";

    export async function POST(req: NextRequest) {
      const { prompt, threadId, responseId } = (await req.json()) as {
        prompt: DBMessage;
        threadId: string;
        responseId: string;
      };

      const message = typeof prompt.content === "string" ? prompt.content : "";
      const body = { query: message, runDate: "2025-11-11", limit: 100 };

      const backendRes = await fetch(`${BACKEND_BASE}/api/s1/serp/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await backendRes.json();
      const answer = typeof json.answer === "string" ? json.answer : JSON.stringify(json, null, 2);
      // …stream `answer` back as text/event-stream and append it to the thread
    }
    ```

## 2. Deployment Topology

- **Domain**: `4tt3nt10n.com` (managed in Cloudflare).
- **Backend**:
  - Host: Hetzner VM (Ubuntu, Node 20, PM2).
  - Repo path: `/opt/liftoff`.
  - Backend service: `backend/` built to `backend/dist`, served by `Node` via `ecosystem.config.js` as `strategist-backend`.
  - Exposed at `https://api.4tt3nt10n.com`:
    - Cloudflare DNS: `A api.4tt3nt10n.com -> <Hetzner IP>` (proxied).
    - Caddy (`/var/snap/caddy/common/Caddyfile`) reverse‑proxies `api.4tt3nt10n.com` → `http://127.0.0.1:3001`.
    - TLS handled by Caddy + Cloudflare.
- **Frontend / C1 Dashboard**:
  - Local dev: `npm run dev` in `apps/c1-dashboard` → `http://localhost:3000` or `:3001`.
  - Production (planned): deploy `apps/c1-dashboard` to Vercel and point `copilot.4tt3nt10n.com` (Cloudflare CNAME) at the Vercel URL.
  - `NEXT_PUBLIC_SERVICE_URL` (or `NEXT_PUBLIC_BACKEND_URL`) must be set to `https://api.4tt3nt10n.com` in the C1 app’s environment.

## 3. Backend Run / Deploy Process

### Local (Mac) – edit & test

```bash
# From repo root
cd ~/code/liftoff

# Backend: run dev server against remote PG (via SSH tunnel), then test QA locally if needed
cd backend
npm install
npm run dev           # runs src/index.ts on localhost:3001
```

- Ensure `backend/.env` includes:
  ```env
  PGVECTOR_URL=postgres://liftoff_user:liftoff1425@localhost:5432/liftoff
  OPENAI_API_KEY=sk-...
  EMBEDDING_MODEL=text-embedding-3-small
  EMBEDDING_VERSION=v1
  EMBEDDING_CONCURRENCY=5
  ```
- For local testing against the Hetzner PG:
  ```bash
  ssh -L 55432:localhost:5432 root@4tt3nt10n.com
  # then set PGVECTOR_URL=postgres://liftoff_user:...@localhost:55432/liftoff
  ```

### Deploy to server (backend)

On your laptop (in `~/code/liftoff`):

```bash
git status
git add <changed files>
git commit -m "your message"
git push origin main
```

On the Hetzner server:

```bash
ssh root@4tt3nt10n.com
cd /opt/liftoff
git pull origin main
./deploy.sh
```

`deploy.sh` does:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Liftoff deploy starting ==="
cd /opt/liftoff
git pull origin main
cd backend
npm install --production=false
npm run build
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
echo "=== Liftoff deploy complete ==="
```

### Monitor backend

```bash
ssh root@4tt3nt10n.com
pm2 logs strategist-backend --lines 50
```

- The S1 QA route logs structured timing and errors, e.g.:

```text
[s1.serp.qa] {
  t_total_ms: 4200,
  t_search_ms: 800,
  t_llm_ms: 2800,
  limit: 20,
  search_limit: 30,
  answer_rows: 20,
  table_rows: 20,
  runDate: '2025-11-11'
}
```

- On error you’ll see:

```text
[s1.serp.qa] Error: <message>
```

Use this to identify whether latency is dominated by pgvector (`t_search_ms`) or the LLM call (`t_llm_ms`).

## 4. C1 Dashboard / Copilot Runbook

### Local dev

```bash
cd ~/code/liftoff/apps/c1-dashboard

# ensure env
cat .env.local
# should contain:
# NEXT_PUBLIC_SERVICE_URL=https://api.4tt3nt10n.com
# THESYS_API_KEY=<your_thesys_api_key>

npm install
npm run dev   # usually on http://localhost:3000 or :3001
```

- Root page (`src/app/page.tsx`) is a **client** component that dynamically renders the S1 copilot:

```tsx
"use client";

import dynamic from "next/dynamic";

const S1SerpChat = dynamic(() => import("./s1-serp-chat/page"), {
  ssr: false,
});

export default function Home() {
  return <S1SerpChat />;
}
```

- The actual copilot UI lives in `src/app/s1-serp-chat/page.tsx` and uses `C1Chat` with `apiUrl="/api/s1-serp-chat"`.

### C1 → Backend proxy (`/api/s1-serp-chat`)

- Defined in `apps/c1-dashboard/src/app/api/s1-serp-chat/route.ts`.
- It:
  - Accepts a JSON body `{ prompt, threadId, responseId }`.
  - Extracts the latest `prompt.content` as the SERP query.
  - Calls `POST ${NEXT_PUBLIC_SERVICE_URL}/api/s1/serp/qa` with:
    ```json
    {
      "query": "<user message text>",
      "runDate": "2025-11-11",
      "limit": 100
    }
    ```
  - Reads the JSON `{ answer, context }` and streams `answer` back to C1 as text.
  - Logs any backend issues:
    ```ts
    console.error("[/api/s1-serp-chat] backend error", backendRes.status, text);
    console.error("[/api/s1-serp-chat] fetch failed", e);
    console.error("[/api/s1-serp-chat] handler error", e);
    ```

### Debugging “Error while generating response”

1. **Check C1 route logs (local dev or deployed)**
   - On your dev machine, in the terminal running `npm run dev`, look for lines starting with:
     ```text
     [/api/s1-serp-chat] backend error ...
     [/api/s1-serp-chat] fetch failed ...
     [/api/s1-serp-chat] handler error ...
     ```
   - In production (e.g., Vercel), check the deployment logs for the same messages.
   - Common issues:
     - `backendRes.status` is `500` → backend `/api/s1/serp/qa` is erroring. Check server logs.
     - `Failed to reach backend` → `NEXT_PUBLIC_SERVICE_URL` is wrong, or Caddy/Cloudflare/PM2 is down.

2. **Check backend logs for `/api/s1/serp/qa`**
   - On the server:
     ```bash
     pm2 logs strategist-backend --lines 100
     ```
   - Look for `[s1.serp.qa]` lines and any `Error:` lines.
   - If you see 500s, check:
     - `backend/src/lib/openai.ts` → is `OPENAI_API_KEY` set in `/opt/liftoff/backend/.env`?
     - `backend/src/lib/pg.ts` → `PGVECTOR_URL` points to `postgres://liftoff_user:...@localhost:5432/liftoff`.
     - Run a quick DB sanity check:
       ```bash
       sudo -u postgres psql -d liftoff -c "SELECT run_date, COUNT(*) AS rows, COUNT(DISTINCT region_code) AS regions FROM serp_keyword_slug_embeddings GROUP BY run_date ORDER BY run_date;"
       ```
       Ensure `2025-11-11` exists with expected row/region counts.

3. **Hydration or UI errors**
   - We’ve mitigated the common C1/Next hydration mismatch by:
     - Making `page.tsx` a client component (`"use client";`).
     - Rendering the copilot only on the client via `dynamic(..., { ssr: false })`.
   - If you see further hydration errors, double‑check:
     - `apps/c1-dashboard/src/app/page.tsx` starts with `"use client";`.
     - `C1Chat` is only used in client components (no SSR).

4. **Performance issues**
   - The S1 QA route logs per‑request timings:
     ```text
     [s1.serp.qa] { t_total_ms: 4200, t_search_ms: 800, t_llm_ms: 2800, ... }
     ```
   - If `t_llm_ms` is high (> 20–30s):
     - We already cap `generateText` with `maxTokens: 300` and OpenAI `timeout: 30000` ms in `backend/src/lib/openai.ts`. You can reduce `maxTokens` or adjust `temperature` to speed up responses.
   - If `t_search_ms` is high:
     - Verify indexes on `serp_keyword_slug_embeddings` are present (`backend/src/scripts/vector/setup_serp_pgvector.ts`).
     - Check that `searchLimit` in `backend/src/scripts/vector/search_serp.ts` is reasonable (currently 30 by default).

---

## 5. Outstanding Items / Next Steps for Future Agents

As of the last session:

1. **C1 UX loads, but returns “Error while generating response”.**
   - Likely causes:
     - Backend `/api/s1/serp/qa` returning 500 (e.g., OpenAI/network/DB error).
     - Misconfigured `NEXT_PUBLIC_SERVICE_URL` / `BACKEND_BASE` in `apps/c1-dashboard/src/app/api/s1-serp-chat/route.ts`.
   - To debug:
     - Reproduce locally, then:
       - Check `npm run dev` logs for `[/api/s1-serp-chat] ...` messages.
       - Check `pm2 logs strategist-backend` for `[s1.serp.qa]` lines and any `Error`.

2. **Validate end‑to‑end QA path:**
   - From your laptop:
     ```bash
     curl -X POST https://api.4tt3nt10n.com/api/s1/serp/qa \
       -H 'Content-Type: application/json' \
       -d '{
         "query": "top Juvederm slugs in CA",
         "runDate": "2025-11-11",
         "limit": 20
       }'
     ```
   - Confirm you get a JSON like:
     ```json
     {
       "status": "ok",
       "runDate": "2025-11-11",
       "query": "...",
       "params": {...},
       "answer": "…",
       "context": { "rows": [ ... ] }
     }
     ```
   - If this works but C1 still errors, the bug is in the `apps/c1-dashboard` proxy route or C1 integration.

3. **Polish & production‑ize C1 app:**
   - Deploy `apps/c1-dashboard` to Vercel (or your platform of choice).
   - Set env vars:
     - `NEXT_PUBLIC_SERVICE_URL=https://api.4tt3nt10n.com`
     - `THESYS_API_KEY=<your Thesys key>`
   - Point `copilot.4tt3nt10n.com` at the deployed URL via Cloudflare.

4. **Enhance copilot experience:**
   - Parse user queries for `runDate`, `regionCodes`, `minRevenue`, etc. in `apps/c1-dashboard/src/app/api/s1-serp-chat/route.ts` and forward them to `/api/s1/serp/qa`.
   - Render the returned `context.rows` as an interactive table in the C1 UI using C1’s table components.
   - Add guardrails in the `system1` prompt (e.g., “don’t hallucinate slugs that aren’t in context.rows, always quote metrics with units, etc.”).

5. **Optional: System1 data QA & utilities**
   - System1 CSV ingestion and DuckDB/pgvector setup is documented in `docs/infra/hetzner-vector-db-setup.md`.
   - Additional System1 vector scripts live in `backend/src/scripts/vector/` (e.g. `top_slugs_by_rpc_rps.ts`, `top_slug_revenue.ts`, etc.).
   - `backend/src/routes/system1.ts` exposes:
     - `/api/system1/hooks/top`
     - `/api/system1/angle/phrases`
     - `/api/system1/angle/stations`
     - `/api/system1/session-revenue` / `/session-revenue/db` / `/session-revenue/settle-stats`
   - `backend/src/services/metaAdsService.ts` contains the logic for bridging Meta ad data to System1 slugs and is used by `routes/metaAdLibrary.ts`.

Use this runbook as the source of truth for how to run, debug, and extend the S1 SERP copilot. When you make significant changes (e.g., new endpoints, env vars, deployment changes), update this file so the next agent has an accurate map of the system. 





