import assert from 'assert/strict';
import { buildAccessRequestList } from './access-control';
import type { DbClient } from './db';

function createAccessListDb(rows: any[]) {
  let observedSql = '';
  let observedParams: unknown[] | undefined;

  const db: DbClient = {
    async query(sql, params) {
      observedSql = sql;
      observedParams = params;
      return { rows, rowCount: rows.length };
    },
  };

  return {
    db,
    observedSql: () => observedSql,
    observedParams: () => observedParams,
  };
}

async function main() {
  const developer = {
    id: 'usr-requester',
    role: 'developer' as const,
    mda_id: 'mda-moh',
  };

  const fake = createAccessListDb([
    {
      id: 'req-owned-by-user',
      consumer_mda_id: 'mda-moh',
      consumer_user_id: 'usr-requester',
      api_key_preview: 'ghk_own...user',
      api_key_pending_reveal: true,
    },
    {
      id: 'req-legacy-mda',
      consumer_mda_id: 'mda-moh',
      consumer_user_id: null,
      api_key_preview: 'ghk_legacy...mda',
      api_key_pending_reveal: true,
    },
    {
      id: 'req-owned-by-peer',
      consumer_mda_id: 'mda-moh',
      consumer_user_id: 'usr-peer',
      api_key_preview: 'ghk_peer...leak',
      api_key_pending_reveal: true,
    },
  ]);

  const requests = await buildAccessRequestList(fake.db, developer) as any[];
  const ownRequest = requests.find(request => request.id === 'req-owned-by-user');
  const legacyMdaRequest = requests.find(request => request.id === 'req-legacy-mda');
  const peerRequest = requests.find(request => request.id === 'req-owned-by-peer');

  assert.match(fake.observedSql(), /WHERE r\.consumer_mda_id = \$1/);
  assert.deepEqual(fake.observedParams(), ['mda-moh']);

  assert.equal(ownRequest.api_key_pending_reveal, true);
  assert.equal(ownRequest.api_key_preview, 'ghk_own...user');
  assert.equal(legacyMdaRequest.api_key_pending_reveal, true);
  assert.equal(legacyMdaRequest.api_key_preview, 'ghk_legacy...mda');
  assert.equal(peerRequest.api_key_pending_reveal, false);
  assert.equal(peerRequest.api_key_preview, null);
}

main().then(() => {
  console.log('access list key visibility tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
