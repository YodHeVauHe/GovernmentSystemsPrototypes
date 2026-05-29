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

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function routePatternMatch(pattern: string, pathname: string) {
  let source = '';
  let lastIndex = 0;
  const paramNames: string[] = [];
  for (const match of pattern.matchAll(/\{([^}]+)\}/g)) {
    source += escapeRegExp(pattern.slice(lastIndex, match.index));
    source += '([^/]+)';
    paramNames.push(match[1]);
    lastIndex = (match.index || 0) + match[0].length;
  }
  source += escapeRegExp(pattern.slice(lastIndex));
  const result = new RegExp(`^${source}/?$`).exec(pathname);
  if (!result) return null;
  return Object.fromEntries(
    paramNames.map((name, index) => [name, decodePathSegment(result[index + 1])]),
  );
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

function normalizedParamKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function requestValues(originalUrl: string, pathParams: Record<string, string>) {
  const url = new URL(originalUrl, 'http://sandbox.local');
  const values = Object.fromEntries(url.searchParams.entries());
  return { ...values, ...pathParams };
}

function requestValueForKey(key: string, values: Record<string, string>) {
  if (values[key] !== undefined) return values[key];
  const normalizedKey = normalizedParamKey(key);
  return Object.entries(values).find(([requestKey]) => normalizedParamKey(requestKey) === normalizedKey)?.[1];
}

function coerceExampleValue(currentValue: unknown, nextValue: string) {
  if (typeof currentValue === 'number' && nextValue.trim() !== '' && !Number.isNaN(Number(nextValue))) {
    return Number(nextValue);
  }
  if (typeof currentValue === 'boolean') {
    if (nextValue === 'true') return true;
    if (nextValue === 'false') return false;
  }
  return nextValue;
}

function hydrateExampleWithRequestValues(example: unknown, values: Record<string, string>): unknown {
  const replacements = new Map<string, string>();

  function collectReplacements(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(collectReplacements);
      return;
    }
    if (!value || typeof value !== 'object') return;

    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      const requestValue = requestValueForKey(key, values);
      if (requestValue !== undefined && (typeof childValue === 'string' || typeof childValue === 'number')) {
        replacements.set(String(childValue), requestValue);
      }
      collectReplacements(childValue);
    }
  }

  function hydrate(value: unknown, key?: string): unknown {
    const requestValue = key ? requestValueForKey(key, values) : undefined;
    if (requestValue !== undefined && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
      return coerceExampleValue(value, requestValue);
    }
    if (typeof value === 'string') {
      return Array.from(replacements.entries()).reduce(
        (current, [from, to]) => current.split(from).join(to),
        value,
      );
    }
    if (Array.isArray(value)) return value.map(item => hydrate(item));
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        hydrate(childValue, childKey),
      ]),
    );
  }

  collectReplacements(example);
  return hydrate(example);
}

export function findSandboxOpenApiResponseExample(specInput: unknown, originalUrl: string, method: string): unknown | null {
  const spec = specInput as OpenApiSpec;
  if (!spec?.paths) return null;

  const pathname = requestPathname(originalUrl);
  const methodName = method.toLowerCase();

  for (const [operationPath, pathItem] of Object.entries(spec.paths)) {
    const operation = pathItem?.[methodName];
    if (!operation) continue;

    for (const serverBasePath of serverBasePaths(spec)) {
      for (const candidate of candidatePaths(serverBasePath, operationPath)) {
        const pathParams = routePatternMatch(candidate, pathname);
        if (!pathParams) continue;

        const example = responseExample(spec, operation);
        return example === null ? null : hydrateExampleWithRequestValues(example, requestValues(originalUrl, pathParams));
      }
    }
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
