import { useState } from "react"
import { Pickaxe, Plus, RotateCcw, Landmark, ShieldCheck, ShieldAlert, Cpu, CheckCircle2 } from "lucide-react"
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
  const [isMining, setIsMining] = useState(false)

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
    setFinalBlock(null)
    setIsMining(true)
    // Add realistic delay
    await new Promise((resolve) => setTimeout(resolve, 1400))
    try {
      const chain = await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY)
      setFinalBlock(chain.at(-1) ?? null)
    } finally {
      setIsMining(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <Card className="flex flex-col justify-between">
        <div>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-4 text-[#f6c251]" />
              Verification Workflow Console
            </CardTitle>
            <CardDescription>
              National land deeds transfer only executes after securing all four legislative government agency clearances.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4 flex flex-col gap-4">
            <div className="rounded-md border border-border bg-muted/20 p-4 flex items-center gap-3">
              <div className="size-14 shrink-0 flex items-center justify-center rounded-md border border-border bg-card">
                <span className="text-base font-medium text-primary">
                  {progress.percent}%
                </span>
              </div>
              
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  Approval Integrity
                </span>
                <span className="text-sm font-medium text-foreground">
                  {progress.approved} of {progress.total} Core Clearances Secured
                </span>
                <span className="text-xs text-muted-foreground">
                  The smart contract enforces a strictly ordered verification list.
                </span>
              </div>
            </div>

            {!readiness.ready && (
              <Alert variant="destructive" className="rounded-md border-destructive/30 bg-destructive/10 text-destructive py-3 flex gap-2">
                <ShieldAlert className="size-5 shrink-0" />
                <div>
                  <AlertTitle className="font-medium text-sm">Policy Requirements Pending</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed mt-0.5">
                    Cannot initiate blockchain deed transfer. Missing agency sign-offs: <strong className="font-mono text-[10px]">{readiness.missingApprovals.join(", ")}</strong>.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2 border-t border-b border-border py-3">
              <Button
                type="button"
                variant="outline"
                disabled={approvalCount >= requiredTransferApprovals.length || isMining}
                onClick={addApproval}
                className="cursor-pointer text-xs"
              >
                <Plus className="size-4" />
                Sign Next Agency Clear
              </Button>
              <Button 
                type="button" 
                disabled={!readiness.ready || isMining} 
                onClick={mineTransfer}
                className="cursor-pointer text-xs"
              >
                <Pickaxe className="size-4" />
                Register Transfer Deed
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                disabled={isMining}
                onClick={reset}
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                Reset Workflow
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-medium uppercase text-muted-foreground pl-1">
                Contract Approval Checklist
              </p>
              <TransactionTable approvals={requiredTransferApprovals} />
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <UseCaseTimeline items={timeline} />

        {isMining && (
          <div className="py-8 rounded-md border border-border bg-card flex flex-col items-center justify-center gap-2">
            <Cpu className="size-6 text-primary animate-spin" />
            <p className="text-xs font-medium text-primary">
              Anchoring multi-agency stamps to block #5...
            </p>
          </div>
        )}

        {finalBlock && !isMining && (
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-green-400 mb-2 pl-1">
              <CheckCircle2 className="size-4" />
              Mined & Chained Title Block
            </div>
            <BlockCard block={finalBlock} difficulty={DEMO_DIFFICULTY} compact />
          </div>
        )}
      </div>
    </div>
  )
}
