import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label as UILabel } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LabelChip } from './LabelChip';
import type { Label } from '@/types/photo';

interface AdvancedFiltersProps {
  labels: Label[];
  selectedLabels: string[];
  filterMode: 'AND' | 'OR';
  showUnlabeled: boolean;
  onLabelToggle: (labelId: string) => void;
  onFilterModeChange: (mode: 'AND' | 'OR') => void;
  onToggleUnlabeled: () => void;
  onClearFilters: () => void;
}

export function AdvancedFilters({
  labels,
  selectedLabels,
  filterMode,
  showUnlabeled,
  onLabelToggle,
  onFilterModeChange,
  onToggleUnlabeled,
  onClearFilters
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={(selectedLabels.length > 0 || showUnlabeled) ? 'border-primary' : ''}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {(selectedLabels.length > 0 || showUnlabeled) && (
            <span className="ml-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {selectedLabels.length + (showUnlabeled ? 1 : 0)}
            </span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Filtros Avançados</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Special Filters */}
          <div className="space-y-3">
            <UILabel className="text-sm font-medium">Filtros Especiais</UILabel>
            <div className="flex items-center space-x-2">
              <Button
                variant={showUnlabeled ? "default" : "outline"}
                size="sm"
                onClick={onToggleUnlabeled}
                className="text-sm"
              >
                {showUnlabeled ? '✓ ' : ''}Sem Labels
              </Button>
              <UILabel className="text-xs text-muted-foreground">
                Mostrar apenas fotos que não têm nenhuma label
              </UILabel>
            </div>
          </div>

          {/* Filter Mode */}
          <div className="space-y-3">
            <UILabel className="text-sm font-medium">Modo de Filtro para Labels</UILabel>
            <RadioGroup 
              value={filterMode} 
              onValueChange={(value: 'AND' | 'OR') => onFilterModeChange(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="AND" id="and" />
                <UILabel htmlFor="and" className="text-sm">
                  <strong>E (AND)</strong> - Mostrar fotos que têm TODAS as labels selecionadas
                </UILabel>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="OR" id="or" />
                <UILabel htmlFor="or" className="text-sm">
                  <strong>OU (OR)</strong> - Mostrar fotos que têm QUALQUER uma das labels selecionadas
                </UILabel>
              </div>
            </RadioGroup>
          </div>

          {/* Labels Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <UILabel className="text-sm font-medium">
                Selecionar Labels ({selectedLabels.length} de {labels.length})
              </UILabel>
              {(selectedLabels.length > 0 || showUnlabeled) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClearFilters}
                  className="text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
              {labels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center w-full py-4">
                  Nenhuma label disponível. Crie labels primeiro!
                </p>
              ) : (
                labels.map((label) => (
                  <LabelChip
                    key={label.id}
                    label={label}
                    isSelected={selectedLabels.includes(label.id)}
                    onClick={() => onLabelToggle(label.id)}
                    variant="filter"
                  />
                ))
              )}
            </div>
          </div>

          {/* Active Filters Summary */}
          {(selectedLabels.length > 0 || showUnlabeled) && (
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <UILabel className="text-xs font-medium text-muted-foreground">
                Filtros Ativos:
              </UILabel>
              {showUnlabeled && (
                <p className="text-sm">
                  • Mostrar apenas fotos <strong>sem labels</strong>
                </p>
              )}
              {selectedLabels.length > 0 && (
                <p className="text-sm">
                  • Mostrar fotos que têm{' '}
                  <strong>
                    {filterMode === 'AND' ? 'TODAS' : 'QUALQUER UMA'}
                  </strong>{' '}
                  das {selectedLabels.length} label{selectedLabels.length !== 1 ? 's' : ''} selecionada{selectedLabels.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          <Button 
            onClick={() => setIsOpen(false)} 
            className="w-full"
          >
            Aplicar Filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}