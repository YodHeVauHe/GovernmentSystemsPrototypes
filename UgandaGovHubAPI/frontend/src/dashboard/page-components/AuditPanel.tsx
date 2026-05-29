import { IconExternalLink } from '@tabler/icons-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AuditEventBadge, ViewModeToggle } from './dashboard-page-helpers';

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
}: any) {
  return (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">
                        {role === 'developer' ? 'My API Call Logs' : 'Platform Governance Audit Log'}
                      </h2>
                      <p className="text-[12px] text-[#8b8b8b] mt-0.5">
                        {role === 'developer'
                          ? 'Shows sandbox calls made with your approved API keys, including allowed and denied outcomes.'
                          : 'Audits compliance actions and records API calls with strict cryptographic correlation IDs.'}
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
                                {role === 'developer' ? 'No API call logs recorded for your approved keys yet.' : 'No compliance audit entries recorded.'}
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
                                <AuditEventBadge eventType={log.event_type} />
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
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      {visibleLogs.length === 0 ? (
                        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                          {role === 'developer' ? 'No API call logs recorded for your approved keys yet.' : 'No compliance audit entries recorded.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {visibleLogs.map((log: any) => (
                            <button
                              key={log.id}
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className={`rounded-lg border p-4 text-left transition-colors hover:bg-[#202020] ${
                                selectedLog?.id === log.id ? 'border-[#3ecf8e]/40 bg-[#202020]' : 'border-[#2e2e2e] bg-[#181818]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <AuditEventBadge eventType={log.event_type} />
                                <span className="font-mono text-[11px] text-[#8b8b8b]">{new Date(log.created_at).toLocaleTimeString()}</span>
                              </div>
                              <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                                <div>
                                  <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Consumer</div>
                                  <div className="mt-1 font-medium text-white">{log.mda_name || 'ANONYMOUS'}</div>
                                </div>
                                <div>
                                  <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Registry Target</div>
                                  <div className="mt-1 text-[#ededed]">{log.api_name || 'SYSTEM'}</div>
                                </div>
                              </div>
                              <div className="mt-4 rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
                                <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Correlation ID</div>
                                <div className="mt-1 truncate font-mono text-[12px] text-[#ededed]" title={log.request_id || log.correlation_id}>
                                  {log.request_id || log.correlation_id || 'Unavailable'}
                                </div>
                              </div>
                              <div className="mt-4 inline-flex items-center gap-1.5 font-mono text-[12.5px] text-[#3ecf8e]">
                                Inspect
                                <IconExternalLink className="h-3.5 w-3.5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
  );
}
