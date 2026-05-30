import { describe, expect, it } from "vitest"
import {
  buildCashflowLedger,
  getCashflowSummary,
  validateCashflowLedger,
  type CashflowEventInput,
} from "./cashflow"

const CRYPTOGRAPHIC_ID_PATTERN = /^[a-f0-9]{64}$/
const BUDGET_REFERENCE =
  "24e2b4c8fd5a2e21f8221f65c96717f740b80bbd41d53f30c7d87cae4c2c2d31"
const RELEASE_REFERENCE =
  "a0872c3d4f41e9cbab7d5532d83e26c6d5e5c63f8d9e2b8e049bb7ef5a72d6df"
const COMMITMENT_REFERENCE =
  "c4e1f5aef7a0b1c9e91f19a74dfb9d5a3686b42f6026c9aa0a1e25b46829c103"
const PAYMENT_REFERENCE =
  "8dc1a90f89fe8f82e9b2f5c25d2449a6e8d1068c77d5cc72d9705c83a72efabc"
const MISSING_PAYMENT_REFERENCE =
  "f3a92812b56e6cb641f9ef2fdd6a13f9710f7f7c42a37a7aa52e49e65573d4a6"

const validEvents: CashflowEventInput[] = [
  {
    type: "BudgetAllocated",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 10_000_000,
    currency: "UGX",
    actor: "Parliament",
    reference: BUDGET_REFERENCE,
    timestamp: "2026-07-01T08:00:00.000Z",
    metadata: { vote: "014" },
  },
  {
    type: "FundsReleased",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 6_000_000,
    currency: "UGX",
    actor: "Treasury",
    reference: RELEASE_REFERENCE,
    timestamp: "2026-07-02T08:00:00.000Z",
    metadata: { quarter: "Q1" },
  },
  {
    type: "CommitmentCreated",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 5_500_000,
    currency: "UGX",
    actor: "Accounting Officer",
    reference: COMMITMENT_REFERENCE,
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
    reference: PAYMENT_REFERENCE,
    timestamp: "2026-07-04T08:00:00.000Z",
    metadata: { commitmentReference: COMMITMENT_REFERENCE },
  },
  {
    type: "BankDisbursed",
    mda: "Ministry of Health",
    budgetLine: "Regional medicine supply",
    amount: 5_500_000,
    currency: "UGX",
    actor: "Bank of Uganda Gateway",
    reference: PAYMENT_REFERENCE,
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
    reference: PAYMENT_REFERENCE,
    timestamp: "2026-07-06T08:00:00.000Z",
    metadata: { statementId: "STMT-15" },
  },
]

describe("cashflow ledger", () => {
  it("builds a stable hash chain and summary from valid events", async () => {
    const ledger = await buildCashflowLedger(validEvents)
    const findings = await validateCashflowLedger(ledger)
    const summary = getCashflowSummary(ledger)

    expect(ledger).toHaveLength(6)
    expect(ledger.every((event) => CRYPTOGRAPHIC_ID_PATTERN.test(event.id))).toBe(
      true
    )
    expect(ledger[0].previousHash).toBe("GENESIS_CASHFLOW")
    expect(ledger[1].previousHash).toBe(ledger[0].hash)
    expect(ledger[0].hash).toMatch(/^[a-f0-9]{64}$/)
    expect(findings).toEqual([])
    expect(summary).toMatchObject({
      allocated: 10_000_000,
      released: 6_000_000,
      committed: 5_500_000,
      approved: 5_500_000,
      disbursed: 5_500_000,
      reconciled: 5_500_000,
      availableToCommit: 500_000,
    })
  })

  it("detects broken hash links after tampering", async () => {
    const ledger = await buildCashflowLedger(validEvents)
    const tampered = ledger.map((event, index) =>
      index === 2 ? { ...event, amount: event.amount + 1 } : event
    )

    const findings = await validateCashflowLedger(tampered)

    expect(findings.some((finding) => finding.code === "BrokenHash")).toBe(true)
  })

  it("flags over-release and over-commitment findings", async () => {
    const ledger = await buildCashflowLedger([
      { ...validEvents[0], amount: 1_000 },
      { ...validEvents[1], amount: 1_500 },
      { ...validEvents[2], amount: 2_000 },
    ])

    const findings = await validateCashflowLedger(ledger)

    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["OverRelease", "OverCommitment"])
    )
  })

  it("flags duplicate references, missing approvals, and reconciliation mismatches", async () => {
    const ledger = await buildCashflowLedger([
      validEvents[0],
      validEvents[1],
      validEvents[2],
      {
        ...validEvents[4],
        reference: MISSING_PAYMENT_REFERENCE,
      },
      {
        ...validEvents[4],
        reference: MISSING_PAYMENT_REFERENCE,
      },
      { ...validEvents[5], amount: 1, reference: MISSING_PAYMENT_REFERENCE },
    ])

    const findings = await validateCashflowLedger(ledger)

    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "DuplicateReference",
        "MissingApproval",
        "ReconciliationMismatch",
      ])
    )
  })
})
