import { useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import type { ConceptPage } from "@/components/layout/ConceptNav"
import { BlockchainPage } from "@/pages/BlockchainPage"
import { BlockPage } from "@/pages/BlockPage"
import { DistributedPage } from "@/pages/DistributedPage"
import { HashPage } from "@/pages/HashPage"
import { LandTitleUseCasePage } from "@/pages/LandTitleUseCasePage"
import { TokensPage } from "@/pages/TokensPage"

const DEFAULT_PAGE: ConceptPage = "hash"

function renderConceptPage(page: ConceptPage) {
  switch (page) {
    case "hash":
      return <HashPage />
    case "block":
      return <BlockPage />
    case "blockchain":
      return <BlockchainPage />
    case "distributed":
      return <DistributedPage />
    case "tokens":
      return <TokensPage />
    case "land-title":
      return <LandTitleUseCasePage />
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<ConceptPage>(DEFAULT_PAGE)

  return (
    <AppShell activePage={activePage} onPageChange={setActivePage}>
      {renderConceptPage(activePage)}
    </AppShell>
  )
}
