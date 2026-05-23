import { Separator } from "@/components/ui/separator"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { IconBell, IconSearch, IconUserCircle } from "@tabler/icons-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useUser } from "../../context/UserContext"
import { useNotifications } from "../../context/NotificationContext"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Just now"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRoleLabel(role: string | null) {
  if (!role) return "Public"

  const labels: Record<string, string> = {
    admin: "Admin",
    api_owner: "API Owner",
    developer: "Developer",
    reviewer: "Compliance Reviewer",
  }

  return labels[role] || role
    .split("_")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, role, currentMda } = useUser()
  const { notifications, unreadCount, markAllRead, clearNotifications } = useNotifications()
  const search = searchParams.get("q") || ""
  
  let title = "API Catalog"
  if (location.pathname === "/dashboard") title = "Dashboard"
  else if (location.pathname === "/catalog/add") title = "Add API"
  else if (location.pathname.startsWith("/api/")) title = "API Details"
  else if (location.pathname.startsWith("/docs/")) title = "API Docs"
  else if (location.pathname === "/docs") title = "API Docs"

  const isSearchablePage = location.pathname === "/" || location.pathname === "/docs" || location.pathname === "/dashboard"
  const searchPlaceholder =
    location.pathname === "/docs" ? "Search docs..." :
    location.pathname === "/dashboard" ? "Search dashboard..." :
    "Search catalog..."

  const updatePageSearch = (value: string) => {
    if (!isSearchablePage) {
      navigate({
        pathname: "/",
        search: value.trim() ? `q=${encodeURIComponent(value.trim())}` : "",
      })
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    if (value.trim()) {
      nextParams.set("q", value)
    } else {
      nextParams.delete("q")
    }

    navigate({
      pathname: location.pathname,
      search: nextParams.toString(),
    })
  }

  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between px-4 lg:px-6 bg-[#141414] border-b border-[#2e2e2e] sticky top-0 z-40">
      <div className="flex items-center gap-1.5 text-[14px]">
        <SidebarTrigger className="-ml-1 text-[#8b8b8b] hover:text-white" />
        <Separator
          orientation="vertical"
          className="h-4 bg-[#2e2e2e]"
        />
        <span className="text-[#8b8b8b] hidden sm:inline-block">Uganda GovHub API</span>
        <span className="text-[#444] px-1 hidden sm:inline-block">/</span>
        <span className="text-white font-medium">{title}</span>
      </div>
      
      {/* Persona Switcher & Toolbars */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-[#1c1c1c] border border-[#2e2e2e] px-2.5 py-1 rounded-lg">
          <IconUserCircle className="w-4 h-4 text-[#3ecf8e]" />
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="font-medium text-[#ededed]">
              {user ? formatRoleLabel(role) : "Public"}
            </span>
            <span className="text-[#444] font-mono">|</span>
            <span className="text-[#8b8b8b]">{currentMda?.shortName || "Visitor"}</span>
          </div>
        </div>

        <div className="relative hidden lg:flex items-center">
          <IconSearch className="w-4 h-4 text-[#8b8b8b] absolute left-2.5" />
          <input 
            type="text" 
            value={search}
            onChange={event => updatePageSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-[30px] w-[180px] bg-[#141414] border border-[#2e2e2e] rounded-full pl-8 pr-3 text-[12px] text-white focus:outline-none focus:border-[#444]"
          />
        </div>
        
        <div className="flex items-center gap-2 text-[#8b8b8b]">
          <Popover onOpenChange={open => {
            if (open && unreadCount > 0) markAllRead()
          }}>
            <PopoverTrigger asChild>
              <button className="relative w-7 h-7 rounded-full border border-[#2e2e2e] flex items-center justify-center hover:text-white hover:border-[#444] transition-colors">
                <IconBell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-[#3ecf8e] px-1 text-[10px] leading-4 text-black font-semibold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 border-[#2e2e2e] bg-[#1c1c1c] p-0 text-[#ededed]">
              <div className="flex items-center justify-between border-b border-[#2e2e2e] px-4 py-3">
                <div>
                  <h2 className="text-[13px] font-semibold text-white">Notifications</h2>
                  <p className="text-[11px] text-[#8b8b8b]">{notifications.length} recent events</p>
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="text-[11px] text-[#8b8b8b] hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-[#8b8b8b]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div key={notification.id} className="border-b border-[#2e2e2e] px-4 py-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-medium text-white">{notification.title}</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#8b8b8b]">{notification.message}</p>
                        </div>
                        {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#3ecf8e]" />}
                      </div>
                      <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-[#666]">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  )
}
