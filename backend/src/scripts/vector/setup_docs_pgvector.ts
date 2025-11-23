import { getPgPool } from '../../lib/pg';

async function main() {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    console.log('Ensuring pgvector extension for docs embeddings...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    console.log('Creating table repo_docs_embeddings if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS repo_docs_embeddings (
        id BIGSERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        section_title TEXT,
        content TEXT NOT NULL,
        content_hash TEXT UNIQUE NOT NULL,
        embedding VECTOR(1536) NOT NULL,
        embed_model TEXT NOT NULL,
        embed_version TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log('Creating indexes for repo_docs_embeddings (if not exists)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'repo_docs_embeddings_embedding_idx'
        ) THEN
          EXECUTE 'CREATE INDEX repo_docs_embeddings_embedding_idx ON repo_docs_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
        END IF;
      END $$;
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS repo_docs_embeddings_path_idx ON repo_docs_embeddings(path)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS repo_docs_embeddings_updated_at_idx ON repo_docs_embeddings(updated_at)'
    );

    console.log('repo_docs_embeddings setup complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('setup_docs_pgvector failed', err);
  process.exit(1);
});





