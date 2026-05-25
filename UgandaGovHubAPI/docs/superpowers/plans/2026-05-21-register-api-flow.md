# API Registration & Validation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a high-fidelity API registration modal that lets admins validate OpenAPI specs (via URLs, uploaded files, or raw content) and register them as first-class citizens in the Uganda GovHub database with strict compliance parameters.

**Architecture:** A lightweight backend validator checks the uploaded or downloaded spec for standard OpenAPI compliance using `js-yaml`, returning parsed metadata to pre-populate the registry configuration form. Upon admin approval, the backend writes the YAML file to `backend/openapi/`, registers the SQLite database row, and records the `API_REGISTERED` audit log.

**Tech Stack:** React, Tailwind CSS, Lucide icons, Express, SQLite, js-yaml.

---

### Task 1: Backend Specification Validation Route

**Files:**
- Modify: `backend/src/index.ts`
- Test: Use a simple manual `curl` validation request.

- [ ] **Step 1: Implement the `/api/catalog/validate-spec` endpoint**

Add the endpoint below in `backend/src/index.ts` right before the server listens or alongside catalog routes:

```typescript
app.post('/api/catalog/validate-spec', async (req, res) => {
  const { specText, specUrl } = req.body;
  try {
    let content = specText || '';
    if (specUrl) {
      const response = await fetch(specUrl);
      if (!response.ok) {
        return res.status(400).json({ valid: false, error: `Failed to fetch spec from URL: ${response.statusText}` });
      }
      content = await response.text();
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ valid: false, error: 'Empty specification content.' });
    }

    let parsed: any;
    try {
      // Try JSON first, fallback to YAML
      parsed = JSON.parse(content);
    } catch {
      try {
        parsed = yaml.load(content);
      } catch (yamlErr: any) {
        return res.status(400).json({ valid: false, error: `Failed to parse YAML/JSON: ${yamlErr.message}` });
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(400).json({ valid: false, error: 'Specification parsed to an invalid object.' });
    }

    const openapiVersion = parsed.openapi || parsed.swagger;
    if (!openapiVersion) {
      return res.status(400).json({ valid: false, error: 'Invalid specification: missing "openapi" or "swagger" version declaration.' });
    }

    const info = parsed.info;
    if (!info || !info.title) {
      return res.status(400).json({ valid: false, error: 'Invalid specification: missing "info.title" metadata.' });
    }

    const paths = parsed.paths || {};
    const endpointsCount = Object.keys(paths).reduce((count, path) => {
      const methods = Object.keys(paths[path]).filter(method => 
        ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())
      );
      return count + methods.length;
    }, 0);

    res.json({
      valid: true,
      metadata: {
        title: info.title,
        version: info.version || '1.0.0',
        description: info.description || '',
        endpointsCount
      },
      rawSpec: content
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ valid: false, error: `Internal validation error: ${err.message}` });
  }
});
```

- [ ] **Step 2: Start backend server and test validation via curl**

Run:
```bash
npm --prefix backend run dev
```

In a separate terminal, test valid/invalid spec payloads:
```bash
curl -X POST http://localhost:4000/api/catalog/validate-spec \
  -H "Content-Type: application/json" \
  -d '{"specText": "openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0\npaths:\n  /test:\n    get:\n      responses:\n        200:\n          description: Success"}'
```
Expected output:
```json
{"valid":true,"metadata":{"title":"Test API","version":"1.0.0","description":"","endpointsCount":1},"rawSpec":"..."}
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/index.ts
git commit -m "feat(backend): add spec validation route"
```

---

### Task 2: Backend Catalog Creation & Audit Logging Route

**Files:**
- Modify: `backend/src/index.ts`
- Test: Test catalog post request.

- [ ] **Step 1: Implement the `/api/catalog` registration endpoint**

Add the endpoint in `backend/src/index.ts`:

```typescript
app.post('/api/catalog', (req, res) => {
  const {
    name,
    owning_mda_id,
    sector,
    description,
    lifecycle_status,
    sensitivity_level,
    sandbox_available,
    openapi_spec,
    required_approval_level,
    contact_office,
    technical_owner,
    personal_data_categories,
    purpose_limitation,
    data_minimization_note,
    retention_class,
    statutory_basis,
    security_classification,
    sla_target,
    compliance_status
  } = req.body;

  if (!name || !owning_mda_id || !openapi_spec) {
    return res.status(400).json({ error: 'Missing mandatory fields: name, owning_mda_id, and openapi_spec are required.' });
  }

  const id = `api-reg-${crypto.randomUUID()}`;
  const specFilename = `${id}.yaml`;
  const relativeSpecPath = `/openapi/${specFilename}`;
  const absoluteSpecPath = path.join(__dirname, '../openapi', specFilename);

  try {
    // Write OpenAPI file to disk
    fs.writeFileSync(absoluteSpecPath, openapi_spec, 'utf8');

    // Insert into SQLite database
    const stmt = db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, sector, description, lifecycle_status,
        sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level, contact_office,
        technical_owner, personal_data_categories, purpose_limitation, data_minimization_note,
        retention_class, statutory_basis, security_classification, sla_target, compliance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      name,
      owning_mda_id,
      sector || 'General',
      description || '',
      lifecycle_status || 'Draft',
      sensitivity_level || 'Medium',
      sandbox_available ? 1 : 0,
      relativeSpecPath,
      required_approval_level || 'General Public',
      contact_office || 'info@govhub.go.ug',
      technical_owner || 'GovHub Systems',
      personal_data_categories || '',
      purpose_limitation || '',
      data_minimization_note || '',
      retention_class || 'Default',
      statutory_basis || 'None',
      security_classification || 'Official',
      sla_target || '99.5%',
      compliance_status || 'Draft'
    );

    // Log the API registration event in audit log
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    const auditId = `audit-${Date.now()}`;
    auditStmt.run(
      auditId,
      'API_REGISTERED',
      owning_mda_id,
      id,
      JSON.stringify({
        api_name: name,
        registered_by_role: 'admin',
        sector,
        sensitivity_level
      })
    );

    res.status(201).json({ success: true, apiId: id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to register API: ${err.message}` });
  }
});
```

- [ ] **Step 2: Commit**
```bash
git add backend/src/index.ts
git commit -m "feat(backend): add API registry catalog route and audit logger"
```

---

### Task 3: Interactive AddApiModal & Catalog Integration

**Files:**
- Modify: `frontend/src/pages/Catalog.tsx`
- Test: Run the frontend application and test the entire "Add API" validation, preview, metadata form entry, submission, catalog table reload, and toast experience.

- [ ] **Step 1: Replace placeholder `AddApiModal` with high-fidelity validation modal**

Replace the existing `AddApiModal` component in `frontend/src/pages/Catalog.tsx` with this implementation:

```tsx
import { IconArrowLeft, IconUpload, IconCode, IconLink, IconCheck, IconLoader, IconPlus, IconGridDots, IconList, IconDownload } from '@tabler/icons-react';
import { toast } from 'sonner';

function AddApiModal({ onClose, onApiAdded }: { onClose: () => void; onApiAdded: () => void }) {
  const [activeSourceTab, setActiveSourceTab] = useState<'url' | 'file' | 'text'>('url');
  const [specUrl, setSpecUrl] = useState('');
  const [specText, setSpecText] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [parsedSpec, setParsedSpec] = useState<any>(null);
  
  // Governance Form Fields
  const [name, setName] = useState('');
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
      const response = await fetch('http://localhost:4000/api/catalog/validate-spec', {
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
      setDescription(data.metadata.description);
    } catch (err: any) {
      setValidationError(err.message || 'Validation failed. Ensure YAML/JSON is syntactically valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/api/catalog', {
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
          required_approval_level: requiredApprovalLevel,
          contact_office: contactOffice,
          technical_owner: technicalOwner,
          personal_data_categories: personalDataCategories,
          purpose_limitation: purposeLimitation,
          data_minimization_note: dataMinimizationNote,
          retention_class: retentionClass,
          statutory_basis: statutoryBasis,
          security_classification: securityClassification,
          sla_target: slaTarget,
          compliance_status: complianceStatus
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register API.');
      }
      toast.success('API Catalog entry created successfully!');
      onApiAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl w-full max-w-2xl shadow-2xl p-6 my-8 flex flex-col max-h-[90vh]">
        
        {/* Title */}
        <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-4 mb-4">
          <h2 className="text-[16px] font-medium text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#3ecf8e] rounded-full animate-pulse"></span>
            Register New API in GovHub Interoperability Registry
          </h2>
          <button onClick={onClose} className="text-[#8b8b8b] hover:text-white transition-colors text-[13px]">
            Cancel
          </button>
        </div>

        <div className="overflow-y-auto pr-1 flex-1 space-y-5">
          {!parsedSpec ? (
            /* PHASE 1: LOAD & VALIDATE */
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
                    placeholder="openapi: 3.0.0\ninfo:\n  title: Citizen Data Lookup API\n..."
                    value={specText}
                    onChange={(e) => setSpecText(e.target.value)}
                    rows={8}
                    className="w-full p-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] font-mono text-white focus:outline-none focus:border-[#3ecf8e] transition-colors resize-y"
                  />
                </div>
              )}

              {validationError && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 rounded-lg text-[12px]">
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
          ) : (
            /* PHASE 2: METADATA & COMPLIANCE REGISTRATION FORM */
            <div className="space-y-4">
              
              {/* Checked Banner */}
              <div className="p-3.5 bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 text-[#3ecf8e] rounded-lg text-[13px] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCheck className="w-4.5 h-4.5" />
                  <div>
                    <span className="font-semibold">OpenAPI Validated</span>: Version {parsedSpec.metadata.version}
                  </div>
                </div>
                <div className="text-[12px] font-semibold bg-[#3ecf8e]/20 px-2 py-0.5 rounded-full">
                  {parsedSpec.metadata.endpointsCount} Endpoints Found
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">API Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#3ecf8e]"
                  />
                </div>

                {/* Owning MDA */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Owning MDA</label>
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

                {/* Description */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">API Functional Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
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
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Connect the new callback in `Catalog` parent component**

Update the `<Catalog />` component call to add modal. Locate this line in `frontend/src/pages/Catalog.tsx`:

```tsx
{isAddApiModalOpen && <AddApiModal onClose={() => setIsAddApiModalOpen(false)} />}
```

And modify it to pass the fetch refresh callback:

```tsx
{isAddApiModalOpen && (
  <AddApiModal 
    onClose={() => setIsAddApiModalOpen(false)} 
    onApiAdded={() => {
      // Re-fetch catalog list
      fetch('http://localhost:4000/api/catalog')
        .then(res => res.json())
        .then(data => setApis(data))
        .catch(err => console.error(err));
    }}
  />
)}
```

- [ ] **Step 3: Commit all changes**
```bash
git add frontend/src/pages/Catalog.tsx
git commit -m "feat(frontend): replace AddApiModal with high-fidelity validation modal and registry configuration panel"
```
