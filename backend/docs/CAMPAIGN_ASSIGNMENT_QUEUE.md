# Campaign Assignment Queue

This queue manages "new campaign" intake from the Category Builder CSV, assigns open work to buyers, and tracks launch status over time.

## 1) Ingest the CSV rows

```bash
cd backend
npm run monitor:queue-ingest -- --file="/Users/ericroach/Downloads/Arb - New Category_Creatives Template - Category Builder 2026.csv" --start-row=11 --status="New Campaign"
```

Notes:
- `--start-row=11` starts at spreadsheet row 11.
- `--status="New Campaign"` limits ingestion to new-campaign rows.

## 2) Assign open campaigns to buyers

```bash
cd backend
npm run monitor:queue-assign -- --buyers="Ben,Cook,TJ,Phil"
```

Assignment behavior:
- Only rows with `requested_buyer = Open` and `assignment_state = unassigned` are auto-assigned.
- Uses least-loaded distribution across the buyer list.

Reassignment mode (for changing weekly active roster):

```bash
cd backend
npm run monitor:queue-assign -- --buyers="cook,phil,anastasi" --source-file="/absolute/path/to/template.csv" --mode=reassign-open
```

- `reassign-open` rebalances all non-launched Open rows (both `assigned` and `unassigned`) to the current buyer list.

## 3) Reconcile launched campaigns

```bash
cd backend
npm run monitor:queue-reconcile
```

Reconcile behavior:
- Matches queue rows to `campaign_launches` by `category + assigned_buyer`, with launch date on/after request date.
- Marks matched rows as `launched`.

## 4) Report queue status

```bash
cd backend
npm run monitor:queue-report
```

Optional filters:
- `--source-file="/absolute/path/to/template.csv"`
- `--limit=200`

