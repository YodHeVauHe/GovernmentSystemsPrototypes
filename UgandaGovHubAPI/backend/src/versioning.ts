import crypto from 'crypto';
import yaml from 'js-yaml';
import type { DbClient } from './db';
import { exec, hasColumn, many, one, run } from './db';

type VersionStatusInput = {
  currentSha?: string;
  versionSha?: string;
};

export type ApiVersionStatus = 'current' | 'available';

const OPENAPI_HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function describeSpecPath(basePath: string, key: string | number) {
  return `${basePath}.${String(key)}`;
}

function assertAcyclicOpenApiValue(value: unknown) {
  const activeObjects = new WeakSet<object>();
  const completedObjects = new WeakSet<object>();

  function visit(node: unknown, path: string) {
    if (!node || typeof node !== 'object') return;
    if (activeObjects.has(node)) {
      throw new Error(`Invalid specification: circular YAML aliases are not allowed at "${path}".`);
    }
    if (completedObjects.has(node)) return;

    activeObjects.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, describeSpecPath(path, index)));
    } else {
      Object.entries(node).forEach(([key, item]) => visit(item, describeSpecPath(path, key)));
    }
    activeObjects.delete(node);
    completedObjects.add(node);
  }

  visit(value, 'spec');
}

function readRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid specification: "${fieldName}" must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalText(value: unknown, fieldName: string) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new Error(`Invalid specification: "${fieldName}" must be a string.`);
  }
  return value;
}

function hasValidOpenApiPathShape(route: string) {
  return route.startsWith('/') && !route.startsWith('//') && !/[\\\u0000-\u001F\u007F]/.test(route);
}

function validateOpenApiServerUrl(serverUrl: string) {
  if (serverUrl.trim().startsWith('//')) {
    throw new Error(`Invalid specification: server url "${serverUrl}" must not be protocol-relative.`);
  }
  if (/[\\\u0000-\u001F\u007F]/.test(serverUrl)) {
    throw new Error(`Invalid specification: server url "${serverUrl}" must not contain backslashes or control characters.`);
  }
}

function validateOpenApiServers(value: unknown) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    throw new Error('Invalid specification: "servers" must be an array.');
  }
  value.forEach((server, index) => {
    if (!isRecord(server)) {
      throw new Error(`Invalid specification: server "${index}" must be an object.`);
    }
    const serverUrl = readOptionalText(server.url, `servers.${index}.url`);
    if (serverUrl) validateOpenApiServerUrl(serverUrl);
  });
}

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
  const parsed = yaml.load(specText);
  if (!isRecord(parsed)) {
    throw new Error('Specification parsed to an invalid object.');
  }
  assertAcyclicOpenApiValue(parsed);
  const hasOpenApiVersion = Object.prototype.hasOwnProperty.call(parsed, 'openapi');
  const rawOpenApiVersion = hasOpenApiVersion ? parsed.openapi : parsed.swagger;
  if (rawOpenApiVersion === undefined || rawOpenApiVersion === null || rawOpenApiVersion === '') {
    throw new Error('Invalid specification: missing "openapi" or "swagger" version declaration.');
  }
  const openapiVersion = readRequiredText(rawOpenApiVersion, hasOpenApiVersion ? 'openapi' : 'swagger');
  const info = parsed.info;
  if (!isRecord(info)) {
    throw new Error('Invalid specification: "info" must be an object.');
  }
  const title = readRequiredText(info.title, 'info.title');
  const version = readRequiredText(info.version, 'info.version');
  if (!/[a-z0-9]/i.test(version)) {
    throw new Error('Invalid specification: "info.version" must contain at least one ASCII letter or number.');
  }
  const description = readOptionalText(info.description, 'info.description');
  validateOpenApiServers(parsed.servers);
  if (!Object.prototype.hasOwnProperty.call(parsed, 'paths')) {
    throw new Error('Invalid specification: missing "paths" object.');
  }
  const paths = parsed.paths;
  if (!isRecord(paths)) {
    throw new Error('Invalid specification: "paths" must be an object.');
  }
  const endpointsCount = Object.entries(paths).reduce((count, [route, pathItem]) => {
    if (!hasValidOpenApiPathShape(route)) {
      throw new Error(`Invalid specification: path "${route}" must start with a single "/" and cannot contain backslashes or control characters.`);
    }
    if (!isRecord(pathItem)) {
      throw new Error(`Invalid specification: path item "${route}" must be an object.`);
    }
    const methods = Object.entries(pathItem).filter(([method, operation]) => {
      if (!OPENAPI_HTTP_METHODS.has(method.toLowerCase())) return false;
      if (!isRecord(operation)) {
        throw new Error(`Invalid specification: operation "${method} ${route}" must be an object.`);
      }
      return true;
    });
    return count + methods.length;
  }, 0);

  return {
    parsed,
    metadata: {
      title,
      version,
      description,
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
      openapi_spec_text TEXT,
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

  if (!await hasColumn(db, 'api_versions', 'openapi_spec_text')) {
    await exec(db, 'ALTER TABLE api_versions ADD COLUMN openapi_spec_text TEXT');
  }

  const apis = await many(db, 'SELECT id, openapi_spec_path, openapi_spec_text FROM apis');

  for (const api of apis) {
    const count = await one<{ count: string }>(db, 'SELECT COUNT(*) as count FROM api_versions WHERE api_id = $1', [api.id]);
    if (Number(count?.count || 0) > 0 || !api.openapi_spec_path) continue;

    const specText = api.openapi_spec_text;
    if (!specText) continue;
    const metadata = parseSpecMetadata(specText);
    const versionId = `${api.id}-${slugifyVersion(metadata.version)}`;
    await run(db, `
      INSERT INTO api_versions (
        id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
        openapi_version, status, is_current, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (api_id, version) DO NOTHING
    `, [
      versionId,
      api.id,
      metadata.version,
      api.openapi_spec_path,
      specText,
      getSpecSha(specText),
      metadata.endpointsCount,
      metadata.openapiVersion,
      'Published',
      true,
      'Backfilled from current catalog spec'
    ]);
  }
}
