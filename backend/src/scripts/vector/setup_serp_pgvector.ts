import { getPgPool } from '../../lib/pg';

async function main() {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    console.log('Ensuring pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    console.log('Creating table serp_keyword_slug_embeddings if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_keyword_slug_embeddings (
        id BIGSERIAL PRIMARY KEY,
        run_date DATE NOT NULL,
        serp_keyword TEXT NOT NULL,
        serp_keyword_norm TEXT NOT NULL,
        region_code TEXT NOT NULL,
        content_slug TEXT NOT NULL,
        content_slug_norm TEXT NOT NULL,
        topic_vertical TEXT,
        topic TEXT,
        most_granular_topic TEXT,
        sellside_searches DOUBLE PRECISION,
        sellside_clicks_network DOUBLE PRECISION,
        est_net_revenue DOUBLE PRECISION,
        rpc DOUBLE PRECISION,
        rps DOUBLE PRECISION,
        embedding_keyword VECTOR(1536),
        embedding_slug VECTOR(1536),
        embed_model TEXT NOT NULL,
        embed_version TEXT NOT NULL,
        hash_key TEXT UNIQUE NOT NULL
      )
    `);

    console.log('Creating indexes (if not exists)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'serp_kse_embedding_keyword_idx'
        ) THEN
          EXECUTE 'CREATE INDEX serp_kse_embedding_keyword_idx ON serp_keyword_slug_embeddings USING ivfflat (embedding_keyword vector_cosine_ops) WITH (lists = 100)';
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'serp_kse_embedding_slug_idx'
        ) THEN
          EXECUTE 'CREATE INDEX serp_kse_embedding_slug_idx ON serp_keyword_slug_embeddings USING ivfflat (embedding_slug vector_cosine_ops) WITH (lists = 50)';
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS serp_kse_run_idx ON serp_keyword_slug_embeddings(run_date)');
    await client.query('CREATE INDEX IF NOT EXISTS serp_kse_region_idx ON serp_keyword_slug_embeddings(region_code)');
    await client.query('CREATE INDEX IF NOT EXISTS serp_kse_kw_norm_idx ON serp_keyword_slug_embeddings(serp_keyword_norm)');
    await client.query('CREATE INDEX IF NOT EXISTS serp_kse_slug_norm_idx ON serp_keyword_slug_embeddings(content_slug_norm)');

    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('setup_serp_pgvector failed', err);
  process.exit(1);
});


