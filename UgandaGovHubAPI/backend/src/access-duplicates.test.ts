import assert from 'assert/strict';
import type { DbClient } from './db';
import { findBlockingAccessRequest } from './access-control';

type AccessRequestRow = {
  id: string;
  api_id: string;
  consumer_mda_id?: string | null;
  consumer_user_id?: string | null;
  status: string;
  api_key_status?: string | null;
};

function createAccessRequestDb(rows: AccessRequestRow[]): DbClient {
  return {
    async query(sql, params = []) {
      const [apiId, consumerId] = params;
      const identityField = sql.includes('consumer_mda_id = $2') ? 'consumer_mda_id' : 'consumer_user_id';
      const matches = rows.filter(row =>
        row.api_id === apiId &&
        row[identityField] === consumerId &&
        (
          row.status === 'PENDING' ||
          (row.status === 'APPROVED' && !['REVOKED', 'DELETED'].includes(row.api_key_status || 'ACTIVE'))
        )
      );

      return { rows: matches as any[], rowCount: matches.length };
    },
  };
}

async function main() {
  const pendingMdaRequest = await findBlockingAccessRequest(createAccessRequestDb([
    { id: 'req-pending', api_id: 'api-nira-01', consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', status: 'PENDING' },
  ]), {
    apiId: 'api-nira-01',
    consumerMdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    consumerUserId: 'usr-dev',
  });
  assert.equal(pendingMdaRequest?.id, 'req-pending');

  const activeUserRequest = await findBlockingAccessRequest(createAccessRequestDb([
    { id: 'req-active', api_id: 'api-nira-01', consumer_user_id: 'usr-public', status: 'APPROVED', api_key_status: null },
  ]), {
    apiId: 'api-nira-01',
    consumerUserId: 'usr-public',
  });
  assert.equal(activeUserRequest?.id, 'req-active');

  const revokedRequest = await findBlockingAccessRequest(createAccessRequestDb([
    { id: 'req-revoked', api_id: 'api-nira-01', consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', status: 'APPROVED', api_key_status: 'REVOKED' },
    { id: 'req-deleted', api_id: 'api-nira-01', consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', status: 'APPROVED', api_key_status: 'DELETED' },
  ]), {
    apiId: 'api-nira-01',
    consumerMdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    consumerUserId: 'usr-dev',
  });
  assert.equal(revokedRequest, undefined);

  console.log('access duplicate lifecycle tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
