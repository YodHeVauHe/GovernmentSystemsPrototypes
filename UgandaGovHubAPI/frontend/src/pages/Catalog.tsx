import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  IconSearch, 
  IconList, 
  IconGridDots, 
  IconDownload, 
  IconArrowLeft, 
  IconX, 
  IconShieldCheck, 
  IconPlayerPlay, 
  IconFileText, 
  IconLock,
  IconRefresh,
  IconBuildingBank,
  IconFileCertificate,
  IconPlus
} from '@tabler/icons-react';
import { useUser } from '../context/UserContext';

function RequestAccessModal({ api, onClose }: { api: any, onClose: () => void }) {
  const { mdaId, mdas } = useUser();
  const [purpose, setPurpose] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [volumeTier, setVolumeTier] = useState('Low (< 1,000 / month)');
  const [environment, setEnvironment] = useState('sandbox');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const fields = api.personal_data_categories 
    ? api.personal_data_categories.split(',').map((f: string) => f.trim())
    : [];

  useEffect(() => {
    setSelectedFields(fields);
  }, [api]);

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    
    fetch('http://localhost:4000/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_id: api.id,
        consumer_mda_id: mdaId,
        purpose,
        requested_fields: selectedFields.join(', '),
        volume_tier: volumeTier,
        legal_basis: legalBasis,
        environment
      })
    })
    .then(res => res.json())
    .then(() => setStatus('success'))
    .catch(err => console.error(err));
  };

  const requestingMda = mdas.find(m => m.id === mdaId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e]">
          <div>
            <h2 className="text-[16px] font-medium text-white">Request API Access</h2>
            <p className="text-[12px] text-[#8b8b8b] mt-0.5">
              Requesting access as <span className="text-[#3ecf8e] font-semibold">{requestingMda?.name} ({requestingMda?.shortName})</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[#8b8b8b] hover:text-white transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        
        {status === 'success' ? (
          <div className="p-8 text-center overflow-y-auto">
            <div className="w-12 h-12 bg-green-500/20 text-[#3ecf8e] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-[16px] font-medium text-white mb-2">Request Submitted</h3>
            <p className="text-[14px] text-[#8b8b8b] mb-6">
              Your access request for <span className="text-white font-medium">{api.name}</span> has been submitted for audit and administrative approval.
            </p>
            <button onClick={onClose} className="w-full h-[36px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-md text-[13px] transition-all">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4 text-left">
            <div>
              <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Target API</label>
              <div className="h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white flex items-center font-medium">
                {api.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Environment</label>
                <select
                  value={environment}
                  onChange={e => setEnvironment(e.target.value)}
                  className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#444]"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production (Restricted)</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Volume Tier</label>
                <select
                  value={volumeTier}
                  onChange={e => setVolumeTier(e.target.value)}
                  className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#444]"
                >
                  <option>Low (&lt; 1,000 / month)</option>
                  <option>Medium (1,000 - 10,000 / month)</option>
                  <option>High (&gt; 10,000 / month)</option>
                </select>
              </div>
            </div>

            {fields.length > 0 && (
              <div>
                <label className="block text-[12px] font-medium text-[#ededed] mb-2 font-mono uppercase tracking-wider text-[#8b8b8b]">Data Fields Requested</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#141414] border border-[#2e2e2e] rounded-md max-h-[120px] overflow-y-auto">
                  {fields.map((field: string) => (
                    <label key={field} className="flex items-center gap-2 text-[13px] text-white cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={selectedFields.includes(field)}
                        onChange={() => handleFieldToggle(field)}
                        className="rounded border-[#2e2e2e] bg-[#1c1c1c] text-[#3ecf8e] focus:ring-0 focus:ring-offset-0"
                      />
                      {field}
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Statutory or Lawful Basis</label>
              <input
                required
                type="text"
                value={legalBasis}
                onChange={e => setLegalBasis(e.target.value)}
                placeholder="E.g. Section 43 of Public Procurement Act, or Ministry Mandate..."
                className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] text-[13px] text-white focus:outline-none focus:border-[#444] rounded-md"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Purpose & Access Statement</label>
              <textarea 
                required
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Describe why your agency requires access to this dataset and how purpose limitation will be enforced..."
                className="w-full h-20 p-3 bg-[#141414] border border-[#2e2e2e] text-[13px] text-white focus:outline-none focus:border-[#444] rounded-md resize-none"
              />
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 h-[36px] border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] font-medium rounded-md text-[13px] transition-colors">
                Cancel
              </button>
              <button disabled={status === 'submitting'} type="submit" className="flex-1 h-[36px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-md text-[13px] transition-colors disabled:opacity-50">
                {status === 'submitting' ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function Catalog() {
  const { role } = useUser();
  const [apis, setApis] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [complianceFilter, setComplianceFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    fetch('http://localhost:4000/api/catalog')
      .then(res => res.json())
      .then(data => setApis(data))
      .catch(err => console.error(err));
  }, []);

  const filteredApis = apis.filter(api => {
    const matchesSearch = api.name.toLowerCase().includes(search.toLowerCase()) || 
                          api.sector.toLowerCase().includes(search.toLowerCase()) ||
                          api.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || api.lifecycle_status.toUpperCase() === statusFilter;
    const matchesCompliance = complianceFilter === 'ALL' || (api.compliance_status || 'Draft') === complianceFilter;
    return matchesSearch && matchesStatus && matchesCompliance;
  });

  return (
    <div className="w-full p-4 lg:p-8 max-w-[1200px] mx-auto text-[#ededed]">
      {/* Header Info */}
      <div className="text-left mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight mb-2 text-white">Interoperability Catalog</h1>
        <p className="text-[14px] text-[#8b8b8b] max-w-2xl">
          Discover, test, and request lawful access to secure data sharing APIs owned by Ugandan Ministries, Departments, and Agencies (MDAs).
        </p>
      </div>
      
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[280px]">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8b8b] w-[18px] h-[18px]" />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, sector, agency..." 
              className="h-[36px] pl-9 bg-[#1c1c1c] border-[#2e2e2e] text-[13px] text-white focus:border-[#444] rounded-[6px]"
            />
          </div>
          
            <select 
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
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-[6px] transition-all ${viewMode === 'grid' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconGridDots className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-[6px] transition-all ${viewMode === 'list' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      {viewMode === 'list' ? (
        <div className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
          <Table>
            <TableHeader>
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
                    {api.owning_mda_id === 'mda-01' ? 'NIRA' :
                     api.owning_mda_id === 'mda-02' ? 'URA' :
                     api.owning_mda_id === 'mda-03' ? 'URSB' :
                     api.owning_mda_id === 'mda-04' ? 'MoWT' : 'MoICT'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApis.map(api => (
            <Link key={api.id} to={`/api/${api.id}`} className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-6 hover:border-[#444] transition-all block group text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-transparent via-[#2e2e2e] to-[#3ecf8e]/30 group-hover:to-[#3ecf8e]/60 transition-all"></div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[12px] font-mono text-[#8b8b8b]">{api.sector}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase
                  ${api.lifecycle_status === 'Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20' : 
                    api.lifecycle_status === 'Beta' ? 'text-blue-400 border-blue-400/20' : 
                    'text-orange-400 border-orange-400/20'}
                `}>
                  {api.lifecycle_status}
                </span>
              </div>
              <h2 className="font-semibold text-[16px] text-white group-hover:text-[#3ecf8e] transition-colors mb-2">{api.name}</h2>
              <p className="text-[#8b8b8b] text-[13px] line-clamp-2 mb-6 leading-relaxed">
                {api.description}
              </p>
              <div className="flex justify-between items-center text-[12px] border-t border-[#2e2e2e] pt-4 mt-auto">
                <span className="text-[#8b8b8b]">Owner</span>
                <span className="text-white font-medium font-mono">
                  {api.owning_mda_id === 'mda-01' ? 'NIRA' :
                   api.owning_mda_id === 'mda-02' ? 'URA' :
                   api.owning_mda_id === 'mda-03' ? 'URSB' :
                   api.owning_mda_id === 'mda-04' ? 'MoWT' : 'MoICT'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type SandboxParameterLocation = 'path' | 'query' | 'header' | 'cookie';

type SandboxParameterRow = {
  key: string;
  name: string;
  in: SandboxParameterLocation;
  required?: boolean;
  description?: string;
  schema?: any;
  value: string;
  enabled: boolean;
};

const sampleValues: Record<string, string> = {
  nin: 'CM99021234567X',
  given_name: 'JOHN',
  surname: 'DOE',
  date_of_birth: '1990-01-01',
  tin: '1000123456',
  brn: 'BRN12345',
  permitNumber: 'WP30219',
  permit_number: 'WP30219',
  class: 'Group B',
};

const apiBasePathById: Record<string, string> = {
  'api-nira-01': '/api/v1/identity',
  'api-ura-01': '/api/v1/tax',
  'api-ursb-01': '/api/v1/business',
  'api-mowt-01': '/api/v1/transport/driving-permit',
  'api-moict-01': '/api/v1/service-uganda',
};

function getSchemaDefault(schema: any, name: string): any {
  if (!schema) return sampleValues[name] || '';
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (sampleValues[name] !== undefined) return sampleValues[name];
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  return '';
}

function buildBodyExample(requestBody: any) {
  const content = requestBody?.content || {};
  const contentType = Object.keys(content)[0] || 'application/json';
  const media = content[contentType];

  if (media?.example !== undefined) {
    return { contentType, value: media.example };
  }

  const firstExample = media?.examples ? Object.values(media.examples)[0] as any : null;
  if (firstExample?.value !== undefined) {
    return { contentType, value: firstExample.value };
  }

  const schema = media?.schema;
  if (schema?.type === 'object' || schema?.properties) {
    const value = Object.fromEntries(
      Object.entries(schema.properties || {}).map(([name, propertySchema]) => [
        name,
        getSchemaDefault(propertySchema, name),
      ])
    );
    return { contentType, value };
  }

  return { contentType, value: '' };
}

function coerceParameterValue(value: string, schema: any) {
  if (schema?.type === 'boolean') return value === 'true';
  if (schema?.type === 'integer') return Number.parseInt(value, 10);
  if (schema?.type === 'number') return Number.parseFloat(value);
  return value;
}

function getServerBasePath(spec: any, apiId: string) {
  const serverUrl = spec?.servers?.[0]?.url;
  if (serverUrl) {
    try {
      return new URL(serverUrl).pathname.replace(/\/$/, '');
    } catch {
      if (serverUrl.startsWith('/')) return serverUrl.replace(/\/$/, '');
    }
  }
  return apiBasePathById[apiId] || '/api/v1';
}

function SandboxTryItConsole({ api, endpoints, spec }: { api: any, endpoints: any[], spec: any }) {
  const { mdaId } = useUser();
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [apiKeyOption, setApiKeyOption] = useState<'approved' | 'custom' | 'none'>('approved');
  const [customApiKey, setCustomApiKey] = useState('');
  const [activeEndpointIdx, setActiveEndpointIdx] = useState<number>(0);
  const [parameters, setParameters] = useState<SandboxParameterRow[]>([]);
  const [bodyText, setBodyText] = useState('');
  const [bodyContentType, setBodyContentType] = useState('application/json');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const activeEp = endpoints[activeEndpointIdx];
  const canSendBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(activeEp?.method);
  const basePath = useMemo(() => getServerBasePath(spec, api.id), [spec, api.id]);

  // Fetch approved requests to load generated keys
  const fetchApprovedKeys = () => {
    fetch('http://localhost:4000/api/access')
      .then(res => res.json())
      .then(data => {
        // Filter approved for active representing MDA and current API
        const approved = data.filter((r: any) => 
          r.api_id === api.id && r.consumer_mda_id === mdaId && r.status === 'APPROVED'
        );
        setApprovedRequests(approved);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchApprovedKeys();
    setResponse(null);
  }, [api, mdaId]);

  useEffect(() => {
    if (!activeEp) return;

    const rows = (activeEp.data.parameters || []).map((param: any) => {
      const name = param.name;
      const value = String(param.example ?? getSchemaDefault(param.schema, name));
      return {
        key: `${param.in}:${name}`,
        name,
        in: param.in,
        required: param.required,
        description: param.description,
        schema: param.schema,
        value,
        enabled: param.required || value !== '',
      } satisfies SandboxParameterRow;
    });

    const bodyExample = buildBodyExample(activeEp.data.requestBody);
    setParameters(rows);
    setBodyContentType(bodyExample.contentType);
    setBodyText(
      typeof bodyExample.value === 'string'
        ? bodyExample.value
        : JSON.stringify(bodyExample.value, null, 2)
    );
    setResponse(null);
  }, [activeEndpointIdx, activeEp]);

  const updateParameter = (key: string, patch: Partial<SandboxParameterRow>) => {
    setParameters(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row));
  };

  const parameterGroups = useMemo(() => ({
    path: parameters.filter(param => param.in === 'path'),
    query: parameters.filter(param => param.in === 'query'),
    header: parameters.filter(param => param.in === 'header'),
    cookie: parameters.filter(param => param.in === 'cookie'),
  }), [parameters]);

  const applySampleValues = (updates: Record<string, string>) => {
    setParameters(prev => prev.map(row => updates[row.name] !== undefined ? {
      ...row,
      value: updates[row.name],
      enabled: true,
    } : row));

    setBodyText(prev => {
      if (!prev.trim()) return prev;
      try {
        const parsed = JSON.parse(prev);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return prev;
        return JSON.stringify({ ...parsed, ...updates }, null, 2);
      } catch {
        return prev;
      }
    });
  };

  const buildTargetUrl = () => {
    let requestPath = activeEp.path;
    parameterGroups.path.forEach(param => {
      requestPath = requestPath.replace(
        `{${param.name}}`,
        encodeURIComponent(param.value)
      );
    });

    const url = new URL(`${basePath}${requestPath}`, 'http://localhost:4000');
    parameterGroups.query
      .filter(param => param.enabled && param.value !== '')
      .forEach(param => url.searchParams.set(param.name, param.value));

    return url.toString();
  };

  const targetUrl = activeEp ? buildTargetUrl() : '';

  const handleSend = () => {
    if (!activeEp) return;

    setLoading(true);
    setResponse(null);

    // Resolve API Key
    let key = '';
    if (apiKeyOption === 'approved') {
      key = approvedRequests[0]?.api_key || '';
    } else if (apiKeyOption === 'custom') {
      key = customApiKey;
    }

    const correlationId = `tx-client-${Date.now()}`;

    let requestBody: BodyInit | undefined;
    if (canSendBody && bodyText.trim()) {
      if (bodyContentType.includes('json')) {
        try {
          requestBody = JSON.stringify(JSON.parse(bodyText));
        } catch (err: any) {
          setLoading(false);
          setResponse({
            status: 0,
            statusText: 'Invalid Request Body',
            body: { error: err.message }
          });
          return;
        }
      } else {
        requestBody = bodyText;
      }
    }

    const headers: Record<string, string> = {
      'X-Correlation-ID': correlationId
    };

    if (bodyText.trim() && canSendBody) headers['Content-Type'] = bodyContentType;
    if (key) headers['X-GovHub-API-Key'] = key;
    parameterGroups.header
      .filter(param => param.enabled && param.value !== '')
      .forEach(param => {
        headers[param.name] = String(coerceParameterValue(param.value, param.schema));
      });

    const cookieHeader = parameterGroups.cookie
      .filter(param => param.enabled && param.value !== '')
      .map(param => `${param.name}=${param.value}`)
      .join('; ');
    if (cookieHeader) headers.Cookie = cookieHeader;

    fetch(targetUrl, {
      method: activeEp.method,
      headers,
      body: requestBody
    })
    .then(async (res) => {
      const status = res.status;
      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, name) => {
        headersObj[name] = val;
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      setResponse({
        status,
        statusText: res.statusText,
        headers: headersObj,
        body: data
      });
    })
    .catch(err => {
      setResponse({
        status: 0,
        statusText: 'Network Connection Failed',
        body: { error: err.message }
      });
    })
    .finally(() => setLoading(false));
  };

  // Helper selectors for quick seeding/presenting in sandbox
  const loadProfile = (profile: string) => {
    if (profile === 'valid-nira') {
      applySampleValues({ nin: 'CM99021234567X', given_name: 'JOHN', surname: 'DOE' });
    } else if (profile === 'invalid-nira') {
      applySampleValues({ nin: 'CM00000000000X' });
    } else if (profile === 'expired-nira') {
      applySampleValues({ nin: 'CM99021234567E' });
    } else if (profile === 'compliant-ura') {
      applySampleValues({ tin: '1000123456' });
    } else if (profile === 'noncompliant-ura') {
      applySampleValues({ tin: '9999999999' });
    } else if (profile === 'valid-permit') {
      applySampleValues({ permitNumber: 'WP30219', permit_number: 'WP30219' });
    } else if (profile === 'suspended-permit') {
      applySampleValues({ permitNumber: 'WP30219susp', permit_number: 'WP30219susp' });
    }
  };

  const renderParameterSection = (title: string, rows: SandboxParameterRow[]) => {
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-[#2e2e2e] overflow-hidden">
        <div className="grid grid-cols-[42px_1fr_1.4fr] bg-[#1c1c1c] border-b border-[#2e2e2e] text-[11px] uppercase tracking-wider font-mono text-[#8b8b8b]">
          <div className="px-3 py-2">On</div>
          <div className="px-3 py-2 border-l border-[#2e2e2e]">{title}</div>
          <div className="px-3 py-2 border-l border-[#2e2e2e]">Value</div>
        </div>
        {rows.map(row => (
          <div key={row.key} className="grid grid-cols-[42px_1fr_1.4fr] border-b border-[#2e2e2e] last:border-b-0 bg-[#141414]">
            <div className="px-3 py-2 flex items-center justify-center">
              <input
                type="checkbox"
                checked={row.enabled}
                disabled={row.required}
                onChange={e => updateParameter(row.key, { enabled: e.target.checked })}
                className="rounded border-[#2e2e2e] bg-[#1c1c1c] text-[#3ecf8e] focus:ring-0 focus:ring-offset-0"
              />
            </div>
            <div className="px-3 py-2 border-l border-[#2e2e2e] min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] text-white truncate">{row.name}</span>
                {row.required && <span className="text-[10px] text-red-400">Required</span>}
              </div>
              <div className="text-[11px] text-[#8b8b8b] truncate">
                {row.schema?.type || 'string'}{row.description ? ` - ${row.description}` : ''}
              </div>
            </div>
            <div className="px-2 py-2 border-l border-[#2e2e2e]">
              <input
                type={row.schema?.type === 'number' || row.schema?.type === 'integer' ? 'number' : 'text'}
                value={row.value}
                onChange={e => updateParameter(row.key, { value: e.target.value, enabled: true })}
                className="w-full h-[32px] px-2 bg-[#0a0a0a] border border-[#2e2e2e] text-[13px] text-white font-mono rounded-md focus:outline-none focus:border-[#444]"
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start text-left w-full">
      {/* Controls Column */}
      <div className="flex-1 w-full lg:w-1/2 flex flex-col gap-6">
        {/* API Key Selector */}
        <div className="p-5 rounded-lg border border-[#2e2e2e] bg-[#141414] shadow-md">
          <h3 className="text-[14px] font-medium text-white mb-4 flex items-center gap-2">
            <IconLock className="w-4 h-4 text-[#3ecf8e]" />
            Sandbox Credentials
          </h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-[13px] text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="key_opt"
                  checked={apiKeyOption === 'approved'} 
                  onChange={() => setApiKeyOption('approved')}
                  className="bg-[#1c1c1c] border-[#2e2e2e] text-[#3ecf8e] focus:ring-0"
                />
                Use Approved Key
              </label>

              <label className="flex items-center gap-2 text-[13px] text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="key_opt"
                  checked={apiKeyOption === 'custom'} 
                  onChange={() => setApiKeyOption('custom')}
                  className="bg-[#1c1c1c] border-[#2e2e2e] text-[#3ecf8e] focus:ring-0"
                />
                Use Custom Key
              </label>

              <label className="flex items-center gap-2 text-[13px] text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="key_opt"
                  checked={apiKeyOption === 'none'} 
                  onChange={() => setApiKeyOption('none')}
                  className="bg-[#1c1c1c] border-[#2e2e2e] text-[#3ecf8e] focus:ring-0"
                />
                No Key (Anonymous)
              </label>
            </div>

            {apiKeyOption === 'approved' && (
              <div>
                {approvedRequests.length === 0 ? (
                  <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-md text-[12px] flex items-center gap-2.5">
                    <span>⚠️</span>
                    <div>
                      No approved sandbox keys found for your active agency. Please request access or switch roles to approve it in the Dashboard first.
                    </div>
                  </div>
                ) : (
                  <div className="h-[36px] px-3 bg-[#1c1c1c] border border-[#2e2e2e] rounded-md text-[13px] text-[#3ecf8e] font-mono flex items-center justify-between">
                    <span>Approved Key: {approvedRequests[0].api_key.substring(0, 15)}...</span>
                    <span className="text-[10px] bg-[#3ecf8e]/10 px-2 py-0.5 rounded-full border border-[#3ecf8e]/20 font-sans uppercase">Active</span>
                  </div>
                )}
              </div>
            )}

            {apiKeyOption === 'custom' && (
              <input 
                type="text" 
                value={customApiKey}
                onChange={e => setCustomApiKey(e.target.value)}
                placeholder="Enter sandbox api key manually..."
                className="h-[36px] px-3 bg-[#1c1c1c] border border-[#2e2e2e] text-[13px] text-white font-mono rounded-md focus:outline-none focus:border-[#444]"
              />
            )}
          </div>
        </div>

        {/* Target Endpoint */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-mono uppercase tracking-wider text-[#8b8b8b]">Target Endpoint</label>
          <div className="flex flex-col gap-2 border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#1c1c1c]">
            {endpoints.map((ep, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveEndpointIdx(idx);
                  setResponse(null);
                }}
                className={`p-3 text-left flex items-center gap-3 transition-colors ${
                  activeEndpointIdx === idx ? 'bg-[#222] border-l-2 border-[#3ecf8e]' : 'hover:bg-[#2e2e2e]/30'
                }`}
              >
                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded 
                  ${ep.method === 'GET' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-[#3ecf8e]'}`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-[13.5px] text-[#ededed]">{ep.path}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input Form Section */}
        {activeEp && (
          <div className="p-5 rounded-lg border border-[#2e2e2e] bg-[#141414] shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-3">
              <h4 className="text-[13px] font-mono uppercase tracking-wider text-[#8b8b8b]">Request Parameters</h4>
              
              {/* Presets dropdown for presentation ease */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8b8b8b]">Presets:</span>
                <div className="flex items-center gap-1.5">
                  {api.id === 'api-nira-01' && (
                    <>
                      <button onClick={() => loadProfile('valid-nira')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Valid</button>
                      <button onClick={() => loadProfile('invalid-nira')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">No Match</button>
                      <button onClick={() => loadProfile('expired-nira')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Expired</button>
                    </>
                  )}
                  {api.id === 'api-ura-01' && (
                    <>
                      <button onClick={() => loadProfile('compliant-ura')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Compliant</button>
                      <button onClick={() => loadProfile('noncompliant-ura')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Non-Comp</button>
                    </>
                  )}
                  {api.id === 'api-mowt-01' && (
                    <>
                      <button onClick={() => loadProfile('valid-permit')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Valid</button>
                      <button onClick={() => loadProfile('suspended-permit')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Suspended</button>
                    </>
                  )}
                  {api.id === 'api-moict-01' && (
                    <>
                      <button onClick={() => applySampleValues({ nin: 'CM99021234567X', tin: '1000123456', permit_number: 'WP30219' })} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Eligible</button>
                      <button onClick={() => applySampleValues({ nin: 'CM00000000000X', tin: '1000123456', permit_number: 'WP30219' })} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Ineligible</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs based on Path */}
            <div className="flex flex-col gap-4">
              {renderParameterSection('Variables', parameterGroups.path)}
              {renderParameterSection('Query Parameters', parameterGroups.query)}
              {renderParameterSection('Headers', parameterGroups.header)}
              {renderParameterSection('Cookies', parameterGroups.cookie)}

              {canSendBody && activeEp.data.requestBody && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-mono text-[#8b8b8b]">Request Body</label>
                    <select
                      value={bodyContentType}
                      onChange={e => setBodyContentType(e.target.value)}
                      className="h-[28px] px-2 bg-[#1c1c1c] border border-[#2e2e2e] text-[12px] text-white rounded-md focus:outline-none focus:border-[#444]"
                    >
                      {Object.keys(activeEp.data.requestBody.content || { 'application/json': {} }).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[170px] p-3 bg-[#0a0a0a] border border-[#2e2e2e] text-[12.5px] text-white font-mono rounded-md focus:outline-none focus:border-[#444] resize-y"
                  />
                </div>
              )}

              <div>
                <label className="block text-[12px] font-mono text-[#8b8b8b] mb-1">Request URL</label>
                <div className="px-3 py-2 bg-[#0a0a0a] border border-[#2e2e2e] rounded-md text-[12px] text-[#3ecf8e] font-mono break-all">
                  {targetUrl}
                </div>
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={loading}
              className="mt-2 w-full h-[38px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-semibold rounded-md text-[13px] flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              <IconPlayerPlay className="w-4 h-4 fill-black" />
              {loading ? 'Executing Sandbox Request...' : 'Send Sandbox Request'}
            </button>
          </div>
        )}
      </div>

      {/* Response Column */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col gap-4 flex-shrink-0 sticky top-6">
        <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] overflow-hidden shadow-lg min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2e2e2e] bg-[#1c1c1c]">
            <span className="text-[12px] font-medium text-white">Sandbox Response Console</span>
            {response && (
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded
                ${response.status === 200 ? 'bg-[#3ecf8e]/10 text-[#3ecf8e] border border-[#3ecf8e]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                STATUS: {response.status} {response.statusText}
              </span>
            )}
          </div>
          
          <div className="p-4 bg-[#0a0a0a] flex-1 font-mono text-[13px] overflow-auto max-h-[480px] flex flex-col">
            {loading ? (
              <div className="flex flex-col items-center justify-center m-auto gap-3 text-[#8b8b8b]">
                <IconRefresh className="w-8 h-8 animate-spin text-[#3ecf8e]" />
                <span>Interrogating mock registry sandbox...</span>
              </div>
            ) : response ? (
              <div className="flex flex-col gap-4 text-left">
                {/* Headers Display */}
                <div>
                  <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1">Headers</div>
                  <pre className="text-[12px] text-gray-400 border-b border-[#2e2e2e] pb-2 leading-relaxed whitespace-pre-wrap">
                    {`X-Correlation-ID: ${response.headers?.['x-correlation-id'] || 'N/A'}\n`}
                    {`X-RateLimit-Limit: ${response.headers?.['x-ratelimit-limit'] || 'N/A'}\n`}
                    {`X-RateLimit-Remaining: ${response.headers?.['x-ratelimit-remaining'] || 'N/A'}`}
                  </pre>
                </div>
                {/* Body Display */}
                <div>
                  <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1">Body</div>
                  <pre className={`leading-relaxed text-[12.5px] whitespace-pre-wrap overflow-x-auto ${response.status === 200 ? 'text-[#3ecf8e]' : 'text-red-400'}`}>
                    {JSON.stringify(response.body, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center m-auto text-[#8b8b8b] text-[13px] max-w-[280px]">
                <span className="text-2xl mb-2">⚡</span>
                <span className="text-center">Select your sandbox credentials, fill parameters, and trigger execution to view results.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EndpointBlock({ ep, spec }: { ep: any, spec: any }) {
  const responseCodes = Object.keys(ep.data.responses || {});
  const [activeTab, setActiveTab] = useState<string>(responseCodes[0] || '');

  const activeResponse = ep.data.responses?.[activeTab];
  const activeExample = activeResponse?.content?.['application/json']?.example 
    || activeResponse?.content?.['application/json']?.examples?.['Exact Match']?.value 
    || activeResponse?.content?.['application/json']?.examples?.['Partial Match']?.value 
    || activeResponse?.content?.['application/json']?.examples?.['Valid Permit']?.value
    || activeResponse?.content?.['application/json']?.examples?.['Compliant']?.value
    || activeResponse?.content?.['application/json']?.examples?.['Active Company']?.value
    || {};

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Left Column: Docs & Params */}
      <div className="flex-1 w-full lg:w-1/2">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-[13px] font-mono font-bold px-2 py-0.5 rounded 
            ${ep.method === 'GET' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
              ep.method === 'POST' ? 'bg-green-500/10 text-[#3ecf8e] border border-green-500/20' : 
              'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
            {ep.method}
          </span>
          <span className="font-mono text-[15px] text-[#ededed]">{ep.path}</span>
        </div>
        
        <p className="text-[14px] text-[#8b8b8b] mb-8 leading-relaxed">
          {ep.data.summary || ep.data.description}
        </p>
        
        {/* Parameters */}
        {ep.data.parameters && ep.data.parameters.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[13px] font-medium text-[#ededed] mb-3 flex items-center gap-2">
              Parameters
            </h3>
            <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="text-[11px] text-[#8b8b8b] h-8 px-4 font-medium uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[11px] text-[#8b8b8b] h-8 px-4 font-medium uppercase tracking-wider">In</TableHead>
                    <TableHead className="text-[11px] text-[#8b8b8b] h-8 px-4 font-medium uppercase tracking-wider">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ep.data.parameters.map((param: any, pIdx: number) => (
                    <TableRow key={pIdx} className="border-b border-[#2e2e2e] hover:bg-transparent">
                      <TableCell className="py-3 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-[#ededed]">{param.name}</span>
                          {param.required && <span className="text-[10px] text-red-400 font-medium">Required</span>}
                        </div>
                        {param.description && (
                          <p className="text-[12px] text-[#8b8b8b] mt-1">{param.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 align-top text-[13px] text-[#8b8b8b]">{param.in}</TableCell>
                      <TableCell className="py-3 px-4 align-top text-[13px] text-[#8b8b8b] font-mono">{param.schema?.type || 'string'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Code & Responses (Scalar Style) */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col gap-4 flex-shrink-0 sticky top-6">
        {/* Request Box */}
        <div className="rounded-[8px] border border-[#2e2e2e] bg-[#141414] overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2e2e2e] bg-[#1c1c1c]">
            <span className="text-[12px] font-medium text-[#ededed]">Request Contract Example</span>
            <span className="text-[11px] font-mono text-[#8b8b8b]">cURL</span>
          </div>
          <div className="p-4 bg-[#0a0a0a]">
            <pre className="font-mono text-[12.5px] leading-relaxed text-[#e0e0e0] overflow-x-auto whitespace-pre-wrap break-all text-left">
              <span className="text-[#8b8b8b]">curl -X</span> {ep.method} \<br/>
              <span className="text-[#8b8b8b]">  {spec.servers?.[0]?.url || 'https://api.govhub.go.ug'}{ep.path}</span> \<br/>
              <span className="text-[#8b8b8b]">  -H</span> "X-GovHub-API-Key: your_api_key" \
              {ep.data.requestBody && (
                <>
                  <br/><span className="text-[#8b8b8b]">  -H</span> "Content-Type: application/json" \<br/>
                  <span className="text-[#8b8b8b]">  -d</span> '{JSON.stringify(ep.data.requestBody.content?.['application/json']?.example || {}, null, 2)}'
                </>
              )}
            </pre>
          </div>
        </div>

        {/* Responses Box */}
        {ep.data.responses && responseCodes.length > 0 && (
          <div className="rounded-[8px] border border-[#2e2e2e] bg-[#141414] overflow-hidden shadow-lg">
            <div className="flex items-center px-2 py-2 border-b border-[#2e2e2e] bg-[#1c1c1c] overflow-x-auto hide-scrollbar gap-1">
              <span className="text-[12px] font-medium text-[#8b8b8b] px-2 mr-2">Responses</span>
              {responseCodes.map((code) => {
                const isActive = code === activeTab;
                return (
                  <button 
                    key={code} 
                    onClick={() => setActiveTab(code)}
                    className={`px-3 py-1 text-[12px] font-mono rounded-[4px] border transition-colors ${
                      isActive 
                        ? 'bg-[#2e2e2e] text-[#ededed] border-[#444]' 
                        : 'border-transparent text-[#8b8b8b] hover:bg-[#222]'
                    }`}
                  >
                    <span className={`mr-1.5 ${code.startsWith('2') ? 'text-[#3ecf8e]' : 'text-red-400'}`}>●</span>
                    {code}
                  </button>
                );
              })}
            </div>
            
            {/* Active Response Body */}
            {activeResponse && (
              <div className="flex flex-col text-left">
                <div className="px-4 py-3 bg-[#0a0a0a]">
                  <p className="text-[12.5px] text-[#8b8b8b] mb-3">{activeResponse.description}</p>
                  {activeResponse.content ? (
                    <pre className="font-mono text-[12.5px] leading-relaxed text-[#3ecf8e] overflow-x-auto">
                      {JSON.stringify(activeExample, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-[12px] font-mono text-[#444] italic">No content body</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function APIPrintSummary({ api }: { api: any }) {
  return (
    <div className="p-8 bg-white text-black border border-gray-300 rounded-lg max-w-[800px] mx-auto text-left shadow-md flex flex-col gap-6">
      <div className="border-b-2 border-gray-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{api.name}</h1>
            <p className="text-sm font-mono text-gray-600 mt-1">ID Reference: {api.id}</p>
          </div>
          <span className="border-2 border-black font-bold uppercase tracking-wider text-xs px-3 py-1 bg-gray-100">
            {api.lifecycle_status}
          </span>
        </div>
        <p className="text-[14px] text-gray-800 mt-3 leading-relaxed">{api.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Owning MDA (Data Owner)</span>
          <span className="font-semibold text-gray-900">
            {api.owning_mda_id === 'mda-01' ? 'National Identification and Registration Authority (NIRA)' :
             api.owning_mda_id === 'mda-02' ? 'Uganda Revenue Authority (URA)' :
             api.owning_mda_id === 'mda-03' ? 'Uganda Registration Services Bureau (URSB)' :
             api.owning_mda_id === 'mda-04' ? 'Ministry of Works and Transport (MoWT)' : 
             'Ministry of ICT and National Guidance (MoICT)'}
          </span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Technical Owner</span>
          <span className="font-semibold text-gray-900">{api.technical_owner}</span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Administrative Contact</span>
          <span className="font-semibold text-gray-900">{api.contact_office}</span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Security Classification</span>
          <span className="font-semibold text-gray-900 font-mono">{api.security_classification}</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3">
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Statutory / Legal Basis</span>
          <span className="text-gray-900 italic font-serif">"{api.statutory_basis}"</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3">
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Purpose Limitation Statement</span>
          <span className="text-gray-800 leading-relaxed">{api.purpose_limitation}</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3">
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Data Minimization Design Stance</span>
          <span className="text-gray-800 leading-relaxed">{api.data_minimization_note}</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3 grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Personal Data Categories</span>
            <span className="text-gray-800">{api.personal_data_categories}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Retention Stance</span>
            <span className="text-gray-800">{api.retention_class}</span>
          </div>
        </div>

        <div className="col-span-2 border-t-2 border-gray-900 pt-4 flex justify-between items-center text-[10px] text-gray-500">
          <span>Uganda GovHub Interoperability Framework (GIRA / e-GIF) Compliant Document</span>
          <span>Printed: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export function ApiDetail() {
  const { id } = useParams();
  const [api, setApi] = useState<any>(null);
  const [spec, setSpec] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'docs' | 'gov' | 'try'>('docs');
  const [showPrintView, setShowPrintView] = useState(false);

  const logAuditEvent = useCallback((eventType: string, mdaId: string | null, apiId: string | null, requestId: string, details: any) => {
    fetch('http://localhost:4000/api/access/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, mdaId, apiId, requestId, details })
    }).catch(err => console.error('Failed to log event:', err));
  }, []);

  useEffect(() => {
    fetch(`http://localhost:4000/api/catalog/${id}`)
      .then(res => res.json())
      .then(data => {
        setApi(data);
        logAuditEvent('API_VIEWED', null, id || null, `tx-view-${Date.now()}`, { api_name: data.name });
      })
      .catch(err => console.error(err));

    fetch(`http://localhost:4000/api/catalog/${id}/spec`)
      .then(res => res.json())
      .then(data => setSpec(data))
      .catch(err => console.error(err));
  }, [id, logAuditEvent]);


  if (!api || !spec) {
    return <div className="p-8 text-[#8b8b8b] text-left">Loading API details...</div>;
  }

  const specUrl = `http://localhost:4000${api.openapi_spec_path}`;
  const endpoints: any[] = [];
  
  if (spec.paths) {
    Object.keys(spec.paths).forEach(path => {
      const methods = spec.paths[path];
      Object.keys(methods).forEach(method => {
        endpoints.push({
          path,
          method: method.toUpperCase(),
          data: methods[method]
        });
      });
    });
  }

  if (showPrintView) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex flex-col gap-6">
        <div className="max-w-[800px] mx-auto w-full flex justify-between print:hidden">
          <button 
            onClick={() => setShowPrintView(false)}
            className="h-[34px] px-4 bg-gray-800 text-white font-medium rounded-md text-[13px] flex items-center gap-1.5"
          >
            <IconArrowLeft className="w-4 h-4" /> Back to Dashboard Detail
          </button>
          <button 
            onClick={() => window.print()}
            className="h-[34px] px-4 bg-blue-600 text-white font-medium rounded-md text-[13px] flex items-center gap-1.5 shadow-md"
          >
            <span>Print Compliance Sheet</span>
          </button>
        </div>
        <APIPrintSummary api={api} />
      </div>
    );
  }

  return (
    <div className="text-left w-full max-w-[1400px] mx-auto text-[#ededed] flex flex-col min-h-full">
      {isModalOpen && <RequestAccessModal api={api} onClose={() => setIsModalOpen(false)} />}
      
      {/* Header Area */}
      <div className="px-4 lg:px-8 py-6 border-b border-[#2e2e2e] bg-[#1c1c1c]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-[#8b8b8b] hover:text-white transition-colors">
            <IconArrowLeft className="w-4 h-4" /> Back to Catalog
          </Link>
          
          <div className="flex items-center gap-3">
            <a 
              href={specUrl} 
              download 
              className="h-[32px] px-3 flex items-center gap-2 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[13px] text-[#ededed] transition-colors"
            >
              <IconDownload className="w-4 h-4 text-[#8b8b8b]" /> Download Spec
            </a>
            <button onClick={() => setIsModalOpen(true)} className="h-[32px] px-3 bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-semibold rounded-[6px] text-[13px] transition-colors shadow-md">
              Request Access
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="text-[26px] font-bold text-white tracking-tight">{api.name}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border uppercase
            ${api.lifecycle_status === 'Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' : 
              api.lifecycle_status === 'Beta' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' : 
              'text-orange-400 border-orange-400/20 bg-orange-400/5'}
          `}>
            {api.lifecycle_status}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border border-red-500/20 text-red-400 bg-red-500/5 uppercase">
            SENSITIVITY: {api.sensitivity_level}
          </span>
        </div>
        <p className="text-[14.5px] text-[#8b8b8b] max-w-4xl leading-relaxed">{api.description}</p>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-[#2e2e2e] bg-[#141414] px-4 lg:px-8 flex gap-1">
        <button
          onClick={() => setActiveTab('docs')}
          className={`h-11 px-4 text-[13.5px] font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'docs' 
              ? 'border-[#3ecf8e] text-white bg-[#1c1c1c]/40' 
              : 'border-transparent text-[#8b8b8b] hover:text-white'
          }`}
        >
          <IconFileText className="w-4 h-4" />
          Technical Documentation
        </button>

        <button
          onClick={() => setActiveTab('gov')}
          className={`h-11 px-4 text-[13.5px] font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'gov' 
              ? 'border-[#3ecf8e] text-white bg-[#1c1c1c]/40' 
              : 'border-transparent text-[#8b8b8b] hover:text-white'
          }`}
        >
          <IconShieldCheck className="w-4 h-4" />
          Governance & Lawful Processing
        </button>

        <button
          onClick={() => setActiveTab('try')}
          className={`h-11 px-4 text-[13.5px] font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'try' 
              ? 'border-[#3ecf8e] text-white bg-[#1c1c1c]/40' 
              : 'border-transparent text-[#8b8b8b] hover:text-white'
          }`}
        >
          <IconPlayerPlay className="w-4 h-4" />
          Sandbox Try It
        </button>
      </div>

      {/* Tab Contents */}
      <div className="px-4 lg:px-8 py-8 flex-1 bg-[#181818]/30">
        {activeTab === 'docs' && (
          <div className="flex flex-col gap-12">
            <div>
              <h2 className="text-[18px] font-semibold text-white mb-2">Endpoint Contracts</h2>
              <p className="text-[13px] text-[#8b8b8b] mb-6">Review parameters and examples validated against machine-readable contracts.</p>
            </div>
            
            {endpoints.map((ep, idx) => (
              <EndpointBlock key={idx} ep={ep} spec={spec} />
            ))}
          </div>
        )}

        {activeTab === 'gov' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-[#2e2e2e] pb-4 mb-2">
              <div>
                <h2 className="text-[18px] font-semibold text-white">Interoperability & Data Protection Compliance</h2>
                <p className="text-[13px] text-[#8b8b8b] mt-0.5">Formal statements aligning sharing with the Data Protection and Privacy Act, 2019.</p>
              </div>
              <div className="flex gap-4 print:hidden">
                <button 
                  onClick={() => setShowPrintView(true)}
                  className="h-[32px] px-3 border border-[#2e2e2e] hover:bg-[#2e2e2e] text-white text-[12.5px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Print Compliance Sheet</span>
                </button>
                <button 
                  onClick={() => window.print()}
                  className="h-[32px] px-3 border border-[#2e2e2e] hover:bg-[#2e2e2e] text-white text-[12.5px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Print Executive Summary</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Authority & Scope */}
              <div className="p-6 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex flex-col gap-4">
                <h3 className="text-[14px] font-bold text-white flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
                  <IconBuildingBank className="w-4.5 h-4.5 text-[#3ecf8e]" />
                  Registry Authority
                </h3>
                <div className="flex flex-col gap-3.5 text-[13px]">
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">Data Owner (Controller)</span>
                    <span className="text-white font-medium">
                      {api.owning_mda_id === 'mda-01' ? 'National Identification and Registration Authority (NIRA)' :
                       api.owning_mda_id === 'mda-02' ? 'Uganda Revenue Authority (URA)' :
                       api.owning_mda_id === 'mda-03' ? 'Uganda Registration Services Bureau (URSB)' :
                       api.owning_mda_id === 'mda-04' ? 'Ministry of Works and Transport (MoWT)' : 
                       'Ministry of ICT and National Guidance (MoICT)'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">Technical Steward</span>
                    <span className="text-white font-medium">{api.technical_owner}</span>
                  </div>
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">Administrative Contact</span>
                    <span className="text-white font-medium font-mono text-[12px]">{api.contact_office}</span>
                  </div>
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">Compliance Status</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border uppercase
                      ${api.compliance_status === 'Approved for Production' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' : 
                        api.compliance_status === 'Approved for Sandbox' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' : 
                        api.compliance_status === 'Under Review' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5' :
                        'text-gray-400 border-gray-400/20 bg-gray-400/5'}
                    `}>
                      {api.compliance_status || 'Draft'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Legal Stance */}
              <div className="p-6 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex flex-col gap-4">
                <h3 className="text-[14px] font-bold text-white flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
                  <IconFileCertificate className="w-4.5 h-4.5 text-[#3ecf8e]" />
                  Statutory Authorization
                </h3>
                <div className="flex flex-col gap-3.5 text-[13px]">
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">Legal Sharing Basis</span>
                    <span className="text-white font-serif italic">"{api.statutory_basis}"</span>
                  </div>
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">Security Classification</span>
                    <span className="text-white font-semibold">{api.security_classification}</span>
                  </div>
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono">SLA & Latency Target</span>
                    <span className="text-white font-medium">{api.sla_target}</span>
                  </div>
                </div>
              </div>

              {/* Stance Card: Full width */}
              <div className="md:col-span-2 p-6 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex flex-col gap-5">
                <h3 className="text-[14px] font-bold text-white flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
                  <IconShieldCheck className="w-4.5 h-4.5 text-[#3ecf8e]" />
                  Purpose Limitation & Data Protection
                </h3>
                
                <div className="flex flex-col gap-4 text-[13px] leading-relaxed">
                  <div>
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono mb-0.5">Purpose Limitation Statement</span>
                    <p className="text-white">{api.purpose_limitation}</p>
                  </div>
                  <div className="border-t border-[#2e2e2e] pt-4">
                    <span className="block text-[#8b8b8b] text-[11px] uppercase tracking-wider font-mono mb-0.5">Data Minimization Design Note</span>
                    <p className="text-white">{api.data_minimization_note}</p>
                  </div>
                  <div className="border-t border-[#2e2e2e] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wider font-mono mb-0.5">Personal Data Elements Exposes</span>
                      <p className="text-white font-medium">{api.personal_data_categories}</p>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wider font-mono mb-0.5">Retention Class</span>
                      <p className="text-[#3ecf8e] font-semibold">{api.retention_class}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'try' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-[18px] font-semibold text-white mb-2">Sandbox Console Simulator</h2>
              <p className="text-[13px] text-[#8b8b8b] mb-6">Interact with mock endpoints in real-time. Use generated key tokens or trigger anonymous request errors.</p>
            </div>
            
            <SandboxTryItConsole api={api} endpoints={endpoints} spec={spec} />
          </div>
        )}
      </div>
    </div>
  );
}
