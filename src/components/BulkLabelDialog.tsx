import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StandardLabelCreator } from './StandardLabelCreator';
import type { Photo, Label } from '@/types/photo';

interface BulkLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPhotos: Photo[];
  labels: Label[];
  onApplyLabels: (photoIds: string[], labelIds: string[]) => Promise<void>;
  onRemoveLabels: (photoIds: string[], labelIds: string[]) => Promise<void>;
  onCreateLabel?: (name: string, color?: string) => Promise<void>;
}

export function BulkLabelDialog({
  isOpen,
  onClose,
  selectedPhotos,
  labels,
  onApplyLabels,
  onRemoveLabels,
  onCreateLabel
}: BulkLabelDialogProps) {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Filter available labels (not already selected)
  const availableLabels = useMemo(() => {
    return labels.filter(label => 
      !selectedLabels.includes(label.id) &&
      label.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [labels, selectedLabels, searchQuery]);

  // Get applied labels
  const appliedLabels = useMemo(() => {
    return labels.filter(label => selectedLabels.includes(label.id));
  }, [labels, selectedLabels]);

  const handleAddLabel = (labelId: string) => {
    setSelectedLabels(prev => [...prev, labelId]);
    setSearchQuery('');
    setIsComboboxOpen(false);
  };

  const handleRemoveLabel = (labelId: string) => {
    setSelectedLabels(prev => prev.filter(id => id !== labelId));
  };

  const handleCreateNewLabel = async (name: string, color?: string) => {
    if (onCreateLabel) {
      await onCreateLabel(name, color);
    }
    setShowCreateDialog(false);
  };

  const handleApplyLabels = async () => {
    if (selectedLabels.length === 0) return;
    
    setIsApplying(true);
    try {
      const photoIds = selectedPhotos.map(p => p.id);
      await onApplyLabels(photoIds, selectedLabels);
      setSelectedLabels([]);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setSelectedLabels([]);
    setSearchQuery('');
    onClose();
  };

  // Get common labels across all selected photos
  const commonLabels = labels.filter(label => 
    selectedPhotos.every(photo => photo.labels.includes(label.id))
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Gerenciar Labels
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {selectedPhotos.length} arquivo{selectedPhotos.length !== 1 ? 's' : ''} selecionado{selectedPhotos.length !== 1 ? 's' : ''}
          </p>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Common Labels */}
          {commonLabels.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Labels comuns ({commonLabels.length})
              </h4>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
                {commonLabels.map(label => (
                  <Badge 
                    key={label.id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2"
                    style={{ backgroundColor: `${label.color}20`, borderColor: label.color }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: label.color }}
                    />
                    <span>{label.name}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Applied Labels */}
          {appliedLabels.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Labels a aplicar ({appliedLabels.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {appliedLabels.map((label) => (
                  <Badge 
                    key={label.id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2"
                    style={{ backgroundColor: `${label.color}20`, borderColor: label.color }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: label.color }}
                    />
                    <span>{label.name}</span>
                    <button
                      onClick={() => handleRemoveLabel(label.id)}
                      className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search and Add Labels */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Adicionar labels
            </h4>
            
            <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar ou criar nova label..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value && !isComboboxOpen) {
                        setIsComboboxOpen(true);
                      }
                    }}
                    className="pl-10 bg-background border-border"
                  />
                </div>
              </PopoverTrigger>
              
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
                <Command>
                  <CommandList className="max-h-48">
                    {availableLabels.length > 0 && (
                      <CommandGroup heading="Labels disponíveis">
                        {availableLabels.map((label) => (
                          <CommandItem
                            key={label.id}
                            onSelect={() => handleAddLabel(label.id)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <span 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: label.color }}
                            />
                            <span>{label.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    
                    {searchQuery && !availableLabels.some(label => 
                      label.name.toLowerCase() === searchQuery.toLowerCase()
                    ) && (
                      <CommandGroup heading="Criar nova">
                        <CommandItem
                          onSelect={() => setShowCreateDialog(true)}
                          className="flex items-center gap-2 cursor-pointer text-primary"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Criar "{searchQuery}"</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                    
                    {!searchQuery && availableLabels.length === 0 && (
                      <CommandEmpty>
                        Todas as labels já foram selecionadas.
                      </CommandEmpty>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={handleApplyLabels}
              disabled={selectedLabels.length === 0 || isApplying}
              className="flex-1"
            >
              Aplicar alterações
            </Button>
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>

        {/* Create Label Dialog */}
        <StandardLabelCreator
          trigger={<></>}
          isOpen={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateLabel={handleCreateNewLabel}
        />
      </DialogContent>
    </Dialog>
  );
}