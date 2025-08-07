import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Labels from "./pages/Labels";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import LibraryExplorer from "./pages/LibraryExplorer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const { photos, labels } = useSupabaseData();
  const { 
    filters, 
    updateFilters,
    toggleLabel,
    toggleFileType,
    toggleMediaType,
    clearFilters 
  } = useAdvancedFilters(photos);

  const showAdvancedSidebar = location.pathname === '/explore' || location.pathname === '/library';

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
          onUpdateFilters={showAdvancedSidebar ? updateFilters : undefined}
          onToggleFileType={showAdvancedSidebar ? toggleFileType : undefined}
          onToggleMediaType={showAdvancedSidebar ? toggleMediaType : undefined}
        />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/collections/:id" element={<CollectionDetail />} />
          <Route path="/library" element={<LibraryExplorer />} />
          <Route path="/explore" element={<LibraryExplorer />} />
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
