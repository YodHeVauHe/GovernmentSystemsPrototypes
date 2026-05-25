import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconCheck, IconCircleCheck, IconCode, IconLink, IconLoader, IconUpload } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useNotifications } from '../context/NotificationContext';
import { API_BASE } from '@/lib/api-base';

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};

export function AddApiPage() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [activeSourceTab, setActiveSourceTab] = useState<'url' | 'file' | 'text'>('url');
  const [specUrl, setSpecUrl] = useState('');
  const [specText, setSpecText] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [parsedSpec, setParsedSpec] = useState<any>(null);
  
  // Governance Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [accessLevel, setAccessLevel] = useState<'Public' | 'Restricted' | 'Private'>('Restricted');
  const [owningMdaId, setOwningMdaId] = useState('mda-01');
  const [sector, setSector] = useState('Identity');
  const [description, setDescription] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState('Draft');
  const [sensitivityLevel, setSensitivityLevel] = useState('Medium');
  const [sandboxAvailable, setSandboxAvailable] = useState(true);
  const [requiredApprovalLevel, setRequiredApprovalLevel] = useState('Technical Director');
  const [contactOffice, setContactOffice] = useState('api.support@nira.go.ug');
  const [technicalOwner, setTechnicalOwner] = useState('Systems Engineering');
  const [personalDataCategories, setPersonalDataCategories] = useState('NIN, Birthdate');
  const [purposeLimitation, setPurposeLimitation] = useState('Identity validation only');
  const [dataMinimizationNote, setDataMinimizationNote] = useState('Only returns Boolean match statuses');
  const [retentionClass, setRetentionClass] = useState('No persistent logging of citizen variables');
  const [statutoryBasis, setStatutoryBasis] = useState('Registration of Persons Act 2015');
  const [securityClassification, setSecurityClassification] = useState('Restricted');
  const [slaTarget, setSlaTarget] = useState('99.9% Uptime, <200ms latency');
  const [complianceStatus, setComplianceStatus] = useState('Draft');

  const getMdaShortName = (id: string) => {
    const mdaMap: Record<string, string> = {
      'mda-01': 'nira',
      'mda-02': 'ura',
      'mda-03': 'ursb',
      'mda-04': 'mowt',
      'mda-05': 'moict',
      'mda-06': 'moh'
    };
    return mdaMap[id] || 'mda';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSpecText(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleValidateSpec = async () => {
    setLoading(true);
    setValidationError('');
    try {
      const response = await fetch(`${API_BASE}/api/catalog/validate-spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specText: activeSourceTab !== 'url' ? specText : undefined,
          specUrl: activeSourceTab === 'url' ? specUrl : undefined
        })
      });
      const data = await response.json();
      if (!response.ok || !data.valid) {
        throw new Error(data.error || 'Failed to parse OpenAPI document.');
      }

      setParsedSpec(data);
      setName(data.metadata.title);
      setSlug(slugify(data.metadata.title));
      setDescription(data.metadata.description);
    } catch (err: any) {
      setValidationError(err.message || 'Validation failed. Ensure YAML/JSON is syntactically valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterApi = async () => {
    setLoading(true);
    // Resolve dynamic access override mappings for GovHub docs and access policy.
    let finalSecurity = securityClassification;
    let finalApproval = requiredApprovalLevel;
    if (accessLevel === 'Public') {
      finalSecurity = 'Public';
      finalApproval = 'None';
    } else if (accessLevel === 'Restricted') {
      finalSecurity = 'Official';
      finalApproval = 'Director General';
    } else if (accessLevel === 'Private') {
      finalSecurity = 'Restricted';
      finalApproval = 'Cabinet';
    }

    try {
      const response = await fetch(`${API_BASE}/api/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          owning_mda_id: owningMdaId,
          sector,
          description,
          lifecycle_status: lifecycleStatus,
          sensitivity_level: sensitivityLevel,
          sandbox_available: sandboxAvailable,
          openapi_spec: parsedSpec.rawSpec,
          required_approval_level: finalApproval,
          contact_office: contactOffice,
          technical_owner: technicalOwner,
          personal_data_categories: personalDataCategories,
          purpose_limitation: purposeLimitation,
          data_minimization_note: dataMinimizationNote,
          retention_class: retentionClass,
          statutory_basis: statutoryBasis,
          security_classification: finalSecurity,
          sla_target: slaTarget,
          compliance_status: complianceStatus
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register API.');
      }
      toast.success('API Catalog entry created successfully!');
      addNotification({
        type: 'api',
        title: 'API created',
        message: `${name} was added to the API catalog.`,
      });
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const publishPreview = `govhub.go.ug/${getMdaShortName(owningMdaId)}/${slug || 'pets-api'}@${parsedSpec?.metadata?.version || '1.0.0'}`;

  return (
    <div className="h-full overflow-hidden">
      <div className="w-full max-w-[1280px] h-full mx-auto p-3 lg:p-5 text-[#ededed] flex flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] text-[#8b8b8b] hover:text-white transition-colors">
          <IconArrowLeft className="w-3.5 h-3.5" />
          Back to API Catalog
        </Link>
        <Link to="/" className="h-[32px] px-3 border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] rounded-md text-[13px] transition-colors inline-flex items-center justify-center">
          Cancel
        </Link>
      </div>

      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-lg w-full shadow-2xl p-5 lg:p-7 flex min-h-0 flex-1 flex-col overflow-hidden">
        
        {/* Title */}
        <div className="shrink-0 border-b border-[#2e2e2e] pb-5 mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-white">
              Register New API
            </h1>
            <p className="text-[13px] text-[#8b8b8b] mt-1 max-w-2xl">
              Import an OpenAPI document, validate it, then complete the governance metadata for registry activation.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {!parsedSpec ? (
            /* PHASE 1: LOAD & VALIDATE */
            <div className="flex min-h-full flex-col">
              <div className="space-y-4">
                <p className="text-[13px] text-[#8b8b8b]">
                  Import the API OpenAPI Specification file. The GovHub validation engine will extract structure and endpoints to prepare compliance sheets.
                </p>

                {/* Tabs */}
                <div className="flex bg-[#141414] p-1 rounded-lg border border-[#2e2e2e] text-[13px]">
                  <button
                    type="button"
                    onClick={() => { setActiveSourceTab('url'); setValidationError(''); }}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${activeSourceTab === 'url' ? 'bg-[#2e2e2e] text-white border border-[#3e3e3e]' : 'text-[#8b8b8b] hover:text-white'}`}
                  >
                    <IconLink className="w-3.5 h-3.5" /> Spec URL
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveSourceTab('file'); setValidationError(''); }}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${activeSourceTab === 'file' ? 'bg-[#2e2e2e] text-white border border-[#3e3e3e]' : 'text-[#8b8b8b] hover:text-white'}`}
                  >
                    <IconUpload className="w-3.5 h-3.5" /> Upload Spec
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveSourceTab('text'); setValidationError(''); }}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${activeSourceTab === 'text' ? 'bg-[#2e2e2e] text-white border border-[#3e3e3e]' : 'text-[#8b8b8b] hover:text-white'}`}
                  >
                    <IconCode className="w-3.5 h-3.5" /> Raw Code
                  </button>
                </div>

                {/* Inputs */}
                {activeSourceTab === 'url' && (
                  <div className="space-y-2">
                    <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">OpenAPI URL</label>
                    <input
                      type="url"
                      placeholder="https://raw.githubusercontent.com/OAS/main/spec.yaml"
                      value={specUrl}
                      onChange={(e) => setSpecUrl(e.target.value)}
                      className="w-full h-[38px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#3ecf8e] transition-colors"
                    />
                  </div>
                )}

                {activeSourceTab === 'file' && (
                  <div className="space-y-2">
                    <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Upload YAML or JSON Specification</label>
                    <div className="border border-dashed border-[#2e2e2e] hover:border-[#3ecf8e] bg-[#141414] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors relative">
                      <input
                        type="file"
                        accept=".yaml,.yml,.json"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <IconUpload className="w-8 h-8 text-[#8b8b8b] mb-2" />
                      <span className="text-[13px] text-white font-medium">Click or drop YAML/JSON here</span>
                      <span className="text-[11px] text-[#8b8b8b] mt-1">Accepts standard .yaml, .yml, or .json</span>
                    </div>
                    {specText && (
                      <div className="bg-[#1c1c1c] border border-[#2e2e2e] p-2.5 rounded-md text-[11px] text-[#3ecf8e] font-mono flex items-center gap-1.5">
                        <IconCheck className="w-3.5 h-3.5" /> Spec loaded cleanly ({specText.length} characters)
                      </div>
                    )}
                  </div>
                )}

                {activeSourceTab === 'text' && (
                  <div className="space-y-2">
                    <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Pasted Raw YAML/JSON Specification</label>
                    <textarea
                      placeholder="openapi: 3.0.0&#10;info:&#10;  title: Citizen Data Lookup API&#10;..."
                      value={specText}
                      onChange={(e) => setSpecText(e.target.value)}
                      rows={8}
                      className="w-full p-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] font-mono text-white focus:outline-none focus:border-[#3ecf8e] transition-colors resize-y"
                    />
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4">
                {validationError && (
                  <div className="mb-3 p-3 bg-red-950/20 border border-red-500/30 text-red-400 rounded-lg text-[12px]">
                    <span className="font-semibold block mb-0.5">OpenAPI Validation Failed</span>
                    {validationError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleValidateSpec}
                  disabled={loading || (activeSourceTab === 'url' ? !specUrl : !specText)}
                  className="w-full h-[38px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-semibold rounded-md text-[13px] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <IconLoader className="w-4 h-4 animate-spin text-black" /> : <IconCheck className="w-4 h-4" />}
                  Validate OpenAPI Specification
                </button>
              </div>
            </div>
          ) : (
            /* PHASE 2: METADATA & COMPLIANCE REGISTRATION FORM */
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
              <div className="space-y-3 lg:sticky lg:top-0 self-start">
                {/* Checked Banner */}
                <div className="px-3 py-2 bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 text-[#3ecf8e] rounded-lg text-[12px] flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconCircleCheck className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">OpenAPI Validated</span>
                    <span className="text-[#3ecf8e]/80">v{parsedSpec.metadata.version}</span>
                  </div>
                  <span className="shrink-0 font-semibold bg-[#3ecf8e]/20 px-2 py-0.5 rounded-full">
                    {parsedSpec.metadata.endpointsCount} endpoints
                  </span>
                </div>

                <aside className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-4 space-y-4">
                  <div>
                    <div className="text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider mb-1">Validated Document</div>
                    <div className="text-[15px] font-semibold text-white break-words">{parsedSpec.metadata.title}</div>
                    <div className="text-[12px] text-[#8b8b8b] mt-1">OpenAPI {parsedSpec.metadata.version}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-3">
                      <div className="text-[11px] text-[#8b8b8b] font-mono uppercase tracking-wider">Endpoints</div>
                      <div className="text-[20px] font-semibold text-[#3ecf8e] mt-1">{parsedSpec.metadata.endpointsCount}</div>
                    </div>
                    <div className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-3">
                      <div className="text-[11px] text-[#8b8b8b] font-mono uppercase tracking-wider">Status</div>
                      <div className="text-[13px] font-semibold text-white mt-2">{complianceStatus}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider mb-1">Registry Coordinate</div>
                    <div className="text-[12px] font-mono text-[#3ecf8e] break-all">{publishPreview}</div>
                  </div>
                </aside>
              </div>

              <div className="space-y-4 min-w-0">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">API Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSlug(slugify(e.target.value));
                    }}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#3ecf8e]"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Slug Coordinate</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#3ecf8e]"
                  />
                </div>

                {/* Owning MDA */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Owning MDA Namespace</label>
                  <select
                    value={owningMdaId}
                    onChange={(e) => setOwningMdaId(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  >
                    <option value="mda-01">NIRA (National ID Authority)</option>
                    <option value="mda-02">URA (Uganda Revenue Authority)</option>
                    <option value="mda-03">URSB (Business Registry)</option>
                    <option value="mda-04">MoWT (Ministry of Transport)</option>
                    <option value="mda-05">MoICT (Ministry of ICT)</option>
                    <option value="mda-06">MoH (Ministry of Health)</option>
                  </select>
                </div>

                {/* Access Level Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Access Control Level</label>
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value as any)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  >
                    <option value="Public">Public (Open Registry Access)</option>
                    <option value="Restricted">Restricted (Legal Mandate Approval)</option>
                    <option value="Private">Private (Internal MDA Lock)</option>
                  </select>
                </div>

                {/* Coordinate Preview Banner */}
                <div className="md:col-span-2 p-3 bg-[#141414] border border-[#2e2e2e] rounded-lg">
                  <span className="text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider block mb-1">
                    Publishing Registry Coordinate Preview
                  </span>
                  <span className="text-[13px] font-mono text-[#3ecf8e] break-all">
                    {publishPreview}
                  </span>
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">API Functional Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full p-2.5 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  />
                </div>

                {/* Sector */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Sector</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  />
                </div>

                {/* SLA Target */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">SLA Target</label>
                  <input
                    type="text"
                    value={slaTarget}
                    onChange={(e) => setSlaTarget(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  />
                </div>

                {/* Lifecycle Status */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Lifecycle Status</label>
                  <select
                    value={lifecycleStatus}
                    onChange={(e) => setLifecycleStatus(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Beta">Beta</option>
                    <option value="Production">Production</option>
                  </select>
                </div>

                {/* Compliance Status */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">GovHub Compliance Status</label>
                  <select
                    value={complianceStatus}
                    onChange={(e) => setComplianceStatus(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved for Sandbox">Approved for Sandbox</option>
                    <option value="Approved for Production">Approved for Production</option>
                  </select>
                </div>

                {/* Sensitivity Level */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Sensitivity Level</label>
                  <select
                    value={sensitivityLevel}
                    onChange={(e) => setSensitivityLevel(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  >
                    <option value="Low">Low (Public Data)</option>
                    <option value="Medium">Medium (Corporate Data)</option>
                    <option value="High">High (PII Personal Data)</option>
                  </select>
                </div>

                {/* Security Classification */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Security Classification</label>
                  <select
                    value={securityClassification}
                    onChange={(e) => setSecurityClassification(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  >
                    <option value="Public">Public</option>
                    <option value="Official">Official</option>
                    <option value="Restricted">Restricted</option>
                    <option value="Confidential">Confidential</option>
                  </select>
                </div>

                {/* Contact Office */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Contact Office Email</label>
                  <input
                    type="email"
                    value={contactOffice}
                    onChange={(e) => setContactOffice(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white"
                  />
                </div>

                {/* Technical Owner */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Technical Owner Team</label>
                  <input
                    type="text"
                    value={technicalOwner}
                    onChange={(e) => setTechnicalOwner(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white"
                  />
                </div>

                {/* Statutory Legal Basis */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Statutory / Legal Basis (Enabling Legislation)</label>
                  <input
                    type="text"
                    value={statutoryBasis}
                    onChange={(e) => setStatutoryBasis(e.target.value)}
                    placeholder="e.g. Registration of Persons Act 2015, Section 65"
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  />
                </div>

                {/* Required Approval Level */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Required Approving Authority Tier</label>
                  <input
                    type="text"
                    value={requiredApprovalLevel}
                    onChange={(e) => setRequiredApprovalLevel(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none"
                  />
                </div>

                {/* Sandbox Available */}
                <div className="md:col-span-2 flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="sandboxAvailable"
                    checked={sandboxAvailable}
                    onChange={(e) => setSandboxAvailable(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-[#2e2e2e] bg-[#141414] text-[#3ecf8e] focus:ring-[#3ecf8e]"
                  />
                  <label htmlFor="sandboxAvailable" className="text-[13px] text-white font-medium select-none cursor-pointer">
                    Enable Interoperability Sandbox Mock APIs Instantly
                  </label>
                </div>

                {/* Governance Details Block */}
                <div className="md:col-span-2 border-t border-[#2e2e2e] pt-4 mt-2">
                  <h3 className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider mb-3">DPPO Compliance & Governance Safeguards</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Personal Data Categories Collected</label>
                      <input
                        type="text"
                        value={personalDataCategories}
                        onChange={(e) => setPersonalDataCategories(e.target.value)}
                        className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Purpose Limitation Rule</label>
                      <input
                        type="text"
                        value={purposeLimitation}
                        onChange={(e) => setPurposeLimitation(e.target.value)}
                        className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Data Minimization Safeguards</label>
                      <input
                        type="text"
                        value={dataMinimizationNote}
                        onChange={(e) => setDataMinimizationNote(e.target.value)}
                        className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Data Retention Classification</label>
                      <input
                        type="text"
                        value={retentionClass}
                        onChange={(e) => setRetentionClass(e.target.value)}
                        className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="border-t border-[#2e2e2e] pt-4 mt-6 flex justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setParsedSpec(null)}
                  className="h-[38px] px-4 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-white font-semibold rounded-md text-[13px] transition-colors"
                >
                  Change Specification
                </button>

                <button
                  type="button"
                  onClick={handleRegisterApi}
                  disabled={loading}
                  className="flex-1 h-[38px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-semibold rounded-md text-[13px] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <IconLoader className="w-4 h-4 animate-spin text-black" />}
                  Register & Activate API
                </button>
              </div>

            </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
