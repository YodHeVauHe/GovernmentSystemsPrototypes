import { CodeSamples } from '@/components/CodeSamples';
import { API_BASE } from '@/lib/api-base';
import { formatHttpStatusLabel, isSuccessStatus } from '@/lib/http-status';
import { resolveOpenApiSchema, schemaExample, schemaLabel } from '@/lib/openapi-examples';

export type DocsVisibility = 'public' | 'authenticated' | 'restricted';
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace';

export type ApiDocsPayload = {
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

export type OpenApiSpec = {
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

export type Operation = {
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

export function visibilityLabel(value: DocsVisibility) {
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

export function schemaHelp(name: string) {
  return `${name} defines a request or response object. Use it for validation, generated types, and data-minimization checks.`;
}

export function docsAccessSummary(api: ApiDocsPayload) {
  return `${visibilityLabel(api.docs_visibility)}. ${docsAccessText(api.docs_visibility)} Sensitivity is ${api.sensitivity_level || 'not specified'} and classification is ${api.security_classification || 'not specified'}.`;
}

export function guideAudience(api: ApiDocsPayload) {
  if (api.docs_visibility === 'public') {
    return 'For discovery and early technical review before formal access is requested.';
  }
  if (api.docs_visibility === 'authenticated') {
    return 'For approved GovHub users preparing an access request or integration.';
  }
  return 'For approved access groups working with sensitive MDA data.';
}

export function accessRequirementGuide(api: ApiDocsPayload) {
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
  if (item.method === 'get') return 'Use for lookup, eligibility, or verification. This should not change provider data.';
  if (item.method === 'post') return 'Use when the provider must evaluate submitted data or create a result. Validate the JSON body first.';
  if (item.method === 'put' || item.method === 'patch') return 'Use only when your approval allows updates. Keep payloads narrow and audit the change.';
  if (item.method === 'delete') return 'Use only for approved revocation or removal workflows.';
  return 'Use this operation only when the documented behavior matches your integration workflow and access approval.';
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function extractOperations(spec: OpenApiSpec | null): Operation[] {
  if (!spec?.paths) return [];
  const operations: Operation[] = [];
  Object.entries(spec.paths).forEach(([pathName, pathItem]) => {
    const pathParameters = Array.isArray(pathItem?.parameters) ? pathItem.parameters : [];
    Object.entries(pathItem || {}).forEach(([methodName, operation]) => {
      const method = methodName.toLowerCase() as HttpMethod;
      if (!httpMethods.has(method)) return;
      const operationParameters = Array.isArray(operation?.parameters) ? operation.parameters : [];
      const tag = operation?.tags?.[0] || 'Endpoints';
      operations.push({
        id: `${method}-${slug(pathName)}-${slug(operation?.operationId || operation?.summary || '')}`,
        path: pathName,
        method,
        operation: {
          ...operation,
          parameters: [...pathParameters, ...operationParameters],
        },
        tag,
      });
    });
  });
  return operations;
}

function requestBodyExample(operation: any, spec: OpenApiSpec) {
  const content = operation?.requestBody?.content || {};
  const media = content['application/json'] || Object.values(content)[0] as any;
  const firstExample = media?.examples ? Object.values(media.examples)[0] as any : null;
  return media?.example ?? firstExample?.value ?? schemaExample(media?.schema, spec);
}

function sampleParameterValue(parameter: any, spec: OpenApiSpec) {
  if (parameter?.example !== undefined) return parameter.example;
  const firstExample = parameter?.examples ? Object.values(parameter.examples)[0] as any : null;
  if (firstExample?.value !== undefined) return firstExample.value;
  return schemaExample(parameter?.schema, spec);
}

function operationSampleUrl(item: Operation, spec: OpenApiSpec) {
  const serverUrl = spec.servers?.[0]?.url || '/api/v1';
  const path = item.path.replace(/{([^}]+)}/g, (_match, name) => {
    const parameter = item.operation?.parameters?.find((param: any) => param.in === 'path' && param.name === name);
    return encodeURIComponent(String(sampleParameterValue(parameter, spec)));
  });
  try {
    const basePath = serverUrl.startsWith('http') ? new URL(serverUrl).pathname : serverUrl;
    return new URL(`${basePath.replace(/\/$/, '')}${path}`, API_BASE).toString();
  } catch {
    return new URL(path, API_BASE).toString();
  }
}

export function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`inline-flex h-6 min-w-14 items-center justify-center rounded border px-2 text-[11px] font-bold uppercase ${methodStyles[method]}`}>
      {method}
    </span>
  );
}

function CodeBlock({ value, tone = 'neutral' }: { value: unknown; tone?: 'neutral' | 'success' | 'error' }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const toneClassName = tone === 'success'
    ? 'text-emerald-300'
    : tone === 'error'
      ? 'text-red-300'
      : 'text-[#d8d8d8]';
  return (
    <pre className={`max-h-[380px] overflow-auto rounded-md border border-[#2e2e2e] bg-[#0f0f0f] p-4 text-[12px] leading-5 ${toneClassName}`}>
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

  if (schema?.enum?.length) return `${label} must be one of: ${schema.enum.join(', ')}.${requirement}`;
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

export function SchemaViewer({ schema, spec, depth = 0 }: { schema: any; spec: OpenApiSpec; depth?: number }) {
  const resolved = resolveOpenApiSchema(schema, spec);
  const properties = resolved?.properties || {};
  const required = new Set<string>(resolved?.required || []);

  if (!resolved || (Object.keys(properties).length === 0 && !resolved.items)) {
    return <span className="font-mono text-[12px] text-[#b5b5b5]">{schemaLabel(resolved)}</span>;
  }

  if (resolved.type === 'array') {
    return (
      <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
        <div className="mb-2 font-mono text-[11px] uppercase text-[#8b8b8b]">Array item</div>
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
              {schemaLabel(child)}{required.has(name) ? ' - required' : ''}
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

function MediaSchema({ content, spec, status }: { content: Record<string, any> | undefined; spec: OpenApiSpec; status?: string }) {
  if (!content || Object.keys(content).length === 0) return null;
  const [mediaType, media] = Object.entries(content)[0];
  const firstExample = Object.values(media?.examples || {})[0] as { value?: unknown } | undefined;
  const example = media?.example ?? firstExample?.value ?? schemaExample(media?.schema, spec);
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-[#2e2e2e] bg-[#141414] px-2 py-1 font-mono text-[11px] text-[#b5b5b5]">{mediaType}</div>
      {media?.schema && <SchemaViewer schema={media.schema} spec={spec} />}
      <p className="text-[12.5px] leading-5 text-[#8b8b8b]">
        Example payloads show the shape a client can send or expect back. Replace placeholder values with approved data from your access request and MDA workflow.
      </p>
      <CodeBlock value={example} tone={status ? isSuccessStatus(status) ? 'success' : 'error' : 'neutral'} />
    </div>
  );
}

export function OperationBlock({ item, spec }: { item: Operation; spec: OpenApiSpec }) {
  const parameters = item.operation?.parameters || [];
  const responses = item.operation?.responses || {};
  const hasRequestBody = Boolean(item.operation?.requestBody);

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
                  <div className="text-[12px] text-[#8b8b8b]">{param.in}{param.required ? ' - required' : ''}</div>
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
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#b5b5b5]">Generated Integration Samples</h3>
          <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">
            Use these as starting points after access approval. Replace path placeholders and sample payloads with approved workflow values.
          </p>
          <CodeSamples
            input={{
              method: item.method,
              url: operationSampleUrl(item, spec),
              body: hasRequestBody ? requestBodyExample(item.operation, spec) : undefined,
            }}
          />
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#b5b5b5]">Responses</h3>
          <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">
            Use these outcomes to design client messages, retries, support logs, and access-error handling.
          </p>
          <div className="space-y-3">
            {Object.entries(responses).map(([status, response]: [string, any]) => (
              <div key={status} className="rounded-md border border-[#2e2e2e] bg-[#141414] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className={`rounded-md border px-2 py-1 font-mono text-[12px] ${responseStatusStyle(status)}`}>{formatHttpStatusLabel(status)}</span>
                  <span className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] px-2 py-1 text-[11px] uppercase tracking-wide text-[#8b8b8b]">{responseTone(status)}</span>
                  <span className="text-sm text-[#b5b5b5]">{response?.description || 'Response'}</span>
                </div>
                <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">{responseHelp(status)}</p>
                <MediaSchema content={response?.content} spec={spec} status={status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
