import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconBuildingBank,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconFileCertificate,
  IconFileText,
  IconGitBranch,
  IconLock,
  IconPlayerPlay,
  IconShieldCheck,
  IconTerminal2,
  IconTrash,
} from '@tabler/icons-react';
import { API_BASE } from '@/lib/api-base';
import { useUser } from '../../context/UserContext';
import { AdminApiEditorModal } from './AdminApiEditorModal';
import { ApiDetailErrorState, ApiDetailLoadingState } from './ApiDetailStates';
import { APIPrintSummary } from './APIPrintSummary';
import { DeleteApiModal } from './DeleteApiModal';
import { EndpointBlock } from './EndpointBlock';
import { PublishVersionModal } from './PublishVersionModal';
import { RequestAccessModal } from './RequestAccessModal';
import { SandboxClientModal } from './SandboxClientModal';
import { getRequestAccessButtonState, isAccessRequestForConsumer, sensitivityBadgeClass } from './catalog-shared';
import type { ApiVersion } from './api-detail-helpers';

export function ApiDetail() {
  const { id } = useParams();
  const { role, mdaId, user } = useUser();
  const [api, setApi] = useState<any>(null);
  const [spec, setSpec] = useState<any>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [publishingVersion, setPublishingVersion] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'docs' | 'gov' | 'try'>('docs');
  const [showPrintView, setShowPrintView] = useState(false);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');

  const fetchVersions = useCallback(() => {
    if (!id) return;

      fetch(`${API_BASE}/api/catalog/${id}/versions`)
      .then(async res => {
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data.error || 'Failed to load API versions.');
        return data;
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setVersions(list);
        setSelectedVersion(current => {
          if (current && list.some((version: ApiVersion) => version.version === current)) return current;
          const active = list.find((version: ApiVersion) => version.is_current) || list[0];
          return active?.version || '';
        });
      })
      .catch(err => console.error(err));
  }, [id]);

  const fetchApi = useCallback(() => {
    setLoadError('');
    fetch(`${API_BASE}/api/catalog/${id}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load API details.');
        return data;
      })
      .then(data => {
        setApi(data);
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load API details.'));
  }, [id]);

  useEffect(() => {
    fetchApi();
    fetchVersions();
  }, [fetchApi, fetchVersions]);

  useEffect(() => {
    if (!id) return;
    setSpec(null);
    const params = selectedVersion ? `?version=${encodeURIComponent(selectedVersion)}` : '';
    fetch(`${API_BASE}/api/catalog/${id}/spec${params}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load OpenAPI spec.');
        return data;
      })
      .then(data => setSpec(data))
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load OpenAPI spec.'));
  }, [id, selectedVersion]);

  const fetchAccessRequests = useCallback(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/access`)
      .then(async res => {
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      })
      .then(data => setAccessRequests(data))
      .catch(() => setAccessRequests([]));
  }, [id]);

  useEffect(() => {
    fetchAccessRequests();
  }, [fetchAccessRequests, role, mdaId]);

  if (loadError) {
    return <ApiDetailErrorState message={loadError} />;
  }

  if (!api || !spec) {
    return <ApiDetailLoadingState />;
  }

  const activeVersion = versions.find(version => version.version === selectedVersion);
  const canManageCurrentApi = role === 'admin' || (role === 'api_owner' && api?.owning_mda_id === mdaId);
  const isHighSensitivityApi = String(api.sensitivity_level || '').toLowerCase().includes('high');
  const currentApiAccessRequests = accessRequests.filter(request =>
    isAccessRequestForConsumer(request, api.id, mdaId, user?.id)
  );
  const requestAccessButtonState = getRequestAccessButtonState(currentApiAccessRequests);
  const openRequestAccessModal = () => {
    if (!requestAccessButtonState.disabled) setIsModalOpen(true);
  };
  const requestAccessButtonClassName = requestAccessButtonState.disabled
    ? 'h-[30px] px-3 bg-[#2e2e2e] text-[#8b8b8b] font-medium rounded-[6px] text-[12.5px] transition-colors cursor-not-allowed'
    : 'h-[30px] px-3 bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-[6px] text-[12.5px] transition-colors';
  const requestAccessOverlayButtonClassName = requestAccessButtonState.disabled
    ? 'mt-5 inline-flex h-9 items-center rounded-md bg-[#2e2e2e] px-4 text-[13px] font-semibold text-[#8b8b8b] transition-colors cursor-not-allowed'
    : 'mt-5 inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90';
  const hasActiveApprovedAccess = currentApiAccessRequests.some(request =>
    request.status === 'APPROVED' &&
    request.api_key_preview &&
    (request.api_key_status || 'ACTIVE') === 'ACTIVE' &&
    (!request.api_key_expires_at || new Date(request.api_key_expires_at).getTime() > Date.now())
  );
  const canViewSensitiveApi = !isHighSensitivityApi || role === 'admin' || role === 'reviewer' || canManageCurrentApi || hasActiveApprovedAccess;
  const specUrl = `${API_BASE}${activeVersion?.openapi_spec_path || api.openapi_spec_path}`;
  const refreshDetail = () => {
    setIsEditOpen(false);
    fetchApi();
    fetchVersions();
    if (id) {
      const params = selectedVersion ? `?version=${encodeURIComponent(selectedVersion)}` : '';
      fetch(`${API_BASE}/api/catalog/${id}/spec${params}`)
        .then(async res => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to load OpenAPI spec.');
          return data;
        })
        .then(data => setSpec(data))
        .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load OpenAPI spec.'));
    }
  };
  const handleVersionPublished = async (version: string) => {
    setPublishingVersion(true);
    setIsPublishOpen(false);
    await fetchVersions();
    setSelectedVersion(version);
    setPublishingVersion(false);
  };
  const endpoints: any[] = [];

  const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
  if (spec.paths) {
    Object.keys(spec.paths).forEach(path => {
      const methods = spec.paths[path];
      const pathParameters = Array.isArray(methods.parameters) ? methods.parameters : [];
      Object.keys(methods).forEach(method => {
        const methodName = method.toLowerCase();
        if (!httpMethods.has(methodName)) return;
        const operation = methods[method];
        endpoints.push({
          path,
          method: methodName.toUpperCase(),
          data: {
            ...operation,
            parameters: [...pathParameters, ...(Array.isArray(operation?.parameters) ? operation.parameters : [])],
          }
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
    <div className="text-left w-full max-w-[1400px] mx-auto text-[#ededed] flex h-full min-h-0 flex-col overflow-hidden">
      {isModalOpen && <RequestAccessModal api={api} onClose={() => setIsModalOpen(false)} onSubmitted={fetchAccessRequests} />}
      {isEditOpen && <AdminApiEditorModal api={api} spec={spec} onClose={() => setIsEditOpen(false)} onSaved={refreshDetail} />}
      {isPublishOpen && id && <PublishVersionModal apiId={id} onClose={() => setIsPublishOpen(false)} onPublished={handleVersionPublished} />}
      {isDeleteOpen && <DeleteApiModal api={api} onClose={() => setIsDeleteOpen(false)} />}

      {/* Header Area */}
      <div className="shrink-0 px-3 lg:px-5 py-3 border-b border-[#2e2e2e] bg-[#1c1c1c]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-[#8b8b8b] hover:text-white transition-colors">
            <IconArrowLeft className="w-4 h-4" /> Back to Catalog
          </Link>

          <div className="flex items-center gap-3">
            {canManageCurrentApi && (
              <>
                <button
                  type="button"
                  disabled={publishingVersion}
                  onClick={() => setIsPublishOpen(true)}
                  className="h-[30px] px-3 flex items-center gap-2 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[12.5px] font-medium text-[#ededed] transition-colors disabled:opacity-50"
                >
                  <IconGitBranch className="w-4 h-4 text-[#8b8b8b]" />
                  {publishingVersion ? 'Publishing...' : 'Publish Version'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="h-[30px] px-3 flex items-center gap-2 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[12.5px] font-medium text-[#ededed] transition-colors"
                >
                  <IconEdit className="w-4 h-4 text-[#8b8b8b]" />
                  Edit API
                </button>
              </>
            )}
            {role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(true)}
                  className="h-[30px] px-3 flex items-center gap-2 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 rounded-[6px] text-[12.5px] font-medium text-red-300 transition-colors disabled:opacity-50"
                >
                  <IconTrash className="w-4 h-4" />
                  Delete API
                </button>
              </>
            )}
            <a
              href={specUrl}
              download
              className="h-[30px] px-3 flex items-center gap-2 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[12.5px] font-medium text-[#ededed] transition-colors"
            >
              <IconDownload className="w-4 h-4 text-[#8b8b8b]" /> Download Spec
            </a>
            <Link
              to={`/docs/${api.id}`}
              className="h-[30px] px-3 flex items-center gap-2 border border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#2e2e2e] rounded-[6px] text-[12.5px] font-medium text-[#ededed] transition-colors"
            >
              <IconExternalLink className="w-4 h-4 text-[#8b8b8b]" /> API Docs
            </Link>
            <button
              type="button"
              onClick={openRequestAccessModal}
              disabled={requestAccessButtonState.disabled}
              title={requestAccessButtonState.title}
              className={requestAccessButtonClassName}
            >
              {requestAccessButtonState.label}
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
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border uppercase ${sensitivityBadgeClass(api.sensitivity_level)}`}>
            SENSITIVITY: {api.sensitivity_level}
          </span>
          {versions.length > 0 && (
            <label className="inline-flex h-[28px] items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] pl-2 pr-1 text-[12px] text-[#8b8b8b]">
              <IconGitBranch className="h-3.5 w-3.5 text-[#3ecf8e]" />
              <select
                aria-label="API version"
                value={selectedVersion}
                onChange={event => setSelectedVersion(event.target.value)}
                className="h-[24px] min-w-[92px] bg-transparent text-[12px] font-medium text-[#ededed] focus:outline-none"
              >
                {versions.map(version => (
                  <option key={version.id} value={version.version} className="bg-[#1c1c1c] text-white">
                    v{version.version}{version.is_current ? ' current' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[14.5px] text-[#8b8b8b] max-w-4xl leading-relaxed">{api.description}</p>
          {activeVersion && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8b8b8b]">
              <span className="font-mono">OpenAPI {activeVersion.openapi_version}</span>
              <span className="text-[#444]">/</span>
              <span>{activeVersion.endpoints_count} endpoints</span>
              <span className="text-[#444]">/</span>
              <span className="font-mono">{activeVersion.spec_sha.slice(0, 10)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="shrink-0 border-b border-[#2e2e2e] bg-[#141414] px-3 lg:px-5 flex gap-1">
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
          onClick={() => {
            setActiveTab('try');
            setIsSandboxOpen(true);
          }}
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
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#181818]/30">
        <div className={`h-full ${canViewSensitiveApi ? '' : 'pointer-events-none select-none blur-sm opacity-30'}`}>
        {activeTab === 'docs' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 px-3 lg:px-5 py-4">
              <h2 className="text-[18px] font-semibold text-white mb-2">Endpoint Contracts</h2>
              <p className="text-[13px] text-[#8b8b8b]">Review parameters and examples validated against machine-readable contracts.</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 lg:px-5 pb-4 pt-8">
              <div className="flex flex-col gap-12">
                {endpoints.map((ep) => (
                  <EndpointBlock key={`${selectedVersion}-${ep.method}-${ep.path}`} ep={ep} spec={spec} apiId={api.id} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gov' && (
          <div className="flex h-full min-h-0 w-full flex-col">
            <div className="shrink-0 px-3 lg:px-5 py-4">
              <div className="flex justify-between items-center border-b border-[#2e2e2e] pb-4">
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 lg:px-5 pb-4 pt-3">
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
                      {api.owning_mda_id === 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' ? 'National Identification and Registration Authority (NIRA)' :
                       api.owning_mda_id === 'mda-ura-2efff0d3-952e-4475-8231-232873a69854' ? 'Uganda Revenue Authority (URA)' :
                       api.owning_mda_id === 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5' ? 'Uganda Registration Services Bureau (URSB)' :
                       api.owning_mda_id === 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7' ? 'Ministry of Works and Transport (MoWT)' :
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
          </div>
        )}

        {activeTab === 'try' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 px-3 lg:px-5 py-4">
              <h2 className="text-[18px] font-semibold text-white mb-1">Sandbox Console Simulator</h2>
              <p className="text-[13px] text-[#8b8b8b]">Open the sandbox in a front-of-screen client panel so requests, parameters, and responses stay visible.</p>
            </div>

            <div className="min-h-0 flex-1 px-3 lg:px-5 pb-4 pt-1">
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-[#2e2e2e] bg-[#141414] px-6 text-center shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]">
                  <IconTerminal2 className="h-6 w-6" />
                </div>
                <h3 className="text-[16px] font-semibold text-white">Launch Sandbox Client</h3>
                <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#8b8b8b]">
                  The simulator opens as a bottom popout, keeping the request builder and response console in view.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSandboxOpen(true)}
                  className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90"
                >
                  <IconPlayerPlay className="h-4 w-4 fill-black" />
                  Open Sandbox Simulator
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        {!canViewSensitiveApi && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#181818]/45 px-4 backdrop-blur-[2px]">
            <div className="flex max-w-md flex-col items-center rounded-xl border border-red-400/25 bg-[#141414]/95 p-6 text-center shadow-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10 text-red-300">
                <IconLock className="h-6 w-6" />
              </div>
              <h2 className="text-[17px] font-semibold text-white">Access required for high sensitivity API</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#b5b5b5]">
                This API contains high-sensitivity data contracts. Request and receive approval before viewing technical details or using the sandbox.
              </p>
              <button
                type="button"
                onClick={openRequestAccessModal}
                disabled={requestAccessButtonState.disabled}
                title={requestAccessButtonState.title}
                className={requestAccessOverlayButtonClassName}
              >
                {requestAccessButtonState.label}
              </button>
            </div>
          </div>
        )}
      </div>
      <SandboxClientModal
        open={canViewSensitiveApi && isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        api={api}
        endpoints={endpoints}
        spec={spec}
      />
    </div>
  );
}
