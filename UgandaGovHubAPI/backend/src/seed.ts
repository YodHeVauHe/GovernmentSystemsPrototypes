import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createDb } from './db';
import { ensureAuthSchema, ensureDefaultAdmin, ensureDemoUsers } from './auth';
import { ensureAccountVerificationSchema } from './account-verification';
import { ensureApiVersionSchema } from './versioning';

const db = createDb();
process.env.GOVHUB_DEMO_MODE = process.env.GOVHUB_DEMO_MODE || 'true';

function readSeedSpec(openapiPath: string) {
  const filePath = path.join(__dirname, '..', openapiPath);
  return fs.readFileSync(filePath, 'utf8');
}

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consumer_mda_id) REFERENCES mdas (id),
    FOREIGN KEY (consumer_user_id) REFERENCES users (id),
    FOREIGN KEY (api_id) REFERENCES apis (id)
  );
`);

await ensureAccountVerificationSchema(db);

console.log('Inserting seed data...');

const insertMda = db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)');
const mdas = [
  ['mda-01', 'National Identification and Registration Authority', 'NIRA'],
  ['mda-02', 'Uganda Revenue Authority', 'URA'],
  ['mda-03', 'Uganda Registration Services Bureau', 'URSB'],
  ['mda-04', 'Ministry of Works and Transport', 'MoWT'],
  ['mda-05', 'Ministry of ICT and National Guidance', 'MoICT'],
  ['mda-06', 'Ministry of Health', 'MoH'],
  ['mda-07', 'Public Procurement and Disposal of Public Assets Authority', 'PPDA'],
  ['mda-08', 'National Social Security Fund', 'NSSF'],
  ['mda-09', 'Uganda Police Force', 'UPF'],
  ['mda-10', 'National Information Technology Authority Uganda', 'NITA-U']
];
for (const m of mdas) await insertMda.run(...m);

const insertApi = db.prepare(`
  INSERT INTO apis (
    id, name, owning_mda_id, sector, description, lifecycle_status, 
    sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text, required_approval_level, contact_office,
    technical_owner, personal_data_categories, purpose_limitation, data_minimization_note,
    retention_class, statutory_basis, security_classification, sla_target, compliance_status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const apis = [
  [
    'api-nira-01', 'NIRA Identity Verification API', 'mda-01', 'Identity',
    'Verify citizen identity using NIN. Returns match confidence and basic verification status.',
    'Production', 'High', 1, '/openapi/nira-identity.yaml', readSeedSpec('/openapi/nira-identity.yaml'), 'Director General', 'data.protection@nira.go.ug',
    'Identity Systems Team', 'NIN, Surname, Given Name, Date of Birth',
    'Verification of identity for lawful public service delivery',
    'Returns boolean flags and match confidence; never returns full registry records',
    'Access log retained for 1 year; citizen query parameters are not stored',
    'Registration of Persons Act 2015, Section 65', 'Restricted', '99.9% Uptime, <150ms Response Time', 'Approved for Production'
  ],
  [
    'api-ura-01', 'URA Tax Compliance Status API', 'mda-02', 'Finance',
    'Check tax clearance status for businesses and individuals.',
    'Production', 'Medium', 1, '/openapi/ura-tax.yaml', readSeedSpec('/openapi/ura-tax.yaml'), 'Commissioner General', 'api.support@ura.go.ug',
    'URA IT Department', 'TIN, Compliance Status',
    'Supplier verification, business registration, and compliance tracking',
    'Only outputs binary compliance status; no detailed tax returns exposed',
    'Logs kept for 6 months',
    'Tax Procedures Code Act 2014, Section 43', 'Official', '99.5% Uptime, <200ms Response Time', 'Approved for Production'
  ],
  [
    'api-ursb-01', 'URSB Business Registration Lookup', 'mda-03', 'Commerce',
    'Look up business registration details and verify company status.',
    'Beta', 'Low', 1, '/openapi/ursb-business.yaml', readSeedSpec('/openapi/ursb-business.yaml'), 'Registrar General', 'services@ursb.go.ug',
    'URSB Systems Division', 'BRN, Company Name, Director Names',
    'KYC verification for government registration and private service onboarding',
    'Differentiates between public registry facts and restricted beneficial ownership details',
    'Logs kept for 1 year',
    'Companies Act 2012, Section 396', 'Public', '99.0% Uptime, <300ms Response Time', 'Approved for Sandbox'
  ],
  [
    'api-mowt-01', 'Driving Permit Verification API', 'mda-04', 'Transport',
    'Verify driving permit status and validity class.',
    'Beta', 'Medium', 1, '/openapi/driving-permit.yaml', readSeedSpec('/openapi/driving-permit.yaml'), 'Director of Transport', 'permits.support@works.go.ug',
    'MoWT IT Team', 'Permit Number, Class, Expiry, Status',
    'Verification of driver eligibility for recruitment, licensing, and enforcement',
    'Returns class authorization and validity; does not return driving record history',
    'Logs kept for 6 months',
    'Traffic and Road Safety Act 1998, Section 42', 'Official', '99.5% Uptime, <200ms Response Time', 'Under Review'
  ],
  [
    'api-moict-01', 'Service Uganda Composite Eligibility', 'mda-05', 'Integration',
    'Composite workflow checking citizen identity, tax status, and driving permit in a single call.',
    'Draft', 'High', 1, '/openapi/service-uganda.yaml', readSeedSpec('/openapi/service-uganda.yaml'), 'Permanent Secretary', 'support@ict.go.ug',
    'GovHub Integration Team', 'NIN, TIN, Permit Number',
    'Single-window citizen eligibility assessment for bundled public services',
    'Aggregates source system status without consolidating or storing citizen data',
    'Correlation log kept for 30 days',
    'National ICT Policy 2014, Section 5.2', 'Restricted', '99.0% Uptime, <800ms Response Time', 'Draft'
  ]
];
for (const a of apis) await insertApi.run(...a);
await ensureApiVersionSchema(db);

console.log('Seed data inserted successfully.');
await db.close();
}

main().catch(async err => {
  console.error(err);
  await db.close();
  process.exit(1);
});
