# Facebook Ad Rejections Analysis

This workspace is for classifying Facebook ad rejections by business manager, ad account, policy issue, and workflow stage.

## Where to add screenshots

Drag and drop all rejection screenshots into:

`docs/analysis/facebook-ad-rejections/incoming-screenshots/`

## Working files

- `working/rejection-classification-table.csv` - row-level log (ad ID, timestamp, rejection reason, policy mapping)
- `working/reason-counts-summary.csv` - aggregated counts by repeated reason and account/stage
- `working/facebook-policy-reference.csv` - normalized reason-to-policy lookup
- `working/root-cause-analysis-template.md` - RCA template with policy mapping and corrective actions

## Suggested process

1. Add screenshots to `incoming-screenshots/`.
2. Log one row per rejection event in `working/rejection-classification-table.csv` (required: `ad_id`, `rejection_timestamp_utc`, `facebook_reason_raw`).
3. Normalize each reason into `reason_code_normalized` and `reason_family` using `working/facebook-policy-reference.csv`.
4. Build counts in `working/reason-counts-summary.csv` (focus on repeated reasons).
5. Complete `working/root-cause-analysis-template.md` for the top repeated reasons.
