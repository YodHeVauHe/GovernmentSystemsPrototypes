import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconDownload,
  IconEdit,
  IconLock,
  IconShieldCheck,
  IconWorld,
} from '@tabler/icons-react';
import { useUser } from '@/context/UserContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type DocsVisibility = 'public' | 'authenticated' | 'restricted';
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace';

type ApiDocsPayload = {
  id: string;
  name: string;
  description: string | null;
  lifecycle_status: string | null;
  sensitivity_level: string | null;
  security_classification: string | null;
  sandbox_available: number | boolean | null;
  docs_visibility: DocsVisibility;
  spec_url: string;
};

type OpenApiSpec = {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
    contact?: { name?: string; email?: string; url?: string };
  };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any>; securitySchemes?: Record<string, any> };
  security?: Array<Record<string, string[]>>;
};

type Operation = {
  id: string;
  path: string;
  method: HttpMethod;
  operation: any;
  tag: string;
};

const httpMethods = new Set<HttpMethod>(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

const methodStyles: Record<HttpMethod, string> = {
  get: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  post: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  put: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  patch: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
  delete: 'border-red-400/25 bg-red-400/10 text-red-300',
  options: 'border-zinc-400/25 bg-zinc-400/10 text-zinc-300',
  head: 'border-zinc-400/25 bg-zinc-400/10 text-zinc-300',
  trace: 'border-zinc-400/25 bg-zinc-400/10 text-zinc-300',
};

function visibilityLabel(value: DocsVisibility) {
  if (value === 'public') return 'Public docs';
  if (value === 'authenticated') return 'Approved users';
  return 'Restricted docs';
}

function docsAccessText(value: DocsVisibility) {
  if (value === 'public') return 'This documentation can be shared publicly. Access to production data may still require an approved API key.';
  if (value === 'authenticated') return 'This documentation is available to approved GovHub users. API calls still follow the access request and key approval process.';
  return 'This documentation is restricted to administrators, compliance reviewers, owning MDA API owners, and consumers with approved access.';
}

function parameterHelp(location: string) {
  if (location === 'path') return 'Path values identify the record in the URL. Replace every placeholder before calling the endpoint.';
  if (location === 'query') return 'Query values filter the result and are appended to the URL after a question mark.';
  if (location === 'header') return 'Header values carry API keys, correlation IDs, and content metadata outside the body.';
  return 'Check whether each value is required and whether it affects authorization, filtering, or audit trails.';
}

function responseHelp(status: string) {
  if (status.startsWith('2')) return 'Successful call. Validate the response, store only approved fields, and keep the correlation ID.';
  if (status === '400') return 'Bad request. Check required fields, formats, and JSON field names.';
  if (status === '401') return 'Authentication failed. Check API key header name, token value, expiry, and environment.';
  if (status === '403') return 'Access denied. Confirm the approved request covers this MDA, endpoint, and data scope.';
  if (status === '404') return 'No matching record or route. Confirm identifiers and path values.';
  if (status.startsWith('5')) return 'Provider-side failure. Retry only if your workflow allows it and include the correlation ID when escalating.';
  return 'Documented response for this operation.';
}

function responseStatusStyle(status: string) {
  if (status.startsWith('2')) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (status.startsWith('3')) return 'border-sky-400/25 bg-sky-400/10 text-sky-300';
  if (status === '401' || status === '403') return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  if (status.startsWith('4')) return 'border-red-400/30 bg-red-400/10 text-red-300';
  if (status.startsWith('5')) return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
  return 'border-zinc-400/25 bg-zinc-400/10 text-zinc-300';
}

function responseTone(status: string) {
  if (status.startsWith('2')) return 'Success response';
  if (status.startsWith('3')) return 'Redirect response';
  if (status === '401' || status === '403') return 'Access error';
  if (status.startsWith('4')) return 'Client error';
  if (status.startsWith('5')) return 'Provider error';
  return 'Response';
}

function requestBodyHelp(required: boolean) {
  return required
    ? 'This operation requires JSON. Include required fields and avoid unapproved personal data.'
    : 'This operation accepts JSON. Send optional fields only when your workflow needs them.';
}

function schemaHelp(name: string) {
  return `${name} defines a request or response object. Use it for validation, generated types, and data-minimization checks.`;
}

function docsAccessSummary(api: ApiDocsPayload) {
  return `${visibilityLabel(api.docs_visibility)}. ${docsAccessText(api.docs_visibility)} Sensitivity is ${api.sensitivity_level || 'not specified'} and classification is ${api.security_classification || 'not specified'}.`;
}

function guideAudience(api: ApiDocsPayload) {
  if (api.docs_visibility === 'public') {
    return 'For discovery and early technical review before formal access is requested.';
  }
  if (api.docs_visibility === 'authenticated') {
    return 'For approved GovHub users preparing an access request or integration.';
  }
  return 'For approved access groups working with sensitive MDA data.';
}

function accessRequirementGuide(api: ApiDocsPayload) {
  if (api.docs_visibility === 'restricted') {
    return 'Runtime use needs an approved request and active API key. API owners and reviewers can inspect the contract.';
  }
  return 'Viewing docs does not grant runtime access. Submit a request and use the issued API key.';
}

function operationGuide(item: Operation) {
  const action = item.method === 'get'
    ? 'retrieves information'
    : item.method === 'post'
      ? 'submits information for processing'
      : item.method === 'put' || item.method === 'patch'
        ? 'updates information'
        : item.method === 'delete'
          ? 'removes or revokes information'
          : 'performs an API action';
  return `This operation ${action} through ${item.path}. Map each input to your service data, then handle success and documented errors explicitly.`;
}

function operationUseCase(item: Operation) {
  if (item.method === 'get') {
    return 'Use for lookup, eligibility, or verification. This should not change provider data.';
  }
  if (item.method === 'post') {
    return 'Use when the provider must evaluate submitted data or create a result. Validate the JSON body first.';
  }
  if (item.method === 'put' || item.method === 'patch') {
    return 'Use only when your approval allows updates. Keep payloads narrow and audit the change.';
  }
  if (item.method === 'delete') {
    return 'Use only for approved revocation or removal workflows.';
  }
  return 'Use this operation only when the documented behavior matches your integration workflow and access approval.';
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function extractOperations(spec: OpenApiSpec | null): Operation[] {
  if (!spec?.paths) return [];
  const operations: Operation[] = [];
  Object.entries(spec.paths).forEach(([pathName, pathItem]) => {
    Object.entries(pathItem || {}).forEach(([methodName, operation]) => {
      const method = methodName.toLowerCase() as HttpMethod;
      if (!httpMethods.has(method)) return;
      const tag = operation?.tags?.[0] || 'Endpoints';
      operations.push({
        id: `${method}-${slug(pathName)}-${slug(operation?.operationId || operation?.summary || '')}`,
        path: pathName,
        method,
        operation,
        tag,
      });
    });
  });
  return operations;
}

function resolveRef(spec: OpenApiSpec, schema: any) {
  if (!schema?.$ref || typeof schema.$ref !== 'string') return schema;
  const prefix = '#/components/schemas/';
  if (!schema.$ref.startsWith(prefix)) return schema;
  return spec.components?.schemas?.[schema.$ref.slice(prefix.length)] || schema;
}

function schemaLabel(schema: any): string {
  if (!schema) return 'any';
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  if (schema.type === 'array') return `${schemaLabel(schema.items)}[]`;
  if (Array.isArray(schema.type)) return schema.type.join(' | ');
  return schema.type || schema.format || 'object';
}

function sampleValue(schema: any, spec: OpenApiSpec): any {
  const resolved = resolveRef(spec, schema);
  if (resolved?.example !== undefined) return resolved.example;
  if (resolved?.enum?.length) return resolved.enum[0];
  if (resolved?.type === 'array') return [sampleValue(resolved.items, spec)];
  if (resolved?.type === 'object' || resolved?.properties) {
    return Object.fromEntries(
      Object.entries(resolved.properties || {}).map(([key, value]) => [key, sampleValue(value, spec)]),
    );
  }
  if (resolved?.type === 'boolean') return true;
  if (resolved?.type === 'number' || resolved?.type === 'integer') return 1;
  if (resolved?.format === 'date') return '2026-05-22';
  if (resolved?.format === 'date-time') return '2026-05-22T00:00:00Z';
  return 'string';
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`inline-flex h-6 min-w-14 items-center justify-center rounded border px-2 text-[11px] font-bold uppercase ${methodStyles[method]}`}>
      {method}
    </span>
  );
}

function CodeBlock({ value }: { value: unknown }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-[380px] overflow-auto rounded-md border border-[#2e2e2e] bg-[#0f0f0f] p-4 text-[12px] leading-5 text-[#d8d8d8]">
      <code>{text}</code>
    </pre>
  );
}

function humanizeFieldName(name: string) {
  return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function fieldDescription(name: string, schema: any, required: boolean) {
  if (schema?.description) return schema.description;

  const label = humanizeFieldName(name);
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const type = schemaLabel(schema);
  const requirement = required ? ' Required for this request or response.' : '';

  if (schema?.enum?.length) {
    return `${label} must be one of: ${schema.enum.join(', ')}.${requirement}`;
  }

  if (normalized.includes('verified')) return `Shows whether ${label.replace(/ Verified$/i, '') || 'the submitted details'} passed verification.${requirement}`;
  if (normalized.includes('eligible')) return `Shows whether the record or applicant is eligible for the documented service.${requirement}`;
  if (normalized.includes('remarks') || normalized.includes('message')) return `Human-readable message explaining the result, warning, or next action.${requirement}`;
  if (normalized === 'status' || normalized.endsWith('status')) return `Current status value returned by the provider system.${requirement}`;
  if (normalized.includes('reason')) return `Explanation for the returned decision or status.${requirement}`;
  if (normalized.includes('permit')) return `Driving permit value used to identify or describe the permit record.${requirement}`;
  if (normalized.includes('nin')) return `National Identification Number value used to match the citizen record.${requirement}`;
  if (normalized.includes('tin')) return `Tax Identification Number value used to match the taxpayer record.${requirement}`;
  if (normalized.includes('brn')) return `Business Registration Number value used to match the company record.${requirement}`;
  if (normalized.includes('date') || normalized.includes('expiry') || normalized.includes('until')) return `Date or time value for ${label.toLowerCase()}.${requirement}`;
  if (normalized.includes('name') || normalized.includes('surname')) return `Name value used for matching, display, or verification.${requirement}`;
  if (normalized.includes('class')) return `Category or class assigned by the provider system.${requirement}`;
  if (schema?.type === 'boolean') return `True or false value for ${label.toLowerCase()}.${requirement}`;
  if (schema?.type === 'integer' || schema?.type === 'number') return `Numeric value for ${label.toLowerCase()}.${requirement}`;
  if (schema?.type === 'array') return `List of ${schemaLabel(schema.items).toLowerCase()} values for ${label.toLowerCase()}.${requirement}`;

  return `${label} value as a ${type} field.${requirement}`;
}

function SchemaViewer({ schema, spec, depth = 0 }: { schema: any; spec: OpenApiSpec; depth?: number }) {
  const resolved = resolveRef(spec, schema);
  const properties = resolved?.properties || {};
  const required = new Set<string>(resolved?.required || []);

  if (!resolved || (Object.keys(properties).length === 0 && !resolved.items)) {
    return <span className="font-mono text-[12px] text-[#b5b5b5]">{schemaLabel(resolved)}</span>;
  }

  if (resolved.type === 'array') {
    return (
      <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
        <div className="mb-2 text-[11px] font-mono uppercase text-[#8b8b8b]">Array item</div>
        <SchemaViewer schema={resolved.items} spec={spec} depth={depth + 1} />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#2e2e2e] bg-[#141414]">
      {Object.entries(properties).map(([name, child]) => (
        <div key={name} className="grid gap-3 border-b border-[#2e2e2e] p-3 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <div className="font-mono text-[12px] text-white">{name}</div>
            <div className="mt-1 text-[11px] text-[#8b8b8b]">
              {schemaLabel(child)}{required.has(name) ? ' · required' : ''}
            </div>
          </div>
          <div className="min-w-0 text-[12px] leading-5 text-[#b5b5b5]">
            <p className={depth < 2 && ((child as any)?.properties || (child as any)?.items || (child as any)?.$ref) ? 'mb-2' : ''}>
              {fieldDescription(name, child, required.has(name))}
            </p>
            {depth < 2 && ((child as any)?.properties || (child as any)?.items || (child as any)?.$ref) && (
              <SchemaViewer schema={child} spec={spec} depth={depth + 1} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaSchema({ content, spec }: { content: Record<string, any> | undefined; spec: OpenApiSpec }) {
  if (!content || Object.keys(content).length === 0) return null;
  const [mediaType, media] = Object.entries(content)[0];
  const firstExample = Object.values(media?.examples || {})[0] as { value?: unknown } | undefined;
  const example = media?.example ?? firstExample?.value ?? sampleValue(media?.schema, spec);
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-[#2e2e2e] bg-[#141414] px-2 py-1 font-mono text-[11px] text-[#b5b5b5]">{mediaType}</div>
      {media?.schema && <SchemaViewer schema={media.schema} spec={spec} />}
      <p className="text-[12.5px] leading-5 text-[#8b8b8b]">
        Example payloads show the shape a client can send or expect back. Replace placeholder values with approved data from your access request and MDA workflow.
      </p>
      <CodeBlock value={example} />
    </div>
  );
}

function OperationBlock({ item, spec }: { item: Operation; spec: OpenApiSpec }) {
  const parameters = item.operation?.parameters || [];
  const responses = item.operation?.responses || {};

  return (
    <section id={item.id} className="scroll-mt-4 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c]">
      <div className="border-b border-[#2e2e2e] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <MethodBadge method={item.method} />
          <code className="rounded-md bg-[#101010] px-2 py-1 text-[13px] text-[#ededed]">{item.path}</code>
        </div>
        <h2 className="mt-4 text-[18px] font-semibold text-white">{item.operation?.summary || item.operation?.operationId || item.path}</h2>
        <p className="mt-2 text-sm leading-6 text-[#b5b5b5]">{operationGuide(item)}</p>
        {item.operation?.description && <p className="mt-2 text-sm leading-6 text-[#8b8b8b]">{item.operation.description}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#b5b5b5]">When To Use It</h3>
            <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">{operationUseCase(item)}</p>
          </div>
          <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#b5b5b5]">Developer Checklist</h3>
            <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">
              Confirm the environment, send the required authentication header, include only approved data fields, log the correlation ID, and handle every documented error status in your client.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {parameters.length > 0 && (
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#b5b5b5]">Parameters</h3>
            <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">
              Values sent outside the JSON body. Decide where each value comes from, how it is validated, and whether it is approved for this use case.
            </p>
            <div className="overflow-hidden rounded-md border border-[#2e2e2e]">
              {parameters.map((param: any) => (
                <div key={`${param.in}-${param.name}`} className="grid gap-3 border-b border-[#2e2e2e] bg-[#141414] p-3 last:border-b-0 md:grid-cols-[180px_120px_1fr]">
                  <div className="font-mono text-[12px] text-white">{param.name}</div>
                  <div className="text-[12px] text-[#8b8b8b]">{param.in}{param.required ? ' · required' : ''}</div>
                  <div className="text-[12px] leading-5 text-[#b5b5b5]">
                    <span className="font-mono text-[#3ecf8e]">{schemaLabel(param.schema)}</span>
                    {param.description ? <span className="ml-2">{param.description}</span> : null}
                    <p className="mt-1 text-[#8b8b8b]">{parameterHelp(param.in)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.operation?.requestBody && (
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#b5b5b5]">Request Body</h3>
            <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">
              {requestBodyHelp(Boolean(item.operation.requestBody.required))}
            </p>
            <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">
              Build bodies from validated application data, not raw user input. Send only fields needed for the service question.
            </p>
            <MediaSchema content={item.operation.requestBody.content} spec={spec} />
          </div>
        )}

        <div>
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#b5b5b5]">Responses</h3>
          <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">
            Use these outcomes to design client messages, retries, support logs, and access-error handling.
          </p>
          <div className="space-y-3">
            {Object.entries(responses).map(([status, response]: [string, any]) => (
              <div key={status} className="rounded-md border border-[#2e2e2e] bg-[#141414] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className={`rounded-md border px-2 py-1 font-mono text-[12px] ${responseStatusStyle(status)}`}>{status}</span>
                  <span className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] px-2 py-1 text-[11px] uppercase tracking-wide text-[#8b8b8b]">{responseTone(status)}</span>
                  <span className="text-sm text-[#b5b5b5]">{response?.description || 'Response'}</span>
                </div>
                <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">{responseHelp(status)}</p>
                <MediaSchema content={response?.content} spec={spec} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ApiDocsPage() {
  const { apiId } = useParams();
  const { role } = useUser();
  const [api, setApi] = useState<ApiDocsPayload | null>(null);
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!apiId) return;
    setLoading(true);
    setError('');
    setCode('');

    fetch(`${API_BASE}/api/docs/${apiId}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setCode(body.code || '');
          throw new Error(body.error || 'Failed to load API documentation.');
        }
        setApi(body);
        const specResponse = await fetch(`${API_BASE}/api/docs/${apiId}/spec`);
        const specBody = await specResponse.json().catch(() => ({}));
        if (!specResponse.ok) throw new Error(specBody.error || 'Failed to load OpenAPI document.');
        setSpec(specBody);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiId]);

  const operations = useMemo(() => extractOperations(spec), [spec]);
  const groupedOperations = useMemo(() => {
    const groups = new Map<string, Operation[]>();
    operations.forEach(operation => groups.set(operation.tag, [...(groups.get(operation.tag) || []), operation]));
    return Array.from(groups.entries());
  }, [operations]);
  const canEditDocs = role === 'admin' || role === 'api_owner';

  if (loading) {
    return <div className="h-full bg-[#181818] p-6 text-sm text-[#8b8b8b]">Loading API documentation...</div>;
  }

  if (error) {
    const needsLogin = code === 'UNAUTHENTICATED';
    return (
      <div className="h-full overflow-auto bg-[#181818] text-[#ededed]">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5 p-4 lg:p-8">
          <Link to="/docs" className="inline-flex items-center gap-2 text-sm text-[#8b8b8b] hover:text-white">
            <IconArrowLeft className="size-4" />
            Back to API Docs
          </Link>
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-[#2e2e2e] bg-[#141414] p-8 text-center">
            <div className="mb-4 flex size-10 items-center justify-center rounded-md border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <IconLock className="size-5" />
            </div>
            <h1 className="text-xl font-semibold text-white">Documentation unavailable</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8b8b8b]">{error}</p>
            {needsLogin && (
              <Link to="/login" className="mt-5 inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-3 text-sm font-medium text-black hover:bg-[#3ecf8e]/90">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!api || !spec) {
    return <div className="h-full bg-[#181818] p-6 text-sm text-[#8b8b8b]">API documentation was not found.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] text-[#ededed]">
      <div className="shrink-0 border-b border-[#2e2e2e] bg-[#1c1c1c] px-4 py-4 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Link to="/docs" className="inline-flex items-center gap-2 text-sm text-[#8b8b8b] hover:text-white">
            <IconArrowLeft className="size-4" />
            Back to API Docs
          </Link>
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
            {canEditDocs && (
              <Link
                to={`/api/${api.id}`}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] px-3 text-sm font-medium text-[#ededed] hover:bg-[#242424]"
              >
                <IconEdit className="size-4 text-[#8b8b8b]" />
                Edit docs
              </Link>
            )}
            <a
              href={`${API_BASE}${api.spec_url}`}
              download
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] px-3 text-sm font-medium text-[#ededed] hover:bg-[#242424]"
            >
              <IconDownload className="size-4 text-[#8b8b8b]" />
              Download OpenAPI
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-[24px] font-semibold tracking-tight text-white">{api.name}</h1>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-medium text-[#b5b5b5]">
            {api.docs_visibility === 'public' ? (
              <IconWorld className="size-3.5 text-[#3ecf8e]" />
            ) : api.docs_visibility === 'authenticated' ? (
              <IconShieldCheck className="size-3.5 text-[#3ecf8e]" />
            ) : (
              <IconLock className="size-3.5 text-[#3ecf8e]" />
            )}
            {visibilityLabel(api.docs_visibility)}
          </span>
          <span className="inline-flex h-7 items-center rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-mono uppercase text-[#8b8b8b]">
            OpenAPI {spec.openapi || spec.swagger || 'unknown'}
          </span>
          {spec.info?.version && (
            <span className="inline-flex h-7 items-center rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-mono uppercase text-[#8b8b8b]">
              v{spec.info.version}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#8b8b8b]">{spec.info?.description || api.description}</p>
        <p className="mt-2 max-w-4xl text-[12.5px] leading-5 text-[#b5b5b5]">{docsAccessSummary(api)}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside className="hidden min-h-0 overflow-auto border-r border-[#2e2e2e] bg-[#141414] p-4 lg:block">
          <div className="mb-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Endpoints</div>
          <nav className="space-y-4">
            {groupedOperations.map(([tag, items]) => (
              <div key={tag}>
                <div className="mb-2 text-[12px] font-semibold text-white">{tag}</div>
                <div className="space-y-1">
                  {items.map(item => (
                    <a key={item.id} href={`#${item.id}`} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] text-[#8b8b8b] hover:bg-[#242424] hover:text-white">
                      <MethodBadge method={item.method} />
                      <span className="truncate font-mono">{item.path}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-h-0 overflow-auto">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-6 p-4 lg:p-8">
            <section className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
              <div className="mb-4">
                <h2 className="text-[18px] font-semibold text-white">API Guide</h2>
                <p className="mt-2 text-sm leading-6 text-[#8b8b8b]">
                  Start here to understand purpose, access, servers, endpoints, inputs, and responses. The OpenAPI contract is still the source of truth; this guide explains how to use it.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-4">
                  <h3 className="text-sm font-semibold text-white">Who This Is For</h3>
                  <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">{guideAudience(api)}</p>
                </div>
                <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-4">
                  <h3 className="text-sm font-semibold text-white">Access Requirements</h3>
                  <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">{accessRequirementGuide(api)}</p>
                </div>
                <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-4">
                  <h3 className="text-sm font-semibold text-white">Integration Flow</h3>
                  <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">
                    Review purpose, confirm fields, test sandbox if available, request access, configure the key, and log correlation IDs.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
                <h2 className="text-sm font-semibold text-white">Servers</h2>
                <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">
                  Use these base URLs for requests. Prefer sandbox while building and production only after approval.
                </p>
                <div className="mt-3 space-y-2">
                  {(spec.servers || []).map(server => (
                    <div key={server.url} className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
                      <code className="text-[12px] text-[#3ecf8e]">{server.url}</code>
                      {server.description && <p className="mt-1 text-[12px] text-[#8b8b8b]">{server.description}</p>}
                    </div>
                  ))}
                  {(!spec.servers || spec.servers.length === 0) && <p className="text-sm text-[#8b8b8b]">No servers declared.</p>}
                </div>
              </div>
              <div className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
                <h2 className="text-sm font-semibold text-white">Security</h2>
                <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">
                  Docs visibility controls who can read this page. API keys control who can call protected endpoints.
                </p>
                <div className="mt-3 space-y-2">
                  {Object.entries(spec.components?.securitySchemes || {}).map(([name, scheme]) => (
                    <div key={name} className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3 text-[12px] text-[#b5b5b5]">
                      <div className="font-mono text-white">{name}</div>
                      <div className="mt-1">{scheme.type}{scheme.in ? ` · ${scheme.in}` : ''}{scheme.name ? ` · ${scheme.name}` : ''}</div>
                    </div>
                  ))}
                  {Object.keys(spec.components?.securitySchemes || {}).length === 0 && <p className="text-sm text-[#8b8b8b]">No security schemes declared.</p>}
                </div>
              </div>
            </section>

            {operations.map(operation => <OperationBlock key={operation.id} item={operation} spec={spec} />)}

            {spec.components?.schemas && (
              <section className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-white">Schemas</h2>
                <div className="space-y-4">
                  {Object.entries(spec.components.schemas).map(([name, schema]) => (
                    <div key={name}>
                      <h3 className="mb-2 font-mono text-sm text-[#3ecf8e]">{name}</h3>
                      <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">{schemaHelp(name)}</p>
                      <SchemaViewer schema={schema} spec={spec} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
