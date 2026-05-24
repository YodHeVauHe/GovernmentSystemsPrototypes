import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import Database from 'better-sqlite3';
import { ensureAuthSchema, ensureDefaultAdmin, requireApprovedAuth, requireAuth } from './auth';
import { authRouter, adminUsersRouter } from './routes/auth';
import { ensureAccountVerificationSchema } from './account-verification';

async function startApp() {
  const db = new Database(':memory:');
  ensureAuthSchema(db);
  process.env.GOVHUB_ADMIN_EMAIL = 'admin@ict.go.ug';
  process.env.GOVHUB_ADMIN_PASSWORD = 'AdminPass123!';
  ensureDefaultAdmin(db);
  ensureAccountVerificationSchema(db);

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
  return { db, server, baseUrl: `http://127.0.0.1:${address.port}` };
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
  const { db, server, baseUrl } = await startApp();

  try {
    const signup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Jane Developer',
        email: 'Jane@Example.go.ug',
        password: 'StrongPass123!',
        account_type: 'government',
        requested_role: 'developer',
        requested_mda_id: 'mda-06',
        requested_organization: 'Ministry of Health',
        requested_purpose: 'Build a health service integration',
      }),
    });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.body.user.email, 'jane@example.go.ug');
    assert.equal(signup.body.user.status, 'PENDING_REVIEW');
    assert.equal(signup.body.token, undefined);

    const publicDeveloperSignup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Sam Civic',
        email: 'sam@example.com',
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

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.go.ug', password: 'StrongPass123!' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.status, 'PENDING_REVIEW');
    assert.equal(login.body.token, undefined);
    const janeCookie = sessionCookie(login.response);

    const me = await request(baseUrl, '/api/auth/me', {
      headers: { cookie: janeCookie },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, 'jane@example.go.ug');

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
      body: JSON.stringify({ email: 'admin@ict.go.ug', password: 'AdminPass123!' }),
    });
    assert.equal(adminLogin.response.status, 200);
    const adminCookie = sessionCookie(adminLogin.response);

    const users = await request(baseUrl, '/api/admin/users?status=PENDING_REVIEW', {
      headers: { cookie: adminCookie },
    });
    assert.equal(users.response.status, 200);
    assert.equal(users.body.users.length, 2);

    const publicDeveloperApproval = await request(baseUrl, `/api/admin/users/${publicDeveloperSignup.body.user.id}/approve`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'developer', mda_id: null }),
    });
    assert.equal(publicDeveloperApproval.response.status, 400);
    assert.equal(publicDeveloperApproval.body.code, 'VERIFICATION_NOT_SUBMITTED');

    const approval = await request(baseUrl, `/api/admin/users/${signup.body.user.id}/approve`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: JSON.stringify({ role: 'developer', mda_id: 'mda-06' }),
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

    const allUsers = await request(baseUrl, '/api/admin/users', {
      headers: { cookie: adminCookie },
    });
    assert.equal(allUsers.response.status, 200);
    assert.equal(allUsers.body.users.some((user: any) => user.status === 'APPROVED'), true);
    assert.equal(allUsers.body.users.some((user: any) => user.status === 'PENDING_REVIEW'), true);

    const selfDelete = await request(baseUrl, `/api/admin/users/${adminLogin.body.user.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    });
    assert.equal(selfDelete.response.status, 400);
    assert.equal(selfDelete.body.code, 'CANNOT_DELETE_SELF');

    const deletePublicDeveloper = await request(baseUrl, `/api/admin/users/${publicDeveloperSignup.body.user.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    });
    assert.equal(deletePublicDeveloper.response.status, 200);
    assert.equal(deletePublicDeveloper.body.deleted, true);
    assert.equal(deletePublicDeveloper.body.user.id, publicDeveloperSignup.body.user.id);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get(publicDeveloperSignup.body.user.id) as any).count, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(publicDeveloperSignup.body.user.id) as any).count, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM user_profiles WHERE user_id = ?').get(publicDeveloperSignup.body.user.id) as any).count, 0);
  } finally {
    await close(server);
  }
}

run().then(() => {
  console.log('auth route tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
