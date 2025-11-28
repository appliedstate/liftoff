# Quality Evaluator Setup Guide

This guide explains how to set up the Search Quality Evaluator Guidelines for the quality evaluation system.

## Overview

The quality evaluator uses RAG (Retrieval-Augmented Generation) over the Google Search Quality Evaluator Guidelines PDF to score pages across 5 dimensions:
- **Needs Met**: How well the page satisfies the user's query
- **Page Quality**: Overall quality rating (Lowest → Highest)
- **E-E-A-T**: Experience, Expertise, Authoritativeness, Trust
- **Ads/UX**: How ads/widgets affect user experience
- **Deception**: Risk of misleading or deceptive content

## How Comprehensive Is It?

**The evaluator does NOT literally apply every sentence of the 200-page PDF**, but it uses a smart retrieval system:

1. **Per-dimension retrieval**: For each dimension (Needs Met, Page Quality, etc.), it:
   - Builds a semantic query like "Needs Met ratings for YMYL medical pages"
   - Retrieves the **top 6 most relevant chunks** from the PDF (using vector similarity)
   - Passes those chunks to the LLM as context

2. **YMYL-aware**: If the page is classified as YMYL (Your Money or Your Life), it retrieves YMYL-specific guidelines; otherwise non-YMYL guidelines.

3. **Focused but thorough**: Instead of reading all 200 pages for every evaluation, it pulls the **most relevant sections** for each specific dimension and page type. This is more efficient and accurate than trying to apply everything at once.

**In practice**: For a dental implants YMYL page, it will retrieve:
- YMYL-specific Needs Met criteria
- YMYL Page Quality standards (higher bar)
- YMYL E-E-A-T requirements (medical expertise needed)
- Ads/UX guidelines for health topics
- Deception patterns relevant to medical content

So while it doesn't "run through the entire PDF" literally, it **does pull the most relevant parts** for each evaluation, making it comprehensive for the specific page being evaluated.

## Setup Steps

### 1. Convert PDF to Markdown

You need to convert `searchqualityevaluatorguidelines.pdf` to markdown format.

**Option A: Use an online converter or tool**
- Upload the PDF to a PDF-to-Markdown converter
- Save as `searchqualityevaluatorguidelines.md`

**Option B: Use `pdftotext` + manual cleanup**
```bash
# Install poppler-utils if needed
# macOS: brew install poppler
# Ubuntu: apt-get install poppler-utils

pdftotext -layout searchqualityevaluatorguidelines.pdf searchqualityevaluatorguidelines.txt
# Then manually convert to markdown (add headings, structure)
```

**Option C: Use a Python script with pdfplumber or PyMuPDF**
```python
import pdfplumber
import re

with pdfplumber.open("searchqualityevaluatorguidelines.pdf") as pdf:
    text = []
    for page in pdf.pages:
        text.append(page.extract_text())
    
content = "\n\n".join(text)
# Save as .md file
```

### 2. Place PDF Markdown in Dedicated Folder

Create a folder specifically for the guidelines:

```bash
mkdir -p docs/search-quality-guidelines
mv searchqualityevaluatorguidelines.md docs/search-quality-guidelines/
```

### 3. Embed Only the Guidelines PDF

Run the embed script pointing at just the guidelines folder:

```bash
cd backend
node dist/scripts/vector/embed_docs.js --rootDir=../docs/search-quality-guidelines
```

This will:
- Chunk the PDF markdown into ~1200-character sections
- Embed each chunk using OpenAI embeddings
- Store in `repo_docs_embeddings` with `path` like `search-quality-guidelines/searchqualityevaluatorguidelines.md`

### 4. Configure Path Filter (Optional)

The code now defaults to filtering by `searchqualityevaluatorguidelines%`, but you can override via env var:

```bash
# In backend/.env
GUIDELINES_PATH_LIKE=search-quality-guidelines/searchqualityevaluatorguidelines%
```

Or if your path is different, adjust accordingly.

### 5. Verify It's Working

After embedding, verify the chunks are in the DB:

```bash
# On server
psql $PGVECTOR_URL -c "SELECT COUNT(*) FROM repo_docs_embeddings WHERE path LIKE 'search-quality-guidelines%';"
```

You should see a count matching the number of chunks from the PDF (typically 100-500 chunks for a 200-page PDF, depending on how it's structured).

### 6. Test the Evaluator

```bash
curl -X POST http://localhost:3001/api/quality/eval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "2025 dental implant innovations and trials",
    "pageSummary": "H1: 2025 Dental Implant Innovations and Trials. Article explains new materials, written by Ethan Williams (software background) without visible dental credentials.",
    "widgetSummary": "Below the intro, a large Related Searches section shows three blue buttons advertising $1500 payments for dental implant participation.",
    "ymyLHint": true
  }'
```

The `guidelineSections` in the response should now reference only sections from the Search Quality Evaluator Guidelines PDF, not your internal docs.

## Troubleshooting

**Problem**: Evaluator is still pulling from internal docs instead of PDF

**Solution**: 
1. Check that the PDF markdown was embedded: `SELECT path FROM repo_docs_embeddings WHERE path LIKE '%searchquality%' LIMIT 5;`
2. Verify the path pattern matches: The code filters by `searchqualityevaluatorguidelines%` - make sure your embedded chunks have paths that match this pattern.
3. If your PDF markdown is in a subfolder, adjust `GUIDELINES_PATH_LIKE` env var or update the default in `qualityEvaluator.ts`.

**Problem**: Not enough chunks retrieved

**Solution**: Increase `k` in `scoreDimension()` (currently 6). More chunks = more context but slower and more expensive.

**Problem**: Chunks seem irrelevant

**Solution**: The semantic search should be pulling relevant chunks, but if not:
- Check that the PDF markdown has clear section headings (helps chunking)
- Verify embeddings are working: `SELECT content FROM repo_docs_embeddings WHERE path LIKE '%searchquality%' LIMIT 1;`
- Consider re-chunking with different `maxChars` in `embed_docs.js`

## Next Steps

Once the PDF-only setup is working, you can:
- Fine-tune chunk sizes if needed
- Add more specific dimension queries
- Build a UI to visualize scores
- Collect evaluation data for fine-tuning (future)

