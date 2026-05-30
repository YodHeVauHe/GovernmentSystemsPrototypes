import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LandTitleEvent, TransferApproval } from "@/lib/types"

type TransactionTableProps = {
  events?: LandTitleEvent[]
  approvals?: TransferApproval[]
}

export function TransactionTable({ events, approvals }: TransactionTableProps) {
  if (approvals) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>MDA</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {approvals.map((approval) => (
            <TableRow key={approval.id}>
              <TableCell className="font-medium">{approval.mda}</TableCell>
              <TableCell>{approval.label}</TableCell>
              <TableCell className="hash-input text-xs text-muted-foreground">
                {approval.reference}
              </TableCell>
              <TableCell>
                <Badge
                  variant={approval.status === "approved" ? "default" : "outline"}
                  className={
                    approval.status === "approved"
                      ? "border-green-500/25 bg-green-500/10 text-green-400"
                      : "border-border bg-muted/20 text-muted-foreground"
                  }
                >
                  {approval.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>MDA</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Timestamp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(events ?? []).map((event) => (
          <TableRow key={event.reference}>
            <TableCell className="font-medium">{event.eventType}</TableCell>
            <TableCell>{event.actorMda}</TableCell>
            <TableCell className="hash-input text-xs text-muted-foreground">
              {event.reference}
            </TableCell>
            <TableCell>{event.timestamp}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
