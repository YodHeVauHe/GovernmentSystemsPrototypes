import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { ensureAuthSchema, ensureDefaultAdmin, hashPassword, requireApprovedAuth, requireAuth } from './auth';
import { authRouter, adminUsersRouter } from './routes/auth';
import { ensureAccountVerificationSchema, getAccountSnapshot } from './account-verification';
import { computeApiKeyHash, ensureAdminSchema } from './admin';
import { openPostgresTestDb } from './postgres-test-db';

async function startApp() {
  const { db, close } = await openPostgresTestDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mdas (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS apis (id TEXT PRIMARY KEY, name TEXT NOT NULL, owning_mda_id TEXT NOT NULL);
  `);
  await db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING').run('mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3', 'Ministry of ICT and National Guidance', 'MoICT');
  await db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING').run('mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'Ministry of Health', 'MoH');
  await db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING').run('api-nira-01', 'NIRA Identity', 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3');
  await ensureAuthSchema(db);
  await ensureAdminSchema(db);
  process.env.GOVHUB_ADMIN_EMAIL = 'admin.test@ict.go.ug';
  process.env.GOVHUB_ADMIN_PASSWORD = 'AdminPass123!';
  await ensureDefaultAdmin(db);
  await ensureAccountVerificationSchema(db);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter(db));
  app.use('/api/admin/users', adminUsersRouter(db));
  app.get('/protected', requireApprovedAuth(db, ['developer']), (_req, res) => {
    res.json({ ok: true });
  });

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return { db, server, closeDb: close, baseUrl: `http://127.0.0.1:${address.port}` };
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

async function run() {
  const { db, server, closeDb, baseUrl } = await startApp();

  try {
    const signup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Jane Developer',
        email: 'Jane.Auth-Route@Example.go.ug',
        password: 'StrongPass123!',
        account_type: 'government',
        requested_role: 'developer',
        requested_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
        requested_organization: 'Ministry of Health',
        requested_purpose: 'Build a health service integration',
      }),
    });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.body.user.email, 'jane.auth-route@example.go.ug');
    assert.equal(signup.body.user.status, 'PENDING_REVIEW');
    assert.equal(signup.body.token, undefined);

    const publicDeveloperSignup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Sam Civic',
        email: 'sam.auth-route@example.com',
        password: 'StrongPass123!',
        account_type: 'public_developer',
        requested_role: 'developer',
        requested_mda_id: null,
        requested_organization: 'Independent Civic Developer',
        requested_purpose: 'Build a public-facing service using approved APIs',
      }),
    });
    assert.equal(publicDeveloperSignup.response.status, 201);
    assert.equal(publicDeveloperSignup.body.user.requested_mda_id, null);

    const adminSignup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Mallory Admin',
        email: 'mallory.auth-route@example.com',
        password: 'StrongPass123!',
        account_type: 'public_developer',
        requested_role: 'admin',
        requested_organization: 'Independent Civic Developer',
        requested_purpose: 'Request administrator access',
      }),
    });
    assert.equal(adminSignup.response.status, 400);

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'jane.auth-route@example.go.ug', password: 'StrongPass123!' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.status, 'PENDING_REVIEW');
    assert.equal(login.body.token, undefined);
    const janeCookie = sessionCookie(login.response);

    const me = await request(baseUrl, '/api/auth/me', {
      headers: { cookie: janeCookie },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, 'jane.auth-route@example.go.ug');

    const blocked = await request(baseUrl, '/protected', {
      headers: { cookie: janeCookie },
    });
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.body.code, 'ACCOUNT_NOT_APPROVED');

    const draftAccount = await request(baseUrl, '/api/auth/account', {
      headers: { cookie: janeCookie },
    });
    assert.equal(draftAccount.response.status, 200);
    assert.equal(draftAccount.body.account.profile.verification_status, 'draft_profile');
    assert.equal(draftAccount.body.account.user.password_hash, undefined);
    assert.equal(draftAccount.body.account.user.mfa_secret_encrypted, undefined);

    const selfAssignAdminCategory = await request(baseUrl, '/api/auth/account/profile', {
      method: 'PATCH',
      headers: { cookie: janeCookie },
      body: JSON.stringify({ account_category: 'admin' }),
    });
    assert.equal(selfAssignAdminCategory.response.status, 400);
    assert.equal(selfAssignAdminCategory.body.code, 'ADMIN_CATEGORY_FORBIDDEN');

    const profileUpdate = await request(baseUrl, '/api/auth/account/profile', {
      method: 'PATCH',
      headers: { cookie: janeCookie },
      body: JSON.stringify({
        staff_id: 'MOH-123',
        department: 'Digital Health',
        job_title: 'Systems Analyst',
        supervisor_name: 'Grace Manager',
        supervisor_email: 'grace.manager@health.go.ug',
      }),
    });
    assert.equal(profileUpdate.response.status, 200);

    for (const documentType of ['staff_id_or_appointment', 'authorization_letter']) {
      const documentResponse = await request(baseUrl, '/api/auth/account/documents', {
        method: 'POST',
        headers: { cookie: janeCookie },
        body: JSON.stringify({
          type: documentType,
          label: documentType,
          file_name: `${documentType}.pdf`,
          mime_type: 'application/pdf',
        }),
      });
      assert.equal(documentResponse.response.status, 201);
    }

    const submitVerification = await request(baseUrl, '/api/auth/account/submit-verification', {
      method: 'POST',
      headers: { cookie: janeCookie },
    });
    assert.equal(submitVerification.response.status, 200);
    assert.equal(submitVerification.body.account.profile.verification_status, 'submitted_for_review');

    const adminLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin.test@ict.go.ug', password: 'AdminPass123!' }),
    });
    assert.equal(adminLogin.response.status, 200);
    const adminCookie = sessionCookie(adminLogin.response);
    const adminSnapshot = await getAccountSnapshot(db, adminLogin.body.user.id);
    assert.equal(adminSnapshot?.profile.account_category, 'admin');
    assert.equal(adminSnapshot?.profile.verification_status, 'verified');

    process.env.GOVHUB_REQUIRE_ADMIN_MFA = 'true';
    const mfaBlockedAdminList = await request(baseUrl, '/api/admin/users', {
      headers: { cookie: adminCookie },
    });
    assert.equal(mfaBlockedAdminList.response.status, 403);
    assert.equal(mfaBlockedAdminList.body.code, 'ADMIN_MFA_REQUIRED');
    delete process.env.GOVHUB_REQUIRE_ADMIN_MFA;

    await db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')
    `).run(
      'usr_public_admin_candidate',
      'Public Admin Candidate',
      'public.admin.auth-route@example.com',
      hashPassword('StrongPass123!'),
      'public_developer',
      'developer',
      null,
      'Independent Civic Developer',
      'Request elevated platform access'
    );
    await db.prepare(`
      INSERT INTO user_profiles (user_id, verification_status, account_category)
      VALUES (?, 'submitted_for_review', 'public_developer')
    `).run('usr_public_admin_candidate');

    const publicAdminPromotion = await request(baseUrl, '/api/admin/users/usr_public_admin_candidate/approve', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'admin', mda_id: null }),
    });
    assert.equal(publicAdminPromotion.response.status, 400);
    assert.equal(publicAdminPromotion.body.code, 'ADMIN_PROMOTION_REQUIRES_GOVERNMENT_IDENTITY');

    await db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')
    `).run(
      'usr_gov_admin_candidate',
      'Government Admin Candidate',
      'gov.admin.auth-route@example.go.ug',
      hashPassword('StrongPass123!'),
      'government_employee',
      'reviewer',
      'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
      'Ministry of ICT and National Guidance',
      'Operate platform administration workflows'
    );
    await db.prepare(`
      INSERT INTO user_profiles (user_id, verification_status, account_category)
      VALUES (?, 'submitted_for_review', 'government_employee')
    `).run('usr_gov_admin_candidate');

    const govAdminPromotion = await request(baseUrl, '/api/admin/users/usr_gov_admin_candidate/approve', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'admin', mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' }),
    });
    assert.equal(govAdminPromotion.response.status, 200);
    assert.equal(govAdminPromotion.body.user.role, 'admin');
    const promotedAdminSnapshot = await getAccountSnapshot(db, 'usr_gov_admin_candidate');
    assert.equal(promotedAdminSnapshot?.profile.account_category, 'admin');
    assert.equal(promotedAdminSnapshot?.profile.verification_status, 'verified');

    const users = await request(baseUrl, '/api/admin/users?status=PENDING_REVIEW', {
      headers: { cookie: adminCookie },
    });
    assert.equal(users.response.status, 200);
    const pendingUserIds = users.body.users.map((user: any) => user.id);
    assert.equal(pendingUserIds.includes(signup.body.user.id), true);
    assert.equal(pendingUserIds.includes(publicDeveloperSignup.body.user.id), true);
    assert.equal(pendingUserIds.includes('usr_public_admin_candidate'), true);

    const publicDeveloperApproval = await request(baseUrl, `/api/admin/users/${publicDeveloperSignup.body.user.id}/approve`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'developer', mda_id: null }),
    });
    assert.equal(publicDeveloperApproval.response.status, 400);
    assert.equal(publicDeveloperApproval.body.code, 'VERIFICATION_NOT_SUBMITTED');

    const invalidMdaApproval = await request(baseUrl, `/api/admin/users/${signup.body.user.id}/approve`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'developer', mda_id: 'missing-mda' }),
    });
    assert.equal(invalidMdaApproval.response.status, 400);
    assert.equal(invalidMdaApproval.body.code, 'MDA_NOT_FOUND');

    const approval = await request(baseUrl, `/api/admin/users/${signup.body.user.id}/approve`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'developer', mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543' }),
    });
    assert.equal(approval.response.status, 200);
    assert.equal(approval.body.user.status, 'APPROVED');
    assert.equal(approval.body.user.role, 'developer');

    const allowed = await request(baseUrl, '/protected', {
      headers: { cookie: janeCookie },
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.body.ok, true);

    const approvedProfileEdit = await request(baseUrl, '/api/auth/account/profile', {
      method: 'PATCH',
      headers: { cookie: janeCookie },
      body: JSON.stringify({ job_title: 'Changed Title' }),
    });
    assert.equal(approvedProfileEdit.response.status, 200);
    assert.equal(approvedProfileEdit.body.account.profile.verification_status, 'needs_more_information');

    const blockedAfterProfileChange = await request(baseUrl, '/protected', {
      headers: { cookie: janeCookie },
    });
    assert.equal(blockedAfterProfileChange.response.status, 403);
    assert.equal(blockedAfterProfileChange.body.code, 'ACCOUNT_NOT_APPROVED');

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_user_id, consumer_type, api_id, purpose, status,
        api_key_hash, api_key_preview, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'user', ?, ?, 'APPROVED', ?, ?, 'ACTIVE', ?)
    `).run(
      'req-jane-key',
      signup.body.user.id,
      'api-nira-01',
      'Civic integration',
      computeApiKeyHash('ghk_jane_secret'),
      'ghk_jane...',
      '2026-06-22T10:00:00.000Z'
    );

    const suspendJane = await request(baseUrl, `/api/admin/users/${signup.body.user.id}/suspend`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    assert.equal(suspendJane.response.status, 200);
    const suspendedKey = await db.prepare('SELECT api_key_status, api_key_revoked_at FROM access_requests WHERE id = ?').get<any>('req-jane-key');
    assert.equal(suspendedKey.api_key_status, 'REVOKED');
    assert.equal(typeof suspendedKey.api_key_revoked_at, 'string');

    const allUsers = await request(baseUrl, '/api/admin/users', {
      headers: { cookie: adminCookie },
    });
    assert.equal(allUsers.response.status, 200);
    assert.equal(allUsers.body.users.some((user: any) => user.status === 'APPROVED'), true);
    assert.equal(allUsers.body.users.some((user: any) => user.status === 'PENDING_REVIEW'), true);
    assert.equal(allUsers.body.users.some((user: any) => user.password_hash || user.mfa_secret_encrypted), false);
    assert.equal(allUsers.body.users.some((user: any) => user.account?.user?.password_hash || user.account?.user?.mfa_secret_encrypted), false);

    const selfDelete = await request(baseUrl, `/api/admin/users/${adminLogin.body.user.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    });
    assert.equal(selfDelete.response.status, 400);
    assert.equal(selfDelete.body.code, 'CANNOT_DELETE_SELF');

    const selfSuspend = await request(baseUrl, `/api/admin/users/${adminLogin.body.user.id}/suspend`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    assert.equal(selfSuspend.response.status, 400);
    assert.equal(selfSuspend.body.code, 'CANNOT_CHANGE_SELF');

    const selfReject = await request(baseUrl, `/api/admin/users/${adminLogin.body.user.id}/reject`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    assert.equal(selfReject.response.status, 400);
    assert.equal(selfReject.body.code, 'CANNOT_CHANGE_SELF');

    const deletePublicDeveloper = await request(baseUrl, `/api/admin/users/${publicDeveloperSignup.body.user.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    });
    assert.equal(deletePublicDeveloper.response.status, 200);
    assert.equal(deletePublicDeveloper.body.deleted, true);
    assert.equal(deletePublicDeveloper.body.user.id, publicDeveloperSignup.body.user.id);
    assert.equal(Number((await db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get<{ count: string }>(publicDeveloperSignup.body.user.id))?.count || 0), 0);
    assert.equal(Number((await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get<{ count: string }>(publicDeveloperSignup.body.user.id))?.count || 0), 0);
    assert.equal(Number((await db.prepare('SELECT COUNT(*) as count FROM user_profiles WHERE user_id = ?').get<{ count: string }>(publicDeveloperSignup.body.user.id))?.count || 0), 0);
  } finally {
    await close(server);
    await closeDb();
  }
}

run().then(() => {
  console.log('auth route tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
