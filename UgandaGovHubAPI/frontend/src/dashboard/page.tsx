import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';
import { API_BASE } from '@/lib/api-base';
import { buildPendingAccessRequestNotifications } from '@/lib/access-request-notifications';
import {
  canCopyOneTimeApiKey,
  canViewAuditLogsTab,
  filterDashboardAuditLogs,
  filterPersonalApiCallLogs,
  getVisibleDashboardTabs,
  hasActiveApprovedApiKey,
  hasPendingOneTimeApiKeyReveal,
  type DashboardViewTab,
} from './view-helpers';
import { AccessApprovalsPanel } from './page-components/AccessApprovalsPanel';
import { AccountsPanel } from './page-components/AccountsPanel';
import { AdminDashboardSideMenu } from './page-components/AdminDashboardSideMenu';
import { AnalyticsPanel } from './page-components/AnalyticsPanel';
import { AuditPanel } from './page-components/AuditPanel';
import { createAccountReviewActions, type AccountActionDialogState } from './page-components/account-review-actions';
import { CredentialsPanel } from './page-components/CredentialsPanel';
import { DashboardDialogs } from './page-components/DashboardDialogs';
import { DashboardDrawers } from './page-components/DashboardDrawers';
import { DashboardErrorState, DashboardLoadingState } from './page-components/DashboardStatus';
import { DashboardStats } from './page-components/DashboardStats';
import { DashboardTabs } from './page-components/DashboardTabs';
import {
  buildDistributionRows,
  buildTrafficBuckets,
  fetchDashboardJson,
  fromDateTimeLocalValue,
  getSandboxLogsInRange,
  toDateTimeLocalValue,
  useDashboardViewModePreference,
} from './page-components/dashboard-page-helpers';
import { isAdminMfaRequiredError } from './page-components/dashboard-api-error';
import { MatrixPanel } from './page-components/MatrixPanel';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role, mdaId, mdas } = useUser();
  const { addNotification, notifications } = useNotifications();
  const [requests, setRequests] = useState<any[]>([]);
  const [accountRequests, setAccountRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [apiCallLogs, setApiCallLogs] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedAccessRequest, setSelectedAccessRequest] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<DashboardViewTab>('approvals');
  const [approving, setApproving] = useState<string | null>(null);
  const [accountReviewing, setAccountReviewing] = useState<string | null>(null);
  const [accountRoleInputs, setAccountRoleInputs] = useState<Record<string, string>>({});
  const [accountMdaInputs, setAccountMdaInputs] = useState<Record<string, string>>({});
  const [accountActionDialog, setAccountActionDialog] = useState<AccountActionDialogState>(null);
  const [accountActionText, setAccountActionText] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [accountActionBusy, setAccountActionBusy] = useState(false);
  const [filterMda, setFilterMda] = useState<string>('ALL');
  const [accountStatusFilter, setAccountStatusFilter] = useState<string>('ALL');
  const [accountViewMode, setAccountViewMode] = useDashboardViewModePreference('accounts');
  const [approvalViewMode, setApprovalViewMode] = useDashboardViewModePreference('approvals');
  const [credentialViewMode, setCredentialViewMode] = useDashboardViewModePreference('credentials');
  const [auditViewMode, setAuditViewMode] = useDashboardViewModePreference('audit');
  const [matrixViewMode, setMatrixViewMode] = useDashboardViewModePreference('matrix');
  const [timeRange, setTimeRange] = useState('7d');
  const [keyExpiryInputs, setKeyExpiryInputs] = useState<Record<string, string>>({});
  const [keyActionConfirmation, setKeyActionConfirmation] = useState<{ action: 'revoke' | 'delete'; request: any } | null>(null);
  const [keyActionBusy, setKeyActionBusy] = useState(false);
  const [oneTimeApiKey, setOneTimeApiKey] = useState<{
    requestId: string;
    apiName: string;
    apiKey: string;
    apiKeyPreview?: string;
    expiresAt?: string | null;
  } | null>(null);
  const [oneTimeApiKeyCopied, setOneTimeApiKeyCopied] = useState(false);
  const pendingKeyRevealClaims = useRef<Set<string>>(new Set());
  const oneTimeApiKeyOpenRef = useRef(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const dashboardSearch = (searchParams.get('q') || '').trim().toLowerCase();

  const isCurrentConsumerRequest = useCallback((request: any) => (
    request.consumer_user_id === user?.id || Boolean(mdaId && request.consumer_mda_id === mdaId)
  ), [mdaId, user?.id]);

  const claimPendingOneTimeApiKey = useCallback((request: any) => {
    if (role !== 'developer' || !hasPendingOneTimeApiKeyReveal(request) || oneTimeApiKeyOpenRef.current) return;

    const requestId = String(request.id || '');
    if (!requestId || pendingKeyRevealClaims.current.has(requestId)) return;
    pendingKeyRevealClaims.current.add(requestId);

    fetch(`${API_BASE}/api/access/${requestId}/reveal-key`, { method: 'POST' })
      .then(async res => {
        const result = await res.json().catch(() => ({}));
        if (!res.ok || result.error) {
          const error = new Error(result.error || 'Failed to reveal API key') as Error & { code?: string };
          error.code = result.code;
          throw error;
        }
        return result;
      })
      .then(result => {
        if (!result.api_key) return;
        oneTimeApiKeyOpenRef.current = true;
        setOneTimeApiKey({
          requestId,
          apiName: request.api_name || 'Approved API',
          apiKey: result.api_key,
          apiKeyPreview: result.api_key_preview,
          expiresAt: result.api_key_expires_at,
        });
        setOneTimeApiKeyCopied(false);
      })
      .catch(err => {
        pendingKeyRevealClaims.current.delete(requestId);
        if ((err as { code?: string }).code === 'ONE_TIME_KEY_UNAVAILABLE') return;
        toast.error('API key reveal failed', {
          description: err instanceof Error ? err.message : 'Failed to reveal API key',
        });
      });
  }, [role]);

  const fetchDashboardData = useCallback((showLoading = false) => {
    if (showLoading) {
      setDashboardLoading(true);
      setDashboardError('');
    }

    const canViewOversight = role === 'admin' || role === 'reviewer';
    const canViewAnalytics = canViewOversight || role === 'developer';
    Promise.all([
      fetchDashboardJson('/api/access'),
      canViewAnalytics ? fetchDashboardJson('/api/access/audit-logs') : Promise.resolve([]),
      role === 'admin' ? fetchDashboardJson('/api/access/audit-logs?scope=api-calls') : Promise.resolve({ data: [] }),
      canViewOversight ? fetchDashboardJson('/api/access/matrix') : Promise.resolve([]),
      role === 'admin' ? fetchDashboardJson('/api/admin/users') : Promise.resolve({ users: [] }),
    ])
      .then(([accessData, auditData, apiCallData, matrixData, userData]) => {
        const nextRequests = Array.isArray(accessData) ? accessData : [];
        setRequests(nextRequests);
        setAuditLogs(Array.isArray(auditData) ? auditData : Array.isArray(auditData?.data) ? auditData.data : []);
        setApiCallLogs(Array.isArray(apiCallData) ? apiCallData : Array.isArray(apiCallData?.data) ? apiCallData.data : []);
        setMatrix(Array.isArray(matrixData) ? matrixData : []);
        setAccountRequests(Array.isArray(userData.users) ? userData.users : []);
        const pendingRevealRequest = nextRequests.find(req => isCurrentConsumerRequest(req) && hasPendingOneTimeApiKeyReveal(req));
        if (pendingRevealRequest) claimPendingOneTimeApiKey(pendingRevealRequest);
      })
      .catch(err => {
        console.error(err);
        if (isAdminMfaRequiredError(err)) {
          toast.info('Enable administrator MFA', {
            description: 'Open Security settings, confirm your password, then enable MFA to use privileged workflows.',
          });
          navigate('/account/settings?tab=security', { replace: true });
          return;
        }
        setDashboardError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      })
      .finally(() => {
        if (showLoading) setDashboardLoading(false);
      });
  }, [claimPendingOneTimeApiKey, isCurrentConsumerRequest, navigate, role]);

  useEffect(() => {
    fetchDashboardData(true);
    // Default tabs depending on role
    if (role === 'developer') {
      setActiveTab('credentials');
    } else if (role === 'reviewer') {
      setActiveTab('audit');
    } else {
      setActiveTab('approvals');
    }
  }, [fetchDashboardData, role, mdaId]);

  useEffect(() => {
    if (role !== 'admin' && role !== 'developer') return;
    const intervalId = window.setInterval(() => fetchDashboardData(false), 15000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboardData, role]);

  useEffect(() => {
    if (role !== 'admin' && role !== 'api_owner') return;

    const existingKeys = new Set(
      notifications
        .map(notification => notification.dedupeKey)
        .filter((key): key is string => Boolean(key))
    );
    buildPendingAccessRequestNotifications(requests, existingKeys).forEach(notification => {
      addNotification({
        dedupeKey: notification.key,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });
    });
  }, [addNotification, notifications, requests, role]);

  const handleApprove = (id: string) => {
    const request = requests.find(req => req.id === id);
    setApproving(id);
    fetch(`${API_BASE}/api/access/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key_expires_at: fromDateTimeLocalValue(keyExpiryInputs[id]) })
    })
      .then(async res => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || 'Failed to approve access request');
        return result;
      })
      .then(result => {
        toast.success('API key generated', {
          description: isCurrentConsumerRequest(request)
            ? 'Copy the generated key from the one-time reveal dialog.'
            : 'The consumer will see a one-time copy popup in their dashboard.',
        });
        addNotification({
          type: 'key',
          title: 'Access approved',
          message: `Your access request to ${request?.api_name || 'the API'} was approved for ${request?.mda_name || 'your organization'}.`,
          recipientUserId: request?.consumer_user_id,
        });
        if (isCurrentConsumerRequest(request) && result.api_key_pending_reveal) {
          claimPendingOneTimeApiKey({
            ...request,
            status: 'APPROVED',
            api_key_preview: result.api_key_preview,
            api_key_pending_reveal: true,
            api_key_status: result.api_key_status,
            api_key_expires_at: result.api_key_expires_at,
          });
        }
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Approval failed', {
          description: err instanceof Error ? err.message : 'Failed to approve access request',
        });
      })
      .finally(() => setApproving(null));
  };


  const {
    handleApproveAccount,
    handleRejectAccount,
    handleNeedsInfoAccount,
    handleSuspendAccount,
    handleDeleteAccount,
    closeAccountActionDialog,
    confirmAccountAction,
  } = createAccountReviewActions({
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
  });

  const handleUpdateExpiry = (id: string) => {
    const request = requests.find(req => req.id === id);
    const expiryInput = keyExpiryInputs[id] ?? toDateTimeLocalValue(request?.api_key_expires_at);
    fetch(`${API_BASE}/api/access/${id}/key-expiry`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key_expires_at: fromDateTimeLocalValue(expiryInput) })
    })
      .then(async res => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || 'Failed to update key expiry');
        return result;
      })
      .then(result => {
        const expiryLabel = result.api_key_expires_at
          ? new Date(result.api_key_expires_at).toLocaleString()
          : 'No expiry';
        toast.success('API key expiry updated', {
          description: result.api_key_expires_at ? `New expiry: ${expiryLabel}` : 'The key no longer has an expiry date.',
        });
        addNotification({
          type: 'key',
          title: 'API key expiry updated',
          message: `Your API key for ${request?.api_name || 'the API'} now expires: ${expiryLabel}.`,
          recipientUserId: request?.consumer_user_id,
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Update failed', {
          description: err instanceof Error ? err.message : 'Failed to update key expiry',
        });
      });
  };

  const openKeyActionConfirmation = (action: 'revoke' | 'delete', request: any) => {
    setKeyActionConfirmation({ action, request });
  };

  const handleRevokeKey = (request: any) => {
    setKeyActionBusy(true);
    fetch(`${API_BASE}/api/access/${request.id}/revoke-key`, { method: 'POST' })
      .then(async res => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || 'Failed to revoke key');
        return result;
      })
      .then(() => {
        toast.success('API key revoked', {
          description: 'Existing clients using this key are blocked immediately.',
        });
        addNotification({
          type: 'key',
          title: 'API key revoked',
          message: `Your API key for ${request?.api_name || 'the API'} was revoked.`,
          recipientUserId: request?.consumer_user_id,
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Revoke failed', {
          description: err instanceof Error ? err.message : 'Failed to revoke key',
        });
      })
      .finally(() => {
        setKeyActionBusy(false);
        setKeyActionConfirmation(null);
      });
  };

  const handleDeleteKey = (request: any) => {
    setKeyActionBusy(true);
    fetch(`${API_BASE}/api/access/${request.id}/key`, { method: 'DELETE' })
      .then(async res => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || 'Failed to delete key');
        return result;
      })
      .then(() => {
        toast.success('API key deleted', {
          description: 'The access record remains available for audit review.',
        });
        addNotification({
          type: 'key',
          title: 'API key deleted',
          message: `Your API key for ${request?.api_name || 'the API'} was deleted. The access request remains available for audit review.`,
          recipientUserId: request?.consumer_user_id,
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Delete failed', {
          description: err instanceof Error ? err.message : 'Failed to delete key',
        });
      })
      .finally(() => {
        setKeyActionBusy(false);
        setKeyActionConfirmation(null);
      });
  };

  const confirmKeyAction = () => {
    if (!keyActionConfirmation || keyActionBusy) return;
    if (keyActionConfirmation.action === 'revoke') {
      handleRevokeKey(keyActionConfirmation.request);
    } else {
      handleDeleteKey(keyActionConfirmation.request);
    }
  };

  const handleCopyOneTimeApiKey = async () => {
    if (!canCopyOneTimeApiKey(oneTimeApiKey?.apiKey, oneTimeApiKeyCopied)) return;
    try {
      await navigator.clipboard.writeText(oneTimeApiKey!.apiKey);
      setOneTimeApiKeyCopied(true);
      toast.success('API key copied', {
        description: 'Paste it into the sandbox console or store it in your approved secret manager.',
      });
    } catch {
      toast.error('Copy failed', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  // Filter requests depending on role
  // Owner only sees requests for their MDA's APIs
  // Admin sees all
  // Developer sees their own requests
  const activeDashboardRequests = requests.filter(req => req.status !== 'APPROVED' || hasActiveApprovedApiKey(req));
  const currentConsumerRequests = requests.filter(isCurrentConsumerRequest);
  const canViewAuditLogs = canViewAuditLogsTab(role, currentConsumerRequests);
  useEffect(() => {
    const visibleDashboardTabs = getVisibleDashboardTabs(role, canViewAuditLogs);
    if (visibleDashboardTabs.includes(activeTab)) return;
    setActiveTab(visibleDashboardTabs[0] || 'analytics');
  }, [activeTab, role, canViewAuditLogs]);
  const visibleRequests = activeDashboardRequests.filter(req => {
    if (role === 'developer') {
      return isCurrentConsumerRequest(req);
    }
    if (role === 'api_owner') {
      return req.owning_mda_id === mdaId;
    }
    return true; // Admin and Reviewer see all
  }).filter(req => {
    if (!dashboardSearch) return true;
    return [
      req.mda_name,
      req.api_name,
      req.legal_basis,
      req.purpose,
      req.volume_tier,
      req.requested_fields,
      req.status,
      req.api_key_status,
    ].some(value => String(value || '').toLowerCase().includes(dashboardSearch));
  });

  const visibleLogs = filterDashboardAuditLogs(auditLogs, {
    role,
    filterMda,
    search: dashboardSearch,
  });
  const visibleApiCallLogs = filterPersonalApiCallLogs(apiCallLogs, {
    userId: user?.id,
    mdaId,
    search: dashboardSearch,
  });

  const filteredAccountRequests = accountRequests.filter(user => {
    if (accountStatusFilter === 'ALL') return true;
    return user.status === accountStatusFilter;
  }).filter(user => {
    if (!dashboardSearch) return true;
    return [
      user.full_name,
      user.email,
      user.account_type,
      user.status,
      user.role,
      user.requested_role,
      user.requested_organization,
      user.requested_purpose,
      user.mda_id,
      user.requested_mda_id,
      user.account?.profile?.verification_status,
    ].some(value => String(value || '').toLowerCase().includes(dashboardSearch));
  });
  const filteredCredentialRequests = currentConsumerRequests.filter(req => {
    if (!dashboardSearch) return true;
    return [
      req.api_name,
      req.purpose,
      req.status,
      req.api_key_preview,
      req.api_key_status,
      req.api_key_expires_at,
      req.requested_fields,
      req.volume_tier,
    ].some(value => String(value || '').toLowerCase().includes(dashboardSearch));
  });
  const accountStatusCounts = accountRequests.reduce((counts, user) => {
    counts[user.status] = (counts[user.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const pendingAccountCount = accountRequests.filter(user => user.status === 'PENDING_REVIEW').length;

  // Calculate statistics
  const totalApproved = requests.filter(hasActiveApprovedApiKey).length;
  const pendingApprovals = requests.filter(r => r.status === 'PENDING').length;
  const totalCallsCount = auditLogs.filter(l => l.event_type.startsWith('SANDBOX_CALL')).length;
  const deniedCallsCount = auditLogs.filter(l => l.event_type === 'SANDBOX_CALL_DENIED').length;
  const successRate = totalCallsCount > 0 
    ? Math.round(((totalCallsCount - deniedCallsCount) / totalCallsCount) * 100) 
    : 100;
  const analyticsLogs = getSandboxLogsInRange(auditLogs, timeRange);
  const analyticsTraffic = buildTrafficBuckets(analyticsLogs, timeRange);
  const analyticsDistribution = buildDistributionRows(analyticsLogs);
  const analyticsAllowed = analyticsLogs.filter(log => log.event_type === 'SANDBOX_CALL_ALLOWED').length;
  const analyticsDenied = analyticsLogs.filter(log => log.event_type === 'SANDBOX_CALL_DENIED').length;
  const analyticsSuccessRate = analyticsLogs.length > 0
    ? Math.round((analyticsAllowed / analyticsLogs.length) * 100)
    : 0;
  const maxTrafficCount = Math.max(1, ...analyticsTraffic.map(bucket => bucket.count));
  const distributionColors = ['bg-[#3ecf8e]', 'bg-blue-500', 'bg-orange-400', 'bg-purple-400', 'bg-yellow-400', 'bg-red-400'];
  const keyActionRequest = keyActionConfirmation?.request;
  const keyActionIsDelete = keyActionConfirmation?.action === 'delete';
  const keyActionTitle = keyActionIsDelete ? 'Delete API key?' : 'Revoke API key?';
  const keyActionButtonLabel = keyActionIsDelete ? 'Delete key' : 'Revoke key';

  const renderDashboardContent = () => {
    if (dashboardLoading) return <DashboardLoadingState />;
    if (dashboardError) return <DashboardErrorState error={dashboardError} />;

    if (activeTab === 'approvals') {
      return (
        <AccessApprovalsPanel
          visibleRequests={visibleRequests}
          approvalViewMode={approvalViewMode}
          setApprovalViewMode={setApprovalViewMode}
          setSelectedAccessRequest={setSelectedAccessRequest}
          keyExpiryInputs={keyExpiryInputs}
          setKeyExpiryInputs={setKeyExpiryInputs}
          handleApprove={handleApprove}
          approving={approving}
          handleUpdateExpiry={handleUpdateExpiry}
          openKeyActionConfirmation={openKeyActionConfirmation}
        />
      );
    }

    if (activeTab === 'accounts' && role === 'admin') {
      return (
        <AccountsPanel
          accountRequests={accountRequests}
          accountStatusCounts={accountStatusCounts}
          accountStatusFilter={accountStatusFilter}
          setAccountStatusFilter={setAccountStatusFilter}
          accountViewMode={accountViewMode}
          setAccountViewMode={setAccountViewMode}
          filteredAccountRequests={filteredAccountRequests}
          accountRoleInputs={accountRoleInputs}
          setAccountRoleInputs={setAccountRoleInputs}
          accountMdaInputs={accountMdaInputs}
          setAccountMdaInputs={setAccountMdaInputs}
          accountReviewing={accountReviewing}
          mdas={mdas}
          setSelectedAccount={setSelectedAccount}
          handleApproveAccount={handleApproveAccount}
          handleNeedsInfoAccount={handleNeedsInfoAccount}
          handleRejectAccount={handleRejectAccount}
          handleSuspendAccount={handleSuspendAccount}
          handleDeleteAccount={handleDeleteAccount}
        />
      );
    }

    if (activeTab === 'credentials') {
      return (
        <CredentialsPanel
          filteredCredentialRequests={filteredCredentialRequests}
          credentialViewMode={credentialViewMode}
          setCredentialViewMode={setCredentialViewMode}
          dashboardSearch={dashboardSearch}
        />
      );
    }

    if (activeTab === 'apiLogs' && role === 'admin') {
      return (
        <AuditPanel
          role={role}
          logScope="api-calls"
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          filterMda="ALL"
          setFilterMda={setFilterMda}
          mdas={mdas}
          auditViewMode={auditViewMode}
          setAuditViewMode={setAuditViewMode}
          visibleLogs={visibleApiCallLogs}
          selectedLog={selectedLog}
          setSelectedLog={setSelectedLog}
        />
      );
    }

    if (activeTab === 'audit' && canViewAuditLogs) {
      return (
        <AuditPanel
          role={role}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          filterMda={filterMda}
          setFilterMda={setFilterMda}
          mdas={mdas}
          auditViewMode={auditViewMode}
          setAuditViewMode={setAuditViewMode}
          visibleLogs={visibleLogs}
          selectedLog={selectedLog}
          setSelectedLog={setSelectedLog}
        />
      );
    }

    if (activeTab === 'matrix') {
      return (
        <MatrixPanel
          mdas={mdas}
          matrix={matrix}
          matrixViewMode={matrixViewMode}
          setMatrixViewMode={setMatrixViewMode}
        />
      );
    }

    return (
      <AnalyticsPanel
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        analyticsLogs={analyticsLogs}
        analyticsAllowed={analyticsAllowed}
        analyticsDenied={analyticsDenied}
        analyticsSuccessRate={analyticsSuccessRate}
        analyticsTraffic={analyticsTraffic}
        maxTrafficCount={maxTrafficCount}
        analyticsDistribution={analyticsDistribution}
        distributionColors={distributionColors}
      />
    );
  };

  const dashboardOverlays = (
    <>
      <DashboardDialogs
        oneTimeApiKey={oneTimeApiKey}
        oneTimeApiKeyCopied={oneTimeApiKeyCopied}
        oneTimeApiKeyOpenRef={oneTimeApiKeyOpenRef}
        setOneTimeApiKey={setOneTimeApiKey}
        setOneTimeApiKeyCopied={setOneTimeApiKeyCopied}
        handleCopyOneTimeApiKey={handleCopyOneTimeApiKey}
        keyActionConfirmation={keyActionConfirmation}
        keyActionBusy={keyActionBusy}
        setKeyActionConfirmation={setKeyActionConfirmation}
        keyActionTitle={keyActionTitle}
        keyActionIsDelete={keyActionIsDelete}
        keyActionRequest={keyActionRequest}
        confirmKeyAction={confirmKeyAction}
        keyActionButtonLabel={keyActionButtonLabel}
        accountActionDialog={accountActionDialog}
        accountActionText={accountActionText}
        setAccountActionText={setAccountActionText}
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        accountActionBusy={accountActionBusy}
        closeAccountActionDialog={closeAccountActionDialog}
        confirmAccountAction={confirmAccountAction}
      />
      <DashboardDrawers
        selectedAccessRequest={selectedAccessRequest}
        setSelectedAccessRequest={setSelectedAccessRequest}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        mdas={mdas}
        selectedLog={selectedLog}
        setSelectedLog={setSelectedLog}
      />
    </>
  );

  if (role === 'admin') {
    return (
      <div className="flex h-full min-h-0 w-full overflow-hidden text-left text-[#ededed]">
        <AdminDashboardSideMenu
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovals={pendingApprovals}
          pendingAccountCount={pendingAccountCount}
        />
        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-5 p-3 lg:p-5">
            <DashboardStats
              totalApproved={totalApproved}
              pendingApprovals={pendingApprovals}
              totalCallsCount={totalCallsCount}
              successRate={successRate}
            />
            <div className="min-h-0 flex-1 w-full">
              {renderDashboardContent()}
            </div>
          </div>
        </main>
        {dashboardOverlays}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-5 p-3 lg:p-5 text-left max-w-[1400px] mx-auto w-full text-[#ededed] relative">
        <DashboardStats
          totalApproved={totalApproved}
          pendingApprovals={pendingApprovals}
          totalCallsCount={totalCallsCount}
          successRate={successRate}
        />
        <DashboardTabs
          role={role}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovals={pendingApprovals}
          pendingAccountCount={pendingAccountCount}
          canViewAuditLogs={canViewAuditLogs}
        />

        <div className="min-h-0 flex-1 w-full">
          {renderDashboardContent()}
        </div>

        {dashboardOverlays}
      </div>
    </div>
  );
}
