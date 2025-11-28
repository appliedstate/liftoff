# Quality Evaluator: Full Article Evaluation

## ✅ What Changed

The evaluator now evaluates **the full article content**, not just a summary. This matches how Googlebot and human quality raters actually review pages.

## How It Works

### Option 1: Provide URL (Recommended)

The system will automatically:
1. Fetch the page using Playwright (like Googlebot)
2. Extract full article content (title, H1, body, author, headings, links, images)
3. Detect widgets/ads automatically
4. Evaluate the **complete article** against guidelines

```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "2025 dental implant innovations and trials",
    "url": "https://example.com/article",
    "ymyLHint": true,
    "saveForTraining": true
  }'
```

### Option 2: Provide Full Content Directly

If you already have the article content:

```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "2025 dental implant innovations and trials",
    "pageSummary": "Title: ... H1: ... Author: ...",
    "fullArticleText": "Full article body text here...",
    "widgetSummary": "Widgets detected...",
    "ymyLHint": true
  }'
```

## What Gets Extracted

When you provide a URL, the system extracts:

- **Title** (from `<title>` tag)
- **H1** (main heading)
- **Meta description**
- **Author** (from various patterns: `[rel="author"]`, `.author`, etc.)
- **Publish date** (from `<time>`, meta tags, etc.)
- **Full article text** (main content, excluding nav/footer/ads)
- **All headings** (H2-H6)
- **Links** (internal and external)
- **Images** (with alt text)
- **Widgets/ads** (automatically detected)
- **Layout signals** (above-fold content, ad density)

## How Evaluation Works

1. **Article Extraction**: If URL provided, Playwright fetches and extracts full content
2. **Classification**: LLM classifies page (YMYL, purpose, content type) using full article preview
3. **Per-Dimension Scoring**: For each dimension (Needs Met, Page Quality, etc.):
   - Retrieves top 12 guideline chunks from PDF (configurable)
   - Passes **full article text** + guideline chunks to LLM
   - LLM evaluates the complete article against guidelines
   - Returns score, reasoning, and cited guideline sections

## Token Limits

- Full articles are truncated to **~6000 words** (if longer) for the evaluation
- This ensures we stay within LLM context limits while preserving most content
- Classification uses first 2000 chars (enough to determine YMYL/purpose)

## Benefits

✅ **Comprehensive**: Evaluates entire article, not just summary  
✅ **Accurate**: Sees all content, headings, structure, links  
✅ **Automatic**: Just provide URL, extraction happens automatically  
✅ **Googlebot-like**: Uses Playwright to render page like a real crawler  
✅ **Widget Detection**: Automatically detects ads/widgets/monetization  

## Example Response

```json
{
  "classification": {
    "ymyL": true,
    "purpose": "informational article on dental implant innovations",
    "contentType": "article"
  },
  "dimensions": [
    {
      "dimension": "needs_met",
      "score": "ModeratelyMet",
      "reasoning": "The full article provides relevant information about 2025 dental implant innovations, covering new materials and specific trials. However, the author lacks visible dental credentials and the page includes prominent advertising, reducing trustworthiness for this YMYL medical topic.",
      "guidelineSections": [
        "Needs Met for YMYL pages",
        "Highly Meets accuracy and trustworthiness for YMYL topics"
      ]
    },
    // ... other dimensions
  ]
}
```

## Migration from Old API

**Old way** (still works):
```json
{
  "query": "...",
  "pageSummary": "Short summary..."
}
```

**New way** (recommended):
```json
{
  "query": "...",
  "url": "https://example.com/article"
}
```

The old API still works for backward compatibility, but providing a URL gives you full article evaluation.

## Performance

- **Extraction**: ~5-10 seconds per URL (Playwright rendering)
- **Evaluation**: ~10-15 seconds (5 dimensions × LLM calls)
- **Total**: ~15-25 seconds per evaluation

For batch processing, consider:
- Caching extracted articles
- Parallelizing evaluations
- Using faster models for non-critical evaluations

