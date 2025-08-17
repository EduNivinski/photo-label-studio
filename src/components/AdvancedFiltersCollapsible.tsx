import { useState } from 'react';
import { Filter, ChevronDown, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PhotoFilters } from '@/types/photo';

interface AdvancedFiltersCollapsibleProps {
  filters: PhotoFilters;
  showFavorites: boolean;
  onUpdateFilters: (updates: Partial<PhotoFilters>) => void;
  onToggleFavorites: () => void;
}

export function AdvancedFiltersCollapsible({
  filters,
  showFavorites,
  onUpdateFilters,
  onToggleFavorites
}: AdvancedFiltersCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = showFavorites || filters.sortBy !== 'date-desc';

  return (
    <div className="space-y-2">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-3 w-3" />
              Filtros Avançados
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Ativos
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Show Favorites */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-3 w-3 text-sidebar-foreground/60" />
              <label className="text-xs text-sidebar-foreground/60">Mostrar Favoritos</label>
            </div>
            <Switch
              checked={showFavorites}
              onCheckedChange={onToggleFavorites}
            />
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-xs text-sidebar-foreground/60">Ordenar por</label>
            <Select 
              value={filters.sortBy || 'date-desc'} 
              onValueChange={(value) => onUpdateFilters({ sortBy: value as any })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Mais recentes</SelectItem>
                <SelectItem value="date-asc">Mais antigas</SelectItem>
                <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onUpdateFilters({ sortBy: 'date-desc' });
                if (showFavorites) onToggleFavorites();
              }}
              className="w-full h-8 text-xs"
            >
              Limpar filtros avançados
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}