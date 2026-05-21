import type Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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
  const parsed = yaml.load(specText) as any;
  const paths = parsed?.paths || {};
  const endpointsCount = Object.keys(paths).reduce((count, route) => {
    const methods = Object.keys(paths[route] || {}).filter(method =>
      ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())
    );
    return count + methods.length;
  }, 0);

  return {
    version: parsed?.info?.version || '1.0.0',
    openapiVersion: parsed?.openapi || parsed?.swagger || 'unknown',
    endpointsCount,
  };
}

export function computeVersionStatus({ currentSha, versionSha }: VersionStatusInput): ApiVersionStatus {
  return currentSha && currentSha === versionSha ? 'current' : 'available';
}

export function ensureApiVersionSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_versions (
      id TEXT PRIMARY KEY,
      api_id TEXT NOT NULL,
      version TEXT NOT NULL,
      openapi_spec_path TEXT NOT NULL,
      spec_sha TEXT NOT NULL,
      endpoints_count INTEGER DEFAULT 0,
      openapi_version TEXT,
      status TEXT DEFAULT 'Published',
      is_current BOOLEAN DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(api_id, version),
      FOREIGN KEY (api_id) REFERENCES apis (id)
    );
  `);

  const apis = db.prepare('SELECT id, openapi_spec_path FROM apis').all() as any[];
  const openapiDir = path.join(__dirname, '../openapi');

  const insertVersion = db.prepare(`
    INSERT OR IGNORE INTO api_versions (
      id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
      openapi_version, status, is_current, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const api of apis) {
    const count = db.prepare('SELECT COUNT(*) as count FROM api_versions WHERE api_id = ?').get(api.id) as any;
    if (count.count > 0 || !api.openapi_spec_path) continue;

    const specPath = path.join(__dirname, '..', api.openapi_spec_path);
    if (!fs.existsSync(specPath)) continue;

    const specText = fs.readFileSync(specPath, 'utf8');
    const metadata = parseSpecMetadata(specText);
    const versionId = `${api.id}-${slugifyVersion(metadata.version)}`;
    insertVersion.run(
      versionId,
      api.id,
      metadata.version,
      api.openapi_spec_path,
      getSpecSha(specText),
      metadata.endpointsCount,
      metadata.openapiVersion,
      'Published',
      1,
      'Backfilled from current catalog spec'
    );
  }

  if (!fs.existsSync(openapiDir)) {
    fs.mkdirSync(openapiDir, { recursive: true });
  }
}
