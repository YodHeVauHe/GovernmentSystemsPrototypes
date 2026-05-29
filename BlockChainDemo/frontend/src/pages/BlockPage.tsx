import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BlockCard } from "@/components/blockchain/BlockCard"
import { calculateBlockHash, mineBlock } from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
  GENESIS_HASH,
  MAX_MINING_NONCE,
} from "@/lib/demo-data"
import type { DemoBlock } from "@/lib/types"

const initialBlock: DemoBlock = {
  index: 1,
  nonce: 0,
  previousHash: GENESIS_HASH,
  hash: "",
  data: "Ministry of Lands verifies TITLE-KLA-2026-000184 for PARCEL-KCCA-CEN-12-0441",
}

export function BlockPage() {
  const [block, setBlock] = useState<DemoBlock>(initialBlock)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    calculateBlockHash(block)
      .then((hash) => {
        if (!cancelled) {
          setBlock((current) => ({ ...current, hash }))
          setError(null)
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })

    return () => {
      cancelled = true
    }
    // Recalculate only when the editable block inputs change.
  }, [block.index, block.nonce, block.previousHash, block.data])

  const mine = async () => {
    setError(null)
    try {
      setBlock(await mineBlock(block, DEMO_DIFFICULTY, MAX_MINING_NONCE))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mining failed")
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Block error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <BlockCard
        block={block}
        difficulty={DEMO_DIFFICULTY}
        onDataChange={(value) => setBlock((current) => ({ ...current, data: value }))}
        onNonceChange={(nonce) => setBlock((current) => ({ ...current, nonce }))}
        onMine={mine}
        onReset={() => setBlock(initialBlock)}
      />
    </div>
  )
}
