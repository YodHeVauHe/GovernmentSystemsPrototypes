import type { DbClient } from './db';
import { getCurrentSpecForApi, parseStoredOpenApiSpec } from './openapi-store';

type OpenApiSpec = {
  servers?: Array<{ url?: string }>;
  paths?: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
};

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function requestPathname(originalUrl: string) {
  return normalizePathname(new URL(originalUrl, 'http://sandbox.local').pathname);
}

function serverBasePaths(spec: OpenApiSpec) {
  const servers = spec.servers?.length ? spec.servers : [{ url: '' }];
  const paths = servers.map(server => {
    const url = String(server.url || '');
    if (!url) return '';
    try {
      return normalizePathname(new URL(url, 'http://sandbox.local').pathname);
    } catch {
      return '';
    }
  });
  return [...new Set(paths)];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePatternMatches(pattern: string, pathname: string) {
  let source = '';
  let lastIndex = 0;
  for (const match of pattern.matchAll(/\{([^}]+)\}/g)) {
    source += escapeRegExp(pattern.slice(lastIndex, match.index));
    source += '[^/]+';
    lastIndex = (match.index || 0) + match[0].length;
  }
  source += escapeRegExp(pattern.slice(lastIndex));
  return new RegExp(`^${source}/?$`).test(pathname);
}

function candidatePaths(serverBasePath: string, operationPath: string) {
  const normalizedOperationPath = normalizePathname(operationPath.startsWith('/') ? operationPath : `/${operationPath}`);
  const normalizedServerBasePath = normalizePathname(serverBasePath);
  if (!serverBasePath || normalizedServerBasePath === '/') return [normalizedOperationPath];
  return [
    normalizePathname(`${normalizedServerBasePath}${normalizedOperationPath}`),
    normalizedOperationPath,
  ];
}

function resolveSchema(spec: OpenApiSpec, schema: any): any {
  if (!schema?.$ref || typeof schema.$ref !== 'string') return schema;
  const prefix = '#/components/schemas/';
  if (!schema.$ref.startsWith(prefix)) return schema;
  return spec.components?.schemas?.[schema.$ref.slice(prefix.length)] || schema;
}

function schemaExample(spec: OpenApiSpec, schema: any): unknown {
  const resolved = resolveSchema(spec, schema);
  if (!resolved) return undefined;
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.type === 'array') return [schemaExample(spec, resolved.items)];
  if (resolved.type === 'object' || resolved.properties) {
    return Object.fromEntries(
      Object.entries(resolved.properties || {}).map(([name, childSchema]) => [
        name,
        schemaExample(spec, childSchema),
      ]),
    );
  }
  if (resolved.type === 'boolean') return true;
  if (resolved.type === 'integer' || resolved.type === 'number') return 1;
  if (resolved.format === 'date') return '2026-05-22';
  if (resolved.format === 'date-time') return '2026-05-22T00:00:00Z';
  if (resolved.type === 'string') return 'string';
  return undefined;
}

function responseExample(spec: OpenApiSpec, operation: any): unknown | null {
  const responses = operation?.responses || {};
  const successStatus = responses['200'] ? '200' : Object.keys(responses).find(status => status.startsWith('2'));
  const response = successStatus ? responses[successStatus] : null;
  const content = response?.content || {};
  const media = content['application/json'] || content[Object.keys(content)[0]];
  if (!media) return null;
  if (media.example !== undefined) return media.example;
  const firstExample = media.examples ? Object.values(media.examples)[0] as any : null;
  if (firstExample?.value !== undefined) return firstExample.value;
  if (firstExample !== null && firstExample !== undefined) return firstExample;
  const fromSchema = schemaExample(spec, media.schema);
  return fromSchema === undefined ? null : fromSchema;
}

export function findSandboxOpenApiResponseExample(specInput: unknown, originalUrl: string, method: string): unknown | null {
  const spec = specInput as OpenApiSpec;
  if (!spec?.paths) return null;

  const pathname = requestPathname(originalUrl);
  const methodName = method.toLowerCase();

  for (const [operationPath, pathItem] of Object.entries(spec.paths)) {
    const operation = pathItem?.[methodName];
    if (!operation) continue;

    const matches = serverBasePaths(spec).some(serverBasePath =>
      candidatePaths(serverBasePath, operationPath).some(candidate =>
        routePatternMatches(candidate, pathname),
      ),
    );
    if (!matches) continue;

    return responseExample(spec, operation);
  }

  return null;
}

export async function findStoredSandboxOpenApiResponseExample(
  db: DbClient,
  apiId: string | null | undefined,
  originalUrl: string,
  method: string,
) {
  if (!apiId) return null;

  const storedSpec = await getCurrentSpecForApi(db, apiId);
  if (!storedSpec?.openapi_spec_text) return null;

  try {
    return findSandboxOpenApiResponseExample(
      parseStoredOpenApiSpec(storedSpec.openapi_spec_text),
      originalUrl,
      method,
    );
  } catch (err) {
    console.error('[sandbox openapi response]', err);
    return null;
  }
}
