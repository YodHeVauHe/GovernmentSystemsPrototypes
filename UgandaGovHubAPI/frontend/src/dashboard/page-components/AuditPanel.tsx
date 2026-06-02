import { IconExternalLink } from '@tabler/icons-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AuditEventBadge, ViewModeToggle } from './dashboard-page-helpers';
import { getAuditLogEndpoint, getAuditLogResponseStatus, getAuditLogResponseStatusLabel } from '../view-helpers';

function parseAuditDetails(details: unknown) {
  if (!details) return {};
  if (typeof details === 'object') return details as Record<string, any>;
  if (typeof details !== 'string') return {};
  try {
    const parsed = JSON.parse(details);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, any> : {};
  } catch {
    return {};
  }
}

function getGovernanceCategory(eventType: string) {
  if (eventType.startsWith('LOGIN') || eventType.startsWith('LOGOUT') || eventType.startsWith('MFA')) return 'Authentication';
  if (eventType.startsWith('ACCOUNT')) return 'Account Lifecycle';
  if (eventType.startsWith('ACCESS')) return 'Access Governance';
  if (eventType.startsWith('API_KEY')) return 'API Key Lifecycle';
  if (eventType.startsWith('API_VERSION') || eventType.startsWith('API_')) return 'Catalog Management';
  if (eventType.includes('SECURITY') || eventType.includes('DENIED') || eventType.includes('BLOCKED')) return 'Security';
  return 'Platform Event';
}

function getGovernanceOutcome(eventType: string) {
  if (eventType.includes('FAILED') || eventType.includes('REJECTED') || eventType.includes('DENIED') || eventType.includes('BLOCKED')) return 'Blocked / Failed';
  if (eventType.includes('APPROVED') || eventType.includes('SUCCEEDED') || eventType.includes('ENABLED')) return 'Completed';
  if (eventType.includes('SUBMITTED') || eventType.includes('STARTED')) return 'Submitted';
  if (eventType.includes('SUSPENDED') || eventType.includes('DISABLED') || eventType.includes('DELETED') || eventType.includes('REVOKED')) return 'Changed';
  return 'Recorded';
}

const governanceCategoryStyles: Record<string, { dot: string; badge: string }> = {
  Authentication: {
    dot: 'bg-[#38bdf8]',
    badge: 'border-[#38bdf8]/35 bg-[#38bdf8]/10 text-[#7dd3fc]',
  },
  'Account Lifecycle': {
    dot: 'bg-[#a78bfa]',
    badge: 'border-[#a78bfa]/35 bg-[#a78bfa]/10 text-[#c4b5fd]',
  },
  'Access Governance': {
    dot: 'bg-[#3ecf8e]',
    badge: 'border-[#3ecf8e]/35 bg-[#3ecf8e]/10 text-[#6ee7b7]',
  },
  'API Key Lifecycle': {
    dot: 'bg-[#f59e0b]',
    badge: 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fbbf24]',
  },
  'Catalog Management': {
    dot: 'bg-[#60a5fa]',
    badge: 'border-[#60a5fa]/35 bg-[#60a5fa]/10 text-[#93c5fd]',
  },
  Security: {
    dot: 'bg-[#fb7185]',
    badge: 'border-[#fb7185]/40 bg-[#fb7185]/10 text-[#fda4af]',
  },
  'Platform Event': {
    dot: 'bg-[#a3a3a3]',
    badge: 'border-[#a3a3a3]/30 bg-[#a3a3a3]/10 text-[#d4d4d4]',
  },
};

function getGovernanceCategoryStyle(eventType: string) {
  return governanceCategoryStyles[getGovernanceCategory(eventType)] ?? governanceCategoryStyles['Platform Event'];
}

function GovernanceCategoryBadge({ eventType }: { eventType: string }) {
  const category = getGovernanceCategory(eventType);
  const style = getGovernanceCategoryStyle(eventType);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${style.badge}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} />
      {category}
    </span>
  );
}

function getGovernanceActor(log: any) {
  const details = parseAuditDetails(log.details);
  return details.actor_user_id || details.actor_role || details.target_email || details.target_user_id || log.mda_name || 'SYSTEM';
}

function getGovernanceTarget(log: any) {
  const details = parseAuditDetails(log.details);
  return log.api_name || details.api_name || details.target_email || details.requested_organization || log.mda_name || 'Platform';
}

function getGovernanceEventId(log: any) {
  return log.request_id || log.correlation_id || log.id;
}

export function AuditPanel({
  role,
  timeRange,
  setTimeRange,
  filterMda,
  setFilterMda,
  mdas,
  auditViewMode,
  setAuditViewMode,
  visibleLogs,
  selectedLog,
  setSelectedLog,
  logScope = 'governance',
}: any) {
  const isApiCallPanel = logScope === 'api-calls' || role === 'developer';
  const isDeveloperApiCallPanel = role === 'developer';
  const panelTitle = isDeveloperApiCallPanel
    ? 'My API Call Logs'
    : isApiCallPanel
      ? 'API Usage Logs'
      : 'Governance Audit Trails';
  const panelDescription = isDeveloperApiCallPanel
    ? 'Shows sandbox calls made with your approved API keys, including allowed and denied outcomes.'
    : isApiCallPanel
      ? 'Shows sandbox API calls across approved consumers for administrator oversight.'
      : 'Tracks platform-wide governance, security, account, access, catalog, and API key lifecycle events.';
  const emptyMessage = isDeveloperApiCallPanel
    ? 'No API call logs recorded for your approved keys yet.'
    : isApiCallPanel
      ? 'No API usage logs recorded yet.'
    : 'No compliance audit entries recorded.';

  return (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">
                        {panelTitle}
                      </h2>
                      <p className="text-[12px] text-[#8b8b8b] mt-0.5">
                        {panelDescription}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
                      {role !== 'developer' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-[#8b8b8b] font-mono">Filter Consumer:</span>
                          <select
                            value={filterMda}
                            onChange={e => setFilterMda(e.target.value)}
                            className="h-[30px] px-2 border border-[#2e2e2e] bg-[#141414] text-white rounded text-[12px] focus:outline-none"
                          >
                            <option value="ALL">All MDAs</option>
                            {mdas.map((m: any) => <option key={m.id} value={m.id}>{m.shortName}</option>)}
                          </select>
                        </div>
                      )}
                      <ViewModeToggle
                        value={auditViewMode}
                        onChange={setAuditViewMode}
                        gridLabel="Show audit trails grid view"
                        listLabel="Show audit trails list view"
                      />
                    </div>
                  </div>

                  {auditViewMode === 'list' ? (
                    <div className="min-h-0 flex-1 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">Timestamp</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">{isApiCallPanel ? 'Event Type' : 'Category'}</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">{isApiCallPanel ? 'Consumer' : 'Actor / Subject'}</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">{isApiCallPanel ? 'Registry Target' : 'Platform Target'}</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">{isApiCallPanel ? 'Endpoint' : 'Event Type'}</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">{isApiCallPanel ? 'Response' : 'Outcome'}</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4">{isApiCallPanel ? 'Correlation ID' : 'Event ID'}</TableHead>
                            <TableHead className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] h-9 px-4 text-right">{isApiCallPanel ? 'Details' : 'Review'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleLogs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                                {emptyMessage}
                              </TableCell>
                            </TableRow>
                          ) : visibleLogs.map((log: any) => (
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
                                {isApiCallPanel ? <AuditEventBadge eventType={log.event_type} /> : <GovernanceCategoryBadge eventType={log.event_type} />}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-left text-[13px] text-white font-medium">
                                {isApiCallPanel
                                  ? log.mda_name || <span className="text-[#555] font-mono">ANONYMOUS</span>
                                  : getGovernanceActor(log)}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-left text-[13px] text-[#8b8b8b]">
                                {isApiCallPanel
                                  ? log.api_name || <span className="text-[#555] font-mono">SYSTEM</span>
                                  : getGovernanceTarget(log)}
                              </TableCell>
                              <TableCell className="max-w-[260px] py-3 px-4 text-left font-mono text-[11px] text-[#ededed]">
                                <span className="block truncate" title={isApiCallPanel ? getAuditLogEndpoint(log) || undefined : log.event_type}>
                                  {isApiCallPanel ? getAuditLogEndpoint(log) || <span className="text-[#555]">Unavailable</span> : log.event_type}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 px-4 text-left font-mono text-[11px]">
                                {isApiCallPanel ? getAuditLogResponseStatus(log) !== null ? (
                                  <span className={getAuditLogResponseStatus(log)! < 400 ? 'text-[#3ecf8e]' : 'text-red-400'}>
                                    {getAuditLogResponseStatusLabel(log)}
                                  </span>
                                ) : (
                                  <span className="text-[#555]">Unavailable</span>
                                ) : (
                                  <span className="text-[#8b8b8b]">{getGovernanceOutcome(log.event_type)}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-left font-mono text-[11px] text-[#8b8b8b]">
                                {isApiCallPanel ? log.request_id : getGovernanceEventId(log)}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-right">
                                <span className="inline-flex items-center justify-end gap-1.5 font-mono text-[12.5px] text-[#3ecf8e] hover:underline">
                                  {isApiCallPanel ? 'Inspect' : 'Review'}
                                  <IconExternalLink className="h-3.5 w-3.5" />
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      {visibleLogs.length === 0 ? (
                        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                          {emptyMessage}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {visibleLogs.map((log: any) => {
                            const categoryStyle = isApiCallPanel ? null : getGovernanceCategoryStyle(log.event_type);

                            return (
                            <button
                              key={log.id}
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className={`relative overflow-hidden rounded-lg border p-3 text-left transition-colors hover:bg-[#202020] ${
                                selectedLog?.id === log.id ? 'border-[#3ecf8e]/40 bg-[#202020]' : 'border-[#2e2e2e] bg-[#181818]'
                              }`}
                            >
                              {categoryStyle && <span className={`absolute inset-y-0 left-0 w-1 ${categoryStyle.dot}`} />}
                              <div className="flex items-start justify-between gap-3">
                                {isApiCallPanel ? <AuditEventBadge eventType={log.event_type} /> : <GovernanceCategoryBadge eventType={log.event_type} />}
                                <span className="font-mono text-[11px] text-[#8b8b8b]">{new Date(log.created_at).toLocaleTimeString()}</span>
                              </div>
                              <div className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
                                <div>
                                  <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">{isApiCallPanel ? 'Consumer' : 'Actor / Subject'}</div>
                                  <div className="mt-0.5 font-medium text-white">{isApiCallPanel ? log.mda_name || 'ANONYMOUS' : getGovernanceActor(log)}</div>
                                </div>
                                <div>
                                  <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">{isApiCallPanel ? 'Registry Target' : 'Platform Target'}</div>
                                  <div className="mt-0.5 text-[#ededed]">{isApiCallPanel ? log.api_name || 'SYSTEM' : getGovernanceTarget(log)}</div>
                                </div>
                              </div>
                              {isApiCallPanel ? (
                                <>
                                  <div className="mt-3 rounded-md border border-[#2e2e2e] bg-[#141414] p-2.5">
                                    <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Endpoint</div>
                                    <div className="mt-0.5 truncate font-mono text-[12px] text-[#ededed]" title={getAuditLogEndpoint(log) || undefined}>
                                      {getAuditLogEndpoint(log) || 'Unavailable'}
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                                    <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-2.5">
                                      <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Response Code</div>
                                      <div className={`mt-0.5 font-mono text-[12px] ${getAuditLogResponseStatus(log) !== null && getAuditLogResponseStatus(log)! < 400 ? 'text-[#3ecf8e]' : 'text-red-400'}`}>
                                        {getAuditLogResponseStatusLabel(log) || 'Unavailable'}
                                      </div>
                                    </div>
                                    <div className="min-w-0 rounded-md border border-[#2e2e2e] bg-[#141414] p-2.5">
                                      <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Correlation ID</div>
                                      <div className="mt-0.5 truncate font-mono text-[12px] text-[#ededed]" title={log.request_id || log.correlation_id}>
                                        {log.request_id || log.correlation_id || 'Unavailable'}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                                    <div className="min-w-0 rounded-md border border-[#2e2e2e] bg-[#141414] p-2.5">
                                      <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Event Type</div>
                                      <div className="mt-0.5 truncate font-mono text-[12px] text-[#ededed]" title={log.event_type}>
                                        {log.event_type}
                                      </div>
                                    </div>
                                    <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-2.5">
                                      <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Outcome</div>
                                      <div className="mt-0.5 font-mono text-[12px] text-[#8b8b8b]">
                                        {getGovernanceOutcome(log.event_type)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 min-w-0 rounded-md border border-[#2e2e2e] bg-[#141414] p-2.5">
                                    <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Event ID</div>
                                    <div className="mt-0.5 truncate font-mono text-[12px] text-[#ededed]" title={getGovernanceEventId(log)}>
                                      {getGovernanceEventId(log)}
                                    </div>
                                  </div>
                                </>
                              )}
                              <div className="mt-3 flex justify-end">
                                <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-[#3ecf8e]">
                                {isApiCallPanel ? 'Inspect' : 'Review'}
                                <IconExternalLink className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
  );
}
