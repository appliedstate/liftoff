# Quality Evaluator Cleanup - Step-by-Step Instructions

Follow these steps **in order** to clean up the quality evaluator to use only the Search Quality Evaluator Guidelines PDF.

---

## Prerequisites

- PDF file: `searchqualityevaluatorguidelines.pdf` (the 200-page document)
- Access to your Mac (for local work)
- Access to the Hetzner server (for deployment)

---

## Step 1: Convert PDF to Markdown

**On your Mac:**

1. **Locate your PDF file** (e.g., `~/Downloads/searchqualityevaluatorguidelines.pdf`)

2. **Install poppler** (if not already installed):
   ```bash
   brew install poppler
   ```

3. **Run the conversion script**:
   ```bash
   cd /Users/ericroach/code/liftoff/backend
   ./scripts/convert_pdf_to_markdown.sh ~/Downloads/searchqualityevaluatorguidelines.pdf
   ```
   
   (Replace `~/Downloads/searchqualityevaluatorguidelines.pdf` with your actual PDF path)

4. **Verify the markdown was created**:
   ```bash
   ls -lh ../docs/search-quality-guidelines/searchqualityevaluatorguidelines.md
   ```
   
   You should see a file that's roughly the same size as the PDF (or larger if text expands).

5. **Optional: Review and clean up the markdown**:
   ```bash
   open ../docs/search-quality-guidelines/searchqualityevaluatorguidelines.md
   ```
   
   - Check that headings are properly formatted (`#`, `##`, `###`)
   - Ensure sections are clearly separated
   - Fix any obvious formatting issues
   
   **Note**: The conversion script does basic formatting, but manual cleanup will improve chunking quality.

---

## Step 2: Commit the Markdown File

**On your Mac:**

```bash
cd /Users/ericroach/code/liftoff

# Add the markdown file
git add docs/search-quality-guidelines/searchqualityevaluatorguidelines.md

# Commit it
git commit -m "Add Search Quality Evaluator Guidelines PDF as markdown"

# Push to remote
git push origin main
```

---

## Step 3: Embed Only the Guidelines PDF

**On the Hetzner server:**

1. **SSH into the server**:
   ```bash
   ssh root@5.78.105.235
   ```

2. **Pull the latest code** (to get the markdown file):
   ```bash
   cd /opt/liftoff
   git pull origin main
   ```

3. **Verify the markdown file exists**:
   ```bash
   ls -lh docs/search-quality-guidelines/searchqualityevaluatorguidelines.md
   ```

4. **Embed only the guidelines PDF**:
   ```bash
   cd backend
   node dist/scripts/vector/embed_docs.js --rootDir=../docs/search-quality-guidelines
   ```

   **Expected output**: You should see logs like:
   ```
   Scanning docs under: /opt/liftoff/docs/search-quality-guidelines
   Found 1 doc file(s). Chunking...
   Generated XXX chunks. Checking for existing hashes...
   ...
   ```

5. **Verify chunks were embedded**:
   ```bash
   [ -f .env ] && export $(grep -v '^#' .env | xargs)
   psql "$PGVECTOR_URL" -c "SELECT COUNT(*) AS chunk_count FROM repo_docs_embeddings WHERE path LIKE 'search-quality-guidelines%';"
   ```
   
   You should see a count (typically 100-500 chunks for a 200-page PDF).

---

## Step 4: Update Code to Filter by PDF Only

**On your Mac:**

1. **Commit the code changes** (already done, but verify):
   ```bash
   cd /Users/ericroach/code/liftoff
   git status
   ```
   
   You should see `backend/src/lib/qualityEvaluator.ts` as modified.

2. **If not committed, commit and push**:
   ```bash
   git add backend/src/lib/qualityEvaluator.ts backend/docs/QUALITY_EVALUATOR_SETUP.md backend/scripts/convert_pdf_to_markdown.sh
   git commit -m "Filter quality evaluator to use only Search Quality Guidelines PDF"
   git push origin main
   ```

---

## Step 5: Deploy Updated Code to Server

**On the Hetzner server:**

1. **Pull the latest code**:
   ```bash
   ssh root@5.78.105.235
   cd /opt/liftoff
   git pull origin main
   ```

2. **Rebuild the backend**:
   ```bash
   cd backend
   npm run build
   ```

3. **Restart the backend** (kill old process, start new):
   ```bash
   # Find and kill old process
   pkill -f "node dist/index.js"
   
   # Wait a moment
   sleep 2
   
   # Start fresh
   npm start
   ```
   
   **Note**: If you're using a process manager (pm2, systemd), restart it instead:
   ```bash
   # For pm2:
   pm2 restart backend
   
   # For systemd:
   systemctl restart liftoff-backend
   ```

---

## Step 6: Test the Cleaned-Up Evaluator

**On the Hetzner server:**

1. **Test with a simple query**:
   ```bash
   curl -X POST http://localhost:3001/api/quality/eval \
     -H "Content-Type: application/json" \
     -d '{"query":"test","pageSummary":"test page","widgetSummary":"test","ymyLHint":false}'
   ```

2. **Check the `guidelineSections` in the response**:
   
   Look at the JSON response. The `guidelineSections` arrays should now reference only sections from the Search Quality Evaluator Guidelines PDF, **not** your internal docs like `creative/42-ai-ad-cloner.md` or `operations/meetings/media-buying/...`.

   **Before cleanup**: Sections might include:
   - `"creative/42-ai-ad-cloner.md - How is the final ad validated?"`
   - `"operations/meetings/media-buying/2025-11-12-media-buying.md - Highlights & Insights"`

   **After cleanup**: Sections should only reference:
   - `"Needs Met rating basics"`
   - `"Page Quality for YMYL pages"`
   - `"E-E-A-T assessment"`
   - etc. (generic guideline section names, not file paths)

3. **Test with your dental implants example**:
   ```bash
   curl -X POST http://localhost:3001/api/quality/eval \
     -H "Content-Type: application/json" \
     -d '{
       "query": "2025 dental implant innovations and trials",
       "pageSummary": "H1: 2025 Dental Implant Innovations and Trials. Article explains new materials (zirconia, titanium-zirconium), mentions RevBio TETRANITE trials, DIRR registry, AI/robotics, sustainability, and ethical considerations, written by Ethan Williams (software background) without visible dental credentials. Sources listed but not deeply cited.",
       "widgetSummary": "Below the intro, a large Related Searches section shows three blue buttons advertising $1500 payments for dental implant participation, likely sponsored or RSOC widgets.",
       "ymyLHint": true
     }'
   ```

   Verify that `guidelineSections` now only reference the PDF guidelines.

---

## Step 7: Verify Database State (Optional)

**On the Hetzner server:**

Check that you have chunks from both sources (old mixed docs + new PDF-only):

```bash
[ -f backend/.env ] && export $(grep -v '^#' backend/.env | xargs)
psql "$PGVECTOR_URL" -c "
  SELECT 
    CASE 
      WHEN path LIKE 'search-quality-guidelines%' THEN 'PDF Guidelines'
      ELSE 'Other Docs'
    END AS source,
    COUNT(*) AS chunk_count
  FROM repo_docs_embeddings
  GROUP BY source
  ORDER BY source;
"
```

You should see:
- `PDF Guidelines`: ~100-500 chunks (from the PDF)
- `Other Docs`: ~2000+ chunks (from your existing docs)

The evaluator will now **only use** the PDF Guidelines chunks because of the `pathLike` filter.

---

## Troubleshooting

### Problem: Conversion script fails

**Solution**: Install poppler:
```bash
# macOS
brew install poppler

# Ubuntu
apt-get update && apt-get install -y poppler-utils
```

### Problem: Markdown file is empty or malformed

**Solution**: 
1. Try a different PDF-to-markdown tool (online converters, Adobe Acrobat export, etc.)
2. Manually review and fix the markdown structure
3. Ensure headings use `#`, `##`, `###` format

### Problem: Embedding finds 0 chunks

**Solution**:
1. Verify the markdown file exists: `ls -lh docs/search-quality-guidelines/searchqualityevaluatorguidelines.md`
2. Check file permissions: `chmod 644 docs/search-quality-guidelines/searchqualityevaluatorguidelines.md`
3. Re-run embedding: `node dist/scripts/vector/embed_docs.js --rootDir=../docs/search-quality-guidelines`

### Problem: Evaluator still returns internal doc sections

**Solution**:
1. Verify code was rebuilt: `ls -l backend/dist/lib/qualityEvaluator.js` (check modification time)
2. Verify server was restarted: Check process start time
3. Check env var: `echo $GUIDELINES_PATH_LIKE` (should be empty or match your path pattern)
4. Verify path filter in code: `grep -n "pathLike" backend/dist/lib/qualityEvaluator.js`

### Problem: Server won't start after restart

**Solution**:
1. Check logs: Look at the terminal output when running `npm start`
2. Verify dependencies: `cd backend && npm install`
3. Check port conflict: `lsof -i :3001` (kill any process using port 3001)

---

## Success Criteria

✅ **You're done when:**
1. Markdown file exists at `docs/search-quality-guidelines/searchqualityevaluatorguidelines.md`
2. Chunks are embedded in DB (verify with SQL query in Step 7)
3. Code changes are pushed and deployed
4. Server is running with new code
5. Test responses show `guidelineSections` referencing only PDF guidelines (not internal docs)

---

## Next Steps After Cleanup

Once cleanup is complete, you can:
- Fine-tune chunk sizes if needed
- Add more specific dimension queries
- Build a UI to visualize scores
- Collect evaluation data for future fine-tuning

