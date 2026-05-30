import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { accessRouter } from './routes/access';
import { authRouter } from './routes/auth';
import { computeApiKeyHash, ensureAdminSchema } from './admin';
import { ensureAuthSchema, hashPassword } from './auth';
import type { DbClient } from './db';
import { openPostgresTestDb } from './postgres-test-db';

type QueryInterceptor = (sql: string, params?: unknown[]) => Promise<void> | void;

async function startApp() {
  const { db, close } = await openPostgresTestDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mdas (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS apis (id TEXT PRIMARY KEY, name TEXT NOT NULL, owning_mda_id TEXT NOT NULL);
  `);
  await db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING')
    .run('mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3', 'Ministry of ICT and National Guidance', 'MoICT');
  await db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING')
    .run('mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'Ministry of Health', 'MoH');
  await db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING')
    .run('api-nira-01', 'NIRA Identity', 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3');
  await ensureAuthSchema(db);
  await ensureAdminSchema(db);
  await db.prepare(`
    INSERT INTO users (
      id, full_name, email, password_hash, account_type, requested_role,
      requested_mda_id, requested_organization, requested_purpose, status, role, mda_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr-admin-access-routes',
    'Access Admin',
    'access.admin@example.go.ug',
    hashPassword('AdminPass123!'),
    'government_employee',
    'admin',
    'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
    'Ministry of ICT and National Guidance',
    'Test access key lifecycle',
    'APPROVED',
    'admin',
    'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3'
  );
  await db.prepare(`
    INSERT INTO users (
      id, full_name, email, password_hash, account_type, requested_role,
      requested_mda_id, requested_organization, requested_purpose, status, role, mda_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr-public-access-routes',
    'Public Access Developer',
    'access.public@example.com',
    hashPassword('PublicPass123!'),
    'public_developer',
    'developer',
    null,
    'Independent Civic Developer',
    'Test public access request audit ownership',
    'APPROVED',
    'developer',
    null
  );

  let accessQueryInterceptor: QueryInterceptor | undefined;
  const accessDb: DbClient = {
    async query(sql, params) {
      if (accessQueryInterceptor) {
        await accessQueryInterceptor(sql, params);
      }
      return db.query(sql, params);
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter(db));
  app.use('/api/access', accessRouter(accessDb));

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    db,
    closeDb: close,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    setAccessQueryInterceptor(interceptor?: QueryInterceptor) {
      accessQueryInterceptor = interceptor;
    },
  };
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function sessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  assert(setCookie);
  return setCookie.split(';')[0];
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function main() {
  const { db, closeDb, server, baseUrl, setAccessQueryInterceptor } = await startApp();

  try {
    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'access.admin@example.go.ug', password: 'AdminPass123!' }),
    });
    assert.equal(login.response.status, 200);
    const adminCookie = sessionCookie(login.response);

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status,
        api_key_hash, api_key_preview, api_key_status, api_key_expires_at, api_key_revoked_at
      ) VALUES (?, ?, 'mda', ?, ?, 'APPROVED', ?, ?, 'REVOKED', ?, ?)
    `).run(
      'req-revoked-key',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Revoked key lifecycle regression',
      computeApiKeyHash('ghk_revoked_secret'),
      'ghk_revo...',
      '2026-06-22T10:00:00.000Z',
      '2026-05-22T10:00:00.000Z'
    );

    const expiryUpdate = await request(baseUrl, '/api/access/req-revoked-key/key-expiry', {
      method: 'PATCH',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ api_key_expires_at: '2026-07-22T10:00:00.000Z' }),
    });
    assert.equal(expiryUpdate.response.status, 409);
    assert.equal(expiryUpdate.body.code, 'API_KEY_NOT_ACTIVE');

    await db.prepare(`
      UPDATE access_requests
      SET api_key_status = 'ACTIVE'
      WHERE id = ?
    `).run('req-revoked-key');

    const matrix = await request(baseUrl, '/api/access/matrix', {
      headers: { cookie: adminCookie },
    });
    assert.equal(matrix.response.status, 200);
    assert.equal(matrix.body.some((entry: any) => entry.api_id === 'api-nira-01'), false);

    const missingAdminConsumerMda = await request(baseUrl, '/api/access', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        api_id: 'api-nira-01',
        purpose: 'Missing admin consumer MDA regression',
      }),
    });
    assert.equal(missingAdminConsumerMda.response.status, 400);
    assert.equal(missingAdminConsumerMda.body.code, 'MDA_REQUIRED');

    const invalidAdminConsumerMda = await request(baseUrl, '/api/access', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        api_id: 'api-nira-01',
        consumer_mda_id: 'mda-does-not-exist',
        purpose: 'Invalid admin consumer MDA regression',
      }),
    });
    assert.equal(invalidAdminConsumerMda.response.status, 400);
    assert.equal(invalidAdminConsumerMda.body.code, 'MDA_NOT_FOUND');

    const invalidMdaRequestCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM access_requests
      WHERE consumer_mda_id = ?
    `).get<any>('mda-does-not-exist');
    assert.equal(Number(invalidMdaRequestCount.count), 0);

    const invalidMdaAuditCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE mda_id = ?
    `).get<any>('mda-does-not-exist');
    assert.equal(Number(invalidMdaAuditCount.count), 0);

    await db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING')
      .run('mda-temp-access-race', 'Temporary Access Race MDA', 'TEMP');

    let simulatedConcurrentMdaDeletion = false;
    setAccessQueryInterceptor(async (sql, params) => {
      const isAccessRequestInsert = /\bINSERT\s+INTO\s+access_requests\b/i.test(sql);
      if (simulatedConcurrentMdaDeletion || !isAccessRequestInsert || !params?.includes('mda-temp-access-race')) return;

      simulatedConcurrentMdaDeletion = true;
      await db.prepare('DELETE FROM mdas WHERE id = ?').run('mda-temp-access-race');
    });

    const deletedMdaAccessRequest = await request(baseUrl, '/api/access', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        api_id: 'api-nira-01',
        consumer_mda_id: 'mda-temp-access-race',
        purpose: 'Concurrent MDA deletion regression',
      }),
    });
    setAccessQueryInterceptor(undefined);

    assert.equal(deletedMdaAccessRequest.response.status, 400);
    assert.equal(deletedMdaAccessRequest.body.code, 'MDA_NOT_FOUND');
    assert.equal(simulatedConcurrentMdaDeletion, true);

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status
      ) VALUES (?, ?, 'mda', ?, ?, 'PENDING')
    `).run(
      'req-invalid-approval-expiry',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Invalid approval expiry regression'
    );

    const invalidApprovalExpiry = await request(baseUrl, '/api/access/req-invalid-approval-expiry/approve', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ api_key_expires_at: 'not-a-date' }),
    });
    assert.equal(invalidApprovalExpiry.response.status, 400);
    assert.equal(invalidApprovalExpiry.body.code, 'INVALID_API_KEY_EXPIRY');

    const invalidApprovalExpiryRequest = await db.prepare(`
      SELECT status, api_key_hash
      FROM access_requests
      WHERE id = ?
    `).get<any>('req-invalid-approval-expiry');
    assert.equal(invalidApprovalExpiryRequest.status, 'PENDING');
    assert.equal(invalidApprovalExpiryRequest.api_key_hash, null);

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status,
        api_key_hash, api_key_preview, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'mda', ?, ?, 'APPROVED', ?, ?, 'ACTIVE', ?)
    `).run(
      'req-invalid-update-expiry',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Invalid update expiry regression',
      computeApiKeyHash('ghk_active_before_invalid_update'),
      'ghk_acti...date',
      '2026-08-22T10:00:00.000Z'
    );

    const invalidUpdateExpiry = await request(baseUrl, '/api/access/req-invalid-update-expiry/key-expiry', {
      method: 'PATCH',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ api_key_expires_at: '2020-01-01T00:00:00.000Z' }),
    });
    assert.equal(invalidUpdateExpiry.response.status, 400);
    assert.equal(invalidUpdateExpiry.body.code, 'INVALID_API_KEY_EXPIRY');

    const invalidUpdateExpiryRequest = await db.prepare(`
      SELECT api_key_status, api_key_expires_at
      FROM access_requests
      WHERE id = ?
    `).get<any>('req-invalid-update-expiry');
    assert.equal(invalidUpdateExpiryRequest.api_key_status, 'ACTIVE');
    assert.equal(invalidUpdateExpiryRequest.api_key_expires_at, '2026-08-22T10:00:00.000Z');

    const publicLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'access.public@example.com', password: 'PublicPass123!' }),
    });
    assert.equal(publicLogin.response.status, 200);
    const publicCookie = sessionCookie(publicLogin.response);

    const publicAccessRequest = await request(baseUrl, '/api/access', {
      method: 'POST',
      headers: { cookie: publicCookie },
      body: JSON.stringify({
        api_id: 'api-nira-01',
        purpose: 'Public access audit ownership regression',
      }),
    });
    assert.equal(publicAccessRequest.response.status, 200);

    const publicAuditLog = await db.prepare(`
      SELECT mda_id, consumer_user_id
      FROM audit_logs
      WHERE request_id = ?
        AND event_type = 'ACCESS_REQUESTED'
    `).get<any>(publicAccessRequest.body.id);
    assert.equal(publicAuditLog.mda_id, null);
    assert.equal(publicAuditLog.consumer_user_id, 'usr-public-access-routes');

    const approvePublicRequest = await request(baseUrl, `/api/access/${publicAccessRequest.body.id}/approve`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ api_key_expires_at: '2026-07-22T10:00:00.000Z' }),
    });
    assert.equal(approvePublicRequest.response.status, 200);

    const publicApprovalAuditLogs = await db.prepare(`
      SELECT event_type, mda_id, consumer_user_id
      FROM audit_logs
      WHERE request_id = ?
        AND event_type IN ('ACCESS_APPROVED', 'API_KEY_GENERATED')
      ORDER BY event_type
    `).all<any>(publicAccessRequest.body.id);
    assert.equal(publicApprovalAuditLogs.length, 2);
    for (const auditLog of publicApprovalAuditLogs) {
      assert.equal(auditLog.mda_id, null);
      assert.equal(auditLog.consumer_user_id, 'usr-public-access-routes');
    }

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status
      ) VALUES (?, ?, 'mda', ?, ?, 'PENDING')
    `).run(
      'req-stale-approval-race',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Race regression for stale approval update'
    );

    let simulatedConcurrentApproval = false;
    setAccessQueryInterceptor(async (sql, params) => {
      const isApprovalUpdate = /\bUPDATE\s+access_requests\b[\s\S]*\bSET\s+status\s*=\s*'APPROVED'/i.test(sql);
      if (simulatedConcurrentApproval || !isApprovalUpdate) return;

      simulatedConcurrentApproval = true;
      const requestId = params?.find(param => param === 'req-stale-approval-race');
      assert.equal(requestId, 'req-stale-approval-race');
      await db.prepare(`
        UPDATE access_requests
        SET status = 'APPROVED',
            api_key_hash = ?,
            api_key_preview = ?,
            api_key_status = 'ACTIVE',
            api_key_expires_at = ?,
            api_key_revoked_at = NULL
        WHERE id = ?
      `).run(
        computeApiKeyHash('ghk_concurrent_winner'),
        'ghk_winn...nner',
        '2026-08-22T10:00:00.000Z',
        String(requestId)
      );
    });

    const staleApproval = await request(baseUrl, '/api/access/req-stale-approval-race/approve', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ api_key_expires_at: '2026-09-22T10:00:00.000Z' }),
    });
    setAccessQueryInterceptor(undefined);

    assert.equal(staleApproval.response.status, 409);
    assert.equal(staleApproval.body.code, 'REQUEST_ALREADY_FINALIZED');
    assert.equal(simulatedConcurrentApproval, true);

    const raceWinner = await db.prepare(`
      SELECT api_key_hash, api_key_preview
      FROM access_requests
      WHERE id = ?
    `).get<any>('req-stale-approval-race');
    assert.equal(raceWinner.api_key_hash, computeApiKeyHash('ghk_concurrent_winner'));
    assert.equal(raceWinner.api_key_preview, 'ghk_winn...nner');

    const staleApprovalAuditCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE request_id = ?
        AND event_type IN ('ACCESS_APPROVED', 'API_KEY_GENERATED')
    `).get<any>('req-stale-approval-race');
    assert.equal(Number(staleApprovalAuditCount.count), 0);

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status,
        api_key_hash, api_key_preview, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'mda', ?, ?, 'APPROVED', ?, ?, 'ACTIVE', ?)
    `).run(
      'req-stale-expiry-race',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Race regression for stale expiry update',
      computeApiKeyHash('ghk_active_before_revoke'),
      'ghk_acti...voke',
      '2026-08-22T10:00:00.000Z'
    );

    let simulatedConcurrentRevocation = false;
    setAccessQueryInterceptor(async (sql, params) => {
      const isExpiryUpdate = /\bUPDATE\s+access_requests\b[\s\S]*\bSET\s+api_key_expires_at\b/i.test(sql);
      if (simulatedConcurrentRevocation || !isExpiryUpdate) return;

      simulatedConcurrentRevocation = true;
      const requestId = params?.find(param => param === 'req-stale-expiry-race');
      assert.equal(requestId, 'req-stale-expiry-race');
      await db.prepare(`
        UPDATE access_requests
        SET api_key_status = 'REVOKED',
            api_key_revoked_at = ?
        WHERE id = ?
      `).run('2026-06-22T10:00:00.000Z', String(requestId));
    });

    const staleExpiryUpdate = await request(baseUrl, '/api/access/req-stale-expiry-race/key-expiry', {
      method: 'PATCH',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ api_key_expires_at: '2026-09-22T10:00:00.000Z' }),
    });
    setAccessQueryInterceptor(undefined);

    assert.equal(staleExpiryUpdate.response.status, 409);
    assert.equal(staleExpiryUpdate.body.code, 'API_KEY_NOT_ACTIVE');
    assert.equal(simulatedConcurrentRevocation, true);

    const revokedKey = await db.prepare(`
      SELECT api_key_status, api_key_revoked_at, api_key_expires_at
      FROM access_requests
      WHERE id = ?
    `).get<any>('req-stale-expiry-race');
    assert.equal(revokedKey.api_key_status, 'REVOKED');
    assert.equal(revokedKey.api_key_revoked_at, '2026-06-22T10:00:00.000Z');
    assert.equal(revokedKey.api_key_expires_at, '2026-08-22T10:00:00.000Z');

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status,
        api_key_hash, api_key_preview, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'mda', ?, ?, 'APPROVED', ?, ?, 'ACTIVE', ?)
    `).run(
      'req-stale-revoke-race',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Race regression for stale revoke update',
      computeApiKeyHash('ghk_active_before_delete'),
      'ghk_acti...lete',
      '2026-08-22T10:00:00.000Z'
    );

    let simulatedConcurrentDeleteBeforeRevoke = false;
    setAccessQueryInterceptor(async (sql, params) => {
      const isRevokeUpdate = /\bUPDATE\s+access_requests\b[\s\S]*\bSET\s+api_key_status\s*=\s*'REVOKED'/i.test(sql);
      if (simulatedConcurrentDeleteBeforeRevoke || !isRevokeUpdate) return;

      simulatedConcurrentDeleteBeforeRevoke = true;
      const requestId = params?.find(param => param === 'req-stale-revoke-race');
      assert.equal(requestId, 'req-stale-revoke-race');
      await db.prepare(`
        UPDATE access_requests
        SET api_key = NULL,
            api_key_hash = NULL,
            api_key_status = 'DELETED',
            api_key_revoked_at = ?,
            api_key_expires_at = NULL
        WHERE id = ?
      `).run('2026-06-23T10:00:00.000Z', String(requestId));
    });

    const staleRevoke = await request(baseUrl, '/api/access/req-stale-revoke-race/revoke-key', {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    setAccessQueryInterceptor(undefined);

    assert.equal(staleRevoke.response.status, 409);
    assert.equal(staleRevoke.body.code, 'API_KEY_NOT_ACTIVE');
    assert.equal(simulatedConcurrentDeleteBeforeRevoke, true);

    const deletedBeforeRevoke = await db.prepare(`
      SELECT api_key_hash, api_key_status, api_key_revoked_at, api_key_expires_at
      FROM access_requests
      WHERE id = ?
    `).get<any>('req-stale-revoke-race');
    assert.equal(deletedBeforeRevoke.api_key_hash, null);
    assert.equal(deletedBeforeRevoke.api_key_status, 'DELETED');
    assert.equal(deletedBeforeRevoke.api_key_revoked_at, '2026-06-23T10:00:00.000Z');
    assert.equal(deletedBeforeRevoke.api_key_expires_at, null);

    const staleRevokeAuditCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE request_id = ?
        AND event_type = 'API_KEY_REVOKED'
    `).get<any>('req-stale-revoke-race');
    assert.equal(Number(staleRevokeAuditCount.count), 0);

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, purpose, status,
        api_key_hash, api_key_preview, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'mda', ?, ?, 'APPROVED', ?, ?, 'ACTIVE', ?)
    `).run(
      'req-stale-delete-race',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'api-nira-01',
      'Race regression for stale delete update',
      computeApiKeyHash('ghk_active_before_second_delete'),
      'ghk_acti...lete',
      '2026-08-22T10:00:00.000Z'
    );

    let simulatedConcurrentDeleteBeforeDelete = false;
    setAccessQueryInterceptor(async (sql, params) => {
      const isDeleteUpdate = /\bUPDATE\s+access_requests\b[\s\S]*\bSET\s+api_key\s*=\s*NULL[\s\S]*api_key_status\s*=\s*'DELETED'/i.test(sql);
      if (simulatedConcurrentDeleteBeforeDelete || !isDeleteUpdate) return;

      simulatedConcurrentDeleteBeforeDelete = true;
      const requestId = params?.find(param => param === 'req-stale-delete-race');
      assert.equal(requestId, 'req-stale-delete-race');
      await db.prepare(`
        UPDATE access_requests
        SET api_key = NULL,
            api_key_hash = NULL,
            api_key_status = 'DELETED',
            api_key_revoked_at = ?,
            api_key_expires_at = NULL
        WHERE id = ?
      `).run('2026-06-24T10:00:00.000Z', String(requestId));
    });

    const staleDelete = await request(baseUrl, '/api/access/req-stale-delete-race/key', {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    });
    setAccessQueryInterceptor(undefined);

    assert.equal(staleDelete.response.status, 404);
    assert.equal(simulatedConcurrentDeleteBeforeDelete, true);

    const deletedBeforeDelete = await db.prepare(`
      SELECT api_key_hash, api_key_status, api_key_revoked_at, api_key_expires_at
      FROM access_requests
      WHERE id = ?
    `).get<any>('req-stale-delete-race');
    assert.equal(deletedBeforeDelete.api_key_hash, null);
    assert.equal(deletedBeforeDelete.api_key_status, 'DELETED');
    assert.equal(deletedBeforeDelete.api_key_revoked_at, '2026-06-24T10:00:00.000Z');
    assert.equal(deletedBeforeDelete.api_key_expires_at, null);

    const staleDeleteAuditCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE request_id = ?
        AND event_type = 'API_KEY_DELETED'
    `).get<any>('req-stale-delete-race');
    assert.equal(Number(staleDeleteAuditCount.count), 0);
  } finally {
    setAccessQueryInterceptor(undefined);
    await close(server);
    await closeDb();
  }
}

main().then(() => {
  console.log('access route tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
