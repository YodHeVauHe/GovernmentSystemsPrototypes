import { useEffect, useState } from "react"
import { Blocks, RotateCcw } from "lucide-react"
import { ChainRow } from "@/components/blockchain/ChainRow"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  calculateBlockHash,
  createDemoChain,
  repairChainFrom,
  validateChain,
} from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
  MAX_MINING_NONCE,
  initialLandTitleEvents,
} from "@/lib/demo-data"
import type { DemoBlock, ValidationResult } from "@/lib/types"

export function BlockchainPage() {
  const [chain, setChain] = useState<DemoBlock[]>([])
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [message, setMessage] = useState("Preparing mined land-title chain.")

  useEffect(() => {
    createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY).then((nextChain) => {
      setChain(nextChain)
      setMessage("Five linked land-title events are mined and valid.")
    })
  }, [])

  useEffect(() => {
    if (chain.length === 0) return
    validateChain(chain, DEMO_DIFFICULTY).then(setValidation)
  }, [chain])

  const recalculateFrom = async (index: number, nextChain: DemoBlock[]) => {
    const working = [...nextChain]

    for (let cursor = index; cursor < working.length; cursor += 1) {
      working[cursor] = {
        ...working[cursor],
        previousHash: cursor === 0 ? working[cursor].previousHash : working[cursor - 1].hash,
      }
      working[cursor] = {
        ...working[cursor],
        hash: await calculateBlockHash(working[cursor]),
      }
    }

    setChain(working)
  }

  const updateData = async (index: number, value: string) => {
    const working = chain.map((block, cursor) =>
      cursor === index ? { ...block, data: value } : block
    )
    await recalculateFrom(index, working)
  }

  const updateNonce = async (index: number, nonce: number) => {
    const working = chain.map((block, cursor) =>
      cursor === index ? { ...block, nonce } : block
    )
    await recalculateFrom(index, working)
  }

  const [miningIndex, setMiningIndex] = useState<number | null>(null)

  const mineFrom = async (index: number) => {
    setMiningIndex(index)
    try {
      setChain(
        await repairChainFrom(
          chain,
          index,
          DEMO_DIFFICULTY,
          MAX_MINING_NONCE
        )
      )
    } finally {
      setMiningIndex(null)
    }
  }

  const reset = async () => {
    setChain(await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
          <Blocks className="size-4 text-primary" />
          <span>Cryptographically Chained Audit Ledger</span>
        </div>
        <p>
          In this linked land registry event chain, each block points to the preceding block's hash. <strong>Try editing the data of an earlier block</strong> to see the mathematical link break: the rest of the chain will turn invalid instantly. Click <strong>"Mine Block"</strong> on the broken block to recompute hashes and repair the network.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-medium tracking-normal">Active Event Stream</h3>
        <Button 
          type="button" 
          variant="outline" 
          onClick={reset}
          className="cursor-pointer"
        >
          <RotateCcw className="size-4" />
          Reset Ledgers
        </Button>
      </div>

      <ChainRow
        chain={chain}
        difficulty={DEMO_DIFFICULTY}
        validation={validation}
        miningIndex={miningIndex}
        onDataChange={updateData}
        onNonceChange={updateNonce}
        onMineFrom={mineFrom}
      />
    </div>
  )
}
