import { IconX } from '@tabler/icons-react';
import {
  AccessRequestStatusBadge,
  AccountStatusBadge,
  accountCategoryLabel,
  accountVerificationStatus,
  formatDashboardLabel,
  roleLabel,
  verificationStatusLabel,
} from './dashboard-page-helpers';
import { formatAuditLogDetails, getAuditLogEndpoint, getAuditLogResponseStatus, getAuditLogResponseStatusLabel } from '../view-helpers';

function formatValue(value: unknown, fallback = 'Not provided') {
  return value ? String(value) : fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString();
}

function DetailField({ label, value, className = '' }: { label: string; value: unknown; className?: string }) {
  return (
    <div className={className}>
      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">{label}</span>
      <span className="font-medium text-white">{formatValue(value)}</span>
    </div>
  );
}

function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">{title}</span>
      {aside && <span className="text-[11px] text-[#8b8b8b]">{aside}</span>}
    </div>
  );
}

function InlineList({ values, emptyLabel }: { values?: unknown[]; emptyLabel: string }) {
  if (!values?.length) return <span className="text-[#8b8b8b]">{emptyLabel}</span>;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {values.map(value => (
        <span key={String(value)} className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] px-2 py-1 text-[11px] text-[#ededed]">
          {formatDashboardLabel(String(value))}
        </span>
      ))}
    </div>
  );
}

export function DashboardDrawers({
  selectedAccessRequest,
  setSelectedAccessRequest,
  selectedAccount,
  setSelectedAccount,
  mdas = [],
  selectedLog,
  setSelectedLog,
}: any) {
  const selectedAccountProfile = selectedAccount?.account?.profile;
  const selectedAccountRequirements = selectedAccount?.account?.requirements;
  const selectedAccountProgress = selectedAccount?.account?.verification_progress;
  const selectedAccountPrivileges = selectedAccount?.account?.privileges;
  const selectedAccountDocuments = selectedAccount?.account?.documents || [];
  const selectedAccountMda = mdas.find((mda: any) => mda.id === (selectedAccount?.requested_mda_id || selectedAccount?.mda_id));
  const selectedAccountRequiredDocumentCount = selectedAccountRequirements?.requiredDocuments?.length || 0;
  const selectedAccountRequiredFieldCount = selectedAccountRequirements?.requiredFields?.length || 0;
  const selectedAccountMissingDocuments = selectedAccountProgress?.missing_documents?.map((missingDocument: string) => {
    const requirement = selectedAccountRequirements?.requiredDocuments?.find((document: any) => document.type === missingDocument);
    return requirement?.label || missingDocument;
  });
  const selectedAccountMissingFields = selectedAccountProgress?.missing_fields || [];

  return (
    <>
            {/* Slide-over Detail Panel for Account Access Requests */}
            {selectedAccount && (
              <div
                role="region"
                aria-label="Account request details"
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#2e2e2e] bg-[#1c1c1c] text-left shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[#2e2e2e] bg-[#141414] px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-white" title={selectedAccount.full_name}>
                      Account Request Details
                    </h3>
                    <p className="mt-0.5 text-[12px] text-[#8b8b8b]">
                      Account ID: <span className="font-mono text-white select-all">{selectedAccount.id}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close account request details"
                    onClick={() => setSelectedAccount(null)}
                    className="rounded p-1 text-[#8b8b8b] transition-all hover:bg-[#2e2e2e] hover:text-white"
                  >
                    <IconX className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[#8b8b8b]">Applicant</span>
                        <div className="truncate text-[15px] font-semibold text-white" title={selectedAccount.full_name}>{selectedAccount.full_name}</div>
                        <div className="mt-0.5 truncate text-[12px] text-[#8b8b8b]" title={selectedAccount.email}>{selectedAccount.email}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <AccountStatusBadge status={selectedAccount.status} />
                        <div className="mt-1 text-[11px] capitalize text-[#8b8b8b]">
                          {verificationStatusLabel(accountVerificationStatus(selectedAccount))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <DetailField label="Signup Category" value={accountCategoryLabel(selectedAccount.account_type)} />
                    <DetailField label="Verified Category" value={accountCategoryLabel(selectedAccountProfile?.account_category || selectedAccount.account_type)} />
                    <DetailField label="Requested Role" value={roleLabel(selectedAccount.requested_role)} />
                    <DetailField label="Current Role" value={selectedAccount.role ? roleLabel(selectedAccount.role) : 'Not Approved'} />
                    <DetailField label="Organization" value={selectedAccount.requested_organization} className="col-span-2 border-t border-[#2e2e2e] pt-3.5" />
                    <DetailField label="Requested MDA" value={selectedAccountMda ? `${selectedAccountMda.name} (${selectedAccountMda.shortName})` : selectedAccount.requested_mda_id} className="col-span-2" />
                    <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Access Purpose</span>
                      <p className="mt-1 leading-5 text-white">{formatValue(selectedAccount.requested_purpose)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5 text-[12px]">
                    <SectionTitle title="Profile Details" />
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="Contact Phone" value={selectedAccountProfile?.contact_phone} />
                      <DetailField label="National ID / NIN" value={selectedAccountProfile?.national_id_number || selectedAccountProfile?.nin} />
                      <DetailField label="Organization Name" value={selectedAccountProfile?.organization_name || selectedAccount.requested_organization} />
                      <DetailField label="Organization Type" value={selectedAccountProfile?.organization_type && formatDashboardLabel(selectedAccountProfile.organization_type)} />
                      <DetailField label="URSB Number" value={selectedAccountProfile?.ursb_number} />
                      <DetailField label="BRN" value={selectedAccountProfile?.brn} />
                      <DetailField label="TIN" value={selectedAccountProfile?.tin} />
                      <DetailField label="Staff ID" value={selectedAccountProfile?.staff_id} />
                      <DetailField label="Department" value={selectedAccountProfile?.department} />
                      <DetailField label="Job Title" value={selectedAccountProfile?.job_title} />
                      <DetailField label="Supervisor" value={selectedAccountProfile?.supervisor_name} />
                      <DetailField label="Supervisor Email" value={selectedAccountProfile?.supervisor_email} />
                      <DetailField label="Address" value={selectedAccountProfile?.address} className="col-span-2" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5 text-[12px]">
                    <SectionTitle
                      title="Requirement Status"
                      aside={`${selectedAccountProgress?.completed_requirements || 0}/${selectedAccountProgress?.total_requirements || 0} complete`}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField
                        label="Profile Fields"
                        value={`${selectedAccountProgress?.completed_fields || 0}/${selectedAccountRequiredFieldCount}`}
                      />
                      <DetailField
                        label="Documents"
                        value={`${selectedAccountProgress?.completed_documents || selectedAccountDocuments.length}/${selectedAccountRequiredDocumentCount}`}
                      />
                      <DetailField
                        label="Next Action"
                        value={formatDashboardLabel(selectedAccountProgress?.next_action)}
                        className="col-span-2"
                      />
                      <div className="col-span-2">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Missing Fields</span>
                        <InlineList values={selectedAccountMissingFields} emptyLabel="No Missing Fields" />
                      </div>
                      <div className="col-span-2">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Missing Documents</span>
                        <InlineList values={selectedAccountMissingDocuments} emptyLabel="No Missing Documents" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5 text-[12px]">
                    <div className="grid gap-3">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Submitted At</span>
                        <span className="font-mono text-[#ededed]">{formatDateTime(selectedAccountProfile?.submitted_at)}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Reviewed At</span>
                        <span className="font-mono text-[#ededed]">{formatDateTime(selectedAccountProfile?.reviewed_at)}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Review Notes</span>
                        <span className="text-[#ededed]">{formatValue(selectedAccountProfile?.review_notes, 'No review notes')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5 text-[12px]">
                    <SectionTitle title="Verification Documents" aside={`${selectedAccountDocuments.length}/${selectedAccountRequiredDocumentCount} uploaded`} />
                    {selectedAccountDocuments.length === 0 ? (
                      <p className="text-[#8b8b8b]">No documents uploaded.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedAccountDocuments.map((document: any) => (
                          <div key={`${document.type}-${document.file_name}`} className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-2">
                            <div className="font-medium text-white">{document.label || document.type}</div>
                            <div className="mt-0.5 truncate font-mono text-[11px] text-[#8b8b8b]" title={document.file_name}>{document.file_name}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#8b8b8b]">
                              <span>Status: <span className="text-[#ededed]">{formatDashboardLabel(document.status)}</span></span>
                              <span>Type: <span className="font-mono text-[#ededed]">{document.mime_type || 'Not Provided'}</span></span>
                              <span>Uploaded: <span className="font-mono text-[#ededed]">{formatDateTime(document.uploaded_at)}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedAccountMissingDocuments?.length > 0 && (
                      <p className="mt-3 text-orange-300">
                        Missing: {selectedAccountMissingDocuments.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] p-3.5 text-[12px]">
                    <SectionTitle title="Access Privileges" aside={selectedAccountPrivileges?.accessGroup} />
                    <div className="grid gap-3">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Allowed After Approval</span>
                        <InlineList values={selectedAccountPrivileges?.permissions} emptyLabel="No Permissions Listed" />
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#8b8b8b]">Restrictions</span>
                        <InlineList values={selectedAccountPrivileges?.restrictions} emptyLabel="No Restrictions Listed" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                      <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Attempted Endpoint</span>
                      <span className="font-mono text-white break-all">{getAuditLogEndpoint(selectedLog) || 'Unavailable'}</span>
                    </div>
                    <div className="col-span-2 border-t border-[#2e2e2e] pt-3.5">
                      <span className="block text-[11px] font-mono text-[#8b8b8b] uppercase tracking-wider">Response Code</span>
                      <span className={`font-mono ${getAuditLogResponseStatus(selectedLog) !== null && getAuditLogResponseStatus(selectedLog)! < 400 ? 'text-[#3ecf8e]' : 'text-red-400'}`}>
                        {getAuditLogResponseStatusLabel(selectedLog) || 'Unavailable'}
                      </span>
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
