# Quality Evaluator Improvements: Comprehensive Coverage & Fine-Tuning

## Part 1: Ensuring Comprehensive Evaluation Across All Guideline Chunks

Currently, the system retrieves **top 6 chunks** per dimension. To ensure comprehensive coverage:

### Option A: Increase Retrieval Count (Simple)

**Current**: `k: 6` chunks per dimension  
**Improved**: `k: 10-15` chunks per dimension

**Pros**: 
- Simple change
- More context per dimension
- Better coverage of edge cases

**Cons**:
- Higher token costs
- Slower evaluation
- Diminishing returns after ~10-12 chunks

**Implementation**:
```typescript
// In qualityEvaluator.ts, line 148
const chunks = await searchGuidelinesChunks({
  query: guidelineQuery,
  k: 12, // Increased from 6
  pathLike: process.env.GUIDELINES_PATH_LIKE || 'searchqualityevaluatorguidelines%',
});
```

### Option B: Multi-Query Retrieval (Better Coverage)

Retrieve chunks using **multiple query variations** per dimension to ensure we don't miss relevant sections.

**Implementation Strategy**:
1. Generate 2-3 query variations per dimension
2. Retrieve top chunks for each variation
3. Deduplicate and merge results
4. Pass combined context to LLM

**Example for Needs Met**:
- Query 1: "Needs Met ratings for YMYL medical pages"
- Query 2: "How to rate Needs Met for health content"
- Query 3: "FullyMet vs HighlyMet criteria for medical articles"

**Pros**:
- Better semantic coverage
- Catches different phrasings of same concepts
- More thorough than single query

**Cons**:
- More complex implementation
- Higher cost (multiple embeddings + more chunks)

### Option C: Hierarchical Retrieval (Most Comprehensive)

Two-stage retrieval:
1. **Coarse retrieval**: Get top 20-30 chunks by semantic similarity
2. **Fine filtering**: Use LLM to select most relevant 8-10 chunks from the coarse set

**Pros**:
- Most comprehensive coverage
- Ensures no relevant sections missed
- LLM can intelligently filter

**Cons**:
- Most expensive (coarse retrieval + LLM filtering)
- Slowest evaluation time

### Recommended Approach: **Option A + Option B Hybrid**

1. **Increase `k` to 10-12** (simple, immediate improvement)
2. **Add multi-query retrieval** for critical dimensions (needs_met, page_quality, eeat)
3. **Monitor coverage** by tracking which guideline sections are cited most/least often

---

## Part 2: Fine-Tuning a Model

### When to Fine-Tune

Fine-tune **only after** you have:
1. ✅ **100+ labeled examples** of page evaluations (page → scores)
2. ✅ **Consistent evaluation patterns** from the RAG system
3. ✅ **Clear performance gaps** that fine-tuning could address

### What Fine-Tuning Would Improve

**Benefits**:
- **Consistency**: Model learns your specific scoring patterns
- **Speed**: No RAG retrieval needed (or minimal retrieval)
- **Cost**: Lower per-evaluation cost after initial training
- **Reliability**: Less variance in scores for similar pages

**Trade-offs**:
- **Upfront cost**: Training data collection + fine-tuning cost
- **Maintenance**: Need to retrain when guidelines update
- **Flexibility**: Harder to adapt to new guideline sections without retraining

### Fine-Tuning Strategy

#### Step 1: Collect Training Data

**Option A: Use RAG System Outputs**
- Run evaluations on 200-500 real articles
- Save inputs + outputs as training examples
- Have human reviewers validate/correct scores

**Option B: Human-Labeled Dataset**
- Have quality raters manually score pages using guidelines
- More accurate but expensive/time-consuming

**Option C: Hybrid**
- Use RAG outputs as initial labels
- Human reviewers correct edge cases and disagreements
- Most cost-effective

#### Step 2: Prepare Training Data Format

Each training example:
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a Google Search Quality rater following the official guidelines."
    },
    {
      "role": "user",
      "content": "Query: {query}\nPage Summary: {pageSummary}\nWidget Summary: {widgetSummary}\nYMYL: {ymyL}\n\nEvaluate Needs Met rating."
    },
    {
      "role": "assistant",
      "content": "{\"score\": \"ModeratelyMet\", \"reasoning\": \"...\", \"guidelineSections\": [...]}"
    }
  ]
}
```

#### Step 3: Fine-Tune Model

**Model choice**:
- `gpt-4o-mini` (cheaper, good for structured outputs)
- `gpt-4o` (better quality, more expensive)

**Training approach**:
- Fine-tune separate models per dimension, OR
- Fine-tune one model with dimension as input parameter

**Recommended**: Start with **one model per dimension** for better specialization.

#### Step 4: Evaluation & Deployment

**Metrics to track**:
- Agreement with RAG system (should be 80%+)
- Agreement with human raters (target 70%+)
- Consistency across similar pages
- Cost per evaluation

**Deployment strategy**:
- Run fine-tuned model in parallel with RAG system
- Compare outputs
- Gradually shift traffic to fine-tuned model
- Keep RAG as fallback/validation

---

## Implementation Roadmap

### Phase 1: Improve RAG Coverage (Week 1-2)

1. **Increase `k` to 10-12** per dimension
2. **Add multi-query retrieval** for `needs_met` and `page_quality`
3. **Monitor** which guideline sections are cited
4. **Document** any gaps in coverage

**Files to modify**:
- `backend/src/lib/qualityEvaluator.ts` (increase k, add multi-query)

### Phase 2: Collect Training Data (Week 3-6)

1. **Build data collection endpoint**:
   - `POST /api/quality/eval` saves inputs + outputs to DB
   - Add flag: `saveForTraining: true`

2. **Run evaluations** on 200-500 real articles
   - Mix of YMYL and non-YMYL
   - Mix of quality levels (Lowest → Highest)

3. **Human review**:
   - Review 50-100 edge cases
   - Correct scores where RAG system seems wrong
   - Document disagreements

**Files to create**:
- `backend/src/routes/quality.ts` (add save endpoint)
- `backend/migrations/009_create_quality_evaluations.sql` (training data table)

### Phase 3: Fine-Tune Models (Week 7-8)

1. **Export training data** from DB
2. **Format for OpenAI fine-tuning**
3. **Fine-tune** one model per dimension (5 models total)
4. **Evaluate** against held-out test set
5. **Deploy** fine-tuned models alongside RAG

**Files to create**:
- `backend/scripts/quality/export_training_data.ts`
- `backend/scripts/quality/finetune_models.ts`
- `backend/src/lib/qualityEvaluatorFinetuned.ts` (fine-tuned version)

### Phase 4: Production Deployment (Week 9+)

1. **A/B test** RAG vs fine-tuned models
2. **Monitor** performance metrics
3. **Gradually shift** traffic to fine-tuned models
4. **Keep RAG** as fallback/validation

---

## Quick Wins (Do These First)

### 1. Increase Retrieval Count

**File**: `backend/src/lib/qualityEvaluator.ts`  
**Change**: Line 148, `k: 6` → `k: 12`

**Impact**: Better coverage, minimal code change

### 2. Add Coverage Monitoring

Track which guideline sections are cited most/least:

```sql
-- Create view to track guideline section usage
CREATE VIEW guideline_section_usage AS
SELECT 
  unnest(string_to_array(guideline_sections::text, ',')) AS section,
  COUNT(*) AS usage_count
FROM quality_evaluations
GROUP BY section
ORDER BY usage_count DESC;
```

### 3. Add Evaluation Logging

Save all evaluations to DB for analysis:

```sql
CREATE TABLE quality_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  page_summary TEXT NOT NULL,
  widget_summary TEXT,
  ymyl_hint BOOLEAN,
  classification JSONB,
  dimensions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Cost Analysis

### Current RAG System (per evaluation)
- 5 dimensions × (1 embedding + 1 LLM call) = ~$0.01-0.02 per evaluation
- With `k: 12`: ~$0.015-0.025 per evaluation

### Fine-Tuned System (after training)
- 5 dimensions × 1 LLM call = ~$0.005-0.01 per evaluation
- **50% cost reduction** after initial training investment

### Training Costs
- Fine-tuning: ~$50-200 per model (5 models = $250-1000)
- Data collection: ~$500-2000 (human review time)
- **Total upfront**: ~$750-3000

**Break-even**: After ~50,000-150,000 evaluations (depending on model choice)

---

## Recommendations

**Short-term (next 2 weeks)**:
1. ✅ Increase `k` to 12 per dimension
2. ✅ Add evaluation logging to DB
3. ✅ Monitor guideline section coverage

**Medium-term (next 2 months)**:
1. Collect 200-500 training examples
2. Add multi-query retrieval for critical dimensions
3. Human review of edge cases

**Long-term (3+ months)**:
1. Fine-tune models if training data quality is high
2. A/B test fine-tuned vs RAG
3. Deploy fine-tuned models if they outperform

**Don't fine-tune yet** if:
- You have < 100 labeled examples
- Evaluation patterns are still inconsistent
- Guidelines PDF might update soon
- Cost isn't a concern (RAG is working fine)

