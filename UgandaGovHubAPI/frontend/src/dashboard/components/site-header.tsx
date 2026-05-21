import { Separator } from "@/components/ui/separator"
import { useLocation } from "react-router-dom"
import { IconSearch, IconHelp, IconBell, IconUserCircle } from "@tabler/icons-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useUser, type UserRole } from "../../context/UserContext"

export function SiteHeader() {
  const location = useLocation()
  const { role, mdaId, setRole, setMdaId, mdas } = useUser()
  
  let title = "API Catalog"
  if (location.pathname === "/dashboard") title = "Dashboard"
  else if (location.pathname === "/health") title = "Health & Status"
  else if (location.pathname === "/catalog/add") title = "Add API"
  else if (location.pathname.startsWith("/api/")) title = "API Details"

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
        {/* Persona Switcher Container */}
        <div className="flex items-center gap-2 bg-[#1c1c1c] border border-[#2e2e2e] px-2.5 py-1 rounded-lg">
          <IconUserCircle className="w-4 h-4 text-[#3ecf8e]" />
          
          <div className="flex items-center gap-1.5 text-[12px]">
            {/* Role Select */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-transparent border-none text-[#ededed] font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="developer" className="bg-[#1c1c1c] text-white">Developer</option>
              <option value="api_owner" className="bg-[#1c1c1c] text-white">API Owner</option>
              <option value="admin" className="bg-[#1c1c1c] text-white">Platform Admin</option>
              <option value="reviewer" className="bg-[#1c1c1c] text-white">Compliance Reviewer</option>
            </select>
            
            {(role === 'developer' || role === 'api_owner') && (
              <>
                <span className="text-[#444] font-mono">|</span>
                {/* MDA Select */}
                <select
                  value={mdaId}
                  onChange={(e) => setMdaId(e.target.value)}
                  className="bg-transparent border-none text-[#8b8b8b] focus:outline-none cursor-pointer"
                >
                  {mdas.map(mda => (
                    <option key={mda.id} value={mda.id} className="bg-[#1c1c1c] text-white">
                      {mda.shortName}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="relative hidden lg:flex items-center">
          <IconSearch className="w-4 h-4 text-[#8b8b8b] absolute left-2.5" />
          <input 
            type="text" 
            placeholder="Search... Ctrl K" 
            className="h-[30px] w-[180px] bg-[#141414] border border-[#2e2e2e] rounded-full pl-8 pr-3 text-[12px] text-white focus:outline-none focus:border-[#444]"
          />
        </div>
        
        <div className="flex items-center gap-2 text-[#8b8b8b]">
          <button className="w-7 h-7 rounded-full border border-[#2e2e2e] flex items-center justify-center hover:text-white hover:border-[#444] transition-colors">
            <IconHelp className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 rounded-full border border-[#2e2e2e] flex items-center justify-center hover:text-white hover:border-[#444] transition-colors">
            <IconBell className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
