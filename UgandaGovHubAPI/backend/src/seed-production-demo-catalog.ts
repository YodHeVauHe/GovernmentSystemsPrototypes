import 'dotenv/config';
import yaml from 'js-yaml';
import type { Db } from './db';
import { many, run } from './db';
import { getSpecSha, parseSpecMetadata, slugifyVersion } from './versioning';
import { legacyDemoApiIdMappings, legacyMdaIdMappings, mdas, productionDemoApis } from './production-demo-catalog-data';
import type { SyncProductionDemoCatalogOptions } from './production-demo-catalog-types';

async function cleanupLegacyProductionDemoRows(db: Db) {
  for (const { legacyId, currentId } of legacyDemoApiIdMappings) {
    await run(db, 'UPDATE access_requests SET api_id = $1 WHERE api_id = $2', [currentId, legacyId]);
    await run(db, 'UPDATE audit_logs SET api_id = $1 WHERE api_id = $2', [currentId, legacyId]);
    await run(db, 'DELETE FROM api_versions WHERE api_id = $1', [legacyId]);
    await run(db, 'DELETE FROM apis WHERE id = $1', [legacyId]);
  }

  for (const { legacyId, currentId } of legacyMdaIdMappings) {
    await run(db, 'UPDATE apis SET owning_mda_id = $1 WHERE owning_mda_id = $2', [currentId, legacyId]);
    await run(db, 'UPDATE access_requests SET consumer_mda_id = $1 WHERE consumer_mda_id = $2', [currentId, legacyId]);
    await run(db, 'UPDATE audit_logs SET mda_id = $1 WHERE mda_id = $2', [currentId, legacyId]);
    await run(db, 'UPDATE users SET mda_id = $1 WHERE mda_id = $2', [currentId, legacyId]);
    await run(db, 'UPDATE users SET requested_mda_id = $1 WHERE requested_mda_id = $2', [currentId, legacyId]);
    await run(db, 'DELETE FROM mdas WHERE id = $1', [legacyId]);
  }
}

export async function syncProductionDemoCatalog(db: Db, options: SyncProductionDemoCatalogOptions = {}) {
  const upsertMdaSql = `
    INSERT INTO mdas (id, name, short_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      short_name = EXCLUDED.short_name
  `;
  for (const mda of mdas) await run(db, upsertMdaSql, mda);

  const upsertApiSql = `
    INSERT INTO apis (
      id, name, owning_mda_id, sector, description, lifecycle_status,
      sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text,
      required_approval_level, contact_office, technical_owner, personal_data_categories,
      purpose_limitation, data_minimization_note, retention_class, statutory_basis,
      security_classification, sla_target, compliance_status, docs_visibility
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      owning_mda_id = EXCLUDED.owning_mda_id,
      sector = EXCLUDED.sector,
      description = EXCLUDED.description,
      lifecycle_status = EXCLUDED.lifecycle_status,
      sensitivity_level = EXCLUDED.sensitivity_level,
      sandbox_available = EXCLUDED.sandbox_available,
      openapi_spec_path = EXCLUDED.openapi_spec_path,
      openapi_spec_text = EXCLUDED.openapi_spec_text,
      required_approval_level = EXCLUDED.required_approval_level,
      contact_office = EXCLUDED.contact_office,
      technical_owner = EXCLUDED.technical_owner,
      personal_data_categories = EXCLUDED.personal_data_categories,
      purpose_limitation = EXCLUDED.purpose_limitation,
      data_minimization_note = EXCLUDED.data_minimization_note,
      retention_class = EXCLUDED.retention_class,
      statutory_basis = EXCLUDED.statutory_basis,
      security_classification = EXCLUDED.security_classification,
      sla_target = EXCLUDED.sla_target,
      compliance_status = EXCLUDED.compliance_status,
      docs_visibility = EXCLUDED.docs_visibility
  `;

  const upsertVersionSql = `
    INSERT INTO api_versions (
      id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha,
      endpoints_count, openapi_version, status, is_current, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (api_id, version) DO UPDATE SET
      openapi_spec_path = EXCLUDED.openapi_spec_path,
      openapi_spec_text = EXCLUDED.openapi_spec_text,
      spec_sha = EXCLUDED.spec_sha,
      endpoints_count = EXCLUDED.endpoints_count,
      openapi_version = EXCLUDED.openapi_version,
      status = EXCLUDED.status,
      is_current = EXCLUDED.is_current,
      notes = EXCLUDED.notes
  `;

  for (const api of productionDemoApis) {
    const specText = yaml.dump(api.spec, { lineWidth: 120, noRefs: true });
    const metadata = parseSpecMetadata(specText);
    const openapiPath = `/openapi/${api.id}-${slugifyVersion(metadata.version)}.yaml`;
    const versionId = `${api.id}-${slugifyVersion(metadata.version)}`;

    await run(db, upsertApiSql, [
      api.id,
      api.name,
      api.owning_mda_id,
      api.sector,
      api.description,
      api.lifecycle_status,
      api.sensitivity_level,
      true,
      openapiPath,
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
      api.compliance_status,
      api.docs_visibility
    ]);

    await run(db, 'UPDATE api_versions SET is_current = FALSE WHERE api_id = $1', [api.id]);
    await run(db, upsertVersionSql, [
      versionId,
      api.id,
      metadata.version,
      openapiPath,
      specText,
      getSpecSha(specText),
      metadata.endpointsCount,
      metadata.openapiVersion,
      'Published',
      true,
      'Expanded production demo catalog seed'
    ]);
  }

  await cleanupLegacyProductionDemoRows(db);

  const rows = await many(db, `
    SELECT a.id, a.name, v.endpoints_count
    FROM apis a
    LEFT JOIN api_versions v ON v.api_id = a.id AND v.is_current = TRUE
    WHERE a.id = ANY($1)
    ORDER BY a.name
  `, [productionDemoApis.map(api => api.id)]);

  if (options.log) console.table(rows);
}

async function upsertDemoCatalog() {
  process.env.GOVHUB_SYNC_DEMO_CATALOG = 'false';
  // Keep this require-based so NodeNext production checks and ts-node scripts both resolve it.
  const { db, initializeApp } = require('./app') as typeof import('./app.js');
  await initializeApp();
  await syncProductionDemoCatalog(db, { log: true });
  await db.close();
}

if (require.main === module) {
  upsertDemoCatalog().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
