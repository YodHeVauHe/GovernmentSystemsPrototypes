import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Link2, ShieldCheck, TrendingUp, Info, FileJson, Network } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildCashflowLedger,
  formatAmount,
  getCashflowSummary,
  sampleCashflowEvents,
  shortHash,
  validateCashflowLedger,
  type CashflowEvent,
  type CashflowFinding,
  type CashflowSummary,
} from "@/lib/cashflow"
import { cn } from "@/lib/utils"

const cashflowSteps = [
  {
    type: "BudgetAllocated",
    label: "Budget allocated",
    owner: "Parliament / Treasury",
    detail: "Creates the ceiling for an MDA and budget line.",
  },
  {
    type: "FundsReleased",
    label: "Funds released",
    owner: "Treasury",
    detail: "Records cash actually made available for spending.",
  },
  {
    type: "CommitmentCreated",
    label: "Commitment created",
    owner: "MDA Accounting Officer",
    detail: "Reserves released funds for a supplier or obligation.",
  },
  {
    type: "PaymentApproved",
    label: "Payment approved",
    owner: "Authorized officer",
    detail: "Anchors the approval checkpoint before money leaves.",
  },
  {
    type: "BankDisbursed",
    label: "Bank disbursed",
    owner: "Payment gateway",
    detail: "Confirms cash movement outside the MDA system.",
  },
  {
    type: "Reconciled",
    label: "Reconciled",
    owner: "Auditor / Accountant",
    detail: "Matches the bank movement back to the approved obligation.",
  },
] as const

const emptySummary: CashflowSummary = {
  allocated: 0,
  released: 0,
  committed: 0,
  approved: 0,
  disbursed: 0,
  reconciled: 0,
  availableToCommit: 0,
}

export function CashflowPage() {
  const [ledger, setLedger] = useState<CashflowEvent[]>([])
  const [findings, setFindings] = useState<CashflowFinding[]>([])

  useEffect(() => {
    let isMounted = true

    async function loadLedger() {
      const builtLedger = await buildCashflowLedger(sampleCashflowEvents)
      const ledgerFindings = await validateCashflowLedger(builtLedger)

      if (isMounted) {
        setLedger(builtLedger)
        setFindings(ledgerFindings)
      }
    }

    loadLedger()

    return () => {
      isMounted = false
    }
  }, [])

  const summary = ledger.length > 0 ? getCashflowSummary(ledger) : emptySummary

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                MDA Consolidated Cashflow Ledger
              </CardTitle>
              <CardDescription>
                Shared financial accountability matrix mapping parliament budget ceilings down to reconciliations.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-4">
              <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed flex gap-2">
                <Info className="size-4 shrink-0 text-primary" />
                <p>
                  <strong>Cryptographic Audit Anchoring:</strong> Government accounting applications continue their workflow locally, while this public trust blockchain anchors hash proof identifiers and financial telemetry, establishing absolute protection against retroactive ledger tampering.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Allocated Ceiling" value={summary.allocated} colorClass="text-foreground" />
                <Metric label="Released Funds" value={summary.released} colorClass="text-primary" />
                <Metric label="Committed Outlays" value={summary.committed} colorClass="text-foreground" />
                <Metric label="Approved Vouchers" value={summary.approved} colorClass="text-green-400" />
                <Metric label="Bank Disbursements" value={summary.disbursed} colorClass="text-foreground" />
                <Metric label="Audited Reconciled" value={summary.reconciled} colorClass="text-green-400" />
              </div>
            </CardContent>
          </div>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Smart Contract Audit Findings
            </CardTitle>
            <CardDescription>
              Violations or exceptions discovered in ledger rules in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-3">
            {findings.length === 0 ? (
              <div className="rounded-md border border-green-500/25 bg-green-500/5 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  All Compliance Audits Passed
                </div>
                <p className="text-xs text-muted-foreground/80 leading-relaxed pl-7">
                  Releases strictly fit the budget ceilings, commitments fit within released liquid funds, bank disbursements correspond to voucher clearances, and previous hashes are secure.
                </p>
              </div>
            ) : (
              findings.map((finding) => (
                <Alert key={`${finding.code}-${finding.eventIds.join("-")}`} className="rounded-md border-destructive/30 bg-destructive/10 text-destructive py-3 flex gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
                  <div>
                    <AlertTitle className="font-medium text-sm text-destructive">{finding.title}</AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed mt-1 text-muted-foreground">{finding.description}</AlertDescription>
                  </div>
                </Alert>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_2.1fr]">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2">
              <Network className="size-4 text-primary" />
              Parliament-to-Auditor Path
            </CardTitle>
            <CardDescription>
              Chronological pipeline of secure financial checkpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-2">
            {cashflowSteps.map((step, index) => (
              <div
                key={step.type}
                className="grid grid-cols-[2rem_1fr] gap-3 rounded-md border border-border bg-muted/10 p-3 transition-colors hover:border-border"
              >
                <div className="flex size-7 items-center justify-center rounded-md bg-card border border-border text-xs font-medium text-muted-foreground">
                  {index + 1}
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium tracking-normal text-foreground">{step.label}</p>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {step.owner}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-4 text-primary" />
              Cryptographic Transaction Records
            </CardTitle>
            <CardDescription>
              State proofs representing structural fund tracking segments.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40">
                  <TableHead>Event Segment</TableHead>
                  <TableHead>Actor Authority</TableHead>
                  <TableHead>Value Payload</TableHead>
                  <TableHead>Reference Block</TableHead>
                  <TableHead className="text-right">State Hash Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="font-medium text-foreground/90">{event.type}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        ID {shortHash(event.id)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground/90">{event.actor}</TableCell>
                    <TableCell className="text-xs font-medium text-primary">
                      {formatAmount(event.amount, event.currency)}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground/80 font-medium">
                      {shortHash(event.reference)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/20 px-2 py-1 rounded-md border border-border">
                        <Link2 className="size-3 text-primary" />
                        <span>{shortHash(event.hash)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 transition-colors hover:border-border">
      <p className="text-[10px] font-medium uppercase text-muted-foreground leading-none">{label}</p>
      <p className={cn("mt-2 text-sm font-medium leading-none", colorClass ?? "text-foreground")}>
        {formatAmount(value)}
      </p>
    </div>
  )
}
