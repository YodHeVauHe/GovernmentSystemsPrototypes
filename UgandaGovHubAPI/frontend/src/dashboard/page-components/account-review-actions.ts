import { toast } from 'sonner';
import { API_BASE } from '@/lib/api-base';
import {
  accountVerificationStatus,
  canPromoteAccountToAdmin,
  notificationRoleLabel,
  resolveAccountApprovalDefaults,
} from './dashboard-page-helpers';

export function createAccountReviewActions({
  accountRoleInputs,
  accountMdaInputs,
  mdas,
  setAccountReviewing,
  addNotification,
  fetchDashboardData,
}: any) {
    const handleApproveAccount = (user: any) => {
      const { selectedRole: nextRole, selectedMda: nextMda, needsMda } = resolveAccountApprovalDefaults(
        user,
        accountRoleInputs,
        accountMdaInputs,
        mdas
      );
      const verificationStatus = accountVerificationStatus(user);
      if (verificationStatus !== 'submitted_for_review') {
        toast.info('Verification not ready', {
          description: `${user.full_name} must finish and submit account verification before approval.`,
        });
        return;
      }
      if (nextRole === 'admin' && !canPromoteAccountToAdmin(user)) {
        toast.error('Admin promotion blocked', {
          description: 'Administrator accounts require a verified government or MDA operator identity.',
        });
        return;
      }
      setAccountReviewing(user.id);

      fetch(`${API_BASE}/api/admin/users/${user.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole, mda_id: needsMda ? nextMda : null }),
      })
        .then(async res => {
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Failed to approve account');
          return result;
        })
        .then(() => {
          toast.success('Account approved', {
            description: `${user.full_name} can now access the dashboard.`,
          });
          addNotification({
            type: 'account',
            title: 'Account approved',
            message: `Your account was approved as ${notificationRoleLabel(nextRole)}${needsMda ? ` for ${mdas.find((mda: any) => mda.id === nextMda)?.shortName || nextMda}` : ''}.`,
            recipientUserId: user.id,
          });
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Approval failed', {
            description: err instanceof Error ? err.message : 'Failed to approve account',
          });
        })
        .finally(() => setAccountReviewing(null));
    };

    const handleRejectAccount = (user: any) => {
      const reason = prompt(`Reject ${user.full_name}'s account? Add a short reason:`);
      if (reason === null) return;
      setAccountReviewing(user.id);

      fetch(`${API_BASE}/api/admin/users/${user.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
        .then(async res => {
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Failed to reject account');
          return result;
        })
        .then(() => {
          toast.success('Account rejected', {
            description: `${user.full_name}'s request was closed.`,
          });
          addNotification({
            type: 'account',
            title: 'Account rejected',
            message: `Your account request was rejected${reason ? `: ${reason}` : '.'}`,
            recipientUserId: user.id,
          });
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Rejection failed', {
            description: err instanceof Error ? err.message : 'Failed to reject account',
          });
        })
        .finally(() => setAccountReviewing(null));
    };

    const handleNeedsInfoAccount = (user: any) => {
      const notes = prompt(`Request more information from ${user.full_name}:`, user.account?.profile?.review_notes || '');
      if (notes === null) return;
      setAccountReviewing(user.id);

      fetch(`${API_BASE}/api/admin/users/${user.id}/needs-more-information`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
        .then(async res => {
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Failed to request more information');
          return result;
        })
        .then(() => {
          toast.success('More information requested', {
            description: `${user.full_name}'s verification profile was returned for updates.`,
          });
          addNotification({
            type: 'account',
            title: 'More information requested',
            message: `Your verification profile needs more information${notes ? `: ${notes}` : '.'}`,
            recipientUserId: user.id,
          });
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Request failed', {
            description: err instanceof Error ? err.message : 'Failed to request more information',
          });
        })
        .finally(() => setAccountReviewing(null));
    };

    const handleSuspendAccount = (user: any) => {
      if (!confirm(`Suspend ${user.full_name}'s account? They will lose platform access until restored.`)) return;
      setAccountReviewing(user.id);

      fetch(`${API_BASE}/api/admin/users/${user.id}/suspend`, { method: 'POST' })
        .then(async res => {
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Failed to suspend account');
          return result;
        })
        .then(() => {
          toast.success('Account suspended', {
            description: `${user.full_name} can no longer access protected workflows.`,
          });
          addNotification({
            type: 'account',
            title: 'Account suspended',
            message: 'Your GovHub account was suspended. Protected workflows are unavailable until an administrator restores access.',
            recipientUserId: user.id,
          });
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Suspension failed', {
            description: err instanceof Error ? err.message : 'Failed to suspend account',
          });
        })
        .finally(() => setAccountReviewing(null));
    };

    const handleDeleteAccount = (user: any) => {
      if (!confirm(`Permanently delete ${user.full_name}'s account? This removes their profile, documents, and sessions. This cannot be undone.`)) return;
      setAccountReviewing(user.id);

      fetch(`${API_BASE}/api/admin/users/${user.id}`, { method: 'DELETE' })
        .then(async res => {
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Failed to delete account');
          return result;
        })
      .then(() => {
        toast.success('Account deleted', {
          description: `${user.full_name}'s account was permanently removed.`,
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Delete failed', {
          description: err instanceof Error ? err.message : 'Failed to delete account',
        });
      })
      .finally(() => setAccountReviewing(null));
  };

  return {
    handleApproveAccount,
    handleRejectAccount,
    handleNeedsInfoAccount,
    handleSuspendAccount,
    handleDeleteAccount,
  };
}
