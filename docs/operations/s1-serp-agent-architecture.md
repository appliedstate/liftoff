## S1 SERP Agent – Design & Architecture

This document explains **how the S1 SERP agent is put together** and **how we evolved from a simple SERP QA endpoint to the current planner+tools architecture**.

Use this when you need to reason about design decisions, add new tools, or debug behavior beyond the step‑by‑step runbooks.

---

### 1. High‑Level Goals

The S1 SERP agent exists to let marketers ask **natural‑language questions** about System1 SERP performance and get:

- **Structured analytics** (e.g. top slugs by revenue, best keywords for a slug, revenue by state).
- **Trustworthy narratives** that:
  - Quote real numbers.
  - Don’t invent backend errors.
  - Behave predictably on “top N” questions (Cursor‑style).

To achieve this, the agent:

- Uses a **planner + tools** pattern instead of embedding all logic in a single prompt.
- Relies on a **constrained analytics surface** (`runSerpMetricsQuery`, `runSerpQuerySpec`) so the LLM never writes raw SQL.
- Maintains **per‑thread state** (`s1AgentState`) to support follow‑up questions.
- Is **fronted by C1Chat** in the C1 dashboard so the UX looks and feels like Cursor.

---

### 2. Data & Infra: What We’re Querying

#### 2.1 Core dataset

The primary table is **`serp_keyword_slug_embeddings`** in Postgres (with pgvector):

- Each row roughly represents a **(keyword, content slug, region)** combination, with:
  - `serp_keyword_norm`
  - `content_slug` / `content_slug_norm`
  - `region_code`
  - `est_net_revenue`
  - `sellside_searches`
  - `sellside_clicks_network`
  - Derived metrics such as `rpc` (revenue per click) and `rps` (revenue per search).
- Rows are keyed by **`run_date`**, which represents a particular snapshot/batch.

DuckDB is used in the ingestion/processing pipeline, but the **agent itself** operates purely on the Postgres/pgvector side:

- Embeddings and K‑NN search are handled through helper code in `backend/src/scripts/vector/search_serp.ts`.
- Aggregated analytics use standard SQL over `serp_keyword_slug_embeddings`.

#### 2.2 Access layer

All SERP analytics flows go through `backend/src/routes/s1.ts`:

- **Vector search & QA**:
  - `POST /api/s1/serp/search` → `serpVectorSearch(...)`.
  - `POST /api/s1/serp/qa` → wraps `serpVectorSearch` and calls `generateText` with a SERP‑specific prompt.
- **Metrics & aggregations**:
  - `POST /api/s1/serp/metrics` → `runSerpMetricsQuery(...)`.
  - `POST /api/s1/query` → `runSerpQuerySpec(...)`.
- **Agent**:
  - `POST /api/s1/agent` → planner + tools + summarizer (described below).

All of these share:

- A common **run date resolution** helper: `resolveSerpRunDate(client, runDate?)` picks the latest available `run_date` when none is specified.
- A structured, audited SQL surface (no raw SQL assembled by LLMs).

---

### 3. Backend Architecture – Planner + Tools

At the heart of the S1 agent are three layers:

1. **Planner** – decides *which* tool(s) to call and with what parameters.
2. **Tools** – call metrics/query/vector endpoints and shape their results.
3. **Summarizer** – turns tool output into a user‑facing answer.

#### 3.1 Planner (`src/agents/s1Planner.ts`)

The planner takes a **user question string** and returns an **`S1Plan`**:

```ts
export type S1ToolName =
  | "keyword_total"
  | "top_slugs"
  | "keywords_for_slug"
  | "keyword_state_breakdown"
  | "qa_search"
  | "query_spec";

export type S1Plan =
  | { tool: "keyword_total"; keyword: string }
  | { tool: "top_slugs"; limit: number }
  | { tool: "keywords_for_slug"; slug: string; limit?: number }
  | { tool: "query_spec"; spec: S1QuerySpec }
  | { tool: "qa_search"; query: string }
  | { tool: "keyword_state_breakdown"; keyword: string; states?: string[] };
```

The planning logic is **two‑stage**:

1. **`heuristicPlan(userQuestion)`**:
   - Cheap, deterministic rules for high‑signal intents, e.g.:
     - “top N slugs by revenue with RPC/RPS” → `top_slugs` with parsed `limit`.
     - “top revenue producing keywords for {slug}” → `keywords_for_slug` with parsed slug + limit.
   - This avoids LLM routing for common production paths and makes behavior predictable.
2. **LLM routing (`planS1Action`)**:
   - If no heuristic rule matches, `planS1Action` calls `generateText` with a **JSON‑only system prompt** describing the available tools and rules.
   - The LLM returns a JSON object (`{ "tool": "...", ... }`) which is parsed into `S1Plan`.
   - On parse errors, we fall back to `{ tool: "qa_search", query: userQuestion }`.

**Design choices:**

- **Heuristics first**: reduces latency and avoids planner drift on core intents.
- **LLM as router**: handles the long tail of questions, including future `query_spec` usage.
- **Explicit `S1Plan` type**: makes all downstream branches (tools, UI, tests) type‑safe and discoverable.

#### 3.2 Tools (`src/services/s1SerpTools.ts`)

Tools are thin wrappers around **metrics/query/search** primitives that produce **LLM‑friendly JSON**:

- `toolKeywordTotalRevenue(keyword)`:
  - Uses `runSerpMetricsQuery({ mode: "total_revenue", keyword })`.
  - Returns a compact JSON object with `totalRevenue` and `runDate`.
- `toolTopSlugs(limit)`:
  - Uses `runSerpMetricsQuery({ mode: "top_slugs", limit })`.
  - Returns `{ runDate, limit, rows }`, where each row has `content_slug`, `total_revenue`, `rpc`, `rps`.
- `toolKeywordsForSlug(slug, limit)`:
  - Uses `runSerpMetricsQuery({ mode: "keywords_for_slug", keyword: slug, limit })`.
  - Returns `{ slug, runDate, limit, rows }`, where each row is a keyword with revenue/RPC/RPS.
- `toolSerpSearch(query, limit)`:
  - Uses `serpVectorSearch({ query, limit })`.
  - Returns `{ type: "qa_search", runDate, results: [...] }`.
- `toolRunQuerySpec(spec)`:
  - Uses `runSerpQuerySpec(spec: S1QuerySpec)`.
  - Returns `{ type: "query_spec", runDate, spec: effectiveSpec, rows }`.

**Design choices:**

- Tools **hide SQL and search details** from the summarizer.
- Each tool result has a consistent `type` + minimal but sufficient context for the LLM.
- This makes it easy to log, test, and extend **per‑tool behavior**.

#### 3.3 Agent route (`src/routes/s1.ts` – `/api/s1/agent`)

The `POST /api/s1/agent` handler orchestrates the full flow:

1. **Input**:
   - Reads `{ query, threadId }` from the JSON body.
   - Normalizes `threadId` to a `threadKey` (or `"default"`).
2. **Thread state**:
   - Looks up `previous = s1AgentState.get(threadKey)` to support follow‑ups.
   - Detects “why only…?” follow‑up patterns to **reuse prior plan and toolResult** instead of calling tools again.
3. **Plan + Act**:
   - If we’re in a “why only” follow‑up:
     - Reuse `previous.lastPlan` and `previous.lastToolResult`.
   - Else:
     - Call `planS1Action(query)` to get `plan`.
     - Dispatch on `plan.tool`:
       - `keyword_total` → `toolKeywordTotalRevenue`.
       - `top_slugs` → `toolTopSlugs`.
       - `keywords_for_slug` → `toolKeywordsForSlug`.
       - `qa_search` → `toolSerpSearch`.
       - Other tools currently fall back to `toolSerpSearch(query, 50)` until fully implemented.
4. **Summarize**:
   - Builds a **system prompt** that:
     - Emphasizes using **only** the JSON values.
     - Prohibits inventing backend errors.
     - Requires listing exactly `N` rows when user asks for “top N” and data has at least `N` rows.
   - Builds a **prompt** that includes:
     - Current `plan` + `toolResult` JSON.
     - Previous plan/result JSON if available.
   - Calls `generateText` with low temperature and bounded `maxTokens`.
5. **State update + response**:
   - Stores `{ lastPlan: plan, lastToolResult: toolResult }` in `s1AgentState` for this `threadKey`.
   - Returns `{ status: "ok", plan, toolResult, answer }`.

**Design choices:**

- Agent behavior is **transparent**:
  - You see the plan and raw tool output in every response.
  - This makes debugging and prompt iteration straightforward.
- Follow‑ups are modeled after Cursor:
  - Agent can reason about previous steps without re‑hitting tools.
  - Future work can add richer follow‑up patterns (e.g. “increase limit and merge results”).

---

### 4. Analytics Surfaces – Metrics vs. QuerySpec vs. QA

The S1 agent stands on top of three **analytics “surfaces”**, each with a different trade‑off.

#### 4.1 Metrics surface (`runSerpMetricsQuery`)

Used by the **typed tools**; supports:

- `total_revenue`:
  - Simple sum across all rows for a given run date (and optional keyword).
- `top_slugs`:
  - Group by `content_slug`, compute `total_revenue`, `rpc`, `rps`, order by `total_revenue desc`, limit by `safeLimit`.
- `keywords_for_slug`:
  - Group by `serp_keyword_norm` for a specific `content_slug`, with the same metrics.
- `keyword_state_breakdown`:
  - Group by `region_code`, filter by keyword and optional states list.

This surface is:

- **Fast to call** (single SQL query).
- **Tightly constrained**, reducing risk of mis‑routed or dangerous queries.

#### 4.2 QuerySpec surface (`runSerpQuerySpec` + `S1QuerySpec`)

`S1QuerySpec` is a **small DSL** for analytics:

- Metrics: `total_revenue | rpc | rps`.
- Group by: `slug | keyword | region`.
- Filters: `slug`, `keyword` (ILIKE), `minRevenue`, `runDate`.
- Order by: one of the metrics, `asc`/`desc`.
- Limit: 1–1000.

The implementation:

- Validates the spec.
- Resolves `runDate`.
- Builds a parameterized SQL query with:
  - `SELECT` on the agreed metrics.
  - `WHERE` filters.
  - Optional `GROUP BY` and `HAVING` for `minRevenue`.
  - `ORDER BY` and `LIMIT`.

The agent doesn’t **yet** route to `query_spec` plans, but the tooling (`toolRunQuerySpec`) is ready.

The intent:

- Give the planner a **more expressive but still safe surface** for future questions like:
  - “Top 10 slugs by RPC over $X revenue.”
  - “Break down revenue by region for slug X.”

#### 4.3 QA surface (`serpVectorSearch` + `/api/s1/serp/qa`)

For open‑ended questions or when no structured plan fits, the agent can fall back to:

- **Vector search**:
  - `serpVectorSearch({ query, runDate?, regionCodes?, minRevenue?, limit })`.
  - Uses pgvector to retrieve the most relevant SERP rows for the query.
- **LLM QA**:
  - `/api/s1/serp/qa` turns the top rows into a narrative answer with recommendations.

The agent’s `qa_search` tool currently uses only vector search and leaves summarization to the agent’s own prompt; the legacy `/serp/qa` route is still useful as a baseline and for non‑agent use.

---

### 5. Frontend Integration – C1Chat + Agent

#### 5.1 C1Chat wiring

In `apps/c1-dashboard`:

- `src/app/s1-serp-chat/page.tsx`:
  - Renders `C1Chat` with `apiUrl="/api/s1-serp-chat"` and dark theme.
- `src/app/api/s1-serp-chat/route.ts`:
  - Accepts C1Chat’s `{ prompt, threadId, responseId }`.
  - Normalizes `prompt.content` to a single `queryText` string.
  - Strips `<content>...</content>` wrappers that sometimes appear.
  - Builds `{ query, runDate: "2025-11-11", limit: 100, threadId }`.
  - Calls `POST ${BACKEND_BASE}/api/s1/agent`.
  - Takes `answer` and sends it through Thesys C1 (`c1/openai/gpt-5/v-20250915`) using `transformStream` to stream tokens back to C1Chat.

This pattern:

- Makes the backend agent the **source of truth** for analytics logic.
- Uses C1/Cursor only as a **presentation layer** over the agent’s answer.

#### 5.2 Why we double‑LLM the response

We deliberately **LLM‑summarize twice**:

1. **Backend summarizer**:
   - Focused on **accuracy and structure** using raw JSON output.
   - Guardrails (no hallucinated backend errors, correct “top N” behavior).
2. **Frontend (Thesys) summarizer**:
   - Focused on **UX and phrasing** in the C1 UI.

This split makes it easy to:

- Iterate on backend prompts with full visibility into `plan`/`toolResult`.
- Change the frontend model or rendering behavior without touching analytics.

---

### 6. How We Got Here (Evolution)

1. **Phase 1 – SERP QA endpoint**:
   - Started with `/api/s1/serp/search` and `/api/s1/serp/qa`:
     - Vector search + OpenAI summarization.
   - Frontend C1 route simply proxied `/api/s1/serp/qa` and streamed back `answer`.
   - Pros:
     - Quick to build.
     - Good for exploratory “what’s going on in this SERP?” questions.
   - Cons:
     - Hard to guarantee consistent tables (“top N”).
     - Planner logic was buried inside a single prompt.

2. **Phase 2 – Structured metrics surface**:
   - Added `runSerpMetricsQuery` and `/api/s1/serp/metrics`:
     - Explicit modes for `total_revenue`, `top_slugs`, `keyword_state_breakdown`, etc.
   - Added `/api/s1/copilot` routes (GET/POST) that:
     - Heuristically picked a metrics mode.
     - Ran metrics or QA and summarized the result.
   - Pros:
     - Cleaner analytics SQL.
     - More predictable behavior for a few key intents.
   - Cons:
     - Still interleaved routing, tool selection, and summarization logic.

3. **Phase 3 – Planner + tools + per‑thread state**:
   - Introduced `S1Plan`, `s1Planner.ts`, and `s1SerpTools.ts`.
   - Implemented `/api/s1/agent` with:
     - Planner (heuristic + LLM).
     - Tool dispatch.
     - Summarizer with strong guardrails.
     - `s1AgentState` map for per‑thread history (Cursor‑style).
   - Updated C1 route to call `/api/s1/agent` instead of `/serp/qa`.
   - Pros:
     - Clear separation of responsibilities (plan → act → summarize).
     - Easy to add new tools and routing rules.
     - Transparency: every response carries `plan` and `toolResult`.

4. **Phase 4 – S1QuerySpec scaffolding (in progress)**:
   - Added `S1QuerySpec` and `runSerpQuerySpec`.
   - Exposed `/api/s1/query` for generic analytics in a safe DSL.
   - Implemented `toolRunQuerySpec`.
   - Planner still doesn’t route to `query_spec` by default; this is the next big extension.

---

### 7. Next Architectural Steps

From a design/architecture perspective, the next steps are:

- **Promote `query_spec` to a first‑class planning target**:
  - Extend the planner’s system prompt and examples to use `query_spec` when questions involve:
    - Specific groupings (e.g., by region).
    - Thresholds (`minRevenue`).
    - Alternate metrics (`rpc`, `rps`).
- **Richer follow‑up semantics**:
  - Move beyond “why only…” into:
    - “Show more rows” (increase limit, merge, explain differences).
    - “Filter to X/Y” (derive a new `S1QuerySpec` off the previous one).
- **Plan‑aware rendering**:
  - Standardize how tables and summaries are rendered based on `plan.render` (or similar).
- **Observability & regression testing**:
  - Log per‑tool statistics, planner decisions, and answer quality markers.
  - Build a small library of regression tests that lock in desired behavior for core prompts.

If you’re changing core behavior (planner, tools, summarizer), update both:

- `docs/operations/s1-serp-agent-next-steps.md` (runbook / how‑to).
- This architecture doc (design decisions / invariants).

Keeping these in sync is the fastest way to onboard the next agent at “Cursor‑level” speed.


