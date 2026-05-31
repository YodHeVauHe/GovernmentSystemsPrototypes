import assert from 'assert';
import type { QueryResultRow } from 'pg';
import { listVisibleDocsApis } from './docs-access';
import type { DbClient } from './db';

type QueryCall = {
  sql: string;
  params?: unknown[];
};

function createDocsAccessDb() {
  const calls: QueryCall[] = [];
  const db: DbClient = {
    async query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
      calls.push({ sql, params });
      if (/FROM apis/i.test(sql)) {
        return {
          rows: [
            {
              id: 'api-public',
              name: 'Public API',
              owning_mda_id: 'mda-public',
              docs_visibility: 'public',
              security_classification: 'public',
              effective_visibility: 'public',
            },
            {
              id: 'api-authenticated',
              name: 'Authenticated API',
              owning_mda_id: 'mda-auth',
              docs_visibility: 'authenticated',
              security_classification: 'internal',
              effective_visibility: 'authenticated',
            },
            {
              id: 'api-restricted',
              name: 'Restricted API',
              owning_mda_id: 'mda-owner',
              docs_visibility: 'restricted',
              security_classification: 'restricted',
              effective_visibility: 'restricted',
            },
          ] as unknown as T[],
          rowCount: 3,
        };
      }
      if (/FROM access_requests/i.test(sql)) {
        return { rows: [{ id: 'req-approved' }] as unknown as T[], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL in docs access security test: ${sql.replace(/\s+/g, ' ').trim()}`);
    },
  };

  return { db, calls };
}

async function runDocsAccessSecurityTests() {
  const { db, calls } = createDocsAccessDb();
  const docs = await (listVisibleDocsApis as any)(
    db,
    { id: 'usr-developer', status: 'APPROVED', role: 'developer', mda_id: 'mda-consumer' },
    1000000,
    -5,
  );

  assert.deepEqual(
    docs.map((api: any) => api.id),
    ['api-public', 'api-authenticated', 'api-restricted'],
    'Developer docs listing must preserve public, authenticated, and approved restricted docs visibility.',
  );

  const catalogQuery = calls.find(call => /FROM apis/i.test(call.sql));
  assert.ok(catalogQuery, 'Expected docs/catalog API list query to run.');
  assert.match(
    catalogQuery!.sql,
    /\bLIMIT\b.+\bOFFSET\b/i,
    'Docs/catalog listing must use bounded LIMIT/OFFSET pagination.',
  );
  assert.deepEqual(
    catalogQuery!.params?.slice(-2),
    [100, 0],
    'Docs/catalog listing must cap oversized limits and normalize negative offsets.',
  );

  const accessLookups = calls.slice(1).filter(call => /FROM access_requests/i.test(call.sql));
  assert.equal(
    accessLookups.length,
    0,
    'Developer docs/catalog listing must not perform per-API access request lookups.',
  );
}

void runDocsAccessSecurityTests().catch(error => {
  console.error(error);
  process.exit(1);
});
