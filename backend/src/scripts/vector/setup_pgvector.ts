import { getPgPool } from '../../lib/pg';

async function main() {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    console.log('Ensuring pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    console.log('Creating table s1_embeddings if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS s1_embeddings (
        id BIGSERIAL PRIMARY KEY,
        run_date DATE NOT NULL,
        keyword TEXT NOT NULL,
        keyword_norm TEXT NOT NULL,
        angle TEXT,
        category TEXT,
        searches DOUBLE PRECISION,
        clicks DOUBLE PRECISION,
        revenue DOUBLE PRECISION,
        rpc DOUBLE PRECISION,
        rps DOUBLE PRECISION,
        embedding VECTOR(1536),
        embed_model TEXT NOT NULL,
        embed_version TEXT NOT NULL,
        hash_key TEXT UNIQUE NOT NULL
      )
    `);

    console.log('Creating indexes (if not exists)...');
    // Create a named index for embedding to allow later REINDEX by name
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 's1_embeddings_embedding_idx'
        ) THEN
          EXECUTE 'CREATE INDEX s1_embeddings_embedding_idx ON s1_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS s1_embeddings_angle_idx ON s1_embeddings(angle)');
    await client.query('CREATE INDEX IF NOT EXISTS s1_embeddings_category_idx ON s1_embeddings(category)');
    await client.query('CREATE INDEX IF NOT EXISTS s1_embeddings_run_idx ON s1_embeddings(run_date)');
    await client.query('CREATE INDEX IF NOT EXISTS s1_embeddings_keyword_norm_idx ON s1_embeddings(keyword_norm)');

    console.log('Creating table s1_slug_embeddings if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS s1_slug_embeddings (
        id BIGSERIAL PRIMARY KEY,
        run_date DATE NOT NULL,
        slug TEXT NOT NULL,
        slug_norm TEXT NOT NULL,
        revenue DOUBLE PRECISION,
        clicks DOUBLE PRECISION,
        keyword_count INTEGER,
        embedding VECTOR(1536),
        embed_model TEXT NOT NULL,
        embed_version TEXT NOT NULL,
        hash_key TEXT UNIQUE NOT NULL
      )
    `);

    console.log('Creating indexes for slug embeddings (if not exists)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 's1_slug_embeddings_embedding_idx'
        ) THEN
          EXECUTE 'CREATE INDEX s1_slug_embeddings_embedding_idx ON s1_slug_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)';
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS s1_slug_embeddings_run_idx ON s1_slug_embeddings(run_date)');
    await client.query('CREATE INDEX IF NOT EXISTS s1_slug_embeddings_slug_norm_idx ON s1_slug_embeddings(slug_norm)');

    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('setup_pgvector failed', err);
  process.exitCode = 1;
});


