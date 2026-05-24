import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IconBell,
  IconBuildingBank,
  IconClipboardCheck,
  IconFileCertificate,
  IconFingerprint,
  IconId,
  IconShieldCheck,
  IconUpload,
  IconCheck,
  IconLoader,
  IconFileText,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNotifications } from '@/context/NotificationContext';
import { useUser } from '@/context/UserContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type AccountSnapshot = {
  user: any;
  profile: Record<string, any>;
  documents: Array<Record<string, any>>;
  requirements: {
    label: string;
    description: string;
    requiredFields: Array<{ key: string; label: string }>;
    requiredDocuments: Array<{ type: string; label: string; accepts: string }>;
  };
  privileges: {
    accessGroup: string;
    permissions: string[];
    restrictions: string[];
  };
};

async function accountRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Account request failed.');
  return body;
}



function DocumentUploader({
  type,
  label,
  accepts,
  submittedDoc,
  onUploadComplete,
}: {
  type: string;
  label: string;
  accepts: string;
  submittedDoc?: Record<string, any>;
  onUploadComplete: (fileName: string, mimeType: string, storageRef: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localFile, setLocalFile] = useState<{ name: string; size: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Start simulated upload
    setUploading(true);
    setProgress(0);
    setLocalFile({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
    });

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setUploading(false);
        // Generate mock storage ref
        const storageRef = `s3://govhub-vault/docs/${type}_${Date.now()}_${file.name}`;
        onUploadComplete(file.name, file.type || 'application/pdf', storageRef);
      }
      setProgress(currentProgress);
    }, 100);
  };

  if (submittedDoc && !uploading) {
    return (
      <div className="rounded-lg border border-border bg-background/40 p-4 transition-all hover:bg-background/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#3ecf8e]/10 text-[#3ecf8e] flex items-center justify-center">
              <IconFileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">{label}</div>
              <div className="text-xs text-foreground-light font-mono truncate max-w-[200px] sm:max-w-md">
                {submittedDoc.file_name} · {submittedDoc.mime_type}
              </div>
              <div className="text-[10px] text-foreground-muted font-mono truncate mt-0.5">
                Ref: {submittedDoc.storage_ref}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#3ecf8e]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3ecf8e]">
              <IconCheck className="size-3.5" />
              Submitted
            </span>
            <label className="cursor-pointer inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors">
              <input type="file" className="hidden" accept={accepts} onChange={handleFileChange} />
              Replace File
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background/20 p-4">
      <div className="mb-2 text-sm font-semibold text-foreground">{label}</div>
      
      {uploading ? (
        <div className="border border-dashed border-border rounded-lg bg-background/50 p-6 flex flex-col items-center justify-center text-center">
          <IconLoader className="size-6 text-[#3ecf8e] animate-spin mb-2" />
          <div className="text-xs font-medium text-foreground">Uploading {localFile?.name}...</div>
          <div className="text-[10px] text-foreground-light mt-1">{localFile?.size}</div>
          
          <div className="w-full max-w-xs bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-[#3ecf8e] h-1.5 rounded-full transition-all duration-100" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="text-[10px] font-bold text-[#3ecf8e] mt-1.5">{progress}%</div>
        </div>
      ) : (
        <label className="border border-dashed border-border rounded-lg bg-background/20 hover:bg-background/50 cursor-pointer p-6 flex flex-col items-center justify-center text-center transition-all hover:border-[#3ecf8e]/50 group">
          <input type="file" className="hidden" accept={accepts} onChange={handleFileChange} />
          <IconUpload className="size-6 text-foreground-light group-hover:text-[#3ecf8e] transition-colors mb-2" />
          <div className="text-xs font-medium text-foreground group-hover:text-foreground transition-colors">
            Click to upload {label.toLowerCase()}
          </div>
          <div className="text-[10px] text-foreground-light mt-1">
            Accepts: {accepts}
          </div>
        </label>
      )}
    </div>
  );
}

export function AccountSettingsPage() {
  const { user, refreshUser } = useUser();
  const { notifications, unreadCount, markAllRead, clearNotifications } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [profileDraft, setProfileDraft] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const loadAccount = () => {
    setLoading(true);
    accountRequest('/api/auth/account')
      .then(body => {
        setAccount(body.account);
        setProfileDraft(body.account.profile);
      })
      .catch(error => toast.error('Failed to load account', { description: error.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const saveProfile = () => {
    accountRequest('/api/auth/account/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profileDraft),
    })
      .then(body => {
        setAccount(body.account);
        setProfileDraft(body.account.profile);
        toast.success('Profile saved successfully');
      })
      .catch(error => toast.error('Profile update failed', { description: error.message }));
  };

  const saveDocumentDirectly = (type: string, label: string, file_name: string, mime_type: string, storage_ref: string) => {
    accountRequest('/api/auth/account/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type,
        label,
        file_name,
        mime_type,
        storage_ref,
      }),
    })
      .then(body => {
        setAccount(body.account);
        toast.success(`${label} submitted successfully`);
      })
      .catch(error => toast.error('Document submission failed', { description: error.message }));
  };

  const submitVerification = () => {
    accountRequest('/api/auth/account/submit-verification', { method: 'POST' })
      .then(body => {
        setAccount(body.account);
        refreshUser();
        toast.success('Verification submitted', {
          description: 'An administrator will review your account and documents.',
        });
      })
      .catch(error => toast.error('Submission failed', { description: error.message }));
  };

  const updateDraft = (key: string, value: string) => {
    setProfileDraft(current => ({ ...current, [key]: value }));
  };

  const tabs = [
    ['profile', IconId, 'Profile'],
    ['organization', IconBuildingBank, 'Organization'],
    ['documents', IconFileCertificate, 'Documents'],
    ['privileges', IconShieldCheck, 'Privileges'],
    ['notifications', IconBell, 'Notifications'],
    ['flow', IconClipboardCheck, 'Setup Flow'],
  ] as const;

  if (loading) {
    return <div className="p-6 text-sm text-[#8b8b8b]">Loading account settings...</div>;
  }

  return (
    <div className="h-full overflow-auto bg-canvas text-foreground">
      <div className="mx-auto w-full max-w-[1200px] p-4 lg:p-8 space-y-6">
        
        {/* Header section with Verification status */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Account Settings</h1>
            <p className="mt-1 text-sm text-foreground-light">
              Manage identity, organization details, credentials, and track your MDA authorization.
            </p>
          </div>

          {account && (
            <div className="flex items-center gap-3 bg-card border border-border px-4 py-2 rounded-lg shadow-sm">
              <div className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  account.profile.verification_status === 'verified' ? 'bg-[#3ecf8e]' : 
                  account.profile.verification_status === 'submitted_for_review' ? 'bg-amber-400' : 'bg-[#8b8b8b]'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  account.profile.verification_status === 'verified' ? 'bg-[#3ecf8e]' : 
                  account.profile.verification_status === 'submitted_for_review' ? 'bg-amber-400' : 'bg-[#8b8b8b]'
                }`}></span>
              </div>
              <div className="text-xs">
                <div className="text-foreground-muted uppercase tracking-wider text-[9px] font-bold">Verification Status</div>
                <div className="font-semibold text-foreground capitalize mt-0.5">
                  {account.profile.verification_status?.toLowerCase().replaceAll('_', ' ')}
                </div>
              </div>
            </div>
          )}
        </div>

        {account && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Left Column: Sidebar Cards & Navigation */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Profile Card */}
              <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 h-16 w-16 bg-[#3ecf8e]/5 rounded-bl-full pointer-events-none" />
                <div className="flex justify-center mb-3">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#3ecf8e]/80 to-emerald-400 flex items-center justify-center text-xl font-bold text-black shadow-sm">
                    {user?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'UG'}
                  </div>
                </div>
                <h3 className="font-bold text-foreground truncate">{user?.full_name}</h3>
                <p className="text-xs text-foreground-light truncate">{user?.email}</p>
                
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#3ecf8e]/10 px-2.5 py-1 text-[11px] font-medium text-[#3ecf8e]">
                    <IconShieldCheck className="size-3.5" />
                    {account.requirements.label}
                  </div>
                </div>
              </div>

              {/* Navigation Pane */}
              <nav className="flex flex-col space-y-1 bg-card border border-border rounded-xl p-2 shadow-sm">
                {tabs.map(([id, Icon, label]) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setActiveTab(id);
                        setSearchParams(id === 'profile' ? {} : { tab: id });
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-[#3ecf8e]/10 text-[#3ecf8e] border-l-2 border-[#3ecf8e] pl-2.5 font-semibold' 
                          : 'text-foreground-light hover:bg-[#2e2e2e]/30 hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`size-4 ${isActive ? 'text-[#3ecf8e]' : 'text-foreground-light'}`} />
                        {label}
                      </div>
                      
                      {id === 'notifications' && unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3ecf8e] px-1.5 text-[10px] font-bold text-black">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right Column: Settings Sections Content */}
            <div className="lg:col-span-9">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-h-[500px]">
                
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <IconId className="text-[#3ecf8e] size-5" />
                        Profile Settings
                      </h2>
                      <p className="text-xs text-foreground-light mt-1">
                        Configure your identity details and account category to ensure appropriate platform authorization.
                      </p>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2 pt-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground-light text-xs font-semibold">Account Category</Label>
                        <select 
                          value={profileDraft.account_category || 'public_developer'} 
                          onChange={event => updateDraft('account_category', event.target.value)} 
                          className="h-10 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/30 focus:border-[#3ecf8e] transition-colors"
                        >
                          <option value="government_employee">Government Employee (MDA)</option>
                          <option value="mda_api_owner">MDA API Owner</option>
                          <option value="private_company">Private Company</option>
                          <option value="business_name">Registered Business Name</option>
                          <option value="public_developer">Public / Independent Developer</option>
                          <option value="civil_society">Civil Society Organization</option>
                          <option value="research_institution">Research / Academic Institution</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground-light text-xs font-semibold">National ID Number (NIN)</Label>
                        <Input 
                          value={profileDraft.nin || ''} 
                          onChange={event => updateDraft('nin', event.target.value)} 
                          className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                          placeholder="e.g. CM8100..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground-light text-xs font-semibold">Card Number</Label>
                        <Input 
                          value={profileDraft.national_id_number || ''} 
                          onChange={event => updateDraft('national_id_number', event.target.value)} 
                          className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                          placeholder="e.g. 10928..."
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground-light text-xs font-semibold">Phone Contact</Label>
                        <Input 
                          value={profileDraft.contact_phone || ''} 
                          onChange={event => updateDraft('contact_phone', event.target.value)} 
                          className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                          placeholder="e.g. +256 700 000000"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground-light text-xs font-semibold">Physical Address</Label>
                        <Textarea 
                          value={profileDraft.address || ''} 
                          onChange={event => updateDraft('address', event.target.value)} 
                          rows={3}
                          className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                          placeholder="Plot, Street, City, Kampala"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                      <Button onClick={saveProfile} className="bg-[#3ecf8e] hover:bg-[#3ecf8e]/95 text-black font-semibold px-6 shadow-md transition-all duration-200">
                        Save Profile
                      </Button>
                    </div>
                  </div>
                )}

                {/* Organization Tab */}
                {activeTab === 'organization' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <IconBuildingBank className="text-[#3ecf8e] size-5" />
                        Organization & MDA Details
                      </h2>
                      <p className="text-xs text-foreground-light mt-1">
                        Register company and governmental details to establish corporate verification and access level.
                      </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 pt-4">
                      
                      {/* Section 1: Business Registrations */}
                      <div className="md:col-span-2">
                        <h3 className="text-xs font-bold text-[#3ecf8e] uppercase tracking-wider mb-3">Corporate Identifiers</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-foreground-light text-xs font-semibold">Organization / Agency Name</Label>
                            <Input 
                              value={profileDraft.organization_name || ''} 
                              onChange={event => updateDraft('organization_name', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="e.g. Ministry of ICT and National Guidance"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">Organization Type</Label>
                            <Input 
                              value={profileDraft.organization_type || ''} 
                              onChange={event => updateDraft('organization_type', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="e.g. Ministry, Agency, Private LLC"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">URSB Registration Number</Label>
                            <Input 
                              value={profileDraft.ursb_number || ''} 
                              onChange={event => updateDraft('ursb_number', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="URSB-XXX-XXX"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">BRN (Business Registration Number)</Label>
                            <Input 
                              value={profileDraft.brn || ''} 
                              onChange={event => updateDraft('brn', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">URA TIN (Tax Identification Number)</Label>
                            <Input 
                              value={profileDraft.tin || ''} 
                              onChange={event => updateDraft('tin', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="100XXXXXXXX"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Officer Placement */}
                      <div className="md:col-span-2 border-t border-border pt-6">
                        <h3 className="text-xs font-bold text-[#3ecf8e] uppercase tracking-wider mb-3">Professional Credentials</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">Department / Unit</Label>
                            <Input 
                              value={profileDraft.department || ''} 
                              onChange={event => updateDraft('department', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="e.g. IT Department"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">Job Title</Label>
                            <Input 
                              value={profileDraft.job_title || ''} 
                              onChange={event => updateDraft('job_title', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="e.g. Senior Software Engineer"
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-foreground-light text-xs font-semibold">Staff ID or Appointment Reference</Label>
                            <Input 
                              value={profileDraft.staff_id || ''} 
                              onChange={event => updateDraft('staff_id', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="e.g. MOICT-IT-092"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Approver details */}
                      <div className="md:col-span-2 border-t border-border pt-6">
                        <h3 className="text-xs font-bold text-[#3ecf8e] uppercase tracking-wider mb-3">Supervisor Authorization</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">Supervisor Name</Label>
                            <Input 
                              value={profileDraft.supervisor_name || ''} 
                              onChange={event => updateDraft('supervisor_name', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="e.g. Commissioner E-Government"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground-light text-xs font-semibold">Supervisor Email</Label>
                            <Input 
                              value={profileDraft.supervisor_email || ''} 
                              onChange={event => updateDraft('supervisor_email', event.target.value)} 
                              className="bg-background border-border text-foreground focus-visible:ring-[#3ecf8e]/30 focus-visible:border-[#3ecf8e]"
                              placeholder="supervisor@ict.go.ug"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                      <Button onClick={saveProfile} className="bg-[#3ecf8e] hover:bg-[#3ecf8e]/95 text-black font-semibold px-6 shadow-md transition-all duration-200">
                        Save Organization Details
                      </Button>
                    </div>
                  </div>
                )}

                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <IconFileCertificate className="text-[#3ecf8e] size-5" />
                        Verification Documents
                      </h2>
                      <p className="text-xs text-foreground-light mt-1">
                        Upload official credentials and credentials letters to verify identity and authority.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 p-4 flex items-start gap-3">
                      <IconFingerprint className="size-5 text-[#3ecf8e] shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <div className="text-sm font-semibold text-foreground">{account.requirements.label}</div>
                        <p className="text-xs text-foreground-light mt-1 leading-relaxed">
                          {account.requirements.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      {account.requirements.requiredDocuments.map(docReq => {
                        const submittedDoc = account.documents.find(d => d.type === docReq.type);
                        return (
                          <DocumentUploader
                            key={docReq.type}
                            type={docReq.type}
                            label={docReq.label}
                            accepts={docReq.accepts}
                            submittedDoc={submittedDoc}
                            onUploadComplete={(fileName, mimeType, storageRef) => {
                              saveDocumentDirectly(docReq.type, docReq.label, fileName, mimeType, storageRef);
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Submit for Review</h3>
                        <p className="text-xs text-foreground-light mt-0.5">
                          Once all required documents are uploaded, submit your account for administrator authorization.
                        </p>
                      </div>
                      <Button 
                        disabled={
                          account.profile.verification_status !== 'draft_profile' && 
                          account.profile.verification_status !== 'needs_more_information'
                        }
                        onClick={submitVerification} 
                        className="bg-[#3ecf8e] hover:bg-[#3ecf8e]/95 text-black font-semibold shadow-md px-5 transition-all shrink-0 disabled:opacity-50"
                      >
                        {account.profile.verification_status === 'submitted_for_review' ? 'Verification Pending Review' : 'Submit for Admin Review'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Privileges Tab */}
                {activeTab === 'privileges' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <IconShieldCheck className="text-[#3ecf8e] size-5" />
                        Security Privileges
                      </h2>
                      <p className="text-xs text-foreground-light mt-1">
                        Your assigned clearance tier and operational permissions on the GovHub platform.
                      </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 pt-4">
                      {/* Access Group Card */}
                      <div className="rounded-xl border border-border bg-background/40 overflow-hidden shadow-sm">
                        <div className="bg-[#3ecf8e]/10 border-b border-border px-4 py-3 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-[#3ecf8e]" />
                          <h3 className="text-sm font-bold text-[#3ecf8e]">{account.privileges.accessGroup}</h3>
                        </div>
                        <div className="p-4">
                          <p className="text-xs text-foreground-light mb-3">
                            The following actions are permitted for this access tier:
                          </p>
                          <ul className="space-y-2.5">
                            {account.privileges.permissions.length === 0 ? (
                              <li className="text-xs text-foreground-muted italic">No custom permissions granted.</li>
                            ) : (
                              account.privileges.permissions.map(item => (
                                <li key={item} className="flex items-start gap-2.5 text-xs text-foreground">
                                  <span className="h-4 w-4 rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e] flex items-center justify-center shrink-0 mt-0.5">
                                    <IconCheck className="size-3" />
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Restrictions Card */}
                      <div className="rounded-xl border border-border bg-background/40 overflow-hidden shadow-sm">
                        <div className="bg-destructive/10 border-b border-border px-4 py-3 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-destructive" />
                          <h3 className="text-sm font-bold text-destructive">Account Restrictions</h3>
                        </div>
                        <div className="p-4">
                          <p className="text-xs text-foreground-light mb-3">
                            Safeguard boundaries currently applied to your activities:
                          </p>
                          <ul className="space-y-2.5">
                            {account.privileges.restrictions.length === 0 ? (
                              <li className="flex items-start gap-2.5 text-xs text-foreground">
                                <span className="h-4 w-4 rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e] flex items-center justify-center shrink-0 mt-0.5">
                                  <IconCheck className="size-3" />
                                </span>
                                <span>No active restrictions on this account.</span>
                              </li>
                            ) : (
                              account.privileges.restrictions.map(item => (
                                <li key={item} className="flex items-start gap-2.5 text-xs text-foreground">
                                  <span className="h-4 w-4 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5 font-bold text-[9px]">
                                    !
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                          <IconBell className="text-[#3ecf8e] size-5" />
                          Notifications Inbox
                        </h2>
                        <p className="text-xs text-foreground-light mt-1">
                          Stay updated with comments from validators, key approvals, and platform alerts.
                        </p>
                      </div>
                      
                      {notifications.length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="outline" 
                            onClick={markAllRead}
                            className="h-8 text-xs font-semibold border-border bg-card text-foreground hover:bg-background transition-colors"
                          >
                            Mark all read
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={clearNotifications}
                            className="h-8 text-xs font-semibold border-border bg-card text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            Clear all
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4">
                      {notifications.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-background/20 p-12 text-center flex flex-col items-center justify-center">
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-foreground-muted mb-3">
                            <IconBell className="size-6" />
                          </div>
                          <h4 className="text-sm font-semibold text-foreground">All caught up!</h4>
                          <p className="text-xs text-foreground-light mt-1">You have no new alerts or validation comments.</p>
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div key={notification.id} className="rounded-lg border border-border bg-background/30 p-4 hover:bg-background/50 transition-all flex items-start gap-3">
                            <div className="h-2 w-2 rounded-full bg-[#3ecf8e] mt-1.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="text-sm font-semibold text-foreground truncate">{notification.title}</div>
                                <div className="shrink-0 text-xs text-foreground-muted font-mono">
                                  {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-foreground-light leading-relaxed">{notification.message}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Setup Flow Tab */}
                {activeTab === 'flow' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <IconClipboardCheck className="text-[#3ecf8e] size-5" />
                        Verification Stepper
                      </h2>
                      <p className="text-xs text-foreground-light mt-1">
                        Track your progress towards completing full verification on the GovHub platform.
                      </p>
                    </div>

                    <div className="relative border-l border-border ml-4 pl-6 space-y-6 py-2 pt-4">
                      {[
                        {
                          title: 'Account Registration',
                          desc: 'Create an account and choose the correct category: government employee, company, business, public developer, civil society, or research institution.',
                          isActive: false,
                          isCompleted: true,
                        },
                        {
                          title: 'Profile Details',
                          desc: 'Complete profile and organization fields. Public developers provide NIN and National ID details; organizations provide URSB/BRN/TIN details where applicable.',
                          isActive: account.profile.verification_status === 'draft_profile',
                          isCompleted: account.profile.verification_status !== 'draft_profile',
                        },
                        {
                          title: 'Evidence Verification Documents',
                          desc: 'Submit document metadata for the required evidence. This prototype simulates document verification by collecting file metadata.',
                          isActive: account.profile.verification_status === 'draft_profile' && account.documents.length > 0,
                          isCompleted: account.documents.length >= account.requirements.requiredDocuments.length,
                        },
                        {
                          title: 'Submit for Admin Review',
                          desc: 'Submit the account for administrator review. Until approval, the account remains a registered applicant.',
                          isActive: account.profile.verification_status === 'draft_profile' && account.documents.length >= account.requirements.requiredDocuments.length,
                          isCompleted: ['submitted_for_review', 'verified', 'suspended', 'rejected'].includes(account.profile.verification_status),
                        },
                        {
                          title: 'Identity and Organization Verification',
                          desc: 'Platform administrator verifies identity or organization documents, assigns appropriate security roles and MDA permissions, then approves/verifies the account.',
                          isActive: account.profile.verification_status === 'submitted_for_review',
                          isCompleted: account.profile.verification_status === 'verified',
                        },
                        {
                          title: 'API Gateway Integration Access',
                          desc: 'Once verified, request keys and credentials for specific Government APIs from the catalog. Each API access is approved independently.',
                          isActive: account.profile.verification_status === 'verified',
                          isCompleted: false,
                        },
                      ].map((step, idx) => {
                        const isCompleted = step.isCompleted;
                        const isActive = step.isActive;
                        
                        return (
                          <div key={idx} className="relative">
                            {/* Bullet circle */}
                            <div className={`absolute -left-[35px] top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[9px] font-bold transition-all ${
                              isCompleted 
                                ? 'bg-[#3ecf8e] border-[#3ecf8e] text-black shadow-sm'
                                : isActive
                                  ? 'bg-background border-[#3ecf8e] text-[#3ecf8e] ring-4 ring-[#3ecf8e]/10'
                                  : 'bg-background border-border text-foreground-muted'
                            }`}>
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            
                            <div className={`space-y-1 ${isActive ? 'opacity-100' : isCompleted ? 'opacity-90' : 'opacity-60'}`}>
                              <h3 className={`text-sm font-semibold flex items-center gap-2 ${isActive ? 'text-[#3ecf8e]' : 'text-foreground'}`}>
                                {step.title}
                                {isActive && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3ecf8e] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3ecf8e]"></span>
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs text-foreground-light max-w-2xl leading-relaxed">{step.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
