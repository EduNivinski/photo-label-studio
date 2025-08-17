import { useState } from 'react';
import { Filter, Grid3X3, List, ChevronDown, Tag, Trash2, X, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActionsDropdown } from './ActionsDropdown';

interface EnhancedHeaderProps {
  currentlyShowing: number;
  totalItems: number;
  unlabeledCount: number;
  showUnlabeledFilter: boolean;
  itemsPerPage: number;
  viewMode: 'grid' | 'list';
  onToggleUnlabeled: () => void;
  onCreateLabel: () => void;
  onUpload: () => void;
  onChangeItemsPerPage: (value: number) => void;
  onToggleView: () => void;
  onToggleFilters?: () => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  // Selection actions
  selectedCount?: number;
  onManageLabels?: () => void;
  onDeleteSelected?: () => void;
  onClearSelection?: () => void;
  onCreateCollection?: () => void;
}

export function EnhancedHeader({
  currentlyShowing,
  totalItems,
  unlabeledCount,
  showUnlabeledFilter,
  itemsPerPage,
  viewMode,
  onToggleUnlabeled,
  onCreateLabel,
  onUpload,
  onChangeItemsPerPage,
  onToggleView,
  onToggleFilters,
  onSelectAll,
  allSelected,
  selectedCount = 0,
  onManageLabels,
  onDeleteSelected,
  onClearSelection,
  onCreateCollection
}: EnhancedHeaderProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  return (
    <header className="border-b border-border bg-black backdrop-blur-sm sticky top-0 z-40">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">📷 PhotoLabel</h1>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ActionsDropdown
              onUpload={onUpload}
              onCreateLabel={onCreateLabel}
            />
          </div>

          {/* Mobile Filter Button */}
          <div className="md:hidden">
            <DropdownMenu open={showMobileFilters} onOpenChange={setShowMobileFilters}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onUpload}>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Upload de Arquivos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateLabel}>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Nova Label
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros Avançados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View Controls - Desktop only */}
        <div className="hidden md:flex items-center justify-between mt-4 pt-3 border-t border-border">
          {/* Selection Actions - When items are selected */}
          {selectedCount > 0 ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                  {selectedCount}
                </div>
                <span className="text-sm font-medium">
                  arquivo{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {onCreateCollection && (
                  <Button
                    size="sm"
                    onClick={onCreateCollection}
                    className="flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    <span className="hidden lg:inline">Criar Coleção</span>
                  </Button>
                )}

                {onManageLabels && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onManageLabels}
                    className="flex items-center gap-2"
                  >
                    <Tag className="h-4 w-4" />
                    <span className="hidden lg:inline">Gerenciar Labels</span>
                  </Button>
                )}

                {onDeleteSelected && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onDeleteSelected}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden lg:inline">Deletar</span>
                  </Button>
                )}

                {onClearSelection && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onClearSelection}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    <span className="hidden lg:inline">Limpar</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Normal controls when no selection */
            <div className="flex items-center gap-3">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => onChangeItemsPerPage(parseInt(value))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 por página</SelectItem>
                  <SelectItem value="60">60 por página</SelectItem>
                  <SelectItem value="100">100 por página</SelectItem>
                </SelectContent>
              </Select>

              {/* Unlabeled Filter Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleUnlabeled}
                className={`gap-2 transition-all duration-200 ${
                  showUnlabeledFilter ? 'bg-unlabeled-alert-bg text-unlabeled-alert border-unlabeled-alert' : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-unlabeled-alert animate-pulse" />
                  <span className="font-medium">{unlabeledCount}</span>
                </div>
                <span className="hidden sm:inline">Sem Labels</span>
              </Button>
              
              {onSelectAll && (
                <Button
                  variant={allSelected ? "default" : "outline"}
                  size="sm"
                  onClick={onSelectAll}
                  className="flex items-center gap-2"
                >
                  <div className={`w-4 h-4 border rounded-sm flex items-center justify-center ${
                    allSelected ? 'border-primary-foreground bg-primary-foreground' : 'border-current'
                  }`}>
                    {allSelected && (
                      <div className="w-2 h-1 bg-primary rounded-sm" />
                    )}
                    {!allSelected && (
                      <div className="w-2 h-1 bg-current rounded-sm" />
                    )}
                  </div>
                  {allSelected ? 'Desselecionar Tudo' : 'Selecionar Tudo'}
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Toggle 
              pressed={viewMode === 'grid'}
              onPressedChange={onToggleView}
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {viewMode === 'grid' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
              <span className="ml-2 hidden lg:inline">
                {viewMode === 'grid' ? 'Grade' : 'Lista'}
              </span>
            </Toggle>
          </div>
        </div>
      </div>
    </header>
  );
}