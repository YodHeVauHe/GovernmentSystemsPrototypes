import { describe, expect, it } from "vitest"
import {
  calculateBlockHash,
  createDemoChain,
  findConsensus,
  getMissingTransferApprovals,
  isBlockMined,
  mineBlock,
  repairChainFrom,
  validateChain,
} from "./blockchain"
import { canonicalize, sha256Hex } from "./crypto"
import {
  DEMO_DIFFICULTY,
  MAX_MINING_NONCE,
  initialLandTitleEvents,
  requiredTransferApprovals,
} from "./demo-data"
import type { DemoBlock, MdaPeer } from "./types"
import type { LandTitleEvent } from "./types"

describe("crypto helpers", () => {
  it("canonicalizes object keys deterministically", () => {
    const left = canonicalize({
      titleNumber: "TITLE-KLA-2026-000184",
      details: { b: "two", a: "one" },
    })
    const right = canonicalize({
      details: { a: "one", b: "two" },
      titleNumber: "TITLE-KLA-2026-000184",
    })

    expect(left).toBe(right)
  })

  it("produces different hashes when land-title data changes", async () => {
    const original = await sha256Hex({
      titleNumber: "TITLE-KLA-2026-000184",
      parcelId: "PARCEL-KCCA-CEN-12-0441",
    })
    const edited = await sha256Hex({
      titleNumber: "TITLE-KLA-2026-000184",
      parcelId: "PARCEL-KCCA-CEN-12-0999",
    })

    expect(original).not.toBe(edited)
    expect(original).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe("blockchain core", () => {
  it("mines a block that satisfies the demo difficulty", async () => {
    const block: DemoBlock = {
      index: 1,
      nonce: 0,
      previousHash:
        "0000000000000000000000000000000000000000000000000000000000000000",
      hash: "",
      data: "Ministry of Lands issued TITLE-KLA-2026-000184",
    }

    const mined = await mineBlock(block, DEMO_DIFFICULTY, MAX_MINING_NONCE)

    expect(isBlockMined(mined.hash, DEMO_DIFFICULTY)).toBe(true)
    expect(mined.nonce).toBeGreaterThanOrEqual(0)
    await expect(calculateBlockHash(mined)).resolves.toBe(mined.hash)
  })

  it("validates a mined chain and pinpoints the first tampered block", async () => {
    const chain = await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY)
    const validBeforeTamper = await validateChain(chain, DEMO_DIFFICULTY)

    const tampered = chain.map((block, index) =>
      index === 1
        ? {
            ...block,
            data: {
              ...(block.data as LandTitleEvent),
              details: {
                ...(block.data as LandTitleEvent).details,
                caveatStatus: "Removed without authorization",
              },
            },
          }
        : block
    )
    const validAfterTamper = await validateChain(tampered, DEMO_DIFFICULTY)

    expect(validBeforeTamper.valid).toBe(true)
    expect(validAfterTamper.valid).toBe(false)
    expect(validAfterTamper.firstInvalidIndex).toBe(1)
  })

  it("repairs a chain from the changed block forward", async () => {
    const chain = await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY)
    const edited = chain.map((block, index) =>
      index === 2
        ? {
            ...block,
            data: {
              ...(block.data as LandTitleEvent),
              details: {
                ...(block.data as LandTitleEvent).details,
                assessedAmount: "UGX 3,840,000",
              },
            },
          }
        : block
    )

    const repaired = await repairChainFrom(
      edited,
      2,
      DEMO_DIFFICULTY,
      MAX_MINING_NONCE
    )
    const validation = await validateChain(repaired, DEMO_DIFFICULTY)

    expect(validation.valid).toBe(true)
    expect(repaired[3].previousHash).toBe(repaired[2].hash)
  })

  it("detects the majority-valid MDA peer chain", async () => {
    const chain = await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY)
    const tampered = chain.map((block, index) =>
      index === 4
        ? {
            ...block,
            data: {
              ...(block.data as LandTitleEvent),
              details: {
                ...(block.data as LandTitleEvent).details,
                newOwnerReference: "OWNER-REF-FAKE",
              },
            },
          }
        : block
    )
    const peers: MdaPeer[] = [
      { id: "molhud", name: "Ministry of Lands", role: "Title authority", chain },
      { id: "nira", name: "NIRA", role: "Identity verifier", chain },
      { id: "ura", name: "URA", role: "Stamp duty authority", chain: tampered },
    ]

    const consensus = await findConsensus(peers, DEMO_DIFFICULTY)

    expect(consensus.majorityHash).toBe(chain.at(-1)?.hash)
    expect(consensus.outOfSyncPeerIds).toEqual(["ura"])
  })

  it("reports missing transfer approvals before a title transfer can be mined", () => {
    const missing = getMissingTransferApprovals([
      requiredTransferApprovals[0],
      requiredTransferApprovals[2],
    ])

    expect(missing).toEqual([
      "URA stamp duty clearance",
      "Local government land office clearance",
    ])
  })
})
