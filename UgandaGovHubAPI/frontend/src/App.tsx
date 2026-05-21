import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/dashboard/components/app-sidebar';
import { SiteHeader } from '@/dashboard/components/site-header';
import DashboardPage from '@/dashboard/page';
import { Catalog, ApiDetail } from './pages/Catalog';
import { AddApiPage } from './pages/AddApiPage';
import { UserProvider } from './context/UserContext';
import { Toaster } from '@/components/ui/sonner';

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
          <SidebarInset className="bg-[#181818] flex flex-col h-dvh overflow-hidden">
            <div className="flex flex-col overflow-hidden w-full h-full">
              <SiteHeader />
              <div className="flex-1 min-h-0 overflow-hidden">
                <Routes>
                <Route path="/" element={<Catalog />} />
                <Route path="/catalog/add" element={<AddApiPage />} />
                <Route path="/api/:id" element={<ApiDetail />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                </Routes>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </UserProvider>
  );
}

export default App;
