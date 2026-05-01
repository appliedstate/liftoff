---
id: edge-daily-review
version: 0.1.0
owner: growth-ops
title: Edge — Daily Campaign Review (Reminder + Commands)
---

## Daily reminder (2 minutes)

Every morning:
- run the daily report for the campaign
- record the output (or key numbers) in the campaign note
- take exactly one action: **scale / hold+test / cut**

## Commands (pull stats)

1) Ingest yesterday’s data into the monitoring DB (UTC dates):

```bash
cd backend
npm run monitor:ingest-campaigns -- --date=$(date -u +%F) --mode=remote
npm run monitor:ingest-sessions -- --date=$(date -u +%F)
```

2) Print the Edge daily report (PST date default = yesterday):

```bash
cd backend
npm run edge:campaign-daily -- --campaign-id=sige41p0612
```

If you want a specific PST date:

```bash
cd backend
npm run edge:campaign-daily -- --campaign-id=sige41p0612 --pst-date=2026-01-27
```

## Tunable thresholds (optional)

Set env vars in `backend/.env`:
- `EDGE_MIN_SPEND_USD=50`
- `EDGE_TARGET_ROAS=1.30`
- `EDGE_CUT_ROAS=1.00`
- `EDGE_SCALE_UP_PCT=0.15`

