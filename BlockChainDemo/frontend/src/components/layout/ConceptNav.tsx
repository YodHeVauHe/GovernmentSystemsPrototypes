import { TabsList, TabsTrigger } from "@/components/ui/tabs"

export const conceptPages = [
  { value: "hash", label: "Hash" },
  { value: "block", label: "Block" },
  { value: "blockchain", label: "Blockchain" },
  { value: "distributed", label: "Distributed MDAs" },
  { value: "tokens", label: "Tokens / Assets" },
  { value: "land-title", label: "Land Title Use Case" },
] as const

export type ConceptPage = (typeof conceptPages)[number]["value"]

export function ConceptNav() {
  return (
    <TabsList className="justify-start">
      {conceptPages.map((page) => (
        <TabsTrigger key={page.value} value={page.value}>
          {page.label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
