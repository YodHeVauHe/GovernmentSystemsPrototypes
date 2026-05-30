import type { ReactNode } from "react"
import { ConceptNav, type ConceptPage } from "@/components/layout/ConceptNav"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Info } from "lucide-react"

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
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6">
          <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1 size-7 cursor-pointer hover:bg-accent" />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4 bg-border"
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Uganda Government Blockchain Foundation
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-medium tracking-normal text-foreground">
                    Secure Trust Layer
                  </h1>
                  <Badge variant="secondary">MDA network</Badge>
                  <Badge variant="outline">Land registry</Badge>
                </div>
              </div>
            </div>
            <div className="flex max-w-md items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="size-3.5 shrink-0 text-primary" />
              <span>
                <strong className="font-medium text-foreground">Sandbox:</strong> local nodes only; no real government records are mutated.
              </span>
            </div>
          </header>
          <main className="flex-1 w-full">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
