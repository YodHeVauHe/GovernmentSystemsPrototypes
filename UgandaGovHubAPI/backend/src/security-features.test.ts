import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, type Server } from 'http';
import { ensureAdminSchema } from './admin';
import { ensureAccountVerificationSchema, getAccountSnapshot, upsertVerificationDocument } from './account-verification';
import {
  decryptAtRest,
  encryptAtRest,
  isEncryptedAtRest,
} from './crypto-at-rest';
import {
  ensureAuthSchema,
  ensureDefaultAdmin,
  generateTotpSecret,
  getTotpCode,
  hashPassword,
} from './auth';
import { adminUsersRouter, authRouter } from './routes/auth';
import { getTlsConfig } from './tls';
import { openPostgresTestDb } from './postgres-test-db';

process.env.GOVHUB_DATA_ENCRYPTION_KEY = 'test-encryption-key-for-security-feature-tests';

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

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return { db, server, closeDb: close, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function request(baseUrl: string, route: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${route}`, { ...init, headers });
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
  const encrypted = encryptAtRest('CM123456789ABCD');
  assert.equal(isEncryptedAtRest(encrypted), true);
  assert.notEqual(encrypted, 'CM123456789ABCD');
  assert.equal(decryptAtRest(encrypted), 'CM123456789ABCD');
  assert.equal(decryptAtRest(null), null);

  const { db, server, closeDb, baseUrl } = await startApp();
  try {
    await db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status, role, mda_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_secure',
      'Secure User',
      'secure.security-test@example.go.ug',
      hashPassword('StrongPass123!'),
      'public_developer',
      'developer',
      null,
      'Independent Developer',
      'Build a public service integration',
      'APPROVED',
      'developer',
      null
    );
    await ensureAccountVerificationSchema(db);
    await db.prepare(`
      UPDATE user_profiles SET
        nin = ?, national_id_number = ?, contact_phone = ?, address = ?
      WHERE user_id = ?
    `).run('CM123456789ABCD', '000000001', '+256700000000', 'Kampala', 'usr_secure');
    await ensureAccountVerificationSchema(db);
    const storedProfile = await db.prepare('SELECT nin, national_id_number, contact_phone, address FROM user_profiles WHERE user_id = ?').get<any>('usr_secure');
    assert.equal(isEncryptedAtRest(storedProfile.nin), true);
    assert.equal(isEncryptedAtRest(storedProfile.national_id_number), true);
    assert.equal(isEncryptedAtRest(storedProfile.contact_phone), true);
    assert.equal(isEncryptedAtRest(storedProfile.address), true);
    const snapshot = await getAccountSnapshot(db, 'usr_secure');
    assert.equal(snapshot?.profile.nin, 'CM123456789ABCD');
    assert.equal(snapshot?.profile.address, 'Kampala');

    await upsertVerificationDocument(db, 'usr_secure', {
      type: 'national_id_front',
      label: 'National ID front',
      file_name: 'front.png',
      mime_type: 'image/png',
      storage_ref: 's3://vault/front.png',
    });
    const storedDocument = await db.prepare('SELECT file_name, storage_ref FROM verification_documents WHERE user_id = ?').get<any>('usr_secure');
    assert.equal(isEncryptedAtRest(storedDocument.file_name), true);
    assert.equal(isEncryptedAtRest(storedDocument.storage_ref), true);
    assert.equal((await getAccountSnapshot(db, 'usr_secure'))?.documents[0].file_name, 'front.png');

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'secure.security-test@example.go.ug', password: 'StrongPass123!' }),
    });
    assert.equal(login.response.status, 200);
    const cookie = sessionCookie(login.response);

    const setup = await request(baseUrl, '/api/auth/mfa/setup', {
      method: 'POST',
      headers: { cookie },
    });
    assert.equal(setup.response.status, 200);
    assert.equal(typeof setup.body.secret, 'string');
    assert.match(setup.body.otpauth_url, /^otpauth:\/\/totp\//);

    const enable = await request(baseUrl, '/api/auth/mfa/enable', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ code: getTotpCode(setup.body.secret, new Date()) }),
    });
    assert.equal(enable.response.status, 200);
    assert.equal(enable.body.user.mfa_enabled, true);
    const enabledUser = await db.prepare('SELECT mfa_enabled_at, mfa_secret_encrypted FROM users WHERE id = ?').get<any>('usr_secure');
    assert.equal(typeof enabledUser.mfa_enabled_at, 'string');
    assert.equal(typeof enabledUser.mfa_secret_encrypted, 'string');

    const resetWhileEnabled = await request(baseUrl, '/api/auth/mfa/setup', {
      method: 'POST',
      headers: { cookie },
    });
    assert.equal(resetWhileEnabled.response.status, 409);
    assert.equal(resetWhileEnabled.body.code, 'MFA_ALREADY_ENABLED');
    const stillEnabledUser = await db.prepare('SELECT mfa_enabled_at, mfa_secret_encrypted FROM users WHERE id = ?').get<any>('usr_secure');
    assert.equal(stillEnabledUser.mfa_enabled_at, enabledUser.mfa_enabled_at);
    assert.equal(stillEnabledUser.mfa_secret_encrypted, enabledUser.mfa_secret_encrypted);

    const missingMfa = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'secure.security-test@example.go.ug', password: 'StrongPass123!' }),
    });
    assert.equal(missingMfa.response.status, 202);
    assert.equal(missingMfa.body.mfa_required, true);

    const badMfa = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'secure.security-test@example.go.ug', password: 'StrongPass123!', mfa_code: '000000' }),
    });
    assert.equal(badMfa.response.status, 401);
    assert.equal(badMfa.body.code, 'INVALID_MFA_CODE');

    const goodMfa = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'secure.security-test@example.go.ug',
        password: 'StrongPass123!',
        mfa_code: getTotpCode(setup.body.secret, new Date()),
      }),
    });
    assert.equal(goodMfa.response.status, 200);
    assert.equal(goodMfa.body.user.mfa_enabled, true);

    const certPath = path.join(__dirname, '../test-cert.pem');
    const keyPath = path.join(__dirname, '../test-key.pem');
    fs.writeFileSync(certPath, 'CERT');
    fs.writeFileSync(keyPath, 'KEY');
    const tlsConfig = getTlsConfig({
      GOVHUB_TLS_CERT_PATH: certPath,
      GOVHUB_TLS_KEY_PATH: keyPath,
    });
    assert.equal(tlsConfig.enabled, true);
    assert.equal(tlsConfig.options.cert?.toString(), 'CERT');
    assert.equal(tlsConfig.options.key?.toString(), 'KEY');
    fs.unlinkSync(certPath);
    fs.unlinkSync(keyPath);
  } finally {
    await close(server);
    await closeDb();
  }
}

run().then(() => {
  console.log('security feature tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
