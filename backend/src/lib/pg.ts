import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = process.env.PGVECTOR_URL;
    if (!connectionString) {
      throw new Error('Missing PGVECTOR_URL env');
    }
    pool = new Pool({
      connectionString,
      max: parseInt(process.env.PG_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}


