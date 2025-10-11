---
id: creative/41-hook-ideation-agent
version: 1.0.0
owner: growth-ops
runtime_role: agent
title: Hook Ideation Agent — Automated Concept Generation
purpose: Operational blueprint for AI-driven hook ideation from LPID headlines + RSOC keywords, plus AI ad cloner for unique IP transformation of competitor samples.
dependencies:
  - creative/40-creative-factory.md
  - content/30-article-factory.md
  - taxonomy/01-schema.md
kpis:
  hook_hit_rate: "≥ 20% of generated hooks become Working Hooks"
  uniqueness_score: "≥ 80% of hooks < 0.85 cosine similarity to competitor catalog"
  compliance_rate: "≥ 95% hooks pass policy filters"
  ideation_speed: "≤ 5 min per LPID batch"
licensing: internal
---

# 41 — Hook Ideation Agent

We automate "hook" ideation per LPID using AI agents that synthesize from LPID headlines and RSOC keyword widgets, plus an ad cloner that transforms competitor samples into unique IP. Feeds Creative Factory D1 with production-ready concepts.

---

## 1) Core Definitions

- **Hook/Concept** — the big idea; measured at the concept level across variants. ID = `<HOOK>` token in naming grammar. Maps to exactly one LPID.
- **LPID Context** — headline + top RSOC keywords (widget below first paragraph).
- **Widget Tie-in** — sentence directing user to click the top RSOC keyword.
- **Competitor Sample** — ad text/transcript/screenshot from competitors; abstracted to patterns.
- **Working Hook** — concept achieving vRPS uplift ≥ +20% vs account median on ≥2,000 sessions (7d).

---

## 2) Agent Architecture (Two Modes)

### A) Ideation Mode (Headline + Keywords → Hooks)
**Inputs**: `lpid`, `vertical`, `headline`, `rsoc_keywords[]` (ranked), `constraints` (vertical compliance).

**Outputs**: Hook concepts with briefs, variants, and QA scores.

### B) Clone Mode (Competitor Samples → Unique IP)
**Inputs**: Competitor ad samples + LPID context.

**Outputs**: Re-synthesized hooks with similarity gates ensuring novelty.

---

## 3) Ideation Workflow (DAG)

### 3.1 Context Normalization
- Parse `headline` → extract intent, promise, entity using NLP.
- Select top 5 `rsoc_keywords`; classify patterns (outcome/proof/local/problem/risk).
- Load vertical compliance rules and existing hook catalog.

### 3.2 Concept Generation
- Generate 25–40 hooks via LLM prompts across patterns: outcome-first, authority, contrarian, proof snippet, risk reframe, local, PAS.
- For each keyword, produce 2–3 hooks with explicit widget tie-in sentence: "See '<top keyword>' in the list below to start."
- Enforce LPID mapping; no prohibited claims.

### 3.3 Score + Rank
- **Keyword Alignment**: Uses top-1 phrase; mentions related synonyms.
- **LPID Fit**: Cosine similarity between hook promise and headline embedding.
- **Compliance Risk**: Regex/lists for banned claims; LLM classifier.
- **Uniqueness**: Min distance to existing hooks.
- Rank top 12 by composite score.

### 3.4 Variant Scripting
- For each selected hook: Generate 3 variants (916/15s/ugc, 45/30s/editorial, 11/15s/ugc).
- Produce 60–90w scripts with HOOK in first 2s, overlays, CTA, and widget tie-in line.

### 3.5 QA + Output
- Policy checks; naming grammar validation.
- Write to `hook_concepts`, `creative_briefs`, `hook_variants` with status `ready_for_make`.
- Emit naming seeds: `<VERT>-<LPID>-<HOOK>-<FMT>-<LEN>-<GEN>-v01`.

---

## 4) Clone Mode (Ad Thief → Unique IP)

### 4.1 Sample Ingestion
- Ingest competitor ads: OCR text, transcripts, captions, thumbnails, URLs.
- Extract hook skeletons: promise, proof device, tension, CTA, format cues.
- Abstract to patterns (remove brand wording, specific claims).

### 4.2 Re-synthesis
- Transform using our LPID context: headline + keywords.
- Apply uniqueness transformations: change surface language, swap proof devices to RSOC widget, alter CTA framing, localize.
- Include widget tie-in sentence referencing top keyword.

### 4.3 Similarity Gates
- Embedding cosine < 0.80 to nearest competitor line-level.
- < 0.85 to concept-level in our catalog.
- Compliance filter and policy checks.

### 4.4 Output
- Same as ideation mode: hooks, briefs, variants, naming seeds.

---

## 5) Data Model (Supabase)

### hook_concepts
```sql
id uuid PRIMARY KEY,
hook_slug text UNIQUE,
lpid text,
vertical text,
promise text,
angle text,
cta text,
compliance_lines text[],
sources text[],
created_by text,
created_at timestamp
```

### creative_briefs
```sql
id uuid PRIMARY KEY,
hook_id uuid REFERENCES hook_concepts,
one_liner text,
script_60_90w text,
widget_tie_in text,
status text DEFAULT 'draft'
```

### hook_variants
```sql
id uuid PRIMARY KEY,
hook_id uuid REFERENCES hook_concepts,
format text, -- '916'|'45'|'11'
length_sec int,
genre text, -- 'ugc'|'editorial'|'motion'
script text,
naming_seed text,
status text DEFAULT 'draft'
```

### ad_samples_competitor
```sql
id uuid PRIMARY KEY,
brand text,
text text,
transcript text,
images text[],
url text,
embeddings vector(1536) -- OpenAI ada-002
```

### similarity_index
```sql
item_id uuid,
vector vector(1536),
type text -- 'competitor_line'|'concept'|'ours'
```

### generation_jobs
```sql
id uuid PRIMARY KEY,
lpid text,
headline text,
rsoc_keywords text[],
mode text, -- 'ideate'|'clone'
status text DEFAULT 'pending',
logs jsonb,
created_at timestamp
```

---

## 6) Backend Services

### backend/src/services/creative/hooks.ts
```typescript
interface HookInputs {
  lpid: string;
  vertical: string;
  headline: string;
  rsoc_keywords: string[];
  mode?: 'ideate' | 'clone';
  competitor_samples?: AdSample[];
}

interface HookOutput {
  concepts: HookConcept[];
  briefs: CreativeBrief[];
  variants: HookVariant[];
  scores: HookScore[];
}

export class HookIdeationAgent {
  async generateHooks(inputs: HookInputs): Promise<HookOutput> {
    // 1. Normalize context
    const context = await this.normalizeContext(inputs);

    // 2. Generate concepts
    const concepts = await this.generateConcepts(context);

    // 3. Score and rank
    const scores = await this.scoreConcepts(concepts, context);
    const topConcepts = this.rankAndFilter(concepts, scores);

    // 4. Create variants
    const variants = await this.generateVariants(topConcepts);

    // 5. QA and output
    await this.qaAndPersist(topConcepts, variants);

    return { concepts: topConcepts, briefs: [], variants, scores };
  }
}
```

### backend/src/routes/creative.ts
```typescript
app.post('/api/creative/hooks/generate', async (req, res) => {
  const inputs: HookInputs = req.body;
  const agent = new HookIdeationAgent();
  const result = await agent.generateHooks(inputs);
  res.json(result);
});

app.post('/api/creative/hooks/clone', async (req, res) => {
  const inputs: HookInputs = { ...req.body, mode: 'clone' };
  const agent = new HookIdeationAgent();
  const result = await agent.generateHooks(inputs);
  res.json(result);
});

app.get('/api/creative/hooks', async (req, res) => {
  const { lpid } = req.query;
  const hooks = await supabase.from('hook_concepts').select('*').eq('lpid', lpid);
  res.json(hooks.data);
});
```

---

## 7) LLM Prompts

### Concept Ideation Prompt
```text
You are a performance creative strategist specializing in RSOC (Really Simple Online Comparison) advertising.

Inputs:
- LPID: {lpid}, Vertical: {vertical}
- Headline: "{headline}"
- RSOC keywords (ranked): {kw1}, {kw2}, {kw3}, {kw4}, {kw5}...

Task: Propose 25 hooks across these patterns: outcome-first, authority, contrarian, proof snippet, risk reframe, local, PAS.

For each hook, provide:
- hook_slug: snake_case identifier (≤20 chars)
- promise: compelling outcome (≤12 words)
- angle: RSOC-specific proof or insight (≤12 words)
- cta: action phrase (≤6 words)
- widget_tie_in: sentence pointing user to click "{kw1}" in the keyword widget

Rules:
- Must align with LPID intent from headline
- No prohibited claims (cures, guarantees, risk-free)
- Include compliance lines for {vertical}
- Avoid duplicates; maximize variety

Output: JSON array of hook objects.
```

### Variant Scripting Prompt
```text
Generate 3 video script variants for hook "{hook_slug}" with promise "{promise}".

Requirements:
- Format/Length/Genre: 916/15s/ugc, 45/30s/editorial, 11/15s/ugc
- Script length: 60–90 words per variant
- HOOK in first 2 seconds
- Include overlays for visual elements
- End with CTA and widget tie-in: "{widget_tie_in}"
- Vertical compliance: {compliance_lines}

For each variant, output:
- format, length_sec, genre, script (with timing notes), overlays[]

Output: JSON array.
```

### Clone Mode Prompt
```text
Given these competitor hook patterns (abstracted):
{competitor_patterns}

Re-synthesize 10 unique hooks for:
- LPID: {lpid}, Vertical: {vertical}
- Headline: "{headline}"
- Keywords: {keywords}

Requirements:
- Novelty: No phrase reuse from competitors
- Compliance: Lawful for {vertical}
- Include widget_tie_in referencing "{kw1}"
- Same output format as ideation

Output: JSON array.
```

---

## 8) Scoring & Gates

### Scoring Dimensions
- **keyword_alignment**: 0–1 (exact match to top keyword + synonyms)
- **headline_alignment**: cosine similarity (0–1)
- **uniqueness**: min distance to competitor catalog (0–1, higher = more unique)
- **policy_risk**: 0–1 (lower = safer)
- **format_coverage**: 0–1 (covers required formats)

### Gates
- keyword_alignment ≥ 0.7
- policy_risk ≤ 0.2
- uniqueness ≥ 0.8
- composite score ≥ 0.75

---

## 9) Integration with Creative Factory

### D1 Mining & Briefs
- Agent runs on new LPIDs from Article Factory.
- Outputs feed into D2 Make queue.
- Human review optional; agents flag high-confidence hooks.

### Performance Feedback
- After testing, roll up variant performance to concept level.
- Update hook catalog with Working Hook status.
- Feed back to scoring model for improved ideation.

---

## 10) Acceptance Criteria

- **Hit Rate**: ≥ 20% of generated hooks become Working Hooks.
- **Uniqueness**: ≥ 80% hooks < 0.85 cosine similarity to competitor catalog.
- **Compliance**: ≥ 95% hooks pass policy filters.
- **Speed**: ≤ 5 min per LPID batch.
- **Cost**: ≤ $0.50 per hook batch (LLM + embeddings).

---

## 11) Monitoring & Alerts

### Dashboard Tiles
- Generation queue depth
- Hit rate by vertical/LPID
- Compliance failure rate
- Uniqueness distribution
- Competitor catalog growth

### Alerts
- Hit rate < 15% for 3 days
- Compliance failures > 5%
- Queue depth > 50 pending

---

## 12) Quick Start

### Generate Hooks
```bash
curl -X POST http://localhost:3001/api/creative/hooks/generate \
  -H "Content-Type: application/json" \
  -d '{
    "lpid": "auto-insurance",
    "vertical": "finance",
    "headline": "Compare Auto Insurance Rates in 60 Seconds",
    "rsoc_keywords": ["compare quotes", "auto insurance rates", "car insurance", "cheap auto insurance", "best rates"]
  }'
```

### Clone from Competitors
```bash
curl -X POST http://localhost:3001/api/creative/hooks/clone \
  -H "Content-Type: application/json" \
  -d '{
    "lpid": "auto-insurance",
    "vertical": "finance",
    "headline": "Compare Auto Insurance Rates in 60 Seconds",
    "rsoc_keywords": ["compare quotes", "auto insurance rates"],
    "competitor_samples": [
      {"text": "Get the cheapest car insurance quotes online", "brand": "competitor1"}
    ]
  }'
```

---

## 13) Cross-References

- Creative Factory pipeline: `creative/40-creative-factory.md`
- Article Factory (LPID source): `content/30-article-factory.md`
- Taxonomy schema: `taxonomy/01-schema.md`
- Compliance policies: `operations/compliance-policies.md`
- Performance measurement: `operations/63-dashboards-and-alerts.md`


