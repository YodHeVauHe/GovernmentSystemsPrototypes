import { IconBan, IconCircleCheck, IconClock, IconDotsVertical, IconGridDots, IconList, IconTrash, IconX } from '@tabler/icons-react';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AccountStatusBadge,
  accountActionLabel,
  accountVerificationStatus,
  canPromoteAccountToAdmin,
  canRunAccountApproval,
  resolveAccountApprovalDefaults,
  verificationStatusLabel,
} from './dashboard-page-helpers';

export function AccountsPanel({
  accountRequests,
  accountStatusCounts,
  accountStatusFilter,
  setAccountStatusFilter,
  accountViewMode,
  setAccountViewMode,
  filteredAccountRequests,
  accountRoleInputs,
  setAccountRoleInputs,
  accountMdaInputs,
  setAccountMdaInputs,
  accountReviewing,
  mdas,
  setSelectedAccount,
  handleApproveAccount,
  handleNeedsInfoAccount,
  handleRejectAccount,
  handleSuspendAccount,
  handleDeleteAccount,
}: any) {
  return (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="flex h-full min-h-0 flex-col border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-white">Accounts</h2>
                      <p className="mt-0.5 max-w-[520px] text-[12px] leading-5 text-[#8b8b8b]">Review every account, update access, change status, request more information, or delete accounts when required.</p>
                    </div>
                    <div className="flex w-full flex-nowrap items-center justify-between gap-2 overflow-x-auto xl:w-auto xl:justify-end">
                      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-1">
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
                      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#141414] p-1">
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
                          {filteredAccountRequests.map((account: any) => {
                            const { selectedRole, needsMda, selectedMda } = resolveAccountApprovalDefaults(
                              account,
                              accountRoleInputs,
                              accountMdaInputs,
                              mdas
                            );
                            const verificationStatus = accountVerificationStatus(account);
                            const adminRoleBlocked = selectedRole === 'admin' && !canPromoteAccountToAdmin(account);
                            const actionDisabled = accountReviewing === account.id || !canRunAccountApproval(account) || adminRoleBlocked;
                            const primaryActionLabel = adminRoleBlocked ? 'Gov/MDA only' : accountActionLabel(account, accountReviewing === account.id);

                            return (
                              <div key={account.id} className="flex min-h-[236px] flex-col rounded-lg border border-[#2e2e2e] bg-[#181818] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAccount(account)}
                                    className="min-w-0 text-left"
                                    aria-label={`Open account details for ${account.full_name}`}
                                  >
                                    <div className="truncate text-[14px] font-semibold text-white transition-colors hover:text-[#3ecf8e]" title={account.full_name}>{account.full_name}</div>
                                    <div className="mt-0.5 truncate text-[12px] text-[#8b8b8b]" title={account.email}>{account.email}</div>
                                  </button>
                                  <div className="text-right">
                                    <AccountStatusBadge status={account.status} />
                                    <div className="mt-1 text-[11px] capitalize text-[#8b8b8b]">{verificationStatusLabel(verificationStatus)}</div>
                                  </div>
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
                                  <select value={selectedRole} onChange={event => setAccountRoleInputs((current: Record<string, string>) => ({ ...current, [account.id]: event.target.value }))} className="h-[32px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444]">
                                    <option value="developer">Developer</option>
                                    <option value="api_owner">API Owner</option>
                                    <option value="reviewer">Reviewer</option>
                                    <option value="admin" disabled={!canPromoteAccountToAdmin(account)}>Admin</option>
                                  </select>
                                  <select value={selectedMda} disabled={!needsMda} onChange={event => setAccountMdaInputs((current: Record<string, string>) => ({ ...current, [account.id]: event.target.value }))} className="h-[32px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444] disabled:opacity-40">
                                    {!needsMda && <option value="">Not applicable</option>}
                                    {mdas.map((mda: any) => <option key={mda.id} value={mda.id}>{mda.shortName}</option>)}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAccount(account)}
                                    disabled={actionDisabled}
                                    title={canRunAccountApproval(account) ? undefined : 'User must submit verification before approval.'}
                                    className="inline-flex h-[32px] items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90 disabled:opacity-50"
                                  >
                                    {accountReviewing === account.id ? <Spinner className="h-3.5 w-3.5 text-black" /> : <IconCircleCheck className="h-3.5 w-3.5" />}
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
                        ) : filteredAccountRequests.map((user: any) => {
                          const { selectedRole, needsMda, selectedMda } = resolveAccountApprovalDefaults(
                            user,
                            accountRoleInputs,
                            accountMdaInputs,
                            mdas
                          );
                          const verificationStatus = accountVerificationStatus(user);
                          const adminRoleBlocked = selectedRole === 'admin' && !canPromoteAccountToAdmin(user);
                          const actionDisabled = accountReviewing === user.id || !canRunAccountApproval(user) || adminRoleBlocked;
                          const primaryActionLabel = adminRoleBlocked ? 'Gov/MDA only' : accountActionLabel(user, accountReviewing === user.id);

                          return (
                            <TableRow key={user.id} className="border-b border-[#2e2e2e] hover:bg-[#2e2e2e]/30 transition-colors">
                              <TableCell className="py-3.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAccount(user)}
                                  className="max-w-[220px] text-left"
                                  aria-label={`Open account details for ${user.full_name}`}
                                >
                                  <div className="truncate font-semibold text-[13px] text-[#ededed] transition-colors hover:text-[#3ecf8e]" title={user.full_name}>{user.full_name}</div>
                                  <div className="mt-0.5 truncate text-[12px] text-[#8b8b8b]" title={user.email}>{user.email}</div>
                                </button>
                              </TableCell>
                              <TableCell className="py-3.5 px-3 text-[13px] text-[#ededed]">
                                <div className="capitalize">{String(user.account_type || '').replace(/_/g, ' ')}</div>
                                <div className="mt-0.5 text-[11px] text-[#8b8b8b]">Requested {user.requested_role}</div>
                              </TableCell>
                              <TableCell className="py-3.5 px-3">
                                <AccountStatusBadge status={user.status} />
                                {user.account?.profile?.verification_status && (
                                  <div className="mt-1 text-[11px] capitalize text-[#8b8b8b]">{verificationStatusLabel(verificationStatus)}</div>
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
                                  onChange={event => setAccountRoleInputs((current: Record<string, string>) => ({ ...current, [user.id]: event.target.value }))}
                                  className="h-[30px] w-[102px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444]"
                                >
                                  <option value="developer">Developer</option>
                                  <option value="api_owner">API Owner</option>
                                  <option value="reviewer">Reviewer</option>
                                  <option value="admin" disabled={!canPromoteAccountToAdmin(user)}>Admin</option>
                                </select>
                              </TableCell>
                              <TableCell className="py-3.5 px-3">
                                <select
                                  value={selectedMda}
                                  disabled={!needsMda}
                                  onChange={event => setAccountMdaInputs((current: Record<string, string>) => ({ ...current, [user.id]: event.target.value }))}
                                  className="h-[30px] w-[96px] rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none focus:border-[#444] disabled:opacity-40"
                                >
                                  {!needsMda && <option value="">Not applicable</option>}
                                  {mdas.map((mda: any) => (
                                    <option key={mda.id} value={mda.id}>{mda.shortName}</option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="py-3.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAccount(user)}
                                    disabled={actionDisabled}
                                    title={canRunAccountApproval(user) ? undefined : 'User must submit verification before approval.'}
                                    className="inline-flex h-[28px] items-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90 disabled:opacity-50"
                                  >
                                    {accountReviewing === user.id ? <Spinner className="h-3.5 w-3.5 text-black" /> : <IconCircleCheck className="h-3.5 w-3.5" />}
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
  );
}
