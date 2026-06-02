import { IconBan, IconDotsVertical, IconTrash } from '@tabler/icons-react';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AccessRequestStatusBadge, ExpiryDatePicker, ViewModeToggle, toDateTimeLocalValue } from './dashboard-page-helpers';

export function AccessApprovalsPanel({
  visibleRequests,
  approvalViewMode,
  setApprovalViewMode,
  setSelectedAccessRequest,
  keyExpiryInputs,
  setKeyExpiryInputs,
  approving,
  handleUpdateExpiry,
  openKeyActionConfirmation,
}: any) {
    const renderAccessRequestDetailsButton = (req: any) => (
      <button
        type="button"
        aria-label={`Open details for ${req.api_name || 'access request'}`}
        onClick={() => setSelectedAccessRequest(req)}
        className="inline-flex h-[28px] items-center justify-center rounded-md border border-[#2e2e2e] px-2.5 text-[12px] font-medium text-[#3ecf8e] transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10"
      >
        Open details
      </button>
    );
    const renderAccessRequestActions = (req: any, variant: 'table' | 'card' = 'table') => {
      const wrapperClass = variant === 'card'
        ? 'flex flex-wrap items-center justify-between gap-2'
        : 'flex flex-col items-end gap-2';
      const keyPreviewClass = variant === 'card'
        ? 'min-w-0 flex-1 truncate font-mono text-[12px] text-[#8b8b8b]'
        : 'min-w-0 truncate';
      const keyActionsClass = variant === 'card'
        ? 'flex items-center gap-1.5'
        : 'flex w-[204px] items-center justify-start gap-1.5';

      if (req.status === 'PENDING') {
        return (
          <div className={wrapperClass}>
            {variant === 'card' && (
              <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#ededed]" title={req.id}>
                Request ID: {req.id}
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedAccessRequest(req)}
              disabled={approving === req.id}
              className="inline-flex h-[28px] items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-semibold text-black transition-all hover:bg-[#3ecf8e]/95 disabled:opacity-50"
            >
              {approving === req.id && <Spinner className="size-3.5 text-black" />}
              Review request
            </button>
          </div>
        );
      }

      return (
        <div className={wrapperClass}>
          <div className={variant === 'card' ? 'min-w-0 flex-1' : 'flex w-[204px] items-center justify-between gap-1.5 font-mono text-[12px] text-[#8b8b8b]'}>
            <span className={keyPreviewClass}>
              {req.api_key_preview || 'Key deleted'}
            </span>
          </div>
          {req.api_key_preview && (
            <div className={keyActionsClass}>
              <ExpiryDatePicker
                value={keyExpiryInputs[req.id] ?? toDateTimeLocalValue(req.api_key_expires_at)}
                onChange={value => setKeyExpiryInputs((current: Record<string, string>) => ({ ...current, [req.id]: value }))}
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
                    onClick={() => openKeyActionConfirmation('revoke', req)}
                    className="flex cursor-pointer items-center gap-2 text-[12px] text-orange-300 focus:bg-orange-400/10 focus:text-orange-200"
                  >
                    <IconBan className="h-3.5 w-3.5" />
                    Revoke key
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openKeyActionConfirmation('delete', req)}
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
      );
    };

  return (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">Active Access Requests</h2>
                      <p className="text-[12px] text-[#8b8b8b] mt-0.5">Evaluate legal mandate alignment and manage cryptographically bound sandbox API keys.</p>
                    </div>
                    <ViewModeToggle
                      value={approvalViewMode}
                      onChange={setApprovalViewMode}
                      gridLabel="Show access approvals grid view"
                      listLabel="Show access approvals list view"
                    />
                  </div>
                  {approvalViewMode === 'list' ? (
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
                          ) : visibleRequests.map((req: any) => (
                            <TableRow key={req.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                              <TableCell className="py-3.5 px-4 font-semibold text-[13px] text-orange-400">{req.mda_name}</TableCell>
                              <TableCell className="py-3.5 px-4 text-[13px] text-white font-medium">{req.api_name}</TableCell>
                              <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] italic">"{req.legal_basis || 'Not Provided'}"</TableCell>
                              <TableCell className="py-3.5 px-4 text-[13px] text-[#8b8b8b] max-w-[180px] truncate" title={req.purpose}>{req.purpose}</TableCell>
                              <TableCell className="py-3.5 px-4 text-[12px] text-[#8b8b8b]">
                                <div className="font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
                                <div className="truncate max-w-[150px] mt-0.5">{req.requested_fields || 'All'}</div>
                              </TableCell>
                              <TableCell className="py-3.5 px-4 text-[13px]">
                                <AccessRequestStatusBadge request={req} />
                              </TableCell>
                              <TableCell className="py-3.5 px-4 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  {renderAccessRequestDetailsButton(req)}
                                  {renderAccessRequestActions(req)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      {visibleRequests.length === 0 ? (
                        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                          No access requests found matching your agency permissions.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {visibleRequests.map((req: any) => (
                            <div key={req.id} className="flex min-h-[300px] flex-col rounded-lg border border-[#2e2e2e] bg-[#181818] p-4 text-left">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[12px] font-semibold uppercase tracking-wide text-orange-400">{req.mda_name}</div>
                                  <h3 className="mt-1 truncate text-[15px] font-semibold text-white" title={req.api_name}>{req.api_name}</h3>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <AccessRequestStatusBadge request={req} />
                                  {renderAccessRequestDetailsButton(req)}
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                                <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
                                  <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Lawful Basis</div>
                                  <div className="mt-1 text-[#ededed]">"{req.legal_basis || 'Not Provided'}"</div>
                                </div>
                                <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
                                  <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Fields & Tier</div>
                                  <div className="mt-1 font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
                                  <div className="mt-0.5 line-clamp-1 text-[#8b8b8b]" title={req.requested_fields}>{req.requested_fields || 'All'}</div>
                                </div>
                              </div>
                              <div className="mt-4 rounded-md border border-[#2e2e2e] bg-[#141414] p-3 text-[12px]">
                                <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Purpose</div>
                                <p className="mt-1 line-clamp-2 leading-5 text-[#ededed]" title={req.purpose}>{req.purpose}</p>
                              </div>
                              <div className="mt-auto border-t border-[#2e2e2e] pt-4">
                                {renderAccessRequestActions(req, 'card')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
  );
}
