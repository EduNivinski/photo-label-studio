import { useState } from 'react';
import { Filter, Grid3X3, List, ChevronDown } from 'lucide-react';
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
  onToggleFilters
}: EnhancedHeaderProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">📷 PhotoLabel</h1>
              <p className="text-sm text-muted-foreground">
                {currentlyShowing} de {totalItems} arquivo{totalItems !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Unlabeled Alert Button - Left side as requested */}
            <Button
              variant="unlabeled"
              size="sm"
              onClick={onToggleUnlabeled}
              className={`gap-2 transition-all duration-200 ${
                showUnlabeledFilter ? 'ring-2 ring-unlabeled-alert' : ''
              }`}
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-unlabeled-alert animate-pulse" />
                <span className="font-medium">{unlabeledCount}</span>
              </div>
              <span className="hidden sm:inline">Sem Labels</span>
            </Button>
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
          </div>

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