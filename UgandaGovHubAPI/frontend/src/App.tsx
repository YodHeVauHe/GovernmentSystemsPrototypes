import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/dashboard/components/app-sidebar';
import { SiteHeader } from '@/dashboard/components/site-header';
import DashboardPage from '@/dashboard/page';
import { Catalog, ApiDetail } from './pages/Catalog';
import { AddApiPage } from './pages/AddApiPage';
import { UserProvider, useUser } from './context/UserContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from '@/components/ui/sonner';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AccountStatusPage } from './pages/AccountStatusPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { DocsPage } from './pages/DocsPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { NotFoundPage } from './pages/NotFoundPage';

const authRoutes = ['/login', '/signup', '/account-status'];
const knownRoutes = [
  '/',
  '/catalog/add',
  '/dashboard',
  '/account/settings',
  '/docs',
];

function isKnownAppRoute(pathname: string) {
  return knownRoutes.includes(pathname) || pathname.startsWith('/docs/') || pathname.startsWith('/api/');
}

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isApproved } = useUser();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-sm text-[#8b8b8b]">Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isApproved) {
    return <Navigate to="/account-status" replace />;
  }
  return children;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useUser();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-sm text-[#8b8b8b]">Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function AppShell() {
  const location = useLocation();
  const { loading, isAuthenticated, isApproved } = useUser();
  const authPage = authRoutes.includes(location.pathname);
  const publicDocsPage = location.pathname === '/docs' || location.pathname.startsWith('/docs/');
  const knownAppRoute = isKnownAppRoute(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(!publicDocsPage);

  useEffect(() => {
    if (publicDocsPage) {
      setSidebarOpen(false);
    }
  }, [publicDocsPage]);

  if (authPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/account-status" element={<AccountStatusPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-[#181818] text-sm text-[#8b8b8b]">Loading...</div>;
  }

  if (!isAuthenticated && knownAppRoute && !publicDocsPage) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isApproved && knownAppRoute && location.pathname !== "/account/settings" && !publicDocsPage) {
    return <Navigate to="/account-status" replace />;
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
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
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/docs/:apiId" element={<ApiDocsPage />} />
              <Route path="/catalog/add" element={<ProtectedRoute><AddApiPage /></ProtectedRoute>} />
              <Route path="/api/:id" element={<ApiDetail />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/account/settings" element={<AuthenticatedRoute><AccountSettingsPage /></AuthenticatedRoute>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <UserProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </NotificationProvider>
    </UserProvider>
  );
}

export default App;
