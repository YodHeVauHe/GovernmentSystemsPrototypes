import { CheckCircle2, Circle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type TimelineItem = {
  label: string
  owner: string
  detail: string
  complete: boolean
}

type UseCaseTimelineProps = {
  items: TimelineItem[]
}

export function UseCaseTimeline({ items }: UseCaseTimelineProps) {
  return (
    <div className="relative pl-7 flex flex-col gap-3">
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const Icon = item.complete ? CheckCircle2 : (isLast ? AlertCircle : Circle)

        return (
          <div key={item.label} className="relative group">
            <div className={cn(
              "absolute -left-[27px] top-3 z-10 flex size-5 items-center justify-center rounded-full border bg-card transition-colors",
              item.complete
                ? "border-green-500/30 text-green-400"
                : "border-border text-muted-foreground/50"
            )}>
              <Icon className="size-3.5 shrink-0" />
            </div>

            <Card className={cn(
              "transition-colors",
              item.complete 
                ? "border-green-500/20 bg-green-500/5" 
                : "hover:border-border/80 text-muted-foreground/80 opacity-70"
            )}>
              <CardContent className="flex items-start gap-3 p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn(
                      "text-sm font-medium tracking-normal",
                      item.complete ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {item.label}
                    </p>
                    <Badge 
                      variant={item.complete ? "secondary" : "outline"}
                      className={cn(
                        "border",
                        item.complete
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "border-border/80 text-muted-foreground/60"
                      )}
                    >
                      {item.owner}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/75 leading-relaxed">{item.detail}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
