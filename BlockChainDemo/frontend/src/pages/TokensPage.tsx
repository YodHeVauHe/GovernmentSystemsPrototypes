import { useState } from "react"
import { Pickaxe, RotateCcw } from "lucide-react"
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
  initialLandTitleEvents,
  requiredTransferApprovals,
} from "@/lib/demo-data"
import type { DemoBlock, TransferApproval } from "@/lib/types"

export function TokensPage() {
  const [approvals, setApprovals] = useState<TransferApproval[]>(
    requiredTransferApprovals
  )
  const [transferBlock, setTransferBlock] = useState<DemoBlock | null>(null)
  const missing = getMissingTransferApprovals(approvals)
  const ready = missing.length === 0

  const mineTransfer = async () => {
    const block = await mineBlock(
      {
        index: 1,
        nonce: 0,
        previousHash: GENESIS_HASH,
        hash: "",
        data: initialLandTitleEvents[4],
      },
      DEMO_DIFFICULTY,
      MAX_MINING_NONCE
    )
    setTransferBlock(block)
  }

  const removeUraApproval = () => {
    setTransferBlock(null)
    setApprovals((current) =>
      current.map((approval) =>
        approval.id === "ura-stamp-duty"
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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Land title asset token</CardTitle>
          <CardDescription>
            The token represents title state, not a cryptocurrency.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">TITLE-KLA-2026-000184</p>
              <Badge variant={ready ? "default" : "outline"}>
                {ready ? "Transfer ready" : "Approvals missing"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Asset ID: PARCEL-KCCA-CEN-12-0441. Current owner reference:
              OWNER-REF-AF3D91. Proposed new owner reference:
              OWNER-REF-6C20D4.
            </p>
          </div>
          {!ready && (
            <Alert variant="destructive">
              <AlertTitle>Transfer blocked</AlertTitle>
              <AlertDescription>{missing.join(", ")}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!ready} onClick={mineTransfer}>
              <Pickaxe data-icon="inline-start" />
              Mine transfer block
            </Button>
            <Button type="button" variant="outline" onClick={removeUraApproval}>
              Remove URA approval
            </Button>
            <Button type="button" variant="ghost" onClick={restoreApprovals}>
              <RotateCcw data-icon="inline-start" />
              Restore approvals
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <TransactionTable approvals={approvals} />
        {transferBlock && (
          <BlockCard
            block={transferBlock}
            difficulty={DEMO_DIFFICULTY}
            compact
          />
        )}
      </div>
    </div>
  )
}
