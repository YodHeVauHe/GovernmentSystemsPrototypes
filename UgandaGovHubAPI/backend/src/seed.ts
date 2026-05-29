import 'dotenv/config';
import yaml from 'js-yaml';
import { createDb, run } from './db';
import { ensureAuthSchema, ensureDefaultAdmin, ensureDemoUsers } from './auth';
import { ensureAccountVerificationSchema } from './account-verification';
import { ensureApiVersionSchema, parseSpecMetadata, slugifyVersion } from './versioning';
import { productionDemoApis } from './production-demo-catalog-data';

const db = createDb();
process.env.GOVHUB_DEMO_MODE = process.env.GOVHUB_DEMO_MODE || 'true';

async function main() {
console.log('Initializing database schema...');

// Create tables
await db.exec(`
  DROP TABLE IF EXISTS verification_documents;
  DROP TABLE IF EXISTS user_profiles;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS access_requests;
  DROP TABLE IF EXISTS audit_logs;
  DROP TABLE IF EXISTS api_versions;
  DROP TABLE IF EXISTS apis;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS mdas;

  CREATE TABLE mdas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL
  );

  CREATE TABLE apis (
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
    FOREIGN KEY (owning_mda_id) REFERENCES mdas (id)
  );

  CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    mda_id TEXT,
    consumer_user_id TEXT,
    api_id TEXT,
    request_id TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`);

await ensureAuthSchema(db);
await ensureDefaultAdmin(db);
await ensureDemoUsers(db);

await db.exec(`
  CREATE TABLE access_requests (
    id TEXT PRIMARY KEY,
    consumer_mda_id TEXT,
    consumer_user_id TEXT,
    consumer_type TEXT DEFAULT 'mda',
    api_id TEXT NOT NULL,
    purpose TEXT,
    status TEXT,
    api_key TEXT,
    api_key_hash TEXT,
    api_key_preview TEXT,
    api_key_status TEXT DEFAULT 'ACTIVE',
    api_key_expires_at TEXT,
    api_key_revoked_at TEXT,
    requested_fields TEXT,
    volume_tier TEXT,
    legal_basis TEXT,
    environment TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consumer_mda_id) REFERENCES mdas (id),
    FOREIGN KEY (consumer_user_id) REFERENCES users (id),
    FOREIGN KEY (api_id) REFERENCES apis (id)
  );
`);

await ensureAccountVerificationSchema(db);

console.log('Inserting seed data...');

const insertMdaSql = 'INSERT INTO mdas (id, name, short_name) VALUES ($1, $2, $3)';
const mdas = [
  ['mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'National Identification and Registration Authority', 'NIRA'],
  ['mda-ura-2efff0d3-952e-4475-8231-232873a69854', 'Uganda Revenue Authority', 'URA'],
  ['mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5', 'Uganda Registration Services Bureau', 'URSB'],
  ['mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7', 'Ministry of Works and Transport', 'MoWT'],
  ['mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3', 'Ministry of ICT and National Guidance', 'MoICT'],
  ['mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'Ministry of Health', 'MoH'],
  ['mda-ppda-e122702f-76bd-46e0-b15f-2c2b93d9928b', 'Public Procurement and Disposal of Public Assets Authority', 'PPDA'],
  ['mda-nssf-38be9aa8-edb6-453d-ab9e-5d396ca960bc', 'National Social Security Fund', 'NSSF'],
  ['mda-upf-80e53954-69a8-41d0-818d-01372005684e', 'Uganda Police Force', 'UPF'],
  ['mda-nita-u-b47d8923-86ad-47ad-9992-3167c54f0a12', 'National Information Technology Authority Uganda', 'NITA-U']
];
for (const mda of mdas) await run(db, insertMdaSql, mda);

const insertApiSql = `
  INSERT INTO apis (
    id, name, owning_mda_id, sector, description, lifecycle_status, 
    sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text, required_approval_level, contact_office,
    technical_owner, personal_data_categories, purpose_limitation, data_minimization_note,
    retention_class, statutory_basis, security_classification, sla_target, compliance_status
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
  )
`;

const apis = productionDemoApis.map(api => {
  const specText = yaml.dump(api.spec, { lineWidth: 120, noRefs: true });
  const metadata = parseSpecMetadata(specText);
  return [
    api.id,
    api.name,
    api.owning_mda_id,
    api.sector,
    api.description,
    api.lifecycle_status,
    api.sensitivity_level,
    true,
    `/openapi/${api.id}-${slugifyVersion(metadata.version)}.yaml`,
    specText,
    api.required_approval_level,
    api.contact_office,
    api.technical_owner,
    api.personal_data_categories,
    api.purpose_limitation,
    api.data_minimization_note,
    api.retention_class,
    api.statutory_basis,
    api.security_classification,
    api.sla_target,
    api.compliance_status
  ];
});
for (const api of apis) await run(db, insertApiSql, api);
await ensureApiVersionSchema(db);

console.log('Seed data inserted successfully.');
await db.close();
}

main().catch(async err => {
  console.error(err);
  await db.close();
  process.exit(1);
});
