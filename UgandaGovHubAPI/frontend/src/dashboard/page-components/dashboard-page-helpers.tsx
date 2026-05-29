import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api-base';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IconCalendarTime, IconChevronLeft, IconChevronRight, IconGridDots, IconList } from '@tabler/icons-react';
import {
  getAuditEventTone,
  getRequestStatusLabel,
  readDashboardViewModePreference,
  writeDashboardViewModePreference,
  type DashboardViewTab,
  type ViewMode,
} from '../view-helpers';

function dateToDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toDateTimeLocalValue(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return dateToDateTimeLocalValue(date);
}

export function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function formatRemainingDuration(value?: string | null) {
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

export type TrafficBucket = {
  key: string;
  label: string;
  count: number;
};

export type DistributionRow = {
  id: string;
  label: string;
  count: number;
  percentage: number;
};

export function parseAuditDate(value?: string) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = new Date(value.replace(' ', 'T'));
  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

export function getAnalyticsStart(range: string) {
  const hours = range === '24h' ? 24 : range === '30d' ? 24 * 30 : 24 * 7;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function approvalRequiresMda(accountType: string | null | undefined, role: string) {
  const normalizedAccountType = accountType === 'government' ? 'government_employee' : accountType;
  return role === 'admin' || role === 'api_owner' || normalizedAccountType === 'government_employee' || normalizedAccountType === 'mda_api_owner';
}

export function AccountStatusBadge({ status }: { status: string }) {
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

export function getTimeRangeLabel(range: string) {
  if (range === '24h') return 'Last 24 Hours';
  if (range === '30d') return 'Last 30 Days';
  return 'Last 7 Days';
}

export function getSandboxLogsInRange(logs: any[], range: string) {
  const start = getAnalyticsStart(range).getTime();
  return logs.filter(log => {
    if (!String(log.event_type || '').startsWith('SANDBOX_CALL')) return false;
    const createdAt = parseAuditDate(log.created_at);
    return createdAt ? createdAt.getTime() >= start : false;
  });
}

export function buildTrafficBuckets(logs: any[], range: string): TrafficBucket[] {
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

export function buildDistributionRows(logs: any[]): DistributionRow[] {
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

export function ExpiryDatePicker({
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

export async function fetchDashboardJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `${path} failed with ${response.status}`);
  }
  return body;
}

export function normalizeAccountCategory(value?: string | null) {
  if (value === 'government') return 'government_employee';
  return value || 'public_developer';
}

export function verificationStatusLabel(status?: string | null) {
  return String(status || 'draft_profile').replace(/_/g, ' ');
}

export function accountVerificationStatus(account: any) {
  return account.account?.profile?.verification_status || 'draft_profile';
}

export function canPromoteAccountToAdmin(account: any) {
  const category = normalizeAccountCategory(account.account?.profile?.account_category || account.account_type);
  return ['government_employee', 'mda_api_owner', 'admin'].includes(category);
}

export function canRunAccountApproval(account: any) {
  return accountVerificationStatus(account) === 'submitted_for_review';
}

export function resolveAccountApprovalDefaults(
  account: any,
  accountRoleInputs: Record<string, string>,
  accountMdaInputs: Record<string, string>,
  mdas: Array<{ id: string }>
) {
  const selectedRole = accountRoleInputs[account.id] || account.role || account.requested_role || 'developer';
  const needsMda = approvalRequiresMda(account.account_type, selectedRole);
  const selectedMda = accountMdaInputs[account.id]
    || account.mda_id
    || account.requested_mda_id
    || (needsMda ? mdas[0]?.id : '')
    || '';

  return { selectedRole, needsMda, selectedMda };
}

export function notificationRoleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: 'Admin',
    api_owner: 'API Owner',
    developer: 'Developer',
    reviewer: 'Compliance Reviewer',
  };
  return labels[role] || role;
}

export function accountActionLabel(account: any, busy: boolean) {
  if (busy) return 'Approve';
  const verificationStatus = accountVerificationStatus(account);
  if (verificationStatus === 'draft_profile') return 'Waiting on user';
  if (verificationStatus === 'needs_more_information') return 'Needs info';
  if (verificationStatus === 'verified' && account.status === 'APPROVED') return 'Verified';
  if (account.status === 'SUSPENDED' || account.status === 'REJECTED') return 'Closed';
  return 'Approve';
}

export function ViewModeToggle({
  value,
  onChange,
  gridLabel,
  listLabel,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  gridLabel: string;
  listLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-1">
      <button
        type="button"
        aria-label={gridLabel}
        onClick={() => onChange('grid')}
        className={`rounded-[6px] p-1.5 transition-all ${value === 'grid' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
      >
        <IconGridDots className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={listLabel}
        onClick={() => onChange('list')}
        className={`rounded-[6px] p-1.5 transition-all ${value === 'list' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
      >
        <IconList className="h-4 w-4" />
      </button>
    </div>
  );
}

function getDashboardViewModeStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readInitialDashboardViewMode(tab: DashboardViewTab) {
  const storage = getDashboardViewModeStorage();
  return storage ? readDashboardViewModePreference(storage, tab) : 'list';
}

export function useDashboardViewModePreference(tab: DashboardViewTab) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readInitialDashboardViewMode(tab));

  const setPreferredViewMode = useCallback((nextViewMode: ViewMode) => {
    setViewMode(nextViewMode);

    const storage = getDashboardViewModeStorage();
    if (storage) {
      writeDashboardViewModePreference(storage, tab, nextViewMode);
    }
  }, [tab]);

  return [viewMode, setPreferredViewMode] as const;
}

export function AccessRequestStatusBadge({ request }: { request: any }) {
  const isActiveKey = request.status === 'APPROVED' && (request.api_key_status || 'ACTIVE') === 'ACTIVE';
  const className = isActiveKey
    ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5'
    : request.status === 'APPROVED'
      ? 'text-red-300 border-red-400/20 bg-red-400/5'
      : 'text-orange-400 border-orange-400/20 bg-orange-400/5';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase ${className}`}>
      {getRequestStatusLabel(request)}
    </span>
  );
}

export function AuditEventBadge({ eventType }: { eventType: string }) {
  const eventTone = getAuditEventTone(eventType);
  const className = eventTone === 'denied'
    ? 'border-red-400/20 bg-red-400/5 text-red-400'
    : eventTone === 'allowed'
      ? 'border-[#3ecf8e]/20 bg-[#3ecf8e]/5 text-[#3ecf8e]'
      : 'border-blue-400/20 bg-blue-400/5 text-blue-400';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${className}`}>
      {eventType}
    </span>
  );
}
