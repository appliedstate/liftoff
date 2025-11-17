## S1 SERP Agent – Next Steps Runbook

This runbook arms the next engineer or agent with **what exists today**, **how to run/test it**, and **where to extend it next**.

---

### 1. Context / Current State (as of 2025‑11‑17)

We now have a working **S1 SERP copilot “agent”** exposed via:

- **Backend**: `https://api.4tt3nt10n.com/api/s1/agent`
- **Frontend (C1Chat)**:
  - **Local dev**: `http://localhost:3002/s1-serp-chat`
  - **Deployed**: `https://agent.4tt3nt10n.com/s1-serp-chat`

The **S1 agent**:

- Accepts natural-language **`query`** (and optional **`threadId`**) at `POST /api/s1/agent`.
- Uses `planS1Action` (in `backend/src/agents/s1Planner.ts`) to choose a **tool plan**:
  - **`keyword_total`** – “total revenue for keyword X”.
  - **`top_slugs`** – “top N slugs by `est_net_revenue` (with RPC/RPS)”.
  - **`keywords_for_slug`** – “top keywords for slug X by revenue/RPC/RPS”.
  - **`qa_search`** – generic vector‑search‑based QA (pgvector).
  - **`keyword_state_breakdown`** – revenue by state for a keyword (currently routed via QA fallback in the agent).
  - **`query_spec`** – **scaffolding exists** in types/tools, but planner doesn’t route here yet.
- Executes the chosen tool via `backend/src/services/s1SerpTools.ts`.
- Summarizes the `toolResult` using `generateText` (`backend/src/lib/openai.ts`, currently `OPENAI_MODEL=gpt-5.1`).
- Returns a structured payload:

  ```json
  {
    "status": "ok",
    "plan": { "tool": "top_slugs", "limit": 20 },
    "toolResult": { "type": "top_slugs", "runDate": "YYYY-MM-DD", "rows": [...] },
    "answer": "Natural-language summary using the numbers above…"
  }
  ```

Additional S1 endpoints in `backend/src/routes/s1.ts`:

- `POST /api/s1/serp/search` – pgvector search over SERP rows.
- `POST /api/s1/serp/qa` – vector search + LLM narrative QA.
- `POST /api/s1/serp/metrics` – fixed metrics modes:
  - `total_revenue`
  - `top_slugs`
  - `keyword_state_breakdown`
- `POST /api/s1/query` – generic **`S1QuerySpec` → SQL aggregator** over `serp_keyword_slug_embeddings`:
  - Metrics: `total_revenue`, `rpc`, `rps`.
  - Group by: `slug`, `keyword`, `region`.

On the **frontend**, `/api/s1-serp-chat` (in `apps/c1-dashboard/src/app/api/s1-serp-chat/route.ts`) is now:

- Parsing the C1Chat `{ prompt, threadId, responseId }` request.
- Normalizing `queryText` from `prompt.content` (handles `<content>...</content>` wrappers).
- Building:

  ```ts
  const backendBody = { query, runDate: "2025-11-11", limit: 100, threadId };
  ```

- POSTing that to `${BACKEND_BASE}/api/s1/agent`.
- Taking `answer` from the agent response as the “backend analysis”.
- Sending `answer` through Thesys C1 (`c1/openai/gpt-5/v-20250915`) via `transformStream` to render in the C1Chat UI.

The S1 SERP chat page (`apps/c1-dashboard/src/app/s1-serp-chat/page.tsx`) simply renders:

```tsx
<C1Chat apiUrl="/api/s1-serp-chat" theme={{ mode: "dark" }} />
```

---

### 2. How to Reproduce / Test Locally

#### 2.1 Run backend locally

Use Node 20 or 22 (DuckDB bindings do **not** support Node 25 on macOS ARM at the time of writing).

```bash
cd /Users/ericroach/code/liftoff/backend

# Select Node 22 (or 20) – required for DuckDB
nvm use 22

npm install
npm run dev    # starts on http://localhost:3001
```

Ensure your `backend/.env` is configured to talk to pg/pgvector and OpenAI as documented in the existing S1 SERP copilot runbook.

#### 2.2 Run frontend locally

```bash
cd /Users/ericroach/code/liftoff/apps/c1-dashboard

npm install
npm run dev:3002   # starts on http://localhost:3002
```

You should be able to open:

- `http://localhost:3002/s1-serp-chat`

#### 2.3 Smoke‑test the agent directly (backend only)

From a terminal while the backend is running:

```bash
curl -s http://localhost:3001/api/s1/agent \
  -H "Content-Type: application/json" \
  -d '{"query":"What are the top 20 slugs by est_net_revenue?"}'
```

Validate:

- **`plan.tool`** is `"top_slugs"`.
- **`plan.limit`** matches the question (`20`).
- **`toolResult.rows`** has the expected number of rows (20, 100, etc. depending on question).
- **`answer`**:
  - Is coherent.
  - References the numbers in `toolResult.rows`.
  - Does **not** invent backend errors or missing parameters.

Try another query:

```bash
curl -s http://localhost:3001/api/s1/agent \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the top revenue producing keywords for careers/exploring-careers-in-home-repair-and-contracting-en-us/"
  }'
```

Validate that:

- `plan.tool === "keywords_for_slug"`.
- `plan.slug` matches the slug in the question.
- `toolResult.rows` is a list of keywords with revenue/RPC/RPS.

#### 2.4 Test end‑to‑end through C1Chat

With both backend and frontend running:

1. Open `http://localhost:3002/s1-serp-chat` in your browser.
2. Ask:
   - `List the top 20 slugs with the highest est_net_revenue in a table please top to bottom`
   - `What are the top revenue producing keywords for careers/exploring-careers-in-home-repair-and-contracting-en-us/`
3. Validate:
   - Answers **match backend data** (sanity‑check a few rows against `/api/s1/agent`).
   - No messages like “Unable to retrieve…” or invented backend errors.
   - For “top 20”, the answer lists **all 20 items** (no `—` placeholders).

If C1 shows a generic “Error while generating response”, check:

- Frontend logs: `npm run dev:3002` terminal (look for `[/api/s1-serp-chat]` logs).
- Backend logs: `npm run dev` in `backend` (look for `[s1.agent]` logs and any errors).

---

### 3. Key Code Locations

#### 3.1 Backend (Node/Express, `backend/`)

- **Entry**: `src/index.ts`
  - Mounts the S1 router at `/api/s1` → `src/routes/s1.ts`.
  - Uses `PORT` from `.env` (prod: `3001`).

- **S1 routes**: `src/routes/s1.ts`
  - `POST /api/s1/serp/search` → `serpVectorSearch(...)`.
  - `POST /api/s1/serp/qa` → vector search + LLM QA over SERP rows.
  - `POST /api/s1/serp/metrics` → `runSerpMetricsQuery(...)` (metrics modes).
  - `POST /api/s1/query` → `runSerpQuerySpec(...)` (`S1QuerySpec` → SQL).
  - `POST /api/s1/agent` → **S1 agent orchestration**:
    - Reads `{ query, threadId }` from the request body.
    - Uses `planS1Action` (planner) to select a tool.
    - Calls tools from `services/s1SerpTools.ts`.
    - Uses `s1AgentState` map to keep per‑thread `{ lastPlan, lastToolResult }`.
    - Calls `generateText` with a disciplined system prompt to summarize `toolResult`.
    - Returns `{ status, plan, toolResult, answer }`.

- **Planner**: `src/agents/s1Planner.ts`
  - `heuristicPlan(userQuestion)` – cheap, deterministic patterns for:
    - `"total revenue"` → (currently defers to LLM planner so we can extract the actual keyword).
    - `"top ... slugs"`, “highest revenue” + slug‑like words + “revenue”/`rpc`/`rps` → `top_slugs` with a numeric `limit` if specified.
    - `"top keyword(s) for <slug>"` → parses the slug after `for` and returns `keywords_for_slug` with an inferred limit.
  - `planS1Action(userQuestion)`:
    - Tries `heuristicPlan` first.
    - If no heuristic match, calls `generateText` (model `OPENAI_MODEL`, currently `gpt-5.1`) with a JSON‑only system prompt to pick one of:
      - `keyword_total`, `top_slugs`, `keywords_for_slug`, `keyword_state_breakdown`, `qa_search` (future: `query_spec`).
    - Parses the JSON and returns an `S1Plan` object used by `/api/s1/agent`.
    - Falls back to `{ tool: "qa_search", query: userQuestion }` if parsing fails.

- **Tools**: `src/services/s1SerpTools.ts`
  - `toolKeywordTotalRevenue(keyword)`:
    - Calls `runSerpMetricsQuery({ mode: "total_revenue", keyword })`.
    - Returns `{ type: "keyword_total", keyword, runDate, totalRevenue }`.
  - `toolTopSlugs(limit)`:
    - Calls `runSerpMetricsQuery({ mode: "top_slugs", limit })`.
    - Returns `{ type: "top_slugs", runDate, limit, rows }`.
  - `toolKeywordsForSlug(slug, limit)`:
    - Calls `runSerpMetricsQuery({ mode: "keywords_for_slug", keyword: slug, limit })`.
    - Returns `{ type: "keywords_for_slug", slug, runDate, limit, rows }`.
  - `toolSerpSearch(query, limit)`:
    - Calls `serpVectorSearch({ query, limit })`.
    - Returns `{ type: "qa_search", ...searchResult }`.
  - `toolRunQuerySpec(spec)`:
    - Wraps `runSerpQuerySpec(spec)` (for future `query_spec` plans).
    - Returns `{ type: "query_spec", runDate, spec: effectiveSpec, rows }`.

- **Analytics query surfaces** (used indirectly by the agent):
  - `runSerpMetricsQuery(input)`:
    - Implements the fixed **metrics modes**:
      - `total_revenue` – sum over `serp_keyword_slug_embeddings`.
      - `top_slugs` – group by `content_slug`, compute revenue + RPC/RPS.
      - `keywords_for_slug` – group by `serp_keyword_norm` for a given `content_slug`.
      - `keyword_state_breakdown` – revenue by `region_code` with keyword/state filters.
  - `runSerpQuerySpec(spec: S1QuerySpec)`:
    - Generic, constrained analytics spec:
      - `metric`: `total_revenue | rpc | rps`.
      - `groupBy`: `slug | keyword | region`.
      - `filters`: `slug`, `keyword`, `minRevenue`, `runDate`.
      - `orderBy`: one of the metric fields.
      - `limit`: 1–1000.

#### 3.2 Frontend (Next 15, `apps/c1-dashboard/`)

- **S1 SERP chat page**: `src/app/s1-serp-chat/page.tsx`
  - Renders `C1Chat` with:
    - `apiUrl="/api/s1-serp-chat"`.
    - `theme={{ mode: "dark" }}`.
- **S1 SERP chat API**: `src/app/api/s1-serp-chat/route.ts`
  - `POST` handler:
    - Extracts `{ prompt, threadId, responseId }` from C1Chat.
    - Normalizes free‑text `queryText` from `prompt.content`.
    - Builds `backendBody = { query, runDate: "2025-11-11", limit: 100, threadId }`.
    - Calls `POST ${BACKEND_BASE}/api/s1/agent`.
    - Reads `answer` from the JSON response (or error text).
    - Sends `answer` through Thesys C1 (`c1/openai/gpt-5/v-20250915`) using `transformStream` to render natural language / components in the UI.

---

### 4. How to Improve Like Cursor (Next Agent To‑Do List)

This section is intentionally written as a checklist for the **next agent**.

#### 4.1 Finish wiring `query_spec` into the planner and tools

- In `src/agents/s1Planner.ts`:
  - Extend the system prompt and logic so that for questions like:
    - “Break down revenue by region…”
    - “Show top 10 slugs by RPC…”
    - “Filter to slugs over $X revenue…”
  - The planner can return:
    - `{ tool: "query_spec", spec: S1QuerySpec }`.
- In `src/routes/s1.ts` (`/api/s1/agent`):
  - Add an explicit branch:

    ```ts
    } else if (plan.tool === "query_spec") {
      toolResult = await toolRunQuerySpec(plan.spec);
    }
    ```

- Ensure `runSerpQuerySpec` safely covers any new analytics patterns you introduce (no arbitrary SQL).

#### 4.2 Make follow‑ups more “agent‑y”

- We already store: `s1AgentState[threadId] = { lastPlan, lastToolResult }`.
- Extend follow‑up handling in `/api/s1/agent`:
  - For follow‑ups like:
    - “why only N?”
    - “what about beyond X?”
    - “can you show top 50 instead?”
  - Use `previous.lastPlan` and `previous.lastToolResult`:
    - For explanatory follow‑ups (“why only N?”), keep reusing the previous data (already implemented for a subset of phrasings).
    - For extension follow‑ups (“show top 50 instead”), call the same tool with a higher `limit`, then **merge** the new `rows` with the old ones and explain the delta.
- Update the answer system prompt to:
  - Explicitly call out **differences between current and previous results** when both are present.
  - Encourage explanations like “Previously you saw X; with the new limit of 50, the additional slugs are Y and Z.”

#### 4.3 Better table formatting and column control

- Add an optional **render spec** to the plan:

  ```ts
  type S1RenderSpec = {
    type: "table";
    columns: string[];
    rows?: number;
  };
  ```

- Extend `S1Plan` to include `render?: S1RenderSpec` for structured tools.
- In `/api/s1/agent`, pass `plan.render` into the summarizer prompt with instructions like:
  - “Render a markdown table with exactly N rows and these columns: …”
- Goal: Cursor‑style tables:
  - No `—` placeholders.
  - Stable column order.
  - Rank column when user asks for “top N”.

#### 4.4 Test harness for the agent

- Create a script, e.g. `backend/src/scripts/testS1Agent.ts`:
  - Reads canned test cases from JSON:

    ```json
    [
      {
        "name": "Top 20 slugs by revenue",
        "input": "List the top 20 slugs with the highest est_net_revenue in a table please top to bottom",
        "expectedTool": "top_slugs",
        "minRows": 20
      },
      {
        "name": "Keywords for slug",
        "input": "What are the top revenue producing keywords for careers/exploring-careers-in-home-repair-and-contracting-en-us/",
        "expectedTool": "keywords_for_slug",
        "minRows": 10
      }
    ]
    ```

  - For each test:
    - Calls `POST http://localhost:3001/api/s1/agent`.
    - Asserts:
      - `plan.tool === expectedTool`.
      - `toolResult.rows.length >= minRows` (when applicable).
      - `answer` is non‑empty and doesn’t contain banned markers (see guardrails below).
- Wire this into CI or use it as a manual pre‑deploy sanity check.

#### 4.5 Logging & tracing

- In `/api/s1/agent`:
  - Ensure you log per request:
    - `query`, `threadId` (after stripping obvious PII if needed).
    - `plan` (tool + key params such as `limit`, `slug`).
    - Summary stats from `toolResult`:
      - `rows.length`.
      - Basic aggregates (e.g. min/max `total_revenue`) if cheap.
  - This makes it easy to answer:
    - Which tool gets chosen for which class of question?
    - How often does the planner fall back to `qa_search`?
    - Are “top N” questions consistently returning enough rows?

#### 4.6 Guardrails against hallucinated errors and partial outputs

- The system prompt already:
  - Prohibits mentioning backend errors unless `toolResult.error` exists.
  - Requires listing `N` rows when the user asks for “top N” and we have ≥ N rows.
- Future improvements:
  - Bump `maxTokens` for answers when we expect wide tables (e.g. `top 100`).
  - Add explicit **negative tests** in the test harness:
    - Fail if the answer contains:
      - `"—"` in place of a table row.
      - Strings like `"we couldn’t retrieve"` or `"backend error"` when no error is present in JSON.
  - Consider a post‑processing step for tables (e.g. parse markdown table and assert row/column counts in tests).

---

### 5. What the Next Agent Should Do First

If you are the next person picking this up:

1. **Run backend + frontend locally** and verify the two core flows:
   - `top_slugs` query (top 20 slugs by revenue).
   - `keywords_for_slug` query for a known slug.
2. **Add 3–5 test cases** to the agent test harness and get it passing.
3. **Wire `query_spec`** in the planner + `/api/s1/agent` so we can handle richer analytics questions without ad‑hoc SQL.
4. **Iterate on the summarizer prompt** using real `plan` / `toolResult` examples pasted into a scratchpad (you can do this without touching SQL).

For a deeper explanation of how this system is architected and how we got here, see:  
**`docs/operations/s1-serp-agent-architecture.md`**.


