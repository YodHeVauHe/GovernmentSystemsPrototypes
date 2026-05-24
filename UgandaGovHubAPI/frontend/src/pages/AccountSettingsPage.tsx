import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IconBell,
  IconBuildingBank,
  IconClipboardCheck,
  IconFileCertificate,
  IconFingerprint,
  IconId,
  IconShieldCheck,
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[#b5b5b5]">{label}</Label>
      {children}
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
  const [docDraft, setDocDraft] = useState<Record<string, Record<string, string>>>({});
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

  const documentTypes = useMemo(() => new Set(account?.documents.map(document => document.type) || []), [account]);

  const saveProfile = () => {
    accountRequest('/api/auth/account/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profileDraft),
    })
      .then(body => {
        setAccount(body.account);
        setProfileDraft(body.account.profile);
        toast.success('Profile saved');
      })
      .catch(error => toast.error('Profile update failed', { description: error.message }));
  };

  const saveDocument = (type: string, label: string) => {
    const draft = docDraft[type] || {};
    if (!draft.file_name || !draft.mime_type) {
      toast.error('Document metadata required', { description: 'Add a file name and document type.' });
      return;
    }

    accountRequest('/api/auth/account/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type,
        label,
        file_name: draft.file_name,
        mime_type: draft.mime_type,
        storage_ref: draft.storage_ref,
      }),
    })
      .then(body => {
        setAccount(body.account);
        toast.success('Document metadata submitted');
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
    ['flow', IconClipboardCheck, 'Flow'],
  ] as const;

  if (loading) {
    return <div className="p-6 text-sm text-[#8b8b8b]">Loading account settings...</div>;
  }

  return (
    <div className="h-full overflow-auto bg-[#181818] text-[#ededed]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-3 lg:p-5">
        <div>
          <h1 className="text-[24px] font-semibold text-white">Account Settings</h1>
          <p className="mt-1 text-sm text-[#8b8b8b]">
            Manage identity, organization verification, privileges, documents, and account notifications.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-lg border border-[#2e2e2e] bg-[#141414] p-2">
          {tabs.map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setSearchParams(id === 'profile' ? {} : { tab: id });
              }}
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${
                activeTab === id ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
              }`}
            >
              <Icon className="size-4" />
              {label}
              {id === 'notifications' && unreadCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3ecf8e] px-1.5 text-[11px] font-semibold text-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {account && (
          <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-5">
            <div className="mb-5 flex flex-col gap-2 border-b border-[#2e2e2e] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{user?.full_name}</div>
                <div className="text-xs text-[#8b8b8b]">{user?.email}</div>
              </div>
              <div className="rounded-md border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#b5b5b5]">
                {account.requirements.label} · {account.profile.verification_status?.replaceAll('_', ' ')}
              </div>
            </div>

            {activeTab === 'profile' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Account category">
                  <select value={profileDraft.account_category || 'public_developer'} onChange={event => updateDraft('account_category', event.target.value)} className="h-9 w-full rounded-md border border-[#2e2e2e] bg-[#181818] px-3 text-sm">
                    <option value="government_employee">Government Employee</option>
                    <option value="mda_api_owner">MDA API Owner</option>
                    <option value="private_company">Private Company</option>
                    <option value="business_name">Business Name</option>
                    <option value="public_developer">Public Developer</option>
                    <option value="civil_society">Civil Society</option>
                    <option value="research_institution">Research Institution</option>
                  </select>
                </Field>
                <Field label="NIN">
                  <Input value={profileDraft.nin || ''} onChange={event => updateDraft('nin', event.target.value)} />
                </Field>
                <Field label="National ID number">
                  <Input value={profileDraft.national_id_number || ''} onChange={event => updateDraft('national_id_number', event.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input value={profileDraft.contact_phone || ''} onChange={event => updateDraft('contact_phone', event.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Address">
                    <Textarea value={profileDraft.address || ''} onChange={event => updateDraft('address', event.target.value)} />
                  </Field>
                </div>
                <Button onClick={saveProfile}>Save profile</Button>
              </div>
            )}

            {activeTab === 'organization' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Organization name">
                  <Input value={profileDraft.organization_name || ''} onChange={event => updateDraft('organization_name', event.target.value)} />
                </Field>
                <Field label="Organization type">
                  <Input value={profileDraft.organization_type || ''} onChange={event => updateDraft('organization_type', event.target.value)} />
                </Field>
                <Field label="URSB registration number">
                  <Input value={profileDraft.ursb_number || ''} onChange={event => updateDraft('ursb_number', event.target.value)} />
                </Field>
                <Field label="BRN / Business Registration Number">
                  <Input value={profileDraft.brn || ''} onChange={event => updateDraft('brn', event.target.value)} />
                </Field>
                <Field label="URA TIN">
                  <Input value={profileDraft.tin || ''} onChange={event => updateDraft('tin', event.target.value)} />
                </Field>
                <Field label="Staff ID or appointment reference">
                  <Input value={profileDraft.staff_id || ''} onChange={event => updateDraft('staff_id', event.target.value)} />
                </Field>
                <Field label="Department / unit">
                  <Input value={profileDraft.department || ''} onChange={event => updateDraft('department', event.target.value)} />
                </Field>
                <Field label="Job title">
                  <Input value={profileDraft.job_title || ''} onChange={event => updateDraft('job_title', event.target.value)} />
                </Field>
                <Field label="Supervisor or authorizing officer">
                  <Input value={profileDraft.supervisor_name || ''} onChange={event => updateDraft('supervisor_name', event.target.value)} />
                </Field>
                <Field label="Supervisor email">
                  <Input value={profileDraft.supervisor_email || ''} onChange={event => updateDraft('supervisor_email', event.target.value)} />
                </Field>
                <Button onClick={saveProfile}>Save organization</Button>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4">
                  <div className="flex items-start gap-3">
                    <IconFingerprint className="mt-1 size-5 text-[#3ecf8e]" />
                    <div>
                      <div className="text-sm font-semibold text-white">{account.requirements.label}</div>
                      <p className="mt-1 text-sm text-[#8b8b8b]">{account.requirements.description}</p>
                    </div>
                  </div>
                </div>
                {account.requirements.requiredDocuments.map(document => (
                  <div key={document.type} className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{document.label}</div>
                        <div className="text-xs text-[#8b8b8b]">{document.accepts}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs ${documentTypes.has(document.type) ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]' : 'bg-orange-500/10 text-orange-300'}`}>
                        {documentTypes.has(document.type) ? 'submitted' : 'required'}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input placeholder="file-name.pdf" value={docDraft[document.type]?.file_name || ''} onChange={event => setDocDraft(current => ({ ...current, [document.type]: { ...current[document.type], file_name: event.target.value } }))} />
                      <Input placeholder="application/pdf or image/png" value={docDraft[document.type]?.mime_type || ''} onChange={event => setDocDraft(current => ({ ...current, [document.type]: { ...current[document.type], mime_type: event.target.value } }))} />
                      <Input placeholder="storage reference" value={docDraft[document.type]?.storage_ref || ''} onChange={event => setDocDraft(current => ({ ...current, [document.type]: { ...current[document.type], storage_ref: event.target.value } }))} />
                    </div>
                    <Button className="mt-3" variant="outline" onClick={() => saveDocument(document.type, document.label)}>Submit metadata</Button>
                  </div>
                ))}
                <Button onClick={submitVerification}>Submit account for admin review</Button>
              </div>
            )}

            {activeTab === 'privileges' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4">
                  <h2 className="text-sm font-semibold text-white">{account.privileges.accessGroup}</h2>
                  <ul className="mt-3 space-y-2 text-sm text-[#b5b5b5]">
                    {account.privileges.permissions.map(item => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4">
                  <h2 className="text-sm font-semibold text-white">Restrictions</h2>
                  <ul className="mt-3 space-y-2 text-sm text-[#b5b5b5]">
                    {account.privileges.restrictions.map(item => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
                  <Button variant="outline" onClick={clearNotifications}>Clear</Button>
                </div>
                {notifications.length === 0 ? (
                  <div className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4 text-sm text-[#8b8b8b]">No notifications.</div>
                ) : notifications.map(notification => (
                  <div key={notification.id} className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-sm font-semibold text-white">{notification.title}</div>
                      <div className="shrink-0 text-right text-xs text-[#8b8b8b]">{new Date(notification.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-sm text-[#b5b5b5]">{notification.message}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'flow' && (
              <div className="space-y-3 text-sm text-[#b5b5b5]">
                {[
                  '1. Create an account and choose the correct category: government employee, company, business, public developer, civil society, or research institution.',
                  '2. Complete profile and organization fields. Public developers provide NIN and National ID details; organizations provide URSB/BRN/TIN details where applicable.',
                  '3. Submit document metadata for the required evidence. Images/PDFs can later be connected to object storage; this prototype stores auditable metadata.',
                  '4. Submit the account for administrator review. Until approval, the account remains a registered applicant.',
                  '5. Admin verifies the identity or organization, assigns role and MDA privileges, then approves, rejects, suspends, or asks for more information.',
                  '6. Verified users can request API access. API owners/admins still approve each API-specific access request separately.',
                ].map(step => (
                  <div key={step} className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4">{step}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
