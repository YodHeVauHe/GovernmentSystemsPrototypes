import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconBook2,
  IconBuildingBank,
  IconCopy,
  IconLock,
  IconSearch,
  IconShieldCheck,
  IconWorld,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { MdaLogo } from '@/components/MdaLogo';
import { getMdaShortName } from '@/lib/mdas';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type DocsVisibility = 'public' | 'authenticated' | 'restricted';

type DocsApi = {
  id: string;
  name: string;
  owning_mda_id: string;
  sector: string | null;
  description: string | null;
  lifecycle_status: string | null;
  sensitivity_level: string | null;
  security_classification: string | null;
  sandbox_available: number | boolean | null;
  required_approval_level: string | null;
  docs_visibility: DocsVisibility;
};

const visibilityMeta: Record<DocsVisibility, { label: string; icon: typeof IconWorld; text: string }> = {
  public: {
    label: 'Public docs',
    icon: IconWorld,
    text: 'Visible without sign-in',
  },
  authenticated: {
    label: 'Approved users',
    icon: IconShieldCheck,
    text: 'Visible to approved accounts',
  },
  restricted: {
    label: 'Restricted docs',
    icon: IconLock,
    text: 'Visible to assigned access groups',
  },
};

function VisibilityBadge({ value }: { value: DocsVisibility }) {
  const meta = visibilityMeta[value];
  const Icon = meta.icon;
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-medium text-[#b5b5b5]">
      <Icon className="size-3.5 text-[#3ecf8e]" />
      {meta.label}
    </span>
  );
}

function docsAccessText(value: DocsVisibility) {
  if (value === 'public') return 'Public visitors, approved users, MDA owners, reviewers, and administrators can open these docs.';
  if (value === 'authenticated') return 'Approved signed-in users can open these docs; anonymous visitors must sign in first.';
  return 'Only administrators, compliance reviewers, owning MDA API owners, and approved consuming MDAs can open these docs.';
}

function ShareUrl({ apiId }: { apiId: string }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/docs/${apiId}` : `/docs/${apiId}`;

  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    await navigator.clipboard.writeText(url);
    toast.success('Docs link copied');
  };

  return (
    <div className="mt-4 flex min-w-0 items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] p-1.5">
      <input readOnly value={url} className="min-w-0 flex-1 bg-transparent px-2 text-[12px] text-[#8b8b8b] outline-none" />
      <button type="button" onClick={copy} className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded bg-[#242424] px-2 text-[12px] text-white hover:bg-[#2e2e2e]">
        <IconCopy className="size-3.5" />
        Copy
      </button>
    </div>
  );
}

export function DocsPage() {
  const [apis, setApis] = useState<DocsApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/docs`)
      .then(async response => {
        const body = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(body.error || 'Failed to load API docs.');
        setApis(Array.isArray(body) ? body : []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredApis = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apis;
    return apis.filter(api => [
      api.name,
      api.sector,
      api.description,
      api.security_classification,
      api.sensitivity_level,
    ].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [apis, query]);

  return (
    <div className="h-full overflow-auto bg-[#181818] text-[#ededed]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-4 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-[#2e2e2e] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex h-8 items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] px-3 text-[12px] font-mono uppercase tracking-wider text-[#3ecf8e]">
              <IconBook2 className="size-4" />
              MDA API Documentation
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-white">API Docs</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8b8b8b]">
              Browse OpenAPI documentation for registered Ministries, Departments, and Agencies. Visibility is controlled per API.
            </p>
          </div>
          <div className="relative w-full max-w-[380px]">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b8b8b]" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search docs..."
              className="h-10 border-[#2e2e2e] bg-[#141414] pl-9 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(visibilityMeta).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <div key={key} className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon className="size-4 text-[#3ecf8e]" />
                  {meta.label}
                </div>
                <p className="mt-2 text-[12.5px] leading-5 text-[#8b8b8b]">{docsAccessText(key as DocsVisibility)}</p>
              </div>
            );
          })}
        </div>

        {loading && <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-5 text-sm text-[#8b8b8b]">Loading API docs...</div>}
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-200">{error}</div>}
        {!loading && !error && filteredApis.length === 0 && (
          <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-8 text-sm text-[#8b8b8b]">
            No API documentation is visible for the current profile.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredApis.map(api => (
            <Link
              key={api.id}
              to={`/docs/${api.id}`}
              className="group rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5 transition-colors hover:border-[#3ecf8e]/45 hover:bg-[#202020]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <MdaLogo mdaId={api.owning_mda_id} className="mt-1 size-11" />
                  <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <VisibilityBadge value={api.docs_visibility} />
                    {api.lifecycle_status && (
                      <span className="inline-flex h-7 items-center rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-mono uppercase text-[#8b8b8b]">
                        {api.lifecycle_status}
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-[17px] font-semibold text-white group-hover:text-[#3ecf8e]">{api.name}</h2>
                  <p className="mt-1 text-[12px] font-mono text-[#8b8b8b]">{getMdaShortName(api.owning_mda_id)} owner</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8b8b8b]">{api.description}</p>
                  </div>
                </div>
                <IconArrowRight className="mt-8 size-5 shrink-0 text-[#8b8b8b] transition-transform group-hover:translate-x-0.5 group-hover:text-[#3ecf8e]" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#2e2e2e] pt-4 text-[12px] text-[#8b8b8b]">
                <span className="inline-flex items-center gap-1.5">
                  <IconBuildingBank className="size-3.5 text-[#3ecf8e]" />
                  {api.sector || 'MDA API'}
                </span>
                <span>{api.security_classification || 'Unclassified'}</span>
                <span>{api.sensitivity_level || 'Unknown'} sensitivity</span>
              </div>
              <ShareUrl apiId={api.id} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
