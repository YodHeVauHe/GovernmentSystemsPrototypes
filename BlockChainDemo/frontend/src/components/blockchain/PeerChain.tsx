import { Network, RotateCcw, ShieldAlert } from "lucide-react"
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
import type { MdaPeer, ValidationResult } from "@/lib/types"

type PeerChainProps = {
  peer: MdaPeer
  validation: ValidationResult | null
  outOfSync: boolean
  onTamper?: () => void
  onResync?: () => void
}

export function PeerChain({
  peer,
  validation,
  outOfSync,
  onTamper,
  onResync,
}: PeerChainProps) {
  const latestHash = peer.chain.at(-1)?.hash ?? "No blocks"

  return (
    <Card className={outOfSync ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{peer.name}</CardTitle>
            <CardDescription>{peer.role}</CardDescription>
          </div>
          <Badge variant={outOfSync ? "destructive" : "secondary"}>
            {outOfSync ? "Out of sync" : "Consensus"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Latest chain hash
          </p>
          <p className="hash-input mt-2 break-all text-xs">{latestHash}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          {peer.chain.map((block) => (
            <div
              key={`${peer.id}-${block.index}`}
              className="rounded-md border bg-background p-2"
            >
              <p className="text-xs font-medium text-muted-foreground">
                Block {block.index}
              </p>
              <p className="hash-input mt-1 truncate text-xs">{block.hash}</p>
            </div>
          ))}
        </div>
        {validation && !validation.valid && (
          <p className="text-sm text-destructive">{validation.reason}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {onTamper && (
          <Button type="button" variant="outline" onClick={onTamper}>
            <ShieldAlert data-icon="inline-start" />
            Tamper
          </Button>
        )}
        {onResync && (
          <Button type="button" onClick={onResync}>
            <Network data-icon="inline-start" />
            Resync
          </Button>
        )}
        <Button type="button" variant="ghost" disabled>
          <RotateCcw data-icon="inline-start" />
          Peer copy
        </Button>
      </CardFooter>
    </Card>
  )
}
