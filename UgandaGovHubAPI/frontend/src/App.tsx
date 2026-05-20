import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/dashboard/components/app-sidebar';
import { SiteHeader } from '@/dashboard/components/site-header';
import DashboardPage from '@/dashboard/page';
import { Catalog, ApiDetail } from './pages/Catalog';
import { UserProvider } from './context/UserContext';

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "260px",
              "--sidebar-width-icon": "56px",
              "--header-height": "48px",
            } as React.CSSProperties
          }
        >
          <AppSidebar collapsible="icon" />
          <SidebarInset className="bg-[#181818] overflow-hidden flex flex-col min-h-screen">
            <SiteHeader />
            <div className="flex flex-1 flex-col overflow-y-auto w-full">
              <Routes>
                <Route path="/" element={<Catalog />} />
                <Route path="/api/:id" element={<ApiDetail />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/health" element={<div className="p-6 text-gray-500">Health checks coming soon...</div>} />
              </Routes>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
