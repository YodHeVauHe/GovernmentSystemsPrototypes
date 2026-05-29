import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotifications } from '@/context/NotificationContext';
import { useUser } from '@/context/UserContext';
import { accountRequest } from './account-settings/api';
import { AccountSettingsShell } from './account-settings/AccountSettingsShell';
import { DocumentsSettingsTab } from './account-settings/DocumentsSettingsTab';
import { NotificationsSettingsTab } from './account-settings/NotificationsSettingsTab';
import { OrganizationSettingsTab } from './account-settings/OrganizationSettingsTab';
import { PrivilegesSettingsTab } from './account-settings/PrivilegesSettingsTab';
import { ProfileSettingsTab } from './account-settings/ProfileSettingsTab';
import { SecuritySettingsTab } from './account-settings/SecuritySettingsTab';
import { SetupFlowTab } from './account-settings/SetupFlowTab';
import {
  readAccountSettingsTabId,
  type AccountProfileDraft,
  type AccountSettingsTabId,
  type AccountSnapshot,
} from './account-settings/types';

type AccountResponse = { account: AccountSnapshot };
type MfaSetupResponse = { secret: string; otpauth_url: string };

export function AccountSettingsPage() {
  const { user, refreshUser } = useUser();
  const { notifications, unreadCount, markAllRead, clearNotifications } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<AccountSettingsTabId>(() => readAccountSettingsTabId(searchParams.get('tab')));
  const [profileDraft, setProfileDraft] = useState<AccountProfileDraft>({});
  const [mfaSetup, setMfaSetup] = useState<MfaSetupResponse | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectTab = (tab: AccountSettingsTabId) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  const loadAccount = () => {
    setLoading(true);
    accountRequest<AccountResponse>('/api/auth/account')
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
    const rawTab = searchParams.get('tab');
    const nextTab = readAccountSettingsTabId(rawTab);
    setActiveTab(current => (current === nextTab ? current : nextTab));

    if (rawTab && rawTab !== nextTab) {
      setSearchParams(nextTab === 'profile' ? {} : { tab: nextTab }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const saveProfile = () => {
    accountRequest<AccountResponse>('/api/auth/account/profile', {
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
    accountRequest<AccountResponse>('/api/auth/account/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, label, file_name, mime_type, storage_ref }),
    })
      .then(body => {
        setAccount(body.account);
        toast.success(`${label} submitted successfully`);
      })
      .catch(error => toast.error('Document submission failed', { description: error.message }));
  };

  const submitVerification = () => {
    accountRequest<AccountResponse>('/api/auth/account/submit-verification', { method: 'POST' })
      .then(body => {
        setAccount(body.account);
        refreshUser();
        toast.success('Verification submitted', {
          description: 'An administrator will review your account and documents.',
        });
      })
      .catch(error => toast.error('Submission failed', { description: error.message }));
  };

  const startMfaSetup = () => {
    setMfaBusy(true);
    accountRequest<MfaSetupResponse>('/api/auth/mfa/setup', { method: 'POST' })
      .then(body => {
        setMfaSetup(body);
        setMfaCode('');
      })
      .catch(error => toast.error('MFA setup failed', { description: error.message }))
      .finally(() => setMfaBusy(false));
  };

  const enableMfa = () => {
    setMfaBusy(true);
    accountRequest('/api/auth/mfa/enable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: mfaCode }),
    })
      .then(() => {
        toast.success('Multi-factor authentication enabled');
        setMfaSetup(null);
        setMfaCode('');
        return refreshUser();
      })
      .catch(error => toast.error('MFA verification failed', { description: error.message }))
      .finally(() => setMfaBusy(false));
  };

  const disableMfa = () => {
    setMfaBusy(true);
    accountRequest('/api/auth/mfa/disable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: mfaPassword, code: mfaCode }),
    })
      .then(() => {
        toast.success('Multi-factor authentication disabled');
        setMfaPassword('');
        setMfaCode('');
        return refreshUser();
      })
      .catch(error => toast.error('Could not disable MFA', { description: error.message }))
      .finally(() => setMfaBusy(false));
  };

  const updateDraft = (key: string, value: string) => {
    setProfileDraft(current => ({ ...current, [key]: value }));
  };

  if (loading) {
    return <div className="p-6 text-sm text-[#8b8b8b]">Loading account settings...</div>;
  }

  if (!account) {
    return <div className="p-6 text-sm text-[#8b8b8b]">Account settings are unavailable.</div>;
  }

  return (
    <AccountSettingsShell user={user} account={account} activeTab={activeTab} unreadCount={unreadCount} onSelectTab={selectTab}>
      {activeTab === 'profile' && (
        <ProfileSettingsTab profileDraft={profileDraft} onUpdateDraft={updateDraft} onSaveProfile={saveProfile} />
      )}

      {activeTab === 'organization' && (
        <OrganizationSettingsTab profileDraft={profileDraft} onUpdateDraft={updateDraft} onSaveProfile={saveProfile} />
      )}

      {activeTab === 'documents' && (
        <DocumentsSettingsTab account={account} onSaveDocument={saveDocumentDirectly} onSubmitVerification={submitVerification} />
      )}

      {activeTab === 'security' && (
        <SecuritySettingsTab
          user={user}
          mfaSetup={mfaSetup}
          mfaCode={mfaCode}
          mfaPassword={mfaPassword}
          mfaBusy={mfaBusy}
          onSetMfaCode={setMfaCode}
          onSetMfaPassword={setMfaPassword}
          onStartMfaSetup={startMfaSetup}
          onEnableMfa={enableMfa}
          onDisableMfa={disableMfa}
        />
      )}

      {activeTab === 'privileges' && (
        <PrivilegesSettingsTab privileges={account.privileges} />
      )}

      {activeTab === 'notifications' && (
        <NotificationsSettingsTab notifications={notifications} onMarkAllRead={markAllRead} onClearNotifications={clearNotifications} />
      )}

      {activeTab === 'flow' && (
        <SetupFlowTab account={account} />
      )}
    </AccountSettingsShell>
  );
}
