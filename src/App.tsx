import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Labels from "./pages/Labels";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import LibraryExplorer from "./pages/LibraryExplorer";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
  const { photos, labels } = useSupabaseData();
  const { 
    filters, 
    filteredPhotos,
    showFavorites,
    updateFilters,
    toggleLabel,
    toggleFileType,
    toggleMediaType,
    toggleFavorites,
    clearFilters 
  } = useAdvancedFilters(photos);

  const showAdvancedSidebar = location.pathname === '/' || location.pathname === '/explore';
  const hideSidebarRoutes = ['/auth'];
  const shouldShowSidebar = !hideSidebarRoutes.includes(location.pathname);

  if (!shouldShowSidebar) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar 
          labels={labels}
          selectedLabels={filters.labels}
          onLabelToggle={toggleLabel}
          onClearFilters={clearFilters}
          onUpload={() => {}}
          onManageLabels={() => {}}
          onManageCollections={() => {}}
          showSearch={showAdvancedSidebar}
          filters={showAdvancedSidebar ? filters : undefined}
          showFavorites={showAdvancedSidebar ? showFavorites : undefined}
          onUpdateFilters={showAdvancedSidebar ? updateFilters : undefined}
          onToggleFileType={showAdvancedSidebar ? toggleFileType : undefined}
          onToggleMediaType={showAdvancedSidebar ? toggleMediaType : undefined}
          onToggleFavorites={showAdvancedSidebar ? toggleFavorites : undefined}
        />
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <LibraryExplorer 
                filters={filters}
                filteredPhotos={filteredPhotos}
                showFavorites={showFavorites}
                updateFilters={updateFilters}
                toggleLabel={toggleLabel}
                toggleFileType={toggleFileType}
                toggleMediaType={toggleMediaType}
                toggleFavorites={toggleFavorites}
                clearFilters={clearFilters}
              />
            </ProtectedRoute>
          } />
          <Route path="/home" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute>
              <Upload />
            </ProtectedRoute>
          } />
          <Route path="/labels" element={
            <ProtectedRoute>
              <Labels />
            </ProtectedRoute>
          } />
          <Route path="/collections" element={
            <ProtectedRoute>
              <Collections />
            </ProtectedRoute>
          } />
          <Route path="/collections/:id" element={
            <ProtectedRoute>
              <CollectionDetail />
            </ProtectedRoute>
          } />
          <Route path="/explore" element={
            <ProtectedRoute>
              <LibraryExplorer 
                filters={filters}
                filteredPhotos={filteredPhotos}
                showFavorites={showFavorites}
                updateFilters={updateFilters}
                toggleLabel={toggleLabel}
                toggleFileType={toggleFileType}
                toggleMediaType={toggleMediaType}
                toggleFavorites={toggleFavorites}
                clearFilters={clearFilters}
              />
            </ProtectedRoute>
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