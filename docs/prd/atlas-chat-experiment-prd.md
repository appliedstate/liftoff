## PRD — Atlas Chat Experiment (Website-to-API)

### Document Info
- Owner: Growth Ops · Collaborators: Platform Eng, Attention Factory
- Version: 0.1 (2025-10-24)
- Status: Draft
- References:
  - Backend Strategist endpoints: `GET /api/strategist/ask`, `POST /api/strategist/chat`
  - Dev exposure: ngrok public tunnel to `http://localhost:3001`
  - Related PRDs: `prd/terminal-facebook-bidder-prd.md`, `prd/strategis-facebook-metrics-endpoint.md`

### 1) Overview
We want a simple way for users (and ChatGPT “Atlas” Browser Companion) to converse with a Facebook Strategist chat agent that runs on our backend. The experiment validates two paths:

1) Website with an embedded chat UI that calls our backend API.
2) Atlas (or any external agent) calls our public API URL directly.

The goal is to minimize custom UI build while ensuring a reliable, low-latency loop between chat and our backend logic.

### 2) Goals & Non‑Goals
- Goals
  - Enable a publicly reachable API that accepts prompts and returns responses as plain text or JSON.
  - Provide a minimal website page that hits the same API and renders responses.
  - Validate that Atlas can call the API URL directly through a public tunnel (ngrok) or staging domain.
  - Capture basic telemetry (latency, prompt length, response length, HTTP status) for iteration.
- Non‑Goals
  - Rich multi-turn chat UX with history, auth, or roles (future).
  - On-page analytics dashboards (export logs for now).
  - Execution tools (e.g., terminal mutations) exposed publicly.

### 3) User Stories
- As a user, I can open a URL, type a question about Facebook strategy, and see an answer within 2–4 seconds.
- As an Atlas agent, I can call an HTTPS endpoint with a prompt and get a plain-text answer to present to the user.
- As an operator, I can expose my local backend safely via ngrok for demos and experiments.

### 4) Architecture
- Client options
  - Website page: lightweight form posts prompt → backend API → renders response.
  - Atlas: fetches the public API URL; returns the body to the user.
- Backend API (Express)
  - `GET /api/strategist/ask?prompt=...` → `text/plain` response (ideal for Atlas and quick tests)
  - `POST /api/strategist/chat` → JSON response `{ output: string }` (future: streaming)
- Exposure
  - Dev: ngrok tunnel (e.g., `https://abcd.ngrok-free.app`) to `http://localhost:3001`.
  - Staging/Prod: Vercel/Render/Fly.io with HTTPS and proper auth.
- Auth modes
  - Dev: unauth allowed for speed; responses may be fallback if no LLM key.
  - Prod: require token or Supabase auth; rate limiting.

### 5) Endpoints (Contracts)
- `GET /api/strategist/ask`
  - Query: `prompt` (required, string; URL-encoded)
  - Returns: `text/plain` body (concise answer). Status 200 on success; 4xx/5xx on errors.
- `POST /api/strategist/chat`
  - Body: `{ prompt: string, temperature?: number, maxTokens?: number }`
  - Returns: `{ output: string }`
  - Notes: For dev, may return an echo fallback without LLM credentials.

### 6) Website-to-API Wiring (Minimal)
- Client page (e.g., Next.js route `/copilot` or static page):
  - Elements: `<textarea id="prompt">`, “Send” button, `<pre id="out">`.
  - On click: `fetch('https://PUBLIC_BASE/api/strategist/ask?prompt=' + encodeURIComponent(prompt))`.
  - Render response text into the `<pre>`.
- Streaming (optional, later): upgrade to `POST /chat` with server-sent events or chunked responses.

### 7) Experiment Design
- Variants
  - A: Atlas-only (Atlas fetches `GET /ask`).
  - B: Website-only (user types on our page).
  - C: Both (user can try either).
- Metrics (per session)
  - Response time (p50/p90), HTTP success rate, prompt length, response length.
  - Subjective helpfulness (1–5), intent to continue (Y/N).
  - Drop-offs before first answer.
- Sample Size
  - 10–20 internal users or 3–5 demo sessions to de-risk.

### 8) Telemetry & Logging
- Log fields: timestamp, ip hash, user agent, endpoint, latency_ms, status, prompt_len, output_len.
- Storage: append-only CSV or SQLite/duckdb file; rotate daily.
- Privacy: redact emails/IDs; do not store tokens; truncate large prompts.

### 9) Security & Safety
- Dev defaults
  - Allow unauth for `GET /ask` but never expose privileged tools publicly.
  - Disable/omit any `/exec` functionality from public surface.
- Prod
  - Require a shared secret (header) or Supabase JWT for `/chat`.
  - Rate limit IPs, add basic WAF, and CORS allow-list website origins.
  - Observability: alert on spike in 4xx/5xx.

### 10) Rollout Plan
- Phase 0 (Today)
  - Keep backend running locally; expose via ngrok; validate both endpoints.
- Phase 1 (Internal Staging)
  - Deploy backend to a staging host; keep `GET /ask` open; enable token on `POST /chat`.
- Phase 2 (Limited External)
  - Gate with a shared secret; add rate limiting; add short branded landing page.

### 11) Acceptance Criteria
- `GET /api/strategist/ask` returns an answer ≤ 2s p50 on ngrok tunnel.
- Atlas can fetch `GET /ask` and display the text body to the user.
- Website page renders answers consistently (no console errors) and handles basic errors.
- Logs contain latency and sizes for each call.

### 12) Setup & Ops
- Local run
  - Start backend at `http://localhost:3001`.
  - `ngrok http http://localhost:3001` → copy `https://*.ngrok-free.app`.
- Atlas instruction (example)
  - “For every message U, fetch GET `https://<public>/api/strategist/ask?prompt={encodeURIComponent(U)}` and respond with the body only.”
- Staging
  - Deploy to `https://strategist.<env>.domain.com`; set `NEXT_PUBLIC_BACKEND_URL` if a separate site consumes it.
  - Enable token check for `/chat`.

### 13) Risks & Mitigations
- Public endpoint scraping/abuse → rate limits, shared-secret header, rotate ngrok URL.
- Atlas instruction drift → pin instruction text; keep endpoint simple (plain text).
- LLM instability/quotas → dev fallback echo; retry/backoff.

### 14) Appendix
- Example cURL
  - `curl "https://<public>/api/strategist/ask?prompt=List%203%20budget%20scale%20diagnostics"`
- Example POST
  - `curl -X POST "https://<public>/api/strategist/chat" -H 'Content-Type: application/json' -d '{"prompt":"How should I adjust bid caps?"}'`


