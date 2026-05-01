# Quality Evaluator / Quality Evaluation System

## What it does
RAG-based system that evaluates web pages against Google's Search Quality Evaluator Guidelines (200-page PDF) across 5 dimensions:
*   **Needs Met**
*   **Page Quality**
*   **E-E-A-T** (Experience, Expertise, Authoritativeness, Trust)
*   **Ads/UX**
*   **Deception**

## Key files
*   `backend/src/lib/qualityEvaluator.ts` - Core evaluation logic
*   `backend/src/lib/articleExtractor.ts` - Full article extraction (Playwright)
*   `backend/src/lib/guidelinesRag.ts` - RAG retrieval from PDF guidelines
*   `backend/src/lib/aiContentDetector.ts` - SpamBrain-like AI detection
*   `backend/src/routes/quality.ts` - API endpoint (`/api/quality/eval`)
*   `backend/docs/QUALITY_EVALUATOR_SETUP.md` - Setup guide
*   `backend/docs/QUALITY_EVAL_*.md` - Various documentation files

## API endpoint
**POST** `/api/quality/eval`

## Current status
*   ✅ RAG system working (1,831 guideline chunks embedded)
*   ✅ Full article evaluation (not just summaries)
*   ✅ AI content detection (15%+ threshold)
*   ✅ RSOC keyword extraction (from URL params)
*   ✅ Widget placement analysis
*   ✅ Stricter evaluation (especially for YMYL content)
*   ✅ Evaluation logging to DB (`quality_evaluations` table)

## Recent improvements
*   Stricter prompts for YMYL content
*   AI detection (SpamBrain-like, targets low-value AI content)
*   RSOC keyword extraction from URL parameters (`forceKeyA-Z`)
*   Widget placement analysis (above/below fold, content interruption)
*   Full article content evaluation (Playwright extraction)

## Documentation
*   `backend/docs/QUALITY_EVALUATOR_SETUP.md` - Main setup guide
*   `backend/docs/QUALITY_EVAL_TESTING.md` - Testing guide
*   `backend/docs/QUALITY_EVAL_FULL_ARTICLE.md` - Full article evaluation docs
*   `backend/docs/QUALITY_EVAL_IMPROVEMENTS.md` - Future improvements

## Database
*   **Table:** `quality_evaluations` (stores evaluation results)
*   **Migration:** `backend/migrations/009_create_quality_evaluations.sql`

## Environment variables
*   `QUALITY_EVAL_CHUNKS_PER_DIMENSION` - Chunks retrieved per dimension (default: 12)
*   `GUIDELINES_PATH_LIKE` - Path filter for guideline chunks (default: `searchqualityevaluatorguidelines%`)
*   `QUALITY_EVAL_MODEL` - LLM model (default: `gpt-4.1-mini`)

## Example usage
```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "preparing lawn for winter",
    "url": "https://example.com/article",
    "ymyLHint": false,
    "saveForTraining": true
  }'
```

## Key concepts
*   **YMYL** (Your Money or Your Life): Higher standards for medical/financial content
*   **E-E-A-T**: Experience, Expertise, Authoritativeness, Trust
*   **RSOC widgets**: Related Searches on Click widgets (monetization)
*   **Scaled content abuse**: Low-value, templated AI content (Google penalizes)




