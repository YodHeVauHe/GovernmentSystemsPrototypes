import { AppShell } from "@/components/layout/AppShell"
import { ConceptNav } from "@/components/layout/ConceptNav"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BlockchainPage } from "@/pages/BlockchainPage"
import { BlockPage } from "@/pages/BlockPage"
import { DistributedPage } from "@/pages/DistributedPage"
import { HashPage } from "@/pages/HashPage"
import { LandTitleUseCasePage } from "@/pages/LandTitleUseCasePage"
import { TokensPage } from "@/pages/TokensPage"

export default function App() {
  return (
    <AppShell>
      <Tabs defaultValue="hash" className="flex flex-col gap-2">
        <ConceptNav />
        <TabsContent value="hash">
          <HashPage />
        </TabsContent>
        <TabsContent value="block">
          <BlockPage />
        </TabsContent>
        <TabsContent value="blockchain">
          <BlockchainPage />
        </TabsContent>
        <TabsContent value="distributed">
          <DistributedPage />
        </TabsContent>
        <TabsContent value="tokens">
          <TokensPage />
        </TabsContent>
        <TabsContent value="land-title">
          <LandTitleUseCasePage />
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
