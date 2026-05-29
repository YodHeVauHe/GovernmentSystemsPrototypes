import { BlockCard } from "@/components/blockchain/BlockCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { DemoBlock, ValidationResult } from "@/lib/types"

type ChainRowProps = {
  chain: DemoBlock[]
  difficulty: number
  validation: ValidationResult | null
  onDataChange?: (index: number, value: string) => void
  onNonceChange?: (index: number, value: number) => void
  onMineFrom?: (index: number) => void
}

export function ChainRow({
  chain,
  difficulty,
  validation,
  onDataChange,
  onNonceChange,
  onMineFrom,
}: ChainRowProps) {
  return (
    <div className="flex flex-col gap-4">
      {validation && !validation.valid && (
        <Alert variant="destructive">
          <AlertTitle>Chain broken at block #{(validation.firstInvalidIndex ?? 0) + 1}</AlertTitle>
          <AlertDescription>{validation.reason}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {chain.map((block, index) => (
          <BlockCard
            key={`${block.index}-${index}`}
            block={block}
            difficulty={difficulty}
            invalid={
              validation?.firstInvalidIndex !== null &&
              validation?.firstInvalidIndex !== undefined &&
              index >= validation.firstInvalidIndex
            }
            onDataChange={
              onDataChange ? (value) => onDataChange(index, value) : undefined
            }
            onNonceChange={
              onNonceChange ? (value) => onNonceChange(index, value) : undefined
            }
            onMine={onMineFrom ? () => onMineFrom(index) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
