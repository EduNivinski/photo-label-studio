import React, { useState, useMemo } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StandardLabelCreator } from './StandardLabelCreator';
import { useToast } from '@/hooks/use-toast';
import type { Label, Photo } from '@/types/photo';

interface LabelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  selectedPhoto?: Photo;
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  onDeleteLabel: (labelId: string) => Promise<boolean>;
  onUpdatePhotoLabels?: (photoId: string, labelIds: string[]) => Promise<boolean>;
}

export function LabelManager({ 
  isOpen, 
  onClose, 
  labels, 
  selectedPhoto,
  onCreateLabel, 
  onDeleteLabel,
  onUpdatePhotoLabels 
}: LabelManagerProps) {
  const [photoLabels, setPhotoLabels] = useState<string[]>(selectedPhoto?.labels || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  // Filter available labels (not already applied to photo)
  const availableLabels = useMemo(() => {
    return labels.filter(label => 
      !photoLabels.includes(label.id) &&
      label.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [labels, photoLabels, searchQuery]);

  // Get applied labels
  const appliedLabels = useMemo(() => {
    return labels.filter(label => photoLabels.includes(label.id));
  }, [labels, photoLabels]);

  const handleAddLabel = (labelId: string) => {
    setPhotoLabels(prev => [...prev, labelId]);
    setSearchQuery('');
    setIsComboboxOpen(false);
  };

  const handleRemoveLabel = (labelId: string) => {
    setPhotoLabels(prev => prev.filter(id => id !== labelId));
  };

  const handleCreateNewLabel = async (name: string, color?: string) => {
    await onCreateLabel(name, color);
    // The new label will be available after the component re-renders with updated labels
    toast({
      title: "Label criada",
      description: `Label "${name}" foi criada com sucesso.`
    });
    setShowCreateDialog(false);
  };

  const handleSaveChanges = async () => {
    if (!selectedPhoto || !onUpdatePhotoLabels) return;
    
    const success = await onUpdatePhotoLabels(selectedPhoto.id, photoLabels);
    if (success) {
      toast({
        title: "Alterações salvas",
        description: "Labels da foto foram atualizadas com sucesso!"
      });
      onClose();
    } else {
      toast({
        title: "Erro",
        description: "Falha ao atualizar labels da foto.",
        variant: "destructive"
      });
    }
  };

  // Reset state when photo changes
  React.useEffect(() => {
    setPhotoLabels(selectedPhoto?.labels || []);
    setSearchQuery('');
  }, [selectedPhoto]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Gerenciar Labels
          </DialogTitle>
          {selectedPhoto && (
            <p className="text-sm text-muted-foreground">
              {selectedPhoto.name}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Applied Labels */}
          {appliedLabels.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Labels aplicadas ({appliedLabels.length})
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
              
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                        Todas as labels já foram aplicadas.
                      </CommandEmpty>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          {selectedPhoto && (
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSaveChanges}
                className="flex-1"
              >
                Salvar alterações
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          )}
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
