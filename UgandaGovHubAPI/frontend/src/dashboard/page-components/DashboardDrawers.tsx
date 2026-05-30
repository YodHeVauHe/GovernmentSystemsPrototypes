import { IconX } from '@tabler/icons-react';
import { AccessRequestStatusBadge } from './dashboard-page-helpers';
import { formatAuditLogDetails } from '../view-helpers';

export function DashboardDrawers({ selectedAccessRequest, setSelectedAccessRequest, selectedLog, setSelectedLog }: any) {
  return (
    <>
            {/* Slide-over Detail Panel for Access Approval Requests */}
            {selectedAccessRequest && (
              <div
                role="region"
                aria-label="Access request details"
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#2e2e2e] bg-[#1c1c1c] text-left shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[#2e2e2e] bg-[#141414] px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-white" title={selectedAccessRequest.api_name}>
                      Access Request Details
                    </h3>
                    <p className="mt-0.5 text-[12px] text-[#8b8b8b]">
                      Request ID: <span className="font-mono text-white select-all">{selectedAccessRequest.id}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close access request details"
                    onClick={() => setSelectedAccessRequest(null)}
                    className="rounded p-1 text-[#8b8b8b] transition-all hover:bg-[#2e2e2e] hover:text-white"
                  >
                    <IconX className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[#8b8b8b]">Requested API</span>
                        <div className="text-[15px] font-semibold text-white">{selectedAccessRequest.api_name}</div>
                      </div>
                      <AccessRequestStatusBadge request={selectedAccessRequest} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Consumer MDA</span>
                      <span className="font-medium text-white">{selectedAccessRequest.mda_name || 'Unknown consumer'}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Volume Tier</span>
                      <span className="font-medium text-white">{selectedAccessRequest.volume_tier || 'Low'}</span>
                    </div>
                    <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Lawful Basis</span>
                      <span className="font-medium text-white">{selectedAccessRequest.legal_basis || 'Not Provided'}</span>
                    </div>
                    <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Purpose</span>
                      <p className="mt-1 leading-5 text-white">{selectedAccessRequest.purpose || 'No purpose provided.'}</p>
                    </div>
                    <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Requested Fields</span>
                      <p className="mt-1 leading-5 text-white">{selectedAccessRequest.requested_fields || 'All'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5 text-[12px]">
                    <div className="grid gap-3">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">API ID</span>
                        <span className="font-mono text-[#ededed]">{selectedAccessRequest.api_id || 'Unavailable'}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Consumer MDA ID</span>
                        <span className="font-mono text-[#ededed]">{selectedAccessRequest.consumer_mda_id || 'Unavailable'}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Sandbox Key</span>
                        <span className="font-mono text-[#3ecf8e]">{selectedAccessRequest.api_key_preview || 'Not generated'}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Key Expiry</span>
                        <span className="font-mono text-[#ededed]">
                          {selectedAccessRequest.api_key_expires_at
                            ? new Date(selectedAccessRequest.api_key_expires_at).toLocaleString()
                            : 'No expiry set'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                      <pre>{formatAuditLogDetails(selectedLog.details)}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

    </>
  );
}
