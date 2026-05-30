import type { DbClient } from './db';
import { getCurrentSpecForApi, parseStoredOpenApiSpec } from './openapi-store';
import { SANDBOX_FIXTURES } from './sandbox-fixtures';

type OpenApiSpec = {
  servers?: Array<{ url?: string }>;
  paths?: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
};

type SandboxOpenApiResponse =
  | { kind: 'response'; status: number; body: unknown }
  | { kind: 'error'; status: number; code: string; message: string };

const MAX_SCHEMA_EXAMPLE_DEPTH = 25;

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function requestPathname(originalUrl: string) {
  const pathname = normalizePathname(new URL(originalUrl, 'http://sandbox.local').pathname);
  const registeredSandboxMatch = /^\/api\/v1\/sandbox\/[^/]+(\/.*)?$/i.exec(pathname);
  return registeredSandboxMatch ? normalizePathname(registeredSandboxMatch[1] || '/') : pathname;
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

function schemaRefName(schema: any) {
  if (!schema?.$ref || typeof schema.$ref !== 'string') return null;
  const prefix = '#/components/schemas/';
  return schema.$ref.startsWith(prefix) ? schema.$ref.slice(prefix.length) : null;
}

function resolveSchema(spec: OpenApiSpec, schema: any, visitedRefs: Set<string>): any {
  const refName = schemaRefName(schema);
  if (!refName) return schema;
  if (visitedRefs.has(refName)) return undefined;
  visitedRefs.add(refName);
  return spec.components?.schemas?.[refName] || schema;
}

function schemaExample(spec: OpenApiSpec, schema: any, visitedRefs = new Set<string>(), depth = 0): unknown {
  if (depth > MAX_SCHEMA_EXAMPLE_DEPTH) return undefined;
  const nextVisitedRefs = new Set(visitedRefs);
  const resolved = resolveSchema(spec, schema, nextVisitedRefs);
  if (!resolved) return undefined;
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.type === 'array') return [schemaExample(spec, resolved.items, nextVisitedRefs, depth + 1)];
  if (resolved.type === 'object' || resolved.properties) {
    const entries = Object.entries(resolved.properties || {}).map(([name, childSchema]) => [
      name,
      schemaExample(spec, childSchema, nextVisitedRefs, depth + 1),
    ]);
    if (entries.some(([, value]) => value === undefined)) return undefined;
    return Object.fromEntries(
      entries,
    );
  }
  if (resolved.anyOf || resolved.oneOf) {
    return schemaExample(spec, (resolved.anyOf || resolved.oneOf)[0], nextVisitedRefs, depth + 1);
  }
  if (resolved.allOf) {
    const merged = Object.assign(
      {},
      ...resolved.allOf.map((childSchema: any) => schemaExample(spec, childSchema, nextVisitedRefs, depth + 1))
        .filter((value: unknown) => value && typeof value === 'object' && !Array.isArray(value)),
    );
    return Object.keys(merged).length ? merged : undefined;
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

function normalizedFixtureValue(value: string) {
  return value.trim().toLowerCase();
}

function fixtureSet(values: string[]) {
  return new Set(values.map(normalizedFixtureValue));
}

const sandboxFixtureRules = [
  {
    keys: ['nin', 'primarynin', 'relatednin', 'nationalidnumber'],
    allowed: fixtureSet([
      SANDBOX_FIXTURES.identity.activeNin,
      SANDBOX_FIXTURES.identity.noMatchNin,
      SANDBOX_FIXTURES.identity.expiredNin,
      SANDBOX_FIXTURES.identity.revokedNin,
      'CF01021234567Y',
    ]),
    code: 'NIN_NOT_FOUND',
    message: 'The provided NIN does not exist in the sandbox NIRA registry.',
    status: 404,
  },
  {
    keys: ['tin'],
    allowed: fixtureSet([
      SANDBOX_FIXTURES.tax.compliantTin,
      SANDBOX_FIXTURES.tax.nonCompliantTin,
    ]),
    code: 'TIN_NOT_FOUND',
    message: 'The provided TIN does not exist in the sandbox URA registry.',
    status: 404,
  },
  {
    keys: ['brn'],
    allowed: fixtureSet([
      SANDBOX_FIXTURES.business.activeBrn,
      SANDBOX_FIXTURES.business.dissolvedBrn,
      '80010001234567',
    ]),
    code: 'BRN_NOT_FOUND',
    message: 'The provided Business Registration Number does not exist.',
    status: 404,
  },
  {
    keys: ['permitnumber', 'permitno', 'drivingpermitnumber', 'permit'],
    allowed: fixtureSet([
      SANDBOX_FIXTURES.drivingPermit.activePermit,
      SANDBOX_FIXTURES.drivingPermit.suspendedPermit,
      SANDBOX_FIXTURES.drivingPermit.expiredPermit,
      'DP-UG-2026-001245',
    ]),
    code: 'PERMIT_NOT_FOUND',
    message: 'The provided driving permit number does not exist.',
    status: 404,
  },
  {
    keys: ['companynumber'],
    allowed: fixtureSet(['C-2024-001245']),
    code: 'COMPANY_NOT_FOUND',
    message: 'The provided company number does not exist in the sandbox URSB registry.',
    status: 404,
  },
  {
    keys: ['caseid'],
    allowed: fixtureSet(['case-2026-000145']),
    code: 'CASE_NOT_FOUND',
    message: 'The provided case ID does not exist in the sandbox workflow registry.',
    status: 404,
  },
  {
    keys: ['bundleid'],
    allowed: fixtureSet(['business-startup']),
    code: 'BUNDLE_NOT_FOUND',
    message: 'The provided service bundle does not exist in the sandbox registry.',
    status: 404,
  },
  {
    keys: ['servicecenter'],
    allowed: fixtureSet(['Kampala One Stop Centre']),
    code: 'SERVICE_CENTER_NOT_FOUND',
    message: 'The provided service center does not exist in the sandbox appointment registry.',
    status: 404,
  },
  {
    keys: ['givenname', 'given_name'],
    allowed: fixtureSet(['JOHN', 'SARAH']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided given name is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['surname'],
    allowed: fixtureSet(['DOE', 'NAKATO']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided surname is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['dateofbirth', 'date_of_birth'],
    allowed: fixtureSet(['1990-01-01', '1988-09-14']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided date of birth is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['districtofbirth'],
    allowed: fixtureSet(['Wakiso']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided district of birth is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['relationship'],
    allowed: fixtureSet(['DEPENDANT']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided relationship is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['servicecode'],
    allowed: fixtureSet(['BUSINESS_PSV_LICENCE']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided service code is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['requestedpsvclass'],
    allowed: fixtureSet(['OMNIBUS']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided PSV class is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['applicanttype'],
    allowed: fixtureSet(['COMPANY']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided applicant type is not one of the documented sandbox fixture values.',
    status: 400,
  },
  {
    keys: ['currency'],
    allowed: fixtureSet(['UGX']),
    code: 'INVALID_SANDBOX_INPUT',
    message: 'The provided currency is not one of the documented sandbox fixture values.',
    status: 400,
  },
];

function sandboxFixtureRuleForKey(key: string) {
  const normalizedKey = normalizedParamKey(key);
  return sandboxFixtureRules.find(rule => rule.keys.includes(normalizedKey));
}

function collectPrimitiveValues(value: unknown, values: Record<string, string> = {}) {
  if (Array.isArray(value)) {
    value.forEach(item => collectPrimitiveValues(item, values));
    return values;
  }
  if (!value || typeof value !== 'object') return values;

  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof childValue === 'string' || typeof childValue === 'number' || typeof childValue === 'boolean') {
      values[key] = String(childValue);
      continue;
    }
    collectPrimitiveValues(childValue, values);
  }
  return values;
}

function requestBodyExampleValues(operation: any) {
  const content = operation?.requestBody?.content || {};
  const media = content['application/json'] || content[Object.keys(content)[0]];
  if (media?.example === undefined) return {};
  return collectPrimitiveValues(media.example);
}

function fixtureValidationError(rule: (typeof sandboxFixtureRules)[number]): SandboxOpenApiResponse {
  return {
    kind: 'error',
    status: rule.status,
    code: rule.code,
    message: rule.message,
  };
}

function validateSandboxFixtureValues(values: Record<string, string>, expectedValues: Record<string, string>) {
  for (const [key, expectedValue] of Object.entries(expectedValues)) {
    const rule = sandboxFixtureRuleForKey(key);
    if (!rule) continue;
    const actualValue = requestValueForKey(key, values);
    if (actualValue === undefined || actualValue.trim() === '') {
      return {
        kind: 'error',
        status: 400,
        code: 'MISSING_SANDBOX_FIXTURE_VALUE',
        message: `The "${key}" field is required for this sandbox fixture.`,
      } satisfies SandboxOpenApiResponse;
    }
    if (!rule.allowed.has(normalizedFixtureValue(actualValue))) return fixtureValidationError(rule);
    if (!rule.allowed.has(normalizedFixtureValue(expectedValue))) return fixtureValidationError(rule);
  }

  for (const [key, value] of Object.entries(values)) {
    const rule = sandboxFixtureRuleForKey(key);
    if (!rule) continue;
    if (value.trim() === '' || !rule.allowed.has(normalizedFixtureValue(value))) {
      return fixtureValidationError(rule);
    }
  }
  return null;
}

function requestValues(originalUrl: string, pathParams: Record<string, string>, requestBody?: unknown) {
  const url = new URL(originalUrl, 'http://sandbox.local');
  const bodyValues = collectPrimitiveValues(requestBody);
  const queryValues = Object.fromEntries(url.searchParams.entries());
  return { ...bodyValues, ...queryValues, ...pathParams };
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

export function findSandboxOpenApiResponse(specInput: unknown, originalUrl: string, method: string, requestBody?: unknown): SandboxOpenApiResponse | null {
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
        if (example === null) return null;

        const values = requestValues(originalUrl, pathParams, requestBody);
        const validationError = validateSandboxFixtureValues(values, requestBodyExampleValues(operation));
        if (validationError) return validationError;

        return {
          kind: 'response',
          status: 200,
          body: hydrateExampleWithRequestValues(example, values),
        };
      }
    }
  }

  return null;
}

export function findSandboxOpenApiResponseExample(specInput: unknown, originalUrl: string, method: string, requestBody?: unknown): unknown | null {
  const response = findSandboxOpenApiResponse(specInput, originalUrl, method, requestBody);
  return response?.kind === 'response' ? response.body : null;
}

export async function findStoredSandboxOpenApiResponse(
  db: DbClient,
  apiId: string | null | undefined,
  originalUrl: string,
  method: string,
  requestBody?: unknown,
) {
  if (!apiId) return null;

  const storedSpec = await getCurrentSpecForApi(db, apiId);
  if (!storedSpec?.openapi_spec_text) return null;

  try {
    return findSandboxOpenApiResponse(
      parseStoredOpenApiSpec(storedSpec.openapi_spec_text),
      originalUrl,
      method,
      requestBody,
    );
  } catch (err) {
    console.error('[sandbox openapi response]', err);
    return null;
  }
}

export async function findStoredSandboxOpenApiResponseExample(
  db: DbClient,
  apiId: string | null | undefined,
  originalUrl: string,
  method: string,
  requestBody?: unknown,
) {
  const response = await findStoredSandboxOpenApiResponse(db, apiId, originalUrl, method, requestBody);
  return response?.kind === 'response' ? response.body : null;
}
