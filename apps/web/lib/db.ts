import { Pool, QueryResultRow } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

type GlobalWithPg = typeof globalThis & {
  pgPool?: Pool;
};

const globalForPg = globalThis as GlobalWithPg;

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: databaseUrl
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

export async function query<T extends QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}
