import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/dashboard/components/app-sidebar';
import { SiteHeader } from '@/dashboard/components/site-header';
import DashboardPage from '@/dashboard/page';
import { Catalog, ApiDetail } from './pages/Catalog';
import { AddApiPage } from './pages/AddApiPage';
import { UserProvider } from './context/UserContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from '@/components/ui/sonner';

function RouteLoadingBar() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timeout);
  }, [location.pathname, location.search]);

  if (!loading) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-[2px] bg-[#3ecf8e]/20">
      <div className="h-full w-1/2 animate-pulse bg-[#3ecf8e] shadow-[0_0_18px_rgba(62,207,142,0.8)]" />
    </div>
  );
}

function App() {
  return (
    <UserProvider>
      <NotificationProvider>
        <BrowserRouter>
          <SidebarProvider
            style={
              {
                "--sidebar-width": "224px",
                "--sidebar-width-icon": "56px",
                "--header-height": "48px",
              } as React.CSSProperties
            }
          >
            <AppSidebar collapsible="icon" />
            <SidebarInset className="bg-[#181818] flex flex-col h-dvh overflow-hidden">
              <div className="flex flex-col overflow-hidden w-full h-full">
                <RouteLoadingBar />
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
      </NotificationProvider>
    </UserProvider>
  );
}

export default App;
