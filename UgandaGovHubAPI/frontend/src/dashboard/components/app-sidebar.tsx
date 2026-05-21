"use client"

import * as React from "react"
import {
  IconCircleCheck,
  IconDashboard,
  IconDatabase,
  IconHelp,
  IconInnerShadowTop,
  IconSettings,
} from "@tabler/icons-react"
import { Link } from "react-router-dom"

import { NavMain } from "@/dashboard/components/nav-main"
import { NavSecondary } from "@/dashboard/components/nav-secondary"
import { NavUser } from "@/dashboard/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin User",
    email: "admin@ict.go.ug",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "API Catalog",
      url: "/",
      icon: IconDatabase,
    },
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    }
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    }
  ],
  documents: [],
}

function SystemHealthIndicator() {
  return (
    <div className="mx-2 mt-auto mb-1 flex h-9 items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#141414] px-2.5 text-[12px] text-[#8b8b8b] group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#3ecf8e]/25 bg-[#3ecf8e]/10 text-[#3ecf8e]">
        <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-[#3ecf8e]/25" />
        <IconCircleCheck className="relative h-4 w-4" stroke={2} />
      </span>
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <div className="truncate text-[10px] font-mono uppercase leading-4 tracking-wider text-[#3ecf8e]">All services online</div>
      </div>
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="group-data-[collapsible=icon]:items-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <IconInnerShadowTop className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Uganda GovHub API</span>
                  <span className="truncate text-xs">Developer Portal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:items-center">
        <NavMain items={data.navMain} />
        <SystemHealthIndicator />
        <NavSecondary items={data.navSecondary} />
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:items-center">
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
