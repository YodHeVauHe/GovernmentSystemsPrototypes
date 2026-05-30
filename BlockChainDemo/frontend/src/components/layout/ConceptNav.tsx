import type { LucideIcon } from "lucide-react"
import {
  Blocks,
  Box,
  CircleDollarSign,
  Fingerprint,
  Landmark,
  Network,
  ShieldCheck,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export const conceptPages = [
  {
    value: "hash",
    label: "Hash",
    icon: Fingerprint,
  },
  {
    value: "block",
    label: "Block",
    icon: Box,
  },
  {
    value: "blockchain",
    label: "Blockchain",
    icon: Blocks,
  },
  {
    value: "distributed",
    label: "Distributed MDAs",
    icon: Network,
  },
  {
    value: "tokens",
    label: "Tokens / Assets",
    icon: ShieldCheck,
  },
  {
    value: "land-title",
    label: "Land Title Use Case",
    icon: Landmark,
  },
  {
    value: "cashflow",
    label: "MDA Cashflow",
    icon: CircleDollarSign,
  },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  icon: LucideIcon
}>

export type ConceptPage = (typeof conceptPages)[number]["value"]

type ConceptNavProps = {
  activePage: ConceptPage
  onPageChange: (page: ConceptPage) => void
}

export function ConceptNav({ activePage, onPageChange }: ConceptNavProps) {
  const { isMobile, setOpenMobile } = useSidebar()

  const selectPage = (page: ConceptPage) => {
    onPageChange(page)

    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border py-3">
        <div className="flex items-center gap-2 px-3 py-1">
          <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-card">
            <img
              src="/block-icon.svg"
              alt=""
              aria-hidden="true"
              className="size-full"
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[10px] uppercase text-muted-foreground">Uganda National</span>
            <span className="truncate text-sm font-medium tracking-normal text-foreground">
              BlockChainDemo
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-medium uppercase text-muted-foreground">
            Core Modules
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1.5">
            <nav aria-label="Concepts">
              <SidebarMenu className="gap-1">
                {conceptPages.map((page) => {
                  const isActive = activePage === page.value
                  return (
                    <SidebarMenuItem key={page.value}>
                      <SidebarMenuButton
                        type="button"
                        tooltip={page.label}
                        isActive={isActive}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => selectPage(page.value)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-[13px] font-medium transition-colors cursor-pointer",
                          isActive
                            ? "bg-sidebar-accent text-foreground border-sidebar-border"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border-transparent"
                        )}
                      >
                        <page.icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                        <span>{page.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
