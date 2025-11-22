# Repo Docs Embeddings (RAG over documentation)

This backend supports question answering over the Liftoff documentation using pgvector and OpenAI embeddings.

## 1. One-time setup

Run the pgvector setup script to ensure the `repo_docs_embeddings` table exists:

```bash
cd backend
node dist/scripts/vector/setup_docs_pgvector.js
```

> In dev, if you are using `ts-node` directly, adapt the command accordingly.

## 2. Embed documentation

Use the `embed_docs` script to recursively scan a docs root directory, chunk markdown files, and upsert embeddings:

```bash
cd backend
node dist/scripts/vector/embed_docs.js --rootDir=../docs
```

You can point `--rootDir` at any folder that contains `.md`, `.mdx`, or `.txt` files:

- `../docs` (top-level repo docs)
- `../backend/docs` (if present)
- any other internal knowledge folders

The embed script:

- Walks the directory tree (skipping `node_modules`, `.git`, `.next`).
- Splits each markdown file into section-aware chunks (~1200 characters).
- Computes a SHA-256 `content_hash` for each chunk.
- Uses OpenAI embeddings (`text-embedding-3-small` by default) to embed only **new or changed** chunks.
- Upserts rows into `repo_docs_embeddings` keyed by `content_hash`.

This provides an efficient, incremental refresh: unchanged chunks are skipped, and modified content is re-embedded.

## 3. Refresh cadence (keeping docs up-to-date)

You can run the embed job on a schedule (e.g., cron on the Hetzner backend box) or from CI:

```bash
# Example: refresh every 15 minutes via cron
*/15 * * * * cd /path/to/liftoff/backend && \
  OPENAI_API_KEY=... \
  node dist/scripts/vector/embed_docs.js --rootDir=../docs >> logs/embed_docs.log 2>&1
```

Recommended patterns:

- **Dev/manual**: run `embed_docs` after making substantial documentation edits.
- **Staging/prod**: run on a timer or from CI after merges to `main`.

Because we key by `content_hash`, rerunning the job frequently is cheap—only changed chunks are re-embedded.

## 4. Docs QA API

The Express backend exposes a RAG endpoint:

- `POST /api/docs/qa`

Request:

```json
{
  "query": "How does Hetzner deployment work?"
}
```

Response:

```json
{
  "answer": "High-level answer synthesized from docs...",
  "sources": [
    {
      "path": "docs/infra/hetzner-deploy.md",
      "sectionTitle": "Deployment flow",
      "updatedAt": "2025-10-21T12:34:56Z",
      "contentHash": "..."
    }
  ]
}
```

Under the hood:

1. The query is embedded with OpenAI embeddings.
2. pgvector is used to fetch the most similar chunks from `repo_docs_embeddings`.
3. The selected chunks are passed as context into `generateText` (LLM), which produces the final answer.

## 5. C1 Docs Chat UI

The `c1-dashboard` app exposes a C1 page for docs QA:

- Route: `/docs-chat`
- API: `/api/docs-chat`

The `/api/docs-chat` Next route calls `/api/docs/qa`, formats the answer and sources as a C1 `TextContent` component, and streams a single `<content thesys="true">...</content>` block back to the `C1Chat` client.



