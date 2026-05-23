import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBook2,
  IconBuildingBank,
  IconCar,
  IconCertificate,
  IconCashBanknote,
  IconGridDots,
  IconHeartbeat,
  IconId,
  IconList,
  IconLock,
  IconNetwork,
  IconSearch,
  IconShieldCheck,
  IconShoppingCart,
  IconWorld,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

function SectorBadge({ sector }: { sector: string | null }) {
  const value = sector || 'MDA API';
  const normalized = value.toLowerCase();
  const Icon =
    normalized.includes('identity') ? IconId :
    normalized.includes('transport') ? IconCar :
    normalized.includes('finance') || normalized.includes('tax') ? IconCashBanknote :
    normalized.includes('commerce') || normalized.includes('business') ? IconCertificate :
    normalized.includes('health') ? IconHeartbeat :
    normalized.includes('procurement') ? IconShoppingCart :
    normalized.includes('integration') ? IconNetwork :
    IconBuildingBank;

  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-medium text-[#b5b5b5]">
      <Icon className="size-3.5 text-[#3ecf8e]" />
      {value}
    </span>
  );
}

function MetadataTag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'low' | 'medium' | 'high' }) {
  const toneClass = {
    neutral: 'border-[#2e2e2e] bg-[#141414] text-[#b5b5b5]',
    low: 'border-[#3ecf8e]/25 bg-[#3ecf8e]/5 text-[#3ecf8e]',
    medium: 'border-amber-400/25 bg-amber-400/5 text-amber-300',
    high: 'border-red-400/25 bg-red-400/5 text-red-300',
  }[tone];

  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function LifecycleBadge({ value }: { value: string | null }) {
  const lifecycle = value || 'Draft';
  const toneClass =
    lifecycle === 'Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' :
    lifecycle === 'Beta' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
    'text-orange-400 border-orange-400/20 bg-orange-400/5';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono uppercase ${toneClass}`}>
      {lifecycle}
    </span>
  );
}

function sensitivityTone(value?: string | null): 'low' | 'medium' | 'high' {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('medium')) return 'medium';
  return 'low';
}

function docsAccessText(value: DocsVisibility) {
  if (value === 'public') return 'Public visitors, approved users, MDA owners, reviewers, and administrators can open these docs.';
  if (value === 'authenticated') return 'Approved signed-in users can open these docs; anonymous visitors must sign in first.';
  return 'Only administrators, compliance reviewers, owning MDA API owners, and approved consuming MDAs can open these docs.';
}

export function DocsPage() {
  const [apis, setApis] = useState<DocsApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
    <div className="h-full overflow-hidden bg-[#181818] text-[#ededed]">
      <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col gap-6 p-4 lg:p-8">
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
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px] lg:w-[380px]">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b8b8b]" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search docs..."
                className="h-10 border-[#2e2e2e] bg-[#141414] pl-9 text-sm"
              />
            </div>
            <div className="flex w-fit items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#141414] p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-[6px] p-1.5 transition-all ${viewMode === 'grid' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
                aria-label="Grid view"
              >
                <IconGridDots className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-[6px] p-1.5 transition-all ${viewMode === 'list' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
                aria-label="List view"
              >
                <IconList className="size-4" />
              </button>
            </div>
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

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!loading && !error && filteredApis.length > 0 && viewMode === 'list' ? (
            <div className="overflow-hidden rounded-lg border border-[#2e2e2e] bg-[#1c1c1c]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="border-b border-[#2e2e2e] bg-[#141414] hover:bg-transparent">
                      <TableHead className="h-10 min-w-[280px] px-4 text-[11px] font-mono uppercase tracking-widest text-[#8b8b8b]">API Name</TableHead>
                      <TableHead className="h-10 min-w-[170px] px-4 text-[11px] font-mono uppercase tracking-widest text-[#8b8b8b]">Visibility</TableHead>
                      <TableHead className="h-10 min-w-[150px] px-4 text-[11px] font-mono uppercase tracking-widest text-[#8b8b8b]">Sector</TableHead>
                      <TableHead className="h-10 min-w-[150px] px-4 text-[11px] font-mono uppercase tracking-widest text-[#8b8b8b]">Classification</TableHead>
                      <TableHead className="h-10 min-w-[150px] px-4 text-[11px] font-mono uppercase tracking-widest text-[#8b8b8b]">Sensitivity</TableHead>
                      <TableHead className="h-10 min-w-[130px] px-4 text-[11px] font-mono uppercase tracking-widest text-[#8b8b8b]">Lifecycle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApis.map(api => (
                      <TableRow key={api.id} className="border-b border-[#2e2e2e] transition-colors last:border-b-0 hover:bg-[#2e2e2e]/30">
                        <TableCell className="px-4 py-3.5 text-left">
                          <Link to={`/docs/${api.id}`} className="block text-[14px] font-semibold text-[#ededed] transition-colors hover:text-[#3ecf8e]">
                            {api.name}
                          </Link>
                          <p className="mt-0.5 max-w-[360px] truncate text-[12px] text-[#8b8b8b]">{api.description}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <VisibilityBadge value={api.docs_visibility} />
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <SectorBadge sector={api.sector} />
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <MetadataTag>{api.security_classification || 'Unclassified'}</MetadataTag>
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <MetadataTag tone={sensitivityTone(api.sensitivity_level)}>
                            {api.sensitivity_level || 'Unknown'} sensitivity
                          </MetadataTag>
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <LifecycleBadge value={api.lifecycle_status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {!loading && !error && filteredApis.map(api => (
                <Link
                  key={api.id}
                  to={`/docs/${api.id}`}
                  className="group flex min-h-[210px] flex-col rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5 transition-colors hover:border-[#3ecf8e]/45 hover:bg-[#202020]"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <VisibilityBadge value={api.docs_visibility} />
                      <LifecycleBadge value={api.lifecycle_status} />
                    </div>
                    <h2 className="truncate text-[17px] font-semibold text-white group-hover:text-[#3ecf8e]">{api.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8b8b8b]">{api.description}</p>
                  </div>
                  <div className="mt-auto border-t border-[#2e2e2e] pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SectorBadge sector={api.sector} />
                      <MetadataTag>{api.security_classification || 'Unclassified'}</MetadataTag>
                      <MetadataTag tone={sensitivityTone(api.sensitivity_level)}>
                        {api.sensitivity_level || 'Unknown'} sensitivity
                      </MetadataTag>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
