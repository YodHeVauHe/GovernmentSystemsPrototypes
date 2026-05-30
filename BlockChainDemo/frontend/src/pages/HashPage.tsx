import { useEffect, useState } from "react"
import { Hash, Copy, Check, FileJson, Lock, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { digestHex, type HashAlgorithm } from "@/lib/crypto"
import { sampleParcelPayload } from "@/lib/demo-data"

const hashOptions = [
  {
    algorithm: "SHA-256",
    bits: 256,
    hexChars: 64,
    note: "Common blockchain fingerprint size for anchoring records.",
  },
  {
    algorithm: "SHA-384",
    bits: 384,
    hexChars: 96,
    note: "Longer digest with a wider collision-resistant output.",
  },
  {
    algorithm: "SHA-512",
    bits: 512,
    hexChars: 128,
    note: "Largest demo digest; useful for showing stronger output length.",
  },
] as const satisfies ReadonlyArray<{
  algorithm: HashAlgorithm
  bits: number
  hexChars: number
  note: string
}>

export function HashPage() {
  const [data, setData] = useState(JSON.stringify(sampleParcelPayload, null, 2))
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256")
  const [hash, setHash] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isHashing, setIsHashing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsHashing(true)

    digestHex(data, algorithm)
      .then((digest) => {
        if (!cancelled) {
          setHash(digest)
          setError(null)
          setTimeout(() => setIsHashing(false), 200)
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          setError(cause.message)
          setIsHashing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [algorithm, data])

  const selectedHash = hashOptions.find((option) => option.algorithm === algorithm) ?? hashOptions[0]

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <FileJson className="size-4 text-primary" />
                Land Registry Record
              </CardTitle>
              <CardDescription>
                Modify the raw parcel telemetry JSON to trigger real-time cryptographic hashing.
              </CardDescription>
            </div>
            {isHashing && (
              <RefreshCw className="size-4 text-primary animate-spin" />
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col gap-3">
          <div className="rounded-md border border-border bg-muted/20 overflow-hidden flex flex-col">
            <div className="bg-muted/50 border-b border-border px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium">parcel_payload.json</span>
              <span>JSON Payload</span>
            </div>
            <div className="relative flex">
              <Textarea
                className="hash-input flex-1 min-h-[300px] whitespace-pre-wrap break-words overflow-x-hidden bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 leading-6 resize-none text-foreground/90"
                spellCheck={false}
                wrap="soft"
                value={data}
                onChange={(event) => setData(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase text-muted-foreground">
              <Lock className="size-3.5 text-primary" />
              <span>{algorithm} Hash Signature</span>
            </div>
            <div className="relative">
              <Textarea
                className="hash-input min-h-20 w-full resize-none break-all bg-background pr-10 text-xs leading-relaxed"
                value={hash}
                readOnly
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={copyToClipboard}
                className="absolute right-1 top-1 text-muted-foreground hover:text-primary hover:bg-accent cursor-pointer"
              >
                {copied ? (
                  <Check className="size-4 text-green-400" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="rounded-md border-destructive/30 bg-destructive/10 text-destructive">
              <AlertTitle className="font-medium">Hashing Interrupted</AlertTitle>
              <AlertDescription className="text-xs font-mono">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col justify-between">
        <div>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2">
              <Hash className="size-4 text-primary" />
              Cryptographic Proof
            </CardTitle>
            <CardDescription>
              Select a digest size and compare how the fingerprint changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-3">
            <div className="rounded-md border border-border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">Hash explanation</span>
                <select
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  value={algorithm}
                  onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}
                >
                  {hashOptions.map((option) => (
                    <option key={option.algorithm} value={option.algorithm}>
                      {option.algorithm}
                    </option>
                  ))}
                </select>
              </div>
              <p className="max-w-prose">
                A hash is one-way: the same payload gives the same digest, but a small edit changes the output.
              </p>
              <p className="mt-2 max-w-prose">
                The browser converts the JSON text into UTF-8 bytes, runs the selected SHA function, and returns a fixed-length fingerprint. The ledger stores this proof instead of the private record.
              </p>
              <div className="hash-input mt-4 rounded-md border border-border bg-background px-3 py-4 text-[11px] leading-6 text-foreground">
                digest = {algorithm}(UTF-8(payload)) {"->"} {selectedHash.bits}-bit / {selectedHash.hexChars} hex chars
              </div>
              <p className="mt-3 max-w-prose">
                Hex is base-16, so each character carries 4 bits. That is why {selectedHash.bits} bits becomes {selectedHash.bits} / 4 = {selectedHash.hexChars} visible hex characters.
              </p>
              <p className="mt-2 max-w-prose">{selectedHash.note}</p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed flex gap-2">
              <Lock className="size-4 shrink-0 mt-0.5 text-primary" />
              <p>
                In a national government trust framework, Ministries keep sensitive owner details in local databases and anchor only this <strong>{algorithm} hash proof</strong> on the ledger. Any tampering instantly changes the proof.
              </p>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  )
}
