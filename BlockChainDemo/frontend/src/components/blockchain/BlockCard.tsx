import { Pickaxe, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { isBlockMined } from "@/lib/blockchain"
import { cn } from "@/lib/utils"
import type { DemoBlock } from "@/lib/types"

type BlockCardProps = {
  block: DemoBlock
  difficulty: number
  invalid?: boolean
  compact?: boolean
  onDataChange?: (value: string) => void
  onNonceChange?: (value: number) => void
  onMine?: () => void
  onReset?: () => void
}

export function BlockCard({
  block,
  difficulty,
  invalid = false,
  compact = false,
  onDataChange,
  onNonceChange,
  onMine,
  onReset,
}: BlockCardProps) {
  const mined = isBlockMined(block.hash, difficulty)
  const status = invalid || !mined ? "Invalid" : "Valid"
  const dataText =
    typeof block.data === "string"
      ? block.data
      : JSON.stringify(block.data, null, 2)

  return (
    <Card
      className={cn(
        "min-w-80 transition-colors",
        invalid || !mined ? "border-destructive/50 bg-destructive/5" : "bg-card"
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Block #{block.index}</CardTitle>
            <CardDescription>
              Nonce, data, previous hash, and current hash.
            </CardDescription>
          </div>
          <Badge variant={invalid || !mined ? "destructive" : "default"}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Nonce
          <Input
            className="hash-input"
            type="number"
            value={block.nonce}
            onChange={(event) => onNonceChange?.(Number(event.target.value))}
          />
        </label>
        {!compact && (
          <label className="flex flex-col gap-2 text-sm font-medium">
            Data
            <Textarea
              className="hash-input min-h-44 resize-y"
              value={dataText}
              onChange={(event) => onDataChange?.(event.target.value)}
            />
          </label>
        )}
        <label className="flex flex-col gap-2 text-sm font-medium">
          Previous
          <Input className="hash-input" value={block.previousHash} readOnly />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Hash
          <Input className="hash-input" value={block.hash} readOnly />
        </label>
      </CardContent>
      {(onMine || onReset) && (
        <CardFooter className="flex flex-wrap gap-2">
          {onMine && (
            <Button type="button" onClick={onMine}>
              <Pickaxe data-icon="inline-start" />
              Mine
            </Button>
          )}
          {onReset && (
            <Button type="button" variant="outline" onClick={onReset}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
