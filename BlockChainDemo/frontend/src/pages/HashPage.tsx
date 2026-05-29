import { useEffect, useState } from "react"
import { Hash } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sha256Hex } from "@/lib/crypto"
import { sampleParcelPayload } from "@/lib/demo-data"

export function HashPage() {
  const [data, setData] = useState(JSON.stringify(sampleParcelPayload, null, 2))
  const [hash, setHash] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    sha256Hex(data)
      .then((digest) => {
        if (!cancelled) {
          setHash(digest)
          setError(null)
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          setError(cause.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [data])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Hash a land-title record</CardTitle>
          <CardDescription>
            A small data change produces a different SHA-256 digest.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            className="hash-input min-h-80"
            value={data}
            onChange={(event) => setData(event.target.value)}
          />
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Hashing failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="size-5" aria-hidden="true" />
            SHA-256 hash
          </CardTitle>
          <CardDescription>
            This hash can be anchored on-chain without exposing the whole record.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input className="hash-input" value={hash} readOnly />
          <p className="text-sm text-muted-foreground">
            In a government trust layer, the MDA can keep the source record in
            its own system while the network stores the proof.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
