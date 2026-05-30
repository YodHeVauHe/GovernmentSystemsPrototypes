import { useState } from "react"
import { Pickaxe, RotateCcw, Landmark, ArrowRight, ShieldCheck, ShieldAlert, Cpu, CheckCircle2 } from "lucide-react"
import { BlockCard } from "@/components/blockchain/BlockCard"
import { TransactionTable } from "@/components/blockchain/TransactionTable"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getMissingTransferApprovals, mineBlock } from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
  GENESIS_HASH,
  MAX_MINING_NONCE,
  TRANSFER_APPROVAL_IDS,
  initialLandTitleEvents,
  requiredTransferApprovals,
  sampleParcelPayload,
} from "@/lib/demo-data"
import type { DemoBlock, TransferApproval } from "@/lib/types"

export function TokensPage() {
  const [approvals, setApprovals] = useState<TransferApproval[]>(
    requiredTransferApprovals
  )
  const [transferBlock, setTransferBlock] = useState<DemoBlock | null>(null)
  const [isMining, setIsMining] = useState(false)
  
  const missing = getMissingTransferApprovals(approvals)
  const ready = missing.length === 0

  const mineTransfer = async () => {
    setTransferBlock(null)
    setIsMining(true)
    // Add realistic GPU mining delay
    await new Promise((resolve) => setTimeout(resolve, 1400))
    try {
      const block = await mineBlock(
        {
          index: 5,
          nonce: 0,
          previousHash: GENESIS_HASH,
          hash: "",
          data: initialLandTitleEvents[4],
        },
        DEMO_DIFFICULTY,
        MAX_MINING_NONCE
      )
      setTransferBlock(block)
    } finally {
      setIsMining(false)
    }
  }

  const removeUraApproval = () => {
    setTransferBlock(null)
    setApprovals((current) =>
      current.map((approval) =>
        approval.id === TRANSFER_APPROVAL_IDS.uraStampDuty
          ? { ...approval, status: "pending" }
          : approval
      )
    )
  }

  const restoreApprovals = () => {
    setTransferBlock(null)
    setApprovals(requiredTransferApprovals)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="flex flex-col justify-between">
        <div>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-4 text-[#f6c251]" />
              Digital Land Title Tokenization
            </CardTitle>
            <CardDescription>
              Government asset representations are locked onto the ledger using multi-agency cryptographic sign-offs.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4 flex flex-col gap-4">
            <div className="rounded-md border border-border bg-muted/20 p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-md border border-border flex items-center justify-center bg-card text-[#f6c251]">
                    <Landmark className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase block leading-none">
                      Republic of Uganda
                    </span>
                    <span className="text-xs font-medium text-foreground leading-none mt-1 block">
                      Ministry of Lands Registry
                    </span>
                  </div>
                </div>
                <Badge 
                  variant={ready ? "default" : "outline"}
                  className={ready 
                    ? "bg-green-500/10 text-green-400 border-green-500/25" 
                    : "bg-destructive/10 text-destructive border-destructive/20"}
                >
                  {ready ? "Transfer Ready" : "Locked / Pending Signatures"}
                </Badge>
              </div>

              <div className="border-t border-b border-border py-3 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium uppercase text-[10px]">Certificate No.</span>
                  <span className="font-medium text-foreground text-right">TITLE-KLA-2026-000184</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium uppercase text-[10px]">Asset Reference ID</span>
                  <span className="font-medium text-primary text-right">{sampleParcelPayload.parcelId}</span>
                </div>
              </div>

              <div className="bg-background rounded-md border border-border p-3 grid grid-cols-[1fr_2rem_1fr] items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-medium uppercase text-muted-foreground">Current Owner Reference</span>
                  <span className="text-xs font-medium text-foreground/90 bg-muted/40 px-2 py-1 rounded-md border mt-1 select-none">
                    OWNER-REF-AF3D91
                  </span>
                </div>
                <div className="flex justify-center text-muted-foreground">
                  <ArrowRight className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-medium uppercase text-muted-foreground">Proposed Owner Reference</span>
                  <span className="text-xs font-medium text-primary bg-primary/5 px-2 py-1 rounded-md border border-primary/20 mt-1 select-none">
                    OWNER-REF-6C20D4
                  </span>
                </div>
              </div>
            </div>

            {!ready && (
              <Alert variant="destructive" className="rounded-md border-destructive/30 bg-destructive/10 text-destructive py-3 flex gap-2">
                <ShieldAlert className="size-5 shrink-0" />
                <div>
                  <AlertTitle className="font-medium text-sm">Transfer Suspended</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed mt-0.5">
                    Required MDA stamps are missing. Legislative guidelines mandate approval signatures from: <strong className="font-mono text-[10px]">{missing.join(", ")}</strong>.
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </div>

        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button 
              type="button" 
              disabled={!ready || isMining} 
              onClick={mineTransfer}
              className="cursor-pointer"
            >
              <Pickaxe className="size-4" />
              Mine Transfer Block
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              disabled={isMining}
              onClick={removeUraApproval}
              className="cursor-pointer"
            >
              Remove URA Approval
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              disabled={isMining}
              onClick={restoreApprovals}
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Restore Approvals
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-green-400" />
              Multi-Agency Signatures
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/80">
              Audit log of MDA checks captured inside the smart contract validation pool.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <TransactionTable approvals={approvals} />
          </CardContent>
        </Card>

        {isMining && (
          <div className="py-8 rounded-md border border-border bg-card flex flex-col items-center justify-center gap-2">
            <Cpu className="size-6 text-primary animate-spin" />
            <p className="text-xs font-medium text-primary">
              Computing proof hash for final title transfer transaction...
            </p>
          </div>
        )}

        {transferBlock && !isMining && (
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-green-400 mb-2 pl-1">
              <CheckCircle2 className="size-4" />
              Mined & Registered Transaction Block
            </div>
            <BlockCard
              block={transferBlock}
              difficulty={DEMO_DIFFICULTY}
              compact
            />
          </div>
        )}
      </div>
    </div>
  )
}
