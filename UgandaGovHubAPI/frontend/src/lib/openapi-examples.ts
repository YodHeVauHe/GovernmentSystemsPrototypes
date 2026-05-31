const DEFAULT_MAX_DEPTH = 8;

export type OpenApiExampleOptions = {
  sampleValues?: Record<string, string>;
  stringFallback?: string;
  booleanFallback?: boolean;
  numberFallback?: number;
  integerFallback?: number;
  dateFallback?: string;
  dateTimeFallback?: string;
  maxDepth?: number;
};

function decodeJsonPointerSegment(segment: string) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function openApiRefName(ref: string) {
  return decodeJsonPointerSegment(ref.split('/').at(-1) || '');
}

export function resolveOpenApiRef(spec: any, ref?: string) {
  if (!ref?.startsWith('#/')) return null;
  return ref
    .slice(2)
    .split('/')
    .map(decodeJsonPointerSegment)
    .reduce((current: any, segment: string) => current?.[segment], spec);
}

export function resolveOpenApiSchema(schema: any, spec: any, visitedRefs = new Set<string>()) {
  if (!schema?.$ref || typeof schema.$ref !== 'string') return schema;
  if (visitedRefs.has(schema.$ref)) return undefined;
  visitedRefs.add(schema.$ref);
  return resolveOpenApiRef(spec, schema.$ref) || schema;
}

export function schemaLabel(schema: any): string {
  if (!schema) return 'any';
  if (schema.$ref && typeof schema.$ref === 'string') return openApiRefName(schema.$ref);
  if (schema.type === 'array') return `${schemaLabel(schema.items)}[]`;
  if (Array.isArray(schema.type)) return schema.type.join(' | ');
  return schema.type || schema.format || 'object';
}

export function schemaExample(
  schema: any,
  spec: any,
  name = 'value',
  options: OpenApiExampleOptions = {},
  visitedRefs = new Set<string>(),
  depth = 0,
): any {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (depth > maxDepth) return undefined;

  const nextVisitedRefs = new Set(visitedRefs);
  const resolved = resolveOpenApiSchema(schema, spec, nextVisitedRefs);
  if (!resolved) return undefined;

  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (options.sampleValues?.[name] !== undefined) return options.sampleValues[name];

  if (resolved.type === 'array') {
    const itemExample = schemaExample(resolved.items, spec, name, options, nextVisitedRefs, depth + 1);
    return itemExample === undefined ? [] : [itemExample];
  }

  if (resolved.type === 'object' || resolved.properties) {
    return Object.fromEntries(
      Object.entries(resolved.properties || {})
        .map(([propertyName, propertySchema]) => [
          propertyName,
          schemaExample(propertySchema, spec, propertyName, options, nextVisitedRefs, depth + 1),
        ])
        .filter(([, value]) => value !== undefined),
    );
  }

  if (resolved.anyOf || resolved.oneOf) {
    return schemaExample((resolved.anyOf || resolved.oneOf)[0], spec, name, options, nextVisitedRefs, depth + 1);
  }

  if (resolved.allOf) {
    const merged = Object.assign(
      {},
      ...resolved.allOf
        .map((childSchema: any) => schemaExample(childSchema, spec, name, options, nextVisitedRefs, depth + 1))
        .filter((value: unknown) => value && typeof value === 'object' && !Array.isArray(value)),
    );
    return Object.keys(merged).length ? merged : undefined;
  }

  if (resolved.type === 'boolean') return options.booleanFallback ?? true;
  if (resolved.type === 'integer') return options.integerFallback ?? options.numberFallback ?? 1;
  if (resolved.type === 'number') return options.numberFallback ?? 1;
  if (resolved.format === 'date') return options.dateFallback ?? '2026-05-22';
  if (resolved.format === 'date-time') return options.dateTimeFallback ?? '2026-05-22T00:00:00Z';
  if (resolved.type === 'string' || resolved.format) return options.stringFallback ?? 'string';
  return options.stringFallback ?? 'string';
}
