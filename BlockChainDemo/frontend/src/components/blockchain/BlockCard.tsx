import { Pickaxe, RotateCcw, Cpu, ShieldCheck, BadgeAlert, RefreshCw } from "lucide-react"
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
  isMining?: boolean
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
  isMining = false,
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
        "min-w-72 transition-colors",
        invalid || !mined 
          ? "border-destructive/50 bg-destructive/5" 
          : "hover:border-border",
        isMining && "border-primary/50 bg-primary/5"
      )}
    >
      <CardHeader className="gap-2 border-b border-border pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex size-7 items-center justify-center rounded-md border",
              invalid || !mined 
                ? "bg-destructive/10 border-destructive/20 text-destructive" 
                : "bg-muted border-border text-primary"
            )}>
              <Cpu className="size-3.5 shrink-0" />
            </div>
            <div className="flex flex-col gap-0.5">
              <CardTitle>Block #{block.index}</CardTitle>
              <CardDescription>
                Ledger validation node checkpoint
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={invalid || !mined ? "destructive" : "default"}
            className={cn(
              "border",
              invalid || !mined 
                ? "bg-destructive/10 text-destructive border-destructive/25" 
                : "bg-green-500/10 text-green-400 border-green-500/25"
            )}
          >
            {invalid || !mined ? (
              <span className="flex items-center gap-1">
                <BadgeAlert className="size-3" />
                {status}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3" />
                {status}
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-4">
        <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
          Nonce (Proof Constraint)
          <Input
            className="hash-input mt-1"
            type="number"
            disabled={isMining}
            value={block.nonce}
            onChange={(event) => onNonceChange?.(Number(event.target.value))}
          />
        </label>
        
        {!compact && (
          <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
            Block Records Payload
            <Textarea
              className="hash-input mt-1 min-h-28 resize-y leading-relaxed"
              disabled={isMining}
              value={dataText}
              onChange={(event) => onDataChange?.(event.target.value)}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
          Parent State Hash (Previous)
          <Input 
            className="hash-input mt-1 cursor-not-allowed select-none text-muted-foreground" 
            value={block.previousHash} 
            readOnly 
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
          Cryptographic Block Hash
          <Input 
            className={cn(
              "hash-input mt-1 cursor-not-allowed select-none font-medium",
              invalid || !mined 
                ? "bg-destructive/5 border-destructive/20 text-destructive" 
                : "bg-green-500/5 border-green-500/20 text-green-400"
            )}
            value={block.hash} 
            readOnly 
          />
        </label>
      </CardContent>

      {(onMine || onReset) && (
        <CardFooter className="flex flex-wrap gap-2 border-t border-border bg-muted/20 pt-3">
          {onMine && (
            <Button 
              type="button" 
              onClick={onMine}
              disabled={isMining}
              className="cursor-pointer"
            >
              {isMining ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Pickaxe className="size-4" />
              )}
              {isMining ? "Mining Node..." : "Mine Block"}
            </Button>
          )}
          {onReset && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onReset}
              disabled={isMining}
              className="cursor-pointer"
            >
              <RotateCcw className="size-4" />
              Reset State
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
