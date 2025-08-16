import { useState } from 'react';
import { X, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartLabelSearch } from '@/components/SmartLabelSearch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Label } from '@/types/photo';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  selectedLabels: string[];
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onLabelToggle?: (labelId: string) => void;
  onClearFilters?: () => void;
  className?: string;
}

export function MobileSearchOverlay({
  isOpen,
  onClose,
  labels,
  selectedLabels,
  searchTerm = '',
  onSearchChange,
  onLabelToggle,
  onClearFilters,
  className
}: MobileSearchOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-background",
      "md:hidden", // Only show on mobile
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Buscar & Filtrar</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Buscar por nome
          </label>
          <Input
            placeholder="Digite o nome da foto..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-12"
          />
        </div>

        {/* Label Search */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Filtrar por labels
          </label>
          <SmartLabelSearch
            labels={labels}
            selectedLabels={selectedLabels}
            onLabelToggle={onLabelToggle}
            onClearFilters={onClearFilters}
            compact={false}
          />
        </div>

        {/* Applied Filters */}
        {selectedLabels.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Filtros aplicados
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-xs h-6"
              >
                Limpar todos
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
                    className="cursor-pointer flex items-center gap-1 px-3 py-1"
                    onClick={() => onLabelToggle?.(labelId)}
                  >
                    {label.name}
                    <X className="h-3 w-3" />
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onClose}
            className="flex-1"
          >
            Aplicar Filtros
          </Button>
        </div>
      </div>
    </div>
  );
}