import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Labels from "./pages/Labels";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import UserPage from "./pages/User";
import DriveSettingsPage from "./pages/DriveSettingsPage";
import GoogleDrive from "./pages/GoogleDrive";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import { RequireAuth } from "./components/RequireAuth";

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Carregando...
          </h3>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  

  const showAdvancedSidebar = location.pathname === '/' || location.pathname === '/explore';
  const hideSidebarRoutes = ['/auth', '/login'];
  const shouldShowSidebar = !hideSidebarRoutes.includes(location.pathname);

  if (!shouldShowSidebar) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={
          <RequireAuth>
            <Navigate to="/" replace />
          </RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar 
          onUpload={() => {}}
          onManageLabels={() => {}}
          onManageCollections={() => {}}
        />
        <Routes>
          <Route path="/" element={
            <RequireAuth>
              <Index />
            </RequireAuth>
          } />
          <Route path="/app" element={
            <RequireAuth>
              <Navigate to="/" replace />
            </RequireAuth>
          } />
          <Route path="/upload" element={
            <RequireAuth>
              <Upload />
            </RequireAuth>
          } />
          <Route path="/labels" element={
            <RequireAuth>
              <Labels />
            </RequireAuth>
          } />
          <Route path="/collections" element={
            <RequireAuth>
              <Collections />
            </RequireAuth>
          } />
          <Route path="/collections/:id" element={
            <RequireAuth>
              <CollectionDetail />
            </RequireAuth>
          } />
          <Route path="/user" element={
            <RequireAuth>
              <UserPage />
            </RequireAuth>
          } />
          <Route path="/settings/drive" element={
            <RequireAuth>
              <GoogleDrive />
            </RequireAuth>
          } />
          <Route path="/drive" element={
            <RequireAuth>
              <GoogleDrive />
            </RequireAuth>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;