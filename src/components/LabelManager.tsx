import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label as LabelType } from "@/types/photo";
import { StandardLabelCreator } from "./StandardLabelCreator";
import { toast } from "@/hooks/use-toast";
import { X, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LabelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  labels: LabelType[];
  selectedPhoto: any;
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  onDeleteLabel: (labelId: string) => Promise<boolean>;
  onUpdatePhotoLabels: (photoId: string, labelIds: string[]) => Promise<boolean>;
}

export function LabelManager({
  isOpen,
  onClose,
  labels,
  selectedPhoto,
  onCreateLabel,
  onDeleteLabel,
  onUpdatePhotoLabels,
}: LabelManagerProps) {
  const [photoLabels, setPhotoLabels] = useState<string[]>([]);
  const [originalLabels, setOriginalLabels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [composing, setComposing] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

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

  // Reset state when dialog opens or photo changes
  useEffect(() => {
    if (isOpen && selectedPhoto) {
      const photoLabelIds = selectedPhoto.labels || [];
      setPhotoLabels([...photoLabelIds]);
      setOriginalLabels([...photoLabelIds]);
      setSearchQuery("");
      setIsComboboxOpen(false);
      setShowCreateDialog(false);
    }
  }, [isOpen, selectedPhoto]);

  // Dropdown event listeners
  useEffect(() => {
    if (!isComboboxOpen) return;
    
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      // Only close if clicking completely outside both input and dropdown
      if (!dropdownRef.current?.contains(target) && !inputRef.current?.contains(target)) {
        setIsComboboxOpen(false);
      }
    }
    
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsComboboxOpen(false);
        inputRef.current?.blur();
      }
    }
    
    // Delay to prevent immediate closure when clicking input to focus
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKeyDown);
    }, 200);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isComboboxOpen]);

  // Prevent global hotkeys when input is focused
  useEffect(() => {
    if (!isOpen) return;
    
    function globalKeyHandler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInputFocused = target === inputRef.current;
      
      if (isInputFocused) {
        // Block ALL global shortcuts when typing in the search input
        e.stopPropagation();
        return;
      }
    }
    
    document.addEventListener('keydown', globalKeyHandler, true);
    return () => document.removeEventListener('keydown', globalKeyHandler, true);
  }, [isOpen]);

  const handleSaveChanges = useCallback(async () => {
    if (!selectedPhoto || isApplying) return;

    // Calculate changes
    const toAdd = photoLabels.filter(id => !originalLabels.includes(id));
    const toRemove = originalLabels.filter(id => !photoLabels.includes(id));
    
    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose();
      return;
    }

    setIsApplying(true);
    setIsSyncing(true);

    try {
      const assetId = selectedPhoto.source === 'gdrive' 
        ? `gdrive:${selectedPhoto.item_key || selectedPhoto.id}` 
        : `db:${selectedPhoto.id}`;

      const { data, error } = await supabase.functions.invoke('labels-apply-batch', {
        body: {
          assetId,
          toAdd,
          toRemove
        }
      });

      if (error) throw error;

      if (data.errors && data.errors.length > 0) {
        console.warn('Some label operations failed:', data.errors);
      }

      // Update the original labels to match current state
      setOriginalLabels([...photoLabels]);

      await onUpdatePhotoLabels(selectedPhoto.id, photoLabels);

      toast({
        title: "Labels atualizadas",
        description: "As labels foram aplicadas com sucesso.",
      });
      
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar labels:", error);
      
      // Rollback optimistic UI
      setPhotoLabels([...originalLabels]);
      
      toast({
        title: "Não foi possível atualizar as labels",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
      setIsSyncing(false);
    }
  }, [selectedPhoto, photoLabels, originalLabels, isApplying, onUpdatePhotoLabels, onClose]);

  // Debounced save for rapid changes
  const debouncedSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(handleSaveChanges, 200);
  }, [handleSaveChanges]);

  const handleAddLabel = useCallback((labelId: string) => {
    if (!photoLabels.includes(labelId)) {
      setPhotoLabels(prev => [...prev, labelId]);
      setIsComboboxOpen(false);
      setSearchQuery("");
    }
  }, [photoLabels]);

  const handleRemoveLabel = useCallback((labelId: string) => {
    setPhotoLabels(prev => prev.filter((id) => id !== labelId));
  }, []);

  const handleCreateAndApplyLabel = useCallback(async (name: string, color?: string) => {
    if (!selectedPhoto) return;
    
    try {
      const sanitizedName = name.trim().slice(0, 50);
      
      if (!sanitizedName) {
        toast({
          title: "Nome inválido",
          description: "O nome da label não pode estar vazio.",
          variant: "destructive",
        });
        return;
      }

      // Check if label already exists
      const existingLabel = labels.find(l => l.name.toLowerCase() === sanitizedName.toLowerCase());
      
      if (existingLabel) {
        // Apply existing label
        handleAddLabel(existingLabel.id);
        return;
      }

      setIsSyncing(true);

      const assetId = selectedPhoto.source === 'gdrive' 
        ? `gdrive:${selectedPhoto.item_key || selectedPhoto.id}` 
        : `db:${selectedPhoto.id}`;

      // Create and apply label optimistically
      const tempId = `temp_${Date.now()}`;
      
      // Add to UI immediately (optimistic)
      setPhotoLabels(prev => [...prev, tempId]);
      
      // Call backend to create and apply
      const { data, error } = await supabase.functions.invoke('labels-create-and-apply', {
        body: {
          assetId,
          labelName: sanitizedName,
          labelColor: color
        }
      });

      if (error) throw error;

      // Replace temp ID with real ID
      setPhotoLabels(prev => prev.map(id => id === tempId ? data.label.id : id));
      
      // Update the original labels to reflect the change
      setOriginalLabels(prev => [...prev, data.label.id]);

      // Trigger parent update
      await onUpdatePhotoLabels(selectedPhoto.id, photoLabels.map(id => id === tempId ? data.label.id : id));

      toast({
        title: data.created ? "Label criada e aplicada" : "Label aplicada",
        description: `"${sanitizedName}" ${data.created ? 'foi criada e' : ''} foi aplicada ao arquivo.`,
      });

    } catch (error) {
      console.error("Erro ao criar/aplicar label:", error);
      
      // Remove optimistic addition
      setPhotoLabels(prev => prev.filter(id => !id.startsWith('temp_')));
      
      toast({
        title: "Erro ao criar label",
        description: "Não foi possível criar/aplicar a label. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setSearchQuery("");
      setIsComboboxOpen(false);
    }
  }, [selectedPhoto, photoLabels, labels, handleAddLabel, onUpdatePhotoLabels]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Gerenciar Labels
            {isSyncing && (
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </DialogTitle>
          {selectedPhoto && (
            <p className="text-sm text-muted-foreground">
              {selectedPhoto.name}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Applied Labels */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Labels aplicadas ({appliedLabels.length})
            </h4>
            {appliedLabels.length > 0 ? (
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveLabel(label.id);
                      }}
                      className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma label aplicada ainda</p>
            )}
          </div>

          {/* Search and Add Labels */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Adicionar labels
            </h4>
            
            <div className="flex items-center space-x-2 mb-4" ref={dropdownRef}>
              <div className="relative w-full">
                <Input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Open dropdown when typing
                    if (!isComboboxOpen) {
                      setIsComboboxOpen(true);
                    }
                  }}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={(e) => {
                    setComposing(false);
                    setSearchQuery(e.currentTarget.value);
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // Always open on focus, regardless of content
                    setIsComboboxOpen(true);
                  }}
                  onKeyDown={(e) => {
                    // Allow normal text input operations
                    if (e.key === ' ' || e.key === 'Backspace' || e.key === 'Delete') {
                      e.stopPropagation();
                      return;
                    }
                    
                    if (!composing) {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        const term = searchQuery.trim();
                        if (term) {
                          const existingLabel = availableLabels.find(l => 
                            l.name.toLowerCase() === term.toLowerCase()
                          );
                          
                          if (existingLabel) {
                            handleAddLabel(existingLabel.id);
                          } else {
                            handleCreateAndApplyLabel(term);
                          }
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsComboboxOpen(false);
                        inputRef.current?.blur();
                      }
                    }
                  }}
                  placeholder="Buscar ou criar nova label..."
                  className="w-full"
                />
                
                {isComboboxOpen && (searchQuery.trim() || availableLabels.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {availableLabels.length > 0 && (
                      <div className="p-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Labels existentes</div>
                        {availableLabels.map((label) => (
                          <div
                            key={label.id}
                            onClick={() => handleAddLabel(label.id)}
                            className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                          >
                            <div 
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: label.color || "#6B7280" }}
                            />
                            {label.name}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {searchQuery.trim() && !availableLabels.some(label => 
                      label.name.toLowerCase() === searchQuery.toLowerCase()
                    ) && (
                      <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Criar nova</div>
                        <div
                          onClick={() => handleCreateAndApplyLabel(searchQuery.trim())}
                          className="flex items-center p-2 hover:bg-blue-50 dark:hover:bg-blue-900 rounded cursor-pointer text-blue-600 dark:text-blue-400"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Criar e aplicar "{searchQuery.trim()}"
                        </div>
                      </div>
                    )}
                    
                    {searchQuery.trim() === '' && availableLabels.length === 0 && (
                      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Digite para buscar ou criar uma nova label
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSaveChanges} 
            disabled={isApplying}
            className="flex items-center gap-2"
          >
            {isApplying && <RefreshCw className="h-4 w-4 animate-spin" />}
            Aplicar alterações
          </Button>
        </DialogFooter>

        <StandardLabelCreator
          trigger={<></>}
          isOpen={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateLabel={async (name: string, color?: string) => {
            await onCreateLabel(name, color);
            setShowCreateDialog(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}