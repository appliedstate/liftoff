2025-11-22 11:18:44 PST Starting investigation on automated campaign/session index pipeline requirements.
2025-11-22 11:19:41 PST Reviewed backend routes; /api/strategist/query identified as the best source for a living campaign/media-source index since it returns day/reconciled snapshots with owner, lane, source, and campaign/adset metadata across Taboola/Outbrain/NewsBreak/MediaGo/Meta.
2025-11-22 11:24:42 PST Beginning implementation of automated campaign index ingestion pipeline (strategist query ingestion + session attribution + cron scaffolding).
2025-11-22 11:29:18 PST Added monitoring DuckDB helper, strategist snapshot reader, ingestion scripts (`monitor:ingest-campaigns`, `monitor:ingest-sessions`), package scripts, and documentation for cron deployment.
2025-11-22 11:37:31 PST Extended ingestion scripts with remote Strategist API mode via IX ID auth client; updated docs to cover env vars/flags for remote cron usage.
2025-11-22 12:58:03 PST Reworked monitoring pipeline to bypass Strategist proxy: added Strategis API client, rewrote campaign ingestion to join six Strategis datasets (FB reports/campaigns/adsets, S1 daily/RPC, pixel, Strategis metrics), switched session ingester to Strategis hourly-v3 feed, and refreshed docs/env guidance accordingly.

