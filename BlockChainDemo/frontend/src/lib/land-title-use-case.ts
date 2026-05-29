import { requiredTransferApprovals } from "./demo-data"
import { getMissingTransferApprovals } from "./blockchain"
import type { TransferApproval } from "./types"

export function canMineTitleTransfer(approvals: TransferApproval[]) {
  const missingApprovals = getMissingTransferApprovals(
    approvals,
    requiredTransferApprovals
  )

  return {
    ready: missingApprovals.length === 0,
    missingApprovals,
  }
}

export function summarizeApprovalProgress(approvals: TransferApproval[]) {
  const approved = approvals.filter(
    (approval) => approval.status === "approved"
  ).length

  return {
    approved,
    total: requiredTransferApprovals.length,
    percent: Math.round((approved / requiredTransferApprovals.length) * 100),
  }
}
