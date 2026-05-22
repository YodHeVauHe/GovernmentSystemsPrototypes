import { Link } from 'react-router-dom';
import { Clock3, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';

export function AccountStatusPage() {
  const { user, logout } = useUser();

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
          {user?.status === 'PENDING_REVIEW' && 'An administrator must verify your identity, organization, requested role, and access purpose before the dashboard is enabled.'}
          {user?.status === 'REJECTED' && (user.rejection_reason || 'This application was rejected by an administrator.')}
          {user?.status === 'SUSPENDED' && 'This account has been suspended by an administrator.'}
        </div>

        <div className="flex gap-3">
          {user?.status === 'APPROVED' && <Button asChild><Link to="/dashboard">Dashboard</Link></Button>}
          <Button variant="outline" onClick={logout}>Log out</Button>
        </div>
      </section>
    </main>
  );
}
