import { sha256Hex } from "./crypto"

export const CASHFLOW_GENESIS_HASH = "GENESIS_CASHFLOW"

export type CashflowEventType =
  | "BudgetAllocated"
  | "FundsReleased"
  | "CommitmentCreated"
  | "PaymentApproved"
  | "BankDisbursed"
  | "Reconciled"

export type CashflowSeverity = "info" | "warning" | "critical"

export type CashflowFindingCode =
  | "BrokenHash"
  | "OverRelease"
  | "OverCommitment"
  | "MissingApproval"
  | "DuplicateReference"
  | "ReconciliationMismatch"

export type CashflowEventInput = {
  type: CashflowEventType
  mda: string
  budgetLine: string
  amount: number
  currency: string
  actor: string
  reference: string
  timestamp: string
  metadata: Record<string, string>
}

export type CashflowEvent = CashflowEventInput & {
  id: string
  previousHash: string
  hash: string
}

export type CashflowFinding = {
  code: CashflowFindingCode
  severity: CashflowSeverity
  title: string
  description: string
  eventIds: string[]
}

export type CashflowSummary = {
  allocated: number
  released: number
  committed: number
  approved: number
  disbursed: number
  reconciled: number
  availableToCommit: number
}

const SAMPLE_BUDGET_REFERENCE =
  "24e2b4c8fd5a2e21f8221f65c96717f740b80bbd41d53f30c7d87cae4c2c2d31"
const SAMPLE_RELEASE_REFERENCE =
  "a0872c3d4f41e9cbab7d5532d83e26c6d5e5c63f8d9e2b8e049bb7ef5a72d6df"
const SAMPLE_COMMITMENT_REFERENCE =
  "c4e1f5aef7a0b1c9e91f19a74dfb9d5a3686b42f6026c9aa0a1e25b46829c103"
const SAMPLE_PAYMENT_REFERENCE =
  "8dc1a90f89fe8f82e9b2f5c25d2449a6e8d1068c77d5cc72d9705c83a72efabc"

export const sampleCashflowEvents: CashflowEventInput[] = [
  {
    type: "BudgetAllocated",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 10_000_000,
    currency: "UGX",
    actor: "Parliament",
    reference: SAMPLE_BUDGET_REFERENCE,
    timestamp: "2026-07-01T08:00:00.000Z",
    metadata: { vote: "014", source: "Approved national budget" },
  },
  {
    type: "FundsReleased",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 6_000_000,
    currency: "UGX",
    actor: "Treasury",
    reference: SAMPLE_RELEASE_REFERENCE,
    timestamp: "2026-07-02T08:00:00.000Z",
    metadata: { quarter: "Q1", cashLimit: "First quarter release" },
  },
  {
    type: "CommitmentCreated",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 5_500_000,
    currency: "UGX",
    actor: "Accounting Officer",
    reference: SAMPLE_COMMITMENT_REFERENCE,
    timestamp: "2026-07-03T08:00:00.000Z",
    metadata: { supplier: "National Medical Stores" },
  },
  {
    type: "PaymentApproved",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 5_500_000,
    currency: "UGX",
    actor: "Permanent Secretary",
    reference: SAMPLE_PAYMENT_REFERENCE,
    timestamp: "2026-07-04T08:00:00.000Z",
    metadata: { commitmentReference: SAMPLE_COMMITMENT_REFERENCE },
  },
  {
    type: "BankDisbursed",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 5_500_000,
    currency: "UGX",
    actor: "Bank of Uganda Gateway",
    reference: SAMPLE_PAYMENT_REFERENCE,
    timestamp: "2026-07-05T08:00:00.000Z",
    metadata: { bankBatch: "BOU-BATCH-15" },
  },
  {
    type: "Reconciled",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 5_500_000,
    currency: "UGX",
    actor: "Auditor General",
    reference: SAMPLE_PAYMENT_REFERENCE,
    timestamp: "2026-07-06T08:00:00.000Z",
    metadata: { statementId: "STMT-15" },
  },
]

export async function buildCashflowLedger(
  events: CashflowEventInput[]
): Promise<CashflowEvent[]> {
  const ledger: CashflowEvent[] = []

  for (const event of events) {
    const previousHash = ledger.at(-1)?.hash ?? CASHFLOW_GENESIS_HASH
    const id = await createCashflowEventId(event)
    const hash = await calculateCashflowHash({ ...event, id, previousHash })

    ledger.push({ ...event, id, previousHash, hash })
  }

  return ledger
}

export async function calculateCashflowHash(
  event: Omit<CashflowEvent, "hash">
): Promise<string> {
  return sha256Hex(event)
}

export function getCashflowSummary(ledger: CashflowEvent[]): CashflowSummary {
  const summary = ledger.reduce<CashflowSummary>(
    (totals, event) => {
      return {
        ...totals,
        [summaryKeyFor(event.type)]: totals[summaryKeyFor(event.type)] + event.amount,
      }
    },
    {
      allocated: 0,
      released: 0,
      committed: 0,
      approved: 0,
      disbursed: 0,
      reconciled: 0,
      availableToCommit: 0,
    }
  )

  return {
    ...summary,
    availableToCommit: summary.released - summary.committed,
  }
}

export async function validateCashflowLedger(
  ledger: CashflowEvent[]
): Promise<CashflowFinding[]> {
  return [
    ...(await findBrokenHashLinks(ledger)),
    ...findOverReleaseFindings(ledger),
    ...findOverCommitmentFindings(ledger),
    ...findDuplicateReferenceFindings(ledger),
    ...findMissingApprovalFindings(ledger),
    ...findReconciliationMismatchFindings(ledger),
  ]
}

async function createCashflowEventId(event: CashflowEventInput): Promise<string> {
  return sha256Hex({ scope: "cashflow-event-id", event })
}

async function findBrokenHashLinks(
  ledger: CashflowEvent[]
): Promise<CashflowFinding[]> {
  const findings: CashflowFinding[] = []

  for (const [index, event] of ledger.entries()) {
    const previousHash = index === 0 ? CASHFLOW_GENESIS_HASH : ledger[index - 1].hash
    const { hash: _hash, ...hashableEvent } = event
    const expectedHash = await calculateCashflowHash({ ...hashableEvent, previousHash })

    if (event.previousHash !== previousHash || event.hash !== expectedHash) {
      findings.push({
        code: "BrokenHash",
        severity: "critical",
        title: "Ledger hash link is broken",
        description:
          "An event payload or previous-hash pointer no longer matches the recorded hash.",
        eventIds: [event.id],
      })
    }
  }

  return findings
}

function findOverReleaseFindings(ledger: CashflowEvent[]): CashflowFinding[] {
  const findings: CashflowFinding[] = []

  for (const key of getLedgerKeys(ledger)) {
    const allocated = totalByType(ledger, key, "BudgetAllocated")
    const released = totalByType(ledger, key, "FundsReleased")

    if (released > allocated) {
      findings.push({
        code: "OverRelease",
        severity: "critical",
        title: "Released funds exceed budget",
        description: `${formatAmount(released)} was released against ${formatAmount(
          allocated
        )} allocated for ${key}.`,
        eventIds: eventIdsForTypes(ledger, key, ["BudgetAllocated", "FundsReleased"]),
      })
    }
  }

  return findings
}

function findOverCommitmentFindings(ledger: CashflowEvent[]): CashflowFinding[] {
  const findings: CashflowFinding[] = []

  for (const key of getLedgerKeys(ledger)) {
    const released = totalByType(ledger, key, "FundsReleased")
    const committed = totalByType(ledger, key, "CommitmentCreated")

    if (committed > released) {
      findings.push({
        code: "OverCommitment",
        severity: "critical",
        title: "Commitments exceed released funds",
        description: `${formatAmount(committed)} was committed while only ${formatAmount(
          released
        )} had been released for ${key}.`,
        eventIds: eventIdsForTypes(ledger, key, [
          "FundsReleased",
          "CommitmentCreated",
        ]),
      })
    }
  }

  return findings
}

function findDuplicateReferenceFindings(
  ledger: CashflowEvent[]
): CashflowFinding[] {
  const duplicateCandidates = ledger.filter((event) =>
    ["PaymentApproved", "BankDisbursed"].includes(event.type)
  )
  const groupedByReference = groupBy(
    duplicateCandidates,
    (event) => `${event.type}:${event.reference}`
  )

  return [...groupedByReference.entries()]
    .filter(([, events]) => events.length > 1)
    .map(([typedReference, events]) => ({
      code: "DuplicateReference" as const,
      severity: "warning" as const,
      title: "Duplicate payment reference",
      description: `Reference ${shortHash(
        typedReference.split(":")[1]
      )} appears in multiple ${events[0].type} events.`,
      eventIds: events.map((event) => event.id),
    }))
}

function findMissingApprovalFindings(ledger: CashflowEvent[]): CashflowFinding[] {
  const approvedReferences = new Set(
    ledger
      .filter((event) => event.type === "PaymentApproved")
      .map((event) => event.reference)
  )

  return ledger
    .filter(
      (event) =>
        event.type === "BankDisbursed" && !approvedReferences.has(event.reference)
    )
    .map((event) => ({
      code: "MissingApproval" as const,
      severity: "critical" as const,
      title: "Disbursement has no prior approval",
      description: `Bank disbursement ${shortHash(
        event.reference
      )} was recorded without a matching payment approval.`,
      eventIds: [event.id],
    }))
}

function findReconciliationMismatchFindings(
  ledger: CashflowEvent[]
): CashflowFinding[] {
  const disbursementsByReference = groupBy(
    ledger.filter((event) => event.type === "BankDisbursed"),
    (event) => event.reference
  )

  return ledger
    .filter((event) => event.type === "Reconciled")
    .flatMap((event) => {
      const matchingDisbursements = disbursementsByReference.get(event.reference) ?? []
      const matchedAmount = matchingDisbursements.reduce(
        (total, disbursement) => total + disbursement.amount,
        0
      )

      if (matchingDisbursements.length === 0 || matchedAmount !== event.amount) {
        return [
          {
            code: "ReconciliationMismatch" as const,
            severity: "critical" as const,
            title: "Reconciliation amount does not match disbursement",
            description: `Reconciliation ${shortHash(
              event.reference
            )} recorded ${formatAmount(event.amount)} against ${formatAmount(
              matchedAmount
            )} disbursed.`,
            eventIds: [
              event.id,
              ...matchingDisbursements.map((disbursement) => disbursement.id),
            ],
          },
        ]
      }

      return []
    })
}

function summaryKeyFor(type: CashflowEventType): keyof CashflowSummary {
  const keys: Record<CashflowEventType, keyof CashflowSummary> = {
    BudgetAllocated: "allocated",
    FundsReleased: "released",
    CommitmentCreated: "committed",
    PaymentApproved: "approved",
    BankDisbursed: "disbursed",
    Reconciled: "reconciled",
  }

  return keys[type]
}

function getLedgerKeys(ledger: CashflowEvent[]): string[] {
  return [...new Set(ledger.map((event) => cashflowScopeKey(event)))]
}

function cashflowScopeKey(event: CashflowEvent): string {
  return `${event.mda} / ${event.budgetLine}`
}

function totalByType(
  ledger: CashflowEvent[],
  key: string,
  type: CashflowEventType
): number {
  return ledger
    .filter((event) => cashflowScopeKey(event) === key && event.type === type)
    .reduce((total, event) => total + event.amount, 0)
}

function eventIdsForTypes(
  ledger: CashflowEvent[],
  key: string,
  types: CashflowEventType[]
): string[] {
  return ledger
    .filter((event) => cashflowScopeKey(event) === key && types.includes(event.type))
    .map((event) => event.id)
}

function groupBy<T>(
  items: T[],
  getKey: (item: T) => string
): Map<string, T[]> {
  return items.reduce<Map<string, T[]>>((map, item) => {
    const key = getKey(item)
    map.set(key, [...(map.get(key) ?? []), item])
    return map
  }, new Map())
}

export function shortHash(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

export function formatAmount(amount: number, currency = "UGX"): string {
  return `${currency} ${amount.toLocaleString("en-US")}`
}
