import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BlockCard } from "@/components/blockchain/BlockCard"
import { calculateBlockHash, mineBlock } from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
  GENESIS_HASH,
  LAND_TITLE_ASSET_ID,
  MAX_MINING_NONCE,
} from "@/lib/demo-data"
import type { DemoBlock } from "@/lib/types"
import { Cpu } from "lucide-react"

const initialBlock: DemoBlock = {
  index: 1,
  nonce: 0,
  previousHash: GENESIS_HASH,
  hash: "",
  data: `Ministry of Lands verifies TITLE-KLA-2026-000184 for ${LAND_TITLE_ASSET_ID}`,
}

export function BlockPage() {
  const [block, setBlock] = useState<DemoBlock>(initialBlock)
  const [error, setError] = useState<string | null>(null)
  const [isMining, setIsMining] = useState(false)

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
    setIsMining(true)
    try {
      const minedResult = await mineBlock(block, DEMO_DIFFICULTY, MAX_MINING_NONCE)
      setBlock(minedResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mining failed")
    } finally {
      setIsMining(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="rounded-md border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
          <Cpu className="size-4 text-primary" />
          <span>Proof-of-Work Verification</span>
        </div>
        <p>
          In a blockchain ledger, blocks lock their payload cryptographically. To register a block on the ledger, a node must complete a <strong>Proof-of-Work</strong> puzzle. This means finding a "nonce" value that yields a block hash starting with a required number of zeroes (based on difficulty). Click "Mine Block" to witness a simulated GPU miner solve the puzzle.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-md border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTitle className="font-medium">Ledger Integrity Interrupted</AlertTitle>
          <AlertDescription className="text-xs font-mono">{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="mx-auto w-full md:max-w-xl">
        <BlockCard
          block={block}
          difficulty={DEMO_DIFFICULTY}
          isMining={isMining}
          onDataChange={(value) => setBlock((current) => ({ ...current, data: value }))}
          onNonceChange={(nonce) => setBlock((current) => ({ ...current, nonce }))}
          onMine={mine}
          onReset={() => setBlock(initialBlock)}
        />
      </div>
    </div>
  )
}
