import { useState } from 'react';
import { 
  Home, 
  Upload, 
  Tag, 
  FolderOpen, 
  Library,
  Settings,
  Search,
  X
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { SmartLabelSearch } from '@/components/SmartLabelSearch';
import { AdvancedFilters } from '@/components/AdvancedFilters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Label, PhotoFilters } from '@/types/photo';

const navigation = [
  { title: 'Início', url: '/', icon: Home },
  { title: 'Explorar Biblioteca', url: '/library', icon: Library },
  { title: 'Upload de Fotos', url: '#', icon: Upload, action: 'upload' },
  { title: 'Gestão de Labels', url: '#', icon: Tag, action: 'labels' },
  { title: 'Minhas Coleções', url: '#', icon: FolderOpen, action: 'collections' },
];

interface AppSidebarProps {
  labels?: Label[];
  selectedLabels?: string[];
  onLabelToggle?: (labelId: string) => void;
  onClearFilters?: () => void;
  onUpload?: () => void;
  onManageLabels?: () => void;
  onManageCollections?: () => void;
  showSearch?: boolean;
  // Advanced filters props
  filters?: PhotoFilters;
  onUpdateFilters?: (updates: Partial<PhotoFilters>) => void;
  onToggleFileType?: (fileType: string) => void;
  onToggleMediaType?: (mediaType: string) => void;
}

export function AppSidebar({
  labels = [],
  selectedLabels = [],
  onLabelToggle,
  onClearFilters,
  onUpload,
  onManageLabels,
  onManageCollections,
  showSearch = false,
  filters,
  onUpdateFilters,
  onToggleFileType,
  onToggleMediaType
}: AppSidebarProps) {
  const { open, setOpen } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'upload':
        onUpload?.();
        break;
      case 'labels':
        onManageLabels?.();
        break;
      case 'collections':
        onManageCollections?.();
        break;
    }
  };

  return (
    <Sidebar
      className="border-r border-border bg-sidebar"
      collapsible="icon"
    >
      <SidebarHeader className="p-4 border-b border-border">
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="text-2xl">📷</div>
          {open && (
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">PhotoLabel</h1>
              <p className="text-xs text-sidebar-foreground/60">Organize suas fotos</p>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs">
            {open && 'Navegação'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild
                  className={`${
                    isActive(item.url) 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  } transition-colors`}
                >
                  {item.action ? (
                    <button 
                      className="flex w-full items-center gap-3"
                      onClick={() => handleActionClick(item.action!)}
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </button>
                  ) : (
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  )}
                </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Smart Label Search and Advanced Filters - only show on library page and when not collapsed */}
        {showSearch && open && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs flex items-center gap-2">
              <Search className="h-3 w-3" />
              Pesquisar Labels
            </SidebarGroupLabel>
            <SidebarGroupContent className="space-y-3">
              <div className="px-1">
                <SmartLabelSearch
                  labels={labels}
                  selectedLabels={selectedLabels}
                  onLabelToggle={onLabelToggle}
                  onClearFilters={onClearFilters}
                  compact
                />
              </div>
              
              {/* Applied Labels Chips */}
              {selectedLabels.length > 0 && (
                <div className="px-1">
                  <div className="text-xs text-sidebar-foreground/60 mb-2">Filtros ativos:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedLabels.map((labelId) => {
                      const label = labels.find(l => l.id === labelId);
                      if (!label) return null;
                      
                      return (
                        <Badge
                          key={labelId}
                          variant="secondary"
                          className="text-xs bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80 cursor-pointer flex items-center gap-1"
                          onClick={() => onLabelToggle?.(labelId)}
                        >
                          {label.name}
                          <X className="h-3 w-3" />
                        </Badge>
                      );
                    })}
                  </div>
                  
                  {selectedLabels.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearFilters}
                      className="text-xs mt-2 h-6 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    >
                      Limpar todos
                    </Button>
                  )}
                </div>
              )}

              {/* Advanced Filters */}
              {filters && onUpdateFilters && onToggleFileType && onToggleMediaType && (
                <div className="px-1">
                  <AdvancedFilters
                    filters={filters}
                    onUpdateFilters={onUpdateFilters}
                    onToggleFileType={onToggleFileType}
                    onToggleMediaType={onToggleMediaType}
                  />
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}