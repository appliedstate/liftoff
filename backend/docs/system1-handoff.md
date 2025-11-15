# System1 Clustering – Handoff Summary (V1)

Repo path: `backend`

Primary script: `backend/src/scripts/analyzeSystem1.ts`

Intake CLI (parquet/docs): `backend/src/scripts/s1Intake.ts`

API for querying (dev server): base `http://localhost:3001/api/system1`
- `GET /hooks/top?metric=revenue|searches&limit=10`
- `GET /angle/phrases?angle=Insurance%20Quotes`
- `GET /angle/states?angle=Insurance%20Quotes&minClicks=100`
- `GET /campaign/pack?angle=Insurance%20Quotes&phrases=5&states=5&minClicks=100`

## Current Inputs and How to Run

Source CSV (latest used):
`/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/data/system1/incoming/System Keyword with Slug_2025-10-30-1645 (1) 2.csv`

Run clustering:

```bash
npm --prefix "/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend" run system1:analyze -- \
  --input="/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/data/system1/incoming/System Keyword with Slug_2025-10-30-1645 (1) 2.csv"
```

Run intake (normalized parquet + Factory docs):

```bash
npm --prefix "/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend" run s1:intake -- \
  --source "/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/data/system1/incoming/System Keyword with Slug_2025-10-30-1645 (1) 2.csv" \
  --week 2025-45 --export docs --rpc_floor 2.0 --revenue_floor 1000 \
  --data_root "/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/data" \
  --reports_root "/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/reports"
```

## Outputs (example: today’s run 2025-11-05)

Summary files:
- `backend/runs/system1/2025-11-05/slug_keyword_cluster_summary.csv`
- `backend/runs/system1/2025-11-05/slug_keyword_cluster_members.csv`
- `backend/runs/system1/2025-11-05/content_slug_ranked.csv`

Per-cluster keyword rankings:
- `backend/runs/system1/2025-11-05/clusters/{cluster-id}_top_keywords_by_revenue.csv`
- `backend/runs/system1/2025-11-05/clusters/{cluster-id}_top_keywords_by_rpc.csv` (min_clicks=5)
- `backend/runs/system1/2025-11-05/clusters/{cluster-id}_top_keywords_by_rps.csv` (RPS often sparse)

## Current Clustering Logic (V1)

- Connectivity: slugs connect if they share ≥3 keywords that have a defined angle (excluding “Other”).
- Taxonomy: Finance/Commerce (Loans, Insurance Quotes, Bank Bonuses, FSA/HSA); Health Trials/Telehealth (Clinical Trials, ADHD/Online Rx); Dental (Implants, Dentures, Orthodontics, Whitening); Weight Loss/Body Contour (GLP‑1, Coolsculpt/Body Contour); Medicare Benefits; Entertainment (Casino/Real Money); Health sub-angles (GI/Anorectal, GI/Constipation, GI/IBS, GI/GERD, GI/Diarrhea, Procedure/Colonoscopy, Eye (Cataract, Dry Eye, Glaucoma, Floaters, Pink Eye), Derm (Eczema/Psoriasis/Acne, Rosacea, Hyperpigmentation, Hair Loss), MSK (Back/Sciatica, Knee/Arthritis, Hip, Neuropathy, Foot), Urology (Prostate/BPH, Overactive Bladder), Gyn (Menopause/HRT, Estradiol), Respiratory (COPD/Asthma, Sinusitis/Rhinitis), Endocrine (Hypothyroid, Prediabetes), Neuro (Dyslexia, Migraine, Vertigo, Tinnitus), Sleep Apnea).
- Cluster naming: keyword with highest slug coverage; among keywords within 5% of max coverage, choose the one with highest revenue.
- Displayed top_keywords per cluster (in summary): coverage ≥2 and ≥10% of cluster slugs, within majority angle.
- RPC lists: global min_clicks ≥5 (RPC aggregated per cluster).
- RPS: often empty (no per-keyword-per-slug searches available from source).

## Current Status / Metrics (2025-11-05)

- Total clusters: 1,500
- “Other” clusters (label_angle == Other): 1,220
- Labeled revenue coverage (non-Other only): $3,599.86 of $533,214.54 (≈0.68%)
- RPC rows generated (cluster RPC files, min_clicks=5): 165,397

### Why coverage is low

Many high-revenue clusters still fall under “Other” because sub-angles/regex don’t catch them yet. We exclude “Other” from connectivity, which prevents irrelevant bridges but reduces coverage until taxonomy expands.

## Immediate Next Steps (revenue-first)

Expand taxonomy for top “Other” clusters by revenue:
- GI: IBS/GERD brands (omeprazole, famotidine), colonoscopy prep SKUs
- Derm: branded lines (retinol, tretinoin, niacinamide, hyaluronic acid), hair-loss terms
- Eye: OTC brands for pink eye/dry eye, cataract context
- MSK: knee/arthritis brands, neuropathy terms
- Urology/Gyn: prostate/OAB/menopause phrasing
- Respiratory: sinusitis/rhinitis decongestant terms

Optionally relax Health edges: require ≥2 shared angle-matched keywords (for accuracy) or keep ≥3 as-is and focus on taxonomy expansion.

## QA/Review Shortcuts

Top “Other” clusters by revenue:

```bash
awk -F, 'NR>1 && $3=="Other"{print $0}' \
"/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/runs/system1/2025-11-05/slug_keyword_cluster_summary.csv" \
| sort -t, -k7,7gr | head -30
```

Inspect a cluster’s members:

```bash
grep '^conditions/hemorrhoids/how-long-do-hemorrhoids-last,' \
"/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/runs/system1/2025-11-05/slug_keyword_cluster_members.csv" | head -20
```

Per-cluster keyword rankings (open folder):

```bash
open "/Users/ericroach/Desktop/Desktop - Eric’s MacBook Air/Liftoff/backend/runs/system1/2025-11-05/clusters"
```

## Handoff Checklist

- Confirm latest source CSV path; run `system1:analyze`.
- Expand taxonomy in `analyzeSystem1.ts` (edit `canon_angles` CASE).
- Keep “Other” excluded from connectivity and focus on mapping “Other” phrases.
- After each taxonomy pass:
  - Re-run clustering
  - Report total clusters, Other clusters, and labeled revenue coverage (%)
  - Share top 10 clusters by RPC with sample keywords/slugs for sanity




