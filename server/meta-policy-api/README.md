# Meta Policy API

Standalone server-hosted Meta policy service for `api.str4t3g1s.com`.

Routes:

- `GET /api/health`
- `GET /api/meta-policy/policy-corpus-status`
- `POST /api/meta-policy/boundary-judge`
- `POST /api/meta-policy/official-policy-support`
- `POST /api/meta-policy/policy-ask`
- `POST /api/meta-policy/run`

Protected routes require:

```http
Authorization: Bearer <PARTNER_API_KEY>
```

Environment:

- `PORT`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_WRITER_MODEL`
- `PARTNER_API_KEY`

Policy corpus maintenance:

- `npm run policy:refresh`

That command:

1. refreshes official-source snapshots into `data/meta_policy_snapshots/`
2. rebuilds `data/meta_policy_runtime_chunks.json` from raw snapshot excerpts plus curated seed chunks

Grounding model:

- `raw_snapshot_excerpt`: direct excerpt from a captured official page snapshot
- `curated_summary`: curated official-policy summary retained as fallback/supporting context

The API now returns official policy support separately from:

- historical reject support
- inferred combo-risk logic

Copywriter concept input:

- `POST /api/meta-policy/run` and `POST /api/meta-policy/rewrite` accept optional:
  - `copywriterConceptNotes`: string or array of raw concept notes
  - `copywriterConceptIdeas`: alias for the same input

Those notes are distilled at runtime into structured copy concepts, merged with the base concept library in `data/meta_copywriter_concepts.json`, and then passed into the writer stage. The response includes the merged `copywriterConcepts` block so downstream systems can inspect what the writer actually used.
