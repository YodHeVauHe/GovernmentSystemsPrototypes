import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconGridDots, IconList, IconPlus, IconSearch } from '@tabler/icons-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_BASE } from '@/lib/api-base';
import { useUser } from '../../context/UserContext';
import { SectorBadge, sensitivityBadgeClass, useCatalogViewModePreference } from './catalog-shared';

export function Catalog() {
  const { role } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apis, setApis] = useState<any[]>([]);
  const search = searchParams.get('q') || '';
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [complianceFilter, setComplianceFilter] = useState('ALL');
  const [viewMode, setViewMode] = useCatalogViewModePreference();
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    setLoadingCatalog(true);
    setCatalogError('');
    fetch(`${API_BASE}/api/catalog`)
      .then(res => res.json())
      .then(data => setApis(data))
      .catch(err => {
        console.error(err);
        setCatalogError('Failed to load API catalog.');
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const updateSearch = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set('q', value);
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams);
  };

  const filteredApis = apis.filter(api => {
    const matchesSearch = api.name.toLowerCase().includes(search.toLowerCase()) ||
                          api.sector.toLowerCase().includes(search.toLowerCase()) ||
                          api.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || api.lifecycle_status.toUpperCase() === statusFilter;
    const matchesCompliance = complianceFilter === 'ALL' || (api.compliance_status || 'Draft') === complianceFilter;
    return matchesSearch && matchesStatus && matchesCompliance;
  });

  return (
    <div className="h-full overflow-hidden">
      <div className="w-full h-full p-3 lg:p-5 max-w-[1200px] mx-auto text-[#ededed] flex min-h-0 flex-col">
      {/* Header Info */}
      <div className="shrink-0 text-left mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight mb-2 text-white">Interoperability Catalog</h1>
        <p className="text-[14px] text-[#8b8b8b] max-w-2xl">
          Discover, test, and request lawful access to secure data sharing APIs owned by Ugandan Ministries, Departments, and Agencies (MDAs).
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[280px]">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8b8b] w-[18px] h-[18px]" />
            <Input
              value={search}
              onChange={e => updateSearch(e.target.value)}
              placeholder="Search by name, sector, agency..."
              className="h-[36px] pl-9 bg-[#1c1c1c] border-[#2e2e2e] text-[13px] text-white focus:border-[#444] rounded-[6px]"
            />
          </div>

            <select
            aria-label="Lifecycle filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-[36px] px-3 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[13px] text-[#ededed] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Lifecycles</option>
            <option value="PRODUCTION">Production</option>
            <option value="BETA">Beta</option>
            <option value="DRAFT">Draft</option>
          </select>
          <select
            aria-label="Compliance filter"
            value={complianceFilter}
            onChange={e => setComplianceFilter(e.target.value)}
            className="h-[36px] px-3 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[13px] text-[#ededed] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Compliance</option>
            <option value="Approved for Production">Approved for Prod</option>
            <option value="Approved for Sandbox">Approved for Sandbox</option>
            <option value="Under Review">Under Review</option>
            <option value="Draft">Draft</option>
          </select>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
          {role === 'admin' && (
            <Link
              to="/catalog/add"
              className="h-[32px] px-3 bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 hover:bg-[#3ecf8e]/20 text-[#3ecf8e] rounded-[6px] text-[12px] font-semibold flex items-center gap-1.5 transition-all"
            >
              <IconPlus className="w-3.5 h-3.5" /> Add API
            </Link>
          )}
          <div className="flex items-center gap-1 bg-[#141414] border border-[#2e2e2e] p-1 rounded-lg">
            <button
              aria-label="Show grid view"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-[6px] transition-all ${viewMode === 'grid' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconGridDots className="w-4 h-4" />
            </button>
            <button
              aria-label="Show list view"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-[6px] transition-all ${viewMode === 'list' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {loadingCatalog ? (
        <div className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
          <div className="grid grid-cols-[minmax(260px,1.8fr)_repeat(5,minmax(120px,1fr))] border-b border-[#2e2e2e] bg-[#141414] px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">
            <span>API Name</span>
            <span>Lifecycle</span>
            <span>Sector</span>
            <span>Compliance</span>
            <span>Sensitivity</span>
            <span>Owning Authority</span>
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[minmax(260px,1.8fr)_repeat(5,minmax(120px,1fr))] items-center gap-4 border-b border-[#2e2e2e] px-4 py-4 last:border-b-0">
              <div>
                <Skeleton className="h-4 w-52 bg-[#2e2e2e]" />
                <Skeleton className="mt-2 h-3 w-28 bg-[#242424]" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full bg-[#242424]" />
              <Skeleton className="h-3 w-20 bg-[#242424]" />
              <Skeleton className="h-5 w-32 rounded-full bg-[#242424]" />
              <Skeleton className="h-3 w-14 bg-[#242424]" />
              <Skeleton className="h-3 w-12 bg-[#242424]" />
            </div>
          ))}
        </div>
      ) : catalogError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-[13px] text-red-300">
          {catalogError}
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                <TableHead className="text-[11px] uppercase font-mono text-[#8b8b8b] h-10 tracking-widest px-4">API Name</TableHead>
                <TableHead className="text-[11px] uppercase font-mono text-[#8b8b8b] h-10 tracking-widest px-4">Lifecycle</TableHead>
                <TableHead className="text-[11px] uppercase font-mono text-[#8b8b8b] h-10 tracking-widest px-4">Sector</TableHead>
                <TableHead className="text-[11px] uppercase font-mono text-[#8b8b8b] h-10 tracking-widest px-4">Compliance</TableHead>
                <TableHead className="text-[11px] uppercase font-mono text-[#8b8b8b] h-10 tracking-widest px-4">Sensitivity</TableHead>
                <TableHead className="text-[11px] uppercase font-mono text-[#8b8b8b] h-10 tracking-widest px-4">Owning Authority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApis.length === 0 ? (
                <TableRow className="border-b border-[#2e2e2e]">
                  <TableCell colSpan={6} className="h-24 text-center text-[#8b8b8b] text-[13px]">
                    No APIs found matching filters.
                  </TableCell>
                </TableRow>
              ) : filteredApis.map(api => (
                <TableRow key={api.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 cursor-pointer transition-all group">
                  <TableCell className="py-3.5 px-4 text-left">
                    <Link to={`/api/${api.id}`} className="font-semibold text-[14px] text-[#ededed] hover:text-[#3ecf8e] transition-colors block">
                      {api.name}
                    </Link>
                    <p className="text-[12px] text-[#8b8b8b] mt-0.5 font-mono">
                      {api.id}
                    </p>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-left">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border uppercase
                      ${api.lifecycle_status === 'Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' :
                        api.lifecycle_status === 'Beta' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
                        'text-orange-400 border-orange-400/20 bg-orange-400/5'}
                    `}>
                      {api.lifecycle_status}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-left text-[13px] text-[#8b8b8b]">
                    {api.sector}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-left">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border uppercase
                      ${api.compliance_status === 'Approved for Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' :
                        api.compliance_status === 'Approved for Sandbox' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
                        api.compliance_status === 'Under Review' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5' :
                        'text-gray-400 border-gray-400/20 bg-gray-400/5'}
                    `}>
                      {api.compliance_status || 'Draft'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-left text-[13px]">
                    <span className={`font-mono text-[12px] ${
                      api.sensitivity_level === 'High' ? 'text-red-400' :
                      api.sensitivity_level === 'Medium' ? 'text-orange-400' : 'text-green-400'
                    }`}>
                      {api.sensitivity_level}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-left text-[13px] text-[#ededed] font-medium">
                    {api.owning_mda_id === 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' ? 'NIRA' :
                     api.owning_mda_id === 'mda-ura-2efff0d3-952e-4475-8231-232873a69854' ? 'URA' :
                     api.owning_mda_id === 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5' ? 'URSB' :
                     api.owning_mda_id === 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7' ? 'MoWT' : 'MoICT'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApis.length === 0 ? (
            <div className="col-span-full flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#1c1c1c] px-4 text-center text-[13px] text-[#8b8b8b]">
              No APIs found matching filters.
            </div>
          ) : filteredApis.map(api => (
            <Link key={api.id} to={`/api/${api.id}`} className="flex min-h-[220px] flex-col rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5 hover:border-[#444] transition-all group text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-transparent via-[#2e2e2e] to-[#3ecf8e]/30 group-hover:to-[#3ecf8e]/60 transition-all"></div>
              <div className="flex justify-between items-start mb-4">
                <SectorBadge sector={api.sector} />
                <div className="flex flex-wrap justify-end gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase
                    ${api.lifecycle_status === 'Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20' :
                      api.lifecycle_status === 'Beta' ? 'text-blue-400 border-blue-400/20' :
                      'text-orange-400 border-orange-400/20'}
                  `}>
                    {api.lifecycle_status}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase ${sensitivityBadgeClass(api.sensitivity_level)}`}>
                    {api.sensitivity_level}
                  </span>
                </div>
              </div>
              <h2 className="font-semibold text-[16px] text-white group-hover:text-[#3ecf8e] transition-colors mb-2">{api.name}</h2>
              <p className="text-[#8b8b8b] text-[13px] line-clamp-2 mb-6 leading-relaxed">
                {api.description}
              </p>
              <div className="flex justify-between items-center text-[12px] border-t border-[#2e2e2e] pt-4 mt-auto">
                <span className="text-[#8b8b8b]">Owner</span>
                <span className="text-white font-medium font-mono">
                  {api.owning_mda_id === 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' ? 'NIRA' :
                   api.owning_mda_id === 'mda-ura-2efff0d3-952e-4475-8231-232873a69854' ? 'URA' :
                   api.owning_mda_id === 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5' ? 'URSB' :
                   api.owning_mda_id === 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7' ? 'MoWT' : 'MoICT'}
                </span>
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
