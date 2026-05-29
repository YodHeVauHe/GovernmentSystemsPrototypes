import assert from 'assert/strict';
import { UPDATE_API_SQL } from './catalog-sql';
import { withPostgresTestDb } from './postgres-test-db';

async function main() {
  await withPostgresTestDb(async db => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS apis (
        id TEXT PRIMARY KEY,
        name TEXT,
        owning_mda_id TEXT,
        sector TEXT,
        description TEXT,
        lifecycle_status TEXT,
        sensitivity_level TEXT,
        sandbox_available BOOLEAN,
        openapi_spec_path TEXT,
        openapi_spec_text TEXT,
        required_approval_level TEXT,
        contact_office TEXT,
        technical_owner TEXT,
        personal_data_categories TEXT,
        purpose_limitation TEXT,
        data_minimization_note TEXT,
        retention_class TEXT,
        statutory_basis TEXT,
        security_classification TEXT,
        sla_target TEXT,
        compliance_status TEXT,
        docs_visibility TEXT
      );
    `);

    await db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, sector, description, lifecycle_status,
        sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text, required_approval_level,
        contact_office, technical_owner, personal_data_categories, purpose_limitation,
        data_minimization_note, retention_class, statutory_basis, security_classification,
        sla_target, compliance_status, docs_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'api-test',
      'Old API',
      'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41',
      'Old Sector',
      'Old description',
      'Draft',
      'Medium',
      true,
      '/openapi/old.yaml',
      'openapi: 3.0.0\ninfo:\n  title: Old\n  version: 1.0.0\npaths: {}',
      'Director',
      'old@example.go.ug',
      'Old Team',
      'NIN',
      'Old purpose',
      'Old minimization',
      'Default',
      'Old Act',
      'Official',
      '99%',
      'Draft',
      'authenticated'
    );

    await db.prepare(UPDATE_API_SQL).run(
      'New API',
      'mda-ura-2efff0d3-952e-4475-8231-232873a69854',
      'Finance',
      'Updated description',
      'Production',
      'High',
      false,
      '/openapi/new.yaml',
      'openapi: 3.0.0\ninfo:\n  title: New\n  version: 1.0.0\npaths: {}',
      'Commissioner',
      'new@example.go.ug',
      'New Team',
      'TIN',
      'Updated purpose',
      'Updated minimization',
      'Short',
      'New Act',
      'Restricted',
      '99.9%',
      'Approved',
      'restricted',
      'api-test'
    );

    const row = await db.prepare('SELECT name, owning_mda_id, sector, openapi_spec_text, docs_visibility FROM apis WHERE id = ?').get('api-test');
    assert.deepEqual(row, {
      name: 'New API',
      owning_mda_id: 'mda-ura-2efff0d3-952e-4475-8231-232873a69854',
      sector: 'Finance',
      openapi_spec_text: 'openapi: 3.0.0\ninfo:\n  title: New\n  version: 1.0.0\npaths: {}',
      docs_visibility: 'restricted',
    });
  });
}

main().then(() => {
  console.log('catalog SQL tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
