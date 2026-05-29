import { useState } from "react"
import { Pickaxe, Plus, RotateCcw } from "lucide-react"
import { BlockCard } from "@/components/blockchain/BlockCard"
import { TransactionTable } from "@/components/blockchain/TransactionTable"
import { UseCaseTimeline } from "@/components/blockchain/UseCaseTimeline"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createDemoChain } from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
  initialLandTitleEvents,
  requiredTransferApprovals,
} from "@/lib/demo-data"
import { canMineTitleTransfer, summarizeApprovalProgress } from "@/lib/land-title-use-case"
import type { DemoBlock, TransferApproval } from "@/lib/types"

export function LandTitleUseCasePage() {
  const [approvalCount, setApprovalCount] = useState(1)
  const [finalBlock, setFinalBlock] = useState<DemoBlock | null>(null)
  const activeApprovals = requiredTransferApprovals.slice(0, approvalCount)
  const readiness = canMineTitleTransfer(activeApprovals)
  const progress = summarizeApprovalProgress(activeApprovals)

  const timeline = [
    {
      label: "Request title verification",
      owner: "Service desk",
      detail: "Institution checks parcel and title references before transfer.",
      complete: true,
    },
    {
      label: "Confirm title state",
      owner: "Ministry of Lands",
      detail: "Registry confirms title is active and parcel reference matches.",
      complete: approvalCount >= 1,
    },
    {
      label: "Confirm stamp duty",
      owner: "URA",
      detail: "Revenue authority anchors stamp duty assessment reference.",
      complete: approvalCount >= 2,
    },
    {
      label: "Verify identity",
      owner: "NIRA",
      detail: "Identity authority anchors buyer and seller verification result.",
      complete: approvalCount >= 3,
    },
    {
      label: "Check jurisdiction constraints",
      owner: "Local land office",
      detail: "Local government peer confirms no active caveat blocks transfer.",
      complete: approvalCount >= 4,
    },
    {
      label: "Mine title transfer",
      owner: "MDA network",
      detail: "Transfer is valid only after required MDA approvals exist.",
      complete: Boolean(finalBlock),
    },
  ]

  const addApproval = () => {
    setFinalBlock(null)
    setApprovalCount((current) =>
      Math.min(current + 1, requiredTransferApprovals.length)
    )
  }

  const reset = () => {
    setApprovalCount(1)
    setFinalBlock(null)
  }

  const mineTransfer = async () => {
    const chain = await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY)
    setFinalBlock(chain.at(-1) ?? null)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Land title verification and transfer</CardTitle>
          <CardDescription>
            A high-impact workflow for a national MDA blockchain foundation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-background p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Approval progress
            </p>
            <p className="mt-2 text-3xl font-semibold">{progress.percent}%</p>
            <p className="text-sm text-muted-foreground">
              {progress.approved} of {progress.total} MDA approvals anchored.
            </p>
          </div>
          {!readiness.ready && (
            <Alert variant="destructive">
              <AlertTitle>Smart-contract check failed</AlertTitle>
              <AlertDescription>
                Missing: {readiness.missingApprovals.join(", ")}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={approvalCount >= requiredTransferApprovals.length}
              onClick={addApproval}
            >
              <Plus data-icon="inline-start" />
              Add next approval
            </Button>
            <Button type="button" disabled={!readiness.ready} onClick={mineTransfer}>
              <Pickaxe data-icon="inline-start" />
              Mine transfer
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
          </div>
          <TransactionTable approvals={requiredTransferApprovals} />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <UseCaseTimeline items={timeline} />
        {finalBlock && (
          <BlockCard block={finalBlock} difficulty={DEMO_DIFFICULTY} compact />
        )}
      </div>
    </div>
  )
}
