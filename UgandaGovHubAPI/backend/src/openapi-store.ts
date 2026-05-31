import type { DbClient } from './db';
import { one } from './db';
import { slugifyVersion, validateOpenApiSpec } from './versioning';

export type StoredOpenApiSpec = {
  api_id: string;
  openapi_spec_path: string;
  openapi_spec_text: string;
};

export function buildOpenApiPath(apiId: string, version: string) {
  const safeApiId = apiId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'api';
  return `/openapi/${safeApiId}-${slugifyVersion(version)}.yaml`;
}

export function normalizeOpenApiPath(pathOrFilename: string) {
  const raw = String(pathOrFilename || '').trim();
  const normalized = raw.startsWith('/openapi/') ? raw : `/openapi/${raw.replace(/^\/+/, '')}`;
  if (!normalized.startsWith('/openapi/') || normalized.includes('..')) return null;
  const filename = normalized.replace(/^\/openapi\/+/, '');
  if (!filename || filename.includes('/') || !/^[a-zA-Z0-9._-]+\.ya?ml$/.test(filename)) return null;
  return `/openapi/${filename}`;
}

export function filenameFromOpenApiPath(openapiPath: string) {
  const normalized = normalizeOpenApiPath(openapiPath);
  return normalized ? normalized.replace(/^\/openapi\/+/, '') : null;
}

export async function getSpecByPath(db: DbClient, openapiPath: string): Promise<StoredOpenApiSpec | undefined> {
  const normalized = normalizeOpenApiPath(openapiPath);
  if (!normalized) return undefined;

  const apiSpec = await one<StoredOpenApiSpec>(db, `
    SELECT id AS api_id, openapi_spec_path, openapi_spec_text
    FROM apis
    WHERE openapi_spec_path = $1
      AND openapi_spec_text IS NOT NULL
  `, [normalized]);
  if (apiSpec) return apiSpec;

  try {
    return await one<StoredOpenApiSpec>(db, `
      SELECT api_id, openapi_spec_path, openapi_spec_text
      FROM api_versions
      WHERE openapi_spec_path = $1
        AND openapi_spec_text IS NOT NULL
    `, [normalized]);
  } catch {
    return undefined;
  }
}

export async function getCurrentSpecForApi(db: DbClient, apiId: string): Promise<StoredOpenApiSpec | undefined> {
  return one<StoredOpenApiSpec>(db, `
    SELECT id AS api_id, openapi_spec_path, openapi_spec_text
    FROM apis
    WHERE id = $1
      AND openapi_spec_path IS NOT NULL
      AND openapi_spec_text IS NOT NULL
  `, [apiId]);
}

export async function getVersionSpecForApi(db: DbClient, apiId: string, version: string): Promise<StoredOpenApiSpec | undefined> {
  return one<StoredOpenApiSpec>(db, `
    SELECT api_id, openapi_spec_path, openapi_spec_text
    FROM api_versions
    WHERE api_id = $1
      AND version = $2
      AND openapi_spec_path IS NOT NULL
      AND openapi_spec_text IS NOT NULL
  `, [apiId, version]);
}

export function parseStoredOpenApiSpec(specText: string) {
  return validateOpenApiSpec(specText).parsed;
}
