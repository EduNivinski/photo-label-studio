import { useState } from 'react';
import { Filter, ChevronDown, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PhotoFilters } from '@/types/photo';

interface AdvancedFiltersProps {
  filters: PhotoFilters;
  showFavorites?: boolean;
  onUpdateFilters: (updates: Partial<PhotoFilters>) => void;
  onToggleFileType: (fileType: string) => void;
  onToggleMediaType: (mediaType: string) => void;
  onToggleFavorites?: () => void;
}

const fileTypes = ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'];
const mediaTypes = [
  { id: 'photo', label: 'Fotos' },
  { id: 'video', label: 'Vídeos' }
];

const sortOptions = [
  { value: 'date-desc', label: 'Data (mais recentes)' },
  { value: 'date-asc', label: 'Data (mais antigas)' },
  { value: 'name-asc', label: 'Nome (A → Z)' },
  { value: 'name-desc', label: 'Nome (Z → A)' }
];

export function AdvancedFilters({ 
  filters, 
  showFavorites = false,
  onUpdateFilters, 
  onToggleFileType, 
  onToggleMediaType,
  onToggleFavorites
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = 
    filters.fileTypes.length < 6 ||
    filters.mediaTypes.length < 2 ||
    showFavorites;

  return (
    <div className="space-y-4">
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
          {/* Favorites Filter */}
          {onToggleFavorites && (
            <div className="space-y-2">
              <Button
                variant={showFavorites ? "default" : "outline"}
                size="sm"
                onClick={onToggleFavorites}
                className="w-full justify-start gap-2 h-8 text-xs"
              >
                <Heart className={`h-3 w-3 ${showFavorites ? 'fill-current' : ''}`} />
                {showFavorites ? 'Mostrando Favoritos' : 'Mostrar Favoritos'}
              </Button>
            </div>
          )}

          {/* Sort Order */}
          <div className="space-y-2">
            <label className="text-xs text-sidebar-foreground/60">Ordenar por</label>
            <Select 
              value={filters.sortBy} 
              onValueChange={(value) => onUpdateFilters({ sortBy: value as PhotoFilters['sortBy'] })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}