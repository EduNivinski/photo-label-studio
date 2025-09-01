import { useState, useMemo } from 'react';
import { Search, X, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Label } from '@/types/photo';

interface SmartLabelSearchProps {
  labels: Label[];
  selectedLabels: string[];
  onLabelToggle: (labelId: string) => void;
  onClearFilters: () => void;
  compact?: boolean;
}

export function SmartLabelSearch({
  labels,
  selectedLabels,
  onLabelToggle,
  onClearFilters,
  compact = false
}: SmartLabelSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredLabels = useMemo(() => {
    if (!searchTerm) return labels;
    return labels.filter(label => 
      label.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [labels, searchTerm]);

  const unselectedLabels = filteredLabels.filter(label => 
    !selectedLabels.includes(label.id)
  );

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className={`w-full justify-start text-left font-normal ${compact ? 'h-10 text-sm' : 'h-10'}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            {searchTerm || "Buscar labels..."}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="p-0 w-80 z-50" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          sideOffset={4}
        >
          <Command>
            <CommandInput 
              placeholder="Buscar labels..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandEmpty>Nenhuma label encontrada.</CommandEmpty>
              <CommandGroup heading="Labels disponíveis">
                {unselectedLabels.map((label) => (
                  <CommandItem
                    key={label.id}
                    onSelect={() => {
                      onLabelToggle(label.id);
                      setSearchTerm('');
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Tag className="h-4 w-4" style={{ color: label.color }} />
                    <span>{label.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Labels */}
      {!compact && selectedLabels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Labels selecionadas ({selectedLabels.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs h-6"
            >
              Limpar todas
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map((labelId) => {
              const label = labels.find(l => l.id === labelId);
              if (!label) return null;
              
              return (
                <Badge
                  key={labelId}
                  variant="secondary"
                  className="flex items-center gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => onLabelToggle(labelId)}
                >
                  <Tag className="h-3 w-3" style={{ color: label.color }} />
                  {label.name}
                  <X className="h-3 w-3" />
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {!compact && (
        <div className="text-xs text-muted-foreground">
          {labels.length} label{labels.length !== 1 ? 's' : ''} disponível{labels.length !== 1 ? 'is' : ''} • {selectedLabels.length} selecionada{selectedLabels.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}