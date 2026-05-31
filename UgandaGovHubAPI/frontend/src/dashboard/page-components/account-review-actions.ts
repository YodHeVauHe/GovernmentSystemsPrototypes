import { toast } from 'sonner';
import { API_BASE } from '@/lib/api-base';
import {
  accountVerificationStatus,
  canPromoteAccountToAdmin,
  notificationRoleLabel,
  resolveAccountApprovalDefaults,
} from './dashboard-page-helpers';
import {
  isDeleteConfirmationMatch,
  sanitizeReviewPromptText,
  validateAccountApprovalInput,
} from './account-review-validation';

type AccountActionType = 'reject' | 'needs-info' | 'suspend' | 'delete';

export type AccountActionDialogState = {
  type: AccountActionType;
  user: any;
} | null;

export function createAccountReviewActions({
  accountRoleInputs,
  accountMdaInputs,
  mdas,
  setAccountReviewing,
  accountActionDialog,
  setAccountActionDialog,
  accountActionText,
  setAccountActionText,
  accountActionBusy,
  setAccountActionBusy,
  deleteConfirmation,
  setDeleteConfirmation,
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
      const approvalInput = validateAccountApprovalInput({
        role: nextRole,
        needsMda,
        mdaId: nextMda,
      });
      if (!approvalInput.ok) {
        toast.error('Check account approval input', {
          description: approvalInput.message,
        });
        return;
      }
      setAccountReviewing(user.id);

      fetch(`${API_BASE}/api/admin/users/${user.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: approvalInput.role, mda_id: approvalInput.mdaId }),
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
            message: `Your account was approved as ${notificationRoleLabel(approvalInput.role)}${needsMda ? ` for ${mdas.find((mda: any) => mda.id === approvalInput.mdaId)?.shortName || approvalInput.mdaId}` : ''}.`,
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
      setAccountActionText('');
      setDeleteConfirmation('');
      setAccountActionDialog({ type: 'reject', user });
    };

    const handleNeedsInfoAccount = (user: any) => {
      setAccountActionText(user.account?.profile?.review_notes || '');
      setDeleteConfirmation('');
      setAccountActionDialog({ type: 'needs-info', user });
    };

    const handleSuspendAccount = (user: any) => {
      setAccountActionText('');
      setDeleteConfirmation('');
      setAccountActionDialog({ type: 'suspend', user });
    };

    const handleDeleteAccount = (user: any) => {
      setAccountActionText('');
      setDeleteConfirmation('');
      setAccountActionDialog({ type: 'delete', user });
    };

    const closeAccountActionDialog = () => {
      if (accountActionBusy) return;
      setAccountActionDialog(null);
      setAccountActionText('');
      setDeleteConfirmation('');
    };

    const confirmRejectAccount = (user: any) => {
      const sanitizedReason = sanitizeReviewPromptText(accountActionText);
      if (sanitizedReason === null) {
        toast.error('Invalid rejection reason', {
          description: 'Use plain text under 2000 characters without unsupported control characters.',
        });
        return;
      }
      setAccountReviewing(user.id);
      setAccountActionBusy(true);

      fetch(`${API_BASE}/api/admin/users/${user.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: sanitizedReason }),
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
            message: 'Your account request was rejected. Open account settings for reviewer guidance.',
            recipientUserId: user.id,
          });
          closeAccountActionDialog();
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Rejection failed', {
            description: err instanceof Error ? err.message : 'Failed to reject account',
          });
        })
        .finally(() => {
          setAccountReviewing(null);
          setAccountActionBusy(false);
        });
    };

    const confirmNeedsInfoAccount = (user: any) => {
      const sanitizedNotes = sanitizeReviewPromptText(accountActionText);
      if (sanitizedNotes === null) {
        toast.error('Invalid review notes', {
          description: 'Use plain text under 2000 characters without unsupported control characters.',
        });
        return;
      }
      setAccountReviewing(user.id);
      setAccountActionBusy(true);

      fetch(`${API_BASE}/api/admin/users/${user.id}/needs-more-information`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: sanitizedNotes }),
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
            message: 'Your verification profile needs more information. Open account settings for reviewer guidance.',
            recipientUserId: user.id,
          });
          closeAccountActionDialog();
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Request failed', {
            description: err instanceof Error ? err.message : 'Failed to request more information',
          });
        })
        .finally(() => {
          setAccountReviewing(null);
          setAccountActionBusy(false);
        });
    };

    const confirmSuspendAccount = (user: any) => {
      setAccountReviewing(user.id);
      setAccountActionBusy(true);

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
          closeAccountActionDialog();
          fetchDashboardData();
        })
        .catch(err => {
          toast.error('Suspension failed', {
            description: err instanceof Error ? err.message : 'Failed to suspend account',
          });
        })
        .finally(() => {
          setAccountReviewing(null);
          setAccountActionBusy(false);
        });
    };

    const confirmDeleteAccount = (user: any) => {
      if (!isDeleteConfirmationMatch(deleteConfirmation, user.full_name || '')) {
        toast.error('Confirm permanent deletion', {
          description: `Type DELETE or ${user.full_name}'s full name before deleting this account.`,
        });
        return;
      }
      setAccountReviewing(user.id);
      setAccountActionBusy(true);

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
        closeAccountActionDialog();
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Delete failed', {
          description: err instanceof Error ? err.message : 'Failed to delete account',
        });
      })
      .finally(() => {
        setAccountReviewing(null);
        setAccountActionBusy(false);
      });
  };

  const confirmAccountAction = () => {
    if (!accountActionDialog || accountActionBusy) return;
    const { type, user } = accountActionDialog;
    if (type === 'reject') {
      confirmRejectAccount(user);
      return;
    }
    if (type === 'needs-info') {
      confirmNeedsInfoAccount(user);
      return;
    }
    if (type === 'suspend') {
      confirmSuspendAccount(user);
      return;
    }
    confirmDeleteAccount(user);
  };

  return {
    handleApproveAccount,
    handleRejectAccount,
    handleNeedsInfoAccount,
    handleSuspendAccount,
    handleDeleteAccount,
    closeAccountActionDialog,
    confirmAccountAction,
  };
}
