import type { Db } from './db';
import { hasColumn } from './db';

export async function ensureCatalogSchema(db: Db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mdas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS apis (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owning_mda_id TEXT NOT NULL,
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
      docs_visibility TEXT,
      FOREIGN KEY (owning_mda_id) REFERENCES mdas (id)
    );
  `);

  if (!await hasColumn(db, 'apis', 'openapi_spec_text')) {
    await db.exec('ALTER TABLE apis ADD COLUMN openapi_spec_text TEXT');
  }
}
