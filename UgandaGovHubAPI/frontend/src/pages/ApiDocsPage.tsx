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
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/context/UserContext';
import { API_BASE } from '@/lib/api-base';
import {
  accessRequirementGuide,
  docsAccessSummary,
  extractOperations,
  guideAudience,
  MethodBadge,
  OperationBlock,
  SchemaViewer,
  schemaHelp,
  visibilityLabel,
  type ApiDocsPayload,
  type OpenApiSpec,
  type Operation,
} from './api-docs/api-docs-openapi';

function ApiDocsLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] text-[#ededed]">
      <div className="shrink-0 border-b border-[#2e2e2e] bg-[#1c1c1c] px-3 py-3 lg:px-5">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Skeleton className="h-5 w-36 bg-[#242424]" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 bg-[#242424]" />
            <Skeleton className="h-10 w-36 bg-[#242424]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-80 max-w-full bg-[#2e2e2e]" />
          <Skeleton className="h-7 w-28 bg-[#242424]" />
          <Skeleton className="h-7 w-32 bg-[#242424]" />
          <Skeleton className="h-7 w-16 bg-[#242424]" />
        </div>
        <Skeleton className="mt-3 h-4 w-[720px] max-w-full bg-[#242424]" />
        <Skeleton className="mt-2 h-4 w-[560px] max-w-full bg-[#242424]" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside className="hidden min-h-0 overflow-auto border-r border-[#2e2e2e] bg-[#141414] p-4 lg:block">
          <Skeleton className="mb-5 h-3 w-24 bg-[#242424]" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="mb-5 space-y-2">
              <Skeleton className="h-4 w-32 bg-[#2e2e2e]" />
              <Skeleton className="h-8 w-full bg-[#242424]" />
              <Skeleton className="h-8 w-5/6 bg-[#242424]" />
            </div>
          ))}
        </aside>
        <main className="min-h-0 overflow-auto p-3 lg:p-5">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c]" />
            ))}
          </div>
        </main>
      </div>
    </div>
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
    return <ApiDocsLoadingState />;
  }

  if (error) {
    const needsLogin = code === 'UNAUTHENTICATED';
    return (
      <div className="h-full overflow-auto bg-[#181818] text-[#ededed]">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 p-3 lg:p-5">
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
    return <div className="h-full bg-[#181818] p-5 text-sm text-[#8b8b8b]">API documentation was not found.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] text-[#ededed]">
      <div className="shrink-0 border-b border-[#2e2e2e] bg-[#1c1c1c] px-3 py-3 lg:px-5">
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
          <span className="inline-flex h-7 items-center rounded-md border border-[#2e2e2e] bg-[#141414] px-2 font-mono text-[11px] uppercase text-[#8b8b8b]">
            OpenAPI {spec.openapi || spec.swagger || 'unknown'}
          </span>
          {spec.info?.version && (
            <span className="inline-flex h-7 items-center rounded-md border border-[#2e2e2e] bg-[#141414] px-2 font-mono text-[11px] uppercase text-[#8b8b8b]">
              v{spec.info.version}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#8b8b8b]">{spec.info?.description || api.description}</p>
        <p className="mt-2 max-w-4xl text-[12.5px] leading-5 text-[#b5b5b5]">{docsAccessSummary(api)}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <ApiDocsNav groupedOperations={groupedOperations} />
        <ApiDocsContent api={api} spec={spec} operations={operations} />
      </div>
    </div>
  );
}

function ApiDocsNav({ groupedOperations }: { groupedOperations: Array<[string, Operation[]]> }) {
  return (
    <aside className="hidden min-h-0 overflow-auto border-r border-[#2e2e2e] bg-[#141414] p-4 lg:block">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wider text-[#8b8b8b]">Endpoints</div>
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
  );
}

function ApiDocsContent({ api, spec, operations }: { api: ApiDocsPayload; spec: OpenApiSpec; operations: Operation[] }) {
  return (
    <main className="min-h-0 overflow-auto">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-3 lg:p-5">
        <section className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
          <div className="mb-4">
            <h2 className="text-[18px] font-semibold text-white">API Guide</h2>
            <p className="mt-2 text-sm leading-6 text-[#8b8b8b]">
              Start here to understand purpose, access, servers, endpoints, inputs, and responses. The OpenAPI contract is still the source of truth; this guide explains how to use it.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <GuideCard title="Who This Is For">{guideAudience(api)}</GuideCard>
            <GuideCard title="Access Requirements">{accessRequirementGuide(api)}</GuideCard>
            <GuideCard title="Integration Flow">
              Review purpose, confirm fields, test sandbox if available, request access, configure the key, and log correlation IDs.
            </GuideCard>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <ServersPanel spec={spec} />
          <SecurityPanel spec={spec} />
        </section>

        {operations.map(operation => <OperationBlock key={operation.id} item={operation} spec={spec} />)}
        {spec.components?.schemas && <SchemasPanel spec={spec} />}
      </div>
    </main>
  );
}

function GuideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">{children}</p>
    </div>
  );
}

function ServersPanel({ spec }: { spec: OpenApiSpec }) {
  return (
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
  );
}

function SecurityPanel({ spec }: { spec: OpenApiSpec }) {
  const schemes = Object.entries(spec.components?.securitySchemes || {});
  return (
    <div className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
      <h2 className="text-sm font-semibold text-white">Security</h2>
      <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">
        Docs visibility controls who can read this page. API keys control who can call protected endpoints.
      </p>
      <div className="mt-3 space-y-2">
        {schemes.map(([name, scheme]) => (
          <div key={name} className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3 text-[12px] text-[#b5b5b5]">
            <div className="font-mono text-white">{name}</div>
            <div className="mt-1">{scheme.type}{scheme.in ? ` - ${scheme.in}` : ''}{scheme.name ? ` - ${scheme.name}` : ''}</div>
          </div>
        ))}
        {schemes.length === 0 && <p className="text-sm text-[#8b8b8b]">No security schemes declared.</p>}
      </div>
    </div>
  );
}

function SchemasPanel({ spec }: { spec: OpenApiSpec }) {
  return (
    <section className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
      <h2 className="mb-4 text-[18px] font-semibold text-white">Schemas</h2>
      <div className="space-y-4">
        {Object.entries(spec.components?.schemas || {}).map(([name, schema]) => (
          <div key={name}>
            <h3 className="mb-2 font-mono text-sm text-[#3ecf8e]">{name}</h3>
            <p className="mb-3 text-[12.5px] leading-5 text-[#8b8b8b]">{schemaHelp(name)}</p>
            <SchemaViewer schema={schema} spec={spec} />
          </div>
        ))}
      </div>
    </section>
  );
}
