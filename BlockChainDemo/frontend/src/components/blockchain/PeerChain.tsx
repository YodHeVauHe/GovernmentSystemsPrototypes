import { Network, RotateCcw, ShieldAlert, Cpu, Server, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type { MdaPeer, ValidationResult } from "@/lib/types"

type PeerChainProps = {
  peer: MdaPeer
  validation: ValidationResult | null
  outOfSync: boolean
  isResyncing?: boolean
  onTamper?: () => void
  onResync?: () => void
}

export function PeerChain({
  peer,
  validation,
  outOfSync,
  isResyncing = false,
  onTamper,
  onResync,
}: PeerChainProps) {
  const latestHash = peer.chain.at(-1)?.hash ?? "No blocks"

  return (
    <Card 
      className={cn(
        "transition-colors",
        outOfSync 
          ? "border-destructive/50 bg-destructive/5" 
          : "hover:border-border",
        isResyncing && "border-primary/50 bg-primary/5"
      )}
    >
      <CardHeader className="gap-2 border-b border-border pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex size-7 items-center justify-center rounded-md border",
              outOfSync 
                ? "bg-destructive/10 border-destructive/20 text-destructive" 
                : "bg-muted border-border text-primary"
            )}>
              <Server className="size-3.5 shrink-0" />
            </div>
            <div className="flex flex-col gap-0.5">
              <CardTitle>{peer.name}</CardTitle>
              <CardDescription>{peer.role}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant={outOfSync ? "destructive" : "secondary"}
              className={cn(
                "border",
                outOfSync 
                  ? "bg-destructive/10 text-destructive border-destructive/20" 
                  : "bg-green-500/10 text-green-400 border-green-500/20"
              )}
            >
              {outOfSync ? "Out of Consensus" : "Synced"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">
            Latest State Hash Proof
          </p>
          <p className="hash-input mt-1.5 break-all text-xs font-medium text-foreground/80">{latestHash}</p>
        </div>

        {isResyncing ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2">
            <Loader2 className="size-6 text-primary animate-spin" />
            <p className="text-xs font-medium text-primary">
              Re-synchronizing peer ledger segments...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              Active Blockchain Segment (Blocks 1 - 5)
            </p>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
              {peer.chain.map((block) => (
                <div
                  key={`${peer.id}-${block.index}`}
                  className={cn(
                    "rounded-md border bg-muted/10 p-2 text-center flex flex-col justify-center items-center gap-1",
                    outOfSync && block.index === 5 
                      ? "border-destructive/30 bg-destructive/5 text-destructive" 
                      : "border-border hover:border-border"
                  )}
                >
                  <p className="text-[10px] font-bold text-muted-foreground/80">
                    B#{block.index}
                  </p>
                  <p className="hash-input text-[10px] truncate w-full text-foreground/75 font-medium">
                    {block.hash.substring(0, 8)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {validation && !validation.valid && (
          <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive flex gap-2 items-center">
            <AlertTriangle className="size-4 shrink-0" />
            <p className="leading-relaxed">
              <strong>Audit Notice:</strong> {validation.reason}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border bg-muted/20 pt-3">
        {onTamper && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onTamper}
            disabled={isResyncing}
            className="cursor-pointer border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <ShieldAlert className="size-4" />
            Tamper Data
          </Button>
        )}
        {onResync && (
          <Button 
            type="button" 
            onClick={onResync}
            disabled={isResyncing}
            className="cursor-pointer"
          >
            <Network className="size-4" />
            Resync Node
          </Button>
        )}
        {!onResync && !onTamper && (
          <Button 
            type="button" 
            variant="ghost" 
            disabled
            className="text-xs text-muted-foreground/60 border border-transparent flex items-center gap-2"
          >
            <CheckCircle2 className="size-4 text-green-500" />
            Node Sync Integrity
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
