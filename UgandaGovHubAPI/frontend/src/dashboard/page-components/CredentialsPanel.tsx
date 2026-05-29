import { Link } from 'react-router-dom';
import { IconExternalLink } from '@tabler/icons-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AccessRequestStatusBadge, ViewModeToggle, formatRemainingDuration } from './dashboard-page-helpers';
import { getRequestStatusLabel, hasActiveApprovedApiKey } from '../view-helpers';

export function CredentialsPanel({
  filteredCredentialRequests,
  credentialViewMode,
  setCredentialViewMode,
  dashboardSearch,
}: any) {
  return (
              <div className="flex h-full min-h-0 flex-col gap-6">
                  <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
                    <div className="flex flex-col gap-3 border-b border-[#2e2e2e] bg-[#141414] p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">My API Access Requests</h2>
                      <p className="text-[12px] text-[#8b8b8b] mt-0.5">Track requested APIs, approval status, and active sandbox keys when access is granted.</p>
                    </div>
                    <ViewModeToggle
                      value={credentialViewMode}
                      onChange={setCredentialViewMode}
                      gridLabel="Show credentials grid view"
                      listLabel="Show credentials list view"
                    />
                  </div>
                  {credentialViewMode === 'list' ? (
                  <div className="min-h-0 flex-1 overflow-auto">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="border-b border-[#2e2e2e] hover:bg-transparent bg-[#141414]">
                        <TableHead className="h-9 w-[22%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Requested API</TableHead>
                        <TableHead className="h-9 w-[22%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Purpose</TableHead>
                        <TableHead className="h-9 w-[16%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Status</TableHead>
                        <TableHead className="h-9 w-[30%] px-4 text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Fields & Token</TableHead>
                        <TableHead className="h-9 w-[10%] px-4 text-right text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCredentialRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-28 text-center text-[#8b8b8b] text-[13px]">
                            {dashboardSearch ? 'No API access requests match this search.' : 'No API access requests found for your agency. Go to the Catalog to submit a request.'}
                          </TableCell>
                        </TableRow>
                      ) : filteredCredentialRequests.map((req: any) => {
                        const hasActiveKey = hasActiveApprovedApiKey(req);

                        return (
                          <TableRow key={req.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                            <TableCell className="py-3.5 px-4 font-semibold text-[13.5px] text-white">{req.api_name}</TableCell>
                            <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] max-w-xs truncate">{req.purpose}</TableCell>
                            <TableCell className="py-3.5 px-4 text-[13px]">
                              <AccessRequestStatusBadge request={req} />
                              {req.status === 'PENDING' && (
                                <div className="mt-1 text-[11px] text-[#8b8b8b]">Awaiting approval</div>
                              )}
                              {hasActiveKey && req.api_key_expires_at && (
                                <div className="mt-1 text-[11px] text-[#8b8b8b]">
                                  Expires in {formatRemainingDuration(req.api_key_expires_at)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-0 whitespace-normal px-4 py-3.5 text-[12.5px]">
                              <div className="font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
                              <div className="mt-0.5 truncate text-[#8b8b8b]" title={req.requested_fields}>{req.requested_fields || 'All requested fields'}</div>
                              <div className={`mt-1 truncate font-mono ${hasActiveKey ? 'text-[#3ecf8e]' : 'text-[#666]'}`} title={req.api_key_preview || undefined}>
                                {hasActiveKey ? req.api_key_preview : 'No sandbox key yet'}
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-right">
                              {hasActiveKey ? (
                                <Link
                                  to={`/api/${req.api_id}`}
                                  className="inline-flex items-center gap-1 text-[12.5px] text-[#3ecf8e] hover:underline"
                                >
                                  Try Sandbox <IconExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              ) : (
                                <Link
                                  to={`/api/${req.api_id}`}
                                  className="inline-flex items-center gap-1 text-[12.5px] text-[#8b8b8b] hover:text-white hover:underline"
                                >
                                  View API <IconExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      {filteredCredentialRequests.length === 0 ? (
                        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                          {dashboardSearch ? 'No API access requests match this search.' : 'No API access requests found for your agency. Go to the Catalog to submit a request.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {filteredCredentialRequests.map((req: any) => {
                            const hasActiveKey = hasActiveApprovedApiKey(req);

                            return (
                              <div key={req.id} className="rounded-lg border border-[#2e2e2e] bg-[#181818] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[13.5px] font-semibold text-white" title={req.api_name}>{req.api_name}</div>
                                    <div className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-[#8b8b8b]" title={req.purpose}>{req.purpose || 'No purpose recorded'}</div>
                                  </div>
                                  <AccessRequestStatusBadge request={req} />
                                </div>
                                <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                                  <div>
                                    <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Volume Tier</div>
                                    <div className="mt-1 font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
                                  </div>
                                  <div>
                                    <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Status</div>
                                    <div className="mt-1 text-[#ededed]">
                                      {req.status === 'PENDING'
                                        ? 'Awaiting approval'
                                        : hasActiveKey && req.api_key_expires_at
                                          ? `Expires in ${formatRemainingDuration(req.api_key_expires_at)}`
                                          : getRequestStatusLabel(req)}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
                                  <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Fields & Token</div>
                                  <div className="mt-1 truncate text-[12px] text-[#b5b5b5]" title={req.requested_fields}>{req.requested_fields || 'All requested fields'}</div>
                                  <div className={`mt-2 truncate font-mono text-[12.5px] ${hasActiveKey ? 'text-[#3ecf8e]' : 'text-[#666]'}`} title={req.api_key_preview || undefined}>
                                    {hasActiveKey ? req.api_key_preview : 'No sandbox key yet'}
                                  </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                  {hasActiveKey ? (
                                    <Link
                                      to={`/api/${req.api_id}`}
                                      className="inline-flex items-center gap-1 text-[12.5px] text-[#3ecf8e] hover:underline"
                                    >
                                      Try Sandbox <IconExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                  ) : (
                                    <Link
                                      to={`/api/${req.api_id}`}
                                      className="inline-flex items-center gap-1 text-[12.5px] text-[#8b8b8b] hover:text-white hover:underline"
                                    >
                                      View API <IconExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                  )}
                                </div>
                              </div>
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
