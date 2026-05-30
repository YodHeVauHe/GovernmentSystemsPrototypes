import assert from 'assert/strict';
import type { Db } from './db';
import { listAuditLogs } from './access-control';

function createAuditLogDb() {
  const dataQueryParams: unknown[][] = [];

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql.includes('SELECT COUNT(*) as count')) {
        return result([{ count: '0' }]);
      }
      if (normalizedSql.includes('ORDER BY l.created_at DESC LIMIT')) {
        dataQueryParams.push(params);
        return result([]);
      }
      throw new Error(`Unexpected SQL: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return { db, dataQueryParams };
}

async function main() {
  const adminDb = createAuditLogDb();
  await listAuditLogs(adminDb.db, { id: 'usr-admin', role: 'admin', mda_id: 'mda-admin' }, Number.NaN, Number.NaN);
  assert.deepEqual(adminDb.dataQueryParams[0], [100, 0]);

  const developerDb = createAuditLogDb();
  await listAuditLogs(developerDb.db, { id: 'usr-dev', role: 'developer', mda_id: null }, Number.POSITIVE_INFINITY, -50);
  assert.deepEqual(developerDb.dataQueryParams[0], ['usr-dev', 100, 0]);
}

main().then(() => {
  console.log('access-control pagination tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
