import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, FileCheck2, ListChecks, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { API_BASE } from '@/lib/api-base';

type AccountProgress = {
  missing_fields: string[];
  missing_documents: string[];
  completed_requirements: number;
  total_requirements: number;
  can_submit: boolean;
  next_action: string;
  message: string;
};

type AccountSnapshot = {
  profile: {
    verification_status: string;
    review_notes?: string | null;
  };
  requirements: {
    label: string;
  };
  verification_progress: AccountProgress;
};

async function fetchAccountSnapshot() {
  const response = await fetch(`${API_BASE}/api/auth/account`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load verification progress.');
  return body.account as AccountSnapshot;
}

export function AccountStatusPage() {
  const { user, logout } = useUser();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchAccountSnapshot()
      .then(setAccount)
      .catch(error => setAccountError(error instanceof Error ? error.message : 'Unable to load verification progress.'));
  }, [user]);

  const progress = account?.verification_progress;
  const percentComplete = useMemo(() => {
    if (!progress || progress.total_requirements === 0) return account?.profile.verification_status === 'verified' ? 100 : 0;
    return Math.round((progress.completed_requirements / progress.total_requirements) * 100);
  }, [account?.profile.verification_status, progress]);

  const icon = user?.status === 'APPROVED' ? ShieldCheck : user?.status === 'PENDING_REVIEW' ? Clock3 : ShieldAlert;
  const Icon = icon;
  const title = user?.status === 'APPROVED'
    ? 'Account approved'
    : user?.status === 'REJECTED'
      ? 'Account rejected'
      : user?.status === 'SUSPENDED'
        ? 'Account suspended'
        : 'Account pending review';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#181818] px-4 text-[#ededed]">
      <section className="w-full max-w-lg space-y-5 rounded-lg border border-[#2e2e2e] bg-[#141414] p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#3ecf8e]/10 text-[#3ecf8e]">
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="text-sm text-[#8b8b8b]">{user?.email || 'No active session'}</p>
          </div>
        </div>

        <div className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4 text-sm text-[#c9c9c9]">
          {user?.status === 'APPROVED' && 'Your account is approved. You can continue to the operational dashboard.'}
          {user?.status === 'PENDING_REVIEW' && (progress?.message || 'Complete verification before an administrator can approve dashboard and API access.')}
          {user?.status === 'REJECTED' && (user.rejection_reason || 'This application was rejected by an administrator.')}
          {user?.status === 'SUSPENDED' && 'This account has been suspended by an administrator.'}
        </div>

        {user?.status === 'PENDING_REVIEW' && (
          <div className="space-y-4 rounded-md border border-[#2e2e2e] bg-[#181818] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Verification Progress</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {account?.requirements.label || 'Account verification'} · {account?.profile.verification_status?.replaceAll('_', ' ') || 'loading'}
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-[#3ecf8e]">{percentComplete}%</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#2e2e2e]">
              <div className="h-full rounded-full bg-[#3ecf8e]" style={{ width: `${percentComplete}%` }} />
            </div>
            {accountError && <div className="text-xs text-orange-300">{accountError}</div>}
            {progress && (progress.missing_fields.length > 0 || progress.missing_documents.length > 0) && (
              <div className="grid gap-3 text-xs text-[#c9c9c9] sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
                    <ListChecks className="size-3.5 text-[#3ecf8e]" />
                    Profile fields
                  </div>
                  {progress.missing_fields.length > 0 ? progress.missing_fields.slice(0, 4).join(', ') : 'Complete'}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
                    <FileCheck2 className="size-3.5 text-[#3ecf8e]" />
                    Documents
                  </div>
                  {progress.missing_documents.length > 0 ? progress.missing_documents.slice(0, 4).join(', ') : 'Complete'}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {user?.status === 'APPROVED' && <Button asChild><Link to="/dashboard">Dashboard</Link></Button>}
          {user?.status === 'PENDING_REVIEW' && (
            <>
              <Button asChild><Link to="/account/settings">Finish verification</Link></Button>
              <Button variant="outline" asChild><Link to="/account/settings?tab=flow">View steps</Link></Button>
            </>
          )}
          <Button variant="outline" onClick={logout}>Log out</Button>
        </div>
      </section>
    </main>
  );
}
