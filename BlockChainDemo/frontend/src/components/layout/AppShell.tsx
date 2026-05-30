import type { ReactNode } from "react"
import { ConceptNav, type ConceptPage } from "@/components/layout/ConceptNav"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type AppShellProps = {
  activePage: ConceptPage
  children: ReactNode
  onPageChange: (page: ConceptPage) => void
}

export function AppShell({ activePage, children, onPageChange }: AppShellProps) {
  return (
    <SidebarProvider>
      <ConceptNav activePage={activePage} onPageChange={onPageChange} />
      <SidebarInset className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4"
              />
              <span>Concept navigation</span>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex max-w-3xl flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Permissioned MDA Network</Badge>
                  <Badge variant="outline">Land Title Prototype</Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Uganda Government Blockchain Foundation
                  </p>
                  <h1 className="text-3xl font-semibold tracking-normal">
                    BlockChainDemo
                  </h1>
                </div>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                Browser-only demo. No live government records.
              </div>
            </div>
            <Separator />
          </header>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
