import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { one, run, type Db, type DbClient } from './db';

export type PreparedTestDb = Db & {
  prepare(sql: string): {
    get<T extends QueryResultRow = any>(...params: unknown[]): Promise<T | undefined>;
    all<T extends QueryResultRow = any>(...params: unknown[]): Promise<T[]>;
    run(...params: unknown[]): Promise<{ changes: number }>;
  };
};

function readBackendEnvValue(key: string) {
  const envFiles = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../.env.example'),
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    const lines = readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match?.[1] === key) {
        return match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return undefined;
}

function ensurePostgresEnv() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
    process.env.DATABASE_URL = readBackendEnvValue('DATABASE_URL');
  }
  if (!process.env.DATABASE_SSL) {
    process.env.DATABASE_SSL = readBackendEnvValue('DATABASE_SSL') || 'false';
  }
}

function requireDatabaseUrl() {
  ensurePostgresEnv();
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Postgres-backed tests.');
  }
  return databaseUrl;
}

function toPostgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeTestSql(sql: string) {
  return sql
    .replace(/\bINSERT OR IGNORE\b/gi, 'INSERT')
    .replace(/\bBOOLEAN DEFAULT 0\b/gi, 'BOOLEAN DEFAULT FALSE')
    .replace(/\bBOOLEAN DEFAULT 1\b/gi, 'BOOLEAN DEFAULT TRUE')
    .replace(/\bis_current\s*=\s*0\b/gi, 'is_current = FALSE')
    .replace(/\bis_current\s*=\s*1\b/gi, 'is_current = TRUE')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');
}

function createClientDb(client: PoolClient): PreparedTestDb {
  let savepointIndex = 0;
  const db = {
    query<T extends QueryResultRow = any>(sql: string, params?: unknown[]) {
      return client.query<T>(normalizeTestSql(sql), params as any[]);
    },
    async exec(sql: string) {
      await client.query(normalizeTestSql(sql));
    },
    prepare(sql: string) {
      const pgSql = normalizeTestSql(toPostgresPlaceholders(sql));
      return {
        get<T extends QueryResultRow = any>(...params: unknown[]) {
          return one<T>(db, pgSql, params);
        },
        async all<T extends QueryResultRow = any>(...params: unknown[]) {
          const result = await client.query<T>(pgSql, params as any[]);
          return result.rows;
        },
        run(...params: unknown[]) {
          return run(db, pgSql, params);
        },
      };
    },
    async transaction<T>(callback: (client: DbClient) => Promise<T>) {
      savepointIndex += 1;
      const savepoint = `postgres_test_${savepointIndex}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      try {
        const result = await callback(db);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        throw error;
      }
    },
    async close() {
      // The owning test harness releases the underlying client and pool.
    },
  };

  return db;
}

export async function openPostgresTestDb() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  await client.query('BEGIN');
  return {
    db: createClientDb(client),
    async close() {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
      await pool.end();
    },
  };
}

export async function withPostgresTestDb<T>(callback: (db: PreparedTestDb) => Promise<T>) {
  const { db, close } = await openPostgresTestDb();
  try {
    return await callback(db);
  } finally {
    await close();
  }
}
