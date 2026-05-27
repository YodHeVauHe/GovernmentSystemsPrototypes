import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { DbClient } from './db';
import { exec, many, one, run } from './db';

type VersionStatusInput = {
  currentSha?: string;
  versionSha?: string;
};

export type ApiVersionStatus = 'current' | 'available';

export function slugifyVersion(version: string) {
  return version
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'version';
}

export function getSpecSha(specText: string) {
  return crypto.createHash('sha256').update(specText).digest('hex');
}

export function parseSpecMetadata(specText: string) {
  const { metadata } = validateOpenApiSpec(specText);
  return {
    version: metadata.version,
    openapiVersion: metadata.openapiVersion,
    endpointsCount: metadata.endpointsCount,
  };
}

export function validateOpenApiSpec(specText: string) {
  const parsed = yaml.load(specText) as any;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Specification parsed to an invalid object.');
  }
  const openapiVersion = parsed.openapi || parsed.swagger;
  if (!openapiVersion) {
    throw new Error('Invalid specification: missing "openapi" or "swagger" version declaration.');
  }
  if (!parsed.info || !parsed.info.title) {
    throw new Error('Invalid specification: missing "info.title" metadata.');
  }
  const paths = parsed?.paths || {};
  const endpointsCount = Object.keys(paths).reduce((count, route) => {
    const methods = Object.keys(paths[route] || {}).filter(method =>
      ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())
    );
    return count + methods.length;
  }, 0);

  return {
    parsed,
    metadata: {
      title: parsed.info.title,
      version: parsed.info.version || '1.0.0',
      description: parsed.info.description || '',
      openapiVersion,
      endpointsCount,
    },
  };
}

export function computeVersionStatus({ currentSha, versionSha }: VersionStatusInput): ApiVersionStatus {
  return currentSha && currentSha === versionSha ? 'current' : 'available';
}

export async function ensureApiVersionSchema(db: DbClient) {
  await exec(db, `
    CREATE TABLE IF NOT EXISTS api_versions (
      id TEXT PRIMARY KEY,
      api_id TEXT NOT NULL,
      version TEXT NOT NULL,
      openapi_spec_path TEXT NOT NULL,
      spec_sha TEXT NOT NULL,
      endpoints_count INTEGER DEFAULT 0,
      openapi_version TEXT,
      status TEXT DEFAULT 'Published',
      is_current BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(api_id, version),
      FOREIGN KEY (api_id) REFERENCES apis (id)
    );
  `);

  const apis = await many(db, 'SELECT id, openapi_spec_path FROM apis');
  const openapiDir = path.join(__dirname, '../openapi');

  for (const api of apis) {
    const count = await one<{ count: string }>(db, 'SELECT COUNT(*) as count FROM api_versions WHERE api_id = $1', [api.id]);
    if (Number(count?.count || 0) > 0 || !api.openapi_spec_path) continue;

    const specPath = path.join(__dirname, '..', api.openapi_spec_path);
    if (!fs.existsSync(specPath)) continue;

    const specText = fs.readFileSync(specPath, 'utf8');
    const metadata = parseSpecMetadata(specText);
    const versionId = `${api.id}-${slugifyVersion(metadata.version)}`;
    await run(db, `
      INSERT INTO api_versions (
        id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
        openapi_version, status, is_current, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (api_id, version) DO NOTHING
    `, [
      versionId,
      api.id,
      metadata.version,
      api.openapi_spec_path,
      getSpecSha(specText),
      metadata.endpointsCount,
      metadata.openapiVersion,
      'Published',
      true,
      'Backfilled from current catalog spec'
    ]);
  }

  if (!fs.existsSync(openapiDir)) {
    fs.mkdirSync(openapiDir, { recursive: true });
  }
}
