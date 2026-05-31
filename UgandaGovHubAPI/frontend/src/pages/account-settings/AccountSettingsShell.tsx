import {
  IconAlertTriangle,
  IconBell,
  IconBuildingBank,
  IconClipboardCheck,
  IconFileCertificate,
  IconId,
  IconLock,
  IconShieldCheck,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/context/UserContext';
import type { AccountSettingsTabId, AccountSnapshot } from './types';
import { resolveNextVerificationTab } from './verification-flow';

const tabs = [
  ['profile', IconId, 'Profile'],
  ['organization', IconBuildingBank, 'Organization'],
  ['documents', IconFileCertificate, 'Documents'],
  ['security', IconLock, 'Security'],
  ['privileges', IconShieldCheck, 'Privileges'],
  ['notifications', IconBell, 'Notifications'],
  ['flow', IconClipboardCheck, 'Setup Flow'],
] as const;

type AccountSettingsShellProps = {
  user: AuthUser | null;
  account: AccountSnapshot;
  activeTab: AccountSettingsTabId;
  unreadCount: number;
  onSelectTab: (tab: AccountSettingsTabId) => void;
  children: React.ReactNode;
};

export function AccountSettingsShell({
  user,
  account,
  activeTab,
  unreadCount,
  onSelectTab,
  children,
}: AccountSettingsShellProps) {
  return (
    <div data-testid="account-settings-page" className="h-full min-h-0 overflow-auto bg-canvas text-foreground lg:overflow-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col p-3 lg:h-full lg:min-h-0 lg:p-5">
        <AccountSettingsHeader account={account} />
        <VerificationPrompt account={account} onSelectTab={onSelectTab} />
        <AdminMfaPrompt user={user} onSelectTab={onSelectTab} />

        <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:overflow-hidden">
          <aside className="space-y-6 lg:col-span-3 lg:overflow-hidden">
            <ProfileCard user={user} account={account} />
            <AccountSettingsNav activeTab={activeTab} unreadCount={unreadCount} onSelectTab={onSelectTab} />
          </aside>

          <main className="lg:col-span-9 lg:min-h-0 lg:overflow-hidden">
            <div className="min-h-[500px] rounded-xl border border-border bg-card p-4 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function AccountSettingsHeader({ account }: { account: AccountSnapshot }) {
  const status = account.profile.verification_status;
  const statusColor = status === 'verified' ? 'bg-[#3ecf8e]' : status === 'submitted_for_review' ? 'bg-amber-400' : 'bg-[#8b8b8b]';

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Account Settings</h1>
        <p className="mt-1 text-sm text-foreground-light">
          Manage identity, organization details, credentials, and track your MDA authorization.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-sm">
        <div className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusColor}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusColor}`} />
        </div>
        <div className="text-xs">
          <div className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Verification Status</div>
          <div className="mt-0.5 font-semibold capitalize text-foreground">{status.toLowerCase().replaceAll('_', ' ')}</div>
        </div>
      </div>
    </div>
  );
}

function VerificationPrompt({ account, onSelectTab }: { account: AccountSnapshot; onSelectTab: (tab: AccountSettingsTabId) => void }) {
  if (account.profile.verification_status === 'verified') return null;

  const progress = account.verification_progress;
  const missing = [...(progress?.missing_fields || []), ...(progress?.missing_documents || [])];
  const nextTab = resolveNextVerificationTab(account);

  return (
    <div className="mb-6 rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Finish verification to unlock dashboard and API access</div>
          <div className="mt-1 text-xs leading-5 text-foreground-light">
            {progress?.message || 'Complete your profile, upload required documents, then submit for administrator review.'}
          </div>
          {missing.length > 0 && (
            <div
              role="alert"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold text-amber-300"
            >
              <IconAlertTriangle className="size-3.5 shrink-0" />
              <span className="min-w-0 leading-4">
                Missing: <span className="text-amber-200">{missing.slice(0, 5).join(', ')}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => onSelectTab('flow')}>View steps</Button>
          <Button size="sm" onClick={() => onSelectTab(nextTab)}>Continue</Button>
        </div>
      </div>
    </div>
  );
}

function AdminMfaPrompt({ user, onSelectTab }: { user: AuthUser | null; onSelectTab: (tab: AccountSettingsTabId) => void }) {
  if (user?.role !== 'admin' || user.mfa_enabled) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-400/25 bg-amber-400/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Administrator MFA is not enabled</div>
          <div className="mt-1 text-xs leading-5 text-foreground-light">
            Platform administrators authenticate with password and session controls. Enable MFA before demoing privileged account approval and catalog management.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => onSelectTab('security')}>Open security</Button>
      </div>
    </div>
  );
}

function ProfileCard({ user, account }: { user: AuthUser | null; account: AccountSnapshot }) {
  const initials = user?.full_name
    ?.split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'UG';

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 text-center shadow-sm">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-[#3ecf8e]/5" />
      <div className="mb-3 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#3ecf8e]/80 to-emerald-400 text-xl font-bold text-black shadow-sm">
          {initials}
        </div>
      </div>
      <h3 className="truncate font-bold text-foreground">{user?.full_name}</h3>
      <p className="truncate text-xs text-foreground-light">{user?.email}</p>

      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#3ecf8e]/10 px-2.5 py-1 text-[11px] font-medium text-[#3ecf8e]">
          <IconShieldCheck className="size-3.5" />
          {account.requirements.label}
        </div>
      </div>
    </div>
  );
}

function AccountSettingsNav({
  activeTab,
  unreadCount,
  onSelectTab,
}: {
  activeTab: AccountSettingsTabId;
  unreadCount: number;
  onSelectTab: (tab: AccountSettingsTabId) => void;
}) {
  return (
    <nav data-testid="account-settings-nav" className="flex flex-col space-y-1 rounded-xl border border-border bg-card p-2 shadow-sm">
      {tabs.map(([id, Icon, label]) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onSelectTab(id)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? 'border-l-2 border-[#3ecf8e] bg-[#3ecf8e]/10 pl-2.5 font-semibold text-[#3ecf8e]'
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
  );
}
