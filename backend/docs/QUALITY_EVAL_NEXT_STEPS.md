# Quality Evaluator: Next Steps

## ✅ What We've Built

1. **RAG-based evaluator** using Search Quality Evaluator Guidelines PDF
2. **5 dimensions**: Needs Met, Page Quality, E-E-A-T, Ads/UX, Deception
3. **PDF-only filtering** (no internal docs)
4. **1,831 guideline chunks** embedded and ready

## 🎯 Immediate Next Steps (Do These Now)

### Step 1: Increase Coverage (Better Evaluation)

**What**: Increase chunks retrieved per dimension from 6 → 12

**Why**: Better coverage of guideline sections, fewer missed edge cases

**How**:
```bash
# On server
cd /opt/liftoff/backend

# Option A: Set env var (recommended)
echo 'QUALITY_EVAL_CHUNKS_PER_DIMENSION=12' >> .env

# Option B: Or rebuild with hardcoded value (already done in code)
npm run build
pkill -f "node dist/index.js" && sleep 2 && npm start
```

**Test**: Run an evaluation and check that `guidelineSections` arrays are longer/more diverse

---

### Step 2: Create Evaluation Logging Table

**What**: Create DB table to store all evaluations for analysis

**Why**: Track patterns, identify gaps, prepare for fine-tuning

**How**:
```bash
# On server
cd /opt/liftoff/backend
[ -f .env ] && export $(grep -v '^#' .env | xargs)
psql "$PGVECTOR_URL" -f migrations/009_create_quality_evaluations.sql
```

**Verify**:
```bash
psql "$PGVECTOR_URL" -c "\d quality_evaluations"
psql "$PGVECTOR_URL" -c "SELECT COUNT(*) FROM quality_evaluations;"
```

---

### Step 3: Start Collecting Training Data

**What**: Save evaluations to DB when `saveForTraining: true` is passed

**How**: When calling the API, add the flag:

```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "2025 dental implant innovations and trials",
    "pageSummary": "H1: 2025 Dental Implant Innovations and Trials...",
    "widgetSummary": "Below the intro, a large Related Searches section...",
    "ymyLHint": true,
    "saveForTraining": true
  }'
```

**Goal**: Collect 200-500 evaluations over the next few weeks

---

## 📊 Monitoring & Analysis

### Check Guideline Section Coverage

See which sections are cited most/least:

```sql
-- On server
psql "$PGVECTOR_URL" -c "SELECT * FROM guideline_section_usage LIMIT 20;"
```

**What to look for**:
- Are some sections never cited? (might indicate gaps)
- Are some sections over-cited? (might indicate they're too generic)
- Are YMYL-specific sections being used for YMYL pages?

### Check Score Distributions

See how scores are distributed:

```sql
psql "$PGVECTOR_URL" -c "SELECT * FROM quality_score_distribution WHERE dimension = 'needs_met';"
```

**What to look for**:
- Are scores too conservative? (everything "Low" or "ModeratelyMet")
- Are scores too lenient? (everything "High" or "FullyMet")
- Is there good variance across quality levels?

---

## 🚀 Future Improvements

### Phase 1: Multi-Query Retrieval (2-4 weeks)

**Goal**: Retrieve chunks using multiple query variations per dimension

**Implementation**: Modify `scoreDimension()` to:
1. Generate 2-3 query variations
2. Retrieve chunks for each
3. Merge and deduplicate
4. Pass to LLM

**Files**: `backend/src/lib/qualityEvaluator.ts`

### Phase 2: Fine-Tuning (2-3 months)

**Prerequisites**:
- ✅ 200+ evaluations saved to DB
- ✅ Human review of 50-100 edge cases
- ✅ Consistent evaluation patterns observed

**Steps**:
1. Export training data from `quality_evaluations` table
2. Format for OpenAI fine-tuning API
3. Fine-tune 5 models (one per dimension)
4. Evaluate against held-out test set
5. Deploy alongside RAG system
6. A/B test and gradually shift traffic

**Cost**: ~$750-3000 upfront, breaks even after 50k-150k evaluations

---

## 📝 Quick Reference Commands

### Run Evaluation (with logging)
```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "your query here",
    "pageSummary": "your page summary",
    "widgetSummary": "your widget summary",
    "ymyLHint": true,
    "saveForTraining": true
  }'
```

### Check Evaluation Count
```bash
psql "$PGVECTOR_URL" -c "SELECT COUNT(*) FROM quality_evaluations;"
```

### View Recent Evaluations
```bash
psql "$PGVECTOR_URL" -c "SELECT query, classification->>'ymyL' as ymyl, created_at FROM quality_evaluations ORDER BY created_at DESC LIMIT 10;"
```

### Check Guideline Coverage
```bash
psql "$PGVECTOR_URL" -c "SELECT section, usage_count FROM guideline_section_usage ORDER BY usage_count DESC LIMIT 20;"
```

---

## 🎓 Key Decisions

### Should You Fine-Tune Now?

**No, wait if**:
- You have < 100 evaluations
- Patterns are still inconsistent
- Guidelines PDF might update soon
- Cost isn't a concern

**Yes, consider if**:
- You have 200+ high-quality evaluations
- You see consistent patterns
- You're running 1000+ evaluations/month
- Cost reduction matters

### Current System is Good Enough If:
- Evaluations are consistent
- Scores align with your expectations
- Coverage seems comprehensive
- Cost is acceptable

**Recommendation**: Use the RAG system for 2-3 months, collect data, then decide on fine-tuning.

