import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  IconShield, 
  IconKey, 
  IconList,
  IconGridDots,
  IconListDetails, 
  IconGridPattern, 
  IconChartBar, 
  IconExternalLink,
  IconActivity,
  IconClock,
  IconCalendarTime,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconBan,
  IconDotsVertical,
  IconTrash,
  IconX
} from '@tabler/icons-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function dateToDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toDateTimeLocalValue(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return dateToDateTimeLocalValue(date);
}

function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function formatRemainingDuration(value?: string | null) {
  if (!value) return '';
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return '';

  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 'expired';

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const days = Math.ceil(diffMs / dayMs);
  if (days >= 1) return `${days}d`;

  const hours = Math.ceil(diffMs / hourMs);
  if (hours >= 1) return `${hours}h`;

  return `${Math.ceil(diffMs / minuteMs)}m`;
}

type TrafficBucket = {
  key: string;
  label: string;
  count: number;
};

type DistributionRow = {
  id: string;
  label: string;
  count: number;
  percentage: number;
};

function parseAuditDate(value?: string) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = new Date(value.replace(' ', 'T'));
  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function getAnalyticsStart(range: string) {
  const hours = range === '24h' ? 24 : range === '30d' ? 24 * 30 : 24 * 7;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function approvalRequiresMda(accountType: string | null | undefined, role: string) {
  const normalizedAccountType = accountType === 'government' ? 'government_employee' : accountType;
  return role === 'api_owner' || normalizedAccountType === 'government_employee' || normalizedAccountType === 'mda_api_owner';
}

function AccountStatusBadge({ status }: { status: string }) {
  const toneClass =
    status === 'APPROVED' ? 'border-[#3ecf8e]/20 bg-[#3ecf8e]/5 text-[#3ecf8e]' :
    status === 'PENDING_REVIEW' ? 'border-orange-400/20 bg-orange-400/5 text-orange-300' :
    status === 'SUSPENDED' ? 'border-red-400/20 bg-red-400/5 text-red-300' :
    'border-[#2e2e2e] bg-[#141414] text-[#b5b5b5]';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase ${toneClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function getTimeRangeLabel(range: string) {
  if (range === '24h') return 'Last 24 Hours';
  if (range === '30d') return 'Last 30 Days';
  return 'Last 7 Days';
}

function getSandboxLogsInRange(logs: any[], range: string) {
  const start = getAnalyticsStart(range).getTime();
  return logs.filter(log => {
    if (!String(log.event_type || '').startsWith('SANDBOX_CALL')) return false;
    const createdAt = parseAuditDate(log.created_at);
    return createdAt ? createdAt.getTime() >= start : false;
  });
}

function buildTrafficBuckets(logs: any[], range: string): TrafficBucket[] {
  if (range === '24h') {
    const bucketHours = 4;
    return Array.from({ length: 6 }, (_, index) => {
      const start = new Date(Date.now() - (6 - index) * bucketHours * 60 * 60 * 1000);
      const end = new Date(start.getTime() + bucketHours * 60 * 60 * 1000);
      const count = logs.filter(log => {
        const createdAt = parseAuditDate(log.created_at);
        return createdAt && createdAt >= start && createdAt < end;
      }).length;

      return {
        key: start.toISOString(),
        label: start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        count,
      };
    });
  }

  const days = range === '30d' ? 30 : 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days - 1 - index));
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    const count = logs.filter(log => {
      const createdAt = parseAuditDate(log.created_at);
      return createdAt && createdAt >= day && createdAt < nextDay;
    }).length;

    const isToday = day.toDateString() === today.toDateString();
    return {
      key: day.toISOString(),
      label: isToday
        ? 'Today'
        : day.toLocaleDateString(undefined, days > 7 ? { month: 'short', day: 'numeric' } : { weekday: 'short' }),
      count,
    };
  });
}

function buildDistributionRows(logs: any[]): DistributionRow[] {
  const counts = logs.reduce<Record<string, { label: string; count: number }>>((acc, log) => {
    const id = log.api_id || 'unknown';
    const label = log.api_name || log.api_id || 'Unknown Registry';
    acc[id] = acc[id] || { label, count: 0 };
    acc[id].count += 1;
    return acc;
  }, {});

  const total = logs.length || 1;
  return Object.entries(counts)
    .map(([id, row]) => ({
      id,
      label: row.label,
      count: row.count,
      percentage: Math.round((row.count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

function formatExpiryLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Set expiry';

  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart}, ${timePart}`;
}

function ExpiryDatePicker({
  value,
  onChange,
  onApply,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply?: () => void;
}) {
  const selectedDate = useMemo(() => value ? new Date(value) : null, [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  useEffect(() => {
    if (selectedDate && !Number.isNaN(selectedDate.getTime())) {
      setViewDate(selectedDate);
    }
  }, [selectedDate, value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlankDays = new Date(year, month, 1).getDay();
  const currentTime = value?.slice(11, 16) || '09:00';

  const setDatePart = (day: number) => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    onChange(dateToDateTimeLocalValue(new Date(year, month, day, hours || 0, minutes || 0)));
  };

  const setTimePart = (time: string) => {
    const base = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date();
    const [hours, minutes] = time.split(':').map(Number);
    onChange(dateToDateTimeLocalValue(new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hours || 0,
      minutes || 0,
    )));
  };

  const setQuickExpiry = (days: number) => {
    onChange(dateToDateTimeLocalValue(new Date(Date.now() + days * 24 * 60 * 60 * 1000)));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-[28px] w-[170px] items-center justify-between gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-left text-[11px] text-[#ededed] transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#191919]"
        >
          <span className="min-w-0 truncate">{formatExpiryLabel(value)}</span>
          <IconCalendarTime className="h-3.5 w-3.5 shrink-0 text-[#8b8b8b]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[274px] border-[#2e2e2e] bg-[#1c1c1c] p-3 text-[#ededed]"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#2e2e2e] text-[#8b8b8b] hover:bg-[#2e2e2e] hover:text-white"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-[12px] font-semibold text-white">
            {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#2e2e2e] text-[#8b8b8b] hover:bg-[#2e2e2e] hover:text-white"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-mono uppercase text-[#8b8b8b]">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlankDays }).map((_, index) => (
            <span key={`blank-${index}`} className="h-7" />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const isSelected =
              selectedDate?.getFullYear() === year &&
              selectedDate?.getMonth() === month &&
              selectedDate?.getDate() === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setDatePart(day)}
                className={`h-7 rounded-md text-[11px] transition-colors ${
                  isSelected
                    ? 'bg-[#3ecf8e] text-black font-semibold'
                    : 'text-[#ededed] hover:bg-[#2e2e2e]'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#2e2e2e] pt-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Time</span>
          <input
            type="time"
            value={currentTime}
            onChange={event => setTimePart(event.target.value)}
            className="h-8 rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-[#ededed] focus:outline-none"
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[30, 60, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setQuickExpiry(days)}
              className="h-7 rounded-md border border-[#2e2e2e] text-[11px] text-[#8b8b8b] hover:bg-[#2e2e2e] hover:text-white"
            >
              {days}d
            </button>
          ))}
        </div>

        {onApply && (
          <button
            type="button"
            onClick={() => {
              onApply();
              setIsOpen(false);
            }}
            className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] text-[12px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90"
          >
            <IconCalendarTime className="h-3.5 w-3.5" />
            Update expiry
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

async function fetchDashboardJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `${path} failed with ${response.status}`);
  }
  return body;
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const { user, role, mdaId, mdas } = useUser();
  const { addNotification } = useNotifications();
  const [requests, setRequests] = useState<any[]>([]);
  const [accountRequests, setAccountRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('approvals');
  const [approving, setApproving] = useState<string | null>(null);
  const [accountReviewing, setAccountReviewing] = useState<string | null>(null);
  const [accountRoleInputs, setAccountRoleInputs] = useState<Record<string, string>>({});
  const [accountMdaInputs, setAccountMdaInputs] = useState<Record<string, string>>({});
  const [filterMda, setFilterMda] = useState<string>('ALL');
  const [accountStatusFilter, setAccountStatusFilter] = useState<string>('ALL');
  const [accountViewMode, setAccountViewMode] = useState<'list' | 'grid'>('list');
  const [timeRange, setTimeRange] = useState('7d');
  const [keyExpiryInputs, setKeyExpiryInputs] = useState<Record<string, string>>({});
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const dashboardSearch = (searchParams.get('q') || '').trim().toLowerCase();

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
      canViewOversight ? fetchDashboardJson('/api/access/matrix') : Promise.resolve([]),
      role === 'admin' ? fetchDashboardJson('/api/admin/users') : Promise.resolve({ users: [] }),
    ])
      .then(([accessData, auditData, matrixData, userData]) => {
        setRequests(accessData);
        setAuditLogs(auditData);
        setMatrix(matrixData);
        setAccountRequests(Array.isArray(userData.users) ? userData.users : []);
      })
      .catch(err => {
        console.error(err);
        setDashboardError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      })
      .finally(() => {
        if (showLoading) setDashboardLoading(false);
      });
  }, [role]);

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
      .then(() => {
        toast.success('API key generated', {
          description: 'The access request was approved and a sandbox key was generated.',
        });
        addNotification({
          type: 'key',
          title: 'Access approved',
          message: `${request?.mda_name || 'An agency'} was approved for ${request?.api_name || 'an API'}.`,
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Approval failed', {
          description: err instanceof Error ? err.message : 'Failed to approve access request',
        });
      })
      .finally(() => setApproving(null));
  };

  const handleApproveAccount = (user: any) => {
    const nextRole = accountRoleInputs[user.id] || user.requested_role;
    const nextMda = accountMdaInputs[user.id] || user.requested_mda_id || mdas[0]?.id || '';
    const needsMda = approvalRequiresMda(user.account_type, nextRole);
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
          message: `${user.full_name} was approved as ${nextRole}${needsMda ? ` for ${mdas.find(mda => mda.id === nextMda)?.shortName || nextMda}` : ''}.`,
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
          message: `${user.full_name}'s account request was rejected${reason ? `: ${reason}` : '.'}`,
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

  const handleUpdateExpiry = (id: string) => {
    const request = requests.find(req => req.id === id);
    fetch(`${API_BASE}/api/access/${id}/key-expiry`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key_expires_at: fromDateTimeLocalValue(keyExpiryInputs[id]) })
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
          message: `${request?.api_name || 'API key'} now expires: ${expiryLabel}.`,
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Update failed', {
          description: err instanceof Error ? err.message : 'Failed to update key expiry',
        });
      });
  };

  const handleRevokeKey = (id: string) => {
    if (!confirm('Revoke this API key? Existing clients will be blocked immediately.')) return;
    fetch(`${API_BASE}/api/access/${id}/revoke-key`, { method: 'POST' })
      .then(async res => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || 'Failed to revoke key');
        return result;
      })
      .then(() => {
        toast.success('API key revoked', {
          description: 'Existing clients using this key are blocked immediately.',
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Revoke failed', {
          description: err instanceof Error ? err.message : 'Failed to revoke key',
        });
      });
  };

  const handleDeleteKey = (id: string) => {
    if (!confirm('Delete this API key? The access request remains for audit, but the token will no longer be visible or usable.')) return;
    fetch(`${API_BASE}/api/access/${id}/key`, { method: 'DELETE' })
      .then(async res => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || 'Failed to delete key');
        return result;
      })
      .then(() => {
        toast.success('API key deleted', {
          description: 'The access record remains available for audit review.',
        });
        fetchDashboardData();
      })
      .catch(err => {
        toast.error('Delete failed', {
          description: err instanceof Error ? err.message : 'Failed to delete key',
        });
      });
  };

  // Filter requests depending on role
  // Owner only sees requests for their MDA's APIs
  // Admin sees all
  // Developer sees their own requests
  const currentMda = mdas.find(m => m.id === mdaId);
  const isCurrentConsumerRequest = (request: any) => (
    mdaId ? request.consumer_mda_id === mdaId : request.consumer_user_id === user?.id
  );
  const activeCredentialRequests = requests.filter(r => isCurrentConsumerRequest(r) && r.status === 'APPROVED' && r.api_key_preview && (r.api_key_status || 'ACTIVE') === 'ACTIVE');
  const visibleRequests = requests.filter(req => {
    if (role === 'developer') {
      return isCurrentConsumerRequest(req);
    }
    if (role === 'api_owner') {
      // Find APIs that belong to the active owner's MDA
      // api_owner represents NIRA by default (mda-01) or whatever they select in header
      return req.api_id.startsWith(`api-${currentMda?.shortName.toLowerCase()}`);
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

  const visibleLogs = auditLogs.filter(log => {
    if (filterMda !== 'ALL' && log.mda_id !== filterMda) return false;
    return true;
  }).filter(log => {
    if (!dashboardSearch) return true;
    return [
      log.event_type,
      log.mda_name,
      log.api_name,
      log.request_id,
      log.correlation_id,
      log.details,
    ].some(value => String(value || '').toLowerCase().includes(dashboardSearch));
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
  const filteredCredentialRequests = activeCredentialRequests.filter(req => {
    if (!dashboardSearch) return true;
    return [
      req.api_name,
      req.purpose,
      req.api_key_preview,
      req.api_key_status,
      req.api_key_expires_at,
    ].some(value => String(value || '').toLowerCase().includes(dashboardSearch));
  });
  const accountStatusCounts = accountRequests.reduce((counts, user) => {
    counts[user.status] = (counts[user.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const pendingAccountCount = accountRequests.filter(user => user.status === 'PENDING_REVIEW').length;

  // Calculate statistics
  const totalApproved = requests.filter(r => r.status === 'APPROVED').length;
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

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-5 p-3 lg:p-5 text-left max-w-[1400px] mx-auto w-full text-[#ededed] relative">
      
      {/* Stats Summary Panel */}
      <div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Approved Channels</span>
            <span className="text-[24px] font-bold text-white mt-1">{totalApproved}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 flex items-center justify-center text-[#3ecf8e]">
            <IconKey className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Pending Approvals</span>
            <span className="text-[24px] font-bold text-white mt-1">{pendingApprovals}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-400/10 border border-orange-400/20 flex items-center justify-center text-orange-400">
            <IconClock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Total Audited Hits</span>
            <span className="text-[24px] font-bold text-white mt-1">{totalCallsCount}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <IconActivity className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Compliance Rate</span>
            <span className="text-[24px] font-bold text-white mt-1">{successRate}%</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 flex items-center justify-center text-[#3ecf8e]">
            <IconShield className="w-5 h-5" />
          </div>
        </div>
      </div>


      {/* Navigation Tabs */}
      <div className="flex shrink-0 border-b border-[#2e2e2e] gap-1 bg-[#141414] p-1 rounded-lg self-start">
        {role !== 'developer' && role !== 'reviewer' && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'approvals' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
            }`}
          >
            <IconShield className="w-4 h-4" />
            Access Approvals
            {pendingApprovals > 0 && (
              <span className="h-4.5 min-w-4.5 px-1 bg-orange-500 text-white font-bold rounded-full text-[10px] flex items-center justify-center">
                {pendingApprovals}
              </span>
            )}
          </button>
        )}

        {role === 'admin' && (
          <button
            onClick={() => setActiveTab('accounts')}
            className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'accounts' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
            }`}
          >
            <IconCircleCheck className="w-4 h-4" />
            Accounts
            {pendingAccountCount > 0 && (
              <span className="h-4.5 min-w-4.5 px-1 bg-orange-500 text-white font-bold rounded-full text-[10px] flex items-center justify-center">
                {pendingAccountCount}
              </span>
            )}
          </button>
        )}

        {(role === 'developer' || role === 'admin') && (
          <button
            onClick={() => setActiveTab('credentials')}
            className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'credentials' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
            }`}
          >
            <IconKey className="w-4 h-4" />
            My Agency Credentials
          </button>
        )}

        {(role === 'reviewer' || role === 'admin') && (
          <>
            <button
              onClick={() => setActiveTab('audit')}
              className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'audit' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
              }`}
            >
              <IconListDetails className="w-4 h-4" />
              Audit Trails
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'matrix' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
              }`}
            >
              <IconGridPattern className="w-4 h-4" />
              Interoperability Matrix
            </button>
          </>
        )}

        {(role === 'developer' || role === 'reviewer' || role === 'admin') && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'analytics' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
            }`}
          >
            <IconChartBar className="w-4 h-4" />
            Analytics
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="min-h-0 flex-1 w-full">
        {dashboardLoading && (
          <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
            <div className="border-b border-[#2e2e2e] bg-[#141414] p-4">
              <div className="h-4 w-44 animate-pulse rounded bg-[#2e2e2e]" />
              <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-[#242424]" />
            </div>
            <div className="divide-y divide-[#2e2e2e]">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_120px] items-center gap-4 px-4 py-4">
                  <div className="h-4 w-36 animate-pulse rounded bg-[#242424]" />
                  <div className="h-4 w-48 animate-pulse rounded bg-[#242424]" />
                  <div className="h-4 w-28 animate-pulse rounded bg-[#242424]" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-[#242424]" />
                  <div className="ml-auto h-8 w-24 animate-pulse rounded bg-[#242424]" />
                </div>
              ))}
            </div>
          </div>
        )}
        {!dashboardLoading && dashboardError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-[13px] text-red-300">
            {dashboardError}
          </div>
        )}
        {/* Tab 1: Access Approvals */}
        {!dashboardLoading && !dashboardError && activeTab === 'approvals' && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex justify-between items-center">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Active Access Requests</h2>
                  <p className="text-[12px] text-[#8b8b8b] mt-0.5">Evaluate legal mandate alignment and manage cryptographically bound sandbox API keys.</p>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
              <Table className="min-w-[1060px]">
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Consumer MDA</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">API Requested</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Lawful Basis</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Purpose</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Fields & Tier</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Status</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                        No access requests found matching your agency permissions.
                      </TableCell>
                    </TableRow>
                  ) : visibleRequests.map(req => (
                    <TableRow key={req.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                      <TableCell className="py-3.5 px-4 font-semibold text-[13px] text-[#ededed]">{req.mda_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-white font-medium">{req.api_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] italic">"{req.legal_basis || 'Not Provided'}"</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] max-w-[180px] truncate" title={req.purpose}>{req.purpose}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[12px] text-[#8b8b8b]">
                        <div className="font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
                        <div className="truncate max-w-[150px] mt-0.5">{req.requested_fields || 'All'}</div>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px]">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono border uppercase
                          ${req.status === 'APPROVED' && (req.api_key_status || 'ACTIVE') === 'ACTIVE' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' :
                            req.status === 'APPROVED' ? 'text-red-300 border-red-400/20 bg-red-400/5' :
                            'text-orange-400 border-orange-400/20 bg-orange-400/5'}
                        `}>
                          {req.status === 'APPROVED' ? (req.api_key_status || 'ACTIVE') : req.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right">
                        {req.status === 'PENDING' ? (
                          <div className="flex flex-col items-end gap-2">
                            <ExpiryDatePicker
                              value={keyExpiryInputs[req.id] ?? toDateTimeLocalValue()}
                              onChange={value => setKeyExpiryInputs(current => ({ ...current, [req.id]: value }))}
                            />
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={approving === req.id}
                              className="h-[28px] px-3 bg-[#3ecf8e] hover:bg-[#3ecf8e]/95 text-black font-semibold rounded-md text-[12px] transition-all disabled:opacity-50"
                            >
                              {approving === req.id ? 'Approving...' : 'Approve key'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex w-[204px] items-center justify-between gap-1.5 font-mono text-[12px] text-[#8b8b8b]">
                              <span className="min-w-0 truncate">
                                {req.api_key_preview || 'Key deleted'}
                              </span>
                            </div>
                            {req.api_key_preview && (
                              <div className="flex w-[204px] items-center justify-start gap-1.5">
                                <ExpiryDatePicker
                                  value={keyExpiryInputs[req.id] ?? toDateTimeLocalValue(req.api_key_expires_at)}
                                  onChange={value => setKeyExpiryInputs(current => ({ ...current, [req.id]: value }))}
                                  onApply={() => handleUpdateExpiry(req.id)}
                                />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="API key actions"
                                      className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#2e2e2e] text-[#8b8b8b] transition-colors hover:bg-[#2e2e2e] hover:text-white"
                                    >
                                      <IconDotsVertical className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-44 border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => handleRevokeKey(req.id)}
                                      className="flex cursor-pointer items-center gap-2 text-[12px] text-orange-300 focus:bg-orange-400/10 focus:text-orange-200"
                                    >
                                      <IconBan className="h-3.5 w-3.5" />
                                      Revoke key
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteKey(req.id)}
                                      className="flex cursor-pointer items-center gap-2 text-[12px] text-red-300 focus:bg-red-400/10 focus:text-red-200"
                                    >
                                      <IconTrash className="h-3.5 w-3.5" />
                                      Delete key
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Account Requests */}
        {!dashboardLoading && !dashboardError && activeTab === 'accounts' && role === 'admin' && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-white">Accounts</h2>
                  <p className="mt-0.5 max-w-[520px] text-[12px] leading-5 text-[#8b8b8b]">Review every account, update access, change status, request more information, or delete accounts when required.</p>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-1">
                    {[
                      ['ALL', 'All'],
                      ['PENDING_REVIEW', 'Pending'],
                      ['APPROVED', 'Approved'],
                      ['REJECTED', 'Rejected'],
                      ['SUSPENDED', 'Suspended'],
                    ].map(([value, label]) => {
                      const count = value === 'ALL' ? accountRequests.length : accountStatusCounts[value] || 0;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setAccountStatusFilter(value)}
                          className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors ${
                            accountStatusFilter === value ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                          }`}
                        >
                          {label}
                          {count > 0 && (
                            <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                              value === 'PENDING_REVIEW' ? 'bg-orange-500 text-white' : 'bg-[#2e2e2e] text-[#b5b5b5]'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#141414] p-1">
                    <button
                      type="button"
                      aria-label="Account card view"
                      onClick={() => setAccountViewMode('grid')}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        accountViewMode === 'grid' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                      }`}
                    >
                      <IconGridDots className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Account list view"
                      onClick={() => setAccountViewMode('list')}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        accountViewMode === 'list' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                      }`}
                    >
                      <IconList className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              {accountViewMode === 'grid' ? (
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {filteredAccountRequests.length === 0 ? (
                    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                      No accounts match this filter.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {filteredAccountRequests.map(account => {
                        const selectedRole = accountRoleInputs[account.id] || account.role || account.requested_role || 'developer';
                        const needsMda = approvalRequiresMda(account.account_type, selectedRole);
                        const selectedMda = accountMdaInputs[account.id] || account.mda_id || account.requested_mda_id || (needsMda ? mdas[0]?.id : '') || '';
                        const primaryActionLabel =
                          accountReviewing === account.id ? 'Saving...' :
                          account.status === 'APPROVED' ? 'Update' :
                          account.status === 'SUSPENDED' || account.status === 'REJECTED' ? 'Restore' :
                          'Approve';

                        return (
                          <div key={account.id} className="flex min-h-[236px] flex-col rounded-lg border border-[#2e2e2e] bg-[#181818] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-semibold text-white" title={account.full_name}>{account.full_name}</div>
                                <div className="mt-0.5 truncate text-[12px] text-[#8b8b8b]" title={account.email}>{account.email}</div>
                              </div>
                              <AccountStatusBadge status={account.status} />
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                              <div className="min-w-0">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Account Type</div>
                                <div className="mt-1 truncate capitalize text-[#ededed]" title={String(account.account_type || '').replace(/_/g, ' ')}>{String(account.account_type || '').replace(/_/g, ' ')}</div>
                              </div>
                              <div className="min-w-0">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Organization</div>
                                <div className="mt-1 truncate text-[#ededed]" title={account.requested_organization}>{account.requested_organization}</div>
                              </div>
                              <div className="col-span-2 min-w-0">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Purpose</div>
                                <div className="mt-1 line-clamp-2 text-[#b5b5b5]" title={account.requested_purpose}>{account.requested_purpose}</div>
                              </div>
                            </div>
                            <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[#2e2e2e] pt-4">
                              <select value={selectedRole} onChange={event => setAccountRoleInputs(current => ({ ...current, [account.id]: event.target.value }))} className="h-[32px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444]">
                                <option value="developer">Developer</option>
                                <option value="api_owner">API Owner</option>
                                <option value="reviewer">Reviewer</option>
                                <option value="admin">Admin</option>
                              </select>
                              <select value={selectedMda} disabled={!needsMda} onChange={event => setAccountMdaInputs(current => ({ ...current, [account.id]: event.target.value }))} className="h-[32px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444] disabled:opacity-40">
                                {!needsMda && <option value="">Not applicable</option>}
                                {mdas.map(mda => <option key={mda.id} value={mda.id}>{mda.shortName}</option>)}
                              </select>
                              <button type="button" onClick={() => handleApproveAccount(account)} disabled={accountReviewing === account.id} className="inline-flex h-[32px] items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90 disabled:opacity-50">
                                <IconCircleCheck className="h-3.5 w-3.5" />
                                {primaryActionLabel}
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" disabled={accountReviewing === account.id} className="inline-flex h-[32px] items-center justify-center gap-1.5 rounded-md border border-[#2e2e2e] px-2.5 text-[12px] font-semibold text-[#ededed] transition-colors hover:bg-[#2e2e2e] disabled:opacity-50">
                                    <IconDotsVertical className="h-4 w-4" />
                                    More
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]">
                                  <DropdownMenuItem onClick={() => handleNeedsInfoAccount(account)} className="flex cursor-pointer items-center gap-2 text-[12px] focus:bg-[#2e2e2e] focus:text-white"><IconClock className="h-3.5 w-3.5" />Needs information</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRejectAccount(account)} className="flex cursor-pointer items-center gap-2 text-[12px] text-orange-300 focus:bg-orange-400/10 focus:text-orange-200"><IconX className="h-3.5 w-3.5" />Reject account</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSuspendAccount(account)} className="flex cursor-pointer items-center gap-2 text-[12px] text-red-300 focus:bg-red-400/10 focus:text-red-200"><IconBan className="h-3.5 w-3.5" />Suspend account</DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[#2e2e2e]" />
                                  <DropdownMenuItem onClick={() => handleDeleteAccount(account)} className="flex cursor-pointer items-center gap-2 text-[12px] text-red-300 focus:bg-red-400/10 focus:text-red-200"><IconTrash className="h-3.5 w-3.5" />Delete permanently</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <Table className="min-w-[1120px]">
                  <TableHeader>
                    <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">Applicant</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">Account Type</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">Status</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">Organization</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">Purpose</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">Role</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3">MDA</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-3 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccountRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                          No accounts match this filter.
                        </TableCell>
                      </TableRow>
                    ) : filteredAccountRequests.map(user => {
                      const selectedRole = accountRoleInputs[user.id] || user.role || user.requested_role || 'developer';
                      const needsMda = approvalRequiresMda(user.account_type, selectedRole);
                      const selectedMda = accountMdaInputs[user.id] || user.mda_id || user.requested_mda_id || (needsMda ? mdas[0]?.id : '') || '';
                      const primaryActionLabel =
                        accountReviewing === user.id ? 'Saving...' :
                        user.status === 'APPROVED' ? 'Update' :
                        user.status === 'SUSPENDED' || user.status === 'REJECTED' ? 'Restore' :
                        'Approve';

                      return (
                        <TableRow key={user.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                          <TableCell className="py-3.5 px-3">
                            <div className="font-semibold text-[13px] text-[#ededed]">{user.full_name}</div>
                            <div className="mt-0.5 text-[12px] text-[#8b8b8b]">{user.email}</div>
                          </TableCell>
                          <TableCell className="py-3.5 px-3 text-[13px] text-[#ededed]">
                            <div className="capitalize">{String(user.account_type || '').replace(/_/g, ' ')}</div>
                            <div className="mt-0.5 text-[11px] text-[#8b8b8b]">Requested {user.requested_role}</div>
                          </TableCell>
                          <TableCell className="py-3.5 px-3">
                            <AccountStatusBadge status={user.status} />
                            {user.account?.profile?.verification_status && (
                              <div className="mt-1 text-[11px] text-[#8b8b8b]">{String(user.account.profile.verification_status).replace(/_/g, ' ')}</div>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5 px-3 text-[13px] text-[#8b8b8b] max-w-[150px] truncate" title={user.requested_organization}>
                            {user.requested_organization}
                          </TableCell>
                          <TableCell className="py-3.5 px-3 text-[13px] text-[#8b8b8b] max-w-[180px] truncate" title={user.requested_purpose}>
                            {user.requested_purpose}
                          </TableCell>
                          <TableCell className="py-3.5 px-3">
                            <select
                              value={selectedRole}
                              onChange={event => setAccountRoleInputs(current => ({ ...current, [user.id]: event.target.value }))}
                              className="h-[30px] w-[102px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444]"
                            >
                              <option value="developer">Developer</option>
                              <option value="api_owner">API Owner</option>
                              <option value="reviewer">Reviewer</option>
                              <option value="admin">Admin</option>
                            </select>
                          </TableCell>
                          <TableCell className="py-3.5 px-3">
                            <select
                              value={selectedMda}
                              disabled={!needsMda}
                              onChange={event => setAccountMdaInputs(current => ({ ...current, [user.id]: event.target.value }))}
                              className="h-[30px] w-[96px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444] disabled:opacity-40"
                            >
                              {!needsMda && <option value="">Not applicable</option>}
                              {mdas.map(mda => (
                                <option key={mda.id} value={mda.id}>{mda.shortName}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleApproveAccount(user)}
                                disabled={accountReviewing === user.id}
                                className="inline-flex h-[28px] items-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90 disabled:opacity-50"
                              >
                                <IconCircleCheck className="h-3.5 w-3.5" />
                                {primaryActionLabel}
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Account actions"
                                    disabled={accountReviewing === user.id}
                                    className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-md border border-[#2e2e2e] text-[#8b8b8b] transition-colors hover:bg-[#2e2e2e] hover:text-white disabled:opacity-50"
                                  >
                                    <IconDotsVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]">
                                  <DropdownMenuItem onClick={() => handleNeedsInfoAccount(user)} className="flex cursor-pointer items-center gap-2 text-[12px] focus:bg-[#2e2e2e] focus:text-white">
                                    <IconClock className="h-3.5 w-3.5" />
                                    Needs information
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRejectAccount(user)} className="flex cursor-pointer items-center gap-2 text-[12px] text-orange-300 focus:bg-orange-400/10 focus:text-orange-200">
                                    <IconX className="h-3.5 w-3.5" />
                                    Reject account
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSuspendAccount(user)} className="flex cursor-pointer items-center gap-2 text-[12px] text-red-300 focus:bg-red-400/10 focus:text-red-200">
                                    <IconBan className="h-3.5 w-3.5" />
                                    Suspend account
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[#2e2e2e]" />
                                  <DropdownMenuItem onClick={() => handleDeleteAccount(user)} className="flex cursor-pointer items-center gap-2 text-[12px] text-red-300 focus:bg-red-400/10 focus:text-red-200">
                                    <IconTrash className="h-3.5 w-3.5" />
                                    Delete permanently
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: My Credentials */}
        {!dashboardLoading && !dashboardError && activeTab === 'credentials' && (
          <div className="flex h-full min-h-0 flex-col gap-6">
            <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414]">
                <h2 className="text-[15px] font-semibold text-white">Active Agency Sandbox Keys</h2>
                <p className="text-[12px] text-[#8b8b8b] mt-0.5">Use these keys inside headers (<code>X-GovHub-API-Key</code>) to query mock registries.</p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="h-9 w-[22%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Authorized API</TableHead>
                    <TableHead className="h-9 w-[18%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Purpose</TableHead>
                    <TableHead className="h-9 w-[16%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Status</TableHead>
                    <TableHead className="h-9 w-[34%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Sandbox Token</TableHead>
                    <TableHead className="h-9 w-[10%] px-4 text-right text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCredentialRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                        {dashboardSearch ? 'No approved API keys match this search.' : 'No approved API keys found for your agency. Go to the Catalog to submit a request.'}
                      </TableCell>
                    </TableRow>
                  ) : filteredCredentialRequests.map(req => (
                    <TableRow key={req.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                      <TableCell className="py-3.5 px-4 font-semibold text-[13.5px] text-white">{req.api_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] max-w-xs truncate">{req.purpose}</TableCell>
                      <TableCell className="py-3.5 px-4 text-[13px]">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono border border-[#3ecf8e]/20 text-[#3ecf8e] bg-[#3ecf8e]/5 uppercase">
                          ACTIVE
                        </span>
                        {req.api_key_expires_at && (
                          <div className="mt-1 text-[11px] text-[#8b8b8b]">
                            Expires in {formatRemainingDuration(req.api_key_expires_at)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 whitespace-normal px-4 py-3.5 font-mono text-[12.5px] text-[#3ecf8e]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="block min-w-0 max-w-full truncate leading-5" title={req.api_key_preview}>
                            {req.api_key_preview}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right">
                        <Link
                          to={`/api/${req.api_id}`}
                          className="inline-flex items-center gap-1 text-[12.5px] text-[#3ecf8e] hover:underline"
                        >
                          Try Sandbox <IconExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Audit Trails (Reviewer View) */}
        {!dashboardLoading && !dashboardError && activeTab === 'audit' && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Platform Governance Audit Log</h2>
                  <p className="text-[12px] text-[#8b8b8b] mt-0.5">Audits compliance actions and records API calls with strict cryptographic correlation IDs.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#8b8b8b] font-mono">Time Range:</span>
                  <select 
                    value={timeRange}
                    onChange={e => setTimeRange(e.target.value)}
                    className="h-[30px] px-2 border border-[#2e2e2e] bg-[#141414] text-white rounded text-[12px] focus:outline-none"
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#8b8b8b] font-mono">Filter Consumer:</span>
                  <select 
                    value={filterMda}
                    onChange={e => setFilterMda(e.target.value)}
                    className="h-[30px] px-2 border border-[#2e2e2e] bg-[#141414] text-white rounded text-[12px] focus:outline-none"
                  >
                    <option value="ALL">All MDAs</option>
                    {mdas.map(m => <option key={m.id} value={m.id}>{m.shortName}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Timestamp</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Event Type</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Consumer</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Registry Target</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Correlation ID</TableHead>
                    <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4 text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                        No compliance audit entries recorded.
                      </TableCell>
                    </TableRow>
                  ) : visibleLogs.map(log => {
                    const isDenied = log.event_type.includes('DENIED');
                    const isAllowed = log.event_type.includes('ALLOWED');
                    
                    return (
                      <TableRow 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className={`border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 cursor-pointer transition-all ${
                          selectedLog?.id === log.id ? 'bg-[#222]' : ''
                        }`}
                      >
                        <TableCell className="py-3 px-4 font-mono text-[12px] text-[#8b8b8b] text-left">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase font-semibold
                            ${isDenied ? 'text-red-400 border-red-400/20 bg-red-400/5' : 
                              isAllowed ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' : 
                              'text-blue-400 border-blue-400/20 bg-blue-400/5'}
                          `}>
                            {log.event_type}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left text-[13px] text-white font-medium">
                          {log.mda_name || <span className="text-[#555] font-mono">ANONYMOUS</span>}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left text-[13px] text-[#8b8b8b]">
                          {log.api_name || <span className="text-[#555] font-mono">SYSTEM</span>}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-left font-mono text-[11px] text-[#8b8b8b]">
                          {log.request_id}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5 font-mono text-[12.5px] text-[#3ecf8e] hover:underline">
                            Inspect
                            <IconExternalLink className="h-3.5 w-3.5" />
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Interoperability Matrix */}
        {!dashboardLoading && !dashboardError && activeTab === 'matrix' && (
          <div className="flex h-full min-h-0 flex-col gap-6 text-left">
            <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl p-6 shadow-lg">
              <h2 className="text-[15px] font-semibold text-white mb-2">Government Data Interoperability Channels</h2>
              <p className="text-[12px] text-[#8b8b8b] mb-6">
                Active matrix of approved MDA sharing links. Ensure that all exchanges are backed by statutory instruments.
              </p>
              
              <div className="min-h-0 flex-1 overflow-auto">
                <Table className="border border-[#2e2e2e] rounded-lg">
                  <TableHeader>
                    <TableRow className="border-b border-[#2e2e2e] bg-[#141414]">
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-white h-10 px-4">Consumer MDA</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">NIRA Identity</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">URA Tax Clearance</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">URSB Registry</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">MoWT Transport</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-10 px-4 text-center">MoICT Composite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mdas.map(consumer => {
                      const checkAccess = (apiId: string) => {
                        return matrix.some(m => m.consumer_mda_id === consumer.id && m.api_id === apiId);
                      };

                      return (
                        <TableRow key={consumer.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/20">
                          <TableCell className="py-3 px-4 font-semibold text-[13px] text-white">
                            {consumer.name} ({consumer.shortName})
                          </TableCell>
                          
                          {/* NIRA */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-nira-01') ? (
                              <IconCircleCheck className="m-auto h-5 w-5 text-[#3ecf8e]" stroke={1.8} />
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* URA */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-ura-01') ? (
                              <IconCircleCheck className="m-auto h-5 w-5 text-[#3ecf8e]" stroke={1.8} />
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* URSB */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-ursb-01') ? (
                              <IconCircleCheck className="m-auto h-5 w-5 text-[#3ecf8e]" stroke={1.8} />
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* MoWT */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-mowt-01') ? (
                              <IconCircleCheck className="m-auto h-5 w-5 text-[#3ecf8e]" stroke={1.8} />
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>

                          {/* MoICT */}
                          <TableCell className="py-3 px-4 text-center">
                            {checkAccess('api-moict-01') ? (
                              <IconCircleCheck className="m-auto h-5 w-5 text-[#3ecf8e]" stroke={1.8} />
                            ) : (
                              <span className="text-[#333] font-bold text-[12px]">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Usage Analytics */}
        {!dashboardLoading && !dashboardError && activeTab === 'analytics' && (
          <div className="flex h-full min-h-0 flex-col gap-6 text-left">
            <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-white">Usage Analytics</h2>
                <p className="mt-0.5 text-[13px] text-[#8b8b8b]">
                  Real sandbox traffic derived from audit logs and API key enforcement outcomes.
                </p>
              </div>
              <select
                value={timeRange}
                onChange={event => setTimeRange(event.target.value)}
                className="h-[34px] w-fit rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Sandbox Hits</span>
                  <div className="mt-1 text-[26px] font-bold text-white">{analyticsLogs.length}</div>
                  <div className="mt-1 text-[11px] text-[#8b8b8b]">{getTimeRangeLabel(timeRange)}</div>
                </div>
                <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Allowed Calls</span>
                  <div className="mt-1 text-[26px] font-bold text-[#3ecf8e]">{analyticsAllowed}</div>
                  <div className="mt-1 text-[11px] text-[#8b8b8b]">Authorized sandbox requests</div>
                </div>
                <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Denied Calls</span>
                  <div className="mt-1 text-[26px] font-bold text-red-300">{analyticsDenied}</div>
                  <div className="mt-1 text-[11px] text-[#8b8b8b]">{analyticsSuccessRate}% success rate</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Traffic Chart */}
                <div className="border border-[#2e2e2e] bg-[#1c1c1c] p-6 rounded-xl shadow-lg">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <h3 className="text-[14px] font-semibold text-white">Audited Sandbox Hits</h3>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">{getTimeRangeLabel(timeRange)}</span>
                  </div>
                  
                  <div className="h-64 flex items-end justify-between gap-2 overflow-x-auto border-b border-[#2e2e2e] pb-1.5 pt-6 font-mono text-[11px] text-[#8b8b8b]">
                    {analyticsTraffic.map(bucket => (
                      <div key={bucket.key} className="flex min-w-[28px] flex-1 flex-col items-center gap-2">
                        <span className="text-[10px] text-[#ededed]">{bucket.count}</span>
                        <div
                          className={`w-full min-w-[22px] rounded-t-sm border-t transition-all ${
                            bucket.count > 0
                              ? 'border-[#3ecf8e] bg-gradient-to-t from-[#3ecf8e]/20 to-[#3ecf8e]/80'
                              : 'border-[#2e2e2e] bg-[#141414]'
                          }`}
                          style={{ height: `${Math.max(6, (bucket.count / maxTrafficCount) * 92)}%` }}
                        />
                        <span className={bucket.label === 'Today' ? 'font-bold text-[#3ecf8e]' : ''}>{bucket.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Endpoint Distribution */}
                <div className="border border-[#2e2e2e] bg-[#1c1c1c] p-6 rounded-xl shadow-lg flex flex-col">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <h3 className="text-[14px] font-semibold text-white">Request Distribution by Registry</h3>
                    <span className="text-[11px] font-mono text-[#8b8b8b]">{analyticsDistribution.length} registries</span>
                  </div>
                  
                  <div className="flex flex-col gap-4 mt-2">
                    {analyticsDistribution.length === 0 ? (
                      <div className="flex min-h-[190px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                        No sandbox traffic has been audited for {getTimeRangeLabel(timeRange).toLowerCase()}.
                      </div>
                    ) : analyticsDistribution.map((row, index) => (
                      <div key={row.id}>
                        <div className="flex justify-between gap-4 text-[12px] mb-1 font-medium text-white">
                          <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
                          <span className="shrink-0 font-mono text-[#8b8b8b]">{row.count} / {row.percentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                          <div
                            className={`h-full rounded-full ${distributionColors[index % distributionColors.length]}`}
                            style={{ width: `${Math.max(2, row.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Panel for Audit Logs Drill-down */}
      {selectedLog && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#1c1c1c] border-l border-[#2e2e2e] shadow-2xl flex flex-col text-left">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e] bg-[#141414]">
            <div>
              <h3 className="text-[15px] font-semibold text-white">Inspect Correlation Link</h3>
              <p className="text-[12px] text-[#8b8b8b] mt-0.5">Correlation ID: <span className="font-mono text-white select-all">{selectedLog.request_id}</span></p>
            </div>
            <button 
              onClick={() => setSelectedLog(null)} 
              className="p-1 rounded hover:bg-[#2e2e2e] text-[#8b8b8b] hover:text-white transition-all"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5">
            {/* Event Header info */}
            <div className="p-3.5 bg-[#141414] border border-[#2e2e2e] rounded-lg">
              <span className="text-[10px] font-mono text-[#8b8b8b] uppercase tracking-wider block mb-1">Event Type</span>
              <span className={`text-[14px] font-mono font-bold uppercase ${
                selectedLog.event_type.includes('DENIED') ? 'text-red-400' : 'text-[#3ecf8e]'
              }`}>
                {selectedLog.event_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Timestamp</span>
                <span className="text-white font-medium">{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Caller Agency</span>
                <span className="text-white font-medium">{selectedLog.mda_name || 'Anonymous (No Auth Key)'}</span>
              </div>
              <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Target Registry</span>
                <span className="text-white font-medium">{selectedLog.api_name || 'System Access Layer'}</span>
              </div>
            </div>

            {/* JSON Metadata Payload */}
            <div className="flex-1 flex flex-col gap-2 mt-2">
              <span className="text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Captured Logs payload (metadata)</span>
              <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-[12.5px] border border-[#2e2e2e] overflow-auto flex-1 leading-relaxed text-[#3ecf8e]">
                <pre>{JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}
