import { CheckCircle2, Circle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

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
    <div className="grid gap-3">
      {items.map((item) => {
        const Icon = item.complete ? CheckCircle2 : Circle

        return (
          <Card key={item.label}>
            <CardContent className="flex items-start gap-3 p-4">
              <Icon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <Badge variant={item.complete ? "secondary" : "outline"}>
                    {item.owner}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
