import type { LucideIcon } from "lucide-react"
import {
  Blocks,
  Box,
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Landmark className="size-4" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">BlockChainDemo</span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              MDA trust layer
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Concepts</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Concepts">
              <SidebarMenu>
                {conceptPages.map((page) => (
                  <SidebarMenuItem key={page.value}>
                    <SidebarMenuButton
                      type="button"
                      tooltip={page.label}
                      isActive={activePage === page.value}
                      aria-current={activePage === page.value ? "page" : undefined}
                      onClick={() => selectPage(page.value)}
                    >
                      <page.icon aria-hidden="true" />
                      <span>{page.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
