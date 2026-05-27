import assert from 'assert/strict';
import Database from 'better-sqlite3';
import { UPDATE_API_SQL } from './catalog-sql';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE apis (
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

db.prepare(`
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
  'mda-01',
  'Old Sector',
  'Old description',
  'Draft',
  'Medium',
  1,
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

db.prepare(UPDATE_API_SQL).run(
  'New API',
  'mda-02',
  'Finance',
  'Updated description',
  'Production',
  'High',
  0,
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

const row = db.prepare('SELECT name, owning_mda_id, sector, openapi_spec_text, docs_visibility FROM apis WHERE id = ?').get('api-test') as any;
assert.deepEqual(row, {
  name: 'New API',
  owning_mda_id: 'mda-02',
  sector: 'Finance',
  openapi_spec_text: 'openapi: 3.0.0\ninfo:\n  title: New\n  version: 1.0.0\npaths: {}',
  docs_visibility: 'restricted',
});

console.log('catalog SQL tests passed');
