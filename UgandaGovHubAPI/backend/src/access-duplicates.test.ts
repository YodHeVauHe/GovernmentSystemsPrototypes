import assert from 'assert/strict';
import type { DbClient } from './db';
import { findBlockingAccessRequest } from './access-control';

type AccessRequestRow = {
  id: string;
  api_id: string;
  consumer_mda_id?: string | null;
  consumer_user_id?: string | null;
  status: string;
  api_key_hash?: string | null;
  api_key_status?: string | null;
  api_key_expires_at?: string | null;
  api_key_revoked_at?: string | null;
};

function isUsableApprovedAccess(row: AccessRequestRow, now: string) {
  if (row.status !== 'APPROVED') return false;
  if (!row.api_key_hash) return false;
  if ((row.api_key_status || 'ACTIVE') !== 'ACTIVE') return false;
  if (row.api_key_revoked_at) return false;
  return !row.api_key_expires_at || row.api_key_expires_at > now;
}

function createAccessRequestDb(rows: AccessRequestRow[]): DbClient {
  return {
    async query(sql, params = []) {
      const [apiId, consumerId, nowParam] = params;
      const now = typeof nowParam === 'string' ? nowParam : new Date().toISOString();
      const identityField = sql.includes('consumer_mda_id = $2') ? 'consumer_mda_id' : 'consumer_user_id';
      const matches = rows.filter(row =>
        row.api_id === apiId &&
        row[identityField] === consumerId &&
        (
          row.status === 'PENDING' ||
          isUsableApprovedAccess(row, now)
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
    { id: 'req-active', api_id: 'api-nira-01', consumer_user_id: 'usr-public', status: 'APPROVED', api_key_hash: 'hash-active', api_key_status: null },
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

  const inactiveApprovedRequest = await findBlockingAccessRequest(createAccessRequestDb([
    {
      id: 'req-expired',
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      status: 'APPROVED',
      api_key_hash: 'hash-expired',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2020-01-01T00:00:00.000Z',
    },
    {
      id: 'req-revoked-at',
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      status: 'APPROVED',
      api_key_hash: 'hash-revoked-at',
      api_key_status: 'ACTIVE',
      api_key_revoked_at: '2026-05-22T10:00:00.000Z',
    },
    {
      id: 'req-no-key',
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
    },
  ]), {
    apiId: 'api-nira-01',
    consumerMdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    consumerUserId: 'usr-dev',
  });
  assert.equal(inactiveApprovedRequest, undefined);

  let capturedSql = '';
  let capturedParams: unknown[] = [];
  await findBlockingAccessRequest({
    async query(sql, params = []) {
      capturedSql = sql;
      capturedParams = params;
      return { rows: [], rowCount: 0 };
    },
  }, {
    apiId: 'api-nira-01',
    consumerMdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  });
  assert.match(capturedSql, /api_key_hash IS NOT NULL/);
  assert.match(capturedSql, /COALESCE\(api_key_status,\s*'ACTIVE'\)\s*=\s*'ACTIVE'/);
  assert.match(capturedSql, /api_key_revoked_at IS NULL/);
  assert.match(capturedSql, /\(api_key_expires_at IS NULL OR api_key_expires_at > \$3\)/);
  assert.equal(capturedParams.length, 3);
  assert.equal(Number.isNaN(Date.parse(String(capturedParams[2]))), false);

  console.log('access duplicate lifecycle tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
