import { useEffect, useState } from "react"
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

  const mineFrom = async (index: number) => {
    setChain(
      await repairChainFrom(
        chain,
        index,
        DEMO_DIFFICULTY,
        MAX_MINING_NONCE
      )
    )
  }

  const reset = async () => {
    setChain(await createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY))
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>Linked land-registry events</AlertTitle>
        <AlertDescription>
          {message} Edit an earlier event to see later blocks lose validity,
          then mine from the changed block to repair the chain.
        </AlertDescription>
      </Alert>
      <div>
        <Button type="button" variant="outline" onClick={reset}>
          Reset chain
        </Button>
      </div>
      <ChainRow
        chain={chain}
        difficulty={DEMO_DIFFICULTY}
        validation={validation}
        onDataChange={updateData}
        onNonceChange={updateNonce}
        onMineFrom={mineFrom}
      />
    </div>
  )
}
