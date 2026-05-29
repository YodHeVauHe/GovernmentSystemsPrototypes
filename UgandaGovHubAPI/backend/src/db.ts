import { Pool, PoolClient, QueryResultRow } from 'pg';

export type DbClient = {
  query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

export type Db = DbClient & {
  close(): Promise<void>;
  exec(sql: string): Promise<void>;
  transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T>;
};

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Configure a Postgres connection string before starting GovHub. Vercel Postgres users can also provide POSTGRES_URL.');
  }
  return databaseUrl;
}

export function createDb(): Db {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  return {
    query(sql, params) {
      return pool.query(sql, params as any[]);
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction<T>(callback: (client: DbClient) => Promise<T>) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    close() {
      return pool.end();
    },
  };
}

export async function one<T extends QueryResultRow = any>(db: DbClient, sql: string, params: unknown[] = []) {
  const result = await db.query<T>(sql, params);
  return result.rows[0];
}

export async function many<T extends QueryResultRow = any>(db: DbClient, sql: string, params: unknown[] = []) {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

export async function run(db: DbClient, sql: string, params: unknown[] = []) {
  const result = await db.query(sql, params);
  return { changes: result.rowCount || 0 };
}

export async function exec(db: DbClient, sql: string) {
  await db.query(sql);
}

export async function hasColumn(db: DbClient, tableName: string, columnName: string) {
  const row = await one<{ exists: boolean }>(db, `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
  `, [tableName, columnName]);
  return Boolean(row?.exists);
}

export async function tableExists(db: DbClient, tableName: string) {
  const row = await one<{ exists: boolean }>(db, `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
  `, [tableName]);
  return Boolean(row?.exists);
}
