import { useState } from 'react';
import { 
  User, 
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
import { DateFilters } from '@/components/DateFilters';
import { AdvancedFiltersCollapsible } from '@/components/AdvancedFiltersCollapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Label, PhotoFilters } from '@/types/photo';

const navigation = [
  { title: 'Explorar Biblioteca', url: '/', icon: Library },
  { title: 'Upload de Fotos', url: '/upload', icon: Upload },
  { title: 'Gestão de Labels', url: '/labels', icon: Tag },
  { title: 'Minhas Coleções', url: '/collections', icon: FolderOpen },
  { title: 'Perfil do Usuário', url: '/user', icon: User },
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
  showFavorites?: boolean;
  onUpdateFilters?: (updates: Partial<PhotoFilters>) => void;
  onToggleFileType?: (fileType: string) => void;
  onToggleMediaType?: (mediaType: string) => void;
  onToggleFavorites?: () => void;
  photos?: any[];
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
  showFavorites = false,
  onUpdateFilters,
  onToggleFileType,
  onToggleMediaType,
  onToggleFavorites,
  photos = []
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
      <SidebarHeader className="p-4 border-b border-border bg-black">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
            U
          </div>
          {open && (
            <div>
              <h2 className="text-sm font-medium text-white">João</h2>
            </div>
          )}
        </div>
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
                  className={`relative ${
                    isActive(item.url) 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  } transition-all duration-200`}
                >
                  <NavLink 
                    to={item.url} 
                    className={`flex items-center gap-3 ${
                      isActive(item.url) 
                        ? 'border-l-4 border-l-sidebar-primary pl-3' 
                        : 'pl-4'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${
                      isActive(item.url) ? 'text-sidebar-primary' : ''
                    }`} />
                    {open && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Smart Label Search and Advanced Filters - only show on main library page and when not collapsed */}
        {showSearch && open && (currentPath === '/' || currentPath === '/explore') && (
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

              {/* Date Filters */}
              {filters && onUpdateFilters && photos.length > 0 && (
                <div className="px-1">
                  <DateFilters
                    photos={photos}
                    filters={filters}
                    onUpdateFilters={onUpdateFilters}
                  />
                </div>
              )}

              {/* Advanced Filters - Now collapsible */}
              {filters && onUpdateFilters && onToggleFavorites && (
                <div className="px-1">
                  <AdvancedFiltersCollapsible
                    filters={filters}
                    showFavorites={showFavorites}
                    onUpdateFilters={onUpdateFilters}
                    onToggleFavorites={onToggleFavorites}
                  />
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Total arquivos após filtros - só mostra na biblioteca principal */}
        {open && (currentPath === '/' || currentPath === '/explore') && photos.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs">
              Resultados dos Filtros
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-1 py-2">
                <div className="bg-sidebar-accent/30 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-sidebar-accent-foreground">
                    {photos.length}
                  </div>
                  <div className="text-xs text-sidebar-foreground/60">
                    arquivo{photos.length !== 1 ? 's' : ''} encontrado{photos.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}