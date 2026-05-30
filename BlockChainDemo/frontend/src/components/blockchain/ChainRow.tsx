import { BlockCard } from "@/components/blockchain/BlockCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Link2, Link2Off, BadgeAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DemoBlock, ValidationResult } from "@/lib/types"

type ChainRowProps = {
  chain: DemoBlock[]
  difficulty: number
  validation: ValidationResult | null
  miningIndex?: number | null
  onDataChange?: (index: number, value: string) => void
  onNonceChange?: (index: number, value: number) => void
  onMineFrom?: (index: number) => void
}

export function ChainRow({
  chain,
  difficulty,
  validation,
  miningIndex = null,
  onDataChange,
  onNonceChange,
  onMineFrom,
}: ChainRowProps) {
  return (
    <div className="flex flex-col gap-5">
      {validation && !validation.valid && (
        <Alert variant="destructive" className="rounded-md border-destructive/30 bg-destructive/10 text-destructive">
          <BadgeAlert className="size-5 shrink-0" />
          <AlertTitle className="font-medium">Ledger Integrity Fractured</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            The blockchain is broken at <strong>Block #{(validation.firstInvalidIndex ?? 0) + 1}</strong>. Reason: <em>{validation.reason}</em>. Later blocks are orphaned and lose their validity.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar">
        {chain.map((block, index) => {
          const isInvalid =
            validation?.firstInvalidIndex !== null &&
            validation?.firstInvalidIndex !== undefined &&
            index >= validation.firstInvalidIndex

          const isThisBlockMining = miningIndex === index

          return (
            <div key={`${block.index}-${index}`} className="flex items-stretch shrink-0">
              {/* Chain Link Connector */}
              {index > 0 && (
                <div className="flex items-center justify-center px-1 shrink-0">
                  <div className={cn(
                    "flex w-10 flex-col items-center justify-center gap-1 text-muted-foreground",
                    isInvalid
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}>
                    {isInvalid ? (
                      <>
                        <Link2Off className="size-4" />
                        <span className="text-[8px] font-medium uppercase">Severed</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="size-4" />
                        <span className="text-[8px] font-medium uppercase">Linked</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <BlockCard
                block={block}
                difficulty={difficulty}
                invalid={isInvalid}
                isMining={isThisBlockMining}
                onDataChange={
                  onDataChange ? (value) => onDataChange(index, value) : undefined
                }
                onNonceChange={
                  onNonceChange ? (value) => onNonceChange(index, value) : undefined
                }
                onMine={onMineFrom ? () => onMineFrom(index) : undefined}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
