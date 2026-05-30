import assert from 'assert/strict';
import { listAuditLogs } from './access-control';
import type { DbClient } from './db';

function createCapturingDb() {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const db: DbClient = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: '0' }] as any[], rowCount: 1 };
      }
      return { rows: [] as any[], rowCount: 0 };
    },
  };
  return { db, calls };
}

async function main() {
  const { db, calls } = createCapturingDb();

  await listAuditLogs(db, { id: 'usr-dev', role: 'developer', mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543' });

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /l\.consumer_user_id = \$1/);
    assert.match(call.sql, /l\.consumer_user_id IS NULL AND l\.mda_id = \$2/);
    assert.match(call.sql, /l\.event_type LIKE 'SANDBOX_CALL%'/);
    assert.deepEqual(call.params?.slice(0, 2), ['usr-dev', 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543']);
  }
}

main()
  .then(() => console.log('access control audit log visibility tests passed'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
