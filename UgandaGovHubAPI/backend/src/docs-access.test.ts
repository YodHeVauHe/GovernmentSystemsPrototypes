import assert from 'node:assert/strict';
import {
  canDownloadOpenApiAsset,
  canViewApiDocs,
  listVisibleDocsApis,
  resolveDocsVisibility,
  type DocsDecision,
} from './docs-access';
import { withPostgresTestDb } from './postgres-test-db';

function deniedCode(decision: DocsDecision) {
  assert.equal(decision.allowed, false);
  return decision.code;
}

async function main() {
  await withPostgresTestDb(async db => {
    await db.exec(`
      CREATE TEMP TABLE apis (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owning_mda_id TEXT NOT NULL,
        sector TEXT,
        description TEXT,
        lifecycle_status TEXT,
        sensitivity_level TEXT,
        security_classification TEXT,
        sandbox_available BOOLEAN,
        required_approval_level TEXT,
        contact_office TEXT,
        openapi_spec_path TEXT,
        openapi_spec_text TEXT,
        docs_visibility TEXT
      );

      CREATE TEMP TABLE access_requests (
        id TEXT PRIMARY KEY,
        consumer_mda_id TEXT,
        consumer_user_id TEXT,
        consumer_type TEXT,
        api_id TEXT NOT NULL,
        status TEXT,
        api_key TEXT,
        api_key_hash TEXT,
        api_key_status TEXT DEFAULT 'ACTIVE',
        api_key_expires_at TEXT
      );
    `);

    await db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, lifecycle_status, sensitivity_level,
        security_classification, sandbox_available, openapi_spec_path, docs_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('api-public', 'Public Registry', 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5', 'Production', 'Low', 'Public', true, '/openapi/public.yaml', 'public');

    await db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, lifecycle_status, sensitivity_level,
        security_classification, sandbox_available, openapi_spec_path, docs_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('api-auth', 'Authenticated Registry', 'mda-ura-2efff0d3-952e-4475-8231-232873a69854', 'Beta', 'Medium', 'Official', true, '/openapi/auth.yaml', 'authenticated');

    await db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, lifecycle_status, sensitivity_level,
        security_classification, sandbox_available, openapi_spec_path, docs_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('api-restricted', 'Restricted Registry', 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'Production', 'High', 'Restricted', true, '/openapi/restricted.yaml', 'restricted');

    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_type, api_id, status, api_key_hash, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'mda', ?, ?, ?, ?, ?)
    `).run('req-approved', 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'api-restricted', 'APPROVED', 'hashed_key', 'ACTIVE', null);
    await db.prepare(`
      INSERT INTO access_requests (
        id, consumer_user_id, consumer_type, api_id, status, api_key_hash, api_key_status, api_key_expires_at
      ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?)
    `).run('req-public-approved', 'usr-public', 'api-restricted', 'APPROVED', 'hashed_public_key', 'ACTIVE', null);

    const developer = { id: 'usr-dev', status: 'APPROVED' as const, role: 'developer' as const, mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543' };
    const publicDeveloper = { id: 'usr-public', status: 'APPROVED' as const, role: 'developer' as const, mda_id: null };
    const otherDeveloper = { id: 'usr-other', status: 'APPROVED' as const, role: 'developer' as const, mda_id: 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7' };
    const pendingDeveloper = { id: 'usr-pending', status: 'PENDING_REVIEW' as const, role: null, mda_id: null };
    const owner = { id: 'usr-owner', status: 'APPROVED' as const, role: 'api_owner' as const, mda_id: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' };
    const reviewer = { id: 'usr-reviewer', status: 'APPROVED' as const, role: 'reviewer' as const, mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' };
    const admin = { id: 'usr-admin', status: 'APPROVED' as const, role: 'admin' as const, mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' };

    assert.equal(resolveDocsVisibility({ docs_visibility: null, security_classification: 'Public' }), 'public');
    assert.equal(resolveDocsVisibility({ docs_visibility: null, security_classification: 'Official' }), 'authenticated');
    assert.equal(resolveDocsVisibility({ docs_visibility: null, security_classification: 'Restricted' }), 'restricted');
    assert.equal(resolveDocsVisibility({ docs_visibility: 'PUBLIC', security_classification: 'Restricted' }), 'public');

    assert.deepEqual(await canViewApiDocs(db, null, 'api-public'), { allowed: true, visibility: 'public' });
    assert.equal(deniedCode(await canViewApiDocs(db, null, 'api-auth')), 'UNAUTHENTICATED');
    assert.equal(deniedCode(await canViewApiDocs(db, pendingDeveloper, 'api-auth')), 'ACCOUNT_NOT_APPROVED');
    assert.deepEqual(await canViewApiDocs(db, developer, 'api-auth'), { allowed: true, visibility: 'authenticated' });

    assert.deepEqual(await canViewApiDocs(db, admin, 'api-restricted'), { allowed: true, visibility: 'restricted' });
    assert.deepEqual(await canViewApiDocs(db, reviewer, 'api-restricted'), { allowed: true, visibility: 'restricted' });
    assert.deepEqual(await canViewApiDocs(db, owner, 'api-restricted'), { allowed: true, visibility: 'restricted' });
    assert.deepEqual(await canViewApiDocs(db, developer, 'api-restricted'), { allowed: true, visibility: 'restricted' });
    assert.deepEqual(await canViewApiDocs(db, publicDeveloper, 'api-restricted'), { allowed: true, visibility: 'restricted' });
    assert.equal(deniedCode(await canViewApiDocs(db, otherDeveloper, 'api-restricted')), 'FORBIDDEN');
    assert.equal(deniedCode(await canViewApiDocs(db, developer, 'missing-api')), 'NOT_FOUND');

    assert.equal((await canDownloadOpenApiAsset(db, null, '/openapi/public.yaml')).allowed, true);
    assert.equal(deniedCode(await canDownloadOpenApiAsset(db, null, '/openapi/restricted.yaml')), 'UNAUTHENTICATED');
    assert.equal((await canDownloadOpenApiAsset(db, developer, '/openapi/restricted.yaml')).allowed, true);
    assert.equal((await canDownloadOpenApiAsset(db, publicDeveloper, '/openapi/restricted.yaml')).allowed, true);
    assert.equal(deniedCode(await canDownloadOpenApiAsset(db, otherDeveloper, '/openapi/restricted.yaml')), 'FORBIDDEN');
    assert.equal(deniedCode(await canDownloadOpenApiAsset(db, admin, '/openapi/missing.yaml')), 'NOT_FOUND');

    assert.deepEqual((await listVisibleDocsApis(db, null)).map(api => api.id), ['api-public']);
    assert.deepEqual((await listVisibleDocsApis(db, developer)).map(api => api.id), ['api-auth', 'api-public', 'api-restricted']);
    assert.deepEqual((await listVisibleDocsApis(db, publicDeveloper)).map(api => api.id), ['api-auth', 'api-public', 'api-restricted']);
    assert.deepEqual((await listVisibleDocsApis(db, otherDeveloper)).map(api => api.id), ['api-auth', 'api-public']);
    assert.deepEqual((await listVisibleDocsApis(db, admin)).map(api => api.id), ['api-auth', 'api-public', 'api-restricted']);
  });
}

main().then(() => {
  console.log('docs-access tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
